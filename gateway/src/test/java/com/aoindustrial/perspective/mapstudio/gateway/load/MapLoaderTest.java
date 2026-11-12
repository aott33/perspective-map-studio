package com.aoindustrial.perspective.mapstudio.gateway.load;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.AdapterStatus;
import com.aoindustrial.perspective.mapstudio.common.contract.Asset;
import com.aoindustrial.perspective.mapstudio.common.contract.Kind;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.AdapterSnapshot;
import com.aoindustrial.perspective.mapstudio.gateway.setup.SetupRegistry;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreGate;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreState;
import com.aoindustrial.perspective.mapstudio.gateway.write.Actor;
import com.aoindustrial.perspective.mapstudio.gateway.write.FakeMapStore;
import com.aoindustrial.perspective.mapstudio.gateway.write.NoChangeHook;
import com.aoindustrial.perspective.mapstudio.gateway.write.RoleMatrix;
import com.aoindustrial.perspective.mapstudio.gateway.write.WriteService;

class MapLoaderTest {

    static final AdapterSnapshot LISTS = new AdapterSnapshot(
        List.of(new Kind("pad", "Well pad", "point", "well-pad", 10, List.of())),
        List.of(new Asset("P12", "Pad 12", "pad", "[default]Mesa/P12")),
        new AdapterStatus(AdapterStatus.OK, "1 kind from mapstudio_dev.kinds.", "mapstudio_dev.kinds", 1, 0,
            "2026-10-26T10:00:00Z"),
        new AdapterStatus(AdapterStatus.OK, "1 asset from mapstudio_dev.assets.", "mapstudio_dev.assets", 1, 0,
            "2026-10-26T10:00:00Z"));

    FakeMapStore store;
    SetupRegistry setups;
    StoreState state;
    MapLoader loader;
    WriteService writes;

    @BeforeEach
    void setUp() throws Exception {
        store = new FakeMapStore();
        setups = new SetupRegistry(s -> { });
        setups.put("mapstudio-dev", Setup.parse("{\"schemaVersion\":1,\"connection\":\"MapStudio\"}"));
        state = StoreState.ready();
        StoreGate gate = new StoreGate(setups, c -> state);
        loader = new MapLoader(gate, store, project -> LISTS);
        writes = new WriteService(gate, store, new NoChangeHook(), project -> LISTS);
    }

    @Test
    void mapLoadSendsTheLevelSeqAndStoredItems() {
        String id = UUID.randomUUID().toString();
        writes.apply("mapstudio-dev", JsonParser.parseString("{\"batchId\":\"" + UUID.randomUUID() + "\",\"ops\":[{"
            + "\"op\":\"create\",\"entity\":\"item\",\"id\":\"" + id + "\",\"baseVersion\":0,\"data\":{\"kind\":\"pad\","
            + "\"geometry\":{\"type\":\"Point\",\"coordinates\":[1,2]}}}]}"), Actor.script("t"), Messages.LEVEL_FULL);
        JsonObject body = loader.mapLoadReply("mapstudio-dev", Messages.LEVEL_NONE);
        assertEquals("none", body.get("level").getAsString());
        assertEquals(1, body.get("seq").getAsLong());
        assertEquals(1, body.getAsJsonArray("items").size());
        assertEquals(id, body.getAsJsonArray("items").get(0).getAsJsonObject().get("id").getAsString());
    }

