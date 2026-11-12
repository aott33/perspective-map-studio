package com.aoindustrial.perspective.mapstudio.gateway.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.AdapterStatus;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.SettingsRecord;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.AdapterSnapshot;
import com.aoindustrial.perspective.mapstudio.gateway.change.ChangeEvent;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreGate;

/**
 * Edit mode's units override through the one write path (epic-editing entry 19b, S1 to S8 and S11): set, change,
 * clear, set again, the stale version, the phone and viewer levels, the data rules and a store with no kind list.
 */
class WriteServiceSettingsTest extends WriteFixture {

    static String units(String op, int baseVersion, String data) {
        return "{\"op\":\"" + op + "\",\"entity\":\"settings\",\"id\":\"units\",\"baseVersion\":" + baseVersion
            + (data == null ? "" : ",\"data\":" + data) + "}";
    }

    static String values(String system, String labels) {
        return "{\"system\":\"" + system + "\",\"labels\":\"" + labels + "\"}";
    }

    SettingsRecord stored() {
        return store.committed.settings.get(PROJECT).get("units");
    }

    @Test
    void s1TheFirstSetIsSavedAtVersionOneRecordedAndSentWhole() {
        EditResult r = save(batch(uuid(), units("create", 0, values("us", "long"))));
        assertEquals("settings", r.results().get(0).entity());
        assertEquals("units", r.results().get(0).id());
        assertEquals(1, r.results().get(0).version());
        assertEquals(new SettingsRecord("units", "us", "long", 1, false), stored());
        var edit = store.committed.edits.get(0);
        assertEquals("settings", edit.entity());
        assertEquals("units", edit.entityId());
        assertEquals("create", edit.op());
        assertEquals("units", edit.kind());
        assertNull(edit.name());
        assertNull(edit.before());
        assertEquals("{\"system\":\"us\",\"labels\":\"long\"}", edit.after().toString());

        JsonObject op = ChangeEvent.of(hooked.get(0)).body().getAsJsonArray("ops").get(0).getAsJsonObject();
        assertEquals("settings", op.get("entity").getAsString());
        assertEquals(1, op.get("version").getAsInt());
        assertEquals(JsonParser.parseString("{\"id\":\"units\",\"system\":\"us\",\"labels\":\"long\",\"version\":1,"
            + "\"deleted\":false}"), op.get("record"));
    }

    @Test
    void s2AChangeKeepsBothValuesBeforeAndAfter() {
        save(batch(uuid(), units("create", 0, values("us", "long"))));
        EditResult r = save(batch(uuid(), units("update", 1, values("metric", "long"))));
        assertEquals(2, r.results().get(0).version());
        assertEquals(new SettingsRecord("units", "metric", "long", 2, false), stored());
        var edit = store.committed.edits.get(1);
        assertEquals("{\"system\":\"us\",\"labels\":\"long\"}", edit.before().toString());
        assertEquals("{\"system\":\"metric\",\"labels\":\"long\"}", edit.after().toString(),
            "both values, changed or not, so the values before can be sent back whole");
    }

    @Test
    void s3AndS4ClearThenSetAgainAtTheClearedVersion() {
        save(batch(uuid(), units("create", 0, values("us", "long"))));
        save(batch(uuid(), units("update", 1, values("metric", "short"))));
        save(batch(uuid(), units("delete", 2, null)));
        assertEquals(new SettingsRecord("units", "metric", "short", 3, true), stored());
        var cleared = store.committed.edits.get(2);
        assertEquals("{\"system\":\"metric\",\"labels\":\"short\"}", cleared.before().toString());
        assertNull(cleared.after());
        assertEquals(Messages.CODE_CONFLICT, refused(batch(uuid(), units("create", 0, values("us", "long"))),
            Messages.LEVEL_FULL).code(), "a create at 0 of a cleared setting");
        assertEquals(Messages.CODE_CONFLICT, refused(batch(uuid(), units("update", 3, values("us", "long"))),
            Messages.LEVEL_FULL).code(), "an update of a cleared setting");
        EditResult r = save(batch(uuid(), units("create", 3, values("auto", "long"))));
        assertEquals(4, r.results().get(0).version());
        assertEquals(new SettingsRecord("units", "auto", "long", 4, false), stored());
        assertEquals(List.of("create", "update", "delete", "create"),
            store.committed.edits.stream().map(e -> e.op()).toList());
    }

    @Test
    void s5AStaleVersionIsAConflictNamingWhoAndTheUnitsSetting() {
        save(batch(uuid(), units("create", 0, values("us", "long"))));
        save(batch(uuid(), units("update", 1, values("metric", "short"))));
        MapStudioException ex = refused(batch(uuid(), units("update", 1, values("us", "short"))), Messages.LEVEL_FULL);
        assertEquals(Messages.CODE_CONFLICT, ex.code());
        assertEquals("The units setting was changed by mapeditor at 14:02 UTC since you loaded it."
            + " Nothing in this save was written.", ex.plainMessage());
        JsonObject c = ex.conflicts().get(0).getAsJsonObject();
        assertEquals("settings", c.get("entity").getAsString());
        assertEquals("units", c.get("id").getAsString());
        assertEquals("mapeditor", c.get("changedBy").getAsString());
        assertEquals(JsonParser.parseString("{\"id\":\"units\",\"system\":\"metric\",\"labels\":\"short\","
            + "\"version\":2,\"deleted\":false}"), c.get("current"));
        assertNothingWritten(2, 2);
        assertEquals("The units setting already exists (saved by mapeditor at 14:02 UTC), so it was not created"
            + " again. Nothing in this save was written.",
            refused(batch(uuid(), units("create", 0, values("us", "long"))), Messages.LEVEL_FULL).plainMessage());
    }

