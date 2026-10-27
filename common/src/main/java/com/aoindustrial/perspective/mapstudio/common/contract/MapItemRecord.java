package com.aoindustrial.perspective.mapstudio.common.contract;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.Set;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonNull;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonPrimitive;

import com.aoindustrial.perspective.mapstudio.common.Messages;

/**
 * The stored map item record (AD-20), closed and typed:
 * {@code {id, kind, name, geometry, properties, assetId, overrides, ends, version, deleted}}.
 * Derived fields (base path, unlinked reason, unknown kind) are never stored.
 *
 * <p>Geometry is GeoJSON (Point or LineString), longitude first, WGS 84, rounded
 * to 6 decimals when an op is read. The write service checks and normalises every
 * record it saves against the project's kind list ({@link ItemCheck}, epic 2 story 9).
 */
public record MapItemRecord(
    String id,
    String kind,
    String name,
    JsonObject geometry,
    JsonObject properties,
    String assetId,
    JsonObject overrides,
    JsonElement ends,
    int version,
    boolean deleted) implements StoredRecord {

    /** The fields an op's {@code data} may carry (the record minus id, version and deleted). */
    public static final Set<String> DATA_FIELDS =
        Set.of("kind", "name", "geometry", "properties", "assetId", "overrides", "ends");

    @Override
    public JsonObject toJson() {
        JsonObject o = new JsonObject();
        o.addProperty("id", id);
        o.addProperty("kind", kind);
        o.addProperty("name", name);
        o.add("geometry", geometry.deepCopy());
        o.add("properties", properties.deepCopy());
        if (assetId == null) {
            o.add("assetId", JsonNull.INSTANCE);
        } else {
            o.addProperty("assetId", assetId);
        }
        o.add("overrides", overrides.deepCopy());
        o.add("ends", ends == null ? JsonNull.INSTANCE : ends.deepCopy());
        o.addProperty("version", version);
        o.addProperty("deleted", deleted);
        return o;
    }

    /**
     * A new record from a create op's data at version 1.
     *
     * @throws MapStudioException {@code invalid} naming the op when a field is missing or malformed
     */
    public static MapItemRecord fromCreate(String id, JsonObject data, int opIndex) {
        checkFields(data, id, opIndex);
        if (!data.has("kind")) {
            throw invalid("A new map item needs a kind.", id, opIndex);
        }
        if (!data.has("geometry")) {
            throw invalid("A new map item needs a geometry.", id, opIndex);
        }
        MapItemRecord empty = new MapItemRecord(id, "", "", new JsonObject(), new JsonObject(), null,
            new JsonObject(), JsonNull.INSTANCE, 0, false);
        MapItemRecord merged = empty.merge(data, opIndex);
        return new MapItemRecord(id, merged.kind, merged.name, merged.geometry, merged.properties,
            merged.assetId, merged.overrides, merged.ends, 1, false);
    }

    /**
     * This record with the top-level fields {@code data} carries replaced (owner decision,
     * 2026-10-26: an update replaces only the fields it carries) and the version bumped.
     */
    public MapItemRecord updatedWith(JsonObject data, int opIndex) {
        checkFields(data, id, opIndex);
        if (data.size() == 0) {
            throw invalid("An update needs at least one field to change.", id, opIndex);
        }
        MapItemRecord merged = merge(data, opIndex);
        return new MapItemRecord(id, merged.kind, merged.name, merged.geometry, merged.properties,
            merged.assetId, merged.overrides, merged.ends, version + 1, deleted);
    }

    private MapItemRecord merge(JsonObject data, int opIndex) {
        String k = kind;
        String n = name;
        JsonObject g = geometry;
        JsonObject p = properties;
        String a = assetId;
        JsonObject ov = overrides;
        JsonElement e = ends;
        for (Map.Entry<String, JsonElement> field : data.entrySet()) {
            JsonElement value = field.getValue();
            switch (field.getKey()) {
                case "kind" -> {
                    if (!isString(value) || value.getAsString().isBlank()) {
                        throw invalid("kind must be a non-empty string.", id, opIndex);
                    }
                    k = value.getAsString();
                }
                case "name" -> {
                    if (!isString(value)) {
                        throw invalid("name must be a string.", id, opIndex);
                    }
                    n = value.getAsString();
                }
                case "geometry" -> g = geometry(value, id, opIndex);
                case "properties" -> {
                    if (!value.isJsonObject()) {
                        throw invalid("properties must be an object.", id, opIndex);
                    }
                    p = value.getAsJsonObject().deepCopy();
                }
                case "assetId" -> {
                    if (value.isJsonNull()) {
                        a = null;
                    } else if (isString(value)) {
                        a = value.getAsString();
                    } else {
                        throw invalid("assetId must be a string or null.", id, opIndex);
                    }
                }
                case "overrides" -> {
                    if (!value.isJsonObject()) {
                        throw invalid("overrides must be an object.", id, opIndex);
                    }
                    ov = value.getAsJsonObject().deepCopy();
                }
                case "ends" -> {
                    if (!value.isJsonNull() && !value.isJsonObject()) {
                        throw invalid("ends must be an object or null.", id, opIndex);
                    }
                    e = value.deepCopy();
                }
                default -> throw invalid("Unknown field " + field.getKey() + ".", id, opIndex);
            }
        }
        return new MapItemRecord(id, k, n, g, p, a, ov, e, version, deleted);
    }

    private static void checkFields(JsonObject data, String id, int opIndex) {
        for (String key : data.keySet()) {
            if (!DATA_FIELDS.contains(key)) {
                throw invalid("Unknown field " + key + " in the map item data.", id, opIndex);
            }
        }
    }

    /** A Point or LineString with longitude and latitude in range, rounded to 6 decimals. */
    static JsonObject geometry(JsonElement value, String id, int opIndex) {
        if (value == null || !value.isJsonObject()) {
            throw invalid("geometry must be a GeoJSON object.", id, opIndex);
        }
        JsonObject g = value.getAsJsonObject();
        JsonElement type = g.get("type");
        JsonElement coords = g.get("coordinates");
        if (!isString(type) || coords == null || !coords.isJsonArray()) {
            throw invalid("geometry needs a type and coordinates.", id, opIndex);
        }
        JsonObject out = new JsonObject();
        out.addProperty("type", type.getAsString());
        switch (type.getAsString()) {
            case "Point" -> out.add("coordinates", position(coords, id, opIndex));
            case "LineString" -> {
                JsonArray line = coords.getAsJsonArray();
                if (line.size() < 2) {
                    throw invalid("A LineString needs at least two positions.", id, opIndex);
                }
                JsonArray rounded = new JsonArray();
                for (JsonElement p : line) {
                    rounded.add(position(p, id, opIndex));
                }
                out.add("coordinates", rounded);
            }
            default -> throw invalid("geometry type must be Point or LineString, not " + type.getAsString() + ".",
                id, opIndex);
        }
        return out;
    }

    private static JsonArray position(JsonElement p, String id, int opIndex) {
        if (p == null || !p.isJsonArray() || p.getAsJsonArray().size() != 2) {
            throw invalid("A position is [longitude, latitude].", id, opIndex);
        }
        JsonArray a = p.getAsJsonArray();
        double lng = number(a.get(0), id, opIndex);
        double lat = number(a.get(1), id, opIndex);
        if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
            throw invalid("A position is out of range (longitude -180 to 180, latitude -90 to 90).", id, opIndex);
        }
        JsonArray out = new JsonArray();
        out.add(new JsonPrimitive(round6(lng)));
        out.add(new JsonPrimitive(round6(lat)));
        return out;
    }

    private static double number(JsonElement e, String id, int opIndex) {
        if (e == null || !e.isJsonPrimitive() || !e.getAsJsonPrimitive().isNumber()) {
            throw invalid("Coordinates must be numbers.", id, opIndex);
        }
        double d = e.getAsDouble();
        if (Double.isNaN(d) || Double.isInfinite(d)) {
            throw invalid("Coordinates must be finite numbers.", id, opIndex);
        }
        return d;
    }

    /** Rounded half up to 6 decimals (about 0.1 m), the stored precision. */
    static double round6(double d) {
        return BigDecimal.valueOf(d).setScale(6, RoundingMode.HALF_UP).doubleValue();
    }

    private static boolean isString(JsonElement e) {
        return e != null && e.isJsonPrimitive() && e.getAsJsonPrimitive().isString();
    }

    private static MapStudioException invalid(String message, String id, int opIndex) {
        return new MapStudioException(Messages.CODE_INVALID, "Op " + opIndex + " (" + id + "): " + message,
            opIndex, id);
    }
}
