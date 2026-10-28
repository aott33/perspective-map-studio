package com.aoindustrial.perspective.mapstudio.gateway.live;

import static com.aoindustrial.perspective.mapstudio.gateway.live.LiveFixtures.ASSETS;
import static com.aoindustrial.perspective.mapstudio.gateway.live.LiveFixtures.P1;
import static com.aoindustrial.perspective.mapstudio.gateway.live.LiveFixtures.P2;
import static com.aoindustrial.perspective.mapstudio.gateway.live.LiveFixtures.P3;
import static com.aoindustrial.perspective.mapstudio.gateway.live.LiveFixtures.UNLINKED;
import static com.aoindustrial.perspective.mapstudio.gateway.live.LiveFixtures.items;
import static com.aoindustrial.perspective.mapstudio.gateway.live.LiveFixtures.json;
import static com.aoindustrial.perspective.mapstudio.gateway.live.LiveFixtures.lists;
import static com.aoindustrial.perspective.mapstudio.gateway.live.LiveFixtures.padSetup;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.Asset;
import com.aoindustrial.perspective.mapstudio.common.contract.KindSetupRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.AdapterSnapshot;
import com.aoindustrial.perspective.mapstudio.gateway.load.MapLoader;

/** Epic 3 entry 5: the cache rows of the I/O matrix, with a fake tag system and a direct executor. */
class LiveValueCacheTest {

    static final String P = "mapstudio-dev";
    static final String P12_PRESSURE = "[default]Mesa/P12/Pressure";
    static final String P12_COMMS = "[default]Mesa/P12/Comms";

    FakeTagSubscriber tags;
    MapLoader.Snapshot snapshot;
    AdapterSnapshot adapters;
    RuntimeException storeFailure;
    LiveValueCache cache;

    @BeforeEach
    void setUp() {
        tags = new FakeTagSubscriber();
        snapshot = new MapLoader.Snapshot(3, items(), List.of(padSetup()));
        adapters = lists(ASSETS);
        cache = new LiveValueCache(tags, p -> {
            if (storeFailure != null) {
                throw storeFailure;
            }
            return snapshot;
        }, p -> adapters, null, Runnable::run);
        cache.ensure(P);
    }

    static JsonObject item(JsonObject body, String id) {
        for (JsonElement e : body.getAsJsonArray("items")) {
            if (id.equals(e.getAsJsonObject().get("id").getAsString())) {
                return e.getAsJsonObject();
            }
        }
        return null;
    }

    static List<String> ids(JsonObject body) {
        List<String> out = new ArrayList<>();
        for (JsonElement e : body.getAsJsonArray("items")) {
            out.add(e.getAsJsonObject().get("id").getAsString());
        }
        return out;
    }

    @Test
    void ensureSubscribesEachPathOnceAndTheFirstBatchIsFullWithTheDisplay() {
        assertEquals(18, tags.subscribed.size());
        assertEquals(Set.copyOf(tags.subscribed), cache.subscribedPaths(P));
        assertEquals(18, Set.copyOf(tags.subscribed).size(), "each path once");
        LiveValueCache.Batch first = cache.batch(P, -1);
        assertNotNull(first);
        assertTrue(first.full());
        assertEquals(Set.of(P1, P2, P3, UNLINKED), Set.copyOf(ids(first.body())));
        JsonArray display = first.body().getAsJsonArray("kindDisplay");
        assertEquals(1, display.size());
        assertEquals("pad", display.get(0).getAsJsonObject().get("kindId").getAsString());
        // Before any delivery the comms slot is "no value yet", stale, and a stale comms slot makes the
        // item's other slots stale for comms lost (plan decision 3).
        JsonObject p1 = item(first.body(), P1);
        assertTrue(p1.getAsJsonObject("comms").get("stale").getAsBoolean());
        assertEquals("no value yet", p1.getAsJsonObject("comms").get("reason").getAsString());
        assertEquals("comms lost", p1.getAsJsonObject("kpis").getAsJsonObject("pressure").get("reason").getAsString());
        assertEquals("comms lost", p1.getAsJsonObject("alarms").get("reason").getAsString());
        // The unlinked pad carries its problems and no slot.
        JsonObject unlinked = item(first.body(), UNLINKED);
        assertEquals(4, unlinked.getAsJsonArray("problems").size());
        assertFalse(unlinked.has("comms"));
        assertEquals(0, unlinked.getAsJsonObject("kpis").size());
        // Nothing changed since: no batch. The same full batch for a second map that opens now.
        assertNull(cache.batch(P, first.seq()));
        assertTrue(cache.batch(P, -1).full());
        assertEquals(18, tags.subscribed.size(), "a second open map subscribes nothing");
    }

