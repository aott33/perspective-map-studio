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
        assertEquals(Migrator.VERSION_TABLE_EXISTS, db.executed.get(0), "a read without a lock comes first");
        assertEquals(Migrator.LOCK, db.executed.get(1), "then the advisory lock, before any DDL");
        assertEquals(Migrator.CREATE_VERSION_TABLE, db.executed.get(2));
        assertEquals(Migrator.READ_VERSION, db.executed.get(3));
        assertTrue(db.executed.containsAll(Migrations.all().get(0).statements()));
        assertEquals(Migrator.RECORD_VERSION, db.executed.get(db.executed.size() - 1));
        assertEquals(List.of("commit", "commit"), db.events,
            "the read's commit, then one commit for the whole first schema; no rollback");
        assertTrue(db.autoCommit, "auto-commit is restored");
    }

    @Test
    void aMigratedDatabaseIsOnlyRead() throws Exception {
        FakeJdbc db = new FakeJdbc();
        db.version = 1;
        Migrator.Result result = migrator().migrate(db.connection());
        assertEquals(List.of(), result.applied());
        assertEquals(1, result.version());
        assertEquals(List.of(Migrator.VERSION_TABLE_EXISTS, Migrator.READ_VERSION), db.executed,
            "no lock and no CREATE on a migrated database");
    }

    @Test
    void aRoleWithoutCreateComesUpOnAMigratedDatabase() throws Exception {
        // The reviewer's case: a SELECT/INSERT/UPDATE role on PostgreSQL 16 gets 42501 on any CREATE.
        FakeJdbc db = new FakeJdbc();
        db.version = 1;
        db.failOn = "CREATE";
        assertEquals(1, migrator().migrate(db.connection()).version());
    }

    @Test
    void aNewerSchemaIsRefused() {
        FakeJdbc db = new FakeJdbc();
        db.version = 2;
        Migrator.SchemaNewerException ex = assertThrows(Migrator.SchemaNewerException.class,
            () -> migrator().migrate(db.connection()));
        assertEquals(2, ex.found());
        assertEquals(List.of(Migrator.VERSION_TABLE_EXISTS, Migrator.READ_VERSION), db.executed,
            "nothing is locked or changed");
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
        assertEquals(List.of("commit", "rollback"), db.events,
            "no half-created schema: only the read was committed, the migration rolled back");
        assertTrue(db.autoCommit);
    }
}
