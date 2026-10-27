package com.aoindustrial.perspective.mapstudio.gateway.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.Attachment;
import com.aoindustrial.perspective.mapstudio.common.contract.LineMeasure;
import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;

/**
 * Instruments on lines (epic 2 story 14): every row of the plan's I/O matrix on the write
 * path, op order, a line and its instruments restored together, and the phone rule. The line
 * is L-SWD of the shared vectors (2,922.35 m), PT-1 at 1,143 m and PT-2 at 2,841 m.
 */
class WriteServiceInstrumentTest extends WriteFixture {

    static final List<double[]> SWD = List.of(new double[] {-103.52, 31.92}, new double[] {-103.505, 31.9205},
        new double[] {-103.490423, 31.926});
    /** L-SWD with its middle vertex moved about 200 m north (a reshape). */
    static final List<double[]> SWD_RESHAPED = List.of(new double[] {-103.52, 31.92},
        new double[] {-103.505, 31.9223}, new double[] {-103.490423, 31.926});

    String line;
    String pt1;
    String pt2;

    @BeforeEach
    void saveTheLineAndItsTwoInstruments() {
        line = uuid();
        pt1 = uuid();
        pt2 = uuid();
        save(batch(uuid(), createLine(line, "L-SWD", SWD), createTap(pt1, "PT-1", line, SWD, 1143),
            createTap(pt2, "PT-2", line, SWD, 2841)));
    }

    // --- builders --------------------------------------------------------------

    static String coords(List<double[]> c) {
        List<String> out = new ArrayList<>();
        c.forEach(p -> out.add("[" + p[0] + "," + p[1] + "]"));
        return "[" + String.join(",", out) + "]";
    }

    static String lineGeometry(List<double[]> c) {
        return "{\"type\":\"LineString\",\"coordinates\":" + coords(c) + "}";
    }

    /** The point at distanceM on the line, rounded to 6 decimals as the browser sends it. */
    static String pointAt(List<double[]> c, double distanceM) {
        double[] p = LineMeasure.pointAt(c, distanceM);
        return point(p[0], p[1]);
    }

    static String point(double lng, double lat) {
        return String.format(Locale.ROOT, "{\"type\":\"Point\",\"coordinates\":[%.6f,%.6f]}", lng, lat);
    }

    static String attachment(String lineId, double distanceM) {
        return "{\"lineId\":\"" + lineId + "\",\"distanceM\":" + distanceM + "}";
    }

    static String createLine(String id, String name, List<double[]> c) {
        return "{\"op\":\"create\",\"entity\":\"item\",\"id\":\"" + id + "\",\"baseVersion\":0,"
            + "\"data\":{\"kind\":\"line\",\"name\":\"" + name + "\",\"geometry\":" + lineGeometry(c) + "}}";
    }

    static String createTap(String id, String name, String lineId, List<double[]> c, double distanceM) {
        return "{\"op\":\"create\",\"entity\":\"item\",\"id\":\"" + id + "\",\"baseVersion\":0,"
            + "\"data\":{\"kind\":\"tap\",\"name\":\"" + name + "\",\"geometry\":" + pointAt(c, distanceM)
            + ",\"attachment\":" + attachment(lineId, distanceM) + "}}";
    }

    static String moveTap(String id, int baseVersion, String lineId, List<double[]> c, double distanceM) {
        return update(id, baseVersion, "{\"geometry\":" + pointAt(c, distanceM) + ",\"attachment\":"
            + attachment(lineId, distanceM) + "}");
    }

    static String delete(String id, int baseVersion) {
        return "{\"op\":\"delete\",\"entity\":\"item\",\"id\":\"" + id + "\",\"baseVersion\":" + baseVersion + "}";
    }

    static String restore(MapItemRecord r) {
        JsonObject data = r.toJson();
        for (String key : List.of("id", "version", "deleted")) {
            data.remove(key);
        }
        return "{\"op\":\"create\",\"entity\":\"item\",\"id\":\"" + r.id() + "\",\"baseVersion\":" + r.version()
            + ",\"data\":" + data + "}";
    }