    @Test
    void aStoredRowTheTagPathRuleRefusesIsReportedOnceAndLoadsAsItIs() {
        // Entry 13a, G5: rows put into the store directly, as an older module could have saved them.
        java.util.List<StoredPathReport> reports = new java.util.ArrayList<>();
        loader = new MapLoader(new StoreGate(setups, c -> state), store, project -> LISTS, reports::add);
        JsonObject badSetup = JsonParser.parseString("{\"kpis\":[{\"key\":\"p\",\"path\":\"{asset.path}/a//b\"}],"
            + "\"comms\":{\"path\":\"{asset.path}/Comms\"}}").getAsJsonObject();
        JsonObject badOverrides = JsonParser.parseString("{\"comms\":{\"path\":\"[default]a//b\"}}").getAsJsonObject();
        String good = UUID.randomUUID().toString();
        String bad = "c0ffee00-0000-4000-8000-00000000000a";
        JsonObject point = JsonParser.parseString("{\"type\":\"Point\",\"coordinates\":[1,2]}").getAsJsonObject();
        store.committed.kindSetups.computeIfAbsent("mapstudio-dev", p -> new java.util.TreeMap<>()).put("pad",
            new com.aoindustrial.perspective.mapstudio.common.contract.KindSetupRecord("pad", badSetup, 1, false));
        java.util.TreeMap<String, com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord> items =
            store.committed.items.computeIfAbsent("mapstudio-dev", p -> new java.util.TreeMap<>());
        items.put(good, new com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord(good, "pad", "P12", point,
            new JsonObject(), "P12", new JsonObject(), null, null, 1, false));
        items.put(bad, new com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord(bad, "pad", "P14", point,
            new JsonObject(), "P12", badOverrides, null, null, 1, false));

        JsonObject body = loader.mapLoadReply("mapstudio-dev", Messages.LEVEL_FULL);
        // The rows load as they are stored: nothing is rewritten or left out.
        assertEquals(2, body.getAsJsonArray("items").size());
        assertEquals(badSetup, body.getAsJsonArray("kindSetups").get(0).getAsJsonObject().get("setup"));
        assertEquals(badSetup, store.committed.kindSetups.get("mapstudio-dev").get("pad").setup());
        assertEquals(badOverrides, store.committed.items.get("mapstudio-dev").get(bad).overrides());
        assertEquals(1, store.committed.kindSetups.get("mapstudio-dev").get("pad").version());

        assertEquals(1, reports.size());
        assertEquals(List.of(
            "Project mapstudio-dev: the kind setup of pad holds a tag path a save refuses: kpis[0].path: {asset.path}/a//b"
                + " has an empty part between two /; a tag path has a name between every two /. It loads and draws as before"
                + " and is refused when it is next saved: mend the path on the Kinds screen or with"
                + " system.mapstudio.applyEdits.",
            "Project mapstudio-dev: the overrides of map item P14 (" + bad + ", kind pad) hold a tag path a save refuses:"
                + " overrides: comms.path: [default]a//b has an empty part between two /; a tag path has a name between"
                + " every two /. It loads and draws as before and is refused when it is next saved: mend the path in the"
                + " item's Details or with system.mapstudio.applyEdits."), reports.get(0).warnings());
        assertEquals("Project mapstudio-dev: 3 stored rows (1 kind setup, 2 map items) checked against the tag path rule:"
            + " 2 would be refused at their next save; nothing was changed.", reports.get(0).info());

        // Once per project since the start: a second read, the live cache's or getMap's, says nothing more.
        loader.mapLoadReply("mapstudio-dev", Messages.LEVEL_NONE);
        loader.snapshot("mapstudio-dev");
        assertEquals(1, reports.size());

        // The row's next save is refused in the same words; a mended one is saved.
        MapStudioException refused = assertThrows(MapStudioException.class, () -> writes.apply("mapstudio-dev",
            JsonParser.parseString("{\"batchId\":\"" + UUID.randomUUID() + "\",\"ops\":[{\"op\":\"update\",\"entity\":"
                + "\"kindSetup\",\"id\":\"pad\",\"baseVersion\":1,\"data\":{\"setup\":" + badSetup + "}}]}"),
            Actor.script("t"), Messages.LEVEL_FULL));
        assertEquals(Messages.CODE_INVALID, refused.code());
        assertTrue(refused.getMessage().contains("kpis[0].path: {asset.path}/a//b has an empty part between two /"),
            refused.getMessage());
        MapStudioException item = assertThrows(MapStudioException.class, () -> writes.apply("mapstudio-dev",
            JsonParser.parseString("{\"batchId\":\"" + UUID.randomUUID() + "\",\"ops\":[{\"op\":\"update\",\"entity\":"
                + "\"item\",\"id\":\"" + bad + "\",\"baseVersion\":1,\"data\":{\"name\":\"P14 renamed\"}}]}"),
            Actor.script("t"), Messages.LEVEL_FULL));
        assertTrue(item.getMessage().contains("overrides: comms.path: [default]a//b has an empty part"), item.getMessage());
        writes.apply("mapstudio-dev", JsonParser.parseString("{\"batchId\":\"" + UUID.randomUUID() + "\",\"ops\":[{"
            + "\"op\":\"update\",\"entity\":\"kindSetup\",\"id\":\"pad\",\"baseVersion\":1,\"data\":{\"setup\":{\"kpis\":"
            + "[{\"key\":\"p\",\"path\":\"{asset.path}/a/b\"}]}}}]}"), Actor.script("t"), Messages.LEVEL_FULL);
    }

