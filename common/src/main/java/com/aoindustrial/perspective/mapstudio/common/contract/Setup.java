package com.aoindustrial.perspective.mapstudio.common.contract;

import java.util.ArrayList;
import java.util.List;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

/**
 * A project's Map Studio setup (AD-5), schema version 1: the project resource
 * {@code com.aoindustrial.perspective.mapstudio/setup/setup.json}.
 *
 * <pre>
 * {"schemaVersion": 1, "connection": "MapStudio",
 *  "roles": {"full": ["MapEditor"], "phone": ["MapOperator"]},
 *  "kindsFunction": "", "assetsFunction": "", "refreshIntervalSeconds": 10,
 *  "alarmPage": "", "basemaps": ["none", "osm"], "tokenSecret": ""}
 * </pre>
 *
 * Only {@code schemaVersion} and {@code connection} are required; every other
 * field has the default shown. Detailed setup validation messages are entry 6's.
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
    public static final List<String> DEFAULT_BASEMAPS = List.of("none", "osm");

    /** Thrown when a setup cannot be read; the message is plain words for the Gateway log. */
    public static final class SetupException extends Exception {
        public SetupException(String message) {
            super(message);
        }
    }

    public static Setup parse(String text) throws SetupException {
        JsonElement element;
        try {
            element = JsonParser.parseString(text);
        } catch (RuntimeException ex) {
            throw new SetupException("setup.json is not valid JSON: " + ex.getMessage());
        }
        if (element == null || !element.isJsonObject()) {
            throw new SetupException("setup.json must be a JSON object.");
        }
        JsonObject o = element.getAsJsonObject();
        JsonElement version = o.get("schemaVersion");
        if (version == null || !version.isJsonPrimitive() || !version.getAsJsonPrimitive().isNumber()) {
            throw new SetupException("setup.json needs schemaVersion " + SCHEMA_VERSION + ".");
        }
        if (version.getAsDouble() != SCHEMA_VERSION) {
            throw new SetupException("setup.json has schemaVersion " + version + "; this module reads version "
                + SCHEMA_VERSION + ".");
        }
        String connection = string(o, "connection", "");
        if (connection.isBlank()) {
            throw new SetupException("setup.json needs the name of a database connection in \"connection\".");
        }
        List<String> full = List.of();
        List<String> phone = List.of();
        JsonElement roles = o.get("roles");
        if (roles != null && !roles.isJsonNull()) {
            if (!roles.isJsonObject()) {
                throw new SetupException("setup.json \"roles\" must be an object {full: [...], phone: [...]}.");
            }
            full = strings(roles.getAsJsonObject(), "full", "roles.full");
            phone = strings(roles.getAsJsonObject(), "phone", "roles.phone");
        }
        int refresh = DEFAULT_REFRESH_SECONDS;
        JsonElement r = o.get("refreshIntervalSeconds");
        if (r != null && !r.isJsonNull()) {
            if (!r.isJsonPrimitive() || !r.getAsJsonPrimitive().isNumber() || r.getAsInt() < 1) {
                throw new SetupException("setup.json \"refreshIntervalSeconds\" must be a whole number of seconds, 1 or more.");
            }
            refresh = r.getAsInt();
        }
        List<String> basemaps = o.has("basemaps") ? strings(o, "basemaps", "basemaps") : DEFAULT_BASEMAPS;
        return new Setup(SCHEMA_VERSION, connection, full, phone, string(o, "kindsFunction", ""),
            string(o, "assetsFunction", ""), refresh, string(o, "alarmPage", ""), basemaps,
            string(o, "tokenSecret", ""));
    }

    private static String string(JsonObject o, String key, String fallback) {
        JsonElement e = o.get(key);
        if (e == null || e.isJsonNull()) {
            return fallback;
        }
        return e.isJsonPrimitive() && e.getAsJsonPrimitive().isString() ? e.getAsString() : fallback;
    }

    private static List<String> strings(JsonObject o, String key, String label) throws SetupException {
        JsonElement e = o.get(key);
        if (e == null || e.isJsonNull()) {
            return List.of();
        }
        if (!e.isJsonArray()) {
            throw new SetupException("setup.json \"" + label + "\" must be a list of names.");
        }
        List<String> out = new ArrayList<>();
        for (JsonElement item : (JsonArray) e) {
            if (!item.isJsonPrimitive() || !item.getAsJsonPrimitive().isString()) {
                throw new SetupException("setup.json \"" + label + "\" must be a list of names.");
            }
            out.add(item.getAsString());
        }
        return List.copyOf(out);
    }
}