    MapItemRecord stored(String id) {
        return store.committed.items.get(PROJECT).get(id);
    }

    MapStudioException refusedFull(JsonObject batch) {
        return refused(batch, Messages.LEVEL_FULL);
    }

    void assertRefusedInvalid(MapStudioException ex, int index, String id, String... words) {
        assertEquals(Messages.CODE_INVALID, ex.code(), ex.getMessage());
        assertEquals(index, ex.opIndex());
        assertEquals(id, ex.opId());
        for (String w : words) {
            assertTrue(ex.plainMessage().contains(w), "'" + w + "' in: " + ex.plainMessage());
        }
        assertNothingWritten(3, 1);
    }

    // --- Save ------------------------------------------------------------------

    @Test
    void anInstrumentIsSavedWithItsAttachmentAndReadBackUnchanged() {
        MapItemRecord tap = stored(pt1);
        assertEquals(1, tap.version());
        assertEquals(new Attachment(line, 1143.0), tap.attachment());
        JsonObject sent = hooked.get(0).ops().get(1).record().toJson();
        assertEquals("{\"lineId\":\"" + line + "\",\"distanceM\":1143.0}", sent.get("attachment").toString(),
            "map.changed and getMap carry record.toJson()");
        assertTrue(hooked.get(0).ops().get(0).record().toJson().get("attachment").isJsonNull(), "the line has none");
        assertEquals(List.of(pt1, pt2), attached(line), "ordered by distanceM");
    }

    @Test
    void anInstrumentCreatedBeforeItsLineInTheBatchIsSaved() {
        String other = uuid();
        String tap = uuid();
        EditResult r = save(batch(uuid(), createTap(tap, "PT-9", other, SWD, 10), createLine(other, "L-9", SWD)));
        assertEquals(2, r.seq());
        assertEquals(other, stored(tap).attachment().lineId());
    }

    @Test
    void anInstrumentKindItemMayBeAFreePoint() {
        String tap = uuid();
        save(batch(uuid(), "{\"op\":\"create\",\"entity\":\"item\",\"id\":\"" + tap + "\",\"baseVersion\":0,"
            + "\"data\":{\"kind\":\"tap\",\"name\":\"PT-free\",\"geometry\":" + point(-103.4, 31.9) + "}}"));
        assertNull(stored(tap).attachment());
    }

    // --- Bad attachment ------------------------------------------------------------

    @Test
    void anAttachmentOnAKindThatIsNotAnInstrumentIsRefused() {
        String pad = uuid();
        MapStudioException ex = refusedFull(batch(uuid(), "{\"op\":\"create\",\"entity\":\"item\",\"id\":\"" + pad
            + "\",\"baseVersion\":0,\"data\":{\"kind\":\"pad\",\"name\":\"P12\",\"geometry\":" + pointAt(SWD, 10)
            + ",\"attachment\":" + attachment(line, 10) + "}}"));
        assertRefusedInvalid(ex, 0, pad, "kind pad is not an instrument kind");
    }

    @Test
    void anAttachmentToAMissingDeletedOrPointItemIsRefused() {
        String missing = uuid();
        assertRefusedInvalid(refusedFull(batch(uuid(), moveTap(pt1, 1, missing, SWD, 1143))), 0, pt1,
            "instrument PT-1 is attached to map item " + missing + ", which does not exist.");
        // PT-1 attached to PT-2 (a point).
        assertRefusedInvalid(refusedFull(batch(uuid(), moveTap(pt1, 1, pt2, SWD, 1143))), 0, pt1,
            "instrument PT-1 is attached to PT-2, which is a point, not a line.");
        // A line deleted in the same batch while PT-1 is moved onto it.
        MapStudioException ex = refusedFull(batch(uuid(), delete(line, 1), moveTap(pt1, 1, line, SWD, 1100),
            delete(pt2, 1)));
        assertRefusedInvalid(ex, 1, pt1, "instrument PT-1 is attached to line L-SWD, which is deleted.");
    }

