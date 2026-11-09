package com.aoindustrial.perspective.mapstudio.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.EditBatch;
import com.aoindustrial.perspective.mapstudio.common.contract.LineMeasure;
import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.TestKinds;
import com.aoindustrial.perspective.mapstudio.gateway.load.MapLoader;
import com.aoindustrial.perspective.mapstudio.gateway.setup.SetupRegistry;
import com.aoindustrial.perspective.mapstudio.gateway.store.HistoryPage;
import com.aoindustrial.perspective.mapstudio.gateway.store.MapStore;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreGate;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreState;
import com.aoindustrial.perspective.mapstudio.gateway.write.Actor;
import com.aoindustrial.perspective.mapstudio.gateway.write.FakeMapStore;
import com.aoindustrial.perspective.mapstudio.gateway.write.NoChangeHook;
import com.aoindustrial.perspective.mapstudio.gateway.write.WriteService;

/**
 * {@code edits.history} (epic-editing entry 11a): every row of the plan's I/O matrix through the write service, the
 * edit record it leaves and the delegate's store reply, on the in-memory store.
 */
class EditHistoryTest {

    static final String P = "mapstudio-dev";
    static final List<String> EDITOR = List.of("MapEditor");
    static final List<String> OPERATOR = List.of("MapOperator");
    static final List<double[]> SWD = List.of(new double[] {-103.52, 31.92}, new double[] {-103.505, 31.9205},
        new double[] {-103.490423, 31.926});

    FakeMapStore store;
    MapLoader loader;
    WriteService writes;

    @BeforeEach
    void setUp() throws Exception {
        store = new FakeMapStore();
        SetupRegistry setups = new SetupRegistry(s -> { });
        setups.put(P, Setup.parse("{\"schemaVersion\":1,\"connection\":\"MapStudio\","
            + "\"roles\":{\"full\":[\"MapEditor\"],\"phone\":[\"MapOperator\"]}}"));
        StoreGate gate = new StoreGate(setups, c -> StoreState.ready());
        loader = new MapLoader(gate, store, TestKinds::snapshot);
        writes = new WriteService(gate, store, new NoChangeHook(), TestKinds::snapshot);
    }

    // --- builders ----------------------------------------------------------------

    static String uuid() {
        return UUID.randomUUID().toString();
    }

    static String point(double lng, double lat) {
        return "{\"type\":\"Point\",\"coordinates\":[" + lng + "," + lat + "]}";
    }

    static String createPad(String id, String name, double lng, double lat) {
        return "{\"op\":\"create\",\"entity\":\"item\",\"id\":\"" + id + "\",\"baseVersion\":0,\"data\":{\"kind\":\"pad\","
            + "\"name\":\"" + name + "\",\"geometry\":" + point(lng, lat) + ",\"properties\":{\"status\":\"producing\"}}}";
    }

    static String update(String id, int baseVersion, String data) {
        return "{\"op\":\"update\",\"entity\":\"item\",\"id\":\"" + id + "\",\"baseVersion\":" + baseVersion
            + ",\"data\":" + data + "}";
    }

    static String delete(String id, int baseVersion) {
        return "{\"op\":\"delete\",\"entity\":\"item\",\"id\":\"" + id + "\",\"baseVersion\":" + baseVersion + "}";
    }

    static String lineGeometry() {
        List<String> c = new ArrayList<>();
        SWD.forEach(p -> c.add("[" + p[0] + "," + p[1] + "]"));
        return "{\"type\":\"LineString\",\"coordinates\":[" + String.join(",", c) + "]}";
    }

    static String createLine(String id) {
        return "{\"op\":\"create\",\"entity\":\"item\",\"id\":\"" + id + "\",\"baseVersion\":0,"
            + "\"data\":{\"kind\":\"line\",\"name\":\"L-SWD\",\"geometry\":" + lineGeometry() + "}}";
    }

