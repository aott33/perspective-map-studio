package com.aoindustrial.perspective.mapstudio.gateway.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * {@code Tx.lastEdits} on the JDBC store (epic 4 entry 7a): one prepared statement per load, the project bound, the newest
 * edit record of each map item read back by item id with its time as ISO 8601 UTC to the second.
 */
class LastEditsTest {

    final List<String> prepared = new ArrayList<>();
    final List<String> bound = new ArrayList<>();
    final List<Object[]> rows = new ArrayList<>();

    @Test
    void oneQueryGivesEachItemsNewestEditByItemId() throws Exception {
        rows.add(new Object[] {"a", "sam", OffsetDateTime.of(2026, 11, 8, 4, 42, 7, 900_000_000, ZoneOffset.ofHours(-6))});
        rows.add(new Object[] {"b", "alex", OffsetDateTime.of(2026, 11, 7, 9, 15, 0, 0, ZoneOffset.UTC)});
        JdbcMapStore store = new JdbcMapStore(source());
        Map<String, MapStore.LastEdit> edits = store.inTransaction("MapStudio", tx -> tx.lastEdits("mapstudio-dev"));
        assertEquals(1, prepared.size(), "one query, never one per item");
        assertEquals(JdbcMapStore.LAST_EDITS_SQL, prepared.get(0));
        assertTrue(prepared.get(0).contains("DISTINCT ON (entity_id)") && prepared.get(0).contains("entity = 'item'")
            && prepared.get(0).contains("edit_id DESC"), prepared.get(0));
        assertEquals(List.of("mapstudio-dev"), bound);
        assertEquals(new MapStore.LastEdit("sam", "2026-11-08T10:42:07Z"), edits.get("a"), "UTC, to the second");
        assertEquals(new MapStore.LastEdit("alex", "2026-11-07T09:15:00Z"), edits.get("b"));
        assertEquals(2, edits.size());
    }

    @Test
    void noEditRecordsIsAnEmptyMap() throws Exception {
        Map<String, MapStore.LastEdit> edits = new JdbcMapStore(source()).inTransaction("MapStudio",
            tx -> tx.lastEdits("mapstudio-dev"));
        assertTrue(edits.isEmpty());
    }

    private ConnectionSource source() {
        return new ConnectionSource() {
            @Override
            public boolean exists(String name) {
                return true;
            }

            @Override
            public Connection open(String name) {
                return connection();
            }
        };
    }

    private Connection connection() {
        boolean[] autoCommit = {true};
        return (Connection) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[] {Connection.class},
            (proxy, method, args) -> switch (method.getName()) {
                case "getAutoCommit" -> autoCommit[0];
                case "setAutoCommit" -> {
                    autoCommit[0] = (Boolean) args[0];
                    yield null;
                }
                case "commit", "rollback", "close" -> null;
                case "prepareStatement" -> {
                    prepared.add((String) args[0]);
                    yield statement();
                }
                default -> throw new UnsupportedOperationException(method.getName());
            });
    }

    private PreparedStatement statement() {
        return (PreparedStatement) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[] {PreparedStatement.class},
            (proxy, method, args) -> switch (method.getName()) {
                case "setString" -> {
                    bound.add((String) args[1]);
                    yield null;
                }
                case "executeQuery" -> result();
                case "close" -> null;
                default -> throw new UnsupportedOperationException(method.getName());
            });
    }

    private ResultSet result() {
        int[] at = {-1};
        return (ResultSet) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[] {ResultSet.class},
            (proxy, method, args) -> switch (method.getName()) {
                case "next" -> ++at[0] < rows.size();
                case "getString" -> rows.get(at[0])[(Integer) args[0] - 1];
                case "getObject" -> rows.get(at[0])[(Integer) args[0] - 1];
                case "close" -> null;
                default -> throw new UnsupportedOperationException(method.getName());
            });
    }
}