    @Test
    void aDistanceOutsideTheLineOrAPointOffItsPlaceIsRefused() {
        assertRefusedInvalid(refusedFull(batch(uuid(), update(pt1, 1, "{\"attachment\":" + attachment(line, -1) + "}"))),
            0, pt1, "attachment.distanceM must be 0 or more");
        assertRefusedInvalid(refusedFull(batch(uuid(), moveTap(pt1, 1, line, SWD, 2924))), 0, pt1,
            "instrument PT-1 is at 2,924.0 m along line L-SWD, past its end (the line is 2,922.4 m long).");
        // 2,923 m is within the 1 m tolerance: the point is the line's end.
        save(batch(uuid(), moveTap(pt2, 1, line, SWD, 2923)));
        assertEquals(2923.0, stored(pt2).attachment().distanceM());
        // PT-1's point 5 m north of its place at 1,143 m.
        double[] place = LineMeasure.pointAt(SWD, 1143);
        double north = 5.0 / LineMeasure.EARTH_RADIUS_M * 180 / Math.PI;
        MapStudioException ex = refused(batch(uuid(), update(pt1, 1, "{\"geometry\":" + point(place[0], place[1] + north)
            + "}")), Messages.LEVEL_FULL);
        assertEquals(Messages.CODE_INVALID, ex.code());
        // 4.9 m once the point is rounded to 6 decimals, as stored.
        assertTrue(ex.plainMessage().startsWith("Op 0 (" + pt1 + "): instrument PT-1 is 4.9 m from its place on line"
            + " L-SWD (1,143.0 m along it); its point must be within 1.0 m of that place."), ex.plainMessage());
    }

    @Test
    void anAttachmentToAnAreaIsRefused() {
        String fence = uuid();
        save(batch(uuid(), "{\"op\":\"create\",\"entity\":\"item\",\"id\":\"" + fence + "\",\"baseVersion\":0,"
            + "\"data\":{\"kind\":\"geofence\",\"name\":\"Fence\",\"geometry\":" + lineGeometry(SWD) + "}}"));
        MapStudioException ex = refusedFull(batch(uuid(), moveTap(pt1, 1, fence, SWD, 1143)));
        assertEquals(Messages.CODE_INVALID, ex.code());
        assertTrue(ex.plainMessage().contains("instrument PT-1 is attached to Fence, an area (kind geofence)"),
            ex.plainMessage());
    }

    @Test
    void anAttachmentToALineWhoseKindIsNotInTheKindListIsRefused() {
        String retired = uuid();
        JsonObject geometry = JsonParser.parseString(lineGeometry(SWD))
            .getAsJsonObject();
        store.committed.items.get(PROJECT).put(retired, new MapItemRecord(retired, "retired", "Old line", geometry,
            new JsonObject(), null, new JsonObject(), null, null, 1, false));
        MapStudioException ex = refusedFull(batch(uuid(), moveTap(pt1, 1, retired, SWD, 1143)));
        assertRefusedInvalid(ex, 0, pt1, "instrument PT-1 is attached to Old line, whose kind retired is not in the"
            + " kind list");
    }

    // --- Line without its instruments --------------------------------------------

    @Test
    void aLineMovedOrDeletedWithoutItsInstrumentsIsRefused() {
        MapStudioException moved = refusedFull(batch(uuid(), update(line, 1, "{\"geometry\":"
            + lineGeometry(SWD_RESHAPED) + "}")));
        assertRefusedInvalid(moved, 0, line);
        assertEquals("Op 0 (" + line + "): line L-SWD has 2 instruments (PT-1, PT-2) this save does not move or delete."
            + " Send each instrument's new place in the same save. Nothing in this save was written.",
            moved.plainMessage());
        MapStudioException deleted = refusedFull(batch(uuid(), delete(line, 1)));
        assertRefusedInvalid(deleted, 0, line, "line L-SWD has 2 instruments (PT-1, PT-2) this save does not move or"
            + " delete. Delete its instruments in the same save.");
        // PT-2 alone left behind; an op on it without attachment does not count.
        MapStudioException one = refusedFull(batch(uuid(), moveTap(pt1, 1, line, SWD_RESHAPED, 1143),
            update(pt2, 1, "{\"name\":\"PT-2B\"}"), update(line, 1, "{\"geometry\":" + lineGeometry(SWD_RESHAPED) + "}")));
        assertRefusedInvalid(one, 2, line, "line L-SWD has 1 instrument (PT-2B) this save", "the same save");
    }

