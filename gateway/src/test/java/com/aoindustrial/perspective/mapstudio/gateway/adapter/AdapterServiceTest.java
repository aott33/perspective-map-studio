package com.aoindustrial.perspective.mapstudio.gateway.adapter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonParser;

import com.aoindustrial.perspective.mapstudio.common.contract.AdapterStatus;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;

/**
 * The adapter service against a fake caller, a fake clock and a fake tick time:
 * each row of the plan's I/O matrix, one log line per status change, single
 * flight, and the last good list kept on a failing or slow refresh.
 */
class AdapterServiceTest {

    static final String P = "mapstudio-dev";
    static final String KINDS = "mapstudio_dev.kinds";
    static final String ASSETS = "mapstudio_dev.assets";
    static final String GOOD_KINDS = "[{\"id\":\"pad\",\"name\":\"Pad\",\"geometry\":\"point\"},"
        + "{\"id\":\"line\",\"name\":\"Line\",\"geometry\":\"line\"}]";
    static final String GOOD_ASSETS = "[{\"id\":\"P12\",\"name\":\"Pad 12\",\"kind\":\"pad\",\"basePath\":\"[default]Mesa/P12\"},"
        + "{\"id\":\"P14\",\"name\":\"Pad 14\",\"kind\":\"pad\",\"basePath\":\"[default]Mesa/P14\"}]";
    static final Duration TIMEOUT = Duration.ofMillis(300);

    /** A fake caller: per function, what the next calls give; counts calls; can hold a call open. */
    static final class FakeCaller implements AdapterCaller {
        final Map<String, Supplier<Outcome>> answers = new ConcurrentHashMap<>();
        final Map<String, AtomicInteger> calls = new ConcurrentHashMap<>();
        volatile CountDownLatch hold;

        void rows(String function, String json) {
            answers.put(function, () -> new Returned(JsonParser.parseString(json).getAsJsonArray()));
        }

        int calls(String function) {
            return calls.computeIfAbsent(function, f -> new AtomicInteger()).get();
        }

        @Override
        public Outcome call(String project, String function) {
            calls.computeIfAbsent(function, f -> new AtomicInteger()).incrementAndGet();
            CountDownLatch h = hold;
            if (h != null) {
                try {
                    h.await(10, TimeUnit.SECONDS);
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                }
            }
            return answers.getOrDefault(function, () -> new Failed("no answer set")).get();
        }
    }

    static final class Lines implements AdapterService.Log {
        final List<String> lines = Collections.synchronizedList(new ArrayList<>());
        /** Runs inside {@code warn}, on the thread that logs (which holds that list's monitor). */
        volatile java.util.function.Consumer<String> onWarn;

        @Override
        public void info(String line) {
            lines.add("INFO " + line);
        }

        @Override
        public void warn(String line) {
            lines.add("WARN " + line);
            var hook = onWarn;
            if (hook != null) {
                hook.accept(line);
            }
        }

        List<String> about(String what) {
            synchronized (lines) {
                return lines.stream().filter(l -> l.contains(what)).toList();
            }
        }
    }

    FakeCaller caller;
    Lines log;
    AtomicLong nanos;
    Map<String, Setup> setups;
    ExecutorService pool;
    ScheduledExecutorService ticker;
    AdapterService service;

    @BeforeEach
    void setUp() throws Exception {
        caller = new FakeCaller();
        caller.rows(KINDS, GOOD_KINDS);
        caller.rows(ASSETS, GOOD_ASSETS);
        log = new Lines();
        nanos = new AtomicLong(1_000_000_000L);
        setups = new ConcurrentHashMap<>();
        setups.put(P, setup(KINDS, ASSETS));
        pool = Executors.newFixedThreadPool(2);
        ticker = Executors.newSingleThreadScheduledExecutor();
        service = service(pool);
    }

    AdapterService service(ExecutorService pool) {
        return service(pool, TIMEOUT);
    }

