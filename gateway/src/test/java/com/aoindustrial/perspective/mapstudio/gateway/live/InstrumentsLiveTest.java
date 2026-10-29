package com.aoindustrial.perspective.mapstudio.gateway.live;

import static com.aoindustrial.perspective.mapstudio.gateway.live.LiveFixtures.json;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;

import com.aoindustrial.perspective.mapstudio.common.contract.AdapterStatus;
import com.aoindustrial.perspective.mapstudio.common.contract.Asset;
import com.aoindustrial.perspective.mapstudio.common.contract.KindSetupRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.AdapterSnapshot;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.TestKinds;
import com.aoindustrial.perspective.mapstudio.gateway.load.MapLoader;

/**
 * Epic 3 entry 2: the segments slot of a line whose style is the instruments source, graded from
 * the instruments at each segment's ends (the I/O matrix rows Nodes, Segments slot, Stale, Alarm,
 * No instruments, Other rule), the line regraded on an instrument's delivery, and the items an open
 * line popup follows. The L-SWD of the plan: CTB1 and SWD1 at the ends, PT-1 at 1,143 m, LV-1 (a
 * valve, no icon KPI) at 2,000 m, PT-2 at 2,841 m.
 */
class InstrumentsLiveTest {

    static final String P = "mapstudio-dev";
    static final String LINE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    static final String CTB1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    static final String SWD1 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    static final String PT1 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    static final String PT2 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    static final String LV1 = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    static final String TRACER = "99999999-9999-4999-8999-999999999999";

    static final String TAP_SETUP = "{\"comms\":{\"path\":\"{asset.path}/Comms\"},"
        + "\"kpis\":[{\"key\":\"pressure\",\"label\":\"Pressure\",\"path\":\"{asset.path}/Pressure\",\"unit\":\"psi\",\"icon\":true}],"
        + "\"alarms\":{\"path\":\"{asset.path}\"},"
        + "\"styleRule\":{\"source\":{\"kpi\":\"pressure\"},\"type\":\"bands\",\"cases\":["
        + "{\"min\":null,\"max\":450,\"preset\":\"normal\"},{\"min\":450,\"max\":600,\"preset\":\"attention\"},"
        + "{\"min\":600,\"max\":null,\"preset\":\"fault\"}]}}";
    /** A valve: comms and a KPI that is not the icon value, so it bounds no segment. */
    static final String VALVE_SETUP = "{\"comms\":{\"path\":\"{asset.path}/Comms\"},"
        + "\"kpis\":[{\"key\":\"position\",\"label\":\"Position\",\"path\":\"{asset.path}/Position\",\"unit\":\"%\"}]}";
    /** The line kind's own rule is entry 1's Bands rule on flow; L-SWD overrides it with the instruments source. */
    static final String LINE_SETUP = "{\"kpis\":[{\"key\":\"flow\",\"label\":\"Flow\",\"path\":\"{asset.path}/Flow\",\"unit\":\"bbl/d\",\"icon\":true}],"
        + "\"styleRule\":{\"source\":{\"kpi\":\"flow\"},\"type\":\"bands\",\"cases\":["
        + "{\"min\":null,\"max\":50,\"preset\":\"normal\"},{\"min\":50,\"max\":null,\"preset\":\"attention\"}]}}";

    static final List<Asset> ASSETS = List.of(
        new Asset("PT1", "PT-1", "tap", "[default]Mesa/SWD/PT1"),
        new Asset("PT2", "PT-2", "tap", "[default]Mesa/SWD/PT2"),
        new Asset("LV1", "LV-1", "valve", "[default]Mesa/SWD/LV1"),
        new Asset("LSWD", "L-SWD", "line", "[default]Mesa/SWD/LSWD"),
        new Asset("L3", "Line 3", "line", "[default]Mesa/Lines/L3"));

    FakeTagSubscriber tags;
    MapLoader.Snapshot snapshot;
    LiveValueCache cache;

    static MapItemRecord point(String id, String kind, String name, String assetId, String attachment) {
        return MapItemRecord.fromCreate(id, json("{\"kind\":\"" + kind + "\",\"name\":\"" + name + "\",\"geometry\":{\"type\":\"Point\","
            + "\"coordinates\":[-104.95,39.72]},\"properties\":{}"
            + (assetId == null ? "" : ",\"assetId\":\"" + assetId + "\"")
            + (attachment == null ? "" : ",\"attachment\":" + attachment) + "}"), 0);
    }

