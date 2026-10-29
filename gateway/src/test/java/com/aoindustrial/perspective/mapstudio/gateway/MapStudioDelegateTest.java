package com.aoindustrial.perspective.mapstudio.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;
import com.inductiveautomation.ignition.common.util.ExecutionQueue;
import com.inductiveautomation.ignition.common.util.LoggerEx;
import com.inductiveautomation.perspective.gateway.api.Component;
import com.inductiveautomation.perspective.gateway.api.Session;
import org.junit.jupiter.api.Test;

import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.NoAdapters;
import com.aoindustrial.perspective.mapstudio.gateway.change.ChangeBus;
import com.aoindustrial.perspective.mapstudio.gateway.setup.SetupRegistry;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreGate;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreState;
import com.aoindustrial.perspective.mapstudio.gateway.tags.TagLookups;
import com.aoindustrial.perspective.mapstudio.gateway.write.Actor;
import com.aoindustrial.perspective.mapstudio.gateway.write.ChangeHook;
import com.aoindustrial.perspective.mapstudio.gateway.write.FakeMapStore;

/** The I/O matrix of story 1's plan, one test per row. */
class MapStudioDelegateTest {

    private static JsonObject envelope(Integer v, String type, String id, JsonObject body) {
        JsonObject message = new JsonObject();
        if (v != null) {
            message.addProperty("v", v);
        }
        if (type != null) {
            message.addProperty("type", type);
        }
        if (id != null) {
            message.addProperty("id", id);
        }
        message.add("body", body == null ? new JsonObject() : body);
        return message;
    }

    @Test
    void pointClickRepliesWithTheSameIdAndThePoint() {
        JsonObject body = new JsonObject();
        body.addProperty("pointId", "p1");
        JsonObject reply = MapStudioDelegate.reply(envelope(1, "point.click", "abc", body));
        assertEquals(1, reply.get("v").getAsInt());
        assertEquals("point.click.reply", reply.get("type").getAsString());
        assertEquals("abc", reply.get("id").getAsString());
        assertEquals("p1", reply.getAsJsonObject("body").get("pointId").getAsString());
        assertEquals(true, reply.getAsJsonObject("body").get("receivedAt").getAsString().endsWith("Z"));
    }

    @Test
    void unknownTypeGetsAnInvalidError() {
        JsonObject reply = MapStudioDelegate.reply(envelope(1, "nope", "x", null));
        assertEquals("error", reply.get("type").getAsString());
        assertEquals("x", reply.get("id").getAsString());
        assertEquals("invalid", reply.getAsJsonObject("body").get("code").getAsString());
        assertEquals("Unknown message type: nope", reply.getAsJsonObject("body").get("message").getAsString());
    }

    @Test
    void missingIdOrTypeGetsAnInvalidError() {
        JsonObject noId = MapStudioDelegate.reply(envelope(1, "point.click", null, null));
        assertEquals("error", noId.get("type").getAsString());
        assertEquals("invalid", noId.getAsJsonObject("body").get("code").getAsString());
        JsonObject noType = MapStudioDelegate.reply(envelope(1, null, "y", null));
        assertEquals("error", noType.get("type").getAsString());
        assertEquals("y", noType.get("id").getAsString());
        assertEquals("invalid", noType.getAsJsonObject("body").get("code").getAsString());
    }

    @Test
    void wrongOrFractionalVersionGetsAnInvalidError() {
        JsonObject body = new JsonObject();
        body.addProperty("pointId", "p1");
        assertEquals("error", MapStudioDelegate.reply(envelope(2, "point.click", "a", body)).get("type").getAsString());
        JsonObject fractional = envelope(null, "point.click", "b", body);
        fractional.addProperty("v", 1.5);
        assertEquals("error", MapStudioDelegate.reply(fractional).get("type").getAsString());
    }

    @Test
    void pointClickWithoutAPointIdGetsAnInvalidError() {
        JsonObject reply = MapStudioDelegate.reply(envelope(1, "point.click", "c", null));
        assertEquals("error", reply.get("type").getAsString());
        assertEquals("invalid", reply.getAsJsonObject("body").get("code").getAsString());
    }

