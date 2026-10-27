package com.aoindustrial.perspective.mapstudio.gateway.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.KindSetupRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.gateway.change.ChangeEvent;

/**
 * Kind setups through the one write path (epic 2 story 9): create, update, delete, restore,
 * conflict, retry, the phone and viewer levels, and the record map.changed carries.
 */
class WriteServiceKindSetupTest extends WriteFixture {

    static final String SETUP = "{\"comms\":{\"path\":\"{asset.path}/Comms\",\"on\":true},"
        + "\"kpis\":[{\"key\":\"pressure\",\"label\":\"Pressure\",\"path\":\"{asset.path}/Pressure\",\"unit\":\"psi\","
        + "\"on\":true,\"icon\":true},{\"key\":\"gas\",\"label\":\"Gas price\",\"path\":\"[default]Shared/GasPrice\"}],"
        + "\"link\":\"/pad/{item.name}\",\"popupView\":{\"path\":\"Popups/PadDetails\",\"params\":{\"padName\":"
        + "\"{item.name}\",\"tagPath\":\"{asset.path}\",\"area\":\"Mesa\",\"pressure\":\"{asset.path}/Pressure\"}},"
        + "\"styleRule\":{\"source\":{\"kpi\":\"pressure\"},\"type\":\"bands\",\"cases\":[{\"min\":null,\"max\":900,"
        + "\"preset\":\"normal\"},{\"min\":900,\"max\":null,\"preset\":\"warning\"}]}}";

    static String kindSetup(String op, String kindId, int baseVersion, String setup) {
        return "{\"op\":\"" + op + "\",\"entity\":\"kindSetup\",\"id\":\"" + kindId + "\",\"baseVersion\":" + baseVersion
            + (setup == null ? "" : ",\"data\":{\"setup\":" + setup + "}") + "}";
    }

    @Test
    void aKindSetupIsSavedVersionedRecordedAndSentUnchanged() {
        EditResult r = save(batch(uuid(), kindSetup("create", "pad", 0, SETUP)));
        assertEquals(1, r.results().get(0).version());
        assertEquals("kindSetup", r.results().get(0).entity());
        KindSetupRecord stored = store.kindSetups(PROJECT).get(0);
        assertEquals(new KindSetupRecord("pad", JsonParser.parseString(SETUP).getAsJsonObject(), 1, false), stored);
        var edit = store.committed.edits.get(0);
        assertEquals("kindSetup", edit.entity());
        assertEquals("pad", edit.entityId());
        assertEquals("create", edit.op());

        JsonObject changed = ChangeEvent.of(hooked.get(0)).body();
        JsonObject op = changed.getAsJsonArray("ops").get(0).getAsJsonObject();
        assertEquals("kindSetup", op.get("entity").getAsString());
        assertEquals(1, op.get("version").getAsInt());
        assertEquals(JsonParser.parseString("{\"kindId\":\"pad\",\"setup\":" + SETUP + ",\"version\":1,"
            + "\"deleted\":false}"), op.get("record"));

        save(batch(uuid(), kindSetup("update", "pad", 1, "{\"link\":\"/pads/{item.id}\"}")));
        assertEquals(2, store.kindSetups(PROJECT).get(0).version());
        assertEquals("{\"link\":\"/pads/{item.id}\"}", store.kindSetups(PROJECT).get(0).setup().toString());
    }

    @Test
    void deleteThenRestoreAtTheTombstonesVersion() {
        save(batch(uuid(), kindSetup("create", "line", 0, "{}")));
        save(batch(uuid(), kindSetup("delete", "line", 1, null)));
        assertTrue(store.kindSetups(PROJECT).get(0).deleted());
        assertEquals(2, store.kindSetups(PROJECT).get(0).version());
        assertEquals(Messages.CODE_CONFLICT, refused(batch(uuid(), kindSetup("create", "line", 0, "{}")),
            Messages.LEVEL_FULL).code());
        save(batch(uuid(), kindSetup("create", "line", 2, "{\"link\":\"/l\"}")));
        KindSetupRecord restored = store.kindSetups(PROJECT).get(0);
        assertEquals(3, restored.version());
        assertFalse(restored.deleted());
        assertEquals(java.util.List.of("create", "delete", "create"),
            store.committed.edits.stream().map(e -> e.op()).toList());
    }

