package com.aoindustrial.perspective.mapstudio.gateway.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonObject;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;

/** Conflicts (epic 2 story 2): every stale op in one refusal, with the stored record and who changed it. */
class WriteServiceConflictTest extends WriteFixture {

    @Test
    void aStaleUpdateIsRefusedWithTheOtherEditorsRecord() {
        String id = uuid();
        save(batch(uuid(), create(id)));
        writes.apply(PROJECT, batch(uuid(), update(id, 1, "{\"name\":\"P12\"}")), Actor.session("alex"),
            Messages.LEVEL_FULL);
        MapStudioException ex = refused(batch(uuid(), update(id, 1, "{\"name\":\"Mine\"}")), Messages.LEVEL_FULL);
        assertEquals(Messages.CODE_CONFLICT, ex.code());
        assertEquals("P12 was changed by alex at 14:02 UTC since you loaded it. Nothing in this save was written.",
            ex.plainMessage());
        JsonArray conflicts = ex.conflicts();
        assertEquals(1, conflicts.size());
        JsonObject c = conflicts.get(0).getAsJsonObject();
        assertEquals(0, c.get("index").getAsInt());
        assertEquals("item", c.get("entity").getAsString());
        assertEquals(id, c.get("id").getAsString());
        assertEquals(1, c.get("baseVersion").getAsInt());
        assertEquals(2, c.getAsJsonObject("current").get("version").getAsInt());
        assertEquals("P12", c.getAsJsonObject("current").get("name").getAsString());
        assertEquals("alex", c.get("changedBy").getAsString());
        assertEquals("2026-10-26T14:02:00Z", c.get("changedAt").getAsString());
        JsonObject body = ex.toErrorBody();
        assertEquals(0, body.getAsJsonObject("op").get("index").getAsInt());
        assertEquals(1, body.getAsJsonArray("conflicts").size());
        assertNothingWritten(2, 2);
    }

    @Test
    void severalStaleOpsAreListedInOneConflict() {
        String a = uuid();
        String b = uuid();
        String c = uuid();
        save(batch(uuid(), create(a), create(b), create(c)));
        save(batch(uuid(), update(a, 1, "{\"name\":\"a2\"}"), update(c, 1, "{\"name\":\"c2\"}")));
        MapStudioException ex = refused(batch(uuid(), update(a, 1, "{\"name\":\"x\"}"),
            update(b, 1, "{\"name\":\"y\"}"), update(c, 1, "{\"name\":\"z\"}")), Messages.LEVEL_FULL);
        assertEquals(Messages.CODE_CONFLICT, ex.code());
        assertEquals(2, ex.conflicts().size());
        assertEquals(0, ex.conflicts().get(0).getAsJsonObject().get("index").getAsInt());
        assertEquals(2, ex.conflicts().get(1).getAsJsonObject().get("index").getAsInt());
        assertTrue(ex.plainMessage().startsWith("2 map items were changed by others"));
        assertEquals("Line 1", store.committed.items.get(PROJECT).get(b).name(), "the fresh op is not written either");
        assertNothingWritten(5, 2);
    }

    @Test
    void aCreateOnAnExistingIdIsAConflictWithItsRecord() {
        String id = uuid();
        save(batch(uuid(), create(id)));
        MapStudioException ex = refused(batch(uuid(), create(id)), Messages.LEVEL_FULL);
        assertEquals(Messages.CODE_CONFLICT, ex.code());
        assertEquals(1, ex.conflicts().get(0).getAsJsonObject().getAsJsonObject("current").get("version").getAsInt());
        assertTrue(ex.plainMessage().contains("already exists"));
        assertNothingWritten(1, 1);
    }

    @Test
    void aConflictWithoutAnEditRecordHasNoChangedBy() {
        String id = uuid();
        save(batch(uuid(), create(id)));
        store.committed.edits.clear();
        store.committed.editTimes.clear();
        MapStudioException ex = refused(batch(uuid(), update(id, 3, "{\"name\":\"x\"}")), Messages.LEVEL_FULL);
        JsonObject c = ex.conflicts().get(0).getAsJsonObject();
        assertTrue(c.get("changedBy").isJsonNull());
        assertEquals("Line 1 was changed since you loaded it. Nothing in this save was written.", ex.plainMessage());
    }

    @Test
    void twoOpsOnOneIdAreInvalid() {
        String id = uuid();
        save(batch(uuid(), create(id)));
        MapStudioException ex = refused(batch(uuid(), update(id, 1, "{\"name\":\"a\"}"),
            update(id, 2, "{\"name\":\"b\"}")), Messages.LEVEL_FULL);
        assertEquals(Messages.CODE_INVALID, ex.code());
        assertEquals(1, ex.opIndex());
        assertNothingWritten(1, 1);
    }
}
