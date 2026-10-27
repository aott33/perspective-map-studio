package com.aoindustrial.perspective.mapstudio.common.contract;

import java.util.Set;
import java.util.UUID;

import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;

import com.aoindustrial.perspective.mapstudio.common.Messages;

/**
 * One op of an {@code edits.apply} batch (AD-2): {@code {op, entity, id, baseVersion, data}}.
 * {@code baseVersion} is 0 on create and the stored version otherwise; a create at a
 * deleted map item's version restores it. A delete carries no data.
 */
public record EditOp(String op, String entity, String id, int baseVersion, JsonObject data, int index) {

    public static final String CREATE = "create";
    public static final String UPDATE = "update";
    public static final String DELETE = "delete";
    public static final String ENTITY_ITEM = "item";
    public static final String ENTITY_KIND_SETUP = "kindSetup";

    public static final Set<String> OPS = Set.of(CREATE, UPDATE, DELETE);
    public static final Set<String> ENTITIES = Set.of(ENTITY_ITEM, ENTITY_KIND_SETUP);

    /**
     * Read one op; checks its shape only (the data is checked by the write service).
     *
     * @throws MapStudioException {@code invalid} naming the op
     */
    public static EditOp parse(JsonElement element, int index) {
        if (element == null || !element.isJsonObject()) {
            throw invalid("Op " + index + " must be an object.", index, null);
        }
        JsonObject o = element.getAsJsonObject();
        String id = string(o.get("id"));
        String op = string(o.get("op"));
        String entity = string(o.get("entity"));
        if (op == null || !OPS.contains(op)) {
            throw invalid("Op " + index + ": op must be create, update or delete.", index, id);
        }
        if (entity == null || !ENTITIES.contains(entity)) {
            throw invalid("Op " + index + ": entity must be item or kindSetup.", index, id);
        }
        if (id == null || id.isBlank()) {
            throw invalid("Op " + index + ": id must be a non-empty string.", index, null);
        }
        if (ENTITY_ITEM.equals(entity) && !isUuid(id)) {
            throw invalid("Op " + index + ": a map item id must be a UUID string.", index, id);
        }
        if (ENTITY_ITEM.equals(entity)) {
            // The store keys map items by uuid, so ids differing only in letter case are one item:
            // carry the canonical lower-case form so the one-op-per-id check and the edit log agree.
            id = UUID.fromString(id).toString();
        }
        JsonElement bv = o.get("baseVersion");
        if (bv == null || !bv.isJsonPrimitive() || !bv.getAsJsonPrimitive().isNumber()
                || bv.getAsDouble() != Math.rint(bv.getAsDouble()) || bv.getAsDouble() < 0
                || bv.getAsDouble() > Integer.MAX_VALUE) {
            throw invalid("Op " + index + ": baseVersion must be a whole number, 0 or more.", index, id);
        }
        int baseVersion = bv.getAsInt();
        // A create has baseVersion 0 (a new map item) or a deleted map item's version (a restore).
        if (!CREATE.equals(op) && baseVersion < 1) {
            throw invalid("Op " + index + ": an " + op + " has the stored version as baseVersion (1 or more).",
                index, id);
        }
        JsonElement data = o.get("data");
        if (data != null && !data.isJsonNull() && !data.isJsonObject()) {
            throw invalid("Op " + index + ": data must be an object.", index, id);
        }
        JsonObject d = data == null || data.isJsonNull() ? new JsonObject() : data.getAsJsonObject();
        if (DELETE.equals(op) && d.size() > 0) {
            throw invalid("Op " + index + ": a delete carries no data.", index, id);
        }
        return new EditOp(op, entity, id, baseVersion, d, index);
    }

    public JsonObject toJson() {
        JsonObject o = new JsonObject();
        o.addProperty("op", op);
        o.addProperty("entity", entity);
        o.addProperty("id", id);
        o.addProperty("baseVersion", baseVersion);
        o.add("data", data.deepCopy());
        return o;
    }

    static boolean isUuid(String s) {
        if (s.length() != 36) {
            return false;
        }
        try {
            UUID.fromString(s);
            return true;
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    private static String string(JsonElement e) {
        return e != null && e.isJsonPrimitive() && e.getAsJsonPrimitive().isString() ? e.getAsString() : null;
    }

    private static MapStudioException invalid(String message, int index, String id) {
        return new MapStudioException(Messages.CODE_INVALID, message, index, id);
    }
}