    @Test
    void anItemsPopupParamIsMendedByScriptOnly() {
        JsonObject point = JsonParser.parseString("{\"type\":\"Point\",\"coordinates\":[1,2]}").getAsJsonObject();
        JsonObject overrides = JsonParser.parseString("{\"popupView\":{\"path\":\"Popups/P\",\"params\":{\"p\":"
            + "\"{asset.path}/a//b\"}}}").getAsJsonObject();
        StoredPathReport report = StoredPathReport.of("mapstudio-dev", List.of(), List.of(
            new com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord("i1", "pad", "P14", point,
                new JsonObject(), null, overrides, null, null, 1, false)));
        assertEquals(1, report.warnings().size());
        assertTrue(report.warnings().get(0).endsWith("overrides: popupView.params.p: {asset.path}/a//b has an empty part"
            + " between two /; a tag path has a name between every two /. It loads and draws as before and is refused when"
            + " it is next saved: mend the path with system.mapstudio.applyEdits (no screen edits an item's popup view"
            + " params)."), report.warnings().get(0));
    }

    @Test
    void aStoreWhoseEveryPathPassesIsCountedInOneInfoLine() {
        java.util.List<StoredPathReport> reports = new java.util.ArrayList<>();
        loader = new MapLoader(new StoreGate(setups, c -> state), store, project -> LISTS, reports::add);
        loader.snapshot("mapstudio-dev");
        assertEquals(List.of(), reports.get(0).warnings());
        assertEquals("Project mapstudio-dev: 0 stored rows (0 kind setups, 0 map items) checked against the tag path rule:"
            + " every stored tag path passes.", reports.get(0).info());
    }

    @Test
    void anEmptyMapIsSeqZeroWithNoItems() {
        JsonObject body = loader.mapLoadReply("mapstudio-dev", Messages.LEVEL_FULL);
        assertEquals(0, body.get("seq").getAsLong());
        assertEquals(0, body.getAsJsonArray("items").size());
    }

    @Test
    void noSetupOrNoConnectionIsStoreUnreachableWithTheReason() {
        MapStudioException noSetup = assertThrows(MapStudioException.class,
            () -> loader.mapLoadReply("other", Messages.LEVEL_NONE));
        assertEquals(Messages.CODE_STORE_UNREACHABLE, noSetup.code());
        assertTrue(noSetup.plainMessage().contains("Project other has no Map Studio setup"));
        state = StoreState.noConnection("MapStudio");
        MapStudioException noConnection = assertThrows(MapStudioException.class,
            () -> loader.mapLoadReply("mapstudio-dev", Messages.LEVEL_NONE));
        assertEquals(Messages.CODE_STORE_UNREACHABLE, noConnection.code());
        assertTrue(noConnection.plainMessage().contains("MapStudio"));
        assertEquals(0, store.transactions, "nothing is read when the store is unreachable");
    }

