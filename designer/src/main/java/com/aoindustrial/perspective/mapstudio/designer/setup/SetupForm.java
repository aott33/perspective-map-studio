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
import java.util.regex.Pattern;

import com.inductiveautomation.ignition.common.gson.Gson;
import com.inductiveautomation.ignition.common.gson.GsonBuilder;
import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;
import com.inductiveautomation.ignition.common.gson.JsonPrimitive;

import com.aoindustrial.perspective.mapstudio.common.contract.Setup;
import com.aoindustrial.perspective.mapstudio.common.contract.SetupLists;
import com.aoindustrial.perspective.mapstudio.common.contract.SetupProblem;

/**
 * The values of the setup editor's form (epic 2 story 7), with no Swing: read from
 * and written to {@code setup.json}, and judged by {@link #reasons()}.
 *
 * <p>The form owns no setup rule. {@link #reasons()} adds only input checks (a
 * required field is filled, a number is a whole number, a function name has the
 * shape {@code package.function}, a list names nothing twice) and otherwise asks
 * {@link Setup#read(String)}, the Gateway's own reader, placing each of its
 * problems beside the field it names ({@link SetupProblem#field()}).
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
        // The Gateway's reading decides what is wrong; the form only decides what it can show.
        Setup.Reading reading = Setup.read(text);
        SetupProblem file = problem(reading, SetupProblem.FILE);
        if (file != null) {
            return unreadable(text, file.message());
        }
        JsonObject o = JsonParser.parseString(text).getAsJsonObject();
        JsonElement version = o.get(SCHEMA_VERSION);
        if (version != null && version.isJsonPrimitive() && version.getAsJsonPrimitive().isNumber()) {
            double v = version.getAsDouble();
            if (v > Setup.SCHEMA_VERSION && v == Math.rint(v)) {
                SetupForm form = new SetupForm();
                form.state = State.NEWER_SCHEMA;
                form.originalText = text;
                form.schemaVersionText = String.valueOf((long) v);
                form.stateReason = msg("setup.state.newer", form.schemaVersionText);
                return form;
            }
        }
        SetupProblem schema = problem(reading, SCHEMA_VERSION);
        if (schema != null) {
            return unreadable(text, schema.message());
        }
        SetupForm form = new SetupForm();
        try {
            form.connection = string(o, CONNECTION, "");
            form.fullRoles = List.of();
            form.phoneRoles = List.of();
            JsonElement roles = o.get(ROLES);
            if (roles != null && !roles.isJsonNull()) {
                if (!roles.isJsonObject()) {
                    throw new NotShown(ROLES);
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
                // Setup.read refuses anything but a JSON number, a quoted "10" included.
                if (!refresh.isJsonPrimitive() || !refresh.getAsJsonPrimitive().isNumber()) {
                    throw new NotShown(REFRESH);
                }
                double seconds = refresh.getAsDouble();
                // 10.0 is the Gateway's 10; 10.5 is shown as written and refused by the input check.
                form.refreshText = seconds == Math.rint(seconds) && Math.abs(seconds) < 1e9
                    ? String.valueOf((long) seconds) : refresh.getAsJsonPrimitive().toString();
            }
            form.alarmPage = string(o, ALARM_PAGE, "");
            form.basemaps = names(o, BASEMAPS, BASEMAPS, Setup.DEFAULT_BASEMAPS);
            form.tokenSecret = string(o, TOKEN_SECRET, "");
        } catch (NotShown ex) {
            // A value of a JSON type the field cannot show; the Gateway's problem says what it must be.
            SetupProblem p = problem(reading, ex.getMessage());
            return unreadable(text, p != null ? p.message() : msg("setup.state.badField", ex.getMessage()));
        }
        for (Map.Entry<String, JsonElement> e : o.entrySet()) {
            if (!KNOWN_KEYS.contains(e.getKey())) {
                form.unknownKeys.put(e.getKey(), e.getValue());
            }
        }
        form.originalText = text;
        // Guard: a file the Gateway refuses must never look valid here. If the form
        // read it into a setup the Gateway would accept (a key set twice, say), the
        // form misread it, and a save of the unchanged form would write nothing (the
        // editor's equals test).
        if (!reading.ok() && Setup.read(form.toJson()).ok()) {
            return unreadable(text, reading.problems().get(0).message());
        }
        return form;
    }

    /** A value the form has no field for, named by the field ({@link #FULL_ROLES}, ...). */
    private static final class NotShown extends Exception {
        NotShown(String field) {
            super(field);
        }
    }

    /** The reading's first problem about {@code field}, else null. */
    private static SetupProblem problem(Setup.Reading reading, String field) {
        for (SetupProblem p : reading.problems()) {
            if (p.field().equals(field)) {
                return p;
            }
        }
        return null;
    }

    private static SetupForm unreadable(String text, String reason) {
        SetupForm form = new SetupForm();
        form.state = State.UNREADABLE;
        form.originalText = text;
        form.stateReason = msg("setup.state.unreadable", display(reason));
        return form;
    }

    private static String string(JsonObject o, String key, String fallback) throws NotShown {
        JsonElement e = o.get(key);
        if (e == null || e.isJsonNull()) {
            return fallback;
        }
        if (!e.isJsonPrimitive() || !e.getAsJsonPrimitive().isString()) {
            throw new NotShown(key);
        }
        return e.getAsString();
    }

    /** As {@link Setup}: the fallback when the key is absent or JSON null. */
    private static List<String> names(JsonObject o, String key, String label, List<String> fallback)
        throws NotShown {
        JsonElement e = o.get(key);
        if (e == null || e.isJsonNull()) {
            return fallback;
        }
        if (!e.isJsonArray()) {
            throw new NotShown(label);
        }
        List<String> out = new ArrayList<>();
        for (JsonElement item : (JsonArray) e) {
            if (!item.isJsonPrimitive() || !item.getAsJsonPrimitive().isString()) {
                throw new NotShown(label);
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
        // The Gateway's rules, each beside its field; a field an input check already
        // explains (a refresh of "ten", a name listed twice) is not explained twice.
        Set<String> explained = Set.copyOf(out.keySet());
        for (SetupProblem p : Setup.read(toJson()).problems()) {
            String field = fieldOf(p.field());
            if (!explained.contains(field)) {
                add(out, field, display(p.message()));
            }
        }
        return orderedByField(out);
    }

    /**
     * What the form shows beside a field that the Gateway would accept but that will not work
     * yet (epic 2 story 16): a name not in its loaded list, a connection that is not PostgreSQL,
     * Mapbox without a token, a token naming no provider. Never stops a save. A list that is not
     * loaded gives no warning. A read-only form has none.
     */
    public Map<String, List<String>> warnings(FormLists lists) {
        LinkedHashMap<String, List<String>> out = new LinkedHashMap<>();
        if (state != State.OK) {
            return out;
        }
        SetupLists.Part connections = lists.connections();
        if (connections != null && !connection.isEmpty()) {
            String vendor = null;
            for (var e : connections.entries()) {
                if (e.name().equalsIgnoreCase(connection)) {
                    vendor = e.detail();
                    break;
                }
            }
            if (vendor == null) {
                add(out, CONNECTION, msg("setup.warning.connection.missing", connection));
            } else if (!vendor.isEmpty() && !vendor.equalsIgnoreCase("POSTGRES") && !vendor.equalsIgnoreCase("GENERIC")) {
                add(out, CONNECTION, msg("setup.warning.connection.vendor", connection, FormLists.vendorWords(vendor)));
            }
        }
        for (String f : List.of(FULL_ROLES, PHONE_ROLES)) {
            for (String role : unknownRoles(f, lists)) {
                add(out, f, msg("setup.warning.role.missing", role, lists.project().identityProvider()));
            }
        }
        List<String> functions = lists.project().functions();
        if (functions != null) {
            for (String f : List.of(KINDS_FUNCTION, ASSETS_FUNCTION)) {
                String v = text(f);
                if (!v.isEmpty() && FUNCTION_PATH.matcher(v).matches() && !functions.contains(v)) {
                    add(out, f, msg("setup.warning.function.missing", v));
                }
            }
        }
        List<String> pages = lists.project().pages();
        if (pages != null && !alarmPage.isEmpty() && alarmPage.startsWith("/")
            && !ProjectLists.isPage(alarmPage, pages)) {
            add(out, ALARM_PAGE, msg("setup.warning.page.missing", alarmPage));
        }
        String[] token = splitToken(tokenSecret);
        // A provider with no secret name names no token either. Satellite (epic 3 entry 6) and Mapbox need one.
        if ((basemaps.contains("satellite") || basemaps.contains("mapbox")) && token[1].isEmpty()) {
            add(out, BASEMAPS, msg("setup.warning.basemaps.mapboxToken"));
        }
        if (!tokenSecret.isEmpty()) {
            if (token[0].isEmpty()) {
                add(out, TOKEN_SECRET, msg("setup.warning.token.noProvider"));
            } else {
                if (token[1].isEmpty()) {
                    add(out, TOKEN_SECRET, msg("setup.warning.token.noName"));
                }
                var providers = lists.secretProviders();
                if (providers != null && !providers.names().contains(token[0])) {
                    add(out, TOKEN_SECRET, msg("setup.warning.token.provider", token[0]));
                }
                var names = lists.secretNamesOf(token[0]);
                if (names != null && !token[1].isEmpty() && !names.names().contains(token[1])) {
                    add(out, TOKEN_SECRET, msg("setup.warning.token.name", token[1], token[0]));
                }
            }
        }
        return orderedByField(out);
    }

    /** The roles of a role field that the loaded role list does not have, each once, in order. */
    public List<String> unknownRoles(String field, FormLists lists) {
        var roles = lists.roles();
        List<String> out = new ArrayList<>();
        if (roles == null || state != State.OK) {
            return out;
        }
        List<String> known = roles.names();
        for (String r : list(field)) {
            if (!known.contains(r) && !out.contains(r)) {
                out.add(r);
            }
        }
        return out;
    }

    /**
     * {@code tokenSecret} as the form shows it: {@code [provider, secret name]}, split at the first
     * {@code /} (setup schema 1 writes {@code <provider>/<name>}); a value with no {@code /} is a
     * secret name with no provider (story 7 wrote a single name).
     */
    public static String[] splitToken(String tokenSecret) {
        String t = tokenSecret == null ? "" : tokenSecret;
        int slash = t.indexOf('/');
        return slash < 0 ? new String[] {"", t} : new String[] {t.substring(0, slash), t.substring(slash + 1)};
    }

    /**
     * The {@code tokenSecret} of a provider and a secret name: {@code <provider>/<name>}, or the
     * name alone with no provider. A name with a {@code /} and no provider is written
     * {@code /<name>}, so {@link #splitToken} reads it back as that name and not as a provider.
     */
    public static String joinToken(String provider, String name) {
        String p = provider == null ? "" : provider.trim();
        String n = name == null ? "" : name.trim();
        if (p.isEmpty()) {
            return n.indexOf('/') >= 0 ? "/" + n : n;
        }
        return p + "/" + n;
    }

    /** True when {@link #reasons()} is empty. */
    public boolean canSave() {
        return reasons().isEmpty();
    }

    /**
     * The form field a {@link SetupProblem#field()} belongs to: the field itself,
     * {@link #FULL_ROLES} for {@code roles} as a whole, else {@link #GENERAL} (the
     * file, the schema version, an unknown key).
     */
    static String fieldOf(String problemField) {
        if (FIELDS.contains(problemField)) {
            return problemField;
        }
        return problemField.equals(ROLES) ? FULL_ROLES : GENERAL;
    }

    /** A {@link Setup} message as the form shows it: as the Gateway words it, as a sentence. */
    static String display(String message) {
        return message.isEmpty() || message.endsWith(".") ? message : message + ".";
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
