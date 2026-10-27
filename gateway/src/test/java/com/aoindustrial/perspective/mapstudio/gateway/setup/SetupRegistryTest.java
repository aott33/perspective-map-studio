package com.aoindustrial.perspective.mapstudio.gateway.setup;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;

class SetupRegistryTest {

    static final String P = "mapstudio-dev";

    RecordingLog log;
    List<String> ensured;
    SetupRegistry registry;

    static Setup setup(String connection) throws Exception {
        return Setup.parse("{\"schemaVersion\":1,\"connection\":\"" + connection + "\",\"tokenSecret\":\"MapboxToken\"}");
    }

    @BeforeEach
    void setUp() {
        log = new RecordingLog();
        ensured = new ArrayList<>();
        registry = new SetupRegistry(s -> ensured.add(s.connection()), log);
    }

    @Test
    void statesSwapWholeAndRequireFollowsTheLatest() throws Exception {
        assertEquals(SetupState.Status.MISSING, registry.state(P).status());
        registry.put(P, setup("MapStudio"));
        assertEquals("MapStudio", registry.require(P).connection());
        registry.putProblem(P, "refreshIntervalSeconds must be a whole number from 1 to 3600, not \"ten\".");
        assertEquals(SetupState.Status.INVALID, registry.state(P).status());
        assertTrue(registry.find(P).isEmpty());
        MapStudioException ex = assertThrows(MapStudioException.class, () -> registry.require(P));
        assertEquals(Messages.CODE_STORE_UNREACHABLE, ex.code());
        assertEquals("The Map Studio setup of project mapstudio-dev cannot be read: refreshIntervalSeconds must be a "
            + "whole number from 1 to 3600, not \"ten\".", ex.plainMessage());
        registry.put(P, setup("Other"));
        assertEquals("Other", registry.require(P).connection());
        assertEquals(List.of("MapStudio", "Other"), ensured, "every valid setup starts its connection");
        registry.deleted(P);
        assertEquals(SetupState.Status.MISSING, registry.state(P).status());
        assertThrows(MapStudioException.class, () -> registry.require(P));
    }

    @Test
    void oneWarningPerBadReadAndNoneMoreAtUse() {
        registry.putProblem(P, "a must be b.");
        assertEquals(1, log.warnings.size());
        assertTrue(log.warnings.get(0).contains("mapstudio-dev") && log.warnings.get(0).contains("a must be b."));
        for (int i = 0; i < 3; i++) {
            assertThrows(MapStudioException.class, () -> registry.require(P));
        }
        assertEquals(1, log.warnings.size(), "the read warned; calls do not");
        registry.putProblem(P, "a must be b.", "resource modified");
        assertEquals(2, log.warnings.size(), "a second bad read warns again");
        assertEquals("The Map Studio setup of project mapstudio-dev (read on resource modified) cannot be read: a must be b.",
            log.warnings.get(1));
    }

    @Test
    void aMissingSetupWarnsOnceAtFirstUseAndAgainAfterADelete() throws Exception {
        assertThrows(MapStudioException.class, () -> registry.require(P));
        assertThrows(MapStudioException.class, () -> registry.require(P));
        assertEquals(1, log.warnings.size());
        assertTrue(log.warnings.get(0).contains("has no Map Studio setup"));
        registry.put(P, setup("MapStudio"));
        registry.deleted(P);
        assertThrows(MapStudioException.class, () -> registry.require(P));
        assertEquals(2, log.warnings.size());
    }

    @Test
    void infoLinesSayReadOrAppliedAndNeverTheTokenSecret() throws Exception {
        registry.put(P, setup("MapStudio"));
        registry.put(P, setup("MapStudio"), "resource modified");
        registry.deleted(P);
        assertEquals(3, log.infos.size(), log.infos.toString());
        assertTrue(log.infos.get(0).startsWith("Project mapstudio-dev: Map Studio setup read (connection MapStudio"));
        assertTrue(log.infos.get(1).startsWith(
            "Project mapstudio-dev: Map Studio setup changed and applied on resource modified (connection MapStudio"));
        assertTrue(log.infos.get(2).contains("setup removed"));
        for (String line : log.infos) {
            assertFalse(line.contains("MapboxToken"), line);
        }
        assertTrue(log.warnings.isEmpty());
    }

    @Test
    void listenersHearEverySwapAndOneFailingListenerDoesNotStopTheOthers() throws Exception {
        List<String> heard = new ArrayList<>();
        registry.addListener((project, before, after) -> {
            throw new IllegalStateException("boom");
        });
        registry.addListener((project, before, after) -> heard.add(project + ":" + before.status() + "->" + after.status()));
        registry.put(P, setup("MapStudio"));
        registry.putProblem(P, "x.");
        registry.remove(P);
        assertEquals(List.of("mapstudio-dev:MISSING->VALID", "mapstudio-dev:VALID->INVALID",
            "mapstudio-dev:INVALID->MISSING"), heard);
        assertEquals(3, log.errors.size());
        assertEquals(SetupState.Status.MISSING, registry.state(P).status(), "the swap stands");
    }

    @Test
    void projectsAreSeparate() throws Exception {
        registry.put("a", setup("A"));
        registry.putProblem("b", "x.");
        assertEquals("A", registry.require("a").connection());
        assertThrows(MapStudioException.class, () -> registry.require("b"));
        assertThrows(MapStudioException.class, () -> registry.require(null));
    }
    @Test
    void callsRacingScansNeverWarnTwiceForOneBadRead() throws Exception {
        Setup good = setup("MapStudio");
        registry.put(P, good);
        int reads = 200;
        java.util.concurrent.atomic.AtomicBoolean stop = new java.util.concurrent.atomic.AtomicBoolean();
        List<Thread> callers = new ArrayList<>();
        for (int t = 0; t < 4; t++) {
            Thread caller = new Thread(() -> {
                while (!stop.get()) {
                    try {
                        registry.require(P);
                    } catch (MapStudioException expected) {
                        // invalid at this moment
                    }
                }
            });
            caller.start();
            callers.add(caller);
        }
        for (int i = 0; i < reads; i++) {
            registry.putProblem(P, "x " + i + ".");
            Thread.yield();
            registry.put(P, good);
        }
        stop.set(true);
        for (Thread caller : callers) {
            caller.join();
        }
        assertEquals(reads, log.warnings.size(), "exactly one warning per bad read, none from the calls");
    }

    @Test
    void aMissingSetupWarnsOnceUnderConcurrentCalls() throws Exception {
        List<Thread> callers = new ArrayList<>();
        for (int t = 0; t < 8; t++) {
            Thread caller = new Thread(() -> {
                for (int i = 0; i < 100; i++) {
                    assertThrows(MapStudioException.class, () -> registry.require(P));
                }
            });
            caller.start();
            callers.add(caller);
        }
        for (Thread caller : callers) {
            caller.join();
        }
        assertEquals(1, log.warnings.size(), log.warnings.toString());
    }
}
