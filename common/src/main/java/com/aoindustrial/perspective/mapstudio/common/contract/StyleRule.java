package com.aoindustrial.perspective.mapstudio.common.contract;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonPrimitive;

/**
 * A kind setup's style rule as the Gateway works it out (AD-16, epic 3 entry 1): the source
 * ({@code {path}}, {@code {kpi}} or the instruments), the type, and the cases of a States or
 * Bands rule, with the pure evaluation of those two ({@link #preset}); an expression rule's text
 * is evaluated on the Gateway with Ignition's expression parser ({@code gateway/.../live/StyleExpressions}),
 * which this class does not reach (the Designer loads it too). Read from a stored, already
 * checked rule ({@link KindSetup}); a malformed rule reads as null and draws nothing.
 *
 * <p>The display projection ({@link #display}) is what a viewer may see: the type, the source
 * without its path ({@code kpi:<key>}, {@code tag} or {@code instruments}) and one
 * {@code {label, preset}} per case; an expression's cases are the preset names quoted in its text.
 */
public final class StyleRule {

    public static final String STATES = "states";
    public static final String BANDS = "bands";
    public static final String EXPRESSION = "expression";
    public static final String NORMAL = "normal";

    /** A States case: the value and the preset it picks. */
    public record State(JsonPrimitive value, String preset) {
    }

    /** A Bands case: {@code min <= value < max}, either end open when null. */
    public record Band(Double min, Double max, String preset) {
        String label() {
            if (min == null && max == null) {
                return "any value";
            }
            if (min == null) {
                return "below " + num(max);
            }
            if (max == null) {
                return num(min) + " and above";
            }
            return num(min) + " to " + num(max);
        }
    }

    /** What a States or Bands rule says for one value: the preset, and a problem in words when the value cannot be read. */
    public record Outcome(String preset, String problem) {
        static Outcome of(String preset) {
            return new Outcome(preset, null);
        }
    }

    private static final Pattern QUOTED = Pattern.compile("'([a-z]+)'|\"([a-z]+)\"");

    private final String type;
    private final String kpi;
    private final String path;
    private final boolean instruments;
    private final String expression;
    private final List<State> states;
    private final List<Band> bands;

    private StyleRule(String type, String kpi, String path, boolean instruments, String expression, List<State> states,
                      List<Band> bands) {
        this.type = type;
        this.kpi = kpi;
        this.path = path;
        this.instruments = instruments;
        this.expression = expression;
        this.states = states;
        this.bands = bands;
    }

    /** The rule a stored {@code styleRule} holds, or null when it is absent or malformed. */
    public static StyleRule read(JsonElement v) {
        if (v == null || !v.isJsonObject()) {
            return null;
        }
        JsonObject r = v.getAsJsonObject();
        JsonElement src = r.get("source");
        String kpi = null;
        String path = null;
        boolean instruments = false;
        if (src != null && src.isJsonObject()) {
            JsonObject s = src.getAsJsonObject();
            if (s.has(KindSetup.INSTRUMENTS)) {
                return new StyleRule(null, null, null, true, null, List.of(), List.of());
            }
            kpi = text(s, "kpi");
            path = text(s, "path");
        }
        String type = text(r, "type");
        if (type == null) {
            return null;
        }
        switch (type) {
            case STATES -> {
                List<State> states = new ArrayList<>();
                for (JsonObject c : cases(r)) {
                    JsonElement value = c.get("value");
                    String preset = text(c, "preset");
                    if (value != null && value.isJsonPrimitive() && preset != null) {
                        states.add(new State(value.getAsJsonPrimitive(), preset));
                    }
                }
                return new StyleRule(type, kpi, path, false, null, List.copyOf(states), List.of());
            }
            case BANDS -> {
                List<Band> bands = new ArrayList<>();
                for (JsonObject c : cases(r)) {
                    String preset = text(c, "preset");
                    if (preset != null) {
                        bands.add(new Band(number(c, "min"), number(c, "max"), preset));
                    }
                }
                return new StyleRule(type, kpi, path, false, null, List.of(), List.copyOf(bands));
            }
            case EXPRESSION -> {
                String expression = text(r, "expression");
                if (expression == null) {
                    return null;
                }
                return new StyleRule(type, kpi, path, false, expression, List.of(), List.of());
            }
            default -> {
                return null;
            }
        }
    }

    /** {@code states}, {@code bands} or {@code expression}; null for the instruments source. */
    public String type() {
        return type;
    }

    /** The KPI key the source names, or null. */
    public String kpi() {
        return kpi;
    }

    /** The tag path the source names (asset-relative or full), or null. */
    public String path() {
        return path;
    }

    /** True for {@code {"instruments": "worst"}} (entry 2 draws it; nothing is subscribed here). */
    public boolean instruments() {
        return instruments;
    }

    /** The expression text, or null. */
    public String expression() {
        return expression;
    }

    public List<State> states() {
        return states;
    }

    public List<Band> bands() {
        return bands;
    }