    AdapterService service(ExecutorService pool, Duration timeout) {
        return new AdapterService(p -> Optional.ofNullable(setups.get(p)), () -> setups.keySet(), caller, pool,
            ticker, nanos::get, Clock.fixed(Instant.parse("2026-10-26T10:00:00Z"), ZoneOffset.UTC), timeout, log);
    }

    @AfterEach
    void tearDown() {
        CountDownLatch h = caller.hold;
        if (h != null) {
            h.countDown();
        }
        pool.shutdownNow();
        ticker.shutdownNow();
    }

    static Setup setup(String kinds, String assets) throws Setup.SetupException {
        return Setup.parse("{\"schemaVersion\":1,\"connection\":\"MapStudio\",\"kindsFunction\":\"" + kinds
            + "\",\"assetsFunction\":\"" + assets + "\",\"refreshIntervalSeconds\":10}");
    }

    AdapterSnapshot refresh() throws Exception {
        return service.refreshNow(P).get(5, TimeUnit.SECONDS);
    }

    @Test
    void goodListsAreOkWithTheirRowsAndOneInfoLineOnTheFirstOk() throws Exception {
        AdapterSnapshot s = refresh();
        assertEquals(AdapterStatus.OK, s.kindsStatus().status());
        assertEquals("2 kinds from mapstudio_dev.kinds.", s.kindsStatus().message());
        assertEquals(2, s.kindsStatus().count());
        assertEquals("2026-10-26T10:00:00Z", s.kindsStatus().refreshedAt());
        assertEquals(KINDS, s.kindsStatus().function());
        assertEquals(AdapterStatus.OK, s.assetsStatus().status());
        assertEquals(2, s.assets().size());
        assertEquals(List.of("INFO Project mapstudio-dev: 2 kinds from mapstudio_dev.kinds."), log.about("kind"));
        refresh();
        assertEquals(2, log.lines.size(), "a status that stays the same logs nothing");
    }

    @Test
    void anEmptyListIsEmptyWithOneWarning() throws Exception {
        caller.rows(ASSETS, "[]");
        AdapterSnapshot s = refresh();
        assertEquals(AdapterStatus.EMPTY, s.assetsStatus().status());
        assertEquals("The asset function mapstudio_dev.assets returned no assets.", s.assetsStatus().message());
        refresh();
        assertEquals(List.of("WARN Project mapstudio-dev: The asset function mapstudio_dev.assets returned no assets."),
            log.about("asset"));
    }

    @Test
    void aRaisingFunctionIsFailingWithTheFirstLineOfTheError() throws Exception {
        String longLine = "x".repeat(300);
        caller.answers.put(KINDS, () -> new AdapterCaller.Failed("RuntimeError: broken\nTraceback line 2"));
        caller.answers.put(ASSETS, () -> new AdapterCaller.Failed(longLine));
        AdapterSnapshot s = refresh();
        assertEquals(AdapterStatus.FAILING, s.kindsStatus().status());
        assertEquals("The kind function mapstudio_dev.kinds failed: RuntimeError: broken.", s.kindsStatus().message());
        assertTrue(s.assetsStatus().message().contains("x".repeat(200) + "..."));
        assertFalse(s.assetsStatus().message().contains("x".repeat(201)));
        assertEquals(1, log.about("kind function").size());
        assertTrue(log.about("kind function").get(0).startsWith("WARN "));
    }

    @Test
    void aFunctionThatThrowsInTheCallerIsFailingToo() throws Exception {
        caller.answers.put(KINDS, () -> {
            throw new IllegalStateException("caller blew up");
        });
        assertEquals(AdapterStatus.FAILING, refresh().kindsStatus().status());
    }

