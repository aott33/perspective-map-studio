package com.aoindustrial.perspective.mapstudio.gateway.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;
import com.aoindustrial.perspective.mapstudio.gateway.setup.SetupRegistry;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreGate;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreState;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.TestKinds;

/** The write path against {@link FakeMapStore}: every row of entry 1's I/O matrix that needs no Gateway. */
class WriteServiceTest extends WriteFixture {

    @Test
    void editorCreatesALineAtVersionOneAndItIsRecorded() {
        String id = uuid();
        String batchId = uuid();
        EditResult result = save(batch(batchId, create(id)));
        assertEquals(1, result.seq());
        assertEquals(batchId, result.batchId());
        assertEquals(1, result.results().get(0).version());
        MapItemRecord stored = store.items(PROJECT).get(0);
        assertEquals(id, stored.id());
        assertEquals("line", stored.kind());
        assertEquals(1, stored.version());
        assertEquals(1, store.committed.edits.size());
        var row = store.committed.edits.get(0);
        assertEquals(PROJECT, row.project());
        assertEquals(batchId, row.batchId());
        assertEquals(1, row.seq());
        assertEquals("item", row.entity());
        assertEquals(id, row.entityId());
        assertEquals("create", row.op());
        assertEquals(1, row.version());
        assertEquals("mapeditor", row.actor());
        assertEquals("session", row.source());
        assertEquals(1, store.committed.batches.size());
        assertEquals(1, hooked.size(), "the change hook is called once per committed batch");
        assertEquals(1, hooked.get(0).seq());
        assertEquals(batchId, hooked.get(0).batchId());
        assertEquals("mapeditor", hooked.get(0).actor().name());
        assertEquals(stored, hooked.get(0).ops().get(0).record(), "the hook gets the full stored record");
    }

    @Test
    void updateAtTheStoredVersionSavesVersionTwoAndReplacesOnlyTheFieldsItCarries() {
        String id = uuid();
        save(batch(uuid(), create(id)));
        EditResult result = save(batch(uuid(), update(id, 1, "{\"name\":\"Renamed\"}")));
        assertEquals(2, result.seq());
        assertEquals(2, result.results().get(0).version());
        MapItemRecord stored = store.items(PROJECT).get(0);
        assertEquals("Renamed", stored.name());
        assertEquals("line", stored.kind(), "fields the update does not carry stay");
        assertEquals(JsonParser.parseString(LINE), stored.geometry());
        assertEquals(2, store.committed.edits.size());
        assertEquals(2, hooked.size());
    }

    @Test
    void updateAtAnotherVersionIsAConflictAndNothingIsWritten() {
        String id = uuid();
        save(batch(uuid(), create(id)));
        save(batch(uuid(), update(id, 1, "{\"name\":\"Second\"}")));
        MapStudioException ex = refused(batch(uuid(), update(id, 1, "{\"name\":\"Stale\"}")), Messages.LEVEL_FULL);
        assertEquals(Messages.CODE_CONFLICT, ex.code());
        assertEquals(0, ex.opIndex());
        assertEquals(id, ex.opId());
        assertEquals("Second", store.items(PROJECT).get(0).name());
        assertNothingWritten(2, 2);
        assertEquals(2, hooked.size(), "no hook call for a refused batch");
    }

    @Test
    void createOfAnExistingIdIsAConflict() {
        String id = uuid();
        save(batch(uuid(), create(id)));
        assertEquals(Messages.CODE_CONFLICT, refused(batch(uuid(), create(id)), Messages.LEVEL_FULL).code());
        assertNothingWritten(1, 1);
    }

    @Test
    void aBatchWithOneValidOpAndAnUpdateOfAnUnknownIdWritesNothingAndNamesTheOp() {
        String missing = uuid();
        MapStudioException ex = refused(batch(uuid(), create(uuid()), update(missing, 1, "{\"name\":\"x\"}")),
            Messages.LEVEL_FULL);
        assertEquals(Messages.CODE_INVALID, ex.code());
        assertEquals(1, ex.opIndex());
        assertEquals(missing, ex.opId());
        assertTrue(store.items(PROJECT).isEmpty(), "the valid create is not written either");
        assertNothingWritten(0, 0);
        assertTrue(store.committed.batches.isEmpty());
    }

    @Test
    void aViewerAndAPhoneEditorAreRefusedWithRole() {
        MapStudioException viewer = refused(batch(uuid(), create(uuid())), Messages.LEVEL_NONE);
        assertEquals(Messages.CODE_ROLE, viewer.code());
        assertTrue(viewer.plainMessage().contains("role"));
        assertEquals(Messages.CODE_ROLE, refused(batch(uuid(), create(uuid())), Messages.LEVEL_PHONE).code());
        assertNothingWritten(0, 0);
        // Story 2: the retry lookup (a read) runs before the role check; no write transaction follows it.
        assertEquals(2, store.transactions, "only the two retry lookups ran");
    }

    @Test
    void aScriptSaveIsRecordedUnderItsActor() {
        writes.apply(PROJECT, batch(uuid(), create(uuid())), Actor.script("seed-script"), Messages.LEVEL_FULL);
        var row = store.committed.edits.get(0);
        assertEquals("seed-script", row.actor());
        assertEquals("script", row.source());
    }

