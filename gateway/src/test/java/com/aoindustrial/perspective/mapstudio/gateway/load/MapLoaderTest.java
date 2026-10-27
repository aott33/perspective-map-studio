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
        writes = new WriteService(gate, store, new NoChangeHook());
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
}
