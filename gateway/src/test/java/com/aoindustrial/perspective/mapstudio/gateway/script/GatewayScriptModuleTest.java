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
import com.aoindustrial.perspective.mapstudio.gateway.load.MapLoader;
import com.aoindustrial.perspective.mapstudio.gateway.setup.SetupRegistry;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreGate;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreState;
import com.aoindustrial.perspective.mapstudio.gateway.write.FakeMapStore;
import com.aoindustrial.perspective.mapstudio.gateway.write.NoChangeHook;
import com.aoindustrial.perspective.mapstudio.gateway.write.WriteService;

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
        module = new GatewayScriptModule(new WriteService(gate, store, new NoChangeHook()), new MapLoader(gate, store));
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
}
