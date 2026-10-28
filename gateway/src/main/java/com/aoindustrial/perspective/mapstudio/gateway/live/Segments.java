package com.aoindustrial.perspective.mapstudio.gateway.live;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;

import com.aoindustrial.perspective.mapstudio.common.contract.LiveValue;
import com.aoindustrial.perspective.mapstudio.common.contract.StyleRule;

/**
 * The aggregate line look (epic 3 entry 2; AD-11, AD-16; owner, 2026-10-27): a line whose style
 * rule is {@code {instruments: "worst"}} draws each segment from the worst of the instruments at the
 * segment's two ends. Pure: the cache hands it each instrument's grade and gets the segments back.
 *
 * <ul>
 * <li>The line's nodes, in order, are the item its start snaps to (or {@code start}), each attached
 *     instrument that measures (its kind setup names an icon KPI; plan decision 1: a line valve is on
 *     the line but bounds no segment), and the item its end snaps to (or {@code end}). A segment runs
 *     between two consecutive nodes; a snapped end item is not an instrument and counts for nothing.</li>
 * <li>A segment is {@code stale} when either end instrument is stale (comms lost, its rule's source
 *     stale, or no value in its icon KPI), the first one named in {@code reason} ("PT-1: comms lost");
 *     else its {@code preset} is the worse of the two in the order fault, warning, attention, normal
 *     ({@code dimmed} and the line patterns count as normal). Its {@code alarm} is the worse active
 *     alarm of the two (priority 1 first, then unacknowledged first), or null: the map draws it over
 *     the preset.</li>
 * <li>The line's own style slot is the worst over its segments, so its chip says the word.</li>
 * </ul>
 */
public final class Segments {

    /** The floating ends' node ids. */
    public static final String START = "start";
    public static final String END = "end";

    /** One instrument's grade: what its own batch item says, read once per batch build. */
    public record Grade(String preset, boolean stale, String reason, JsonObject alarm) {

        /** No instrument at this end (a snapped item or a floating end): counts for nothing. */
        public static final Grade NONE = new Grade(StyleRule.NORMAL, false, "", null);
    }

    /** One graded segment, as the batch carries it. */
    public record Segment(String from, String to, String preset, boolean stale, String reason, JsonObject alarm) {
        public JsonObject toJson() {
            JsonObject o = new JsonObject();
            o.addProperty("from", from);
            o.addProperty("to", to);
            o.addProperty("preset", preset);
            o.addProperty("stale", stale);
            o.addProperty("reason", reason);
            o.add("alarm", alarm == null ? com.inductiveautomation.ignition.common.gson.JsonNull.INSTANCE : alarm.deepCopy());
            return o;
        }
    }

    private Segments() {
    }

    /** The node ids in order: the start, each measuring instrument, the end. */
    public static List<String> nodes(ValuePlan.Ends ends, List<ValuePlan.Instrument> instruments) {
        List<String> nodes = new ArrayList<>();
        nodes.add(ends.start() == null ? START : ends.start());
        for (ValuePlan.Instrument i : instruments) {
            if (i.measures()) {
                nodes.add(i.id());
            }
        }
        nodes.add(ends.end() == null ? END : ends.end());
        return nodes;
    }

    /**
     * The segments between consecutive nodes, each graded from the instruments at its ends
     * ({@code grades} by instrument id; a node with no grade counts for nothing).
     */
    public static List<Segment> grade(List<String> nodes, Map<String, Grade> grades) {
        List<Segment> out = new ArrayList<>();
        for (int i = 0; i + 1 < nodes.size(); i++) {
            Grade a = grades.getOrDefault(nodes.get(i), Grade.NONE);
            Grade b = grades.getOrDefault(nodes.get(i + 1), Grade.NONE);
            out.add(worst(nodes.get(i), nodes.get(i + 1), a, b));
        }
        return out;
    }

    static Segment worst(String from, String to, Grade a, Grade b) {
        boolean stale = a.stale() || b.stale();
        String reason = a.stale() ? a.reason() : b.stale() ? b.reason() : "";
        String preset = stale ? StyleRule.NORMAL : severity(a.preset()) >= severity(b.preset()) ? a.preset() : b.preset();
        JsonObject alarm = worseAlarm(a.alarm(), b.alarm());
        return new Segment(from, to, preset, stale, reason, alarm);
    }

