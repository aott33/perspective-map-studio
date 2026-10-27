package com.aoindustrial.perspective.mapstudio.gateway.change;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonObject;

import com.aoindustrial.perspective.mapstudio.gateway.write.ChangeHook;

/**
 * One committed batch as the change bus delivers it (AD-17): the project, its
 * {@code seq}, and the {@code map.changed} body, built once and shared by every
 * subscriber (subscribers must not change it).
 */
public record ChangeEvent(String project, long seq, JsonObject body) {

    /**
     * The event for a committed batch. Body (docs/contract.md, map.changed):
     * {@code {seq, batchId, actor, ops: [{op, entity, id, version, record}]}}, each
     * {@code record} the full stored record after the op.
     */
    public static ChangeEvent of(ChangeHook.CommittedBatch batch) {
        JsonObject body = new JsonObject();
        body.addProperty("seq", batch.seq());
        body.addProperty("batchId", batch.batchId());
        body.addProperty("actor", batch.actor() == null ? "" : batch.actor().name());
        JsonArray ops = new JsonArray();
        for (ChangeHook.CommittedOp op : batch.ops()) {
            JsonObject o = new JsonObject();
            o.addProperty("op", op.op());
            o.addProperty("entity", op.entity());
            o.addProperty("id", op.id());
            if (op.record() != null) {
                o.addProperty("version", op.record().version());
                o.add("record", op.record().toJson());
            }
            ops.add(o);
        }
        body.add("ops", ops);
        return new ChangeEvent(batch.project(), batch.seq(), body);
    }
}
