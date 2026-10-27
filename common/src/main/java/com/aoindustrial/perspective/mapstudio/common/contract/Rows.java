package com.aoindustrial.perspective.mapstudio.common.contract;

import java.util.List;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;

/**
 * Small readers shared by the kind list and asset list parsers. Each reader
 * returns null for a missing key and throws {@link RowException} with a plain
 * reason for a value of the wrong type. Unknown keys are ignored by the callers.
 */
final class Rows {

    /** Ids (kind ids, asset ids, form field keys) are at most this many characters. */
    static final int MAX_ID = 64;

    /** A row that cannot be used; the message is the reason, in plain words. */
    static final class RowException extends Exception {
        RowException(String message) {
            super(message);
        }
    }

    private Rows() {
    }

    static String string(JsonObject o, String key) throws RowException {
        JsonElement e = o.get(key);
        if (e == null || e.isJsonNull()) {
            return null;
        }
        if (!e.isJsonPrimitive() || !e.getAsJsonPrimitive().isString()) {
            throw new RowException(key + " must be text");
        }
        return e.getAsString();
    }

    static String requiredString(JsonObject o, String key) throws RowException {
        String s = string(o, key);
        if (s == null || s.isBlank()) {
            throw new RowException("no " + key);
        }
        return s;
    }

    static String id(JsonObject o, String key) throws RowException {
        String s = requiredString(o, key);
        if (s.length() > MAX_ID) {
            throw new RowException(key + " is longer than " + MAX_ID + " characters");
        }
        return s;
    }

    static Integer integer(JsonObject o, String key) throws RowException {
        JsonElement e = o.get(key);
        if (e == null || e.isJsonNull()) {
            return null;
        }
        if (!e.isJsonPrimitive() || !e.getAsJsonPrimitive().isNumber()) {
            throw new RowException(key + " must be a whole number");
        }
        double d = e.getAsDouble();
        if (d != Math.rint(d) || Math.abs(d) > Integer.MAX_VALUE) {
            throw new RowException(key + " must be a whole number");
        }
        return (int) d;
    }

    static Boolean bool(JsonObject o, String key) throws RowException {
        JsonElement e = o.get(key);
        if (e == null || e.isJsonNull()) {
            return null;
        }
        if (!e.isJsonPrimitive() || !e.getAsJsonPrimitive().isBoolean()) {
            throw new RowException(key + " must be true or false");
        }
        return e.getAsBoolean();
    }

    static JsonArray array(JsonObject o, String key) throws RowException {
        JsonElement e = o.get(key);
        if (e == null || e.isJsonNull()) {
            return null;
        }
        if (!e.isJsonArray()) {
            throw new RowException(key + " must be a list");
        }
        return e.getAsJsonArray();
    }

    /** "row 3" or "row 3 (id pad)", for a reason. */
    static String where(int index, JsonElement row) {
        String label = "row " + (index + 1);
        if (row != null && row.isJsonObject()) {
            JsonElement id = row.getAsJsonObject().get("id");
            if (id != null && id.isJsonPrimitive() && id.getAsJsonPrimitive().isString()) {
                String s = id.getAsString();
                if (s.length() > MAX_ID) {
                    s = s.substring(0, MAX_ID) + "...";
                }
                return label + " (id " + s + ")";
            }
        }
        return label;
    }

    static String joinFirst(List<String> reasons, int n) {
        return String.join("; ", reasons.subList(0, Math.min(n, reasons.size())));
    }
}
