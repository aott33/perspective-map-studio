package com.aoindustrial.perspective.mapstudio.common.contract;

import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonNull;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonPrimitive;

/**
 * One live value slot of a map item (AD-6, epic 3 entry 5): {@code {value, quality, t, stale, reason}}.
 * {@code value} is the tag's value as JSON (a number, text, true or false, null before the first
 * delivery; an object for the alarms slot); {@code quality} is Ignition's quality name
 * ({@code Good}, {@code Bad_NotFound}, ...); {@code t} the value's time, ISO 8601 UTC, or null;
 * {@code stale} and {@code reason} are worked out in the Gateway's cache from the quality and the
 * item's comms state (the reason is plain words: {@code "comms lost"}, {@code "no value yet"}, or
 * the quality name; empty when not stale). A reason never holds a tag path: viewers get these.
 */
public record LiveValue(JsonElement value, String quality, String t, boolean stale, String reason) {

    public static final String NO_VALUE_YET = "no value yet";
    public static final String COMMS_LOST = "comms lost";

    /** The slot before anything was delivered: null, quality {@code Uncertain_InitialValue}, stale. */
    public static LiveValue none() {
        return new LiveValue(JsonNull.INSTANCE, "Uncertain_InitialValue", null, true, NO_VALUE_YET);
    }

    /** This value marked stale for {@code reason} (the comms rule), keeping everything else. */
    public LiveValue staleFor(String why) {
        return new LiveValue(value, quality, t, true, why);
    }

    public JsonObject toJson() {
        JsonObject o = new JsonObject();
        o.add("value", value == null ? JsonNull.INSTANCE : value);
        o.addProperty("quality", quality);
        if (t == null) {
            o.add("t", JsonNull.INSTANCE);
        } else {
            o.addProperty("t", t);
        }
        o.addProperty("stale", stale);
        o.addProperty("reason", reason == null ? "" : reason);
        return o;
    }

    /** A tag value as JSON: numbers, text and booleans as they are, anything else as text, null as null. */
    public static JsonElement json(Object value) {
        if (value == null) {
            return JsonNull.INSTANCE;
        }
        if (value instanceof JsonElement e) {
            return e;
        }
        if (value instanceof Boolean b) {
            return new JsonPrimitive(b);
        }
        if (value instanceof Number n) {
            double d = n.doubleValue();
            if (Double.isNaN(d) || Double.isInfinite(d)) {
                return JsonNull.INSTANCE;
            }
            return new JsonPrimitive(n);
        }
        return new JsonPrimitive(String.valueOf(value));
    }
}