    /** The line's own style slot from its segments: the worst preset, stale when any segment is. */
    public static JsonObject lineStyle(List<Segment> segments) {
        String preset = StyleRule.NORMAL;
        boolean stale = false;
        String reason = "";
        for (Segment s : segments) {
            if (s.stale() && !stale) {
                stale = true;
                reason = s.reason();
            }
            if (severity(s.preset()) > severity(preset)) {
                preset = s.preset();
            }
        }
        JsonObject o = new JsonObject();
        o.addProperty("preset", stale ? StyleRule.NORMAL : preset);
        o.addProperty("stale", stale);
        o.addProperty("reason", reason);
        return o;
    }

    public static JsonArray toJson(List<Segment> segments) {
        JsonArray a = new JsonArray();
        segments.forEach(s -> a.add(s.toJson()));
        return a;
    }

    /** fault 3, warning 2, attention 1, anything else 0. */
    static int severity(String preset) {
        if (preset == null) {
            return 0;
        }
        switch (preset) {
            case "fault":
                return 3;
            case "warning":
                return 2;
            case "attention":
                return 1;
            default:
                return 0;
        }
    }

    /** The worse of two alarm summaries ({@code {active, unacked, priority}}): the lower priority number, then unacknowledged. */
    static JsonObject worseAlarm(JsonObject a, JsonObject b) {
        if (a == null) {
            return b;
        }
        if (b == null) {
            return a;
        }
        int pa = priority(a);
        int pb = priority(b);
        if (pa != pb) {
            return pa < pb ? a : b;
        }
        return count(b, "unacked") > count(a, "unacked") ? b : a;
    }

    /**
     * An instrument's grade from its own batch item (what {@code LiveValueCache.itemJson} built for
     * it): stale when its style slot is stale, its comms is lost, or its icon KPI has no fresh value;
     * the preset from a fresh style slot; the alarm from an active alarms slot.
     */
    public static Grade of(String name, JsonObject item, String iconKpi) {
        boolean stale = false;
        String reason = "";
        String preset = StyleRule.NORMAL;
        JsonElement style = item.get("style");
        if (style != null && style.isJsonObject()) {
            JsonObject s = style.getAsJsonObject();
            if (s.get("stale").getAsBoolean()) {
                stale = true;
                reason = s.get("reason").getAsString();
            } else {
                preset = s.get("preset").getAsString();
            }
        }
        JsonElement comms = item.get("comms");
        if (!stale && comms != null && comms.isJsonObject()) {
            JsonObject c = comms.getAsJsonObject();
            JsonElement v = c.get("value");
            boolean lost = c.get("stale").getAsBoolean() || (v != null && v.isJsonPrimitive() && v.getAsJsonPrimitive().isBoolean()
                && !v.getAsBoolean());
            if (lost) {
                stale = true;
                reason = c.get("stale").getAsBoolean() && !c.get("reason").getAsString().isEmpty()
                    ? c.get("reason").getAsString() : LiveValue.COMMS_LOST;
            }
        }
        JsonElement kpis = item.get("kpis");
        if (!stale && iconKpi != null && kpis != null && kpis.isJsonObject()) {
            JsonElement kpi = kpis.getAsJsonObject().get(iconKpi);
            if (kpi == null || !kpi.isJsonObject()) {
                stale = true;
                reason = "no value yet";
            } else {
                JsonObject k = kpi.getAsJsonObject();
                JsonElement v = k.get("value");
                if (k.get("stale").getAsBoolean()) {
                    stale = true;
                    reason = k.get("reason").getAsString().isEmpty() ? "stale" : k.get("reason").getAsString();
                } else if (v == null || v.isJsonNull()) {
                    stale = true;
                    reason = "no value yet";
                }
            }
        }
        JsonObject alarm = null;
        JsonElement alarms = item.get("alarms");
        if (alarms != null && alarms.isJsonObject()) {
            JsonElement v = alarms.getAsJsonObject().get("value");
            if (v != null && v.isJsonObject() && count(v.getAsJsonObject(), "active") > 0
                    && priority(v.getAsJsonObject()) >= 1 && priority(v.getAsJsonObject()) <= 3) {
                alarm = v.getAsJsonObject();
            }
        }
        return new Grade(stale ? StyleRule.NORMAL : preset, stale, stale ? name + ": " + reason : "", alarm);
    }

    private static int priority(JsonObject alarm) {
        JsonElement p = alarm.get("priority");
        int n = p != null && p.isJsonPrimitive() && p.getAsJsonPrimitive().isNumber() ? p.getAsInt() : 0;
        return n < 1 || n > 3 ? 9 : n;
    }

    private static int count(JsonObject o, String key) {
        JsonElement v = o.get(key);
        return v != null && v.isJsonPrimitive() && v.getAsJsonPrimitive().isNumber() ? v.getAsInt() : 0;
    }
}
