package com.aoindustrial.perspective.mapstudio.gateway.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

/** Failed and newer schemas in the migrator (epic 2 story 5), against the scripted JDBC connection. */
class MigratorFailureTest {

    static final List<String> FILE = Migrations.all().get(0).statements();
    static final int COUNT = FILE.size() + 2;

    static Migrator migrator() {
        return new Migrator(Migrations.all(), "test");
    }

    @Test
    void aConnectOnlyRoleFailsOnStatementOneAndNothingIsCommitted() {
        FakeJdbc db = new FakeJdbc();
        db.failOn = Migrator.CREATE_VERSION_TABLE;
        Migrator.MigrationFailure ex = assertThrows(Migrator.MigrationFailure.class,
            () -> migrator().migrate(db.connection()));
        assertEquals(1, ex.migration());
        assertEquals(1, ex.ordinal());
        assertEquals(COUNT, ex.count());
        assertEquals("42501", ex.getSQLState());
        assertFalse(db.executed.stream().anyMatch(FILE::contains), "no statement of the file ran");
        assertEquals(List.of("commit", "rollback"), db.events, "only the first read is committed");
    }

    @Test
    void everyStatementOfTheFileIsNumberedAndLaterOnesDoNotRun() {
        for (int n = 0; n < FILE.size(); n++) {
            FakeJdbc db = new FakeJdbc();
            db.failOn = FILE.get(n);
            db.failSqlState = "42P07";
            Migrator.MigrationFailure ex = assertThrows(Migrator.MigrationFailure.class,
                () -> migrator().migrate(db.connection()));
            assertEquals(n + 2, ex.ordinal(), "statement " + n + " of the file");
            assertEquals(FILE.get(n), ex.statement());
            assertEquals("42P07", ex.getSQLState());
            for (int later = n + 1; later < FILE.size(); later++) {
                assertFalse(db.executed.contains(FILE.get(later)), "a later statement ran after the failure");
            }
            assertFalse(db.executed.contains(Migrator.RECORD_VERSION), "no version recorded");
            assertEquals(List.of("commit", "rollback"), db.events);
            assertTrue(db.autoCommit, "auto-commit restored");
        }
    }

    @Test
    void aFailedVersionRecordIsTheLastStatement() {
        FakeJdbc db = new FakeJdbc();
        db.failOn = "INSERT INTO mapstudio_schema_version";
        Migrator.MigrationFailure ex = assertThrows(Migrator.MigrationFailure.class,
            () -> migrator().migrate(db.connection()));
        assertEquals(COUNT, ex.ordinal());
        assertEquals(List.of("commit", "rollback"), db.events);
    }

    @Test
    void aNonSqlFailureRollsBackWithNoSqlState() {
        FakeJdbc db = new FakeJdbc();
        db.failOnRuntime = "CREATE TABLE mapstudio_item";
        Migrator.MigrationFailure ex = assertThrows(Migrator.MigrationFailure.class,
            () -> migrator().migrate(db.connection()));
        assertTrue(ex.runtime());
        assertEquals(null, ex.getSQLState());
        assertEquals("none", FailureLine.sqlState(ex));
        assertEquals(List.of("commit", "rollback"), db.events);
    }

    @Test
    void aNewerSchemaFoundInsideTheLockIsRolledBack() {
        // Another Gateway upgraded between the first read and the lock.
        FakeJdbc db = new FakeJdbc();
        db.version = 0;
        db.tableExists = false;
        Migrator m = migrator();
        // First read says 0; make the read inside the lock say 5 by switching after the first query.
        Migrator.SchemaNewerException ex = assertThrows(Migrator.SchemaNewerException.class, () -> {
            java.sql.Connection c = db.connection();
            java.sql.Connection spy = (java.sql.Connection) java.lang.reflect.Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[] {java.sql.Connection.class}, (proxy, method, args) -> {
                    if ("commit".equals(method.getName())) {
                        db.version = 5;
                        db.tableExists = true;
                    }
                    return method.invoke(c, args);
                });
            m.migrate(spy);
        });
        assertEquals(5, ex.found());
        assertEquals(1, ex.known());
        assertFalse(db.executed.stream().anyMatch(FILE::contains), "nothing migrated");
        assertEquals("commit", db.events.get(0));
        assertEquals(1, db.events.stream().filter("commit"::equals).count(), "only the first read is committed");
        assertTrue(db.events.contains("rollback"));
    }

    @Test
    void aStandbyOnlyReadsTheVersion() throws Exception {
        FakeJdbc db = new FakeJdbc();
        db.version = 1;
        db.failOn = "CREATE";
        assertEquals(1, migrator().recordedVersion(db.connection()));
        assertEquals(List.of(Migrator.VERSION_TABLE_EXISTS, Migrator.READ_VERSION), db.executed);
        FakeJdbc empty = new FakeJdbc();
        assertEquals(0, migrator().recordedVersion(empty.connection()));
        assertEquals(List.of(Migrator.VERSION_TABLE_EXISTS), empty.executed, "no table, no further read, no DDL");
        assertEquals(1, migrator().known());
    }
}
