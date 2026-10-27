package com.aoindustrial.perspective.mapstudio.common.contract;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;

/**
 * The kind setup schema (AD-16, epic 2 story 9; docs/kind-setup.md): what a kind's map
 * items show. Every part is optional and unknown keys are refused:
 *
 * <pre>
 * {"comms": {"path", "on"},
 *  "kpis": [{"key", "label", "path", "unit", "on", "icon"}],      at most 4, keys unique, one icon at most
 *  "alarms": {"path", "count", "summary"},
 *  "link": "/pad/{item.name}",                                    text and any placeholders
 *  "popupView": {"path", "params": {name: param}},
 *  "styleRule": {"source": {"path"} | {"kpi"}, "type": "states" | "bands" | "expression", "cases", "expression"},
 *  "areaTints": {"property", "tints": [{"category", "tint"}]}}  area kinds only
 * </pre>
 *
 * <p>Tag paths are {@code {asset.path}}, {@code {asset.path}/<path>} or a full
 * {@code [provider]path}; an item override (a partial kind setup with the same parts, owner
 * 2026-10-27) takes full paths only, and its {@code {kpi}} source is not checked against a
 * setup (it may name a KPI of the kind setup, which can change). A style rule names presets,
 * area tints name tints ({@link StylePresets}); never a colour code. Pure: the Designer, the
 * Gateway and later the Kinds screen share these rules. The value is stored as sent.
 */
public final class KindSetup {

    public static final int MAX_KPIS = 4;
    public static final List<String> PARTS =
        List.of("comms", "kpis", "alarms", "link", "popupView", "styleRule", "areaTints");
    public static final List<String> RULE_TYPES = List.of("states", "bands", "expression");

    private static final Set<String> COMMS = Set.of("path", "on");
    private static final Set<String> KPI = Set.of("key", "label", "path", "unit", "on", "icon");
    private static final Set<String> ALARMS = Set.of("path", "count", "summary");
    private static final Set<String> POPUP_VIEW = Set.of("path", "params");
    private static final Set<String> RULE = Set.of("source", "type", "cases", "expression");
    private static final Set<String> STATE_CASE = Set.of("value", "preset");
    private static final Set<String> BAND_CASE = Set.of("min", "max", "preset");
    private static final Set<String> AREA_TINTS = Set.of("property", "tints");
    private static final Set<String> TINT = Set.of("category", "tint");

    private KindSetup() {
    }

    /**
     * Check a kind setup ({@code override} false) or an item's overrides ({@code override} true)
     * against its kind; returns a copy of the value as sent.
     *
     * @throws InvalidValue naming the part at fault, in plain words
     */
    public static JsonObject parse(JsonElement value, Kind kind, boolean override) {
        String what = override ? "overrides" : "the kind setup";
        if (value == null || !value.isJsonObject()) {
            throw new InvalidValue(what + " must be an object.");
        }
        JsonObject o = value.getAsJsonObject();
        for (String key : o.keySet()) {
            if (!PARTS.contains(key)) {
                throw new InvalidValue(Rows.echo(key) + " is not a part of " + what + "; the parts are "
                    + String.join(", ", PARTS) + ".");
            }
        }
        boolean relative = !override;
        Set<String> kpiKeys = new HashSet<>();
        for (Map.Entry<String, JsonElement> part : o.entrySet()) {
            JsonElement v = part.getValue();
            switch (part.getKey()) {
                case "comms" -> {
                    JsonObject c = object(v, "comms", COMMS);
                    tagPath(c, "path", "comms.path", relative);
                    bool(c, "on", "comms.on");
                }
                case "kpis" -> kpiKeys.addAll(kpis(v, relative));
                case "alarms" -> {
                    JsonObject a = object(v, "alarms", ALARMS);
                    tagPath(a, "path", "alarms.path", relative);
                    bool(a, "count", "alarms.count");
                    bool(a, "summary", "alarms.summary");
                }
                case "link" -> {
                    String link = text(v, "link", true);
                    // A Perspective page path, as for Setup.alarmPage: never a scheme or another host.
                    if (!link.startsWith("/") || link.startsWith("//") || link.startsWith("/\\")) {
                        throw new InvalidValue("link is a Perspective page path starting with one /"
                            + " (/pad/{item.name}), not " + Rows.echo(link) + ".");
                    }
                    try {
                        Placeholders.checkTemplate(link, kind.fieldKeys());
                    } catch (InvalidValue ex) {
                        throw ex.at("link");
                    }
                }
                case "popupView" -> popupView(v, kind);
                case "areaTints" -> areaTints(v, kind);
                default -> {
                    // styleRule: checked below, once the KPI keys are known.
                }
            }
        }
        if (o.has("styleRule")) {
            styleRule(o.get("styleRule"), kind, override, kpiKeys, "styleRule");
        }
        return o.deepCopy();
    }