    @Test
    void aDeliveryMakesAChangesOnlyBatchWithThatItemOnly() {
        LiveValueCache.Batch first = cache.batch(P, -1);
        tags.initial(P12_PRESSURE);
        LiveValueCache.Batch initial = cache.batch(P, first.seq());
        assertNotNull(initial);
        assertFalse(initial.full());
        assertEquals(List.of(P1), ids(initial.body()));
        JsonObject pressure = item(initial.body(), P1).getAsJsonObject("kpis").getAsJsonObject("pressure");
        assertEquals("Uncertain_InitialValue", pressure.get("quality").getAsString());
        assertTrue(pressure.get("stale").getAsBoolean());
        assertFalse(initial.body().has("kindDisplay"));

        tags.deliver(P12_PRESSURE, 412.5);
        LiveValueCache.Batch next = cache.batch(P, initial.seq());
        pressure = item(next.body(), P1).getAsJsonObject("kpis").getAsJsonObject("pressure");
        assertEquals(412.5, pressure.get("value").getAsDouble());
        assertEquals("Good", pressure.get("quality").getAsString());
        assertEquals("2026-10-28T10:00:00Z", pressure.get("t").getAsString());
        // Comms has no value yet: the item's values are stale for comms lost (plan decision 3).
        assertTrue(pressure.get("stale").getAsBoolean());
        assertEquals("comms lost", pressure.get("reason").getAsString());
        tags.deliver(P12_COMMS, true);
        pressure = item(cache.batch(P, next.seq()).body(), P1).getAsJsonObject("kpis").getAsJsonObject("pressure");
        assertFalse(pressure.get("stale").getAsBoolean());
        assertEquals("", pressure.get("reason").getAsString());
    }

    @Test
    void commsLostMakesEveryValueOfTheItemStaleAndTheCommsSlotSaysFalse() {
        cache.batch(P, -1);
        tags.deliver(P12_COMMS, true);
        tags.deliver(P12_PRESSURE, 400);
        for (String metric : AlarmMetrics.METRICS) {
            tags.deliver("[default]Mesa/P12/Alarm Metrics." + metric, 0);
        }
        long seq = cache.seq(P);
        JsonObject p1 = cache.itemBatch(P, P1).body().getAsJsonArray("items").get(0).getAsJsonObject();
        assertFalse(p1.getAsJsonObject("comms").get("stale").getAsBoolean());
        assertFalse(p1.getAsJsonObject("alarms").get("stale").getAsBoolean());
        tags.deliver(P12_COMMS, false);
        LiveValueCache.Batch batch = cache.batch(P, seq);
        p1 = item(batch.body(), P1);
        JsonObject comms = p1.getAsJsonObject("comms");
        assertEquals(false, comms.get("value").getAsBoolean());
        assertFalse(comms.get("stale").getAsBoolean(), "false with a good quality is a value, not stale");
        JsonObject pressure = p1.getAsJsonObject("kpis").getAsJsonObject("pressure");
        assertEquals(400, pressure.get("value").getAsInt());
        assertTrue(pressure.get("stale").getAsBoolean());
        assertEquals("comms lost", pressure.get("reason").getAsString());
        assertTrue(p1.getAsJsonObject("alarms").get("stale").getAsBoolean());
        assertEquals("comms lost", p1.getAsJsonObject("alarms").get("reason").getAsString());
        // A bad comms quality is comms lost too.
        tags.deliver(P12_COMMS, true, "Bad_Stale", false, false);
        p1 = item(cache.batch(P, batch.seq()).body(), P1);
        assertTrue(p1.getAsJsonObject("comms").get("stale").getAsBoolean());
        assertEquals("Bad_Stale", p1.getAsJsonObject("comms").get("reason").getAsString());
        assertEquals("comms lost", p1.getAsJsonObject("kpis").getAsJsonObject("pressure").get("reason").getAsString());
    }

