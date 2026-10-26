package com.aoindustrial.perspective.mapstudio.gateway;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.time.format.DateTimeFormatter;

import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.util.LoggerEx;
import com.inductiveautomation.perspective.gateway.api.Component;
import com.inductiveautomation.perspective.gateway.api.ComponentModelDelegate;
import com.inductiveautomation.perspective.gateway.messages.EventFiredMsg;

import com.aoindustrial.perspective.mapstudio.common.Messages;

/**
 * The Gateway side of the Map Studio component: one instance per component
 * instance on an open page. It receives the browser's envelopes through
 * {@link #handleEvent(EventFiredMsg)} and answers with {@link #fireEvent}.
 *
 * <p>No exception escapes {@code handleEvent}: a malformed or unknown message
 * is answered with an {@code error} envelope and logged at warn.
 */
public class MapStudioDelegate extends ComponentModelDelegate {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.delegate");

    private static final DateTimeFormatter ISO_UTC = DateTimeFormatter.ISO_INSTANT;

    public MapStudioDelegate(Component component) {
        super(component);
    }

    @Override
    protected void onStartup() {
        log.debugf("Delegate started for %s", component.getComponentAddressPath());
    }

    @Override
    protected void onShutdown() {
        log.debugf("Delegate stopped for %s", component.getComponentAddressPath());
    }

    @Override
    public void handleEvent(EventFiredMsg message) {
        if (!Messages.EVENT_NAME.equals(message.getEventName())) {
            log.warnf("Ignoring unknown model event '%s'", message.getEventName());
            return;
        }
        JsonObject reply;
        try {
            reply = reply(message.getEvent());
        } catch (RuntimeException ex) {
            log.warn("Failed to handle a message: " + ex.getClass().getSimpleName(), ex);
            reply = error("", Messages.CODE_INVALID, "The message could not be read.");
        }
        try {
            fireEvent(Messages.EVENT_NAME, reply);
        } catch (RuntimeException ex) {
            log.warn("Failed to send a reply: " + ex.getClass().getSimpleName(), ex);
        }
    }

    @Override
    public void fireEvent(String eventName, JsonObject event) {
        this.component.fireEvent("model", eventName, event);
    }

    /**
     * Build the reply to one inbound envelope. Pure: no component access, so it
     * can be reasoned about on its own.
     */
    static JsonObject reply(JsonObject envelope) {
        if (envelope == null) {
            log.warn("Received an empty message.");
            return error("", Messages.CODE_INVALID, "The message is empty.");
        }
        String id = stringOrNull(envelope.get(Messages.KEY_ID));
        String type = stringOrNull(envelope.get(Messages.KEY_TYPE));
        if (id == null || type == null) {
            log.warn("Received a message without an id or a type.");
            return error(id == null ? "" : id, Messages.CODE_INVALID,
                "The message needs an id and a type.");
        }
        JsonElement v = envelope.get(Messages.KEY_VERSION);
        if (v == null || !v.isJsonPrimitive() || !v.getAsJsonPrimitive().isNumber()
                || v.getAsDouble() != Messages.VERSION) {
            log.warnf("Received a message with an unsupported version: %s", v);
            return error(id, Messages.CODE_INVALID,
                "Unsupported message version; expected " + Messages.VERSION + ".");
        }
        JsonElement bodyElement = envelope.get(Messages.KEY_BODY);
        JsonObject body = bodyElement != null && bodyElement.isJsonObject()
            ? bodyElement.getAsJsonObject() : new JsonObject();

        if (!Messages.INBOUND_TYPES.contains(type)) {
            log.warnf("Unknown message type: %s", type);
            return error(id, Messages.CODE_INVALID, "Unknown message type: " + type);
        }
        if (Messages.POINT_CLICK.equals(type)) {
            return pointClickReply(id, body);
        }
        log.warnf("Unhandled message type: %s", type);
        return error(id, Messages.CODE_INVALID, "Unknown message type: " + type);
    }

    private static JsonObject pointClickReply(String id, JsonObject body) {
        String pointId = stringOrNull(body.get("pointId"));
        if (pointId == null) {
            log.warn("point.click without a pointId.");
            return error(id, Messages.CODE_INVALID, "point.click needs a pointId.");
        }
        JsonObject replyBody = new JsonObject();
        replyBody.addProperty("pointId", pointId);
        replyBody.addProperty("receivedAt",
            ISO_UTC.format(Instant.now().truncatedTo(ChronoUnit.MILLIS).atOffset(ZoneOffset.UTC)));
        log.infof("point.click %s for point %s", id, pointId);
        return envelope(Messages.POINT_CLICK_REPLY, id, replyBody);
    }

    static JsonObject envelope(String type, String id, JsonObject body) {
        JsonObject message = new JsonObject();
        message.addProperty(Messages.KEY_VERSION, Messages.VERSION);
        message.addProperty(Messages.KEY_TYPE, type);
        message.addProperty(Messages.KEY_ID, id);
        message.add(Messages.KEY_BODY, body);
        return message;
    }

    static JsonObject error(String id, String code, String text) {
        JsonObject body = new JsonObject();
        body.addProperty("code", code);
        body.addProperty("message", text);
        return envelope(Messages.ERROR, id, body);
    }

    private static String stringOrNull(JsonElement element) {
        if (element == null || !element.isJsonPrimitive() || !element.getAsJsonPrimitive().isString()) {
            return null;
        }
        return element.getAsString();
    }
}
