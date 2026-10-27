package com.aoindustrial.perspective.mapstudio.designer.setup;

import java.text.MessageFormat;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.ResourceBundle;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.inductiveautomation.ignition.common.gson.Gson;
import com.inductiveautomation.ignition.common.gson.GsonBuilder;
import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;
import com.inductiveautomation.ignition.common.gson.JsonPrimitive;

import com.aoindustrial.perspective.mapstudio.common.contract.Setup;

/**
 * The values of the setup editor's form (epic 2 story 7), with no Swing: read from
 * and written to {@code setup.json}, and judged by {@link #reasons()}.
 *
 * <p>The form owns no setup rule. {@link #reasons()} adds only input checks (a
 * required field is filled, a number is a whole number, a function name has the
 * shape {@code package.function}, a list names nothing twice) and otherwise asks
 * {@link Setup#parse(String)}, the Gateway's own reader, mapping each of its
 * messages to the field whose key it names.
 *
 * <p>Writing keeps keys the form does not know (a later schema's or a hand-added
 * one) after the known keys, writes the known keys in story 1's order with
 * 2-space indents, lists of names on one line, and a newline at the end, so a
 * save of an unchanged setup gives the same bytes.
 */
public final class SetupForm {

    /** What the editor may do with the setup it read. */
    public enum State {
        /** Read and editable. */
        OK,
        /** {@code schemaVersion} above 1: shown read only, never written. */
        NEWER_SCHEMA,
        /** Not readable (not JSON, no version, a field of the wrong type): read only until the user starts from defaults. */
        UNREADABLE
    }

    public static final String SCHEMA_VERSION = "schemaVersion";
    public static final String CONNECTION = "connection";
    public static final String ROLES = "roles";
    public static final String FULL_ROLES = "roles.full";
    public static final String PHONE_ROLES = "roles.phone";
    public static final String KINDS_FUNCTION = "kindsFunction";
    public static final String ASSETS_FUNCTION = "assetsFunction";
    public static final String REFRESH = "refreshIntervalSeconds";
    public static final String ALARM_PAGE = "alarmPage";
    public static final String BASEMAPS = "basemaps";
    public static final String TOKEN_SECRET = "tokenSecret";

    /** The key of reasons that name no field; shown at the top of the form. */
    public static final String GENERAL = "";

    /** Editable fields, in the order of {@code setup.json} and of the form. */
    public static final List<String> FIELDS = List.of(CONNECTION, FULL_ROLES, PHONE_ROLES, KINDS_FUNCTION,
        ASSETS_FUNCTION, REFRESH, ALARM_PAGE, BASEMAPS, TOKEN_SECRET);

    /** The top-level keys of setup v1, in story 1's order. */
    private static final List<String> KNOWN_KEYS = List.of(SCHEMA_VERSION, CONNECTION, ROLES, KINDS_FUNCTION,
        ASSETS_FUNCTION, REFRESH, ALARM_PAGE, BASEMAPS, TOKEN_SECRET);

    private static final Pattern FUNCTION_PATH = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*(\\.[A-Za-z_][A-Za-z0-9_]*)+");
    private static final Pattern WHOLE_NUMBER = Pattern.compile("[0-9]{1,9}");
    private static final Pattern QUOTED_KEY = Pattern.compile("\"([A-Za-z]+(?:\\.[A-Za-z]+)?)\"");
    private static final Gson GSON = new GsonBuilder().disableHtmlEscaping().create();

    static final ResourceBundle TEXT =
        ResourceBundle.getBundle("com.aoindustrial.perspective.mapstudio.designer.MapStudioDesigner");

    private State state = State.OK;
    private String stateReason = "";
    private String originalText;
    private String schemaVersionText = String.valueOf(Setup.SCHEMA_VERSION);

    private String connection = "";
    private List<String> fullRoles = List.of();
    private List<String> phoneRoles = List.of();
    private String kindsFunction = "";
    private String assetsFunction = "";
    private String refreshText = String.valueOf(Setup.DEFAULT_REFRESH_SECONDS);
    private String alarmPage = "";
    private List<String> basemaps = Setup.DEFAULT_BASEMAPS;
    private String tokenSecret = "";

    private final LinkedHashMap<String, JsonElement> unknownKeys = new LinkedHashMap<>();
    private final LinkedHashMap<String, JsonElement> unknownRoleKeys = new LinkedHashMap<>();