    /**
     * The preset a States or Bands rule picks for a value: a state matches by equality (a number
     * against a number, text against text, or a text holding a number against a number); a band
     * holds {@code min <= value < max}; no case gives {@code normal}; a band rule with a value that
     * is not a number gives {@code normal} with a problem. Null for an expression rule.
     */
    public Outcome preset(JsonElement value) {
        if (STATES.equals(type)) {
            for (State s : states) {
                if (matches(s.value(), value)) {
                    return Outcome.of(s.preset());
                }
            }
            return Outcome.of(NORMAL);
        }
        if (BANDS.equals(type)) {
            Double d = asNumber(value);
            if (d == null) {
                return new Outcome(NORMAL, value == null || value.isJsonNull() ? null
                    : "the value is not a number, so no band holds it");
            }
            for (Band b : bands) {
                if ((b.min() == null || d >= b.min()) && (b.max() == null || d < b.max())) {
                    return Outcome.of(b.preset());
                }
            }
            return Outcome.of(NORMAL);
        }
        return null;
    }

    /** The preset names quoted in an expression's text that are presets of {@code kind}, in order, each once. */
    public static List<String> presetsIn(String expression, Kind kind) {
        Set<String> out = new LinkedHashSet<>();
        if (expression == null) {
            return List.of();
        }
        List<String> allowed = StylePresets.presetsFor(kind);
        Matcher m = QUOTED.matcher(expression);
        while (m.find()) {
            String name = m.group(1) != null ? m.group(1) : m.group(2);
            if (allowed.contains(name)) {
                out.add(name);
            }
        }
        return List.copyOf(out);
    }

    /**
     * The path-free projection: {@code {type, source, cases: [{label, preset}]}}; {@code source} is
     * {@code kpi:<key>}, {@code tag} or {@code instruments}. An expression's cases are the presets
     * it names, so a preview can draw them; its text stays on the Gateway.
     */
    public JsonObject display(Kind kind) {
        JsonObject o = new JsonObject();
        o.addProperty("type", instruments ? KindSetup.INSTRUMENTS : type);
        o.addProperty("source", instruments ? KindSetup.INSTRUMENTS : kpi != null ? "kpi:" + kpi : "tag");
        JsonArray cases = new JsonArray();
        if (STATES.equals(type)) {
            for (State s : states) {
                cases.add(caseJson(s.value().getAsString(), s.preset()));
            }
        } else if (BANDS.equals(type)) {
            for (Band b : bands) {
                cases.add(caseJson(b.label(), b.preset()));
            }
        } else if (EXPRESSION.equals(type)) {
            for (String preset : presetsIn(expression, kind)) {
                cases.add(caseJson(preset, preset));
            }
        }
        o.add("cases", cases);
        return o;
    }

    private static JsonObject caseJson(String label, String preset) {
        JsonObject c = new JsonObject();
        c.addProperty("label", label);
        c.addProperty("preset", preset);
        return c;
    }

    static boolean matches(JsonPrimitive expected, JsonElement actual) {
        if (actual == null || !actual.isJsonPrimitive()) {
            return false;
        }
        JsonPrimitive a = actual.getAsJsonPrimitive();
        if (expected.isBoolean()) {
            return a.isBoolean() ? a.getAsBoolean() == expected.getAsBoolean()
                : a.isString() && a.getAsString().trim().equalsIgnoreCase(String.valueOf(expected.getAsBoolean()));
        }
        if (expected.isNumber()) {
            Double d = asNumber(a);
            return d != null && d.doubleValue() == expected.getAsDouble();
        }
        if (a.isString()) {
            return a.getAsString().equals(expected.getAsString());
        }
        if (a.isNumber()) {
            Double e = asNumber(expected);
            return e != null && e.doubleValue() == a.getAsDouble();
        }
        return a.isBoolean() && expected.getAsString().trim().equalsIgnoreCase(String.valueOf(a.getAsBoolean()));
    }

    static Double asNumber(JsonElement v) {
        if (v == null || !v.isJsonPrimitive()) {
            return null;
        }
        JsonPrimitive p = v.getAsJsonPrimitive();
        if (p.isNumber()) {
            double d = p.getAsDouble();
            return Double.isNaN(d) ? null : d;
        }
        if (p.isString()) {
            try {
                double d = Double.parseDouble(p.getAsString().trim());
                return Double.isNaN(d) || Double.isInfinite(d) ? null : d;
            } catch (NumberFormatException ex) {
                return null;
            }
        }
        return null;
    }

    private static List<JsonObject> cases(JsonObject r) {
        List<JsonObject> out = new ArrayList<>();
        JsonElement c = r.get("cases");
        if (c != null && c.isJsonArray()) {
            for (JsonElement e : c.getAsJsonArray()) {
                if (e.isJsonObject()) {
                    out.add(e.getAsJsonObject());
                }
            }
        }
        return out;
    }

    private static String text(JsonObject o, String key) {
        JsonElement v = o.get(key);
        return v != null && v.isJsonPrimitive() && v.getAsJsonPrimitive().isString() ? v.getAsString() : null;
    }

    private static Double number(JsonObject o, String key) {
        JsonElement v = o.get(key);
        return v != null && v.isJsonPrimitive() && v.getAsJsonPrimitive().isNumber() ? v.getAsDouble() : null;
    }

    private static String num(double d) {
        return d == Math.rint(d) && Math.abs(d) < 1e15 ? Long.toString((long) d) : Double.toString(d);
    }
}