    @Test
    void nullMessageGetsAnInvalidError() {
        JsonObject reply = MapStudioDelegate.reply(null);
        assertEquals("error", reply.get("type").getAsString());
        assertEquals("invalid", reply.getAsJsonObject("body").get("code").getAsString());
    }

    @Test
    void mapLoadAndEditsApplyPassTheEnvelopeCheck() {
        // Epic 2 story 1: both go to the store work pool; the envelope check lets them through.
        assertEquals(null, MapStudioDelegate.check(envelope(1, "map.load", "m", null)));
        assertEquals(null, MapStudioDelegate.check(envelope(1, "edits.apply", "e", null)));
        assertEquals("invalid", MapStudioDelegate.check(envelope(1, "map.changed", "c", null))
            .getAsJsonObject("body").get("code").getAsString(), "map.changed is sent, never received");
    }

    @Test
    void thePopupMessagesPassTheEnvelopeCheckAndNeedAnItemId() {
        // Epic 3 entry 5: popup.open and popup.close are handled on the event thread; values.batch is sent, never received.
        assertEquals(null, MapStudioDelegate.check(envelope(1, "popup.open", "o", null)));
        assertEquals(null, MapStudioDelegate.check(envelope(1, "popup.close", "c", null)));
        assertTrue(MapStudioDelegate.isPopupType("popup.open"));
        assertTrue(MapStudioDelegate.isPopupType("popup.close"));
        assertEquals(false, MapStudioDelegate.isPopupType("map.load"));
        assertEquals("invalid", MapStudioDelegate.check(envelope(1, "values.batch", "v", null))
            .getAsJsonObject("body").get("code").getAsString());
        // Without services (tests) a popup.open with no itemId is still refused invalid, and one with it is quiet.
        FakeMap map = new FakeMap("P");
        MapStudioDelegate delegate = new MapStudioDelegate(map.component, null, directBus(), new SetupRegistry(s -> { }));
        delegate.handleEvent(new com.inductiveautomation.perspective.gateway.messages.EventFiredMsg(
            "view", "root/map", "model", "mapstudio.message", envelope(1, "popup.open", "o1", null)));
        assertEquals(1, map.fired.size());
        assertEquals("error", map.fired.get(0).get("type").getAsString());
        assertEquals("o1", map.fired.get(0).get("id").getAsString());
        assertEquals("popup.open needs an itemId.", map.fired.get(0).getAsJsonObject("body").get("message").getAsString());
        JsonObject body = new JsonObject();
        body.addProperty("itemId", "11111111-1111-4111-8111-111111111111");
        delegate.handleEvent(new com.inductiveautomation.perspective.gateway.messages.EventFiredMsg(
            "view", "root/map", "model", "mapstudio.message", envelope(1, "popup.close", "c1", body)));
        assertEquals(1, map.fired.size(), "nothing is answered on success");
        // Epic 3 entry 2: popup.open may name the line segment it opened at; a malformed one is refused.
        JsonObject segment = new JsonObject();
        segment.addProperty("fromId", "22222222-2222-4222-8222-222222222222");
        segment.addProperty("toId", "33333333-3333-4333-8333-333333333333");
        body.add("segment", segment);
        delegate.handleEvent(new com.inductiveautomation.perspective.gateway.messages.EventFiredMsg(
            "view", "root/map", "model", "mapstudio.message", envelope(1, "popup.open", "o2", body)));
        assertEquals(1, map.fired.size(), "a well-formed segment is quiet");
        JsonObject bad = new JsonObject();
        bad.addProperty("fromId", "x");
        body.add("segment", bad);
        delegate.handleEvent(new com.inductiveautomation.perspective.gateway.messages.EventFiredMsg(
            "view", "root/map", "model", "mapstudio.message", envelope(1, "popup.open", "o3", body)));
        assertEquals(2, map.fired.size());
        assertEquals("popup.open's segment needs fromId and toId.", map.fired.get(1).getAsJsonObject("body").get("message").getAsString());
    }

