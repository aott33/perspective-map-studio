package com.aoindustrial.perspective.mapstudio.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.inductiveautomation.ignition.common.gson.JsonObject;
import org.junit.jupiter.api.Test;

/** The I/O matrix of story 1's plan, one test per row. */
class MapStudioDelegateTest {

    private static JsonObject envelope(Integer v, String type, String id, JsonObject body) {
        JsonObject message = new JsonObject();
        if (v != null) {
            message.addProperty("v", v);
        }
        if (type != null) {
            message.addProperty("type", type);
        }
        if (id != null) {
            message.addProperty("id", id);
        }
        message.add("body", body == null ? new JsonObject() : body);
        return message;
    }

    @Test
    void pointClickRepliesWithTheSameIdAndThePoint() {
        JsonObject body = new JsonObject();
        body.addProperty("pointId", "p1");
        JsonObject reply = MapStudioDelegate.reply(envelope(1, "point.click", "abc", body));
        assertEquals(1, reply.get("v").getAsInt());
        assertEquals("point.click.reply", reply.get("type").getAsString());
        assertEquals("abc", reply.get("id").getAsString());
        assertEquals("p1", reply.getAsJsonObject("body").get("pointId").getAsString());
        assertEquals(true, reply.getAsJsonObject("body").get("receivedAt").getAsString().endsWith("Z"));
    }

    @Test
    void unknownTypeGetsAnInvalidError() {
        JsonObject reply = MapStudioDelegate.reply(envelope(1, "nope", "x", null));
        assertEquals("error", reply.get("type").getAsString());
        assertEquals("x", reply.get("id").getAsString());
        assertEquals("invalid", reply.getAsJsonObject("body").get("code").getAsString());
        assertEquals("Unknown message type: nope", reply.getAsJsonObject("body").get("message").getAsString());
    }

    @Test
    void missingIdOrTypeGetsAnInvalidError() {
        JsonObject noId = MapStudioDelegate.reply(envelope(1, "point.click", null, null));
        assertEquals("error", noId.get("type").getAsString());
        assertEquals("invalid", noId.getAsJsonObject("body").get("code").getAsString());
        JsonObject noType = MapStudioDelegate.reply(envelope(1, null, "y", null));
        assertEquals("error", noType.get("type").getAsString());
        assertEquals("y", noType.get("id").getAsString());
        assertEquals("invalid", noType.getAsJsonObject("body").get("code").getAsString());
    }

    @Test
    void wrongOrFractionalVersionGetsAnInvalidError() {
        JsonObject body = new JsonObject();
        body.addProperty("pointId", "p1");
        assertEquals("error", MapStudioDelegate.reply(envelope(2, "point.click", "a", body)).get("type").getAsString());
        JsonObject fractional = envelope(null, "point.click", "b", body);
        fractional.addProperty("v", 1.5);
        assertEquals("error", MapStudioDelegate.reply(fractional).get("type").getAsString());
    }

    @Test
    void pointClickWithoutAPointIdGetsAnInvalidError() {
        JsonObject reply = MapStudioDelegate.reply(envelope(1, "point.click", "c", null));
        assertEquals("error", reply.get("type").getAsString());
        assertEquals("invalid", reply.getAsJsonObject("body").get("code").getAsString());
    }

    @Test
    void nullMessageGetsAnInvalidError() {
        JsonObject reply = MapStudioDelegate.reply(null);
        assertEquals("error", reply.get("type").getAsString());
        assertEquals("invalid", reply.getAsJsonObject("body").get("code").getAsString());
    }
}