    private SetupForm() {
    }

    /** A text of the bundle, formatted with its arguments when it has any. */
    public static String msg(String key, Object... args) {
        String pattern = TEXT.getString(key);
        return args.length == 0 ? pattern : MessageFormat.format(pattern, args);
    }

    /** The form of a new setup: full editing {@code MapEditor}, phone {@code MapOperator}, refresh 10, basemaps none and osm. */
    public static SetupForm defaults() {
        SetupForm form = new SetupForm();
        form.fullRoles = List.of("MapEditor");
        form.phoneRoles = List.of("MapOperator");
        return form;
    }

    /** The form of a resource with no {@code setup.json}. */
    public static SetupForm missingFile() {
        return unreadable(null, msg("setup.state.noFile"));
    }

    /** Reads {@code setup.json}; never throws: a setup it cannot show comes back read only with the reason. */
    public static SetupForm fromJson(String text) {
        JsonElement element;
        try {
            element = JsonParser.parseString(text);
        } catch (RuntimeException ex) {
            return unreadable(text, msg("setup.state.notJson", plain(ex.getMessage())));
        }
        if (element == null || !element.isJsonObject()) {
            return unreadable(text, msg("setup.state.notObject"));
        }
        JsonObject o = element.getAsJsonObject();
        JsonElement version = o.get(SCHEMA_VERSION);
        if (version == null || !version.isJsonPrimitive() || !version.getAsJsonPrimitive().isNumber()) {
            return unreadable(text, msg("setup.state.noVersion"));
        }
        double v = version.getAsDouble();
        if (v > Setup.SCHEMA_VERSION && v == Math.rint(v)) {
            SetupForm form = new SetupForm();
            form.state = State.NEWER_SCHEMA;
            form.originalText = text;
            form.schemaVersionText = version.getAsJsonPrimitive().toString();
            form.stateReason = msg("setup.state.newer", form.schemaVersionText);
            return form;
        }
        if (v != Setup.SCHEMA_VERSION) {
            return unreadable(text, msg("setup.state.badVersion", version.toString()));
        }
        SetupForm form = new SetupForm();
        try {
            form.connection = string(o, CONNECTION, "");
            form.fullRoles = List.of();
            form.phoneRoles = List.of();
            JsonElement roles = o.get(ROLES);
            if (roles != null && !roles.isJsonNull()) {
                if (!roles.isJsonObject()) {
                    throw new IllegalArgumentException(ROLES + "|an object {full: [...], phone: [...]}");
                }
                JsonObject r = roles.getAsJsonObject();
                form.fullRoles = names(r, "full", FULL_ROLES, List.of());
                form.phoneRoles = names(r, "phone", PHONE_ROLES, List.of());
                for (Map.Entry<String, JsonElement> e : r.entrySet()) {
                    if (!e.getKey().equals("full") && !e.getKey().equals("phone")) {
                        form.unknownRoleKeys.put(e.getKey(), e.getValue());
                    }
                }
            }
            form.kindsFunction = string(o, KINDS_FUNCTION, "");
            form.assetsFunction = string(o, ASSETS_FUNCTION, "");
            JsonElement refresh = o.get(REFRESH);
            if (refresh != null && !refresh.isJsonNull()) {
                // Setup.parse refuses anything but a JSON number, a quoted "10" included.
                if (!refresh.isJsonPrimitive() || !refresh.getAsJsonPrimitive().isNumber()) {
                    throw new IllegalArgumentException(REFRESH + "|a number of seconds");
                }
                double seconds = refresh.getAsDouble();
                // 10.0 is the Gateway's 10; 10.5 is shown as written and refused by the input check.
                form.refreshText = seconds == Math.rint(seconds) && Math.abs(seconds) < 1e9
                    ? String.valueOf((long) seconds) : refresh.getAsJsonPrimitive().toString();
            }
            form.alarmPage = string(o, ALARM_PAGE, "");
            form.basemaps = names(o, BASEMAPS, BASEMAPS, Setup.DEFAULT_BASEMAPS);
            form.tokenSecret = string(o, TOKEN_SECRET, "");
        } catch (IllegalArgumentException ex) {
            String[] parts = ex.getMessage().split("\\|", 2);
            return unreadable(text, msg("setup.state.badField", parts[0], parts[1]));
        }
        for (Map.Entry<String, JsonElement> e : o.entrySet()) {
            if (!KNOWN_KEYS.contains(e.getKey())) {
                form.unknownKeys.put(e.getKey(), e.getValue());
            }
        }
        form.originalText = text;
        // Guard: a file the Gateway refuses must never look valid here. If the form
        // read it into a setup the Gateway would accept, the form misread it, and a
        // save of the unchanged form would write nothing (the editor's equals test).
        String fileMessage = setupMessage(text);
        if (fileMessage != null && setupMessage(form.toJson()) == null) {
            return unreadable(text, display(fileMessage));
        }
        return form;
    }

