package com.aoindustrial.perspective.mapstudio.common.contract;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

import com.aoindustrial.perspective.mapstudio.common.Messages;

/** The shared contracts (0.3.0, epic 3 entry 5 added the live value types): codes, types, the batch and op shapes, the record and the setup. */
class ContractTest {

    static final String ID = "6f1c2a8e-3b5d-4c7e-9f10-2a3b4c5d6e7f";
    static final String BATCH = "0b7e5f0e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";

    static JsonObject json(String s) {
        return JsonParser.parseString(s).getAsJsonObject();
    }

    @Test
    void theErrorCodesAndTypesAreTheContractsOnes() {
        assertEquals(Set.of("conflict", "role", "invalid", "stale", "store-unreachable", "read-only",
            "tags-unavailable"), Messages.CODES);
        assertEquals(Set.of("point.click", "map.load", "edits.apply", "tags.browse", "tags.resolve", "popup.open",
            "popup.close"), Messages.INBOUND_TYPES);
        assertTrue(Messages.OUTBOUND_TYPES.containsAll(
            Set.of("map.load.reply", "edits.apply.reply", "map.changed", "error", "tags.browse.reply",
                "tags.resolve.reply", "values.batch")));
        assertEquals("0.3.0", Messages.CONTRACT_VERSION);
        assertEquals(1, Messages.VERSION);
    }

    @Test
    void aBatchIsReadWithItsOps() {
        EditBatch b = EditBatch.parse(json("{\"batchId\":\"" + BATCH + "\",\"ops\":[{\"op\":\"create\",\"entity\":\"item\","
            + "\"id\":\"" + ID + "\",\"baseVersion\":0,\"data\":{\"kind\":\"line\"}}]}"));
        assertEquals(BATCH, b.batchId());
        assertEquals(1, b.ops().size());
        EditOp op = b.ops().get(0);
        assertEquals("create", op.op());
        assertEquals("item", op.entity());
        assertEquals(ID, op.id());
        assertEquals(0, op.baseVersion());
        assertEquals(0, op.index());
    }

    @Test
    void malformedOpsAreInvalidAndNamed() {
        MapStudioException createWithVersion = assertThrows(MapStudioException.class, () -> EditOp.parse(json(
            "{\"op\":\"create\",\"entity\":\"item\",\"id\":\"" + ID + "\",\"baseVersion\":-1}"), 2));
        assertEquals(Messages.CODE_INVALID, createWithVersion.code());
        assertEquals(2, createWithVersion.opIndex());
        assertEquals(ID, createWithVersion.opId());
        assertThrows(MapStudioException.class, () -> EditOp.parse(json(
            "{\"op\":\"update\",\"entity\":\"item\",\"id\":\"" + ID + "\",\"baseVersion\":0}"), 0));
        assertThrows(MapStudioException.class, () -> EditOp.parse(json(
            "{\"op\":\"update\",\"entity\":\"item\",\"id\":\"" + ID + "\",\"baseVersion\":1.5}"), 0));
        assertThrows(MapStudioException.class, () -> EditOp.parse(json(
            "{\"op\":\"update\",\"entity\":\"thing\",\"id\":\"" + ID + "\",\"baseVersion\":1}"), 0));
        assertThrows(MapStudioException.class, () -> EditOp.parse(json(
            "{\"op\":\"update\",\"entity\":\"item\",\"id\":\"p1\",\"baseVersion\":1}"), 0));
        assertThrows(MapStudioException.class, () -> EditOp.parse(JsonParser.parseString("[]"), 0));
        assertThrows(MapStudioException.class, () -> EditBatch.parse(json("{\"batchId\":\"" + BATCH + "\",\"ops\":[]}")));
    }

