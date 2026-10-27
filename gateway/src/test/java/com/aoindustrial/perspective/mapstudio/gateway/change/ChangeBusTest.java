package com.aoindustrial.perspective.mapstudio.gateway.change;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;
import org.junit.jupiter.api.Test;

import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;
import com.aoindustrial.perspective.mapstudio.gateway.write.Actor;
import com.aoindustrial.perspective.mapstudio.gateway.write.ChangeHook;

/** The change bus: epic 2 story 4's matrix rows on the Gateway side, with a direct executor and a fake clock. */
class ChangeBusTest {

    private final AtomicLong now = new AtomicLong(1_000);
    private final List<Runnable> timers = new ArrayList<>();
    private final AtomicBoolean closed = new AtomicBoolean();
    private final ChangeBus bus = new ChangeBus(Runnable::run, (task, delay) -> timers.add(task), now::get,
        () -> closed.set(true));

    private static MapItemRecord line(String id) {
        JsonObject data = JsonParser.parseString("{\"kind\":\"line\",\"name\":\"L\",\"geometry\":{\"type\":\"LineString\","
            + "\"coordinates\":[[-104.99,39.74],[-104.98,39.75]]}}").getAsJsonObject();
        return MapItemRecord.fromCreate(id, data, 0);
    }

    private static ChangeHook.CommittedBatch batch(String project, long seq) {
        String id = "00000000-0000-4000-8000-" + String.format("%012d", seq);
        return new ChangeHook.CommittedBatch(project, seq, "b-" + seq, Actor.session("mapeditor"),
            List.of(new ChangeHook.CommittedOp("create", "item", id, line(id))));
    }

    private static List<Long> seqs(List<JsonObject> bodies) {
        List<Long> out = new ArrayList<>();
        for (JsonObject b : bodies) {
            out.add(b.get("seq").getAsLong());
        }
        return out;
    }

    private void runTimers() {
        List<Runnable> due = new ArrayList<>(timers);
        timers.clear();
        due.forEach(Runnable::run);
    }

    @Test
    void everyOpenMapOfTheProjectGetsTheBatchWithFullRecords() {
        List<JsonObject> a = new ArrayList<>();
        List<JsonObject> b = new ArrayList<>();
        bus.subscribe("P", a::add);
        bus.subscribe("P", b::add);
        bus.onCommitted(batch("P", 5));
        assertEquals(List.of(5L), seqs(a));
        assertEquals(List.of(5L), seqs(b));
        JsonObject body = a.get(0);
        assertEquals("b-5", body.get("batchId").getAsString());
        assertEquals("mapeditor", body.get("actor").getAsString());
        JsonObject op = body.getAsJsonArray("ops").get(0).getAsJsonObject();
        assertEquals("create", op.get("op").getAsString());
        assertEquals("item", op.get("entity").getAsString());
        assertEquals(1, op.get("version").getAsInt());
        assertEquals("line", op.getAsJsonObject("record").get("kind").getAsString());
        assertEquals(op.get("id").getAsString(), op.getAsJsonObject("record").get("id").getAsString());
    }

    @Test
    void aScriptSaveIsDeliveredLikeABrowserSave() {
        List<JsonObject> got = new ArrayList<>();
        bus.subscribe("mapstudio-dev", got::add);
        String id = "00000000-0000-5000-8000-000000000001";
        bus.onCommitted(new ChangeHook.CommittedBatch("mapstudio-dev", 3, "b", Actor.script("seed-script"),
            List.of(new ChangeHook.CommittedOp("create", "item", id, line(id)))));
        assertEquals(1, got.size());
        assertEquals("seed-script", got.get(0).get("actor").getAsString());
    }

    @Test
    void anotherProjectsMapsGetNothing() {
        List<JsonObject> p = new ArrayList<>();
        List<JsonObject> q = new ArrayList<>();
        bus.subscribe("P", p::add);
        bus.subscribe("Q", q::add);
        bus.onCommitted(batch("P", 1));
        assertEquals(1, p.size());
        assertTrue(q.isEmpty());
    }