    private static SetupForm unreadable(String text, String reason) {
        SetupForm form = new SetupForm();
        form.state = State.UNREADABLE;
        form.originalText = text;
        form.stateReason = msg("setup.state.unreadable", reason);
        return form;
    }

    private static String plain(String message) {
        return message == null ? "" : message;
    }

    private static String string(JsonObject o, String key, String fallback) {
        JsonElement e = o.get(key);
        if (e == null || e.isJsonNull()) {
            return fallback;
        }
        if (!e.isJsonPrimitive() || !e.getAsJsonPrimitive().isString()) {
            throw new IllegalArgumentException(key + "|a text");
        }
        return e.getAsString();
    }

    /** As {@link Setup}: the fallback only when the key is absent; JSON null is an empty list. */
    private static List<String> names(JsonObject o, String key, String label, List<String> fallback) {
        JsonElement e = o.get(key);
        if (e == null) {
            return fallback;
        }
        if (e.isJsonNull()) {
            return List.of();
        }
        if (!e.isJsonArray()) {
            throw new IllegalArgumentException(label + "|a list of names");
        }
        List<String> out = new ArrayList<>();
        for (JsonElement item : (JsonArray) e) {
            if (!item.isJsonPrimitive() || !item.getAsJsonPrimitive().isString()) {
                throw new IllegalArgumentException(label + "|a list of names");
            }
            out.add(item.getAsString());
        }
        return List.copyOf(out);
    }

    /** A copy holding the same unknown keys, for the editor to fill from its fields. */
    public SetupForm copy() {
        SetupForm c = new SetupForm();
        c.state = state;
        c.stateReason = stateReason;
        c.originalText = originalText;
        c.schemaVersionText = schemaVersionText;
        c.connection = connection;
        c.fullRoles = fullRoles;
        c.phoneRoles = phoneRoles;
        c.kindsFunction = kindsFunction;
        c.assetsFunction = assetsFunction;
        c.refreshText = refreshText;
        c.alarmPage = alarmPage;
        c.basemaps = basemaps;
        c.tokenSecret = tokenSecret;
        c.unknownKeys.putAll(unknownKeys);
        c.unknownRoleKeys.putAll(unknownRoleKeys);
        return c;
    }

    public State state() {
        return state;
    }

    /** Plain words for a read-only state; empty when {@link State#OK}. */
    public String stateReason() {
        return stateReason;
    }

    public boolean isEditable() {
        return state == State.OK;
    }

    public String schemaVersion() {
        return schemaVersionText;
    }

    /** The value of a text field ({@link #CONNECTION}, the functions, {@link #REFRESH}, {@link #ALARM_PAGE}, {@link #TOKEN_SECRET}). */
    public String text(String field) {
        switch (field) {
            case CONNECTION: return connection;
            case KINDS_FUNCTION: return kindsFunction;
            case ASSETS_FUNCTION: return assetsFunction;
            case REFRESH: return refreshText;
            case ALARM_PAGE: return alarmPage;
            case TOKEN_SECRET: return tokenSecret;
            default: throw new IllegalArgumentException("not a text field: " + field);
        }
    }

    /** Sets a text field; the value is kept as typed (trimmed), so the input check can name what is wrong. */
    public SetupForm setText(String field, String value) {
        String v = value == null ? "" : value.trim();
        switch (field) {
            case CONNECTION: connection = v; break;
            case KINDS_FUNCTION: kindsFunction = v; break;
            case ASSETS_FUNCTION: assetsFunction = v; break;
            case REFRESH: refreshText = v; break;
            case ALARM_PAGE: alarmPage = v; break;
            case TOKEN_SECRET: tokenSecret = v; break;
            default: throw new IllegalArgumentException("not a text field: " + field);
        }
        return this;
    }

