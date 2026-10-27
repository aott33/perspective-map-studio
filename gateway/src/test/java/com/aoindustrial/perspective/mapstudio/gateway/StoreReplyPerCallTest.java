package com.aoindustrial.perspective.mapstudio.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

import com.aoindustrial.perspective.mapstudio.common.contract.Setup;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.NoAdapters;
import com.aoindustrial.perspective.mapstudio.gateway.load.MapLoader;
import com.aoindustrial.perspective.mapstudio.gateway.setup.SetupRegistry;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreGate;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreState;
import com.aoindustrial.perspective.mapstudio.gateway.write.FakeMapStore;
import com.aoindustrial.perspective.mapstudio.gateway.write.NoChangeHook;
import com.aoindustrial.perspective.mapstudio.gateway.write.WriteService;

/**
 * Epic 2 story 6: the delegate's {@code map.load} and {@code edits.apply} read the
 * setup on every call, once, and work out the session's level from that same setup,
 * so a scanned change applies at the next call with no restart and one reply never
 * mixes two setups.
 */
class StoreReplyPerCallTest {

    static final String P = "mapstudio-dev";

    FakeMapStore store;
    SetupRegistry setups;
    MapLoader loader;
    WriteService writes;
    /** Changes the setup the first time the store gate asks for the connection's state (a scan mid-call). */
    Runnable midCall;

    static Setup setup(String full, String phone, int refresh) throws Exception {
        return Setup.parse("{\"schemaVersion\":1,\"connection\":\"MapStudio\",\"roles\":{\"full\":[" + full
            + "],\"phone\":[" + phone + "]},\"refreshIntervalSeconds\":" + refresh + "}");
    }

    @BeforeEach
    void setUp() throws Exception {
        store = new FakeMapStore();
        setups = new SetupRegistry(s -> { });
        setups.put(P, setup("\"MapEditor\"", "", 10));
        StoreGate gate = new StoreGate(setups, c -> {
            Runnable r = midCall;
            midCall = null;
            if (r != null) {
                r.run();
            }
            return StoreState.ready();
        });
        loader = new MapLoader(gate, store, NoAdapters::snapshot);
        writes = new WriteService(gate, store, new NoChangeHook());
    }

    private JsonObject load(List<String> roles) {
        return MapStudioDelegate.storeReply(loader, writes, new MapStudioDelegate.SessionView(P, "mapeditor", roles),
            "map.load", "m-" + UUID.randomUUID(), new JsonObject());
    }

    private JsonObject save(List<String> roles) {
        JsonObject body = JsonParser.parseString("{\"batchId\":\"" + UUID.randomUUID() + "\",\"ops\":[{\"op\":\"create\","
            + "\"entity\":\"item\",\"id\":\"" + UUID.randomUUID() + "\",\"baseVersion\":0,\"data\":{\"kind\":\"line\","
            + "\"geometry\":{\"type\":\"LineString\",\"coordinates\":[[1,2],[3,4]]}}}]}").getAsJsonObject();
        return MapStudioDelegate.storeReply(loader, writes, new MapStudioDelegate.SessionView(P, "mapeditor", roles),
            "edits.apply", "e-" + UUID.randomUUID(), body);
    }

    @Test
    void mapLoadFollowsTheSetupAtEveryCall() throws Exception {
        List<String> editor = List.of("MapEditor");
        JsonObject before = load(editor).getAsJsonObject("body");
        assertEquals("full", before.get("level").getAsString());
        assertEquals(10, before.getAsJsonObject("setup").get("refreshIntervalSeconds").getAsInt());

        setups.put(P, setup("\"Nobody\"", "\"MapEditor\"", 30), "resource modified");
        JsonObject after = load(editor).getAsJsonObject("body");
        assertEquals("phone", after.get("level").getAsString());
        assertEquals(30, after.getAsJsonObject("setup").get("refreshIntervalSeconds").getAsInt());

        setups.putProblem(P, "refreshIntervalSeconds must be a whole number from 1 to 3600, not \"ten\".");
        JsonObject refused = load(editor);
        assertEquals("error", refused.get("type").getAsString());
        assertEquals("store-unreachable", refused.getAsJsonObject("body").get("code").getAsString());
    }

    @Test
    void editsApplyFollowsTheSetupAtEveryCall() throws Exception {
        List<String> editor = List.of("MapEditor");
        assertEquals("edits.apply.reply", save(editor).get("type").getAsString());
        setups.put(P, setup("\"Nobody\"", "", 10), "resource modified");
        JsonObject refused = save(editor);
        assertEquals("error", refused.get("type").getAsString());
        assertEquals("role", refused.getAsJsonObject("body").get("code").getAsString());
        assertEquals(1, store.committed.batches.size(), "the refused batch wrote nothing");
    }

    @Test
    void aScanDuringACallNeverMixesTwoSetups() throws Exception {
        List<String> editor = List.of("MapEditor");
        // The setup changes after the call has read it: the reply is all the old setup.
        midCall = () -> {
            try {
                setups.put(P, setup("\"Nobody\"", "\"MapEditor\"", 30), "resource modified");
            } catch (Exception ex) {
                throw new IllegalStateException(ex);
            }
        };
        JsonObject body = load(editor).getAsJsonObject("body");
        assertEquals("full", body.get("level").getAsString());
        assertEquals(10, body.getAsJsonObject("setup").get("refreshIntervalSeconds").getAsInt());
        JsonObject next = load(editor).getAsJsonObject("body");
        assertEquals("phone", next.get("level").getAsString());
        assertEquals(30, next.getAsJsonObject("setup").get("refreshIntervalSeconds").getAsInt());

        // A role removed by a scan before the batch's one setup read refuses the batch.
        setups.put(P, setup("\"MapEditor\"", "", 10));
        midCall = null;
        assertEquals("edits.apply.reply", save(editor).get("type").getAsString());
        setups.put(P, setup("\"Nobody\"", "", 10), "resource modified");
        assertEquals("role", save(editor).getAsJsonObject("body").get("code").getAsString());
    }
}