    private static Set<String> kpis(JsonElement v, boolean relative) {
        if (!v.isJsonArray()) {
            throw new InvalidValue("kpis must be a list.");
        }
        JsonArray a = v.getAsJsonArray();
        if (a.size() > MAX_KPIS) {
            throw new InvalidValue("kpis has " + a.size() + " values; at most " + MAX_KPIS + " are shown.");
        }
        Set<String> keys = new HashSet<>();
        int icons = 0;
        for (int i = 0; i < a.size(); i++) {
            String where = "kpis[" + i + "]";
            JsonObject k = object(a.get(i), where, KPI);
            String key = id(k, "key", where + ".key");
            if (!keys.add(key)) {
                throw new InvalidValue(where + ".key: " + Rows.echo(key) + " is used by another KPI; keys are unique.");
            }
            optionalText(k, "label", where + ".label");
            tagPath(k, "path", where + ".path", relative);
            optionalText(k, "unit", where + ".unit");
            bool(k, "on", where + ".on");
            if (Boolean.TRUE.equals(bool(k, "icon", where + ".icon"))) {
                icons++;
            }
        }
        if (icons > 1) {
            throw new InvalidValue("kpis: " + icons + " KPIs have icon true; at most one KPI is shown on the icon.");
        }
        return keys;
    }

    private static void popupView(JsonElement v, Kind kind) {
        JsonObject p = object(v, "popupView", POPUP_VIEW);
        if (!p.has("path")) {
            throw new InvalidValue("popupView.path: the popup view needs a view path such as Popups/PadDetails.");
        }
        text(p.get("path"), "popupView.path", true);
        JsonElement params = p.get("params");
        if (params == null || params.isJsonNull()) {
            return;
        }
        if (!params.isJsonObject()) {
            throw new InvalidValue("popupView.params must be an object of name and value.");
        }
        for (Map.Entry<String, JsonElement> param : params.getAsJsonObject().entrySet()) {
            String where = "popupView.params";
            JsonElement value = param.getValue();
            if (!isString(value)) {
                throw new InvalidValue(where + "." + Rows.echo(param.getKey()) + " must be text: a literal, one"
                    + " placeholder, or {asset.path}/ and a tag path.");
            }
            try {
                Placeholders.checkParam(param.getKey(), value.getAsString(), kind.fieldKeys());
            } catch (InvalidValue ex) {
                throw new InvalidValue(where + "." + ex.getMessage());
            }
        }
    }

    private static void styleRule(JsonElement v, Kind kind, boolean override, Set<String> kpiKeys, String where) {
        JsonObject r = object(v, where, RULE);
        String type = r.has("type") && isString(r.get("type")) ? r.get("type").getAsString() : null;
        if (type == null || !RULE_TYPES.contains(type)) {
            throw new InvalidValue(where + ".type must be " + String.join(", ", RULE_TYPES) + ".");
        }
        if (r.has("source")) {
            source(r.get("source"), override, kpiKeys, where + ".source");
        } else if (!"expression".equals(type)) {
            throw new InvalidValue(where + ".source: a " + type + " rule needs a source, {path} or {kpi}.");
        }
        if ("expression".equals(type)) {
            if (r.has("cases")) {
                throw new InvalidValue(where + ": an expression rule has no cases.");
            }
            if (!r.has("expression")) {
                throw new InvalidValue(where + ".expression: an expression rule needs its expression.");
            }
            text(r.get("expression"), where + ".expression", true);
            return;
        }
        if (r.has("expression")) {
            throw new InvalidValue(where + ": a " + type + " rule has cases, not an expression.");
        }
        JsonElement c = r.get("cases");
        if (c == null || !c.isJsonArray() || c.getAsJsonArray().isEmpty()) {
            throw new InvalidValue(where + ".cases: a " + type + " rule needs a non-empty list of cases.");
        }
        if ("states".equals(type)) {
            states(c.getAsJsonArray(), kind, where + ".cases");
        } else {
            bands(c.getAsJsonArray(), kind, where + ".cases");
        }
    }

