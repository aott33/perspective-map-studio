package com.aoindustrial.perspective.mapstudio.gateway.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.SQLException;

import org.junit.jupiter.api.Test;

/** The AD-21 line and the reasons a person sees (epic 2 story 5). */
class FailureLineTest {

    static Migrator.MigrationFailure failure(String statement, int migration, int ordinal, int count, String state,
                                             String message) {
        return new Migrator.MigrationFailure(statement, migration, ordinal, count, new SQLException(message, state));
    }

    @Test
    void aMissingCreateRightNamesConnectionMigrationStatementSqlStateAndRight() {
        String line = FailureLine.line("MapStudioCheck", failure(Migrator.CREATE_VERSION_TABLE, 1, 1, 8, "42501",
            "ERROR: permission denied for schema public\n  Position: 28"));
        assertEquals("Map Studio cannot prepare its map store on database connection MapStudioCheck: migration 1, "
            + "statement 1 of 8 (CREATE TABLE IF NOT EXISTS mapstudio_schema_version ...) failed with SQLState 42501, "
            + "the database role lacks CREATE on schema public: ERROR: permission denied for schema public   Position: 28",
            line);
        assertFalse(line.contains("\n"), "one line");
    }

    @Test
    void anotherSqlStateNamesNoRight() {
        String line = FailureLine.line("C", failure("CREATE TABLE mapstudio_kind_setup (\n  project text\n)", 1, 4, 8,
            "42P07", "ERROR: relation \"mapstudio_kind_setup\" already exists"));
        assertTrue(line.contains("migration 1, statement 4 of 8 (CREATE TABLE mapstudio_kind_setup ...)"), line);
        assertTrue(line.contains("SQLState 42P07: ERROR: relation"), line);
        assertFalse(line.contains("lacks"), line);
    }

    @Test
    void theLockTheReadAndARuntimeFailureAreNamed() {
        assertTrue(FailureLine.line("C", failure(Migrator.LOCK, 1, 0, 8, "57014", "canceled"))
            .contains("migration 1, before its statements (SELECT pg_advisory_xact_lock"));
        assertTrue(FailureLine.line("C", failure(Migrator.VERSION_TABLE_EXISTS, 0, 0, 0, "08006", "gone"))
            .contains("reading the schema version"));
        Migrator.MigrationFailure runtime = new Migrator.MigrationFailure("CREATE INDEX i ON t (x)", 1, 7, 8,
            new IllegalStateException("driver bug"));
        assertTrue(runtime.runtime());
        String line = FailureLine.line("C", runtime);
        assertTrue(line.contains("failed with SQLState none: IllegalStateException: driver bug"), line);
    }

    @Test
    void theRightFollowsTheVerb() {
        assertEquals("CREATE on the schema", FailureLine.right("CREATE INDEX i ON t (x)", "42501", "denied"));
        assertEquals("ownership of the table", FailureLine.right("ALTER TABLE t ADD c int", "42501", ""));
        assertNull(FailureLine.right("INSERT INTO t VALUES (1)", "42501", ""));
        assertNull(FailureLine.right("CREATE TABLE t (x int)", "42P07", ""));
    }

    @Test
    void reasonsInPlainWords() {
        assertEquals("The map store is unavailable: the database role of connection C lacks the right to create "
            + "Map Studio's tables. Ask an administrator (see the Gateway log).", FailureLine.userReason("C", "42501"));
        assertTrue(FailureLine.userReason("C", null).contains("SQLState none"));
        assertEquals("The map store was upgraded by a newer Map Studio (schema 3, this module knows 1); saving is off "
            + "until the module is upgraded.", FailureLine.newerReason(3, 1));
        String warn = FailureLine.newerLine("C", 999, 1);
        assertTrue(warn.contains("connection C") && warn.contains("999") && warn.contains("(1)"), warn);
    }
}