    @Test
    void aSlowFunctionIsSlowAfterTheTimeoutAndItsLateAnswerIsDropped() throws Exception {
        caller.hold = new CountDownLatch(1);
        long start = System.nanoTime();
        AdapterSnapshot s = refresh();
        assertTrue(System.nanoTime() - start >= TIMEOUT.toNanos(), "settled by the timeout");
        assertEquals(AdapterStatus.SLOW, s.kindsStatus().status());
        assertEquals("The kind function mapstudio_dev.kinds did not answer within 0.3 s.", s.kindsStatus().message());
        assertEquals(1, log.about("kind function").size());
        int logged = log.lines.size();
        caller.hold.countDown();
        // The late answers arrive; the status stays slow and nothing more is logged.
        Thread.sleep(200);
        assertEquals(AdapterStatus.SLOW, service.snapshot(P).kindsStatus().status());
        assertEquals(0, service.snapshot(P).kinds().size());
        assertEquals(logged, log.lines.size(), "a dropped late answer logs nothing");
    }

    @Test
    void aKindCallSettlingWhileAnAssetCallAnswersDoesNotDeadlock() throws Exception {
        // Review finding: the kind call's settle used to run the asset step under the
        // kind monitor while an answering asset call held the asset monitor and asked
        // for the kind ids. Here the kind call's warning (logged under the kind monitor)
        // lets the held asset call answer and gives it time to take its own monitor.
        service = service(pool, Duration.ofSeconds(5));
        CountDownLatch assetsHold = new CountDownLatch(1);
        caller.answers.put(ASSETS, () -> {
            try {
                assetsHold.await(10, TimeUnit.SECONDS);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
            }
            return new AdapterCaller.Returned(JsonParser.parseString(GOOD_ASSETS).getAsJsonArray());
        });
        var first = service.refreshNow(P);
        waitFor(() -> caller.calls(ASSETS) == 1);
        log.onWarn = line -> {
            if (line.contains("kind function")) {
                assetsHold.countDown();
                try {
                    Thread.sleep(300);
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                }
            }
        };
        caller.answers.put(KINDS, () -> new AdapterCaller.Failed("ValueError: down"));
        AdapterSnapshot s = service.refreshNow(P).get(5, TimeUnit.SECONDS);
        first.get(5, TimeUnit.SECONDS);
        assertEquals(AdapterStatus.FAILING, s.kindsStatus().status());
        assertEquals(AdapterStatus.OK, s.assetsStatus().status());
        assertEquals(2, s.assets().size(), "assets checked against the kept kind list");
        assertEquals(1, caller.calls(ASSETS), "the second refresh joined the asset call in flight");
        // The service still works afterwards.
        log.onWarn = null;
        caller.rows(KINDS, GOOD_KINDS);
        caller.rows(ASSETS, GOOD_ASSETS);
        assertEquals(AdapterStatus.OK, refresh().kindsStatus().status());
    }

    @Test
    void manyOverlappingRefreshesAllSettle() throws Exception {
        // Kind and asset calls overlapping in every order, with timeouts on the ticker.
        caller.answers.put(KINDS, () -> {
            sleepQuietly((long) (Math.random() * 2 * TIMEOUT.toMillis()));
            return new AdapterCaller.Returned(JsonParser.parseString(GOOD_KINDS).getAsJsonArray());
        });
        caller.answers.put(ASSETS, () -> {
            sleepQuietly((long) (Math.random() * 2 * TIMEOUT.toMillis()));
            return new AdapterCaller.Returned(JsonParser.parseString(GOOD_ASSETS).getAsJsonArray());
        });
        List<java.util.concurrent.CompletableFuture<AdapterSnapshot>> all = new ArrayList<>();
        for (int i = 0; i < 40; i++) {
            all.add(service.refreshNow(P));
            sleepQuietly((long) (Math.random() * 40));
        }
        for (var f : all) {
            f.get(10, TimeUnit.SECONDS);
        }
    }

