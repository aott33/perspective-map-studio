package com.aoindustrial.perspective.mapstudio.gateway.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonObject;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;

/** Delete and restore (epic 2 story 2): a tombstone with a version bump; a create at its version restores it. */
class WriteServiceDeleteTest extends WriteFixture {

    static String delete(String id, int baseVersion) {
        return "{\"op\":\"delete\",\"entity\":\"item\",\"id\":\"" + id + "\",\"baseVersion\":" + baseVersion + "}";
    }

    static String restore(String id, int baseVersion) {
        return "{\"op\":\"create\",\"entity\":\"item\",\"id\":\"" + id + "\",\"baseVersion\":" + baseVersion + ","
            + "\"data\":{\"kind\":\"line\",\"name\":\"Restored\",\"geometry\":" + LINE + "}}";
    }

    MapItemRecord stored(String id) {
        return store.committed.items.get(PROJECT).get(id);
    }

    @Test
    void aDeleteAtTheStoredVersionWritesATombstoneAndRecordsTheDelete() {
        String id = uuid();
        save(batch(uuid(), create(id)));
        EditResult r = save(batch(uuid(), delete(id, 1)));
        assertEquals(2, r.results().get(0).version());
        assertTrue(stored(id).deleted());
        assertEquals(2, stored(id).version());
        assertEquals("delete", store.committed.edits.get(1).op());
        assertEquals(2, store.committed.edits.get(1).version());
        assertTrue(store.committed.batches.size() == 2);
        assertEquals("delete", hooked.get(1).ops().get(0).op());
        assertTrue(hooked.get(1).ops().get(0).record().deleted());
        // Gone from map.load: liveItems leaves it out.
        assertTrue(liveIds().isEmpty());
    }

    java.util.List<String> liveIds() {
        try {
            return store.inTransaction("MapStudio", tx -> tx.liveItems(PROJECT)).stream().map(MapItemRecord::id).toList();
        } catch (java.sql.SQLException ex) {
            throw new IllegalStateException(ex);
        }
    }

    @Test
    void aStaleDeleteIsAConflict() {
        String id = uuid();
        save(batch(uuid(), create(id)));
        save(batch(uuid(), update(id, 1, "{\"name\":\"n\"}")));
        assertEquals(Messages.CODE_CONFLICT, refused(batch(uuid(), delete(id, 1)), Messages.LEVEL_FULL).code());
        assertNothingWritten(2, 2);
    }

    @Test
    void aCreateAtTheTombstonesVersionRestoresItAsCreateVersionThree() {
        String id = uuid();
        save(batch(uuid(), create(id)));
        save(batch(uuid(), delete(id, 1)));
        EditResult r = writes.apply(PROJECT, batch(uuid(), restore(id, 2)), Actor.session("other"), Messages.LEVEL_FULL);
        assertEquals(3, r.results().get(0).version());
        MapItemRecord back = stored(id);
        assertEquals(false, back.deleted());
        assertEquals(3, back.version());
        assertEquals("Restored", back.name());
        assertEquals(java.util.List.of("create", "delete", "create"),
            store.committed.edits.stream().map(e -> e.op()).toList());
        assertEquals(java.util.List.of(1, 2, 3), store.committed.edits.stream().map(e -> e.version()).toList());
        assertEquals("other", store.committed.edits.get(2).actor());
        assertEquals(java.util.List.of(id), liveIds());
    }

    @Test
    void aRestoreAtAnotherVersionIsAConflictAndOfAnUnknownIdIsInvalid() {
        String id = uuid();
        save(batch(uuid(), create(id)));
        save(batch(uuid(), delete(id, 1)));
        assertEquals(Messages.CODE_CONFLICT, refused(batch(uuid(), restore(id, 1)), Messages.LEVEL_FULL).code());
        assertEquals(Messages.CODE_CONFLICT, refused(batch(uuid(), restore(id, 3)), Messages.LEVEL_FULL).code());
        MapStudioException tomb = refused(batch(uuid(), create(id)), Messages.LEVEL_FULL);
        assertEquals(Messages.CODE_CONFLICT, tomb.code(), "a create at 0 of a tombstoned id");
        assertTrue(tomb.plainMessage().contains("was deleted"), tomb.plainMessage());
        assertFalse(tomb.plainMessage().contains("already exists"), tomb.plainMessage());
        assertEquals(Messages.CODE_INVALID, refused(batch(uuid(), restore(uuid(), 2)), Messages.LEVEL_FULL).code());
        String live = uuid();
        save(batch(uuid(), create(live)));
        assertEquals(Messages.CODE_CONFLICT, refused(batch(uuid(), restore(live, 1)), Messages.LEVEL_FULL).code(),
            "a restore of a live item");
        assertNothingWritten(3, 3);
    }

    @Test
    void anUpdateOrDeleteOfATombstoneIsAConflictShowingItDeleted() {
        String id = uuid();
        save(batch(uuid(), create(id)));
        save(batch(uuid(), delete(id, 1)));
        MapStudioException upd = refused(batch(uuid(), update(id, 2, "{\"name\":\"x\"}")), Messages.LEVEL_FULL);
        assertEquals(Messages.CODE_CONFLICT, upd.code());
        JsonObject current = upd.conflicts().get(0).getAsJsonObject().getAsJsonObject("current");
        assertTrue(current.get("deleted").getAsBoolean());
        assertTrue(upd.plainMessage().contains("was deleted"));
        assertEquals(Messages.CODE_CONFLICT, refused(batch(uuid(), delete(id, 2)), Messages.LEVEL_FULL).code());
        assertNothingWritten(2, 2);
    }

    @Test
    void aDeleteOfAnUnknownIdIsInvalid() {
        assertEquals(Messages.CODE_INVALID, refused(batch(uuid(), delete(uuid(), 1)), Messages.LEVEL_FULL).code());
        assertNothingWritten(0, 0);
    }
}
