package com.aoindustrial.perspective.mapstudio.common.contract;

import com.inductiveautomation.ignition.common.gson.JsonObject;

/**
 * The state of one host list (kinds or assets) of a project, as {@code map.load}
 * and {@code system.mapstudio.refreshAdapters} report it
 * (docs/kinds-and-assets.md): a stable kebab-case {@code status}, a message in
 * plain words naming the function, the function, how many rows are in use, how
 * many the last call left out, and when the list in use was read (ISO 8601 UTC,
 * or null when there is none).
 *
 * <p>{@code viewerMessage} is the message for a session that cannot edit (level
 * {@code none}): the same words without host error text or row ids ("The kind
 * function my_lib.kinds failed."). Only {@link #toJson(boolean)} with
 * {@code detail} false sends it; it is never a key of its own.
 */
public record AdapterStatus(String status, String message, String function, int count, int left, String refreshedAt,
                            String viewerMessage) {

    /** A status whose message carries nothing a viewer may not see. */
    public AdapterStatus(String status, String message, String function, int count, int left, String refreshedAt) {
        this(status, message, function, count, left, refreshedAt, message);
    }

    public static final String OK = "ok";
    public static final String EMPTY = "empty";
    public static final String FAILING = "failing";
    public static final String SLOW = "slow";
    public static final String INCOMPLETE = "incomplete";
    public static final String NOT_CONFIGURED = "not-configured";
    public static final String LOADING = "loading";

    /** The status with its full message (editing levels, scripts, the Gateway log). */
    public JsonObject toJson() {
        return toJson(true);
    }

    /** The status; {@code detail} false puts {@link #viewerMessage} in {@code message}. */
    public JsonObject toJson(boolean detail) {
        JsonObject o = new JsonObject();
        o.addProperty("status", status);
        o.addProperty("message", detail || viewerMessage == null ? message : viewerMessage);
        o.addProperty("function", function);
        o.addProperty("count", count);
        o.addProperty("left", left);
        o.addProperty("refreshedAt", refreshedAt);
        return o;
    }
}
