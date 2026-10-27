package com.aoindustrial.perspective.mapstudio.gateway.script;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.python.core.PyObject;

import com.inductiveautomation.ignition.common.TypeUtilities;
import com.inductiveautomation.ignition.common.gson.JsonParser;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.NoAdapters;
import com.aoindustrial.perspective.mapstudio.gateway.load.MapLoader;
import com.aoindustrial.perspective.mapstudio.gateway.setup.SetupRegistry;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreGate;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreState;
import com.aoindustrial.perspective.mapstudio.gateway.write.FakeMapStore;
import com.aoindustrial.perspective.mapstudio.gateway.write.NoChangeHook;
import com.aoindustrial.perspective.mapstudio.gateway.write.WriteService;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.TestKinds;

/** Epic 2 story 6: system.mapstudio reads the setup on every call, so a scanned change applies with no restart. */
class GatewayScriptModuleTest {

    static final String P = "mapstudio-dev";

    FakeMapStore store;
    SetupRegistry setups;
    GatewayScriptModule module;

    static Setup setup(String connection) throws Exception {
        return Setup.parse("{\"schemaVersion\":1,\"connection\":\"" + connection + "\"}");
    }

    @BeforeEach
    void setUp() throws Exception {
        store = new FakeMapStore();
        setups = new SetupRegistry(s -> { });
        setups.put(P, setup("MapStudio"));
        StoreGate gate = new StoreGate(setups, c -> StoreState.ready());
        module = new GatewayScriptModule(new WriteService(gate, store, new NoChangeHook(), TestKinds::snapshot),
            new MapLoader(gate, store, NoAdapters::snapshot), NoAdapters.service(setups));
    }

    private PyObject batch() {
        return TypeUtilities.gsonToPy(JsonParser.parseString("{\"batchId\":\"" + UUID.randomUUID() + "\",\"ops\":[{"
            + "\"op\":\"create\",\"entity\":\"item\",\"id\":\"" + UUID.randomUUID() + "\",\"baseVersion\":0,"
            + "\"data\":{\"kind\":\"pad\",\"geometry\":{\"type\":\"Point\",\"coordinates\":[1,2]}}}]}"));
    }

    @Test
    void getMapAndApplyEditsFollowTheSetupAtEveryCall() throws Exception {
        module.applyEditsImpl(P, batch(), "seed-script");
        assertEquals("MapStudio", store.lastConnection);
        module.getMapImpl(P);

        setups.put(P, setup("Other"), "resource modified");
        module.applyEditsImpl(P, batch(), "seed-script");
        assertEquals("Other", store.lastConnection, "the changed connection applies at the next call");

        setups.putProblem(P, "refreshIntervalSeconds must be a whole number from 1 to 3600, not \"ten\".");
        int before = store.transactions;
        MapStudioException save = assertThrows(MapStudioException.class,
            () -> module.applyEditsImpl(P, batch(), "seed-script"));
        assertEquals(Messages.CODE_STORE_UNREACHABLE, save.code());
        assertTrue(save.plainMessage().contains("refreshIntervalSeconds must be a whole number"), save.plainMessage());
        assertThrows(MapStudioException.class, () -> module.getMapImpl(P));
        assertEquals(before, store.transactions, "nothing is read or written while the setup cannot be read");

        setups.put(P, setup("MapStudio"), "resource modified");
        module.getMapImpl(P);
        assertEquals("MapStudio", store.lastConnection);
    }

    @Test
    void applyEditsSavesAnInstrumentOnItsLineAndGetMapAnswersTheAttachment() {
        // Epic 2 story 14: the attachment goes in and comes back as a dict, unchanged.
        String line = UUID.randomUUID().toString();
        String tap = UUID.randomUUID().toString();
        module.applyEditsImpl(P, TypeUtilities.gsonToPy(JsonParser.parseString("{\"batchId\":\"" + UUID.randomUUID()
            + "\",\"ops\":[{\"op\":\"create\",\"entity\":\"item\",\"id\":\"" + line + "\",\"baseVersion\":0,"
            + "\"data\":{\"kind\":\"line\",\"name\":\"L-SWD\",\"geometry\":{\"type\":\"LineString\","
            + "\"coordinates\":[[-103.52,31.92],[-103.505,31.9205]]}}},"
            + "{\"op\":\"create\",\"entity\":\"item\",\"id\":\"" + tap + "\",\"baseVersion\":0,"
            + "\"data\":{\"kind\":\"tap\",\"name\":\"PT-1\",\"geometry\":{\"type\":\"Point\","
            + "\"coordinates\":[-103.52,31.92]},\"attachment\":{\"lineId\":\"" + line + "\",\"distanceM\":0}}}]}")),
            "seed-script");
        PyObject map = module.getMapImpl(P);
        assertEquals(2, map.__len__());
        boolean found = false;
        for (int i = 0; i < 2; i++) {
            com.inductiveautomation.ignition.common.gson.JsonObject item = TypeUtilities.pyToGson(map.__getitem__(i))
                .getAsJsonObject();
            if (tap.equals(item.get("id").getAsString())) {
                assertEquals(JsonParser.parseString("{\"lineId\":\"" + line + "\",\"distanceM\":0.0}"),
                    item.get("attachment"));
                found = true;
            } else {
                assertTrue(item.get("attachment").isJsonNull());
            }
        }
        assertTrue(found);
    }

    @Test
    void getMapAnswersKindSetups() {
        module.applyEditsImpl(P, TypeUtilities.gsonToPy(JsonParser.parseString("{\"batchId\":\"" + UUID.randomUUID()
            + "\",\"ops\":[{\"op\":\"create\",\"entity\":\"kindSetup\",\"id\":\"pad\",\"baseVersion\":0,"
            + "\"data\":{\"setup\":{\"comms\":{\"path\":\"{asset.path}/Comms\"}}}}]}")), "seed-script");
        PyObject map = module.getMapImpl(P);
        PyObject setups = map.__getattr__("kindSetups");
        assertEquals(1, setups.__len__());
        assertEquals(JsonParser.parseString("{\"kindId\":\"pad\",\"setup\":{\"comms\":{\"path\":"
            + "\"{asset.path}/Comms\"}},\"version\":1,\"deleted\":false}"),
            TypeUtilities.pyToGson(setups.__getitem__(0)));
        assertEquals(0, map.__len__(), "still the list of map items");
    }
}
