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

    /** "The pad kind setup", for a conflict message. */
    @Override
    public String name() {
        return "The " + kindId + " kind setup";
    }
}