    /** {@code {path}} or {@code {kpi}}: exactly one. */
    private static void source(JsonElement v, boolean override, Set<String> kpiKeys, String where) {
        if (v == null || !v.isJsonObject() || v.getAsJsonObject().size() != 1) {
            throw new InvalidValue(where + " must be {\"path\": tag path} or {\"kpi\": KPI key}.");
        }
        JsonObject s = v.getAsJsonObject();
        if (s.has("path")) {
            tagPath(s, "path", where + ".path", !override);
            return;
        }
        if (!s.has("kpi")) {
            throw new InvalidValue(where + " must be {\"path\": tag path} or {\"kpi\": KPI key}.");
        }
        String key = text(s.get("kpi"), where + ".kpi", true);
        if (!override && !kpiKeys.contains(key)) {
            throw new InvalidValue(where + ".kpi: " + Rows.echo(key) + " is not the key of one of this setup's kpis.");
        }
    }

    private static void states(JsonArray cases, Kind kind, String where) {
        List<JsonElement> values = new ArrayList<>();
        for (int i = 0; i < cases.size(); i++) {
            String at = where + "[" + i + "]";
            JsonObject c = object(cases.get(i), at, STATE_CASE);
            JsonElement value = c.get("value");
            if (value == null || !value.isJsonPrimitive()) {
                throw new InvalidValue(at + ".value must be text, a number, or true or false.");
            }
            if (values.contains(value)) {
                throw new InvalidValue(at + ".value: " + Rows.echo(value.getAsString())
                    + " has another case; each value has one case.");
            }
            values.add(value);
            preset(c, kind, at);
        }
    }

    private static void bands(JsonArray cases, Kind kind, String where) {
        Double previousMax = null;
        for (int i = 0; i < cases.size(); i++) {
            String at = where + "[" + i + "]";
            JsonObject c = object(cases.get(i), at, BAND_CASE);
            Double min = number(c, "min", at + ".min");
            Double max = number(c, "max", at + ".max");
            if (min == null && i > 0) {
                throw new InvalidValue(at + ".min: only the first band may be open below (min null).");
            }
            if (max == null && i < cases.size() - 1) {
                throw new InvalidValue(at + ".max: only the last band may be open above (max null).");
            }
            if (min != null && max != null && min >= max) {
                throw new InvalidValue(at + ": min must be below max.");
            }
            if (i > 0 && min < previousMax) {
                throw new InvalidValue(at + ": bands are in order and do not overlap; this band starts at " + num(min)
                    + ", below the end of the band before (" + num(previousMax) + ").");
            }
            previousMax = max;
            preset(c, kind, at);
        }
    }

    private static void preset(JsonObject c, Kind kind, String at) {
        String preset = text(c.get("preset"), at + ".preset", true);
        try {
            StylePresets.checkPreset(preset, kind);
        } catch (InvalidValue ex) {
            throw ex.at(at + ".preset");
        }
    }

