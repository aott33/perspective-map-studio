package com.aoindustrial.perspective.mapstudio.common.contract;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

import com.aoindustrial.perspective.mapstudio.common.Messages;

/** Epic-editing entry 19b: the settings entity's op shape and the units data rules (S7, S8). */
class SettingsRecordTest {

    static JsonObject json(String s) {
        return JsonParser.parseString(s).getAsJsonObject();
    }

    static String refused(String data) {
        return assertThrows(InvalidValue.class, () -> SettingsRecord.parse(json(data))).getMessage();
    }

    @Test
    void aUnitsOpIsReadWithItsEntityAndId() {
        EditOp op = EditOp.parse(json("{\"op\":\"create\",\"entity\":\"settings\",\"id\":\"units\",\"baseVersion\":0,"
            + "\"data\":{\"system\":\"us\",\"labels\":\"long\"}}"), 0);
        assertEquals(EditOp.ENTITY_SETTINGS, op.entity());
        assertEquals("units", op.id());
        EditOp.parse(json("{\"op\":\"delete\",\"entity\":\"settings\",\"id\":\"units\",\"baseVersion\":2}"), 0);
    }

    @Test
    void anotherSettingsIdIsRefusedInWords() {
        MapStudioException ex = assertThrows(MapStudioException.class, () -> EditOp.parse(json(
            "{\"op\":\"create\",\"entity\":\"settings\",\"id\":\"theme\",\"baseVersion\":0,\"data\":{}}"), 1));
        assertEquals(Messages.CODE_INVALID, ex.code());
        assertEquals("Op 1: a settings id must be units.", ex.plainMessage());
        assertEquals(1, ex.opIndex());
    }

    @Test
    void anUnknownEntityNamesTheThree() {
        MapStudioException ex = assertThrows(MapStudioException.class, () -> EditOp.parse(json(
            "{\"op\":\"create\",\"entity\":\"setting\",\"id\":\"units\",\"baseVersion\":0,\"data\":{}}"), 0));
        assertEquals("Op 0: entity must be item, kindSetup or settings.", ex.plainMessage());
    }

    @Test
    void theDataHoldsExactlySystemAndLabels() {
        SettingsRecord.Values v = SettingsRecord.parse(json("{\"system\":\"auto\",\"labels\":\"short\"}"));
        assertEquals("auto", v.system());
        assertEquals("short", v.labels());
        assertEquals("system must be one of auto, metric, us", refused("{\"system\":\"imperial\",\"labels\":\"short\"}"));
        assertEquals("system must be one of auto, metric, us", refused("{\"labels\":\"short\"}"));
        assertEquals("system must be one of auto, metric, us", refused("{\"system\":1,\"labels\":\"short\"}"));
        assertEquals("labels must be one of short, long", refused("{\"system\":\"us\",\"labels\":\"tiny\"}"));
        assertEquals("labels must be one of short, long", refused("{\"system\":\"us\"}"));
        assertEquals("Unknown field theme in the units data; a units op carries system and labels and nothing else.",
            refused("{\"system\":\"us\",\"labels\":\"long\",\"theme\":\"dark\"}"));
    }

    @Test
    void theRecordReadsBackFromWhatTheStoreKeeps() {
        SettingsRecord r = new SettingsRecord("units", "us", "long", 3, true);
        assertEquals("{\"id\":\"units\",\"system\":\"us\",\"labels\":\"long\",\"version\":3,\"deleted\":true}",
            r.toJson().toString());
        assertEquals("{\"system\":\"us\",\"labels\":\"long\",\"version\":3,\"deleted\":true}", r.storedJson().toString());
        assertEquals("{\"id\":\"units\",\"system\":\"us\",\"labels\":\"long\",\"version\":3}", r.liveJson().toString());
        assertEquals("{\"system\":\"us\",\"labels\":\"long\"}", r.values().toString());
        assertEquals(r, SettingsRecord.fromStored("units", r.storedJson()));
        assertEquals("The units setting", r.name());
    }
}
