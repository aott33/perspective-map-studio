package com.aoindustrial.perspective.mapstudio.gateway.spike;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/** The PostgreSQL rows of the I/O matrix: the error line and the CHECK line shapes. */
class PostgresCheckTest {

    @Test
    void rightsErrorNamesTheConnectionTheStatementAndTheSqlState() {
        String line = PostgresCheck.rightsMessage("MapStudioNoRights", "CREATE TABLE", "42501",
            "ERROR: permission denied for schema public\n");
        assertEquals("Map Studio cannot create its tables on connection MapStudioNoRights: "
            + "the database role lacks the right to CREATE TABLE (SQLState 42501): "
            + "ERROR: permission denied for schema public", line);
    }

    @Test
    void otherSqlStatesAreReportedWithoutTheRightsWording() {
        String line = PostgresCheck.rightsMessage("MapStudio", "CREATE TABLE", "08001", null);
        assertEquals("Map Studio cannot create its tables on connection MapStudio: "
            + "CREATE TABLE failed (SQLState 08001): ", line);
    }

    @Test
    void checkLinesAreOneLineEach() {
        CheckResult pass = CheckResult.pass("postgres", "connection MapStudio: created\nmapstudio_schema_version");
        assertEquals("CHECK postgres PASS connection MapStudio: created | mapstudio_schema_version", pass.line());
        CheckResult fail = CheckResult.fail("postgres-rights", "SQLState 42P01");
        assertTrue(fail.line().startsWith("CHECK postgres-rights FAIL "));
        assertFalse(fail.passed());
    }

    @Test
    void theTableIsAMapStudioTableAndTheWritesAreIdempotent() {
        assertTrue(PostgresCheck.TABLE.startsWith("mapstudio_"));
        assertTrue(PostgresCheck.CREATE.contains("IF NOT EXISTS"));
        assertTrue(PostgresCheck.INSERT.contains("WHERE NOT EXISTS"));
    }
}