    private static void areaTints(JsonElement v, Kind kind) {
        if (!kind.area()) {
            throw new InvalidValue("areaTints: " + Rows.echo(kind.id()) + " is not an area kind; only a line kind with"
                + " area true in the kind list takes areaTints.");
        }
        JsonObject a = object(v, "areaTints", AREA_TINTS);
        String property = text(a.get("property"), "areaTints.property", true);
        if (kind.field(property) == null) {
            throw new InvalidValue("areaTints.property: " + Rows.echo(property) + " is not a form field of "
                + Rows.echo(kind.id()) + ".");
        }
        JsonElement t = a.get("tints");
        if (t == null || !t.isJsonArray() || t.getAsJsonArray().isEmpty()) {
            throw new InvalidValue("areaTints.tints: a non-empty list of {category, tint} is needed.");
        }
        Set<String> categories = new HashSet<>();
        JsonArray tints = t.getAsJsonArray();
        for (int i = 0; i < tints.size(); i++) {
            String at = "areaTints.tints[" + i + "]";
            JsonObject tint = object(tints.get(i), at, TINT);
            String category = text(tint.get("category"), at + ".category", false);
            if (!categories.add(category)) {
                throw new InvalidValue(at + ".category: " + Rows.echo(category) + " has another tint; each category"
                    + " has one.");
            }
            String name = text(tint.get("tint"), at + ".tint", true);
            try {
                StylePresets.checkTint(name);
            } catch (InvalidValue ex) {
                throw ex.at(at + ".tint");
            }
        }
    }

    // Small readers. Each throws InvalidValue naming where.

    private static JsonObject object(JsonElement v, String where, Set<String> keys) {
        if (v == null || !v.isJsonObject()) {
            throw new InvalidValue(where + " must be an object.");
        }
        JsonObject o = v.getAsJsonObject();
        for (String key : o.keySet()) {
            if (!keys.contains(key)) {
                throw new InvalidValue(where + ": " + Rows.echo(key) + " is not a key here; the keys are "
                    + String.join(", ", keys.stream().sorted().toList()) + ".");
            }
        }
        return o;
    }

    private static String text(JsonElement v, String where, boolean nonEmpty) {
        if (!isString(v)) {
            throw new InvalidValue(where + " must be text.");
        }
        String s = v.getAsString();
        if (nonEmpty && s.isBlank()) {
            throw new InvalidValue(where + " must not be empty.");
        }
        return s;
    }

    private static void optionalText(JsonObject o, String key, String where) {
        JsonElement v = o.get(key);
        if (v != null && !isString(v)) {
            throw new InvalidValue(where + " must be text.");
        }
    }

    private static String id(JsonObject o, String key, String where) {
        String s = text(o.get(key), where, true);
        if (s.length() > Rows.MAX_ID) {
            throw new InvalidValue(where + " is longer than " + Rows.MAX_ID + " characters.");
        }
        return s;
    }

    private static Boolean bool(JsonObject o, String key, String where) {
        JsonElement v = o.get(key);
        if (v == null) {
            return null;
        }
        if (!v.isJsonPrimitive() || !v.getAsJsonPrimitive().isBoolean()) {
            throw new InvalidValue(where + " must be true or false.");
        }
        return v.getAsBoolean();
    }

    private static Double number(JsonObject o, String key, String where) {
        JsonElement v = o.get(key);
        if (v == null || v.isJsonNull()) {
            return null;
        }
        if (!v.isJsonPrimitive() || !v.getAsJsonPrimitive().isNumber()) {
            throw new InvalidValue(where + " must be a number or null.");
        }
        double d = v.getAsDouble();
        if (Double.isNaN(d) || Double.isInfinite(d)) {
            throw new InvalidValue(where + " must be a finite number.");
        }
        return d;
    }

    private static void tagPath(JsonObject o, String key, String where, boolean relative) {
        JsonElement v = o.get(key);
        if (v == null) {
            throw new InvalidValue(where + ": a tag path is needed.");
        }
        if (!isString(v)) {
            throw new InvalidValue(where + " must be text, a tag path.");
        }
        try {
            Placeholders.checkTagPath(v.getAsString(), relative);
        } catch (InvalidValue ex) {
            throw ex.at(where);
        }
    }

    private static String num(double d) {
        return d == Math.rint(d) && Math.abs(d) < 1e15 ? Long.toString((long) d) : Double.toString(d);
    }

    private static boolean isString(JsonElement e) {
        return e != null && e.isJsonPrimitive() && e.getAsJsonPrimitive().isString();
    }
}