    @Test
    void everyLevelGetsKindsAndBothStatusesButOnlyEditorsGetAssets() {
        for (String level : List.of(Messages.LEVEL_NONE, Messages.LEVEL_PHONE, Messages.LEVEL_FULL)) {
            JsonObject body = loader.mapLoadReply("mapstudio-dev", level);
            assertEquals("pad", body.getAsJsonArray("kinds").get(0).getAsJsonObject().get("id").getAsString());
            assertEquals("ok", body.getAsJsonObject("adapters").getAsJsonObject("kinds").get("status").getAsString());
            assertEquals(1, body.getAsJsonObject("adapters").getAsJsonObject("assets").get("count").getAsInt());
            // Every level gets the asset names without a base path (epic 3 entry 9, the search by asset name).
            JsonObject name = body.getAsJsonArray("assetNames").get(0).getAsJsonObject();
            assertEquals("P12", name.get("id").getAsString(), level);
            assertEquals("Pad 12", name.get("name").getAsString(), level);
            assertTrue(!name.has("basePath") && !name.has("kind"), "assetNames carries the id and the name alone");
            if (Messages.LEVEL_NONE.equals(level)) {
                assertTrue(!body.has("assets"), "a viewer gets no asset rows (no tag paths)");
            } else {
                assertEquals("[default]Mesa/P12", body.getAsJsonArray("assets").get(0).getAsJsonObject()
                    .get("basePath").getAsString(), level);
            }
        }
    }

    @Test
    void aViewerGetsTheStatusWithoutTheHostErrorText() {
        AdapterStatus failing = new AdapterStatus(AdapterStatus.FAILING,
            "The kind function mapstudio_dev.kinds failed: OperationalError: host db7.corp user scada.",
            "mapstudio_dev.kinds", 0, 0, null, "The kind function mapstudio_dev.kinds failed.");
        MapLoader failingLoader = new MapLoader(new StoreGate(setups, c -> state), store,
            project -> new AdapterSnapshot(List.of(), List.of(), failing, LISTS.assetsStatus()));
        for (String level : List.of(Messages.LEVEL_NONE, Messages.LEVEL_PHONE, Messages.LEVEL_FULL)) {
            JsonObject kinds = failingLoader.mapLoadReply("mapstudio-dev", level).getAsJsonObject("adapters")
                .getAsJsonObject("kinds");
            assertEquals("failing", kinds.get("status").getAsString());
            assertEquals(Messages.LEVEL_NONE.equals(level) ? "The kind function mapstudio_dev.kinds failed."
                : failing.message(), kinds.get("message").getAsString(), level);
            assertTrue(!kinds.has("viewerMessage"), "no key of its own");
        }
    }

    @Test
    void mapLoadSendsThePartOfTheSetupTheBrowserNeeds() {
        JsonObject setup = loader.mapLoadReply("mapstudio-dev", Messages.LEVEL_FULL).getAsJsonObject("setup");
        assertEquals(10, setup.get("refreshIntervalSeconds").getAsInt());
        assertEquals("[\"none\",\"osm\"]", setup.get("basemaps").toString());
        assertEquals("", setup.get("alarmPage").getAsString());
        assertEquals("auto", setup.get("units").getAsString(), "a schema 1 setup: the browser's locale");
        assertEquals(4, setup.size(), "never the connection, the roles, the functions or the token secret");
    }

    @Test
    void theReplysSetupAlwaysHoldsTheUnitsAtEveryLevel() throws Exception {
        // U1: schema 1 (setUp's), auto at every level.
        for (String level : List.of(Messages.LEVEL_NONE, Messages.LEVEL_PHONE, Messages.LEVEL_FULL)) {
            assertEquals("auto", loader.mapLoadReply("mapstudio-dev", level).getAsJsonObject("setup")
                .get("units").getAsString(), level);
        }
        // U2 and U11: a schema 2 setup's units, a viewer included.
        setups.put("mapstudio-dev", Setup.parse("{\"schemaVersion\":2,\"connection\":\"MapStudio\",\"units\":\"us\"}"));
        for (String level : List.of(Messages.LEVEL_NONE, Messages.LEVEL_PHONE, Messages.LEVEL_FULL)) {
            assertEquals("us", loader.mapLoadReply("mapstudio-dev", level).getAsJsonObject("setup")
                .get("units").getAsString(), level);
        }
        // U3: schema 2 with no units is auto, and still sent.
        setups.put("mapstudio-dev", Setup.parse("{\"schemaVersion\":2,\"connection\":\"MapStudio\"}"));
        assertEquals("auto", loader.mapLoadReply("mapstudio-dev", Messages.LEVEL_NONE).getAsJsonObject("setup")
            .get("units").getAsString());
    }

