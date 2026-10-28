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
 * <p>Contract version {@link #CONTRACT_VERSION}: see {@code docs/contract.md}.
 */
public final class Messages {

    private Messages() {
    }

    /** Envelope version carried in {@code v}. */
    public static final int VERSION = 1;

    /** Public contract version these shapes belong to (AD-9); 0.3.0 is epic-viewing's (unreleased). */
    public static final String CONTRACT_VERSION = "0.3.0";

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
    /**
     * Body {level, seq, items: [map item record], kinds, assets, adapters, readOnly: reason or null,
     * setup?: {refreshIntervalSeconds, basemaps, alarmPage}}; {@code setup} is optional (added in
     * 0.2.0 by epic 2 entry 6).
     */
    public static final String MAP_LOAD_REPLY = "map.load.reply";
    /** Body {batchId, ops: [{op, entity, id, baseVersion, data}]}. */
    public static final String EDITS_APPLY = "edits.apply";
    /** Body {batchId, seq, results: [{entity, id, version}]}. */
    public static final String EDITS_APPLY_REPLY = "edits.apply.reply";
    /**
     * Body {seq, batchId, actor, ops: [{op, entity, id, version, record}]}, record the full stored
     * record after the op; sent to every open map of the project after each committed batch (entry 4).
     */
    public static final String MAP_CHANGED = "map.changed";
    public static final String ERROR = "error";
    /** Browser lists tag providers and one folder's children: body {provider?, folder?} (entry 15). */
    public static final String TAGS_BROWSE = "tags.browse";
    /**
     * Body {provider, folder, providers: [{name, isDefault}], children: [{name, path, type, dataType,
     * hasChildren}], truncated}; at most 1000 children, ordered by name (entry 15).
     */
    public static final String TAGS_BROWSE_REPLY = "tags.browse.reply";
    /** Browser turns a picked tag path asset-relative: body {kindId, assetId, path} (entry 15). */
    public static final String TAGS_RESOLVE = "tags.resolve";
    /** Body {path, relative, n?, m?}: {@code n} and {@code m} only when {@code relative} (entry 15). */
    public static final String TAGS_RESOLVE_REPLY = "tags.resolve.reply";
    /**
     * Live values to an open map (AD-6, epic 3 entry 5): body {seq, full, items: [{id, comms?, kpis: {key:
     * LiveValue}, alarms?, problems: [{slot, reason}]}], kindDisplay?: [...]}; {@code full} carries every live
     * map item and the kind display list, a changes-only batch the items that changed since the last one.
     */
    public static final String VALUES_BATCH = "values.batch";
    /** The browser opened a map item's popup: body {itemId}; its values are pushed on change until closed (AD-7). */
    public static final String POPUP_OPEN = "popup.open";
    /** The browser closed the popup: body {itemId}. */
    public static final String POPUP_CLOSE = "popup.close";
    /**
     * The browser asks for a basemap's tile source (epic 3 entry 6, AD-12): body {basemap}; only
     * {@code satellite} is asked for, its token read on the Gateway from the setup's secret.
     */
    public static final String BASEMAP_SOURCE = "basemap.source";
    /** Body {basemap, provider, tiles: [url template], tileSize, maxzoom, attribution}: a raster tile source. */
    public static final String BASEMAP_SOURCE_REPLY = "basemap.source.reply";

    /** Every type the Gateway accepts from the browser. */
    public static final Set<String> INBOUND_TYPES =
        Set.of(POINT_CLICK, MAP_LOAD, EDITS_APPLY, TAGS_BROWSE, TAGS_RESOLVE, POPUP_OPEN, POPUP_CLOSE, BASEMAP_SOURCE);

    /** Every type the Gateway sends to the browser. */
    public static final Set<String> OUTBOUND_TYPES =
        Set.of(POINT_CLICK_REPLY, MAP_LOAD_REPLY, EDITS_APPLY_REPLY, MAP_CHANGED, ERROR, TAGS_BROWSE_REPLY,
            TAGS_RESOLVE_REPLY, VALUES_BATCH, BASEMAP_SOURCE_REPLY);

    // Error codes: stable kebab-case words.
    /** A batch's baseVersion is not the stored version. */
    public static final String CODE_CONFLICT = "conflict";
    /** The session or caller has no role that allows the op. */
    public static final String CODE_ROLE = "role";
    /** The message, batch or op is malformed or not supported by this version. */
    public static final String CODE_INVALID = "invalid";
    /**
     * Reserved: the browser's map is behind the store (a gap in seq). Nothing sends it today; a gap
     * makes the browser reload with map.load instead (owner decision, epic 2 story 12).
     */
    public static final String CODE_STALE = "stale";
    /** The map store cannot be reached: no setup, no connection, or no schema. */
    public static final String CODE_STORE_UNREACHABLE = "store-unreachable";
    /**
     * The map can be read but not saved here: the map store's schema is newer than
     * this module, or this Gateway is the standby of a redundant pair (epic 2 story 5).
     */
    public static final String CODE_READ_ONLY = "read-only";

    /** The tag system did not answer a tag lookup within 5 s, or failed (entry 15, added in 0.2.0). */
    public static final String CODE_TAGS_UNAVAILABLE = "tags-unavailable";

    /**
     * The basemap token cannot be used (epic 3 entry 6, added in 0.3.0): the setup names no secret, the
     * provider or the secret is missing, it cannot be read, it is empty, or it is not a public token.
     * The message names the secret, never its value.
     */
    public static final String CODE_TOKEN_UNAVAILABLE = "token-unavailable";

    /** Every error code of this contract version. */
    public static final Set<String> CODES = Set.of(CODE_CONFLICT, CODE_ROLE, CODE_INVALID, CODE_STALE,
        CODE_STORE_UNREACHABLE, CODE_READ_ONLY, CODE_TAGS_UNAVAILABLE, CODE_TOKEN_UNAVAILABLE);

    // Editing levels reported by map.load (AD-2).
    public static final String LEVEL_NONE = "none";
    public static final String LEVEL_PHONE = "phone";
    public static final String LEVEL_FULL = "full";
}
