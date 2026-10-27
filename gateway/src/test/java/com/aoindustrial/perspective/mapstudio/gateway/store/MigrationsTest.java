package com.aoindustrial.perspective.mapstudio.gateway.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;

class MigrationsTest {

    @Test
    void migrationOneCreatesTheWholeFirstSchema() {
        List<Migrations.Migration> all = Migrations.all();
        assertEquals(2, all.size());
        assertEquals(2, Migrations.latest());
        Migrations.Migration first = all.get(0);
        assertEquals(1, first.version());
        String joined = String.join("\n", first.statements());
        for (String table : List.of("mapstudio_project", "mapstudio_item", "mapstudio_kind_setup", "mapstudio_edit",
                "mapstudio_batch")) {
            assertTrue(joined.contains("CREATE TABLE " + table + " ("), table);
        }
        assertTrue(joined.contains("CREATE INDEX mapstudio_edit_project_seq"));
        assertEquals(6, first.statements().size(), first.statements().stream().collect(Collectors.joining("\n---\n")));
        for (String statement : first.statements()) {
            assertFalse(statement.endsWith(";"), statement);
            assertFalse(statement.contains("--"), "comments are dropped: " + statement);
        }
    }

    @Test
    void migrationTwoAddsTheAttachmentColumnAndItsIndexes() {
        Migrations.Migration second = Migrations.all().get(1);
        assertEquals(2, second.version());
        assertEquals("0002_instrument_attachment.sql", second.name());
        assertEquals(List.of(
            "ALTER TABLE mapstudio_item ADD COLUMN attachment jsonb",
            "CREATE INDEX mapstudio_item_attached_line ON mapstudio_item (project, (attachment->>'lineId'))\n"
                + "    WHERE attachment IS NOT NULL AND NOT deleted",
            "CREATE INDEX mapstudio_edit_project_entity ON mapstudio_edit (project, entity, entity_id)"),
            second.statements());
    }

    @Test
    void statementsSplitOnSemicolonsAtLineEnds() {
        List<String> s = Migrations.statements("-- comment\nCREATE TABLE a (\n  x int\n);\n\nCREATE INDEX i ON a (x);\n");
        assertEquals(List.of("CREATE TABLE a (\n  x int\n)", "CREATE INDEX i ON a (x)"), s);
        assertThrows(IllegalStateException.class, () -> Migrations.statements("CREATE TABLE a (x int)"));
    }
}