    @Test
    void aStaleUpdateIsAConflictCarryingTheStoredKindSetup() {
        save(batch(uuid(), kindSetup("create", "pad", 0, SETUP)));
        save(batch(uuid(), kindSetup("update", "pad", 1, "{}")));
        MapStudioException ex = refused(batch(uuid(), kindSetup("update", "pad", 1, SETUP)), Messages.LEVEL_FULL);
        assertEquals(Messages.CODE_CONFLICT, ex.code());
        assertTrue(ex.plainMessage().startsWith("The pad kind setup was changed by mapeditor at 14:02 UTC"),
            ex.plainMessage());
        JsonObject c = ex.conflicts().get(0).getAsJsonObject();
        assertEquals("kindSetup", c.get("entity").getAsString());
        assertEquals(JsonParser.parseString("{\"kindId\":\"pad\",\"setup\":{},\"version\":2,\"deleted\":false}"),
            c.get("current"));
        assertNothingWritten(2, 2);
    }

    @Test
    void aRetriedBatchReplaysAndNeverSavedIsInvalid() {
        var b = batch(uuid(), kindSetup("create", "pad", 0, "{}"));
        EditResult first = save(b);
        assertEquals(first, save(b));
        assertEquals(1, store.committed.edits.size());
        MapStudioException ex = refused(batch(uuid(), kindSetup("update", "geofence", 1, "{}")), Messages.LEVEL_FULL);
        assertEquals(Messages.CODE_INVALID, ex.code());
        assertTrue(ex.plainMessage().contains("the kind setup of geofence does not exist"), ex.plainMessage());
    }

    @Test
    void phoneAndViewerAreRefusedRoleAndNothingIsWritten() {
        for (String level : new String[] {Messages.LEVEL_PHONE, Messages.LEVEL_NONE}) {
            MapStudioException ex = refused(batch(uuid(), kindSetup("create", "pad", 0, "{}")), level);
            assertEquals(Messages.CODE_ROLE, ex.code());
        }
        assertNothingWritten(0, 0);
    }

    @Test
    void aBadSetupOrAnUnknownKindIsInvalidNamingTheOp() {
        MapStudioException ex = refused(batch(uuid(), create(uuid()), kindSetup("create", "pad", 0,
            "{\"styleRule\":{\"source\":{\"path\":\"{asset.path}/S\"},\"type\":\"states\",\"cases\":[{\"value\":1,"
            + "\"preset\":\"#ff0000\"}]}}")), Messages.LEVEL_FULL);
        assertEquals(Messages.CODE_INVALID, ex.code());
        assertEquals(1, ex.opIndex());
        assertEquals("pad", ex.opId());
        assertEquals("Op 1 (pad): styleRule.cases[0].preset: #ff0000 is a colour code, not a preset. Pick a preset:"
            + " normal, attention, warning, fault, dimmed; colour codes are not accepted.", ex.plainMessage());
        assertTrue(refused(batch(uuid(), kindSetup("create", "tank", 0, "{}")), Messages.LEVEL_FULL).plainMessage()
            .contains("kind tank is not in the project's kind list"));
        assertTrue(refused(batch(uuid(), "{\"op\":\"create\",\"entity\":\"kindSetup\",\"id\":\"pad\",\"baseVersion\":0,"
            + "\"data\":{\"comms\":{}}}"), Messages.LEVEL_FULL).plainMessage().contains("Unknown field comms"));
        assertTrue(refused(batch(uuid(), kindSetup("create", "pad", 0, "{\"popupView\":{\"path\":\"P\",\"params\":"
            + "{\"p\":\"{item.name}/Pressure\"}}}")), Messages.LEVEL_FULL).plainMessage()
            .contains("mixes text and placeholders"));
        assertNothingWritten(0, 0);
    }
}