    static String createTap(String id, String name, String lineId, double distanceM) {
        double[] p = LineMeasure.pointAt(SWD, distanceM);
        return "{\"op\":\"create\",\"entity\":\"item\",\"id\":\"" + id + "\",\"baseVersion\":0,"
            + "\"data\":{\"kind\":\"tap\",\"name\":\"" + name + "\",\"geometry\":"
            + String.format(java.util.Locale.ROOT, "{\"type\":\"Point\",\"coordinates\":[%.6f,%.6f]}", p[0], p[1])
            + ",\"attachment\":{\"lineId\":\"" + lineId + "\",\"distanceM\":" + distanceM + "}}}";
    }

    static JsonObject batch(String... ops) {
        return JsonParser.parseString("{\"batchId\":\"" + uuid() + "\",\"ops\":[" + String.join(",", ops) + "]}")
            .getAsJsonObject();
    }

    void save(String actor, String... ops) {
        writes.apply(P, batch(ops), Actor.session(actor), Messages.LEVEL_FULL);
    }

    JsonObject history(List<String> roles, String body) {
        return MapStudioDelegate.storeReply(loader, writes, new MapStudioDelegate.SessionView(P, "someone", roles),
            Messages.EDITS_HISTORY, "h-1", JsonParser.parseString(body).getAsJsonObject());
    }

    JsonObject page(String body) {
        JsonObject reply = history(EDITOR, body);
        assertEquals(Messages.EDITS_HISTORY_REPLY, reply.get("type").getAsString(), reply.toString());
        assertEquals("h-1", reply.get("id").getAsString());
        return reply.getAsJsonObject("body");
    }

    static JsonArray entries(JsonObject page) {
        return page.getAsJsonArray("entries");
    }

    static JsonObject entry(JsonObject page, int i) {
        return entries(page).get(i).getAsJsonObject();
    }

    static JsonObject op(JsonObject entry, int i) {
        return entry.getAsJsonArray("ops").get(i).getAsJsonObject();
    }

    static JsonElement json(String s) {
        return JsonParser.parseString(s);
    }

    // --- H1 to H8 ------------------------------------------------------------------

    @Test
    void h1AnUpdateKeepsOnlyTheFieldsItChanged() {
        String p14 = uuid();
        save("alex", createPad(p14, "P14", -103.5, 31.9));
        save("alex", update(p14, 1, "{\"geometry\":" + point(-103.51, 31.91) + "}"));
        JsonObject move = entry(page("{}"), 0);
        assertEquals(1, move.getAsJsonArray("ops").size());
        JsonObject o = op(move, 0);
        assertEquals("update", o.get("op").getAsString());
        assertEquals("item", o.get("entity").getAsString());
        assertEquals(p14, o.get("id").getAsString());
        assertEquals("P14", o.get("name").getAsString());
        assertEquals("pad", o.get("kind").getAsString());
        assertEquals(2, o.get("version").getAsInt());
        assertEquals(json("{\"geometry\":" + point(-103.5, 31.9) + "}"), o.get("before"));
        assertEquals(json("{\"geometry\":" + point(-103.51, 31.91) + "}"), o.get("after"));
    }

    @Test
    void h1APropertiesChangeKeepsTheWholePropertiesValue() {
        String p14 = uuid();
        save("alex", createPad(p14, "P14", -103.5, 31.9));
        save("alex", update(p14, 1, "{\"name\":\"P-14\",\"properties\":{\"status\":\"shut in\",\"wells\":3}}"));
        JsonObject o = op(entry(page("{}"), 0), 0);
        assertEquals(json("{\"name\":\"P14\",\"properties\":{\"status\":\"producing\"}}"), o.get("before"));
        assertEquals(json("{\"name\":\"P-14\",\"properties\":{\"status\":\"shut in\",\"wells\":3}}"), o.get("after"));
        assertEquals("P-14", o.get("name").getAsString(), "the name as written");
    }

