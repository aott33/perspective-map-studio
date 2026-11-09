package com.aoindustrial.perspective.mapstudio.gateway.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonParser;

/**
 * {@code Tx.history} and {@code Tx.insertEdit} on the JDBC store (epic-editing entry 11a): the page heads read one past
 * the limit, the rows of the batches taken read in one query and grouped by seq, old rows with null values, and the
 * values, name and kind bound on insert.
 */
class HistoryJdbcTest {

    static final String BATCH_A = "0b7e5f0e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
    static final String BATCH_B = "1c7e5f0e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";

    final List<String> prepared = new ArrayList<>();
    /** Per statement, in order: the parameters bound, by index. */
    final List<Map<Integer, Object>> bound = new ArrayList<>();
    /** The rows each query answers, in order of the queries. */
    final List<List<Object[]>> answers = new ArrayList<>();

    @Test
    void aPageReadsOneHeadPastTheLimitThenTheRowsOfTheBatchesItTakes() throws Exception {
        answers.add(List.of(new Object[] {9L, 1L}, new Object[] {7L, 2L}, new Object[] {4L, 1L}));
        OffsetDateTime at = OffsetDateTime.of(2026, 11, 9, 4, 0, 1, 500_000_000, ZoneOffset.ofHours(-6));
        answers.add(List.of(
            new Object[] {9L, BATCH_B, "sam", at, "session", "update", "item", "p31", 4L, "P31", "pad",
                "{\"geometry\":{\"type\":\"Point\",\"coordinates\":[1,2]}}",
                "{\"geometry\":{\"type\":\"Point\",\"coordinates\":[1,3]}}"},
            new Object[] {7L, BATCH_A, "alex", at, "script", "delete", "item", "t1", 2L, "PT-1", "tap",
                "{\"id\":\"t1\"}", null},
            new Object[] {7L, BATCH_A, "alex", at, "script", "delete", "item", "l1", 2L, null, null, null, null}));
        HistoryPage page = new JdbcMapStore(source()).inTransaction("MapStudio", tx -> tx.history("dev", 10L, 2));
        assertEquals(List.of(JdbcMapStore.HISTORY_HEADS_SQL, JdbcMapStore.HISTORY_ROWS_SQL), prepared);
        assertEquals(Map.of(1, "dev", 2, 10L, 3, 3), bound.get(0), "one head past the limit");
        assertEquals(Map.of(1, "dev", 2, 9L, 3, 7L), bound.get(1), "the seqs of the two batches taken");
        assertTrue(page.more());
        assertEquals(2, page.entries().size());
        HistoryPage.Entry b = page.entries().get(0);
        assertEquals(9L, b.seq());
        assertEquals("sam", b.actor());
        assertEquals("2026-11-09T10:00:01Z", b.at());
        assertEquals("session", b.source());
        assertEquals(BATCH_B, b.batchId());
        assertEquals(JsonParser.parseString("{\"geometry\":{\"type\":\"Point\",\"coordinates\":[1,3]}}"),
            b.ops().get(0).after());
        HistoryPage.Entry a = page.entries().get(1);
        assertEquals(2, a.ops().size(), "one entry per batch");
        assertEquals("PT-1", a.ops().get(0).name());
        assertNull(a.ops().get(0).after());
        assertNull(a.ops().get(1).before(), "an old row");
        assertNull(a.ops().get(1).name());
        assertEquals(2, a.ops().get(1).version());
        assertTrue(JdbcMapStore.HISTORY_HEADS_SQL.contains("ORDER BY seq DESC"));
        assertTrue(JdbcMapStore.HISTORY_ROWS_SQL.contains("COALESCE(e.name, i.name)"), "old rows read the stored name");
    }

    @Test
    void theFirstPageHasNoBeforeAndAnEmptyRecordReadsOnlyTheHeads() throws Exception {
        answers.add(List.of());
        HistoryPage page = new JdbcMapStore(source()).inTransaction("MapStudio", tx -> tx.history("dev", null, 50));
        assertEquals(List.of(JdbcMapStore.HISTORY_HEADS_SQL), prepared);
        assertEquals(Long.MAX_VALUE, bound.get(0).get(2));
        assertEquals(51, bound.get(0).get(3));
        assertTrue(page.entries().isEmpty());
        assertFalse(page.more());
    }

    @Test
    void anEditRowIsInsertedWithItsValuesNameAndKind() throws Exception {
        new JdbcMapStore(source()).inTransaction("MapStudio", tx -> {
            tx.insertEdit(new MapStore.EditRow("dev", BATCH_A, 3, "item", "p14", "update", 2, "alex", "session",
                JsonParser.parseString("{\"name\":\"a\"}").getAsJsonObject(),
                JsonParser.parseString("{\"name\":\"b\"}").getAsJsonObject(), "b", "pad"));
            tx.insertEdit(new MapStore.EditRow("dev", BATCH_A, 3, "item", "p15", "create", 1, "alex", "session"));
            return null;
        });
        assertTrue(prepared.get(0).contains("before, after, name, kind"), prepared.get(0));
        assertEquals("{\"name\":\"a\"}", bound.get(0).get(10));
        assertEquals("{\"name\":\"b\"}", bound.get(0).get(11));
        assertEquals("b", bound.get(0).get(12));
        assertEquals("pad", bound.get(0).get(13));
        for (int i = 10; i <= 13; i++) {
            assertEquals("NULL", bound.get(1).get(i), "no values: SQL null at " + i);
        }
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
                    Map<Integer, Object> params = new HashMap<>();
                    bound.add(params);
                    yield statement(params);
                }
                default -> throw new UnsupportedOperationException(method.getName());
            });
    }

    private PreparedStatement statement(Map<Integer, Object> params) {
        return (PreparedStatement) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[] {PreparedStatement.class},
            (proxy, method, args) -> switch (method.getName()) {
                case "setString", "setLong", "setInt" -> {
                    params.put((Integer) args[0], args[1]);
                    yield null;
                }
                case "setNull" -> {
                    params.put((Integer) args[0], "NULL");
                    yield null;
                }
                case "executeUpdate" -> 1;
                case "executeQuery" -> result(answers.remove(0));
                case "close" -> null;
                default -> throw new UnsupportedOperationException(method.getName());
            });
    }

    private static ResultSet result(List<Object[]> rows) {
        int[] at = {-1};
        return (ResultSet) Proxy.newProxyInstance(HistoryJdbcTest.class.getClassLoader(), new Class<?>[] {ResultSet.class},
            (proxy, method, args) -> switch (method.getName()) {
                case "next" -> ++at[0] < rows.size();
                case "getString" -> rows.get(at[0])[(Integer) args[0] - 1];
                case "getObject" -> rows.get(at[0])[(Integer) args[0] - 1];
                case "getLong" -> ((Number) rows.get(at[0])[(Integer) args[0] - 1]).longValue();
                case "getInt" -> ((Number) rows.get(at[0])[(Integer) args[0] - 1]).intValue();
                case "close" -> null;
                default -> throw new UnsupportedOperationException(method.getName());
            });
    }
}