    @Test
    void aChangedSetupAppliesAtTheNextCallWithNoRestart() throws Exception {
        String roles = "\"roles\":{\"full\":[\"MapEditor\"],\"phone\":[]}";
        setups.put("mapstudio-dev", Setup.parse("{\"schemaVersion\":1,\"connection\":\"MapStudio\"," + roles + "}"));
        List<String> editor = List.of("MapEditor");
        assertEquals("full", loader.mapLoadReply("mapstudio-dev", setup -> RoleMatrix.level(setup, editor))
            .get("level").getAsString());

        setups.put("mapstudio-dev", Setup.parse("{\"schemaVersion\":1,\"connection\":\"MapStudio\","
            + "\"roles\":{\"full\":[\"Nobody\"],\"phone\":[\"MapEditor\"]},\"refreshIntervalSeconds\":30}"),
            "resource modified");
        JsonObject reply = loader.mapLoadReply("mapstudio-dev", setup -> RoleMatrix.level(setup, editor));
        assertEquals("phone", reply.get("level").getAsString(), "the level comes from the setup the reply is built from");
        assertEquals(30, reply.getAsJsonObject("setup").get("refreshIntervalSeconds").getAsInt());

        setups.putProblem("mapstudio-dev", "refreshIntervalSeconds must be a whole number from 1 to 3600, not \"ten\".");
        MapStudioException load = assertThrows(MapStudioException.class,
            () -> loader.mapLoadReply("mapstudio-dev", Messages.LEVEL_NONE));
        assertEquals(Messages.CODE_STORE_UNREACHABLE, load.code());
        assertTrue(load.plainMessage().contains("refreshIntervalSeconds must be a whole number"), load.plainMessage());
        MapStudioException save = assertThrows(MapStudioException.class, () -> writes.apply("mapstudio-dev",
            JsonParser.parseString("{\"batchId\":\"" + UUID.randomUUID() + "\",\"ops\":[]}"), Actor.script("t"),
            Messages.LEVEL_FULL));
        assertEquals(Messages.CODE_STORE_UNREACHABLE, save.code());
        assertEquals(load.plainMessage(), save.plainMessage());
        assertThrows(MapStudioException.class, () -> loader.snapshot("mapstudio-dev"));

        setups.put("mapstudio-dev", Setup.parse("{\"schemaVersion\":1,\"connection\":\"MapStudio\"," + roles + "}"));
        assertEquals(10, loader.mapLoadReply("mapstudio-dev", "full").getAsJsonObject("setup")
            .get("refreshIntervalSeconds").getAsInt());
    }

