package com.aoindustrial.perspective.mapstudio.gateway.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonParser;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.AdapterStatus;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.AdapterSnapshot;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.TestKinds;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreGate;

/** Map item ops checked and normalised against the cached kind list (epic 2 story 9, the I/O matrix). */
class WriteServiceKindCheckTest extends WriteFixture {

    static final String POINT = "{\"type\":\"Point\",\"coordinates\":[-104.97,39.74]}";

    static String createItem(String id, String kind, String geometry, String extra) {
        return "{\"op\":\"create\",\"entity\":\"item\",\"id\":\"" + id + "\",\"baseVersion\":0,\"data\":{\"kind\":\""
            + kind + "\",\"name\":\"P12\",\"geometry\":" + geometry + extra + "}}";
    }

    @Test
    void csvStringNumbersAreStoredAsNumbers() {
        String pad = uuid();
        String line = uuid();
        save(batch(uuid(), createItem(pad, "pad", POINT, ",\"properties\":{\"wells\":\"12\"}"),
            createItem(line, "line", LINE, ",\"properties\":{\"diameter\":\" 4.5 \",\"buried\":\"true\"}")));
        assertEquals(JsonParser.parseString("{\"wells\":12}"), store.committed.items.get(PROJECT).get(pad).properties());
        assertEquals(JsonParser.parseString("{\"diameter\":4.5,\"buried\":true}"),
            store.committed.items.get(PROJECT).get(line).properties());
        assertEquals(JsonParser.parseString("{\"wells\":12}"),
            hooked.get(0).ops().stream().filter(o -> o.id().equals(pad)).findFirst().get().record().toJson()
                .get("properties"));
    }

    @Test
    void anUnknownKindAWrongGeometryOrAMistypedPropertyIsRefused() {
        assertEquals("Op 0 (%s): kind tank is not in the project's kind list (pad, line, geofence, pipe, tap).",
            refusedWith(createItem("%s", "tank", POINT, "")));
        assertEquals("Op 0 (%s): kind line is a line kind, so its geometry is a LineString, not a Point.",
            refusedWith(createItem("%s", "line", POINT, "")));
        assertEquals("Op 0 (%s): properties.wells is a whole number field, not \"abc\".",
            refusedWith(createItem("%s", "pad", POINT, ",\"properties\":{\"wells\":\"abc\"}")));
        assertTrue(refusedWith(createItem("%s", "pad", POINT, ",\"properties\":{\"colour\":\"red\"}"))
            .contains("properties.colour is not a form field of kind pad"));
        assertNothingWritten(0, 0);
    }

    @Test
    void anUpdateIsCheckedAgainstTheStoredKindOrTheKindItSets() {
        String pad = uuid();
        save(batch(uuid(), createItem(pad, "pad", POINT, "")));
        MapStudioException ex = refused(batch(uuid(), update(pad, 1, "{\"properties\":{\"wells\":\"x\"}}")),
            Messages.LEVEL_PHONE);
        assertEquals(Messages.CODE_INVALID, ex.code());
        assertTrue(refused(batch(uuid(), update(pad, 1, "{\"kind\":\"line\"}")), Messages.LEVEL_FULL).plainMessage()
            .contains("kind line is a line kind"));
        save(batch(uuid(), update(pad, 1, "{\"properties\":{\"wells\":\"7\"}}")));
        assertEquals(7, store.committed.items.get(PROJECT).get(pad).properties().get("wells").getAsInt());
    }

    @Test
    void overridesTakeAStyleRuleAndFullTagPathsOnly() {
        String rule = ",\"overrides\":{\"styleRule\":{\"source\":{\"path\":\"[default]Mesa/P12/State\"},"
            + "\"type\":\"states\",\"cases\":[{\"value\":\"stopped\",\"preset\":\"fault\"}]}}";
        String pad = uuid();
        save(batch(uuid(), createItem(pad, "pad", POINT, rule)));
        assertEquals(JsonParser.parseString(rule.substring(rule.indexOf(':') + 1)),
            store.committed.items.get(PROJECT).get(pad).overrides());
        assertTrue(refusedWith(createItem("%s", "pad", POINT,
            ",\"overrides\":{\"kpis\":[{\"key\":\"x\",\"path\":\"{asset.path}/X\"}]}"))
            .contains("an override's tag path is a full path"));
    }

    @Test
    void withNoKindListInUseOnlyDeletesPass() {
        String pad = uuid();
        save(batch(uuid(), createItem(pad, "pad", POINT, "")));
        AdapterStatus failing = new AdapterStatus(AdapterStatus.FAILING, "The kind function test.kinds failed: boom.",
            "test.kinds", 0, 0, null);
        writes = new WriteService(new StoreGate(setups, c -> state), store, hooked::add,
            project -> new AdapterSnapshot(List.of(), List.of(), failing, failing));
        MapStudioException ex = refused(batch(uuid(), update(pad, 1, "{\"name\":\"x\"}")), Messages.LEVEL_FULL);
        assertEquals(Messages.CODE_INVALID, ex.code());
        assertEquals("The kind list is not available (failing): The kind function test.kinds failed: boom."
            + " Nothing was saved.", ex.plainMessage());
        save(batch(uuid(), "{\"op\":\"delete\",\"entity\":\"item\",\"id\":\"" + pad + "\",\"baseVersion\":1}"));
        assertTrue(store.committed.items.get(PROJECT).get(pad).deleted());
    }

    @Test
    void anItemWhoseKindLeftTheListIsRefusedUnlessItSetsAKnownKind() {
        String pipe = uuid();
        save(batch(uuid(), createItem(pipe, "pipe", LINE, "")));
        writes = new WriteService(new StoreGate(setups, c -> state), store, hooked::add,
            project -> new AdapterSnapshot(TestKinds.KINDS.subList(0, 3), List.of(),
                TestKinds.snapshot(project).kindsStatus(), TestKinds.snapshot(project).assetsStatus()));
        assertTrue(refused(batch(uuid(), update(pipe, 1, "{\"name\":\"x\"}")), Messages.LEVEL_FULL).plainMessage()
            .contains("kind pipe is not in the project's kind list"));
        save(batch(uuid(), update(pipe, 1, "{\"kind\":\"line\"}")));
        assertEquals("line", store.committed.items.get(PROJECT).get(pipe).kind());
    }

    /** The plain message of the refusal of one op, with the op's id put back as %s. */
    private String refusedWith(String opTemplate) {
        String id = uuid();
        MapStudioException ex = refused(batch(uuid(), opTemplate.replace("%s", id)), Messages.LEVEL_FULL);
        assertEquals(Messages.CODE_INVALID, ex.code());
        assertEquals(0, ex.opIndex());
        return ex.plainMessage().replace(id, "%s");
    }
}
