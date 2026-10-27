package com.aoindustrial.perspective.mapstudio.common;

import java.util.Set;

/**
 * The message contract between the browser and the Gateway (AD-8).
 *
 * <p>Every message is one JSON object {@code {v, type, id, body}} carried under
 * one model event name in each direction. Types are named {@code area.action}
 * and listed here; a type not listed here is not sent. Every error is a message
 * of type {@link #ERROR} whose body is {@code {code, message}}, plus
 * {@code batchId} and {@code op: {index, id}} when an {@code edits.apply} op is
 * at fault.
 *
 * <p>Contract version {@link #CONTRACT_VERSION} (draft): see {@code docs/contract.md}.
 */
public final class Messages {

    private Messages() {
    }

    /** Envelope version carried in {@code v}. */
    public static final int VERSION = 1;

    /** Public contract version these shapes belong to (AD-9); draft until release 0.2.0. */
    public static final String CONTRACT_VERSION = "0.2.0-draft";

    /** Model event name the envelope travels under, browser to Gateway and back. */
    public static final String EVENT_NAME = "mapstudio.message";

    // Envelope keys.
    public static final String KEY_VERSION = "v";
    public static final String KEY_TYPE = "type";
    public static final String KEY_ID = "id";
    public static final String KEY_BODY = "body";

    // Message types.
    public static final String POINT_CLICK = "point.click";
    public static final String POINT_CLICK_REPLY = "point.click.reply";
    /** Browser asks for the map: body {}. */
    public static final String MAP_LOAD = "map.load";
    /** Body {level, seq, items: [map item record]}. */
    public static final String MAP_LOAD_REPLY = "map.load.reply";
    /** Body {batchId, ops: [{op, entity, id, baseVersion, data}]}. */
    public static final String EDITS_APPLY = "edits.apply";
    /** Body {batchId, seq, results: [{entity, id, version}]}. */
    public static final String EDITS_APPLY_REPLY = "edits.apply.reply";
    /** Body {seq, ops}. Declared in 0.2.0; sent from epic-map-store-and-data entry 4. */
    public static final String MAP_CHANGED = "map.changed";
    public static final String ERROR = "error";

    /** Every type the Gateway accepts from the browser. */
    public static final Set<String> INBOUND_TYPES = Set.of(POINT_CLICK, MAP_LOAD, EDITS_APPLY);

    /** Every type the Gateway sends to the browser. */
    public static final Set<String> OUTBOUND_TYPES =
        Set.of(POINT_CLICK_REPLY, MAP_LOAD_REPLY, EDITS_APPLY_REPLY, MAP_CHANGED, ERROR);

    // Error codes: stable kebab-case words.
    /** A batch's baseVersion is not the stored version. */
    public static final String CODE_CONFLICT = "conflict";
    /** The session or caller has no role that allows the op. */
    public static final String CODE_ROLE = "role";
    /** The message, batch or op is malformed or not supported by this version. */
    public static final String CODE_INVALID = "invalid";
    /** The browser's map is behind the store (a gap in seq); used from entry 4. */
    public static final String CODE_STALE = "stale";
    /** The map store cannot be reached: no setup, no connection, or no schema. */
    public static final String CODE_STORE_UNREACHABLE = "store-unreachable";

    /** Every error code of this contract version. */
    public static final Set<String> CODES =
        Set.of(CODE_CONFLICT, CODE_ROLE, CODE_INVALID, CODE_STALE, CODE_STORE_UNREACHABLE);

    // Editing levels reported by map.load (AD-2).
    public static final String LEVEL_NONE = "none";
    public static final String LEVEL_PHONE = "phone";
    public static final String LEVEL_FULL = "full";
}