    static MapItemRecord line(String id, String name, String assetId, String ends, String overrides) {
        return MapItemRecord.fromCreate(id, json("{\"kind\":\"line\",\"name\":\"" + name + "\",\"geometry\":{\"type\":\"LineString\","
            + "\"coordinates\":[[-104.958,39.7265],[-104.948,39.723],[-104.925174,39.719902]]},\"properties\":{\"diameter\":6}"
            + (assetId == null ? "" : ",\"assetId\":\"" + assetId + "\"")
            + (ends == null ? "" : ",\"ends\":" + ends)
            + (overrides == null ? "" : ",\"overrides\":" + overrides) + "}"), 0);
    }

    static String attached(double distanceM) {
        return "{\"lineId\":\"" + LINE + "\",\"distanceM\":" + distanceM + "}";
    }

    static List<MapItemRecord> swd() {
        return List.of(
            point(CTB1, "pad", "CTB1", null, null),
            point(SWD1, "pad", "SWD1", null, null),
            line(LINE, "L-SWD", "LSWD", "{\"start\":{\"itemId\":\"" + CTB1 + "\"},\"end\":{\"itemId\":\"" + SWD1 + "\"}}",
                "{\"styleRule\":{\"source\":{\"instruments\":\"worst\"}}}"),
            // Saved out of order on purpose: the plan orders by distance.
            point(PT2, "tap", "PT-2", "PT2", attached(2841)),
            point(LV1, "valve", "LV-1", "LV1", attached(2000)),
            point(PT1, "tap", "PT-1", "PT1", attached(1143)),
            line(TRACER, "Tracer line", "L3", null, null));
    }

    static List<KindSetupRecord> setups() {
        return List.of(new KindSetupRecord("tap", json(TAP_SETUP), 1, false),
            new KindSetupRecord("valve", json(VALVE_SETUP), 1, false),
            new KindSetupRecord("line", json(LINE_SETUP), 1, false));
    }

    static AdapterSnapshot lists() {
        List<com.aoindustrial.perspective.mapstudio.common.contract.Kind> kinds = new ArrayList<>(TestKinds.KINDS);
        kinds.add(new com.aoindustrial.perspective.mapstudio.common.contract.Kind("valve", "Line valve", "point", "line-valve", 2,
            List.of(), false, true));
        AdapterStatus ok = new AdapterStatus(AdapterStatus.OK, "ok", "f", 1, 0, null);
        return new AdapterSnapshot(kinds, ASSETS, ok, ok);
    }

    @BeforeEach
    void setUp() {
        tags = new FakeTagSubscriber();
        snapshot = new MapLoader.Snapshot(3, swd(), setups());
        cache = new LiveValueCache(tags, p -> snapshot, p -> lists(), null, Runnable::run);
        cache.ensure(P);
        // Every tap and valve alive: comms on, PT-1 398 psi, PT-2 371 psi, LV-1 at 100 %, no alarm.
        for (String pt : List.of("PT1", "PT2")) {
            tags.deliver("[default]Mesa/SWD/" + pt + "/Comms", true);
            tags.deliver("[default]Mesa/SWD/" + pt + "/Alarm Metrics.ActiveAckCount", 0);
            tags.deliver("[default]Mesa/SWD/" + pt + "/Alarm Metrics.ActiveUnackCount", 0);
            tags.deliver("[default]Mesa/SWD/" + pt + "/Alarm Metrics.HighestActivePriority", 0);
        }
        tags.deliver("[default]Mesa/SWD/PT1/Pressure", 398);
        tags.deliver("[default]Mesa/SWD/PT2/Pressure", 371);
        tags.deliver("[default]Mesa/SWD/LV1/Comms", true);
        tags.deliver("[default]Mesa/SWD/LV1/Position", 100);
        tags.deliver("[default]Mesa/SWD/LSWD/Flow", 20);
    }

    JsonObject lineItem() {
        LiveValueCache.Batch batch = cache.itemBatch(P, LINE);
        assertNotNull(batch, "the line is planned though it has no slot of its own but the KPI");
        return batch.body().getAsJsonArray("items").get(0).getAsJsonObject();
    }

    static List<String> presets(JsonArray segments) {
        List<String> out = new ArrayList<>();
        for (JsonElement e : segments) {
            out.add(e.getAsJsonObject().get("preset").getAsString() + (e.getAsJsonObject().get("stale").getAsBoolean() ? ":stale" : ""));
        }
        return out;
    }

