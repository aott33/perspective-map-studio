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
        assertEquals(List.of(1, 2, 3, 4), result.applied());
        assertEquals(4, result.version());
        assertEquals(Migrator.VERSION_TABLE_EXISTS, db.executed.get(0), "a read without a lock comes first");
        assertEquals(Migrator.LOCK, db.executed.get(1), "then the advisory lock, before any DDL");
        assertEquals(Migrator.CREATE_VERSION_TABLE, db.executed.get(2));
        assertEquals(Migrator.READ_VERSION, db.executed.get(3));
        assertTrue(db.executed.containsAll(Migrations.all().get(0).statements()));
        assertTrue(db.executed.containsAll(Migrations.all().get(1).statements()));
        assertTrue(db.executed.containsAll(Migrations.all().get(2).statements()));
        assertTrue(db.executed.containsAll(Migrations.all().get(3).statements()));
        assertEquals(Migrator.RECORD_VERSION, db.executed.get(db.executed.size() - 1));
        assertEquals(List.of("commit", "commit", "commit", "commit", "commit"), db.events,
            "the read's commit, then one commit per migration; no rollback");
        assertTrue(db.autoCommit, "auto-commit is restored");
    }

    @Test
    void everyAppliedMigrationRecordsTheModuleVersionItWasGiven() throws Exception {
        // The audit column mapstudio_schema_version.module_version holds the build's version
        // (the 0.2.0 rehearsal found "dev" there: no manifest carried one, fixed before the tag).
        FakeJdbc db = new FakeJdbc();
        Migrator.Result result = new Migrator(Migrations.all(), "0.2.0").migrate(db.connection());
        assertEquals(List.of(1, 2, 3, 4), result.applied());
        assertEquals(List.of("0.2.0", "0.2.0", "0.2.0", "0.2.0"), db.boundStrings,
            "one module_version per migration, the version the migrator was given, never a placeholder");
    }

    @Test
    void anUpgradeRecordsTheModuleVersionOnlyForWhatItApplied() throws Exception {
        FakeJdbc db = new FakeJdbc();
        db.version = 2;
        new Migrator(Migrations.all(), "0.4.0-SNAPSHOT").migrate(db.connection());
        assertEquals(List.of("0.4.0-SNAPSHOT", "0.4.0-SNAPSHOT"), db.boundStrings, "the rows of migrations 1 and 2 are not written again");
    }

    @Test
    void aMigratedDatabaseIsOnlyRead() throws Exception {
        FakeJdbc db = new FakeJdbc();
        db.version = 4;
        Migrator.Result result = migrator().migrate(db.connection());
        assertEquals(List.of(), result.applied());
        assertEquals(4, result.version());
        assertEquals(List.of(Migrator.VERSION_TABLE_EXISTS, Migrator.READ_VERSION), db.executed,
            "no lock and no CREATE on a migrated database");
    }

    @Test
    void aRoleWithoutCreateComesUpOnAMigratedDatabase() throws Exception {
        // The reviewer's case: a SELECT/INSERT/UPDATE role on PostgreSQL 16 gets 42501 on any CREATE.
        FakeJdbc db = new FakeJdbc();
        db.version = 4;
        db.failOn = "CREATE";
        assertEquals(4, migrator().migrate(db.connection()).version());
    }

    @Test
    void schemaOneIsUpgradedToTwoThenThreeThenFour() throws Exception {
        // Epic 2 story 14: a store left at schema 1 gets migrations 2 to 4 only, each in one transaction.
        FakeJdbc db = new FakeJdbc();
        db.version = 1;
        Migrator.Result result = migrator().migrate(db.connection());
        assertEquals(List.of(2, 3, 4), result.applied());
        assertEquals(4, result.version());
        assertTrue(db.executed.containsAll(Migrations.all().get(1).statements()));
        assertTrue(db.executed.stream().noneMatch(Migrations.all().get(0).statements()::contains),
            "migration 1 is not run again");
        assertEquals(List.of("commit", "commit", "commit", "commit", "commit"), db.events,
            "the first read, migration 1 found applied under the lock, then migrations 2, 3 and 4");
    }

    @Test
    void schemaTwoIsUpgradedToThreeAndFourAlone() throws Exception {
        // Epic-editing entry 11a (H7): a store at schema 2 with edit rows gets migrations 3 and 4 only; its rows are
        // untouched.
        FakeJdbc db = new FakeJdbc();
        db.version = 2;
        Migrator.Result result = migrator().migrate(db.connection());
        assertEquals(List.of(3, 4), result.applied());
        assertEquals(4, result.version());
        assertTrue(db.executed.containsAll(Migrations.all().get(2).statements()));
        assertTrue(db.executed.stream().noneMatch(s -> s.startsWith("UPDATE mapstudio_edit")
            || s.startsWith("DELETE FROM mapstudio_edit")), "existing edit rows are untouched");
        assertTrue(db.executed.stream().noneMatch(Migrations.all().get(1).statements()::contains),
            "migration 2 is not run again");
    }

    @Test
    void schemaThreeIsUpgradedToFourAlone() throws Exception {
        // Epic-editing entry 19b (S14): a store at schema 3 with edit rows gets migration 4 only; its rows are kept.
        FakeJdbc db = new FakeJdbc();
        db.version = 3;
        Migrator.Result result = migrator().migrate(db.connection());
        assertEquals(List.of(4), result.applied());
        assertEquals(4, result.version());
        assertTrue(db.executed.containsAll(Migrations.all().get(3).statements()));
        assertTrue(db.executed.stream().noneMatch(s -> s.startsWith("UPDATE mapstudio_")
            || s.startsWith("DELETE FROM mapstudio_")), "existing rows are untouched");
        assertTrue(db.executed.stream().noneMatch(Migrations.all().get(2).statements()::contains),
            "migration 3 is not run again");
    }

    @Test
    void aFailedMigrationFourLeavesVersionThree() {
        // A role that does not own the tables: the failure line of migrations 2 and 3, naming migration 4.
        FakeJdbc db = new FakeJdbc();
        db.version = 3;
        db.failOn = "ALTER TABLE mapstudio_project ADD COLUMN settings";
        db.failMessage = "must be owner of table mapstudio_project";
        Migrator.MigrationFailure ex = assertThrows(Migrator.MigrationFailure.class,
            () -> migrator().migrate(db.connection()));
        assertEquals(4, ex.migration());
        assertEquals("42501", ex.getSQLState());
        assertEquals("rollback", db.events.get(db.events.size() - 1), "migration 4 rolled back whole");
        assertEquals(List.of(), db.boundStrings, "no version row is recorded for 4, so the store stays at 3");
    }

    @Test
    void aFailedMigrationThreeLeavesVersionTwo() {
        FakeJdbc db = new FakeJdbc();
        db.version = 2;
        db.failOn = "ALTER TABLE mapstudio_edit ADD COLUMN after";
        db.failMessage = "must be owner of table mapstudio_edit";
        Migrator.MigrationFailure ex = assertThrows(Migrator.MigrationFailure.class,
            () -> migrator().migrate(db.connection()));
        assertEquals(3, ex.migration());
        assertEquals(List.of("commit", "commit", "commit", "rollback"), db.events,
            "the first read, migrations 1 and 2 found applied, then migration 3 rolled back whole");
        assertEquals(List.of(), db.boundStrings, "no version row is recorded for 3, so the store stays at 2");
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
        db.version = 5;
        Migrator.SchemaNewerException ex = assertThrows(Migrator.SchemaNewerException.class,
            () -> migrator().migrate(db.connection()));
        assertEquals(5, ex.found());
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