    @Test
    void theTagLookupsPassTheEnvelopeCheckAndGoToTheWorkPool() {
        // Epic 2 story 15: tags.browse and tags.resolve run on the work pool like the store messages.
        assertEquals(null, MapStudioDelegate.check(envelope(1, "tags.browse", "b", null)));
        assertEquals(null, MapStudioDelegate.check(envelope(1, "tags.resolve", "r", null)));
        assertTrue(MapStudioDelegate.isTagType("tags.browse"));
        assertTrue(MapStudioDelegate.isTagType("tags.resolve"));
        assertEquals(false, MapStudioDelegate.isTagType("map.load"));
        assertEquals("invalid", MapStudioDelegate.check(envelope(1, "tags.browse.reply", "c", null))
            .getAsJsonObject("body").get("code").getAsString(), "a reply is sent, never received");
    }

    /** Tag lookups over a tag system that fails on any browse, for project {@code TagsReplyTest.P}. */
    private static TagLookups brokenTags() throws Exception {
        SetupRegistry setups = new SetupRegistry(s -> { });
        setups.put(TagsReplyTest.P,
            Setup.parse("{\"schemaVersion\":1,\"connection\":\"MapStudio\",\"roles\":{\"full\":[\"MapEditor\"]}}"));
        return new TagLookups(setups, new StoreGate(setups, c -> StoreState.ready()), new FakeMapStore(),
            NoAdapters::snapshot, new TagsReplyTest.Broken());
    }

    @Test
    void aTagMessageIsRoutedToTheTagLookupsAndAStoreMessageToTheStore() throws Exception {
        MapStudioDelegate.SessionView view = new MapStudioDelegate.SessionView(TagsReplyTest.P, "u", List.of("MapEditor"));
        TagLookups tags = brokenTags();
        JsonObject browse = MapStudioDelegate.job(null, null, tags, null, null, view, "tags.browse", "b1", new JsonObject()).get();
        assertEquals("b1", browse.get("id").getAsString());
        assertEquals("tags-unavailable", browse.getAsJsonObject("body").get("code").getAsString(), "the tag system was asked");
        JsonObject resolve = MapStudioDelegate.job(null, null, tags, null, null, view, "tags.resolve", "r1", new JsonObject()).get();
        assertEquals("invalid", resolve.getAsJsonObject("body").get("code").getAsString());
        // No loader: a map.load goes to the store side, whose failure is store-unreachable.
        JsonObject load = MapStudioDelegate.job(null, null, tags, null, null, view, "map.load", "m1", new JsonObject()).get();
        assertEquals("store-unreachable", load.getAsJsonObject("body").get("code").getAsString());
    }

    @Test
    void aTagLookupOnAFullWorkPoolIsAnsweredBusyAtOnce() throws Exception {
        ThreadPoolExecutor pool = MapStudioServices.newWorkPool(1, 1, Thread::new);
        CountDownLatch release = new CountDownLatch(1);
        CountDownLatch started = new CountDownLatch(1);
        List<JsonObject> sent = new CopyOnWriteArrayList<>();
        try {
            pool.execute(() -> {
                started.countDown();
                try {
                    release.await();
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                }
            });
            assertTrue(started.await(5, TimeUnit.SECONDS));
            pool.execute(() -> { });
            AtomicBoolean ran = new AtomicBoolean();
            MapStudioDelegate.submitWork(pool, "tags.browse", "b2", () -> {
                ran.set(true);
                return new JsonObject();
            }, sent::add);
            assertEquals(1, sent.size());
            assertEquals("b2", sent.get(0).get("id").getAsString());
            assertEquals("store-unreachable", sent.get(0).getAsJsonObject("body").get("code").getAsString());
            assertTrue(sent.get(0).getAsJsonObject("body").get("message").getAsString().contains("busy"));
            assertEquals(false, ran.get());
        } finally {
            release.countDown();
            pool.shutdownNow();
        }
        ThreadPoolExecutor free = MapStudioServices.newWorkPool(1, 1, Thread::new);
        try {
            CountDownLatch replied = new CountDownLatch(1);
            MapStudioDelegate.submitWork(free, "tags.resolve", "r2", () -> MapStudioDelegate.busyReply("never"), r -> {
                sent.add(r);
                replied.countDown();
            });
            assertTrue(replied.await(5, TimeUnit.SECONDS), "a free pool runs the job and sends its reply");
            assertEquals("never", sent.get(1).get("id").getAsString());
        } finally {
            free.shutdownNow();
        }
    }