    @Test
    void thePlanIndexesTheInstrumentsOfALineInOrderWithTheirIconKpiAndTheEnds() {
        ValuePlan.Plan plan = ValuePlan.build(setups(), swd(), ASSETS, lists().kinds());
        List<ValuePlan.Instrument> instruments = plan.instrumentsOf(LINE);
        assertEquals(List.of(PT1, LV1, PT2), instruments.stream().map(ValuePlan.Instrument::id).toList());
        assertEquals(java.util.Arrays.asList("pressure", null, "pressure"), instruments.stream().map(ValuePlan.Instrument::iconKpi).toList());
        assertEquals(List.of(true, false, true), instruments.stream().map(ValuePlan.Instrument::measures).toList());
        assertEquals(new ValuePlan.Ends(CTB1, SWD1), plan.endsOf(LINE));
        assertEquals(new ValuePlan.Ends(null, null), plan.endsOf(TRACER));
        assertTrue(plan.gradesSegments(LINE), "the override's instruments rule is the line's style");
        assertFalse(plan.gradesSegments(TRACER), "the kind's Bands rule stays on the tracer line");
        assertEquals(List.of(LINE), plan.linesRegradedBy(PT1));
        assertEquals(List.of(LINE), plan.linesRegradedBy(LV1));
        assertEquals(List.of(), plan.linesRegradedBy(CTB1));
        // The instruments source adds no tag path: the line's own paths are its KPI's.
        assertEquals(Set.of("[default]Mesa/SWD/LSWD/Flow"), Set.copyOf(plan.items().get(LINE).slots().values()));
        assertEquals(List.of(CTB1, PT1, PT2, SWD1), Segments.nodes(plan.endsOf(LINE), instruments));
        assertEquals(List.of(Segments.START, PT1, Segments.END),
            Segments.nodes(new ValuePlan.Ends(null, null), List.of(instruments.get(0))));
    }

    @Test
    void theSegmentsSlotIsTheWorstOfTheInstrumentsAtEachSegmentsEnds() {
        JsonObject line = lineItem();
        JsonArray segments = line.getAsJsonArray("segments");
        assertEquals(3, segments.size(), "CTB1 to PT-1, PT-1 to PT-2, PT-2 to SWD1; LV-1 bounds nothing");
        assertEquals(CTB1, segments.get(0).getAsJsonObject().get("from").getAsString());
        assertEquals(PT1, segments.get(0).getAsJsonObject().get("to").getAsString());
        assertEquals(PT2, segments.get(2).getAsJsonObject().get("from").getAsString());
        assertEquals(SWD1, segments.get(2).getAsJsonObject().get("to").getAsString());
        assertEquals(List.of("normal", "normal", "normal"), presets(segments));
        assertEquals("normal", line.getAsJsonObject("style").get("preset").getAsString());
        assertFalse(line.getAsJsonObject("style").get("stale").getAsBoolean());
        assertEquals(20, line.getAsJsonObject("kpis").getAsJsonObject("flow").get("value").getAsInt(), "the line's own KPI stays");
        // PT-2 outside its band: attention on PT-1 to PT-2 and PT-2 to SWD1 only; the line's own style says so.
        tags.deliver("[default]Mesa/SWD/PT2/Pressure", 500);
        line = lineItem();
        assertEquals(List.of("normal", "attention", "attention"), presets(line.getAsJsonArray("segments")));
        assertEquals("attention", line.getAsJsonObject("style").get("preset").getAsString());
        // PT-1 in fault too: the worse of the two ends.
        tags.deliver("[default]Mesa/SWD/PT1/Pressure", 700);
        assertEquals(List.of("fault", "fault", "attention"), presets(lineItem().getAsJsonArray("segments")));
        // No path in a values batch; only the open popup's own push carries the popup detail (entry 8).
        assertFalse(cache.itemsBatch(P, Set.of(LINE)).body().toString().contains("[default]"), "no path in the batch");
    }

