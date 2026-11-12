package com.aoindustrial.perspective.mapstudio.common.contract;

import java.util.List;

import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;

/**
 * One stored setting of a project (epic-editing entry 19b, R27): {@code {id, system, labels, version,
 * deleted}}. The one id is {@code units}, Edit mode's override of the project setup's units: {@code system}
 * is {@code auto}, {@code metric} or {@code us}, {@code labels} is {@code short} or {@code long}. It is
 * versioned and tombstoned like a kind setup; a deleted one is no override (the setup's units apply again).
 * The map store keeps it in the project's row, {@code mapstudio_project.settings}, since schema 4.
 */
public record SettingsRecord(String id, String system, String labels, int version, boolean deleted)
        implements StoredRecord {

    /** The one settings id. */
    public static final String UNITS = "units";

    public static final String SYSTEM = "system";
    public static final String LABELS = "labels";

    /** The systems an override may name: the project setup's three. */
    public static final List<String> SYSTEMS = Setup.UNITS;

    /** How a distance's unit reads: a symbol or a word. */
    public static final List<String> LABEL_STYLES = List.of("short", "long");

    /** A units op's {@code data}: exactly {@code system} and {@code labels}. */
    public record Values(String system, String labels) {
    }

    /**
     * Read a units create's or update's {@code data}.
     *
     * @throws InvalidValue in plain words, naming the allowed values
     */
    public static Values parse(JsonObject data) {
        for (String key : data.keySet()) {
            if (!SYSTEM.equals(key) && !LABELS.equals(key)) {
                throw new InvalidValue("Unknown field " + Rows.echo(key) + " in the units data; a units op carries"
                    + " system and labels and nothing else.");
            }
        }
        String system = text(data.get(SYSTEM));
        if (system == null || !SYSTEMS.contains(system)) {
            throw new InvalidValue("system must be one of " + String.join(", ", SYSTEMS));
        }
        String labels = text(data.get(LABELS));
        if (labels == null || !LABEL_STYLES.contains(labels)) {
            throw new InvalidValue("labels must be one of " + String.join(", ", LABEL_STYLES));
        }
        return new Values(system, labels);
    }

    /** The record as {@code map.changed} and a conflict send it. */
    @Override
    public JsonObject toJson() {
        JsonObject o = new JsonObject();
        o.addProperty("id", id);
        o.addProperty(SYSTEM, system);
        o.addProperty(LABELS, labels);
        o.addProperty("version", version);
        o.addProperty("deleted", deleted);
        return o;
    }

    /** {@code {system, labels}}: what an edit record's before and after hold. */
    public JsonObject values() {
        JsonObject o = new JsonObject();
        o.addProperty(SYSTEM, system);
        o.addProperty(LABELS, labels);
        return o;
    }

    /** A live record as {@code map.load.reply}'s {@code settings} carries it: {@code {id, system, labels, version}}. */
    public JsonObject liveJson() {
        JsonObject o = toJson();
        o.remove("deleted");
        return o;
    }

    /** The value as the project row's jsonb keeps it under its id: {@code {system, labels, version, deleted}}. */
    public JsonObject storedJson() {
        JsonObject o = toJson();
        o.remove("id");
        return o;
    }

    /** Read what {@link #storedJson} wrote. */
    public static SettingsRecord fromStored(String id, JsonObject stored) {
        return new SettingsRecord(id, stored.get(SYSTEM).getAsString(), stored.get(LABELS).getAsString(),
            stored.get("version").getAsInt(), stored.get("deleted").getAsBoolean());
    }

    @Override
    public String name() {
        return "The units setting";
    }

    private static String text(JsonElement e) {
        return e != null && e.isJsonPrimitive() && e.getAsJsonPrimitive().isString() ? e.getAsString() : null;
    }
}
