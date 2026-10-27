package com.aoindustrial.perspective.mapstudio.gateway.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;

import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;
import com.aoindustrial.perspective.mapstudio.gateway.setup.SetupRegistry;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreGate;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreState;

/**
 * The write service on a {@link FakeMapStore} with the dev setup, and the batch builders the
 * write path's tests share (epic 2 stories 1 and 2).
 */
abstract class WriteFixture {

    static final String PROJECT = "mapstudio-dev";
    static final String LINE = "{\"type\":\"LineString\",\"coordinates\":[[-104.99,39.74],[-104.98,39.75]]}";

    FakeMapStore store;
    SetupRegistry setups;
    StoreState state;
    List<ChangeHook.CommittedBatch> hooked;
    WriteService writes;

    @BeforeEach
    void setUp() throws Exception {
        store = new FakeMapStore();
        setups = new SetupRegistry(s -> { });
        setups.put(PROJECT, Setup.parse("{\"schemaVersion\":1,\"connection\":\"MapStudio\","
            + "\"roles\":{\"full\":[\"MapEditor\"],\"phone\":[\"MapOperator\"]}}"));
        state = StoreState.ready();
        hooked = new ArrayList<>();
        writes = new WriteService(new StoreGate(setups, c -> state), store, hooked::add);
    }

    static String uuid() {
        return UUID.randomUUID().toString();
    }

    static JsonObject batch(String batchId, String... ops) {
        return JsonParser.parseString("{\"batchId\":\"" + batchId + "\",\"ops\":[" + String.join(",", ops) + "]}")
            .getAsJsonObject();
    }

    static String create(String id) {
        return "{\"op\":\"create\",\"entity\":\"item\",\"id\":\"" + id + "\",\"baseVersion\":0,"
            + "\"data\":{\"kind\":\"line\",\"name\":\"Line 1\",\"geometry\":" + LINE + "}}";
    }

    static String update(String id, int baseVersion, String data) {
        return "{\"op\":\"update\",\"entity\":\"item\",\"id\":\"" + id + "\",\"baseVersion\":" + baseVersion
            + ",\"data\":" + data + "}";
    }

    EditResult save(JsonObject batch) {
        return writes.apply(PROJECT, batch, Actor.session("mapeditor"), Messages.LEVEL_FULL);
    }

    MapStudioException refused(JsonObject batch, String level) {
        return assertThrows(MapStudioException.class,
            () -> writes.apply(PROJECT, batch, Actor.session("someone"), level));
    }

    void assertNothingWritten(int edits, long seq) {
        assertEquals(edits, store.committed.edits.size(), "edit rows");
        assertEquals(seq, store.committed.seqs.getOrDefault(PROJECT, 0L), "seq");
    }

}
