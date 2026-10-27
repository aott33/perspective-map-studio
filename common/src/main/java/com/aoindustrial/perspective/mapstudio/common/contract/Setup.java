package com.aoindustrial.perspective.mapstudio.common.contract;

import java.io.IOException;
import java.io.StringReader;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParseException;
import com.inductiveautomation.ignition.common.gson.internal.Streams;
import com.inductiveautomation.ignition.common.gson.stream.JsonReader;
import com.inductiveautomation.ignition.common.gson.stream.JsonToken;

/**
 * A project's Map Studio setup (AD-5), schema version 1: the project resource
 * {@code com.aoindustrial.perspective.mapstudio/setup/setup.json}. Every field,
 * its type, default and rule: {@code docs/setup.md}.
 *
 * <pre>
 * {"schemaVersion": 1, "connection": "MapStudio",
 *  "roles": {"full": ["MapEditor"], "phone": ["MapOperator"]},
 *  "kindsFunction": "", "assetsFunction": "", "refreshIntervalSeconds": 10,
 *  "alarmPage": "", "basemaps": ["none", "osm"], "tokenSecret": ""}
 * </pre>
 *
 * Only {@code schemaVersion} and {@code connection} are required; every other
 * field has the default shown (owner decision, 2026-10-26). An unknown field is a
 * problem, so a misspelt field is never silently ignored; a new field bumps
 * {@code schemaVersion}. {@link #read} reports every problem at once; the Designer
 * setup form (entry 7) must use it rather than rules of its own.
 */