    @Test
    void theAlarmsSlotCombinesTheThreeMetricsAndMapsThePriority() {
        cache.batch(P, -1);
        tags.deliver(P12_COMMS, true);
        tags.deliver("[default]Mesa/P12/Alarm Metrics.ActiveAckCount", 0);
        tags.deliver("[default]Mesa/P12/Alarm Metrics.ActiveUnackCount", 1);
        tags.deliver("[default]Mesa/P12/Alarm Metrics.HighestActivePriority", 3);
        JsonObject alarms = cache.itemBatch(P, P1).body().getAsJsonArray("items").get(0).getAsJsonObject()
            .getAsJsonObject("alarms");
        assertEquals(1, alarms.getAsJsonObject("value").get("active").getAsInt());
        assertEquals(1, alarms.getAsJsonObject("value").get("unacked").getAsInt());
        assertEquals(1, alarms.getAsJsonObject("value").get("priority").getAsInt());
        assertEquals("Good", alarms.get("quality").getAsString());
        assertFalse(alarms.get("stale").getAsBoolean());
        // Acknowledged: the unacked count drops, the priority stays.
        tags.deliver("[default]Mesa/P12/Alarm Metrics.ActiveAckCount", 1);
        tags.deliver("[default]Mesa/P12/Alarm Metrics.ActiveUnackCount", 0);
        alarms = cache.itemBatch(P, P1).body().getAsJsonArray("items").get(0).getAsJsonObject().getAsJsonObject("alarms");
        assertEquals(1, alarms.getAsJsonObject("value").get("active").getAsInt());
        assertEquals(0, alarms.getAsJsonObject("value").get("unacked").getAsInt());
        // One metric not good: the slot is stale with that quality.
        tags.deliver("[default]Mesa/P12/Alarm Metrics.HighestActivePriority", null, "Bad", false, false);
        alarms = cache.itemBatch(P, P1).body().getAsJsonArray("items").get(0).getAsJsonObject().getAsJsonObject("alarms");
        assertTrue(alarms.get("stale").getAsBoolean());
        assertEquals("Bad", alarms.get("reason").getAsString());
    }

    @Test
    void aTagTheSystemDoesNotHaveIsReportedPerItemWithNoPath() {
        cache.batch(P, -1);
        tags.notFound("[default]Mesa/P15/Comms");
        tags.notFound("[default]Mesa/P15/Pressure");
        JsonObject p3 = cache.itemBatch(P, P3).body().getAsJsonArray("items").get(0).getAsJsonObject();
        JsonArray problems = p3.getAsJsonArray("problems");
        assertEquals(2, problems.size());
        assertEquals("comms", problems.get(0).getAsJsonObject().get("slot").getAsString());
        assertEquals("the tag was not found", problems.get(0).getAsJsonObject().get("reason").getAsString());
        assertEquals("kpi:pressure", problems.get(1).getAsJsonObject().get("slot").getAsString());
        assertFalse(p3.toString().contains("[default]"), "no path reaches the browser");
        assertEquals("Bad_NotFound", p3.getAsJsonObject("comms").get("quality").getAsString());
    }