    @Test
    void aViewerMessageHasNoHostErrorTextAndNoRowReasons() throws Exception {
        caller.answers.put(KINDS, () -> new AdapterCaller.Failed("OperationalError: host db7 user scada"));
        AdapterSnapshot s = refresh();
        assertEquals("The kind function mapstudio_dev.kinds failed: OperationalError: host db7 user scada.",
            s.kindsStatus().message());
        assertEquals("The kind function mapstudio_dev.kinds failed.",
            s.statusJson(false).getAsJsonObject("kinds").get("message").getAsString());
        assertEquals(s.kindsStatus().message(),
            s.statusJson(true).getAsJsonObject("kinds").get("message").getAsString());

        caller.rows(KINDS, GOOD_KINDS);
        caller.rows(ASSETS, "[{\"id\":\"P1\",\"name\":\"P1\",\"kind\":\"pad\",\"basePath\":\"[default]Mesa/P1\"},"
            + "{\"id\":\"P2\",\"kind\":\"pad\",\"basePath\":\"[default]Mesa/P2\"}]");
        s = refresh();
        assertEquals("1 of 2 assets from mapstudio_dev.assets left out.",
            s.statusJson(false).getAsJsonObject("assets").get("message").getAsString());
        assertTrue(s.assetsStatus().message().contains("row 2 (id P2): no name"));

        caller.answers.put(KINDS, () -> new AdapterCaller.Failed("ValueError: down"));
        s = refresh();
        assertEquals("The kind function mapstudio_dev.kinds failed. Showing the list from 10:00 UTC.",
            s.statusJson(false).getAsJsonObject("kinds").get("message").getAsString());
    }

    @Test
    void errorTextIsOneLineInTheLog() throws Exception {
        caller.answers.put(KINDS, () -> new AdapterCaller.Failed("ValueError: a\rWARN forged\u001b[0m\tend"));
        refresh();
        String line = log.about("kind function").get(0);
        assertFalse(line.contains("\r") || line.contains("\u001b") || line.contains("\t"), line);
        assertTrue(line.contains("a?WARN forged?[0m?end"), line);
    }

    @Test
    void badRowsAreIncompleteWithTheFirstThreeReasonsAndTheGoodRowsKept() throws Exception {
        caller.rows(ASSETS, "[{\"id\":\"P1\",\"name\":\"P1\",\"kind\":\"pad\",\"basePath\":\"[default]Mesa/P1\"},"
            + "{\"id\":\"P2\",\"kind\":\"pad\",\"basePath\":\"[default]Mesa/P2\"},"
            + "{\"id\":\"P3\",\"name\":\"P3\",\"kind\":\"tank\",\"basePath\":\"[default]Mesa/P3\"},"
            + "{\"id\":\"P4\",\"name\":\"P4\",\"kind\":\"pad\",\"basePath\":\"Mesa/P4\"},"
            + "{\"id\":\"P1\",\"name\":\"P1 again\",\"kind\":\"pad\",\"basePath\":\"[default]Mesa/P1\"}]");
        AdapterSnapshot s = refresh();
        assertEquals(AdapterStatus.INCOMPLETE, s.assetsStatus().status());
        assertEquals("4 of 5 assets from mapstudio_dev.assets left out: row 2 (id P2): no name; row 3 (id P3): kind"
            + " tank is not in the kind list; row 4 (id P4): basePath does not start with a [provider]; ...",
            s.assetsStatus().message().substring(0, s.assetsStatus().message().length() - 1));
        assertEquals(1, s.assetsStatus().count());
        assertEquals(4, s.assetsStatus().left());
        assertEquals("P1", s.assets().get(0).id());
        assertEquals(1, log.about("left out").size());
        assertTrue(log.about("left out").get(0).startsWith("WARN "));
        assertFalse(log.about("Mesa").size() > 0, "no tag path in a log line");
    }

    @Test
    void somethingOtherThanAListIsFailingNamingItsType() throws Exception {
        for (String type : List.of("dict", "str", "None", "Dataset")) {
            caller.answers.put(KINDS, () -> new AdapterCaller.NotAList(type));
            AdapterSnapshot s = refresh();
            assertEquals(AdapterStatus.FAILING, s.kindsStatus().status());
            assertEquals("The kind function mapstudio_dev.kinds returned a " + type + ", expected a list of dicts.",
                s.kindsStatus().message());
        }
        assertEquals(1, log.about("kind function").size(), "four failures in a row are one change");
    }

