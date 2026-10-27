package com.aoindustrial.perspective.mapstudio.common.contract;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;

/**
 * One form field of a kind (docs/kinds-and-assets.md): a property of the kind's
 * map items. {@code type} is {@code text}, {@code number}, {@code integer},
 * {@code boolean} or {@code choice}; a {@code choice} field names its
 * {@code choices}. Stories 9 and epic-editing use these to check and edit
 * {@code properties}.
 */
public record FormField(String key, String label, String type, boolean required, List<String> choices) {

    public static final Set<String> TYPES = Set.of("text", "number", "integer", "boolean", "choice");

    static FormField parse(JsonElement element, int index) throws Rows.RowException {
        if (element == null || !element.isJsonObject()) {
            throw new Rows.RowException("field " + (index + 1) + " is not a dict");
        }
        JsonObject o = element.getAsJsonObject();
        String key;
        try {
            key = Rows.id(o, "key");
        } catch (Rows.RowException ex) {
            throw new Rows.RowException("field " + (index + 1) + ": " + ex.getMessage());
        }
        try {
            String label = Rows.string(o, "label");
            String type = Rows.requiredString(o, "type");
            if (!TYPES.contains(type)) {
                throw new Rows.RowException("type must be text, number, integer, boolean or choice");
            }
            Boolean required = Rows.bool(o, "required");
            List<String> choices = List.of();
            JsonArray c = Rows.array(o, "choices");
            if ("choice".equals(type)) {
                if (c == null || c.isEmpty()) {
                    throw new Rows.RowException("a choice field needs choices");
                }
                List<String> list = new ArrayList<>();
                for (JsonElement e : c) {
                    if (!e.isJsonPrimitive() || !e.getAsJsonPrimitive().isString()) {
                        throw new Rows.RowException("choices must be text");
                    }
                    list.add(e.getAsString());
                }
                choices = List.copyOf(list);
            }
            return new FormField(key, label == null || label.isBlank() ? key : label, type,
                required != null && required, choices);
        } catch (Rows.RowException ex) {
            throw new Rows.RowException("field " + Rows.echo(key) + ": " + ex.getMessage());
        }
    }

    public JsonObject toJson() {
        JsonObject o = new JsonObject();
        o.addProperty("key", key);
        o.addProperty("label", label);
        o.addProperty("type", type);
        o.addProperty("required", required);
        if ("choice".equals(type)) {
            JsonArray c = new JsonArray();
            choices.forEach(c::add);
            o.add("choices", c);
        }
        return o;
    }
}