    @Test
    void mapChangedIsSentInTheEnvelopeWithItsOwnId() {
        // Epic 2 story 4: the change bus's body goes out unchanged under a new message id.
        JsonObject body = new JsonObject();
        body.addProperty("seq", 5);
        JsonObject a = MapStudioDelegate.changedEnvelope(body);
        JsonObject b = MapStudioDelegate.changedEnvelope(body);
        assertEquals(1, a.get("v").getAsInt());
        assertEquals("map.changed", a.get("type").getAsString());
        assertEquals(5, a.getAsJsonObject("body").get("seq").getAsInt());
        assertEquals(36, a.get("id").getAsString().length());
        assertEquals(false, a.get("id").getAsString().equals(b.get("id").getAsString()));
    }

    /** A fake open map: a component of project {@code project} whose session queue runs tasks at once. */
    private static final class FakeMap {
        final AtomicBoolean running = new AtomicBoolean(true);
        final AtomicBoolean queueRefuses = new AtomicBoolean();
        final List<JsonObject> fired = new ArrayList<>();
        final Component component;

        FakeMap(String project) {
            ExecutionQueue queue = new ExecutionQueue(task -> {
                if (queueRefuses.get()) {
                    throw new IllegalStateException("session closed");
                }
                task.run();
            });
            Session session = (Session) Proxy.newProxyInstance(Session.class.getClassLoader(),
                new Class<?>[] {Session.class}, (proxy, method, args) -> switch (method.getName()) {
                    case "getProjectName" -> project;
                    case "queue" -> queue;
                    case "isRunning" -> true;
                    default -> null;
                });
            this.component = (Component) Proxy.newProxyInstance(Component.class.getClassLoader(),
                new Class<?>[] {Component.class}, (proxy, method, args) -> switch (method.getName()) {
                    case "getSession" -> session;
                    case "getLogger" -> LoggerEx.newBuilder().build("MapStudio.test");
                    case "getComponentAddressPath" -> "root/map";
                    case "isRunning" -> running.get();
                    case "fireEvent" -> {
                        fired.add((JsonObject) args[2]);
                        yield null;
                    }
                    default -> null;
                });
        }
    }

    private static ChangeHook.CommittedBatch batch(String project, long seq) {
        String id = "00000000-0000-4000-8000-" + String.format("%012d", seq);
        JsonObject data = JsonParser.parseString("{\"kind\":\"line\",\"name\":\"L\",\"geometry\":{\"type\":"
            + "\"LineString\",\"coordinates\":[[-104.99,39.74],[-104.98,39.75]]}}").getAsJsonObject();
        return new ChangeHook.CommittedBatch(project, seq, "b-" + seq, Actor.session("mapeditor"),
            List.of(new ChangeHook.CommittedOp("create", "item", id, MapItemRecord.fromCreate(id, data, 0))));
    }

    private static ChangeBus directBus() {
        return new ChangeBus(Runnable::run, (task, delay) -> { }, () -> 0L, () -> { });
    }

    @Test
    void anOpenMapSubscribesWithItsProjectAndLeavesAtShutdown() {
        // Matrix row "Map closed": delegate shut down, unsubscribed, no further delivery.
        ChangeBus bus = directBus();
        FakeMap map = new FakeMap("P");
        MapStudioDelegate delegate = new MapStudioDelegate(map.component, null, bus, new SetupRegistry(s -> { }));
        delegate.startup();
        assertEquals(1, bus.subscriberCount("P"));
        assertEquals(0, bus.subscriberCount("Q"));
        bus.onCommitted(batch("P", 5));
        assertEquals(1, map.fired.size());
        assertEquals("map.changed", map.fired.get(0).get("type").getAsString());
        assertEquals(5, map.fired.get(0).getAsJsonObject("body").get("seq").getAsInt());
        delegate.shutdown();
        assertEquals(0, bus.subscriberCount("P"));
        bus.onCommitted(batch("P", 6));
        assertEquals(1, map.fired.size());
    }

    @Test
    void aMapThatStoppedRunningLeavesTheBusAtTheNextChange() {
        // A missed onShutdown must not keep the delegate (and its session) on the bus.
        ChangeBus bus = directBus();
        FakeMap map = new FakeMap("P");
        new MapStudioDelegate(map.component, null, bus, new SetupRegistry(s -> { })).startup();
        map.running.set(false);
        bus.onCommitted(batch("P", 5));
        assertEquals(0, map.fired.size());
        assertEquals(0, bus.subscriberCount("P"));
    }