    @Test
    void aStaleItemAndAStaleUnitsSettingAreCountedTogether() {
        String id = uuid();
        save(batch(uuid(), create(id), units("create", 0, values("us", "long"))));
        save(batch(uuid(), update(id, 1, "{\"name\":\"b\"}"), units("update", 1, values("metric", "long"))));
        MapStudioException ex = refused(batch(uuid(), update(id, 1, "{\"name\":\"c\"}"),
            units("delete", 1, null)), Messages.LEVEL_FULL);
        assertEquals("1 map item and the units setting were changed by others since you loaded them."
            + " Nothing in this save was written.", ex.plainMessage());
        assertEquals(2, ex.conflicts().size());
    }

    @Test
    void s6APhoneEditorAndAViewerAreRefusedRole() {
        save(batch(uuid(), units("create", 0, values("us", "long"))));
        for (String op : List.of(units("update", 1, values("metric", "short")), units("delete", 1, null),
                units("create", 0, values("us", "long")))) {
            MapStudioException phone = refused(batch(uuid(), op), Messages.LEVEL_PHONE);
            assertEquals(Messages.CODE_ROLE, phone.code(), op);
            assertEquals(RoleMatrix.PHONE_MESSAGE, phone.plainMessage());
            MapStudioException none = refused(batch(uuid(), op), Messages.LEVEL_NONE);
            assertEquals(Messages.CODE_ROLE, none.code(), op);
            assertEquals(RoleMatrix.NONE_MESSAGE, none.plainMessage());
        }
        assertEquals(new SettingsRecord("units", "us", "long", 1, false), stored());
        assertNothingWritten(1, 1);
    }

    @Test
    void s7ABadValueOrFieldIsRefusedInWordsNamingTheOp() {
        String id = uuid();
        MapStudioException system = refused(batch(uuid(), create(id), units("create", 0, values("imperial", "long"))),
            Messages.LEVEL_FULL);
        assertEquals(Messages.CODE_INVALID, system.code());
        assertEquals("Op 1 (units): system must be one of auto, metric, us", system.plainMessage());
        assertEquals(1, system.opIndex());
        assertEquals("units", system.opId());
        assertEquals("Op 0 (units): labels must be one of short, long",
            refused(batch(uuid(), units("create", 0, values("us", "tiny"))), Messages.LEVEL_FULL).plainMessage());
        assertEquals("Op 0 (units): labels must be one of short, long",
            refused(batch(uuid(), units("create", 0, "{\"system\":\"us\"}")), Messages.LEVEL_FULL).plainMessage());
        assertEquals("Op 0 (units): system must be one of auto, metric, us",
            refused(batch(uuid(), units("create", 0, null)), Messages.LEVEL_FULL).plainMessage());
        assertEquals("Op 0 (units): Unknown field theme in the units data; a units op carries system and labels and"
            + " nothing else.", refused(batch(uuid(), units("create", 0,
                "{\"system\":\"us\",\"labels\":\"long\",\"theme\":\"dark\"}")), Messages.LEVEL_FULL).plainMessage());
        assertNothingWritten(0, 0);
        assertTrue(store.committed.settings.isEmpty(), "all or none: the item of the first batch is not saved either");
        assertTrue(store.items(PROJECT).isEmpty());
    }

    @Test
    void s8AnotherSettingsIdAndAnOpOnASettingNeverSavedAreInvalid() {
        MapStudioException ex = refused(batch(uuid(), "{\"op\":\"create\",\"entity\":\"settings\",\"id\":\"theme\","
            + "\"baseVersion\":0,\"data\":{}}"), Messages.LEVEL_FULL);
        assertEquals(Messages.CODE_INVALID, ex.code());
        assertEquals("Op 0: a settings id must be units.", ex.plainMessage());
        assertEquals("Op 0: the units setting does not exist, so it cannot be updated.",
            refused(batch(uuid(), units("update", 1, values("us", "long"))), Messages.LEVEL_FULL).plainMessage());
        assertEquals("Op 0: the units setting was never saved, so it cannot be restored; create it with baseVersion 0.",
            refused(batch(uuid(), units("create", 2, values("us", "long"))), Messages.LEVEL_FULL).plainMessage());
    }

    @Test
    void s11ASettingsOnlyBatchIsSavedWithNoKindListInUse() {
        AdapterStatus failing = new AdapterStatus(AdapterStatus.FAILING, "The kind function test.kinds failed: boom.",
            "test.kinds", 0, 0, null);
        writes = new WriteService(new StoreGate(setups, c -> state), store, hooked::add,
            project -> new AdapterSnapshot(List.of(), List.of(), failing, failing));
        save(batch(uuid(), units("create", 0, values("us", "long"))));
        save(batch(uuid(), units("update", 1, values("metric", "short"))));
        assertEquals(new SettingsRecord("units", "metric", "short", 2, false), stored());
        MapStudioException ex = refused(batch(uuid(), create(uuid()), units("update", 2, values("us", "long"))),
            Messages.LEVEL_FULL);
        assertEquals(Messages.CODE_INVALID, ex.code(), "an item op beside it still needs the kind list");
    }

    @Test
    void aBatchSentAgainReplaysAndTheOverrideOfAnotherProjectIsItsOwn() {
        String batchId = uuid();
        EditResult first = save(batch(batchId, units("create", 0, values("us", "long"))));
        EditResult again = save(batch(batchId, units("create", 0, values("us", "long"))));
        assertEquals(first.toJson(), again.toJson());
        assertEquals(1, store.committed.edits.size());
        assertNull(store.committed.settings.get("another-project"));
    }
}
