package com.aoindustrial.perspective.mapstudio.common.contract;

import static com.aoindustrial.perspective.mapstudio.common.contract.KindFixtures.PAD;
import static com.aoindustrial.perspective.mapstudio.common.contract.KindFixtures.TAP;
import static com.aoindustrial.perspective.mapstudio.common.contract.KindFixtures.json;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonParser;

/** The attachment on the map item record (epic 2 story 14): parsing, the record field and the kind check. */
class AttachmentTest {

    static final String ID = "4f6c9a1b-2c3d-4e5f-8a9b-0c1d2e3f4a5b";
    static final String LINE_ID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
    static final String POINT = "{\"type\":\"Point\",\"coordinates\":[-103.508,31.9204]}";

    @Test
    void anAttachmentIsTheLineIdInLowerCaseAndTheDistanceToATenthOfAMetre() {
        Attachment a = Attachment.parse(JsonParser.parseString("{\"lineId\":\"" + LINE_ID.toUpperCase()
            + "\",\"distanceM\":1143.04999}"));
        assertEquals(LINE_ID, a.lineId());
        assertEquals(1143.0, a.distanceM());
        assertEquals(1143.1, Attachment.parse(json("{\"lineId\":\"" + LINE_ID + "\",\"distanceM\":1143.05}")).distanceM(),
            "half up");
        assertEquals(0.0, Attachment.parse(json("{\"lineId\":\"" + LINE_ID + "\",\"distanceM\":0}")).distanceM());
        assertEquals(json("{\"lineId\":\"" + LINE_ID + "\",\"distanceM\":1143.0}"), a.toJson());
    }

    @Test
    void aBadAttachmentIsRefusedInPlainWords() {
        assertEquals("attachment.distanceM must be 0 or more (metres from the line's first vertex), not -1.",
            refused("{\"lineId\":\"" + LINE_ID + "\",\"distanceM\":-1}"));
        assertEquals("attachment.lineId must be the id of a line map item (a UUID).",
            refused("{\"lineId\":\"L-SWD\",\"distanceM\":1}"));
        assertEquals("attachment.lineId must be the id of a line map item (a UUID).", refused("{\"distanceM\":1}"));
        assertEquals("attachment.distanceM must be a number of metres along the line.",
            refused("{\"lineId\":\"" + LINE_ID + "\",\"distanceM\":\"12\"}"));
        assertEquals("attachment: segment is not a key here; the keys are distanceM, lineId.",
            refused("{\"lineId\":\"" + LINE_ID + "\",\"distanceM\":1,\"segment\":2}"));
        assertTrue(refused("[1,2]").startsWith("attachment must be"));
    }

    @Test
    void theRecordCarriesTheAttachmentAndAnUpdateCanClearIt() {
        MapItemRecord tap = MapItemRecord.fromCreate(ID, json("{\"kind\":\"tap\",\"name\":\"PT-1\",\"geometry\":" + POINT
            + ",\"attachment\":{\"lineId\":\"" + LINE_ID + "\",\"distanceM\":1143}}"), 0);
        assertEquals(new Attachment(LINE_ID, 1143.0), tap.attachment());
        assertEquals(json("{\"lineId\":\"" + LINE_ID + "\",\"distanceM\":1143.0}"),
            tap.toJson().getAsJsonObject("attachment"));
        MapItemRecord moved = tap.updatedWith(json("{\"name\":\"PT-1A\"}"), 0);
        assertEquals(tap.attachment(), moved.attachment(), "an update that does not carry attachment keeps it");
        MapItemRecord free = tap.updatedWith(json("{\"attachment\":null}"), 0);
        assertNull(free.attachment());
        assertTrue(free.toJson().get("attachment").isJsonNull());
        MapStudioException ex = assertThrows(MapStudioException.class, () -> tap.updatedWith(
            json("{\"attachment\":{\"lineId\":\"" + LINE_ID + "\",\"distanceM\":-2}}"), 3));
        assertEquals("invalid: Op 3 (" + ID + "): attachment.distanceM must be 0 or more (metres from the line's first vertex),"
            + " not -2.", ex.getMessage());
        assertEquals(tap.attachment(), tap.at(5, true).attachment(), "a tombstone keeps it, so a restore can bring it back");
    }

    @Test
    void onlyAnInstrumentKindTakesAnAttachment() {
        MapItemRecord tap = MapItemRecord.fromCreate(ID, json("{\"kind\":\"tap\",\"name\":\"PT-1\",\"geometry\":" + POINT
            + ",\"attachment\":{\"lineId\":\"" + LINE_ID + "\",\"distanceM\":1143}}"), 0);
        assertEquals(tap.attachment(), ItemCheck.check(tap, TAP).attachment());
        MapItemRecord freeTap = MapItemRecord.fromCreate(ID, json("{\"kind\":\"tap\",\"name\":\"PT-9\",\"geometry\":"
            + POINT + "}"), 0);
        assertNull(ItemCheck.check(freeTap, TAP).attachment(), "optional on an instrument kind (owner, 2026-10-27)");
        MapItemRecord pad = MapItemRecord.fromCreate(ID, json("{\"kind\":\"pad\",\"name\":\"P12\",\"geometry\":" + POINT
            + ",\"attachment\":{\"lineId\":\"" + LINE_ID + "\",\"distanceM\":1143}}"), 0);
        assertEquals("attachment: kind pad is not an instrument kind, so its map items are not attached to a line;"
            + " send attachment null, or mark the kind instrument true in the kind list.",
            assertThrows(InvalidValue.class, () -> ItemCheck.check(pad, PAD)).getMessage());
    }

    private static String refused(String value) {
        return assertThrows(InvalidValue.class, () -> Attachment.parse(JsonParser.parseString(value))).getMessage();
    }
}
