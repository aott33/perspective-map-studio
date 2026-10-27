package com.aoindustrial.perspective.mapstudio.gateway.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;

/** The phone level (epic 2 story 2): a point's geometry and any map item's properties, nothing else. */
class RoleMatrixPhoneTest extends WriteFixture {

    static final String POINT = "{\"type\":\"Point\",\"coordinates\":[-104.99,39.74]}";

    String point;
    String line;

    EditResult phone(String... ops) {
        return writes.apply(PROJECT, batch(uuid(), ops), Actor.session("mapoperator"), Messages.LEVEL_PHONE);
    }

    void seed() {
        point = uuid();
        line = uuid();
        save(batch(uuid(), "{\"op\":\"create\",\"entity\":\"item\",\"id\":\"" + point + "\",\"baseVersion\":0,"
            + "\"data\":{\"kind\":\"pad\",\"name\":\"P12\",\"geometry\":" + POINT + "}}", create(line)));
    }

    void assertPhoneRefused(String... ops) {
        MapStudioException ex = refused(batch(uuid(), ops), Messages.LEVEL_PHONE);
        assertEquals(Messages.CODE_ROLE, ex.code(), ex.getMessage());
        assertTrue(ex.plainMessage().startsWith("Phone editing may move a point and change a map item's properties"));
    }

    @Test
    void aPhoneEditorMovesAPoint() {
        seed();
        EditResult r = phone(update(point, 1, "{\"geometry\":{\"type\":\"Point\",\"coordinates\":[-104.5,39.5]}}"));
        assertEquals(2, r.results().get(0).version());
        assertEquals(-104.5, store.committed.items.get(PROJECT).get(point).geometry()
            .getAsJsonArray("coordinates").get(0).getAsDouble());
        assertEquals("mapoperator", store.committed.edits.get(2).actor());
    }

    @Test
    void aPhoneEditorChangesTheProperties() {
        seed();
        phone(update(line, 1, "{\"properties\":{\"note\":\"checked\"}}"));
        phone(update(point, 1, "{\"properties\":{\"note\":\"checked\"},"
            + "\"geometry\":{\"type\":\"Point\",\"coordinates\":[-104.5,39.5]}}"));
        assertEquals("checked", store.committed.items.get(PROJECT).get(line).properties().get("note").getAsString());
        assertEquals(2, store.committed.items.get(PROJECT).get(point).version());
    }

    @Test
    void aPhoneEditorMayDoNothingElse() {
        seed();
        long seq = store.committed.seqs.get(PROJECT);
        int edits = store.committed.edits.size();
        int transactions = store.transactions;
        assertPhoneRefused(create(uuid()));
        assertPhoneRefused("{\"op\":\"delete\",\"entity\":\"item\",\"id\":\"" + point + "\",\"baseVersion\":1}");
        assertPhoneRefused(update(point, 1, "{\"name\":\"x\"}"));
        assertPhoneRefused(update(point, 1, "{\"assetId\":\"a\"}"));
        assertPhoneRefused(update(point, 1, "{\"overrides\":{}}"));
        assertPhoneRefused(update(line, 1, "{\"ends\":null}"));
        assertPhoneRefused(update(line, 1, "{\"kind\":\"pipe\"}"));
        assertPhoneRefused(update(point, 1, "{\"geometry\":" + LINE + "}"));
        assertPhoneRefused("{\"op\":\"update\",\"entity\":\"kindSetup\",\"id\":\"pad\",\"baseVersion\":1,"
            + "\"data\":{\"properties\":{}}}");
        assertEquals(transactions + 9, store.transactions, "only the retry lookups ran before the shape refusals");
        assertNothingWritten(edits, seq);
    }

    @Test
    void aPhoneEditorMayNotChangeALinesGeometryEvenAsAPoint() {
        seed();
        long seq = store.committed.seqs.get(PROJECT);
        assertPhoneRefused(update(line, 1, "{\"geometry\":" + POINT + "}"));
        assertNothingWritten(2, seq);
    }

    @Test
    void aStalePhoneOpThatIsAlsoNotAllowedIsReportedAsRoleNotConflict() {
        seed();
        save(batch(uuid(), update(line, 1, "{\"name\":\"n\"}")));
        assertPhoneRefused(update(line, 1, "{\"geometry\":" + POINT + "}"));
        assertPhoneRefused(update(line, 1, "{\"name\":\"x\"}"));
    }

    @Test
    void aStaleAllowedPhoneOpIsAConflict() {
        seed();
        save(batch(uuid(), update(point, 1, "{\"name\":\"n\"}")));
        assertEquals(Messages.CODE_CONFLICT,
            refused(batch(uuid(), update(point, 1, "{\"properties\":{}}")), Messages.LEVEL_PHONE).code());
    }

    @Test
    void anAnonymousViewerIsRefusedForRoleBeforeTheMissingActor() {
        MapStudioException ex = org.junit.jupiter.api.Assertions.assertThrows(MapStudioException.class,
            () -> writes.apply(PROJECT, batch(uuid(), create(uuid())), Actor.session(""), Messages.LEVEL_NONE));
        assertEquals(Messages.CODE_ROLE, ex.code());
        assertEquals(0, store.transactions, "no retry lookup without an actor");
    }
}
