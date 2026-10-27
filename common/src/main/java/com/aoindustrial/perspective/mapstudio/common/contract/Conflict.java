package com.aoindustrial.perspective.mapstudio.common.contract;

import com.inductiveautomation.ignition.common.gson.JsonNull;
import com.inductiveautomation.ignition.common.gson.JsonObject;

/**
 * One stale op of a refused batch, as the {@code conflict} error body lists it
 * (epic 2 story 2): {@code {index, entity, id, baseVersion, current, changedBy, changedAt}}.
 * {@code current} is the stored record (a deleted one shows {@code deleted: true});
 * {@code changedBy} and {@code changedAt} (ISO 8601, UTC) come from the item's last
 * edit record, null when it has none.
 */
public record Conflict(int index, String entity, String id, int baseVersion, MapItemRecord current,
                       String changedBy, String changedAt) {

    public JsonObject toJson() {
        JsonObject o = new JsonObject();
        o.addProperty("index", index);
        o.addProperty("entity", entity);
        o.addProperty("id", id);
        o.addProperty("baseVersion", baseVersion);
        o.add("current", current == null ? JsonNull.INSTANCE : current.toJson());
        if (changedBy == null) {
            o.add("changedBy", JsonNull.INSTANCE);
        } else {
            o.addProperty("changedBy", changedBy);
        }
        if (changedAt == null) {
            o.add("changedAt", JsonNull.INSTANCE);
        } else {
            o.addProperty("changedAt", changedAt);
        }
        return o;
    }
}
