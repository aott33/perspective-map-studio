package com.aoindustrial.perspective.mapstudio.gateway.write;

import java.util.ArrayList;
import java.util.List;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
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

    /** The result as the batch row stored it ({@link #toJson()}), for a replayed batchId. */
    public static EditResult fromJson(JsonObject o) {
        List<OpResult> results = new ArrayList<>();
        for (JsonElement e : o.getAsJsonArray("results")) {
            JsonObject r = e.getAsJsonObject();
            results.add(new OpResult(r.get("entity").getAsString(), r.get("id").getAsString(),
                r.get("version").getAsInt()));
        }
        return new EditResult(o.get("batchId").getAsString(), o.get("seq").getAsLong(), List.copyOf(results));
    }
}