    @Test
    void aStaleInstrumentDashesItsTwoSegmentsOnlyAndNamesItself() {
        tags.deliver("[default]Mesa/SWD/PT1/Comms", false);
        JsonObject line = lineItem();
        assertEquals(List.of("normal:stale", "normal:stale", "normal"), presets(line.getAsJsonArray("segments")));
        assertEquals("PT-1: comms lost", line.getAsJsonArray("segments").get(0).getAsJsonObject().get("reason").getAsString());
        assertEquals("", line.getAsJsonArray("segments").get(2).getAsJsonObject().get("reason").getAsString());
        assertTrue(line.getAsJsonObject("style").get("stale").getAsBoolean());
        assertEquals("PT-1: comms lost", line.getAsJsonObject("style").get("reason").getAsString());
        tags.deliver("[default]Mesa/SWD/PT1/Comms", true);
        // A stale value on PT-2's pressure (a bad quality) dashes PT-1 to PT-2 and PT-2 to SWD1.
        tags.deliver("[default]Mesa/SWD/PT2/Pressure", 371, "Bad_Stale", false, false);
        assertEquals(List.of("normal", "normal:stale", "normal:stale"), presets(lineItem().getAsJsonArray("segments")));
        assertEquals("PT-2: Bad_Stale", lineItem().getAsJsonArray("segments").get(1).getAsJsonObject().get("reason").getAsString());
        // The valve's comms lost changes no segment: it bounds none.
        tags.deliver("[default]Mesa/SWD/PT2/Pressure", 371);
        tags.deliver("[default]Mesa/SWD/LV1/Comms", false);
        assertEquals(List.of("normal", "normal", "normal"), presets(lineItem().getAsJsonArray("segments")));
    }

    @Test
    void anInstrumentsAlarmRidesItsTwoSegmentsAndTheWorseOfTwoWins() {
        tags.deliver("[default]Mesa/SWD/PT2/Pressure", 950);
        tags.deliver("[default]Mesa/SWD/PT2/Alarm Metrics.ActiveUnackCount", 1);
        tags.deliver("[default]Mesa/SWD/PT2/Alarm Metrics.HighestActivePriority", 3);
        JsonArray segments = lineItem().getAsJsonArray("segments");
        assertEquals(List.of("normal", "fault", "fault"), presets(segments));
        assertTrue(segments.get(0).getAsJsonObject().get("alarm").isJsonNull());
        JsonObject alarm = segments.get(1).getAsJsonObject().getAsJsonObject("alarm");
        assertEquals(1, alarm.get("priority").getAsInt(), "Ignition High is the map's priority 1");
        assertEquals(1, alarm.get("unacked").getAsInt());
        assertEquals(1, segments.get(2).getAsJsonObject().getAsJsonObject("alarm").get("active").getAsInt());
        // PT-1 with an acknowledged medium alarm: PT-1 to PT-2 keeps PT-2's (priority 1 beats 2).
        tags.deliver("[default]Mesa/SWD/PT1/Alarm Metrics.ActiveAckCount", 1);
        tags.deliver("[default]Mesa/SWD/PT1/Alarm Metrics.HighestActivePriority", 2);
        segments = lineItem().getAsJsonArray("segments");
        assertEquals(2, segments.get(0).getAsJsonObject().getAsJsonObject("alarm").get("priority").getAsInt());
        assertEquals(1, segments.get(1).getAsJsonObject().getAsJsonObject("alarm").get("priority").getAsInt());
    }

    @Test
    void aLineWithAnotherRuleOrNoInstrumentsCarriesNoSegments() {
        JsonObject tracer = cache.itemBatch(P, TRACER).body().getAsJsonArray("items").get(0).getAsJsonObject();
        assertNull(tracer.get("segments"));
        assertEquals("normal", tracer.getAsJsonObject("style").get("preset").getAsString());
        // The instruments rule on a line with no instruments: one segment, start to end, normal.
        snapshot = new MapLoader.Snapshot(4, List.of(line(LINE, "Bare", "LSWD", null,
            "{\"styleRule\":{\"source\":{\"instruments\":\"worst\"}}}")), setups());
        cache.rebuild(P);
        JsonObject bare = lineItem();
        assertEquals(1, bare.getAsJsonArray("segments").size());
        assertEquals(Segments.START, bare.getAsJsonArray("segments").get(0).getAsJsonObject().get("from").getAsString());
        assertEquals(Segments.END, bare.getAsJsonArray("segments").get(0).getAsJsonObject().get("to").getAsString());
        assertEquals(List.of("normal"), presets(bare.getAsJsonArray("segments")));
    }