    /** The value of a list field ({@link #FULL_ROLES}, {@link #PHONE_ROLES}, {@link #BASEMAPS}). */
    public List<String> list(String field) {
        switch (field) {
            case FULL_ROLES: return fullRoles;
            case PHONE_ROLES: return phoneRoles;
            case BASEMAPS: return basemaps;
            default: throw new IllegalArgumentException("not a list field: " + field);
        }
    }

    /** Sets a list field; entries are trimmed and blank ones dropped. */
    public SetupForm setList(String field, List<String> values) {
        List<String> clean = new ArrayList<>();
        for (String s : values) {
            if (s != null && !s.trim().isEmpty()) {
                clean.add(s.trim());
            }
        }
        List<String> v = List.copyOf(clean);
        switch (field) {
            case FULL_ROLES: fullRoles = v; break;
            case PHONE_ROLES: phoneRoles = v; break;
            case BASEMAPS: basemaps = v; break;
            default: throw new IllegalArgumentException("not a list field: " + field);
        }
        return this;
    }

    /** Splits the text of a one-per-line field. */
    public static List<String> lines(String text) {
        return text == null ? List.of() : List.of(text.split("\\R"));
    }

    /**
     * What stops this setup from being saved, by field ({@link #FIELDS}, or
     * {@link #GENERAL} for a reason naming no field), in field order; empty when
     * the setup may be saved. A read-only form gives its state reason.
     */
    public Map<String, List<String>> reasons() {
        LinkedHashMap<String, List<String>> out = new LinkedHashMap<>();
        if (state != State.OK) {
            add(out, GENERAL, stateReason);
            return out;
        }
        // Input checks: the only rules the form adds.
        if (connection.isEmpty()) {
            add(out, CONNECTION, msg("setup.reason.connection.required"));
        }
        if (!WHOLE_NUMBER.matcher(refreshText).matches()) {
            add(out, REFRESH, msg("setup.reason.refresh.number"));
        }
        for (String f : List.of(KINDS_FUNCTION, ASSETS_FUNCTION)) {
            String v = text(f);
            if (!v.isEmpty() && !FUNCTION_PATH.matcher(v).matches()) {
                add(out, f, msg("setup.reason.function.shape"));
            }
        }
        for (String f : List.of(FULL_ROLES, PHONE_ROLES, BASEMAPS)) {
            Set<String> seen = new LinkedHashSet<>();
            for (String name : list(f)) {
                if (!seen.add(name)) {
                    add(out, f, msg("setup.reason.list.duplicate", name));
                }
            }
        }
        // The Gateway's rules: Setup.parse stops at its first fault, so each field
        // is asked on its own, in a setup that is valid apart from that field.
        for (String f : FIELDS) {
            if (out.containsKey(f)) {
                continue;
            }
            String message = setupMessage(probe(f));
            if (message != null) {
                add(out, fieldOf(message), display(message));
            }
        }
        if (out.isEmpty()) {
            String message = setupMessage(toJson());
            if (message != null) {
                add(out, fieldOf(message), display(message));
            }
        }
        return orderedByField(out);
    }

    /** True when {@link #reasons()} is empty. */
    public boolean canSave() {
        return reasons().isEmpty();
    }

    private String probe(String field) {
        SetupForm p = new SetupForm();
        p.connection = field.equals(CONNECTION) ? connection : "probe";
        p.fullRoles = List.of();
        p.phoneRoles = List.of();
        p.basemaps = List.of();
        p.refreshText = String.valueOf(Setup.DEFAULT_REFRESH_SECONDS);
        switch (field) {
            case FULL_ROLES: p.fullRoles = fullRoles; break;
            case PHONE_ROLES: p.phoneRoles = phoneRoles; break;
            case BASEMAPS: p.basemaps = basemaps; break;
            case CONNECTION: break;
            default: p.setText(field, text(field)); break;
        }
        return p.toJson();
    }

    private static String setupMessage(String json) {
        try {
            Setup.parse(json);
            return null;
        } catch (Setup.SetupException ex) {
            return ex.getMessage();
        }
    }

    /** The field a {@link Setup} message names by its quoted key, else {@link #GENERAL}. */
    static String fieldOf(String message) {
        Matcher m = QUOTED_KEY.matcher(message);
        while (m.find()) {
            if (FIELDS.contains(m.group(1))) {
                return m.group(1);
            }
            if (m.group(1).equals(ROLES)) {
                return FULL_ROLES;
            }
        }
        return GENERAL;
    }

