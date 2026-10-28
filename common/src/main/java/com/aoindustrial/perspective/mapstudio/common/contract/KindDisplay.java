package com.aoindustrial.perspective.mapstudio.common.contract;

import java.util.ArrayList;
import java.util.List;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;

/**
 * The path-free projection of a kind setup (epic 3 entry 5): what a browser at any level needs to
 * draw a kind's icons and default popup, with no tag path in it (a viewer never gets paths,
 * docs/contract.md). Carried in every full {@code values.batch} as {@code kindDisplay}.
 *
 * <pre>
 * {"kindId", "comms": true|false, "kpis": [{"key", "label", "unit", "icon", "on"}],
 *  "alarms": {"on", "count", "summary"}, "link": "/pad/{item.name}" or "",
 *  "styleRule": {"type", "source", "cases": [{"label", "preset"}]} or absent,
 *  "areaTints": {"property", "tints": [{"category", "tint"}]} or absent}
 * </pre>
 *
 * Defaults as docs/kind-setup.md states them: {@code on} true, {@code count} and {@code summary} true,
 * {@code icon} false; {@code comms} is true when the setup has a comms path and does not turn it off;
 * {@code alarms.on} when it has an alarms path. A KPI is listed even when off (its row stays out of the
 * popup; the browser reads {@code on}).
 *
 * <p>Epic 3 entry 1: {@code styleRule} is the rule's path-free projection ({@link StyleRule#display}:
 * the source as {@code kpi:<key>}, {@code tag} or {@code instruments}, never a path, and an
 * expression's text stays on the Gateway), so the preview and the legend draw every case; and
 * {@code areaTints} is the area kind's category tints as stored (a property name and tint names,
 * no path), so a viewer draws an area's tint from its property.
 */
public record KindDisplay(String kindId, boolean comms, List<Kpi> kpis, boolean alarmsOn, boolean alarmsCount,
                          boolean alarmsSummary, String link, JsonObject styleRule, JsonObject areaTints) {

    /** A display with no style rule and no area tints (entry 5's shape). */
    public KindDisplay(String kindId, boolean comms, List<Kpi> kpis, boolean alarmsOn, boolean alarmsCount,
                       boolean alarmsSummary, String link) {
        this(kindId, comms, kpis, alarmsOn, alarmsCount, alarmsSummary, link, null, null);
    }

    /** One KPI's words: the key, its label (the key when none), unit, whether it is the icon value, and on. */
    public record Kpi(String key, String label, String unit, boolean icon, boolean on) {
        public JsonObject toJson() {
            JsonObject o = new JsonObject();
            o.addProperty("key", key);
            o.addProperty("label", label);
            o.addProperty("unit", unit);
            o.addProperty("icon", icon);
            o.addProperty("on", on);
            return o;
        }
    }

    /** The projection of one stored setup (a {@link KindSetup}-shaped object; malformed parts are skipped), with no kind. */
    public static KindDisplay of(String kindId, JsonObject setup) {
        return of(kindId, setup, null);
    }

    /**
     * The projection with the setup's kind, which the style rule's display needs for the presets an
     * expression may name; with no kind an expression rule lists the presets every kind has.
     */
    public static KindDisplay of(String kindId, JsonObject setup, Kind kind) {
        boolean comms = false;
        JsonElement c = setup.get("comms");
        if (c != null && c.isJsonObject() && isText(c.getAsJsonObject().get("path"))) {
            comms = bool(c.getAsJsonObject(), "on", true);
        }
        List<Kpi> kpis = new ArrayList<>();
        JsonElement k = setup.get("kpis");
        if (k != null && k.isJsonArray()) {
            for (JsonElement e : k.getAsJsonArray()) {
                if (!e.isJsonObject()) {
                    continue;
                }
                JsonObject kpi = e.getAsJsonObject();
                if (!isText(kpi.get("key")) || !isText(kpi.get("path"))) {
                    continue;
                }
                String key = kpi.get("key").getAsString();
                String label = isText(kpi.get("label")) && !kpi.get("label").getAsString().isBlank()
                    ? kpi.get("label").getAsString() : key;
                String unit = isText(kpi.get("unit")) ? kpi.get("unit").getAsString() : "";
                kpis.add(new Kpi(key, label, unit, bool(kpi, "icon", false), bool(kpi, "on", true)));
            }
        }
        boolean alarmsOn = false;
        boolean count = true;
        boolean summary = true;
        JsonElement a = setup.get("alarms");
        if (a != null && a.isJsonObject() && isText(a.getAsJsonObject().get("path"))) {
            alarmsOn = true;
            count = bool(a.getAsJsonObject(), "count", true);
            summary = bool(a.getAsJsonObject(), "summary", true);
        }
        String link = isText(setup.get("link")) ? setup.get("link").getAsString() : "";
        StyleRule rule = StyleRule.read(setup.get("styleRule"));
        JsonObject styleRule = rule == null ? null
            : rule.display(kind == null ? new Kind(kindId, kindId, "point", null, 0, List.of()) : kind);
        JsonObject areaTints = null;
        JsonElement t = setup.get("areaTints");
        if (t != null && t.isJsonObject() && isText(t.getAsJsonObject().get("property"))
                && t.getAsJsonObject().get("tints") != null && t.getAsJsonObject().get("tints").isJsonArray()) {
            areaTints = t.getAsJsonObject().deepCopy();
        }
        return new KindDisplay(kindId, comms, List.copyOf(kpis), alarmsOn, count, summary, link, styleRule, areaTints);
    }

    /** True when any part would show: comms, a KPI that is on, or alarms. */
    public boolean showsAnything() {
        if (comms || alarmsOn) {
            return true;
        }
        for (Kpi kpi : kpis) {
            if (kpi.on()) {
                return true;
            }
        }
        return false;
    }

    public JsonObject toJson() {
        JsonObject o = new JsonObject();
        o.addProperty("kindId", kindId);
        o.addProperty("comms", comms);
        JsonArray k = new JsonArray();
        kpis.forEach(kpi -> k.add(kpi.toJson()));
        o.add("kpis", k);
        JsonObject alarms = new JsonObject();
        alarms.addProperty("on", alarmsOn);
        alarms.addProperty("count", alarmsCount);
        alarms.addProperty("summary", alarmsSummary);
        o.add("alarms", alarms);
        o.addProperty("link", link);
        if (styleRule != null) {
            o.add("styleRule", styleRule.deepCopy());
        }
        if (areaTints != null) {
            o.add("areaTints", areaTints.deepCopy());
        }
        return o;
    }

    public static JsonArray toJson(List<KindDisplay> list) {
        JsonArray a = new JsonArray();
        list.forEach(d -> a.add(d.toJson()));
        return a;
    }

    private static boolean bool(JsonObject o, String key, boolean fallback) {
        JsonElement v = o.get(key);
        return v != null && v.isJsonPrimitive() && v.getAsJsonPrimitive().isBoolean() ? v.getAsBoolean() : fallback;
    }

    private static boolean isText(JsonElement e) {
        return e != null && e.isJsonPrimitive() && e.getAsJsonPrimitive().isString();
    }
}
