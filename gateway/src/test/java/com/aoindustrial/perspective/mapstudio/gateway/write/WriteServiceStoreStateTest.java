package com.aoindustrial.perspective.mapstudio.gateway.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.NoAdapters;
import com.aoindustrial.perspective.mapstudio.gateway.load.MapLoader;
import com.aoindustrial.perspective.mapstudio.gateway.redundancy.RedundancyGate;
import com.aoindustrial.perspective.mapstudio.gateway.setup.SetupRegistry;
import com.aoindustrial.perspective.mapstudio.gateway.store.FailureLine;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreGate;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreState;

/** Read-only and standby refusals write nothing and call no change hook (epic 2 story 5). */
class WriteServiceStoreStateTest {

    static final String PROJECT = "mapstudio-dev";

    FakeMapStore store;
    StoreState state;
    Optional<String> standby;
    List<ChangeHook.CommittedBatch> hooked;
    WriteService writes;
    MapLoader loader;

    @BeforeEach
    void setUp() throws Exception {
        store = new FakeMapStore();
        SetupRegistry setups = new SetupRegistry(s -> { });
        setups.put(PROJECT, Setup.parse("{\"schemaVersion\":1,\"connection\":\"MapStudio\"}"));
        state = StoreState.ready();
        standby = Optional.empty();
        hooked = new ArrayList<>();
        StoreGate gate = new StoreGate(setups, c -> state, () -> standby);
        writes = new WriteService(gate, store, hooked::add);
        loader = new MapLoader(gate, store, NoAdapters::snapshot);
    }

    static JsonObject createBatch() {
        return JsonParser.parseString("{\"batchId\":\"" + UUID.randomUUID() + "\",\"ops\":[{\"op\":\"create\","
            + "\"entity\":\"item\",\"id\":\"" + UUID.randomUUID() + "\",\"baseVersion\":0,\"data\":{\"kind\":\"pad\","
            + "\"geometry\":{\"type\":\"Point\",\"coordinates\":[1,2]}}}]}").getAsJsonObject();
    }

    void assertRefusedReadOnly(String reason, String level) {
        int before = store.transactions;
        MapStudioException ex = assertThrows(MapStudioException.class,
            () -> writes.apply(PROJECT, createBatch(), Actor.session("mapeditor"), level));
        assertEquals(Messages.CODE_READ_ONLY, ex.code());
        assertEquals(reason, ex.plainMessage());
        assertEquals("read-only: " + reason, ex.getMessage(), "what a script sees");
        assertEquals(before, store.transactions, "no transaction");
        assertTrue(store.committed.edits.isEmpty() && store.committed.batches.isEmpty()
            && store.committed.seqs.isEmpty(), "no edit, batch or seq row");
        assertTrue(hooked.isEmpty(), "no change hook");
    }

    @Test
    void aNewerSchemaRefusesEverySaveAndStillLoads() {
        state = StoreState.readOnly(FailureLine.newerReason(999, 1));
        assertRefusedReadOnly(FailureLine.newerReason(999, 1), Messages.LEVEL_FULL);
        assertRefusedReadOnly(FailureLine.newerReason(999, 1), Messages.LEVEL_NONE);
        JsonObject body = loader.mapLoadReply(PROJECT, Messages.LEVEL_FULL);
        assertEquals(FailureLine.newerReason(999, 1), body.get("readOnly").getAsString());
        assertEquals(0, body.getAsJsonArray("items").size());
    }

    @Test
    void aStandbyRefusesSavesAndLoadsWithTheReason() {
        standby = Optional.of(RedundancyGate.STANDBY_REASON);
        assertRefusedReadOnly(RedundancyGate.STANDBY_REASON, Messages.LEVEL_FULL);
        assertEquals(RedundancyGate.STANDBY_REASON,
            loader.mapLoadReply(PROJECT, Messages.LEVEL_FULL).get("readOnly").getAsString());
    }

    @Test
    void aWritableStoreLoadsWithReadOnlyNull() {
        writes.apply(PROJECT, createBatch(), Actor.script("t"), Messages.LEVEL_FULL);
        JsonObject body = loader.mapLoadReply(PROJECT, Messages.LEVEL_FULL);
        assertTrue(body.has("readOnly") && body.get("readOnly").isJsonNull());
        assertEquals(1, body.getAsJsonArray("items").size());
        assertEquals(1, hooked.size());
    }
}