    @Test
    void aClosedMapIsUnsubscribedAndGetsNoMore() {
        List<JsonObject> got = new ArrayList<>();
        ChangeBus.Subscription s = bus.subscribe("P", got::add);
        bus.onCommitted(batch("P", 1));
        s.cancel();
        s.cancel();
        bus.onCommitted(batch("P", 2));
        assertEquals(List.of(1L), seqs(got));
        assertEquals(0, bus.subscriberCount("P"));
    }

    @Test
    void aThrowingSubscriberDoesNotStopTheOthers() {
        List<JsonObject> before = new ArrayList<>();
        List<JsonObject> after = new ArrayList<>();
        bus.subscribe("P", before::add);
        bus.subscribe("P", body -> {
            throw new IllegalStateException("session gone");
        });
        bus.subscribe("P", after::add);
        bus.onCommitted(batch("P", 1));
        bus.onCommitted(batch("P", 2));
        assertEquals(List.of(1L, 2L), seqs(before));
        assertEquals(List.of(1L, 2L), seqs(after));
    }

    @Test
    void anOutOfOrderCommitIsHeldAndSentInOrder() {
        List<JsonObject> got = new ArrayList<>();
        bus.subscribe("P", got::add);
        bus.onCommitted(batch("P", 5));
        bus.onCommitted(batch("P", 7));
        assertEquals(List.of(5L), seqs(got), "7 is held for 6");
        now.addAndGet(500);
        bus.onCommitted(batch("P", 6));
        assertEquals(List.of(5L, 6L, 7L), seqs(got));
        runTimers();
        assertEquals(List.of(5L, 6L, 7L), seqs(got), "the stale timer sends nothing twice");
    }

    @Test
    void aSeqThatNeverArrivesIsSkippedAfterTheHold() {
        List<JsonObject> got = new ArrayList<>();
        bus.subscribe("P", got::add);
        bus.onCommitted(batch("P", 5));
        bus.onCommitted(batch("P", 7));
        bus.onCommitted(batch("P", 8));
        assertEquals(1, timers.size(), "one hold for the gap at 6");
        now.addAndGet(ChangeBus.HOLD_MILLIS - 1);
        runTimers();
        assertEquals(List.of(5L), seqs(got), "not before 2 s");
        assertEquals(1, timers.size(), "an early check re-arms for the rest of the hold");
        now.addAndGet(1);
        runTimers();
        assertEquals(List.of(5L, 7L, 8L), seqs(got), "6 skipped after 2 s; browsers reload on the gap");
        assertTrue(timers.isEmpty());
        bus.onCommitted(batch("P", 9));
        assertEquals(List.of(5L, 7L, 8L, 9L), seqs(got));
        // 6 arriving late still goes out: a browser ignores a seq it has.
        bus.onCommitted(batch("P", 6));
        assertEquals(List.of(5L, 7L, 8L, 9L, 6L), seqs(got));
    }

    @Test
    void theSaverNeverWaitsForDelivery() {
        List<Runnable> queued = new ArrayList<>();
        ChangeBus queuedBus = new ChangeBus(queued::add, (t, d) -> { }, now::get, () -> { });
        List<JsonObject> got = new ArrayList<>();
        queuedBus.subscribe("P", got::add);
        queuedBus.onCommitted(batch("P", 1));
        assertTrue(got.isEmpty(), "onCommitted only hands the event to the bus thread");
        queued.forEach(Runnable::run);
        assertEquals(1, got.size());
    }

    @Test
    void theFirstEventAfterStartSetsTheExpectedSeq() {
        List<JsonObject> got = new ArrayList<>();
        bus.subscribe("P", got::add);
        bus.onCommitted(batch("P", 41));
        bus.onCommitted(batch("P", 42));
        assertEquals(List.of(41L, 42L), seqs(got));
    }

    @Test
    void aStoppedBusDropsChangesQuietly() {
        ChangeBus stopped = new ChangeBus(r -> {
            throw new RejectedExecutionException("stopped");
        }, (t, d) -> { }, now::get, () -> { });
        stopped.subscribe("P", body -> { });
        stopped.onCommitted(batch("P", 1));
        bus.close();
        assertTrue(closed.get());
        assertFalse(bus.subscriberCount("P") > 0);
    }
}
