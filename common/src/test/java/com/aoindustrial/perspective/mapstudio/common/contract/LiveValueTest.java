package com.aoindustrial.perspective.mapstudio.common.contract;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonNull;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonPrimitive;

/** Epic 3 entry 5: the LiveValue slot's wire shape (AD-6). */
class LiveValueTest {

    @Test
    void theSlotHasExactlyTheFiveFields() {
        JsonObject o = new LiveValue(new JsonPrimitive(412.5), "Good", "2026-10-28T10:00:00Z", false, "").toJson();
        assertEquals("[value, quality, t, stale, reason]", o.keySet().toString());
        assertEquals(412.5, o.get("value").getAsDouble());
        assertEquals("Good", o.get("quality").getAsString());
        assertEquals("2026-10-28T10:00:00Z", o.get("t").getAsString());
        assertEquals(false, o.get("stale").getAsBoolean());
        assertEquals("", o.get("reason").getAsString());
    }

    @Test
    void noValueYetIsStaleWithANullValueAndTime() {
        JsonObject o = LiveValue.none().toJson();
        assertTrue(o.get("value").isJsonNull());
        assertTrue(o.get("t").isJsonNull());
        assertTrue(o.get("stale").getAsBoolean());
        assertEquals(LiveValue.NO_VALUE_YET, o.get("reason").getAsString());
    }

    @Test
    void tagValuesBecomeJsonAndStaleForKeepsTheValue() {
        assertEquals(new JsonPrimitive(true), LiveValue.json(Boolean.TRUE));
        assertEquals(new JsonPrimitive(7), LiveValue.json(7));
        assertEquals(new JsonPrimitive("on"), LiveValue.json("on"));
        assertEquals(JsonNull.INSTANCE, LiveValue.json(null));
        assertEquals(JsonNull.INSTANCE, LiveValue.json(Double.NaN));
        LiveValue v = new LiveValue(new JsonPrimitive(1), "Good", null, false, "").staleFor(LiveValue.COMMS_LOST);
        assertTrue(v.stale());
        assertEquals("comms lost", v.reason());
        assertEquals(new JsonPrimitive(1), v.value());
        assertEquals("Good", v.quality());
    }
}