    @Test
    void theUnitsOverrideGoesToEveryLevelBesideTheSetupsUnits() throws Exception {
        // Entry 19b, S10: a fresh store has no override.
        for (String level : List.of(Messages.LEVEL_NONE, Messages.LEVEL_PHONE, Messages.LEVEL_FULL)) {
            assertEquals("{}", loader.mapLoadReply("mapstudio-dev", level).get("settings").toString(), level);
        }
        setups.put("mapstudio-dev", Setup.parse("{\"schemaVersion\":2,\"connection\":\"MapStudio\",\"units\":\"metric\"}"));
        writes.apply("mapstudio-dev", JsonParser.parseString("{\"batchId\":\"" + UUID.randomUUID() + "\",\"ops\":["
            + "{\"op\":\"create\",\"entity\":\"settings\",\"id\":\"units\",\"baseVersion\":0,"
            + "\"data\":{\"system\":\"us\",\"labels\":\"long\"}}]}"), Actor.script("t"), Messages.LEVEL_FULL);
        // S9: the same record at every level, a viewer included; the setup's own units are unchanged.
        for (String level : List.of(Messages.LEVEL_NONE, Messages.LEVEL_PHONE, Messages.LEVEL_FULL)) {
            JsonObject body = loader.mapLoadReply("mapstudio-dev", level);
            assertEquals(JsonParser.parseString("{\"units\":{\"id\":\"units\",\"system\":\"us\",\"labels\":\"long\","
                + "\"version\":1}}"), body.get("settings"), level);
            assertEquals("metric", body.getAsJsonObject("setup").get("units").getAsString(), level);
        }
        // S3: cleared, the reply's settings is {} again.
        writes.apply("mapstudio-dev", JsonParser.parseString("{\"batchId\":\"" + UUID.randomUUID() + "\",\"ops\":["
            + "{\"op\":\"delete\",\"entity\":\"settings\",\"id\":\"units\",\"baseVersion\":1}]}"),
            Actor.script("t"), Messages.LEVEL_FULL);
        assertEquals("{}", loader.mapLoadReply("mapstudio-dev", Messages.LEVEL_NONE).get("settings").toString());
        assertEquals(0, loader.snapshot("mapstudio-dev").settings().size());
    }

    @Test
    void kindSetupsGoToEditorsOnlyAndTombstonesAreLeftOut() {
        writes.apply("mapstudio-dev", JsonParser.parseString("{\"batchId\":\"" + UUID.randomUUID() + "\",\"ops\":["
            + "{\"op\":\"create\",\"entity\":\"kindSetup\",\"id\":\"pad\",\"baseVersion\":0,"
            + "\"data\":{\"setup\":{\"link\":\"/pad/{item.name}\"}}}]}"), Actor.script("t"), Messages.LEVEL_FULL);
        for (String level : List.of(Messages.LEVEL_PHONE, Messages.LEVEL_FULL)) {
            JsonObject body = loader.mapLoadReply("mapstudio-dev", level);
            assertEquals(JsonParser.parseString("[{\"kindId\":\"pad\",\"setup\":{\"link\":\"/pad/{item.name}\"},"
                + "\"version\":1,\"deleted\":false}]"), body.get("kindSetups"), level);
        }
        assertTrue(!loader.mapLoadReply("mapstudio-dev", Messages.LEVEL_NONE).has("kindSetups"),
            "a viewer gets no kind setups (they hold tag paths)");
        writes.apply("mapstudio-dev", JsonParser.parseString("{\"batchId\":\"" + UUID.randomUUID() + "\",\"ops\":["
            + "{\"op\":\"delete\",\"entity\":\"kindSetup\",\"id\":\"pad\",\"baseVersion\":1}]}"),
            Actor.script("t"), Messages.LEVEL_FULL);
        assertEquals(0, loader.mapLoadReply("mapstudio-dev", Messages.LEVEL_FULL).getAsJsonArray("kindSetups").size());
    }

    @Test
    void aViewerGetsMapItemsWithoutTheirOverrides() {
        String id = UUID.randomUUID().toString();
        String overrides = "{\"kpis\":[{\"key\":\"p\",\"path\":\"[default]Mesa/P12/Pressure\"}]}";
        writes.apply("mapstudio-dev", JsonParser.parseString("{\"batchId\":\"" + UUID.randomUUID() + "\",\"ops\":["
            + "{\"op\":\"create\",\"entity\":\"item\",\"id\":\"" + id + "\",\"baseVersion\":0,\"data\":{"
            + "\"kind\":\"pad\",\"name\":\"P12\",\"geometry\":{\"type\":\"Point\",\"coordinates\":[-104.97,39.74]},"
            + "\"overrides\":" + overrides + "}}]}"), Actor.script("t"), Messages.LEVEL_FULL);
        for (String level : List.of(Messages.LEVEL_PHONE, Messages.LEVEL_FULL)) {
            assertEquals(JsonParser.parseString(overrides), item(loader.mapLoadReply("mapstudio-dev", level), id)
                .get("overrides"), level);
        }
        JsonObject viewer = item(loader.mapLoadReply("mapstudio-dev", Messages.LEVEL_NONE), id);
        assertEquals(new JsonObject(), viewer.get("overrides"), "a viewer gets no override tag paths");
        assertEquals("P12", viewer.get("name").getAsString());
        assertTrue(!loader.mapLoadReply("mapstudio-dev", Messages.LEVEL_NONE).toString().contains("Pressure"));
    }

