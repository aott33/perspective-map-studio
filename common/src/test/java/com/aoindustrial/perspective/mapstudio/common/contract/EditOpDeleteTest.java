package com.aoindustrial.perspective.mapstudio.common.contract;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

import com.aoindustrial.perspective.mapstudio.common.Messages;

/** Epic 2 story 2's op shapes: delete, restore, one op per id, and the conflict body. */
class EditOpDeleteTest {

    static final String ID = "6f1c2a8e-3b5d-4c7e-9f10-2a3b4c5d6e7f";
    static final String BATCH = "0b7e5f0e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";

    static JsonObject json(String s) {
        return JsonParser.parseString(s).getAsJsonObject();
    }

    @Test
    void aDeleteWithNoDataOrEmptyDataIsReadAndSupported() {
        EditBatch b = EditBatch.parse(json("{\"batchId\":\"" + BATCH + "\",\"ops\":[{\"op\":\"delete\","
            + "\"entity\":\"item\",\"id\":\"" + ID + "\",\"baseVersion\":4}]}"));
        assertEquals("delete", b.ops().get(0).op());
        assertEquals(4, b.ops().get(0).baseVersion());
        EditOp.parse(json("{\"op\":\"delete\",\"entity\":\"item\",\"id\":\"" + ID + "\",\"baseVersion\":1,\"data\":{}}"), 0);
    }

    @Test
    void aDeleteWithDataOrWithoutAVersionIsInvalid() {
        MapStudioException data = assertThrows(MapStudioException.class, () -> EditOp.parse(json(
            "{\"op\":\"delete\",\"entity\":\"item\",\"id\":\"" + ID + "\",\"baseVersion\":1,\"data\":{\"name\":\"x\"}}"), 3));
        assertEquals(Messages.CODE_INVALID, data.code());
        assertEquals(3, data.opIndex());
        assertThrows(MapStudioException.class, () -> EditOp.parse(json(
            "{\"op\":\"delete\",\"entity\":\"item\",\"id\":\"" + ID + "\",\"baseVersion\":0}"), 0));
    }

    @Test
    void aCreateAtAVersionAboveZeroIsARestoreShape() {
        EditOp op = EditOp.parse(json("{\"op\":\"create\",\"entity\":\"item\",\"id\":\"" + ID + "\",\"baseVersion\":2,"
            + "\"data\":{\"kind\":\"pad\"}}"), 0);
        assertEquals(2, op.baseVersion());
    }

    @Test
    void twoOpsOnOneIdAreInvalidNamingTheSecond() {
        MapStudioException ex = assertThrows(MapStudioException.class, () -> EditBatch.parse(json(
            "{\"batchId\":\"" + BATCH + "\",\"ops\":[{\"op\":\"update\",\"entity\":\"item\",\"id\":\"" + ID
            + "\",\"baseVersion\":1,\"data\":{\"name\":\"a\"}},{\"op\":\"delete\",\"entity\":\"item\",\"id\":\"" + ID
            + "\",\"baseVersion\":2}]}")));
        assertEquals(Messages.CODE_INVALID, ex.code());
        assertEquals(1, ex.opIndex());
        assertEquals(ID, ex.opId());
    }

    @Test
    void aMapItemIdIsCanonicalLowerCaseSoMixedCaseDuplicatesAreOneId() {
        String upper = ID.toUpperCase(java.util.Locale.ROOT);
        EditOp op = EditOp.parse(json("{\"op\":\"update\",\"entity\":\"item\",\"id\":\"" + upper
            + "\",\"baseVersion\":1,\"data\":{\"name\":\"a\"}}"), 0);
        assertEquals(ID, op.id());
        MapStudioException ex = assertThrows(MapStudioException.class, () -> EditBatch.parse(json(
            "{\"batchId\":\"" + BATCH + "\",\"ops\":[{\"op\":\"update\",\"entity\":\"item\",\"id\":\"" + upper
            + "\",\"baseVersion\":1,\"data\":{\"name\":\"a\"}},{\"op\":\"update\",\"entity\":\"item\",\"id\":\"" + ID
            + "\",\"baseVersion\":1,\"data\":{\"geometry\":{\"type\":\"Point\",\"coordinates\":[1,2]}}}]}")));
        assertEquals(Messages.CODE_INVALID, ex.code());
        assertEquals(1, ex.opIndex());
        assertEquals(ID, ex.opId());
    }

    @Test
    void aConflictRefusalCarriesItsConflictsInTheErrorBody() {
        MapItemRecord current = new MapItemRecord(ID, "pad", "P12", json("{\"type\":\"Point\",\"coordinates\":[1,2]}"),
            new JsonObject(), null, new JsonObject(), null, null, 2, false);
        JsonArray conflicts = new JsonArray();
        conflicts.add(new Conflict(0, "item", ID, 1, current, "alex", "2026-10-26T14:02:00Z").toJson());
        JsonObject body = new MapStudioException(Messages.CODE_CONFLICT, "P12 was changed.", 0, ID, conflicts)
            .toErrorBody();
        assertEquals("conflict", body.get("code").getAsString());
        JsonObject c = body.getAsJsonArray("conflicts").get(0).getAsJsonObject();
        assertEquals(1, c.get("baseVersion").getAsInt());
        assertEquals(2, c.getAsJsonObject("current").get("version").getAsInt());
        assertEquals("alex", c.get("changedBy").getAsString());
        assertEquals("2026-10-26T14:02:00Z", c.get("changedAt").getAsString());
        assertTrue(new MapStudioException(Messages.CODE_ROLE, "no").toErrorBody().get("conflicts") == null);
        assertTrue(new Conflict(0, "item", ID, 1, current, null, null).toJson().get("changedBy").isJsonNull());
    }
}
