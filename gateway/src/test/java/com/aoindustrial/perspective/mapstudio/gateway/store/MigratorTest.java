package com.aoindustrial.perspective.mapstudio.gateway.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

/** The migrator against a scripted JDBC connection (the live runs are in docs/platform-checks.md and the plan). */
class MigratorTest {

    static Migrator migrator() {
        return new Migrator(Migrations.all(), "test");
    }

    @Test
    void anEmptyDatabaseGetsTheWholeFirstSchemaAndVersionOneInOneTransaction() throws Exception {
        FakeJdbc db = new FakeJdbc();
        Migrator.Result result = migrator().migrate(db.connection());
        assertEquals(List.of(1), result.applied());
        assertEquals(1, result.version());
        assertEquals(Migrator.LOCK, db.executed.get(0), "the advisory lock comes first");
        assertEquals(Migrator.CREATE_VERSION_TABLE, db.executed.get(1));
        assertEquals(Migrator.READ_VERSION, db.executed.get(2));
        assertTrue(db.executed.containsAll(Migrations.all().get(0).statements()));
        assertEquals(Migrator.RECORD_VERSION, db.executed.get(db.executed.size() - 1));
        assertEquals(List.of("commit"), db.events, "one commit, no rollback");
        assertTrue(db.autoCommit, "auto-commit is restored");
    }

    @Test
    void aMigratedDatabaseChangesNothing() throws Exception {
        FakeJdbc db = new FakeJdbc();
        db.version = 1;
        Migrator.Result result = migrator().migrate(db.connection());
        assertEquals(List.of(), result.applied());
        assertEquals(1, result.version());
        assertEquals(List.of(Migrator.LOCK, Migrator.CREATE_VERSION_TABLE, Migrator.READ_VERSION), db.executed);
        assertEquals(List.of("commit"), db.events);
    }

    @Test
    void aNewerSchemaIsRefused() {
        FakeJdbc db = new FakeJdbc();
        db.version = 2;
        Migrator.SchemaNewerException ex = assertThrows(Migrator.SchemaNewerException.class,
            () -> migrator().migrate(db.connection()));
        assertEquals(2, ex.found());
        assertTrue(db.events.contains("rollback"));
        assertTrue(!db.events.contains("commit"));
    }

    @Test
    void aFailedStatementRollsBackEverythingAndNamesTheStatement() {
        FakeJdbc db = new FakeJdbc();
        db.failOn = "CREATE TABLE mapstudio_edit";
        Migrator.MigrationFailure ex = assertThrows(Migrator.MigrationFailure.class,
            () -> migrator().migrate(db.connection()));
        assertEquals("42501", ex.getSQLState());
        assertTrue(ex.statement().startsWith("CREATE TABLE mapstudio_edit"));
        assertTrue(db.events.contains("rollback"));
        assertTrue(!db.events.contains("commit"), "no half-created schema: nothing is committed");
        assertTrue(db.autoCommit);
    }
}