    @Test
    void aMapItemRecordIsClosedAndTyped() {
        MapItemRecord r = MapItemRecord.fromCreate(ID, json("{\"kind\":\"pad\",\"name\":\"P1\","
            + "\"geometry\":{\"type\":\"Point\",\"coordinates\":[-104.9903001,39.7392]}}"), 0);
        JsonObject o = r.toJson();
        assertEquals(Set.of("id", "kind", "name", "geometry", "properties", "assetId", "overrides", "ends", "attachment",
            "version", "deleted"), o.keySet());
        assertTrue(o.get("attachment").isJsonNull(), "attachment is null on every map item but an attached instrument");
        assertEquals(1, o.get("version").getAsInt());
        assertEquals(false, o.get("deleted").getAsBoolean());
        assertTrue(o.get("assetId").isJsonNull());
        assertEquals(-104.9903, o.getAsJsonObject("geometry").getAsJsonArray("coordinates").get(0).getAsDouble());
        assertThrows(MapStudioException.class, () -> MapItemRecord.fromCreate(ID, json("{\"kind\":\"pad\","
            + "\"geometry\":{\"type\":\"Point\",\"coordinates\":[0,0]},\"color\":\"red\"}"), 0));
        assertThrows(MapStudioException.class, () -> MapItemRecord.fromCreate(ID, json("{\"kind\":\"pad\"}"), 0));
        assertThrows(MapStudioException.class, () -> MapItemRecord.fromCreate(ID, json("{\"kind\":\"pad\","
            + "\"geometry\":{\"type\":\"Polygon\",\"coordinates\":[]}}"), 0));
        MapItemRecord updated = r.updatedWith(json("{\"assetId\":\"P1-ASSET\"}"), 0);
        assertEquals(2, updated.version());
        assertEquals("P1", updated.name());
        assertEquals("P1-ASSET", updated.assetId());
        assertThrows(MapStudioException.class, () -> r.updatedWith(new JsonObject(), 0));
        assertThrows(MapStudioException.class, () -> r.updatedWith(json("{\"version\":7}"), 0));
    }

    @Test
    void setupVersionOneWithDefaults() throws Exception {
        Setup s = Setup.parse("{\"schemaVersion\":1,\"connection\":\"MapStudio\","
            + "\"roles\":{\"full\":[\"MapEditor\"],\"phone\":[\"MapOperator\"]}}");
        assertEquals("MapStudio", s.connection());
        assertEquals(List.of("MapEditor"), s.fullRoles());
        assertEquals(List.of("MapOperator"), s.phoneRoles());
        assertEquals(10, s.refreshIntervalSeconds());
        assertEquals(List.of("none", "osm"), s.basemaps());
        assertEquals("", s.kindsFunction());
        assertEquals("", s.tokenSecret());
    }

    @Test
    void setupsThatCannotBeReadSayWhy() {
        Setup.SetupException noConnection = assertThrows(Setup.SetupException.class,
            () -> Setup.parse("{\"schemaVersion\":1}"));
        assertTrue(noConnection.getMessage().contains("connection"));
        Setup.SetupException version = assertThrows(Setup.SetupException.class,
            () -> Setup.parse("{\"schemaVersion\":2,\"connection\":\"MapStudio\"}"));
        assertTrue(version.getMessage().contains("newer Map Studio (schema 2"));
        assertThrows(Setup.SetupException.class, () -> Setup.parse("not json"));
        assertThrows(Setup.SetupException.class,
            () -> Setup.parse("{\"schemaVersion\":1,\"connection\":\"MapStudio\",\"roles\":{\"full\":\"MapEditor\"}}"));
    }

    @Test
    void anErrorBodyNamesTheOp() {
        JsonObject body = new MapStudioException(Messages.CODE_CONFLICT, "changed", 1, ID).toErrorBody();
        assertEquals("conflict", body.get("code").getAsString());
        assertEquals("changed", body.get("message").getAsString());
        assertEquals(1, body.getAsJsonObject("op").get("index").getAsInt());
        assertEquals(ID, body.getAsJsonObject("op").get("id").getAsString());
        assertNull(new MapStudioException(Messages.CODE_ROLE, "no").toErrorBody().get("op"));
    }
}