    @Test
    void noFunctionInTheSetupIsNotConfiguredWithOneInfoAndNoCall() throws Exception {
        setups.put(P, setup("", ASSETS));
        AdapterSnapshot s = refresh();
        assertEquals(AdapterStatus.NOT_CONFIGURED, s.kindsStatus().status());
        assertEquals("The setup names no kind function.", s.kindsStatus().message());
        assertEquals(0, caller.calls(KINDS));
        refresh();
        assertEquals(List.of("INFO Project mapstudio-dev: The setup names no kind function."), log.about("kind function"));
        // With no kind list every asset's kind is unknown.
        assertEquals(AdapterStatus.INCOMPLETE, s.assetsStatus().status());
    }

    @Test
    void beforeTheFirstAnswerBothListsAreLoading() throws Exception {
        AdapterSnapshot s = service.snapshot(P);
        assertEquals(AdapterStatus.LOADING, s.kindsStatus().status());
        assertEquals("Loading the kind list from mapstudio_dev.kinds.", s.kindsStatus().message());
        assertEquals(AdapterStatus.LOADING, s.assetsStatus().status());
        assertNull(s.kindsStatus().refreshedAt());
        caller.hold = new CountDownLatch(1);
        service.tick();
        assertEquals(AdapterStatus.LOADING, service.snapshot(P).kindsStatus().status());
        assertTrue(log.lines.isEmpty(), "loading logs nothing");
    }

    @Test
    void aRecoveredListIsOkWithOneRecoveredInfoLine() throws Exception {
        refresh();
        caller.answers.put(KINDS, () -> new AdapterCaller.Failed("ValueError: down"));
        refresh();
        caller.rows(KINDS, GOOD_KINDS);
        AdapterSnapshot s = refresh();
        assertEquals(AdapterStatus.OK, s.kindsStatus().status());
        assertEquals(List.of(
            "INFO Project mapstudio-dev: 2 kinds from mapstudio_dev.kinds.",
            "WARN Project mapstudio-dev: The kind function mapstudio_dev.kinds failed: ValueError: down. Showing the"
                + " list from 10:00 UTC.",
            "INFO Project mapstudio-dev: the kind function mapstudio_dev.kinds recovered: 2 kinds from"
                + " mapstudio_dev.kinds."), log.about("kind"));
    }

    @Test
    void aFailingOrSlowRefreshKeepsTheLastGoodListAndSaysSo() throws Exception {
        refresh();
        caller.answers.put(KINDS, () -> new AdapterCaller.Failed("ValueError: down"));
        AdapterSnapshot s = refresh();
        assertEquals(AdapterStatus.FAILING, s.kindsStatus().status());
        assertEquals(2, s.kinds().size());
        assertEquals(2, s.kindsStatus().count());
        assertEquals("2026-10-26T10:00:00Z", s.kindsStatus().refreshedAt());
        assertTrue(s.kindsStatus().message().endsWith("Showing the list from 10:00 UTC."));
        // Assets are still checked against the kept kinds.
        assertEquals(AdapterStatus.OK, s.assetsStatus().status());

        caller.rows(KINDS, GOOD_KINDS);
        caller.hold = new CountDownLatch(1);
        s = refresh();
        assertEquals(AdapterStatus.SLOW, s.kindsStatus().status());
        assertEquals(2, s.kinds().size());
        assertTrue(s.kindsStatus().message().endsWith("Showing the list from 10:00 UTC."));
    }

    @Test
    void anEmptyAnswerReplacesTheList() throws Exception {
        refresh();
        caller.rows(ASSETS, "[]");
        assertEquals(0, refresh().assets().size());
    }

