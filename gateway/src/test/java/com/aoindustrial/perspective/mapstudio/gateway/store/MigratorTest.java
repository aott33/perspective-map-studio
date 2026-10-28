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
    void anEmptyDatabaseGetsEveryMigrationEachInOneTransaction() throws Exception {
        FakeJdbc db = new FakeJdbc();
        Migrator.Result result = migrator().migrate(db.connection());
        assertEquals(List.of(1, 2), result.applied());
        assertEquals(2, result.version());
        assertEquals(Migrator.VERSION_TABLE_EXISTS, db.executed.get(0), "a read without a lock comes first");
        assertEquals(Migrator.LOCK, db.executed.get(1), "then the advisory lock, before any DDL");
        assertEquals(Migrator.CREATE_VERSION_TABLE, db.executed.get(2));
        assertEquals(Migrator.READ_VERSION, db.executed.get(3));
        assertTrue(db.executed.containsAll(Migrations.all().get(0).statements()));
        assertTrue(db.executed.containsAll(Migrations.all().get(1).statements()));
        assertEquals(Migrator.RECORD_VERSION, db.executed.get(db.executed.size() - 1));
        assertEquals(List.of("commit", "commit", "commit"), db.events,
            "the read's commit, then one commit per migration; no rollback");
        assertTrue(db.autoCommit, "auto-commit is restored");
    }

    @Test
    void everyAppliedMigrationRecordsTheModuleVersionItWasGiven() throws Exception {
        // The audit column mapstudio_schema_version.module_version holds the build's version
        // (the 0.2.0 rehearsal found "dev" there: no manifest carried one, fixed before the tag).
        FakeJdbc db = new FakeJdbc();
        Migrator.Result result = new Migrator(Migrations.all(), "0.2.0").migrate(db.connection());
        assertEquals(List.of(1, 2), result.applied());
        assertEquals(List.of("0.2.0", "0.2.0"), db.boundStrings,
            "one module_version per migration, the version the migrator was given, never a placeholder");
    }

    @Test
    void anUpgradeRecordsTheModuleVersionOnlyForWhatItApplied() throws Exception {
        FakeJdbc db = new FakeJdbc();
        db.version = 1;
        new Migrator(Migrations.all(), "0.3.0-SNAPSHOT").migrate(db.connection());
        assertEquals(List.of("0.3.0-SNAPSHOT"), db.boundStrings, "migration 1's row is not written again");
    }

    @Test
    void aMigratedDatabaseIsOnlyRead() throws Exception {
        FakeJdbc db = new FakeJdbc();
        db.version = 2;
        Migrator.Result result = migrator().migrate(db.connection());
        assertEquals(List.of(), result.applied());
        assertEquals(2, result.version());
        assertEquals(List.of(Migrator.VERSION_TABLE_EXISTS, Migrator.READ_VERSION), db.executed,
            "no lock and no CREATE on a migrated database");
    }

    @Test
    void aRoleWithoutCreateComesUpOnAMigratedDatabase() throws Exception {
        // The reviewer's case: a SELECT/INSERT/UPDATE role on PostgreSQL 16 gets 42501 on any CREATE.
        FakeJdbc db = new FakeJdbc();
        db.version = 2;
        db.failOn = "CREATE";
        assertEquals(2, migrator().migrate(db.connection()).version());
    }

    @Test
    void schemaOneIsUpgradedToTwoAlone() throws Exception {
        // Epic 2 story 14: a store left at schema 1 gets migration 2 only, in one transaction.
        FakeJdbc db = new FakeJdbc();
        db.version = 1;
        Migrator.Result result = migrator().migrate(db.connection());
        assertEquals(List.of(2), result.applied());
        assertEquals(2, result.version());
        assertTrue(db.executed.containsAll(Migrations.all().get(1).statements()));
        assertTrue(db.executed.stream().noneMatch(Migrations.all().get(0).statements()::contains),
            "migration 1 is not run again");
        assertEquals(List.of("commit", "commit", "commit"), db.events,
            "the first read, migration 1 found applied under the lock, then migration 2");
    }

    @Test
    void anUpgradeByARoleThatDoesNotOwnTheTableFailsWholeAndNamesTheAlter() {
        // ALTER TABLE needs the table's owner (docs/operations.md): a runtime role gets 42501 and nothing changes.
        FakeJdbc db = new FakeJdbc();
        db.version = 1;
        db.failOn = "ALTER TABLE mapstudio_item";
        db.failMessage = "must be owner of table mapstudio_item";
        Migrator.MigrationFailure ex = assertThrows(Migrator.MigrationFailure.class,
            () -> migrator().migrate(db.connection()));
        assertEquals(2, ex.migration());
        assertEquals(2, ex.ordinal(), "after CREATE TABLE IF NOT EXISTS mapstudio_schema_version");
        assertEquals("42501", ex.getSQLState());
        assertEquals(List.of("commit", "commit", "rollback"), db.events, "migration 2 rolled back whole");
        assertTrue(db.executed.stream().noneMatch(s -> s.startsWith("CREATE INDEX mapstudio_item_attached_line")));
    }

    @Test
    void aNewerSchemaIsRefused() {
        FakeJdbc db = new FakeJdbc();
        db.version = 3;
        Migrator.SchemaNewerException ex = assertThrows(Migrator.SchemaNewerException.class,
            () -> migrator().migrate(db.connection()));
        assertEquals(3, ex.found());
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