public record Setup(
    int schemaVersion,
    String connection,
    List<String> fullRoles,
    List<String> phoneRoles,
    String kindsFunction,
    String assetsFunction,
    int refreshIntervalSeconds,
    String alarmPage,
    List<String> basemaps,
    String tokenSecret) {

    public static final int SCHEMA_VERSION = 1;
    public static final int DEFAULT_REFRESH_SECONDS = 10;
    public static final int MIN_REFRESH_SECONDS = 1;
    public static final int MAX_REFRESH_SECONDS = 3600;
    public static final List<String> DEFAULT_BASEMAPS = List.of("none", "osm");
    /** Every basemap a setup may offer (AD-12). */
    public static final List<String> BASEMAPS = List.of("none", "osm", "satellite", "mapbox");
    /** Every field of schema version 1, in the order {@code docs/setup.md} lists them. */
    public static final List<String> FIELDS = List.of("schemaVersion", "connection", "roles", "kindsFunction",
        "assetsFunction", "refreshIntervalSeconds", "alarmPage", "basemaps", "tokenSecret");
    public static final List<String> ROLE_FIELDS = List.of("full", "phone");

    /** A project script function: a dotted name with at least one dot ({@code mapstudio.kinds.get}). */
    private static final Pattern FUNCTION_NAME = Pattern.compile("^[A-Za-z_]\\w*(\\.[A-Za-z_]\\w*)+$");
    private static final Pattern LINE_COLUMN = Pattern.compile("line (\\d+) column (\\d+)");
    private static final int MAX_SHOWN = 40;

    /** Thrown when a setup cannot be read; the message is plain words for the Gateway log. */
    public static final class SetupException extends Exception {
        public SetupException(String message) {
            super(message);
        }
    }

    /** The result of reading a setup: the setup when there is no problem, else every problem found. */
    public record Reading(Setup setup, List<SetupProblem> problems) {
        public boolean ok() {
            return problems.isEmpty();
        }

        /** Every problem as one plain-words reason ({@link Setup#describe}). */
        public String reason() {
            return describe(problems);
        }
    }

    /** The setup, or {@link SetupException} whose message lists every problem ({@link #describe}). */
    public static Setup parse(String text) throws SetupException {
        Reading reading = read(text);
        if (!reading.ok()) {
            throw new SetupException(reading.reason());
        }
        return reading.setup();
    }

    /**
     * One sentence listing every problem: {@code "a must be ..."} for one, and
     * {@code "2 problems: a must be ...; b must be ..."} for several, ending with a full stop.
     */
    public static String describe(List<SetupProblem> problems) {
        if (problems.isEmpty()) {
            return "";
        }
        List<String> messages = new ArrayList<>();
        for (SetupProblem p : problems) {
            messages.add(p.message());
        }
        String joined = String.join("; ", messages);
        return problems.size() == 1 ? joined + "." : problems.size() + " problems: " + joined + ".";
    }

    /** Read and check {@code setup.json}'s text, collecting every problem. Never throws. */
    public static Reading read(String text) {
        List<SetupProblem> problems = new ArrayList<>();
        JsonElement element;
        try {
            element = strictParse(text == null ? "" : text);
        } catch (JsonParseException | IOException | IllegalStateException ex) {
            return failed(SetupProblem.FILE, "setup.json is not valid JSON" + where(ex));
        }
        if (element == null || !element.isJsonObject()) {
            return failed(SetupProblem.FILE, "setup.json must be a JSON object {\"schemaVersion\": 1, ...}");
        }
        JsonObject o = element.getAsJsonObject();
        // The parser keeps the last of two equal keys; a field set twice is a problem, never a silent choice.
        problems.addAll(duplicateKeys(text));

        JsonElement version = present(o, "schemaVersion");
        if (version == null) {
            problems.add(new SetupProblem("schemaVersion", "schemaVersion is missing; it must be " + SCHEMA_VERSION));
        } else {
            Integer v = wholeNumber(version);
            if (v != null && v > SCHEMA_VERSION) {
                // A newer schema may have other fields: report only this.
                return failed("schemaVersion", "setup.json is written for a newer Map Studio (schema " + v
                    + "; this module reads " + SCHEMA_VERSION + ")");
            }
            if (v == null || v != SCHEMA_VERSION) {
                problems.add(new SetupProblem("schemaVersion", "schemaVersion must be " + SCHEMA_VERSION + ", not "
                    + shown(version)));
            }
        }

        for (Map.Entry<String, JsonElement> field : o.entrySet()) {
            if (!FIELDS.contains(field.getKey())) {
                problems.add(unknown(field.getKey(), "", FIELDS));
            }
        }

        String connection = "";
        JsonElement c = present(o, "connection");
        if (c == null) {
            problems.add(new SetupProblem("connection",
                "connection is missing; it must name a database connection of the Gateway"));
        } else if (!isString(c) || c.getAsString().isBlank()) {
            problems.add(new SetupProblem("connection", "connection must be the name of a database connection, not "
                + shown(c)));
        } else {
            connection = c.getAsString();
        }

        List<String> full = List.of();
        List<String> phone = List.of();
        JsonElement roles = present(o, "roles");
        if (roles != null) {
            if (!roles.isJsonObject()) {
                problems.add(new SetupProblem("roles", "roles must be an object {\"full\": [...], \"phone\": [...]}, not "
                    + shown(roles)));
            } else {
                JsonObject r = roles.getAsJsonObject();
                for (String key : r.keySet()) {
                    if (!ROLE_FIELDS.contains(key)) {
                        problems.add(unknown(key, "roles.", ROLE_FIELDS));
                    }
                }
                full = roleNames(r, "full", problems);
                phone = roleNames(r, "phone", problems);
            }
        }

        String kindsFunction = function(o, "kindsFunction", "mapstudio.kinds.get", problems);
        String assetsFunction = function(o, "assetsFunction", "mapstudio.assets.find", problems);

        int refresh = DEFAULT_REFRESH_SECONDS;
        JsonElement r = present(o, "refreshIntervalSeconds");
        if (r != null) {
            Integer v = wholeNumber(r);
            if (v == null || v < MIN_REFRESH_SECONDS || v > MAX_REFRESH_SECONDS) {
                problems.add(new SetupProblem("refreshIntervalSeconds", "refreshIntervalSeconds must be a whole number from "
                    + MIN_REFRESH_SECONDS + " to " + MAX_REFRESH_SECONDS + ", not " + shown(r)));
            } else {
                refresh = v;
            }
        }

        String alarmPage = "";
        JsonElement a = present(o, "alarmPage");
        if (a != null) {
            if (!isString(a) || !(a.getAsString().isEmpty() || a.getAsString().startsWith("/"))) {
                problems.add(new SetupProblem("alarmPage",
                    "alarmPage must be empty or a page path starting with /, not " + shown(a)));
            } else {
                alarmPage = a.getAsString();
            }
        }

        List<String> basemaps = DEFAULT_BASEMAPS;
        JsonElement b = present(o, "basemaps");
        if (b != null) {
            basemaps = basemaps(b, problems);
        }

        String tokenSecret = "";
        JsonElement t = present(o, "tokenSecret");
        if (t != null) {
            if (!isString(t)) {
                // Never echoed: someone may have pasted the token itself here.
                problems.add(new SetupProblem("tokenSecret",
                    "tokenSecret must be the name of a secret as text (its value is not shown)"));
            } else {
                tokenSecret = t.getAsString();
            }
        }

        if (!problems.isEmpty()) {
            return new Reading(null, List.copyOf(problems));
        }
        return new Reading(new Setup(SCHEMA_VERSION, connection, full, phone, kindsFunction, assetsFunction, refresh,
            alarmPage, basemaps, tokenSecret), List.of());
    }

    private static Reading failed(String field, String message) {
        return new Reading(null, List.of(new SetupProblem(field, message)));
    }

    /** Strict JSON (JsonParser is lenient): one value, nothing after it. */
    private static JsonElement strictParse(String text) throws IOException {
        JsonReader reader = new JsonReader(new StringReader(text));
        reader.setLenient(false);
        JsonElement element = Streams.parse(reader);
        if (reader.peek() != JsonToken.END_DOCUMENT) {
            throw new JsonParseException("more after the JSON value at " + reader.toString());
        }
        return element;
    }

    /**
     * One problem per key set more than once in the same object, at any depth
     * ({@code refreshIntervalSeconds is set twice}, {@code roles.full is set twice}).
     * Walks the text with the streaming reader, which sees every key; the text is
     * already known to be valid JSON.
     */
    static List<SetupProblem> duplicateKeys(String text) {
        List<SetupProblem> problems = new ArrayList<>();
        try {
            JsonReader reader = new JsonReader(new StringReader(text));
            reader.setLenient(false);
            walk(reader, "", problems);
        } catch (IOException | IllegalStateException | JsonParseException ex) {
            // Not reachable for text strictParse accepted; the parse problem is reported there.
        }
        return problems;
    }

    private static void walk(JsonReader reader, String prefix, List<SetupProblem> problems) throws IOException {
        switch (reader.peek()) {
            case BEGIN_OBJECT -> {
                reader.beginObject();
                Set<String> seen = new HashSet<>();
                Set<String> reported = new HashSet<>();
                while (reader.hasNext()) {
                    String key = reader.nextName();
                    String field = prefix + key;
                    if (!seen.add(key) && reported.add(key)) {
                        problems.add(new SetupProblem(field, field + " is set twice"));
                    }
                    walk(reader, field + ".", problems);
                }
                reader.endObject();
            }
            case BEGIN_ARRAY -> {
                reader.beginArray();
                String element = prefix.endsWith(".") ? prefix.substring(0, prefix.length() - 1) + "[]." : prefix;
                while (reader.hasNext()) {
                    walk(reader, element, problems);
                }
                reader.endArray();
            }
            default -> reader.skipValue();
        }
    }

    private static String where(Exception ex) {
        for (Throwable t = ex; t != null; t = t.getCause()) {
            Matcher m = LINE_COLUMN.matcher(String.valueOf(t.getMessage()));
            if (m.find()) {
                return " (line " + m.group(1) + ", column " + m.group(2) + ")";
            }
        }
        return "";
    }

    /** The field's value, or null when it is absent or JSON null (both mean "use the default"). */
    private static JsonElement present(JsonObject o, String key) {
        JsonElement e = o.get(key);
        return e == null || e.isJsonNull() ? null : e;
    }

    private static boolean isString(JsonElement e) {
        return e.isJsonPrimitive() && e.getAsJsonPrimitive().isString();
    }

    /** The value as an int when it is a JSON number with no fraction in int range, else null. */
    private static Integer wholeNumber(JsonElement e) {
        if (!e.isJsonPrimitive() || !e.getAsJsonPrimitive().isNumber()) {
            return null;
        }
        try {
            BigDecimal d = e.getAsBigDecimal();
            return d.stripTrailingZeros().scale() <= 0 ? d.intValueExact() : null;
        } catch (ArithmeticException | NumberFormatException ex) {
            return null;
        }
    }

    /** The value as JSON, cut to 40 characters. */
    private static String shown(JsonElement e) {
        String s = e.toString();
        return s.length() <= MAX_SHOWN ? s : s.substring(0, MAX_SHOWN) + "...";
    }

    private static SetupProblem unknown(String key, String prefix, List<String> known) {
        String hint = closest(key, known);
        String field = prefix + key;
        return new SetupProblem(field, field + " is not a setup field of schema " + SCHEMA_VERSION
            + (hint == null ? "" : " (did you mean " + prefix + hint + "?)"));
    }

    /** The known name closest to {@code key}: same letters ignoring case, a prefix of 4 or more, or 2 edits. */
    static String closest(String key, List<String> known) {
        String k = key.toLowerCase(Locale.ROOT);
        String best = null;
        int bestDistance = Integer.MAX_VALUE;
        for (String name : known) {
            String n = name.toLowerCase(Locale.ROOT);
            int d;
            if (n.equals(k)) {
                d = 0;
            } else if (Math.min(n.length(), k.length()) >= 4 && (n.startsWith(k) || k.startsWith(n))) {
                d = 1;
            } else {
                d = distance(k, n);
                if (d > 2) {
                    continue;
                }
            }
            if (d < bestDistance) {
                best = name;
                bestDistance = d;
            }
        }
        return best;
    }

    private static int distance(String a, String b) {
        int[] prev = new int[b.length() + 1];
        int[] cur = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) {
            prev[j] = j;
        }
        for (int i = 1; i <= a.length(); i++) {
            cur[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                cur[j] = Math.min(Math.min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + cost);
            }
            int[] t = prev;
            prev = cur;
            cur = t;
        }
        return prev[b.length()];
    }

    private static List<String> roleNames(JsonObject roles, String key, List<SetupProblem> problems) {
        String field = "roles." + key;
        JsonElement e = present(roles, key);
        if (e == null) {
            return List.of();
        }
        if (!e.isJsonArray()) {
            problems.add(new SetupProblem(field, field + " must be a list of role names, not " + shown(e)));
            return List.of();
        }
        List<String> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        boolean ok = true;
        for (JsonElement item : (JsonArray) e) {
            if (!isString(item) || item.getAsString().isBlank()) {
                problems.add(new SetupProblem(field, field + " must hold only role names (non-empty text), not "
                    + shown(item)));
                ok = false;
            } else if (!seen.add(item.getAsString())) {
                problems.add(new SetupProblem(field, field + " lists " + item.getAsString() + " twice"));
                ok = false;
            } else {
                out.add(item.getAsString());
            }
        }
        return ok ? List.copyOf(out) : List.of();
    }

    private static String function(JsonObject o, String key, String example, List<SetupProblem> problems) {
        JsonElement e = present(o, key);
        if (e == null) {
            return "";
        }
        if (!isString(e) || !(e.getAsString().isEmpty() || FUNCTION_NAME.matcher(e.getAsString()).matches())) {
            problems.add(new SetupProblem(key, key + " must be empty or a project script function name such as "
                + example + ", not " + shown(e)));
            return "";
        }
        return e.getAsString();
    }

    private static List<String> basemaps(JsonElement e, List<SetupProblem> problems) {
        String allowed = String.join(", ", BASEMAPS);
        if (!e.isJsonArray()) {
            problems.add(new SetupProblem("basemaps", "basemaps must be a list from " + allowed + ", not " + shown(e)));
            return DEFAULT_BASEMAPS;
        }
        JsonArray array = e.getAsJsonArray();
        if (array.isEmpty()) {
            problems.add(new SetupProblem("basemaps", "basemaps must name at least one of " + allowed));
            return DEFAULT_BASEMAPS;
        }
        List<String> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (JsonElement item : array) {
            if (!isString(item) || !BASEMAPS.contains(item.getAsString())) {
                problems.add(new SetupProblem("basemaps", "basemaps has " + shown(item) + "; each entry must be one of "
                    + allowed));
            } else if (!seen.add(item.getAsString())) {
                problems.add(new SetupProblem("basemaps", "basemaps lists " + item.getAsString() + " twice"));
            } else {
                out.add(item.getAsString());
            }
        }
        return List.copyOf(out);
    }
}