    @Test
    void aLineTurnedIntoAnAreaWithItsInstrumentsStillAttachedIsRefused() {
        // Review finding (lens quick): the same LineString, only the kind changes to an area kind.
        MapStudioException ex = refusedFull(batch(uuid(), update(line, 1, "{\"kind\":\"geofence\"}")));
        assertRefusedInvalid(ex, 0, line, "line L-SWD has 2 instruments (PT-1, PT-2) this save does not move or"
            + " delete.", "Its new kind geofence is not a line instruments go on");
        // Moving them along the line in the same save does not help: the line is an area.
        MapStudioException moved = refusedFull(batch(uuid(), update(line, 1, "{\"kind\":\"geofence\"}"),
            moveTap(pt1, 1, line, SWD, 1143), moveTap(pt2, 1, line, SWD, 2841)));
        assertRefusedInvalid(moved, 1, pt1, "an area (kind geofence)");
        // Detached (free points) in the same save, the kind change saves.
        save(batch(uuid(), update(line, 1, "{\"kind\":\"geofence\"}"), update(pt1, 1, "{\"attachment\":null}"),
            update(pt2, 1, "{\"attachment\":null}")));
        assertEquals("geofence", stored(line).kind());
        assertNull(stored(pt1).attachment());
        assertEquals(List.of(), attached(line));
    }

    @Test
    void aRenameOrPropertyChangeOfALineNeedsNoInstruments() {
        save(batch(uuid(), update(line, 1, "{\"name\":\"L-SWD 2\",\"properties\":{\"diameter\":8}}")));
        // The same geometry sent again is not a change.
        save(batch(uuid(), update(line, 2, "{\"geometry\":" + lineGeometry(SWD) + "}")));
        assertEquals(3, stored(line).version());
    }

    // --- Line with its instruments ------------------------------------------------

    @Test
    void aReshapedLineWithEveryInstrumentPlacedSavesInAnyOrderAsOneSeq() {
        double d1 = 1150.2;
        double d2 = 2850.0;
        EditResult r = save(batch(uuid(), moveTap(pt2, 1, line, SWD_RESHAPED, d2),
            update(line, 1, "{\"geometry\":" + lineGeometry(SWD_RESHAPED) + "}"),
            moveTap(pt1, 1, line, SWD_RESHAPED, d1)));
        assertEquals(2, r.seq());
        assertEquals(3, r.results().size());
        assertEquals(d1, stored(pt1).attachment().distanceM());
        assertEquals(d2, stored(pt2).attachment().distanceM());
    }

    @Test
    void aSplitMovesEachInstrumentToItsPart() {
        String partB = uuid();
        List<double[]> a = SWD.subList(0, 2);
        List<double[]> b = SWD.subList(1, 3);
        double onB = 2841 - LineMeasure.distanceM(SWD.get(0), SWD.get(1));
        save(batch(uuid(), update(line, 1, "{\"geometry\":" + lineGeometry(a) + "}"), createLine(partB, "L-SWD B", b),
            moveTap(pt2, 1, partB, b, Math.round(onB * 10) / 10.0), moveTap(pt1, 1, line, a, 1143)));
        assertEquals(List.of(pt1), attached(line));
        assertEquals(List.of(pt2), attached(partB));
    }

    // --- Delete and undo ------------------------------------------------------------

