package com.aoindustrial.perspective.mapstudio.common.contract;

import com.inductiveautomation.ignition.common.gson.JsonObject;

/**
 * The state of one host list (kinds or assets) of a project, as {@code map.load}
 * and {@code system.mapstudio.refreshAdapters} report it
 * (docs/kinds-and-assets.md): a stable kebab-case {@code status}, a message in
 * plain words naming the function, the function, how many rows are in use, how
 * many the last call left out, and when the list in use was read (ISO 8601 UTC,
 * or null when there is none).
 */
public record AdapterStatus(String status, String message, String function, int count, int left, String refreshedAt) {

    public static final String OK = "ok";
    public static final String EMPTY = "empty";
    public static final String FAILING = "failing";
    public static final String SLOW = "slow";
    public static final String INCOMPLETE = "incomplete";
    public static final String NOT_CONFIGURED = "not-configured";
    public static final String LOADING = "loading";

    public JsonObject toJson() {
        JsonObject o = new JsonObject();
        o.addProperty("status", status);
        o.addProperty("message", message);
        o.addProperty("function", function);
        o.addProperty("count", count);
        o.addProperty("left", left);
        o.addProperty("refreshedAt", refreshedAt);
        return o;
    }
}
