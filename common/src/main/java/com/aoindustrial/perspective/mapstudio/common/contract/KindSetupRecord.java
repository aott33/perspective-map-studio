package com.aoindustrial.perspective.mapstudio.common.contract;

import com.inductiveautomation.ignition.common.gson.JsonObject;

/**
 * The stored kind setup of one kind of a project (AD-16, epic 2 story 9):
 * {@code {kindId, setup, version, deleted}}. One row per project and kind id, versioned
 * and tombstoned like a map item; {@code setup} is checked by {@link KindSetup#parse}.
 */
public record KindSetupRecord(String kindId, JsonObject setup, int version, boolean deleted) implements StoredRecord {

    /** The fields a kind setup op's {@code data} carries: the record minus kindId, version and deleted. */
    public static final String SETUP = "setup";

    @Override
    public JsonObject toJson() {
        JsonObject o = new JsonObject();
        o.addProperty("kindId", kindId);
        o.add("setup", setup.deepCopy());
        o.addProperty("version", version);
        o.addProperty("deleted", deleted);
        return o;
    }

    /**
     * "The pad kind setup", by kind id. Conflict messages do not use it: they name a kind setup
     * by its kind's display name through {@code ConflictReport.kindSetupName} (epic 2 story 12).
     * This is the id-based fallback for other callers.
     */
    @Override
    public String name() {
        return "The " + kindId + " kind setup";
    }
}