    @Test
    void theTickRefreshesOnTheIntervalAndSkipsACallStillRunning() throws Exception {
        service.tick();
        waitFor(() -> service.snapshot(P).assetsStatus().status().equals(AdapterStatus.OK));
        assertEquals(1, caller.calls(KINDS));
        nanos.addAndGet(TimeUnit.SECONDS.toNanos(5));
        service.tick();
        assertEquals(1, caller.calls(KINDS), "not before the interval");
        nanos.addAndGet(TimeUnit.SECONDS.toNanos(5));
        caller.hold = new CountDownLatch(1);
        service.tick();
        waitFor(() -> caller.calls(KINDS) == 2);
        // Past the timeout the call still runs: the next ticks skip it.
        waitFor(() -> service.snapshot(P).kindsStatus().status().equals(AdapterStatus.SLOW));
        nanos.addAndGet(TimeUnit.SECONDS.toNanos(10));
        service.tick();
        nanos.addAndGet(TimeUnit.SECONDS.toNanos(10));
        service.tick();
        Thread.sleep(100);
        assertEquals(2, caller.calls(KINDS), "a call still running is never queued twice");
    }

    @Test
    void twoRefreshesWhileACallIsInFlightRunTheFunctionOnce() throws Exception {
        caller.hold = new CountDownLatch(1);
        var first = service.refreshNow(P);
        var second = service.refreshNow(P);
        first.get(5, TimeUnit.SECONDS);
        second.get(5, TimeUnit.SECONDS);
        assertEquals(1, caller.calls(KINDS));
    }

    @Test
    void aRefreshAskedWhileATimedOutCallRunsStartsOneCallWhenItEnds() throws Exception {
        caller.hold = new CountDownLatch(1);
        refresh(); // both time out; both calls still run
        var a = service.refreshNow(P);
        var b = service.refreshNow(P);
        Thread.sleep(100);
        assertEquals(1, caller.calls(KINDS));
        caller.hold.countDown();
        caller.hold = null;
        a.get(5, TimeUnit.SECONDS);
        b.get(5, TimeUnit.SECONDS);
        assertEquals(2, caller.calls(KINDS), "one waiting refresh, not two");
        assertEquals(AdapterStatus.OK, service.snapshot(P).kindsStatus().status());
        assertEquals(AdapterStatus.OK, service.snapshot(P).assetsStatus().status());
    }

    @Test
    void aFullPoolIsSlowWithABusyMessage() throws Exception {
        ExecutorService one = new ThreadPoolExecutor(1, 1, 0L, TimeUnit.MILLISECONDS, new SynchronousQueue<>());
        try {
            service = service(one);
            setups.put("other", setup(KINDS, ASSETS));
            caller.hold = new CountDownLatch(1);
            service.refreshNow("other");
            AdapterSnapshot s = service.refreshNow(P).get(5, TimeUnit.SECONDS);
            assertEquals(AdapterStatus.SLOW, s.kindsStatus().status());
            assertTrue(s.kindsStatus().message().startsWith("Map Studio is busy calling other project functions"));
        } finally {
            caller.hold.countDown();
            one.shutdownNow();
        }
    }

    @Test
    void aProjectWithoutASetupIsForgottenAtTheNextTick() throws Exception {
        refresh();
        setups.remove(P);
        service.tick();
        assertEquals(AdapterStatus.LOADING, service.snapshot(P).kindsStatus().status());
        assertEquals(0, service.snapshot(P).kinds().size());
    }

    @Test
    void firstLineCutsAtTheNewlineAnd200Characters() {
        assertEquals("a", AdapterService.firstLine(" a \n b"));
        assertEquals("y".repeat(200) + "...", AdapterService.firstLine("y".repeat(250)));
        assertEquals("", AdapterService.firstLine(null));
    }

    static void sleepQuietly(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        }
    }

    static void waitFor(Supplier<Boolean> condition) throws InterruptedException {
        long end = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (!condition.get()) {
            if (System.nanoTime() > end) {
                throw new AssertionError("condition not met within 5 s");
            }
            Thread.sleep(10);
        }
    }
}