    @Test
    void h2ACreateKeepsAfterAndALineDeletedWithItsInstrumentsIsOneEntryOfThreeDeletes() {
        String pad = uuid();
        save("alex", createPad(pad, "P31", -103.5, 31.9));
        JsonObject created = op(entry(page("{}"), 0), 0);
        assertTrue(created.get("before").isJsonNull());
        MapItemRecord stored = store.items(P).get(0);
        assertEquals(stored.toJson(), created.get("after"), "the written record, whole");

        String line = uuid();
        String pt1 = uuid();
        String pt2 = uuid();
        save("alex", createLine(line), createTap(pt1, "PT-1", line, 1143), createTap(pt2, "PT-2", line, 2841));
        MapItemRecord lineBefore = store.committed.items.get(P).get(line);
        save("alex", delete(pt1, 1), delete(pt2, 1), delete(line, 1));
        JsonObject page = page("{}");
        assertEquals(3, entries(page).size());
        JsonObject deleted = entry(page, 0);
        assertEquals(3, deleted.getAsJsonArray("ops").size(), "one entry for the batch");
        for (JsonElement e : deleted.getAsJsonArray("ops")) {
            JsonObject o = e.getAsJsonObject();
            assertEquals("delete", o.get("op").getAsString());
            assertTrue(o.get("after").isJsonNull());
            assertTrue(o.get("before").isJsonObject());
            assertFalse(o.getAsJsonObject("before").get("deleted").getAsBoolean(), "the stored record, live");
        }
        JsonObject lineOp = op(deleted, 2);
        assertEquals(lineBefore.toJson(), lineOp.get("before"));
        assertEquals("L-SWD", lineOp.get("name").getAsString());
        assertEquals("line", lineOp.get("kind").getAsString());
        assertEquals("PT-1", op(deleted, 0).get("name").getAsString());
        assertEquals("tap", op(deleted, 0).get("kind").getAsString());
    }

    @Test
    void h3NewestFirstEachWithItsActorTimeAndSource() {
        String p14 = uuid();
        String p31 = uuid();
        save("setup", createPad(p14, "P14", -103.5, 31.9), createPad(p31, "P31", -103.4, 31.8));
        store.now = "2026-11-09T10:00:00Z";
        save("alex", update(p14, 1, "{\"geometry\":" + point(-103.51, 31.91) + "}"));
        store.now = "2026-11-09T10:00:05Z";
        writes.apply(P, batch(update(p31, 1, "{\"geometry\":" + point(-103.41, 31.81) + "}")), Actor.script("sam"),
            Messages.LEVEL_FULL);
        JsonObject page = page("{}");
        JsonObject b = entry(page, 0);
        JsonObject a = entry(page, 1);
        assertEquals("sam", b.get("actor").getAsString());
        assertEquals("script", b.get("source").getAsString());
        assertEquals("2026-11-09T10:00:05Z", b.get("at").getAsString());
        assertEquals(3, b.get("seq").getAsLong());
        assertEquals(p31, op(b, 0).get("id").getAsString());
        assertEquals("alex", a.get("actor").getAsString());
        assertEquals("session", a.get("source").getAsString());
        assertEquals("2026-11-09T10:00:00Z", a.get("at").getAsString());
        assertEquals(p14, op(a, 0).get("id").getAsString());
        assertTrue(b.has("batchId"));
        assertFalse(page.get("more").getAsBoolean());
    }

    @Test
    void h4PagesOfFiftyThenTheRestBeforeTheLastSeq() {
        String p = uuid();
        save("alex", createPad(p, "P1", -103.5, 31.9));
        for (int v = 1; v < 60; v++) {
            save("alex", update(p, v, "{\"name\":\"P" + (v + 1) + "\"}"));
        }
        JsonObject first = page("{\"limit\":50}");
        assertEquals(50, entries(first).size());
        assertTrue(first.get("more").getAsBoolean());
        assertEquals(60, entry(first, 0).get("seq").getAsLong());
        long last = entry(first, 49).get("seq").getAsLong();
        assertEquals(11, last);
        JsonObject second = page("{\"before\":" + last + "}");
        assertEquals(10, entries(second).size());
        assertFalse(second.get("more").getAsBoolean());
        assertEquals(10, entry(second, 0).get("seq").getAsLong());
        assertEquals(1, entry(second, 9).get("seq").getAsLong());
        assertEquals(50, entries(page("{}")).size(), "limit defaults to 50");
        JsonObject small = page("{\"limit\":1}");
        assertEquals(1, entries(small).size());
        assertTrue(small.get("more").getAsBoolean());
    }

