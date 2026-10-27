package com.aoindustrial.perspective.mapstudio.common.contract;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;

/**
 * One kind of the project's kind list (AD-4, docs/kinds-and-assets.md):
 * {@code {id, name, geometry, icon, labelRank, fields, area}}. {@code geometry} is
 * {@code point} or {@code line}; a higher {@code labelRank} keeps its label
 * longer when labels collide (default 0); {@code area: true} marks a line kind drawn
 * as a closed area, the only kind whose setup may hold {@code areaTints} (owner,
 * 2026-10-27, epic 2 story 9). Unknown keys are ignored.
 */
public record Kind(String id, String name, String geometry, String icon, int labelRank, List<FormField> fields,
                   boolean area) {

    public static final Set<String> GEOMETRIES = Set.of("point", "line");

    /** A kind that is not an area. */
    public Kind(String id, String name, String geometry, String icon, int labelRank, List<FormField> fields) {
        this(id, name, geometry, icon, labelRank, fields, false);
    }

    static Kind parse(JsonObject o) throws Rows.RowException {
        String id = Rows.id(o, "id");
        String name = Rows.requiredString(o, "name");
        String geometry = Rows.requiredString(o, "geometry");
        if (!GEOMETRIES.contains(geometry)) {
            throw new Rows.RowException("geometry must be point or line");
        }
        String icon = Rows.string(o, "icon");
        Integer rank = Rows.integer(o, "labelRank");
        List<FormField> fields = new ArrayList<>();
        JsonArray f = Rows.array(o, "fields");
        if (f != null) {
            Set<String> keys = new HashSet<>();
            for (int i = 0; i < f.size(); i++) {
                FormField field = FormField.parse(f.get(i), i);
                if (!keys.add(field.key())) {
                    throw new Rows.RowException("field " + Rows.echo(field.key()) + " appears twice");
                }
                fields.add(field);
            }
        }
        Boolean area = Rows.bool(o, "area");
        if (Boolean.TRUE.equals(area) && !"line".equals(geometry)) {
            throw new Rows.RowException("area applies to line kinds only");
        }
        return new Kind(id, name, geometry, icon == null ? "" : icon, rank == null ? 0 : rank, List.copyOf(fields),
            Boolean.TRUE.equals(area));
    }

    public JsonObject toJson() {
        JsonObject o = new JsonObject();
        o.addProperty("id", id);
        o.addProperty("name", name);
        o.addProperty("geometry", geometry);
        o.addProperty("icon", icon);
        o.addProperty("labelRank", labelRank);
        JsonArray f = new JsonArray();
        for (FormField field : fields) {
            f.add(field.toJson());
        }
        o.add("fields", f);
        if (area) {
            o.addProperty("area", true);
        }
        return o;
    }

    /** Read every row: valid kinds are kept in order, each left-out row gives one reason. */
    public static Parsed<Kind> parseList(JsonArray rows) {
        List<Kind> kept = new ArrayList<>();
        List<String> reasons = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        for (int i = 0; i < rows.size(); i++) {
            JsonElement row = rows.get(i);
            if (row == null || !row.isJsonObject()) {
                reasons.add(Rows.where(i, row) + " is not a dict");
                continue;
            }
            try {
                Kind kind = parse(row.getAsJsonObject());
                if (!ids.add(kind.id())) {
                    throw new Rows.RowException("the id appears twice");
                }
                kept.add(kind);
            } catch (Rows.RowException ex) {
                reasons.add(Rows.where(i, row) + ": " + ex.getMessage());
            }
        }
        return new Parsed<>(List.copyOf(kept), List.copyOf(reasons), rows.size());
    }

    /** The form field keys of this kind. */
    public Set<String> fieldKeys() {
        Set<String> keys = new HashSet<>();
        fields.forEach(f -> keys.add(f.key()));
        return keys;
    }

    /** The form field of this key, or null. */
    public FormField field(String key) {
        for (FormField f : fields) {
            if (f.key().equals(key)) {
                return f;
            }
        }
        return null;
    }

    public static JsonArray toJson(List<Kind> kinds) {
        JsonArray a = new JsonArray();
        kinds.forEach(k -> a.add(k.toJson()));
        return a;
    }
}