    @Test
    void aSaveWithoutAnActorIsRefused() {
        MapStudioException ex = assertThrows(MapStudioException.class,
            () -> writes.apply(PROJECT, batch(uuid(), create(uuid())), Actor.script(" "), Messages.LEVEL_FULL));
        assertEquals(Messages.CODE_INVALID, ex.code());
        assertNothingWritten(0, 0);
    }

    @Test
    void aProjectWithoutASetupOrWithoutAReadyStoreIsStoreUnreachable() {
        MapStudioException noSetup = assertThrows(MapStudioException.class,
            () -> writes.apply("other-project", batch(uuid(), create(uuid())), Actor.script("s"), Messages.LEVEL_FULL));
        assertEquals(Messages.CODE_STORE_UNREACHABLE, noSetup.code());
        assertTrue(noSetup.plainMessage().contains("other-project"));

        state = StoreState.noConnection("MapStudio");
        MapStudioException noConnection = refused(batch(uuid(), create(uuid())), Messages.LEVEL_FULL);
        assertEquals(Messages.CODE_STORE_UNREACHABLE, noConnection.code());
        assertTrue(noConnection.plainMessage().contains(PROJECT));
        assertTrue(noConnection.plainMessage().contains("MapStudio"));

        state = StoreState.starting("MapStudio");
        assertEquals(Messages.CODE_STORE_UNREACHABLE, refused(batch(uuid(), create(uuid())), Messages.LEVEL_FULL).code());
        state = StoreState.unavailable("no rights");
        assertEquals("no rights", refused(batch(uuid(), create(uuid())), Messages.LEVEL_FULL).plainMessage());
        assertNothingWritten(0, 0);
    }

    @Test
    void malformedBatchesAreInvalid() {
        String id = uuid();
        assertEquals(Messages.CODE_INVALID, refused(JsonParser.parseString("{\"ops\":[" + create(id) + "]}")
            .getAsJsonObject(), Messages.LEVEL_FULL).code());
        assertEquals(Messages.CODE_INVALID, refused(batch("not-a-uuid", create(id)), Messages.LEVEL_FULL).code());
        assertEquals(Messages.CODE_INVALID, refused(batch(uuid()), Messages.LEVEL_FULL).code());
        assertEquals(Messages.CODE_INVALID, refused(batch(uuid(),
            "{\"op\":\"move\",\"entity\":\"item\",\"id\":\"" + id + "\",\"baseVersion\":0}"), Messages.LEVEL_FULL).code());
        assertEquals(Messages.CODE_INVALID, refused(batch(uuid(), create("p1")), Messages.LEVEL_FULL).code());
        MapStudioException geometry = refused(batch(uuid(), "{\"op\":\"create\",\"entity\":\"item\",\"id\":\"" + id
            + "\",\"baseVersion\":0,\"data\":{\"kind\":\"line\",\"geometry\":{\"type\":\"LineString\","
            + "\"coordinates\":[[200,10],[1,1]]}}}"), Messages.LEVEL_FULL);
        assertEquals(Messages.CODE_INVALID, geometry.code());
        assertEquals(0, geometry.opIndex());
        assertNothingWritten(0, 0);
    }

    @Test
    void aBatchIdAlreadySavedByTheSameActorReplaysAndWritesNothingMore() {
        // Entry 1 refused this; epic 2 story 2 replays the stored reply (WriteServiceRetryTest has the rest).
        String batchId = uuid();
        EditResult first = save(batch(batchId, create(uuid())));
        assertEquals(first, save(batch(batchId, create(uuid()))));
        assertEquals(1, store.items(PROJECT).size());
        assertNothingWritten(1, 1);
    }

    @Test
    void aDatabaseFailureIsStoreUnreachableAndNothingIsWritten() {
        store.failNextWrite = new SQLException("connection lost", "08006");
        MapStudioException ex = refused(batch(uuid(), create(uuid())), Messages.LEVEL_FULL);
        assertEquals(Messages.CODE_STORE_UNREACHABLE, ex.code());
        assertNothingWritten(0, 0);
        assertTrue(hooked.isEmpty());
    }

    @Test
    void aFailingHookDoesNotUndoTheSave() {
        writes = new WriteService(new StoreGate(setups, c -> state), store, b -> {
            throw new IllegalStateException("hook failed");
        }, TestKinds::snapshot);
        EditResult result = save(batch(uuid(), create(uuid())));
        assertEquals(1, result.seq());
        assertEquals(1, store.items(PROJECT).size());
    }

    @Test
    void geometryIsRoundedToSixDecimals() {
        String id = uuid();
        save(batch(uuid(), "{\"op\":\"create\",\"entity\":\"item\",\"id\":\"" + id + "\",\"baseVersion\":0,"
            + "\"data\":{\"kind\":\"pad\",\"geometry\":{\"type\":\"Point\",\"coordinates\":[-104.12345678,39.9876544]}}}"));
        var coords = store.items(PROJECT).get(0).geometry().getAsJsonArray("coordinates");
        assertEquals(-104.123457, coords.get(0).getAsDouble());
        assertEquals(39.987654, coords.get(1).getAsDouble());
    }
}
