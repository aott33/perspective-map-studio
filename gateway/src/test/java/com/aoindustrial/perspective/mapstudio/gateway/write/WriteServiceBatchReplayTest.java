package com.aoindustrial.perspective.mapstudio.gateway.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;

/**
 * The batches {@code web/typescript/geometry.ts} and {@code undo.ts} build, replayed through the
 * real write path (epic 2 story 14, review finding of lens quick): {@code instrument-batches.json}
 * is written by {@code web/typescript/__tests__/batch-replay.test.ts}, which fails when the
 * modules' output and the committed file differ. Every batch (create, reshape, its undo, vertex
 * insert, move, split, its undo, delete with the taps, its undo) must save with the versions the
 * browser expected, and the store must end with the records the browser expected.
 */
class WriteServiceBatchReplayTest extends WriteFixture {

    /** The fields compared at the end; version and deleted too. */
    static final List<String> FIELDS = List.of("kind", "name", "geometry", "properties", "assetId", "overrides", "ends",
        "attachment", "version", "deleted");

    static JsonObject fixture() throws IOException {
        try (InputStream in = WriteServiceBatchReplayTest.class.getResourceAsStream("instrument-batches.json")) {
            assertNotNull(in, "instrument-batches.json on the test classpath");
            return JsonParser.parseReader(new InputStreamReader(in, StandardCharsets.UTF_8)).getAsJsonObject();
        }
    }

    @Test
    void everyBatchTheBrowserBuildsSavesWithTheVersionsItExpected() throws IOException {
        JsonObject run = fixture();
        JsonArray steps = run.getAsJsonArray("steps");
        assertEquals(9, steps.size());
        for (JsonElement s : steps) {
            JsonObject step = s.getAsJsonObject();
            String name = step.get("name").getAsString();
            EditResult result = save(step.getAsJsonObject("batch"));
            JsonArray expected = step.getAsJsonArray("results");
            assertEquals(expected.size(), result.results().size(), name);
            for (int i = 0; i < expected.size(); i++) {
                JsonObject e = expected.get(i).getAsJsonObject();
                EditResult.OpResult r = result.results().get(i);
                assertEquals(e.get("id").getAsString(), r.id(), name);
                assertEquals(e.get("version").getAsInt(), r.version(), name + ": " + r.id());
            }
        }
        for (JsonElement f : run.getAsJsonArray("final")) {
            JsonObject want = f.getAsJsonObject();
            String id = want.get("id").getAsString();
            MapItemRecord stored = store.committed.items.get(PROJECT).get(id);
            assertNotNull(stored, id);
            JsonObject got = stored.toJson();
            for (String field : FIELDS) {
                assertEquals(want.get(field), got.get(field), id + " " + field);
            }
        }
    }
}