    @Test
    void aRebuildDiffsTheSubscriptionsAndMakesTheNextBatchFull() {
        LiveValueCache.Batch first = cache.batch(P, -1);
        tags.deliver(P12_PRESSURE, 1);
        LiveValueCache.Batch after = cache.batch(P, first.seq());
        assertFalse(after.full());
        // The kind setup drops Flow and gains a full path; a committed batch asks for a rebuild.
        KindSetupRecord changed = new KindSetupRecord("pad", json("{\"comms\":{\"path\":\"{asset.path}/Comms\"},"
            + "\"kpis\":[{\"key\":\"pressure\",\"path\":\"{asset.path}/Pressure\",\"icon\":true},"
            + "{\"key\":\"header\",\"path\":\"[default]Plant/Header/Pressure\"}]}"), 2, false);
        snapshot = new MapLoader.Snapshot(4, items(), List.of(changed));
        cache.rebuild(P);
        assertTrue(tags.cancelled.containsAll(List.of("[default]Mesa/P12/Flow", "[default]Mesa/P14/Flow",
            "[default]Mesa/P12/Alarm Metrics.ActiveAckCount")));
        assertTrue(tags.subscribed.contains("[default]Plant/Header/Pressure"));
        assertEquals(1, tags.subscribed.stream().filter("[default]Plant/Header/Pressure"::equals).count());
        assertEquals(1, tags.subscribed.stream().filter(P12_PRESSURE::equals).count(), "a kept path is not subscribed again");
        LiveValueCache.Batch full = cache.batch(P, after.seq());
        assertTrue(full.full());
        assertTrue(full.body().has("kindDisplay"));
        assertEquals(1, item(full.body(), P1).getAsJsonObject("kpis").getAsJsonObject("pressure").get("value").getAsInt(),
            "a kept path keeps its value");
        assertEquals(Set.copyOf(cache.subscribedPaths(P)), Set.copyOf(tags.listeners.keySet()));
    }

    @Test
    void theAssetListBeingReplacedRebuildsAtTheCheck() {
        cache.batch(P, -1);
        List<Asset> more = new ArrayList<>(ASSETS);
        more.add(new Asset("P99", "Pad 99", "pad", "[default]Mesa/P99"));
        adapters = lists(more);
        cache.checkAssets(P);
        assertTrue(cache.batch(P, cache.seq(P) - 1).full(), "a replaced asset list is a rebuild");
        cache.checkAssets(P);
        assertNull(cache.batch(P, cache.seq(P)), "the same list again rebuilds nothing");
    }

    @Test
    void anUnreachableStoreKeepsTheLastPlan() {
        cache.batch(P, -1);
        storeFailure = new MapStudioException(Messages.CODE_STORE_UNREACHABLE, "down");
        cache.rebuild(P);
        assertEquals(Set.of(P1, P2, P3, UNLINKED), cache.plannedItems(P));
        assertEquals(0, tags.cancelled.size());
    }

    @Test
    void anOpenPopupIsToldOfItsItemsChangesOnly() {
        cache.batch(P, -1);
        AtomicInteger told = new AtomicInteger();
        LiveValueCache.Subscription s = cache.onItemChange(P, P1, told::incrementAndGet);
        tags.deliver("[default]Mesa/P14/Pressure", 1);
        assertEquals(0, told.get());
        tags.deliver(P12_PRESSURE, 1);
        assertEquals(1, told.get());
        s.cancel();
        tags.deliver(P12_PRESSURE, 2);
        assertEquals(1, told.get());
        assertEquals(List.of(P1), ids(cache.itemBatch(P, P1).body()));
        assertNull(cache.itemBatch(P, "nope"));
    }

    @Test
    void closeUnsubscribesEverything() {
        cache.close();
        assertEquals(18, tags.cancelled.size());
        assertEquals(Set.of(), cache.subscribedPaths(P));
    }
}