    @Test
    void aMapWhoseQueueRefusesTheSendLeavesTheBus() {
        ChangeBus bus = directBus();
        FakeMap map = new FakeMap("P");
        new MapStudioDelegate(map.component, null, bus, new SetupRegistry(s -> { })).startup();
        map.queueRefuses.set(true);
        bus.onCommitted(batch("P", 5));
        assertEquals(0, bus.subscriberCount("P"));
    }

    @Test
    void aNoneLevelMapGetsTheChangeWithoutTheActor() {
        // The fake session has no user and the project no setup: level none.
        ChangeBus bus = directBus();
        FakeMap map = new FakeMap("P");
        new MapStudioDelegate(map.component, null, bus, new SetupRegistry(s -> { })).startup();
        bus.onCommitted(batch("P", 5));
        assertEquals("", map.fired.get(0).getAsJsonObject("body").get("actor").getAsString());
    }

    @Test
    void theActorIsKeptForPhoneAndFullAndTheSharedBodyIsNeverChanged() {
        JsonObject body = new JsonObject();
        body.addProperty("seq", 5);
        body.addProperty("actor", "mapeditor");
        assertEquals("mapeditor", MapStudioDelegate.bodyFor(body, "full").get("actor").getAsString());
        assertEquals("mapeditor", MapStudioDelegate.bodyFor(body, "phone").get("actor").getAsString());
        JsonObject none = MapStudioDelegate.bodyFor(body, "none");
        assertEquals("", none.get("actor").getAsString());
        assertEquals(5, none.get("seq").getAsInt());
        assertEquals("mapeditor", body.get("actor").getAsString());
    }

    @Test
    void aViewerGetsKindSetupRecordsWithoutTheirTagPaths() {
        JsonObject body = com.inductiveautomation.ignition.common.gson.JsonParser.parseString("{\"seq\":6,"
            + "\"actor\":\"mapeditor\",\"ops\":[{\"op\":\"create\",\"entity\":\"kindSetup\",\"id\":\"pad\","
            + "\"version\":1,\"record\":{\"kindId\":\"pad\",\"setup\":{\"comms\":{\"path\":\"{asset.path}/C\"}},"
            + "\"version\":1,\"deleted\":false}}]}").getAsJsonObject();
        JsonObject none = MapStudioDelegate.bodyFor(body, "none");
        assertEquals("{\"kindId\":\"pad\",\"version\":1,\"deleted\":false}",
            none.getAsJsonArray("ops").get(0).getAsJsonObject().get("record").toString());
        assertEquals(true, body.getAsJsonArray("ops").get(0).getAsJsonObject().getAsJsonObject("record").has("setup"));
        assertEquals(body, MapStudioDelegate.bodyFor(body, "full"));
    }

    @Test
    void aViewerGetsMapItemRecordsWithoutTheirOverrides() {
        JsonObject body = com.inductiveautomation.ignition.common.gson.JsonParser.parseString("{\"seq\":7,"
            + "\"actor\":\"mapeditor\",\"ops\":[{\"op\":\"update\",\"entity\":\"item\",\"id\":\"4f6c\","
            + "\"version\":2,\"record\":{\"id\":\"4f6c\",\"kind\":\"pad\",\"name\":\"P12\",\"overrides\":"
            + "{\"kpis\":[{\"key\":\"p\",\"path\":\"[default]Mesa/P12/Pressure\"}]},\"version\":2,"
            + "\"deleted\":false}}]}").getAsJsonObject();
        JsonObject record = MapStudioDelegate.bodyFor(body, "none").getAsJsonArray("ops").get(0).getAsJsonObject()
            .getAsJsonObject("record");
        assertEquals("{}", record.get("overrides").toString());
        assertEquals("P12", record.get("name").getAsString());
        assertEquals(true, body.getAsJsonArray("ops").get(0).getAsJsonObject().getAsJsonObject("record")
            .getAsJsonObject("overrides").has("kpis"), "the shared body is never changed");
        assertEquals(body, MapStudioDelegate.bodyFor(body, "phone"));
    }
}
