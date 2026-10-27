package com.aoindustrial.perspective.mapstudio.common.contract;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;

import com.aoindustrial.perspective.mapstudio.common.Messages;

/**
 * An {@code edits.apply} batch (AD-2): {@code {batchId, ops}}. All ops or none; at most
 * one op per id.
 */
public record EditBatch(String batchId, List<EditOp> ops) {

    /** Largest batch accepted through edits.apply; larger imports use edits.begin/chunk/commit (epic-import-export). */
    public static final int MAX_OPS = 1000;

    /**
     * Read a batch; checks the batch and every op's shape.
     *
     * @throws MapStudioException {@code invalid}, naming the op when one is at fault
     */
    public static EditBatch parse(JsonElement element) {
        if (element == null || !element.isJsonObject()) {
            throw new MapStudioException(Messages.CODE_INVALID, "The batch must be an object {batchId, ops}.");
        }
        JsonObject o = element.getAsJsonObject();
        JsonElement id = o.get("batchId");
        if (id == null || !id.isJsonPrimitive() || !id.getAsJsonPrimitive().isString()
                || !EditOp.isUuid(id.getAsString())) {
            throw new MapStudioException(Messages.CODE_INVALID, "The batch needs a batchId that is a UUID string.");
        }
        JsonElement ops = o.get("ops");
        if (ops == null || !ops.isJsonArray() || ops.getAsJsonArray().size() == 0) {
            throw new MapStudioException(Messages.CODE_INVALID, "The batch needs at least one op.");
        }
        JsonArray array = ops.getAsJsonArray();
        if (array.size() > MAX_OPS) {
            throw new MapStudioException(Messages.CODE_INVALID,
                "The batch has " + array.size() + " ops; at most " + MAX_OPS + " are accepted at once.");
        }
        List<EditOp> parsed = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < array.size(); i++) {
            EditOp op = EditOp.parse(array.get(i), i);
            if (!seen.add(op.entity() + "|" + op.id())) {
                throw new MapStudioException(Messages.CODE_INVALID, "Op " + i + ": " + op.id()
                    + " is already changed by an earlier op of this batch; send one op per id.", i, op.id());
            }
            parsed.add(op);
        }
        return new EditBatch(id.getAsString(), List.copyOf(parsed));
    }

    /**
     * Refuse, before anything is written, the ops this contract version does not carry
     * out yet: any kind setup op (entry 3).
     *
     * @throws MapStudioException {@code invalid} naming the first such op
     */
    public void requireSupported() {
        for (EditOp op : ops) {
            if (EditOp.ENTITY_KIND_SETUP.equals(op.entity())) {
                throw new MapStudioException(Messages.CODE_INVALID, "Op " + op.index()
                    + ": saving kind setups is not supported in this version (" + Messages.CONTRACT_VERSION + ").",
                    op.index(), op.id());
            }
        }
    }
}