    @Test
    void aLineDeletedWithItsInstrumentsIsOneSeqAndTheReverseBatchRestoresAllThree() {
        MapItemRecord lineBefore = stored(line);
        EditResult deleted = save(batch(uuid(), delete(pt1, 1), delete(line, 1), delete(pt2, 1)));
        assertEquals(2, deleted.seq());
        assertTrue(stored(line).deleted() && stored(pt1).deleted() && stored(pt2).deleted());
        assertEquals(3, store.committed.edits.stream().filter(e -> e.seq() == 2).count());
        // The reverse batch: a create at each tombstone's version, instruments first.
        EditResult restored = save(batch(uuid(), restore(stored(pt2)), restore(stored(pt1)), restore(stored(line))));
        assertEquals(3, restored.seq());
        for (String id : List.of(line, pt1, pt2)) {
            assertFalse(stored(id).deleted());
            assertEquals(3, stored(id).version());
        }
        assertEquals(new Attachment(line, 1143.0), stored(pt1).attachment());
        assertEquals(lineBefore.geometry(), stored(line).geometry());
        assertEquals(List.of(pt1, pt2), attached(line));
    }

    // --- Concurrent -------------------------------------------------------------------

    @Test
    void anInstrumentChangedByAnotherEditorRefusesTheWholeLineBatch() {
        save(batch(uuid(), update(pt1, 1, "{\"name\":\"PT-1 renamed\"}")));
        MapStudioException ex = refusedFull(batch(uuid(), update(line, 1, "{\"geometry\":"
            + lineGeometry(SWD_RESHAPED) + "}"), moveTap(pt1, 1, line, SWD_RESHAPED, 1150),
            moveTap(pt2, 1, line, SWD_RESHAPED, 2850)));
        assertEquals(Messages.CODE_CONFLICT, ex.code());
        assertEquals(1, ex.conflicts().size());
        assertEquals(pt1, ex.conflicts().get(0).getAsJsonObject().getAsJsonObject("current").get("id").getAsString());
        assertNothingWritten(4, 2);
    }

    // --- Style source --------------------------------------------------------------

    @Test
    void theInstrumentsStyleSourceIsSavedOnALineKindAndRefusedOnAPad() {
        String worst = "{\"setup\":{\"styleRule\":{\"source\":{\"instruments\":\"worst\"}}}}";
        save(batch(uuid(), "{\"op\":\"create\",\"entity\":\"kindSetup\",\"id\":\"line\",\"baseVersion\":0,\"data\":"
            + worst + "}"));
        assertEquals(1, store.kindSetups(PROJECT).size());
        MapStudioException ex = refusedFull(batch(uuid(), "{\"op\":\"create\",\"entity\":\"kindSetup\",\"id\":\"pad\","
            + "\"baseVersion\":0,\"data\":" + worst + "}"));
        assertEquals(Messages.CODE_INVALID, ex.code());
        assertTrue(ex.plainMessage().contains("styleRule.source: pad is a point kind"), ex.plainMessage());
    }

    // --- Phone ------------------------------------------------------------------------

    @Test
    void aPhoneEditorMayNotMoveAnInstrumentButMayChangeItsProperties() {
        MapStudioException moved = refused(batch(uuid(), update(pt1, 1, "{\"geometry\":" + pointAt(SWD, 1200) + "}")),
            Messages.LEVEL_PHONE);
        assertEquals(Messages.CODE_ROLE, moved.code());
        assertEquals("An instrument moves along its line; only full editing can move it. Nothing in this save was"
            + " written.", moved.plainMessage());
        MapStudioException attached = refused(batch(uuid(), moveTap(pt1, 1, line, SWD, 1200)), Messages.LEVEL_PHONE);
        assertEquals(Messages.CODE_ROLE, attached.code());
        assertEquals(RoleMatrix.INSTRUMENT_MESSAGE, attached.plainMessage());
        assertNothingWritten(3, 1);
        writes.apply(PROJECT, batch(uuid(), update(pt1, 1, "{\"properties\":{\"tag\":\"[default]SWD/PT1\"}}")),
            Actor.session("mapoperator"), Messages.LEVEL_PHONE);
        assertEquals(2, stored(pt1).version());
    }

    List<String> attached(String lineId) {
        try {
            return store.inTransaction("MapStudio", tx -> tx.liveAttached(PROJECT, lineId)).stream()
                .map(MapItemRecord::id).toList();
        } catch (java.sql.SQLException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
