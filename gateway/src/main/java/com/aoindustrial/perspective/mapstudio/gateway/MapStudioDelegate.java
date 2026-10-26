package com.aoindustrial.perspective.mapstudio.gateway;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.RejectedExecutionException;

import com.inductiveautomation.ignition.common.auth.web.WebAuthUser;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.util.LoggerEx;
import com.inductiveautomation.perspective.gateway.api.Component;
import com.inductiveautomation.perspective.gateway.api.ComponentModelDelegate;
import com.inductiveautomation.perspective.gateway.api.Session;
import com.inductiveautomation.perspective.gateway.messages.EventFiredMsg;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.gateway.write.Actor;
import com.aoindustrial.perspective.mapstudio.gateway.write.RoleMatrix;

/**
 * The Gateway side of the Map Studio component: one instance per component
 * instance on an open page. It receives the browser's envelopes through
 * {@link #handleEvent(EventFiredMsg)} and answers with {@link #fireEvent}.
 *
 * <p>{@code point.click} is answered at once. {@code map.load} and
 * {@code edits.apply} read the session's project and user on the event thread
 * (roles from {@code Session.getWebAuthStatus().getUser().getRoles()}, read on
 * every message, docs/platform-checks.md, epic 2 story 1), then run on the
 * module's bounded work pool and answer from there.
 *
 * <p>No exception escapes {@code handleEvent}: a malformed or unknown message
 * is answered with an {@code error} envelope and logged at warn.
 */
public class MapStudioDelegate extends ComponentModelDelegate {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.delegate");

    private static final DateTimeFormatter ISO_UTC = DateTimeFormatter.ISO_INSTANT;

    private final MapStudioServices services;

    public MapStudioDelegate(Component component, MapStudioServices services) {
        super(component);
        this.services = services;
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
        JsonObject envelope = message.getEvent();
        JsonObject reply;
        try {
            JsonObject problem = check(envelope);
            if (problem == null && isStoreType(envelope.get(Messages.KEY_TYPE).getAsString())) {
                submitStoreWork(envelope);
                return;
            }
            reply = problem != null ? problem : reply(envelope);
        } catch (RuntimeException ex) {
            log.warn("Failed to handle a message: " + ex.getClass().getSimpleName(), ex);
            reply = error("", Messages.CODE_INVALID, "The message could not be read.");
        }
        send(reply);
    }

    private void send(JsonObject reply) {
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

    /** What the Gateway sees of the session: its project, its user name (or null) and the user's roles. */
    record SessionView(String project, String userName, Collection<String> roles) {
    }

    private SessionView sessionView() {
        Session session = component.getSession();
        Optional<WebAuthUser> user = session.getWebAuthStatus().getUser();
        return new SessionView(session.getProjectName(), user.map(WebAuthUser::getUserName).orElse(null),
            user.<Collection<String>>map(WebAuthUser::getRoles).orElse(List.of()));
    }

    private void submitStoreWork(JsonObject envelope) {
        String id = envelope.get(Messages.KEY_ID).getAsString();
        String type = envelope.get(Messages.KEY_TYPE).getAsString();
        JsonObject body = body(envelope);
        SessionView view;
        try {
            view = sessionView();
        } catch (RuntimeException ex) {
            log.warn("Could not read the session for " + type + ": " + ex.getClass().getSimpleName(), ex);
            send(error(id, Messages.CODE_INVALID, "The session could not be read."));
            return;
        }
        try {
            services.work.execute(() -> send(storeReply(services, view, type, id, body)));
        } catch (RejectedExecutionException ex) {
            log.debugf("%s %s refused: the work pool is full or stopping.", type, id);
            send(busyReply(id));
        }
    }

    /**
     * The reply to {@code map.load} or {@code edits.apply} for this session. Every
     * refusal becomes an {@code error} envelope; nothing escapes.
     */
    static JsonObject storeReply(MapStudioServices services, SessionView view, String type, String id, JsonObject body) {
        String batchId = null;
        try {
            String level = RoleMatrix.level(services.setups.find(view.project()).orElse(null), view.roles());
            if (Messages.MAP_LOAD.equals(type)) {
                return envelope(Messages.MAP_LOAD_REPLY, id, services.loader.mapLoadReply(view.project(), level));
            }
            JsonElement b = body.get("batchId");
            batchId = b != null && b.isJsonPrimitive() ? b.getAsString() : null;
            String user = view.userName() == null ? "" : view.userName();
            return envelope(Messages.EDITS_APPLY_REPLY, id,
                services.writes.apply(view.project(), body, Actor.session(user), level).toJson());
        } catch (MapStudioException ex) {
            log.debugf("%s %s refused for project %s: %s", type, id, view.project(), ex.getMessage());
            JsonObject errorBody = ex.toErrorBody();
            if (batchId != null) {
                errorBody.addProperty("batchId", batchId);
            }
            return envelope(Messages.ERROR, id, errorBody);
        } catch (RuntimeException ex) {
            log.error("Map Studio failed on " + type + " for project " + view.project() + ": "
                + ex.getClass().getSimpleName(), ex);
            return error(id, Messages.CODE_STORE_UNREACHABLE, "The map store failed; nothing was saved.");
        }
    }

    /**
     * The answer when the module's bounded work pool is full or stopping: {@code store-unreachable}
     * with the reason, so the browser shows it and nothing is saved (docs/contract.md).
     */
    static JsonObject busyReply(String id) {
        return error(id, Messages.CODE_STORE_UNREACHABLE,
            "Map Studio is busy with other map requests; nothing was saved. Try again in a moment.");
    }

    private static boolean isStoreType(String type) {
        return Messages.MAP_LOAD.equals(type) || Messages.EDITS_APPLY.equals(type);
    }

    /**
     * The error reply for an envelope that cannot be handled (empty, no id or type,
     * wrong version, a type not in the contract), or null when it can. Pure.
     */
    static JsonObject check(JsonObject envelope) {
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
        if (!Messages.INBOUND_TYPES.contains(type)) {
            log.warnf("Unknown message type: %s", type);
            return error(id, Messages.CODE_INVALID, "Unknown message type: " + type);
        }
        return null;
    }

    /**
     * Build the reply to one inbound envelope that needs no session or store
     * ({@code point.click}). Pure: no component access, so it can be reasoned about
     * on its own.
     */
    static JsonObject reply(JsonObject envelope) {
        JsonObject problem = check(envelope);
        if (problem != null) {
            return problem;
        }
        String id = envelope.get(Messages.KEY_ID).getAsString();
        String type = envelope.get(Messages.KEY_TYPE).getAsString();
        if (Messages.POINT_CLICK.equals(type)) {
            return pointClickReply(id, body(envelope));
        }
        log.warnf("Unhandled message type: %s", type);
        return error(id, Messages.CODE_INVALID, "Unknown message type: " + type);
    }

    private static JsonObject body(JsonObject envelope) {
        JsonElement bodyElement = envelope.get(Messages.KEY_BODY);
        return bodyElement != null && bodyElement.isJsonObject() ? bodyElement.getAsJsonObject() : new JsonObject();
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
