package com.aoindustrial.perspective.mapstudio.common;

import java.util.Set;

/**
 * The message contract between the browser and the Gateway (AD-8).
 *
 * <p>Every message is one JSON object {@code {v, type, id, body}} carried under
 * one model event name in each direction. Types are named {@code area.action}
 * and listed here; a type not listed here is not sent. Every error is a message
 * of type {@link #ERROR} whose body is {@code {code, message}}.
 */
public final class Messages {

    private Messages() {
    }

    /** Contract version carried in {@code v}. */
    public static final int VERSION = 1;

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
    public static final String ERROR = "error";

    /** Every type the Gateway accepts from the browser. */
    public static final Set<String> INBOUND_TYPES = Set.of(POINT_CLICK);

    /** Every type the Gateway sends to the browser. */
    public static final Set<String> OUTBOUND_TYPES = Set.of(POINT_CLICK_REPLY, ERROR);

    // Error codes: stable kebab-case words.
    public static final String CODE_INVALID = "invalid";
}