    @Test
    void editorsGetWhoLastChangedEachItemAndViewersDoNot() {
        String a = UUID.randomUUID().toString();
        String b = UUID.randomUUID().toString();
        String deleted = UUID.randomUUID().toString();
        store.now = "2026-11-07T09:15:00Z";
        writes.apply("mapstudio-dev", JsonParser.parseString("{\"batchId\":\"" + UUID.randomUUID() + "\",\"ops\":["
            + create(a, "P12") + "," + create(b, "P14") + "," + create(deleted, "P15") + "]}"), Actor.session("sam"),
            Messages.LEVEL_FULL);
        store.now = "2026-11-08T10:42:07Z";
        writes.apply("mapstudio-dev", JsonParser.parseString("{\"batchId\":\"" + UUID.randomUUID() + "\",\"ops\":["
            + "{\"op\":\"update\",\"entity\":\"item\",\"id\":\"" + b + "\",\"baseVersion\":1,\"data\":{\"name\":\"P14b\"}},"
            + "{\"op\":\"delete\",\"entity\":\"item\",\"id\":\"" + deleted + "\",\"baseVersion\":1}]}"),
            Actor.session("alex"), Messages.LEVEL_FULL);
        for (String level : List.of(Messages.LEVEL_PHONE, Messages.LEVEL_FULL)) {
            int before = store.lastEditsQueries;
            JsonObject changed = loader.mapLoadReply("mapstudio-dev", level).getAsJsonObject("changed");
            assertEquals(1, store.lastEditsQueries - before, "one query per load, never one per item");
            assertEquals(JsonParser.parseString("{\"actor\":\"sam\",\"at\":\"2026-11-07T09:15:00Z\"}"), changed.get(a), level);
            assertEquals(JsonParser.parseString("{\"actor\":\"alex\",\"at\":\"2026-11-08T10:42:07Z\"}"), changed.get(b), level);
            assertTrue(!changed.has(deleted), "a deleted item is not on the map, so it has no entry");
            assertEquals(2, changed.size(), level);
        }
        int before = store.lastEditsQueries;
        JsonObject viewer = loader.mapLoadReply("mapstudio-dev", Messages.LEVEL_NONE);
        assertTrue(!viewer.has("changed"), "a viewer never learns who changed what");
        assertEquals(before, store.lastEditsQueries, "nothing is read for a viewer");
        assertTrue(!viewer.toString().contains("alex"));
    }

    @Test
    void anItemWithNoEditRecordIsLeftOutOfChanged() {
        JsonObject changed = MapLoader.changedJson(List.of(), java.util.Map.of("x",
            new com.aoindustrial.perspective.mapstudio.gateway.store.MapStore.LastEdit("sam", "2026-11-08T10:42:00Z")));
        assertEquals(new JsonObject(), changed, "only live items are named");
        assertEquals(new JsonObject(), loader.mapLoadReply("mapstudio-dev", Messages.LEVEL_FULL).getAsJsonObject("changed"));
    }

    private static String create(String id, String name) {
        return "{\"op\":\"create\",\"entity\":\"item\",\"id\":\"" + id + "\",\"baseVersion\":0,\"data\":{"
            + "\"kind\":\"pad\",\"name\":\"" + name + "\",\"geometry\":{\"type\":\"Point\",\"coordinates\":[-104.97,39.74]}}}";
    }

    private static JsonObject item(JsonObject body, String id) {
        for (var e : body.getAsJsonArray("items")) {
            if (id.equals(e.getAsJsonObject().get("id").getAsString())) {
                return e.getAsJsonObject();
            }
        }
        throw new AssertionError("no item " + id);
    }
}