    @Test
    void anInstrumentsDeliveryMarksItsLineChangedAndAnOpenLinePopupFollowsEveryInstrument() {
        LiveValueCache.Batch first = cache.batch(P, -1);
        assertTrue(first.full());
        assertNull(cache.batch(P, first.seq()), "nothing changed");
        tags.deliver("[default]Mesa/SWD/PT2/Pressure", 500);
        LiveValueCache.Batch next = cache.batch(P, first.seq());
        List<String> ids = new ArrayList<>();
        next.body().getAsJsonArray("items").forEach((e) -> ids.add(e.getAsJsonObject().get("id").getAsString()));
        assertEquals(Set.of(PT2, LINE), Set.copyOf(ids), "the instrument and the line it regrades");
        // The popup of the line follows the line and its three instruments; a change of any pushes.
        assertEquals(Set.of(LINE, PT1, LV1, PT2), cache.popupItems(P, LINE));
        assertEquals(Set.of(PT1), cache.popupItems(P, PT1));
        AtomicInteger told = new AtomicInteger();
        LiveValueCache.Subscription s = cache.onItemsChange(P, cache.popupItems(P, LINE), told::incrementAndGet);
        tags.deliver("[default]Mesa/SWD/LV1/Position", 50);
        assertEquals(1, told.get());
        tags.deliver("[default]Mesa/SWD/LSWD/Flow", 30);
        assertEquals(2, told.get());
        tags.deliver("[default]Mesa/Lines/L3/Flow", 30);
        assertEquals(2, told.get(), "another line's change is not the popup's");
        s.cancel();
        LiveValueCache.Batch push = cache.itemsBatch(P, cache.popupItems(P, LINE));
        List<String> pushed = new ArrayList<>();
        push.body().getAsJsonArray("items").forEach((e) -> pushed.add(e.getAsJsonObject().get("id").getAsString()));
        assertEquals(Set.of(LINE, PT1, LV1, PT2), Set.copyOf(pushed));
        assertFalse(push.full());
        push.body().getAsJsonArray("items").forEach((e) -> assertFalse(e.getAsJsonObject().has("popup"),
            "a batch that names no open item carries no popup detail"));
        assertNull(cache.itemsBatch(P, Set.of("nope")));
        // The open line popup's push (entries 2 and 8 merged): the line carries the popup detail, its
        // instruments never do.
        LiveValueCache.Batch open = cache.itemsBatch(P, cache.popupItems(P, LINE), LINE);
        open.body().getAsJsonArray("items").forEach((e) -> {
            JsonObject item = e.getAsJsonObject();
            assertEquals(LINE.equals(item.get("id").getAsString()), item.has("popup"), item.get("id").getAsString());
        });
    }

    @Test
    void theGradeOfAnInstrumentReadsItsOwnBatchItem() {
        JsonObject fresh = json("{\"style\":{\"preset\":\"warning\",\"stale\":false,\"reason\":\"\"},"
            + "\"comms\":{\"value\":true,\"stale\":false,\"reason\":\"\"},"
            + "\"kpis\":{\"pressure\":{\"value\":5,\"stale\":false,\"reason\":\"\"}},"
            + "\"alarms\":{\"value\":{\"active\":2,\"unacked\":0,\"priority\":2},\"stale\":false,\"reason\":\"\"}}");
        Segments.Grade g = Segments.of("PT-9", fresh, "pressure");
        assertEquals("warning", g.preset());
        assertFalse(g.stale());
        assertEquals(2, g.alarm().get("priority").getAsInt());
        // No style rule and no value yet in the icon KPI: stale, "no value yet".
        JsonObject empty = json("{\"comms\":{\"value\":true,\"stale\":false,\"reason\":\"\"},\"kpis\":{\"pressure\":{\"value\":null,\"stale\":true,\"reason\":\"no value yet\"}}}");
        assertEquals(new Segments.Grade("normal", true, "PT-9: no value yet", null), Segments.of("PT-9", empty, "pressure"));
        // The worse of two alarms: priority first, then unacknowledged.
        JsonObject a = json("{\"active\":1,\"unacked\":0,\"priority\":1}");
        JsonObject b = json("{\"active\":1,\"unacked\":1,\"priority\":1}");
        assertEquals(b, Segments.worseAlarm(a, b));
        assertEquals(a, Segments.worseAlarm(a, json("{\"active\":1,\"unacked\":1,\"priority\":3}")));
        assertNull(Segments.worseAlarm(null, null));
        Map<String, Segments.Grade> grades = Map.of("x", new Segments.Grade("fault", false, "", null));
        assertEquals("fault", Segments.grade(List.of("start", "x", "end"), grades).get(1).preset());
    }
}
