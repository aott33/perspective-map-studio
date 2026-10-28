package com.aoindustrial.perspective.mapstudio.gateway.live;

import static com.aoindustrial.perspective.mapstudio.gateway.live.LiveFixtures.ASSETS;
import static com.aoindustrial.perspective.mapstudio.gateway.live.LiveFixtures.P1;
import static com.aoindustrial.perspective.mapstudio.gateway.live.LiveFixtures.items;
import static com.aoindustrial.perspective.mapstudio.gateway.live.LiveFixtures.lists;
import static com.aoindustrial.perspective.mapstudio.gateway.live.LiveFixtures.padSetup;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonObject;

import com.aoindustrial.perspective.mapstudio.gateway.load.MapLoader;

/** Epic 3 entry 5: one open map's batches and popup pushes, on a real one-thread scheduler. */
class LiveSessionTest {

    static final String P = "mapstudio-dev";

    ScheduledExecutorService live;
    FakeTagSubscriber tags;
    LiveValueCache cache;
    List<JsonObject> sent;
    LiveSession session;

    @BeforeEach
    void setUp() {
        live = Executors.newSingleThreadScheduledExecutor();
        tags = new FakeTagSubscriber();
        MapLoader.Snapshot snapshot = new MapLoader.Snapshot(3, items(), List.of(padSetup()));
        cache = new LiveValueCache(tags, p -> snapshot, p -> lists(ASSETS), null, live);
        sent = new CopyOnWriteArrayList<>();
        session = new LiveSession(cache, live, P, sent::add);
    }

    @AfterEach
    void tearDown() {
        session.stop();
        live.shutdownNow();
    }

    private void await(int count) throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (sent.size() < count && System.nanoTime() < deadline) {
            Thread.sleep(20);
        }
        assertTrue(sent.size() >= count, "expected " + count + " batches, got " + sent.size());
    }

    @Test
    void aLoadedMapGetsAFullBatchAtOnceThenChangesOnlyPerInterval() throws Exception {
        session.loaded(1);
        await(1);
        assertTrue(sent.get(0).get("full").getAsBoolean());
        assertTrue(sent.get(0).has("kindDisplay"));
        // Nothing changed: no second batch after an interval.
        Thread.sleep(1300);
        assertEquals(1, sent.size());
        // A change: the next tick sends that item only.
        tags.deliver("[default]Mesa/P12/Pressure", 7);
        await(2);
        assertFalse(sent.get(1).get("full").getAsBoolean());
        assertEquals(1, sent.get(1).getAsJsonArray("items").size());
        assertEquals(P1, sent.get(1).getAsJsonArray("items").get(0).getAsJsonObject().get("id").getAsString());
        // A reload: full again.
        session.loaded(1);
        await(3);
        assertTrue(sent.get(2).get("full").getAsBoolean());
    }

    @Test
    void anOpenPopupPushesItsItemWithinTheDelayAndStopsAtClose() throws Exception {
        session.loaded(60);
        await(1);
        session.popupOpen(P1);
        assertEquals(P1, session.popupItem());
        long before = System.nanoTime();
        tags.deliver("[default]Mesa/P12/Pressure", 1);
        tags.deliver("[default]Mesa/P12/Pressure", 2);
        await(2);
        long tookMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - before);
        assertTrue(tookMs < 2000, "pushed within the delay, not the 60 s interval: " + tookMs + " ms");
        assertFalse(sent.get(1).get("full").getAsBoolean());
        assertEquals(2, sent.get(1).getAsJsonArray("items").get(0).getAsJsonObject().getAsJsonObject("kpis")
            .getAsJsonObject("pressure").get("value").getAsInt(), "the push carries the latest value, once");
        Thread.sleep(400);
        assertEquals(2, sent.size(), "two deliveries within the delay are one push");
        // Another item's change pushes nothing.
        tags.deliver("[default]Mesa/P14/Pressure", 1);
        Thread.sleep(400);
        assertEquals(2, sent.size());
        session.popupClose();
        assertNull(session.popupItem());
        tags.deliver("[default]Mesa/P12/Pressure", 3);
        Thread.sleep(400);
        assertEquals(2, sent.size(), "closed: no push");
    }
}