    /** A {@link Setup} message as the form shows it: without the leading "setup.json ". */
    static String display(String message) {
        String m = message.startsWith("setup.json ") ? message.substring("setup.json ".length()) : message;
        return m.isEmpty() ? m : Character.toUpperCase(m.charAt(0)) + m.substring(1);
    }

    private static void add(Map<String, List<String>> out, String field, String reason) {
        out.computeIfAbsent(field, k -> new ArrayList<>()).add(reason);
    }

    private static Map<String, List<String>> orderedByField(Map<String, List<String>> in) {
        LinkedHashMap<String, List<String>> out = new LinkedHashMap<>();
        if (in.containsKey(GENERAL)) {
            out.put(GENERAL, List.copyOf(in.get(GENERAL)));
        }
        for (String f : FIELDS) {
            if (in.containsKey(f)) {
                out.put(f, List.copyOf(in.get(f)));
            }
        }
        return out;
    }

    /**
     * The {@code setup.json} text. A read-only form gives back the text it read,
     * unchanged; an editable one writes the known keys in order, then the unknown
     * keys, 2-space indents, newline at the end.
     */
    public String toJson() {
        if (state != State.OK && originalText != null) {
            return originalText;
        }
        JsonObject o = new JsonObject();
        o.addProperty(SCHEMA_VERSION, Setup.SCHEMA_VERSION);
        o.addProperty(CONNECTION, connection);
        JsonObject roles = new JsonObject();
        roles.add("full", array(fullRoles));
        roles.add("phone", array(phoneRoles));
        unknownRoleKeys.forEach(roles::add);
        o.add(ROLES, roles);
        o.addProperty(KINDS_FUNCTION, kindsFunction);
        o.addProperty(ASSETS_FUNCTION, assetsFunction);
        if (WHOLE_NUMBER.matcher(refreshText).matches()) {
            o.addProperty(REFRESH, Integer.parseInt(refreshText));
        } else {
            o.addProperty(REFRESH, refreshText);
        }
        o.addProperty(ALARM_PAGE, alarmPage);
        o.add(BASEMAPS, array(basemaps));
        o.addProperty(TOKEN_SECRET, tokenSecret);
        unknownKeys.forEach(o::add);
        StringBuilder sb = new StringBuilder();
        write(sb, o, "");
        return sb.append('\n').toString();
    }

    private static JsonArray array(List<String> values) {
        JsonArray a = new JsonArray();
        values.forEach(a::add);
        return a;
    }

    private static void write(StringBuilder sb, JsonElement e, String indent) {
        if (e.isJsonObject()) {
            JsonObject o = e.getAsJsonObject();
            if (o.size() == 0) {
                sb.append("{}");
                return;
            }
            sb.append("{\n");
            String inner = indent + "  ";
            int i = 0;
            for (Map.Entry<String, JsonElement> entry : o.entrySet()) {
                sb.append(inner).append(GSON.toJson(new JsonPrimitive(entry.getKey()))).append(": ");
                write(sb, entry.getValue(), inner);
                sb.append(++i < o.size() ? ",\n" : "\n");
            }
            sb.append(indent).append('}');
        } else if (e.isJsonArray()) {
            JsonArray a = e.getAsJsonArray();
            boolean flat = true;
            for (JsonElement item : a) {
                flat &= item.isJsonPrimitive() || item.isJsonNull();
            }
            if (flat) {
                sb.append('[');
                for (int i = 0; i < a.size(); i++) {
                    sb.append(i == 0 ? "" : ", ").append(GSON.toJson(a.get(i)));
                }
                sb.append(']');
                return;
            }
            sb.append("[\n");
            String inner = indent + "  ";
            for (int i = 0; i < a.size(); i++) {
                sb.append(inner);
                write(sb, a.get(i), inner);
                sb.append(i + 1 < a.size() ? ",\n" : "\n");
            }
            sb.append(indent).append(']');
        } else {
            sb.append(GSON.toJson(e));
        }
    }

    /** Two forms are equal when they would write the same {@code setup.json} (the editor's "nothing changed" test). */
    @Override
    public boolean equals(Object other) {
        return other instanceof SetupForm && state == ((SetupForm) other).state
            && Objects.equals(toJson(), ((SetupForm) other).toJson());
    }

    @Override
    public int hashCode() {
        return Objects.hash(state, toJson());
    }
}
