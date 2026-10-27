package com.aoindustrial.perspective.mapstudio.gateway.adapter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.aoindustrial.perspective.mapstudio.common.contract.AdapterStatus;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;

/**
 * The kind list's icon check (story 2.10, the plan's I/O matrix): a known icon
 * is ok, an unknown one keeps the kind and names the kind and the icon in the
 * status with one Gateway log line, a missing one means {@code point} with no
 * warning; the viewer message has no names.
 */
class AdapterIconCheckTest {

    static final String P = AdapterServiceTest.P;
    static final String KINDS = AdapterServiceTest.KINDS;
    static final String ASSETS = AdapterServiceTest.ASSETS;
    static final String UNKNOWN_NOTE = "Kind pad names icon wel-pad, which Map Studio does not have; it shows as a plain point.";

    AdapterServiceTest.FakeCaller caller;
    AdapterServiceTest.Lines log;
    ExecutorService pool;
    ScheduledExecutorService ticker;
    AdapterService service;

    @BeforeEach
    void setUp() throws Exception {
        caller = new AdapterServiceTest.FakeCaller();
        caller.rows(ASSETS, AdapterServiceTest.GOOD_ASSETS);
        log = new AdapterServiceTest.Lines();
        pool = Executors.newFixedThreadPool(2);
        ticker = Executors.newSingleThreadScheduledExecutor();
        Setup setup = AdapterServiceTest.setup(KINDS, ASSETS);
        AtomicLong nanos = new AtomicLong(1_000_000_000L);
        service = new AdapterService(p -> P.equals(p) ? Optional.of(setup) : Optional.empty(), () -> java.util.Set.of(P),
            caller, pool, ticker, nanos::get, Clock.fixed(Instant.parse("2026-10-26T10:00:00Z"), ZoneOffset.UTC),
            AdapterServiceTest.TIMEOUT, log);
    }

    @AfterEach
    void tearDown() {
        pool.shutdownNow();
        ticker.shutdownNow();
    }

    void kinds(String padIcon) {
        caller.rows(KINDS, "[{\"id\":\"pad\",\"name\":\"Pad\",\"geometry\":\"point\""
            + (padIcon == null ? "" : ",\"icon\":\"" + padIcon + "\"") + "},"
            + "{\"id\":\"line\",\"name\":\"Line\",\"geometry\":\"line\",\"icon\":\"pipeline\"}]");
    }

    /** The log lines about the kind list (every line not about assets). */
    List<String> kindLines() {
        synchronized (log.lines) {
            return log.lines.stream().filter(l -> !l.contains("asset")).toList();
        }
    }

    AdapterSnapshot refresh() throws Exception {
        return service.refreshNow(P).get(5, TimeUnit.SECONDS);
    }

    @Test
    void aKnownIconIsOkWithNoNote() throws Exception {
        kinds("well-pad");
        AdapterSnapshot s = refresh();
        assertEquals(AdapterStatus.OK, s.kindsStatus().status());
        assertEquals("2 kinds from mapstudio_dev.kinds.", s.kindsStatus().message());
        assertEquals(List.of("INFO Project mapstudio-dev: 2 kinds from mapstudio_dev.kinds."), kindLines());
    }

    @Test
    void anUnknownIconKeepsTheKindAndNamesItInTheStatusWithOneLogLine() throws Exception {
        kinds("wel-pad");
        AdapterSnapshot s = refresh();
        assertEquals(AdapterStatus.OK, s.kindsStatus().status());
        assertEquals(2, s.kinds().size(), "the kind is still listed");
        assertEquals("wel-pad", s.kinds().get(0).icon(), "the kind keeps the name it gave");
        assertEquals("2 kinds from mapstudio_dev.kinds. " + UNKNOWN_NOTE, s.kindsStatus().message());
        assertEquals("2 kinds from mapstudio_dev.kinds. " + UNKNOWN_NOTE,
            s.statusJson(true).getAsJsonObject("kinds").get("message").getAsString());
        assertEquals("2 kinds from mapstudio_dev.kinds. 1 kind names an icon Map Studio does not have and shows as a"
            + " plain point.", s.statusJson(false).getAsJsonObject("kinds").get("message").getAsString());
        assertEquals(List.of("WARN Project mapstudio-dev: 2 kinds from mapstudio_dev.kinds. Kind pad names an icon"
            + " Map Studio does not have."), kindLines());
        assertFalse(String.join("\n", log.lines).contains("wel-pad"), "the log names kind ids only");
        refresh();
        assertEquals(1, kindLines().size(), "the same unknown icon logs nothing more");
    }

    @Test
    void aMissingIconMeansPointWithNoWarning() throws Exception {
        kinds(null);
        AdapterSnapshot s = refresh();
        assertEquals(AdapterStatus.OK, s.kindsStatus().status());
        assertEquals("2 kinds from mapstudio_dev.kinds.", s.kindsStatus().message());
        assertEquals("", s.kinds().get(0).icon());
        assertEquals(List.of(), log.about("WARN"));
    }

    @Test
    void anUnknownIconAppearingAndClearingWhileOkLogsOneLineEach() throws Exception {
        kinds("well-pad");
        refresh();
        kinds("wel-pad");
        refresh();
        kinds("well-pad");
        AdapterSnapshot s = refresh();
        assertEquals("2 kinds from mapstudio_dev.kinds.", s.kindsStatus().message());
        assertEquals(List.of(
            "INFO Project mapstudio-dev: 2 kinds from mapstudio_dev.kinds.",
            "WARN Project mapstudio-dev: Kind pad names an icon Map Studio does not have.",
            "INFO Project mapstudio-dev: every kind from mapstudio_dev.kinds names an icon Map Studio has."),
            kindLines());
    }

    @Test
    void anUnknownIconBesideBadRowsIsInTheIncompleteMessage() throws Exception {
        caller.rows(KINDS, "[{\"id\":\"pad\",\"name\":\"Pad\",\"geometry\":\"point\",\"icon\":\"wel-pad\"},"
            + "{\"id\":\"tank\",\"name\":\"Tank\",\"geometry\":\"polygon\"}]");
        AdapterSnapshot s = refresh();
        assertEquals(AdapterStatus.INCOMPLETE, s.kindsStatus().status());
        assertEquals("1 of 2 kinds from mapstudio_dev.kinds left out: row 2 (id tank): geometry must be point or line. "
            + UNKNOWN_NOTE, s.kindsStatus().message());
        assertEquals("1 of 2 kinds from mapstudio_dev.kinds left out. 1 kind names an icon Map Studio does not have"
            + " and shows as a plain point.", s.statusJson(false).getAsJsonObject("kinds").get("message").getAsString());
        assertEquals(1, log.about("Kind pad names an icon").size());
    }
}