    @Test
    void h4ALimitOutsideOneToFiftyOrABeforeThatIsNotANumberIsInvalid() {
        for (String body : List.of("{\"limit\":0}", "{\"limit\":51}", "{\"limit\":2.5}", "{\"limit\":\"10\"}",
                "{\"before\":\"x\"}", "{\"before\":0}", "{\"before\":1.5}", "{\"before\":{}}")) {
            JsonObject reply = history(EDITOR, body);
            assertEquals(Messages.ERROR, reply.get("type").getAsString(), body);
            assertEquals(Messages.CODE_INVALID, reply.getAsJsonObject("body").get("code").getAsString(), body);
        }
        assertEquals(0, store.historyQueries, "nothing is read for a malformed request");
    }

    @Test
    void h5APageStopsBeforeABatchThatWouldTakeItPastAThousandOps() {
        List<String> ops = new ArrayList<>();
        for (int i = 0; i < EditBatch.MAX_OPS; i++) {
            ops.add(createPad(uuid(), "B" + i, -103.5, 31.9));
        }
        save("importer", ops.toArray(String[]::new));
        String p = uuid();
        save("alex", createPad(p, "P0", -103.5, 31.9));
        for (int v = 1; v < 40; v++) {
            save("alex", update(p, v, "{\"name\":\"P" + v + "\"}"));
        }
        JsonObject first = page("{}");
        assertEquals(40, entries(first).size(), "the 40 small batches, then the page closes");
        assertTrue(first.get("more").getAsBoolean());
        long last = entry(first, 39).get("seq").getAsLong();
        JsonObject second = page("{\"before\":" + last + "}");
        assertEquals(1, entries(second).size(), "the big batch, whole and alone");
        assertEquals(EditBatch.MAX_OPS, entry(second, 0).getAsJsonArray("ops").size());
        assertEquals("importer", entry(second, 0).get("actor").getAsString());
        assertFalse(second.get("more").getAsBoolean());
    }

    @Test
    void h5ABigBatchAtTheTopIsAPageOfItsOwn() {
        String p = uuid();
        save("alex", createPad(p, "P0", -103.5, 31.9));
        List<String> ops = new ArrayList<>();
        for (int i = 0; i < EditBatch.MAX_OPS; i++) {
            ops.add(createPad(uuid(), "B" + i, -103.5, 31.9));
        }
        save("importer", ops.toArray(String[]::new));
        JsonObject first = page("{}");
        assertEquals(1, entries(first).size());
        assertTrue(first.get("more").getAsBoolean());
    }

    @Test
    void h6AViewerIsRefusedRoleAndNothingIsRead() {
        save("alex", createPad(uuid(), "P14", -103.5, 31.9));
        JsonObject reply = history(List.of(), "{}");
        assertEquals(Messages.ERROR, reply.get("type").getAsString());
        assertEquals(Messages.CODE_ROLE, reply.getAsJsonObject("body").get("code").getAsString());
        assertFalse(reply.toString().contains("P14"), "no names");
        assertFalse(reply.toString().contains("alex"), "no editors");
        assertEquals(0, store.historyQueries);
        JsonObject phone = history(OPERATOR, "{}");
        assertEquals(Messages.EDITS_HISTORY_REPLY, phone.get("type").getAsString(), "phone editing reads it");
    }

