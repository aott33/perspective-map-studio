package com.aoindustrial.perspective.mapstudio.gateway.write;

import java.util.List;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonObject;

/** The reply body of a saved batch: {@code {batchId, seq, results: [{entity, id, version}]}}. */
public record EditResult(String batchId, long seq, List<OpResult> results) {

    public record OpResult(String entity, String id, int version) {
    }

    public JsonObject toJson() {
        JsonObject o = new JsonObject();
        o.addProperty("batchId", batchId);
        o.addProperty("seq", seq);
        JsonArray array = new JsonArray();
        for (OpResult r : results) {
            JsonObject item = new JsonObject();
            item.addProperty("entity", r.entity());
            item.addProperty("id", r.id());
            item.addProperty("version", r.version());
            array.add(item);
        }
        o.add("results", array);
        return o;
    }
}