    @Test
    void h7RowsFromBeforeTheMigrationListWithoutValuesAndTheStoredName() throws Exception {
        String p14 = uuid();
        save("alex", createPad(p14, "P14", -103.5, 31.9));
        // Rewrite the row as schema 2 left it: no values, name or kind.
        MapStore.EditRow row = store.committed.edits.get(0);
        store.committed.edits.set(0, new MapStore.EditRow(row.project(), row.batchId(), row.seq(), row.entity(),
            row.entityId(), row.op(), row.version(), row.actor(), row.source()));
        save("alex", update(p14, 1, "{\"geometry\":" + point(-103.51, 31.91) + "}"));
        save("alex", update(p14, 2, "{\"name\":\"P-14\"}"));
        JsonObject page = page("{}");
        JsonObject old = op(entry(page, 2), 0);
        assertTrue(old.get("before").isJsonNull());
        assertTrue(old.get("after").isJsonNull());
        assertEquals("P-14", old.get("name").getAsString(), "an old row reads the stored record's name");
        assertEquals("pad", old.get("kind").getAsString());
        assertEquals("alex", entry(page, 2).get("actor").getAsString());
        assertEquals("P14", op(entry(page, 1), 0).get("name").getAsString(), "a move before a rename: the name then");
        assertEquals("P-14", op(entry(page, 0), 0).get("name").getAsString());
    }

    @Test
    void h8ARefusedBatchLeavesNoEntry() {
        String p14 = uuid();
        save("alex", createPad(p14, "P14", -103.5, 31.9));
        save("alex", update(p14, 1, "{\"name\":\"P-14\"}"));
        MapStudioException ex = org.junit.jupiter.api.Assertions.assertThrows(MapStudioException.class,
            () -> save("sam", update(p14, 1, "{\"name\":\"stale\"}")));
        assertEquals(Messages.CODE_CONFLICT, ex.code());
        JsonObject page = page("{}");
        assertEquals(2, entries(page).size());
        assertFalse(page.toString().contains("stale"));
        assertFalse(page.toString().contains("sam"));
    }

    @Test
    void aKindSetupOpKeepsItsKindIdAndOnlyTheChangedSetup() {
        String setup = "{\"op\":\"create\",\"entity\":\"kindSetup\",\"id\":\"pad\",\"baseVersion\":0,"
            + "\"data\":{\"setup\":{\"link\":\"/pad/{item.name}\"}}}";
        save("alex", setup);
        save("alex", "{\"op\":\"update\",\"entity\":\"kindSetup\",\"id\":\"pad\",\"baseVersion\":1,"
            + "\"data\":{\"setup\":{\"link\":\"/pads/{item.id}\"}}}");
        JsonObject page = page("{}");
        JsonObject o = op(entry(page, 0), 0);
        assertEquals("kindSetup", o.get("entity").getAsString());
        assertEquals("pad", o.get("kind").getAsString());
        assertTrue(o.get("name").isJsonNull());
        assertEquals(json("{\"setup\":{\"link\":\"/pad/{item.name}\"}}"), o.get("before"));
        assertEquals(json("{\"setup\":{\"link\":\"/pads/{item.id}\"}}"), o.get("after"));
        JsonObject created = op(entry(page, 1), 0);
        assertEquals(json("{\"kindId\":\"pad\",\"setup\":{\"link\":\"/pad/{item.name}\"},\"version\":1,"
            + "\"deleted\":false}"), created.get("after"));
    }

    @Test
    void anEmptyRecordIsAnEmptyPage() {
        JsonObject page = page("{}");
        assertEquals(0, entries(page).size());
        assertFalse(page.get("more").getAsBoolean());
    }

    // --- the page rule -------------------------------------------------------------

    @Test
    void thePageRuleTakesWholeBatchesUpToFiftyEntriesOrAThousandOps() {
        assertEquals(0, HistoryPage.take(List.of(), 50));
        assertEquals(50, HistoryPage.take(java.util.Collections.nCopies(60, 1), 50));
        assertEquals(3, HistoryPage.take(List.of(1, 1, 1), 50));
        assertEquals(1, HistoryPage.take(List.of(1000, 1), 50), "a full batch alone");
        assertEquals(2, HistoryPage.take(List.of(999, 1, 1), 50), "exactly 1,000 ops fits");
        assertEquals(2, HistoryPage.take(List.of(500, 500, 1), 50));
        assertEquals(1, HistoryPage.take(List.of(10, 991), 50), "never past 1,000");
        assertEquals(1, HistoryPage.take(List.of(1, 1), 1));
    }
}
