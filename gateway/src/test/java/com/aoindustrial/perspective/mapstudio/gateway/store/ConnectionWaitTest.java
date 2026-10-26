package com.aoindustrial.perspective.mapstudio.gateway.store;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.Test;

class ConnectionWaitTest {

    @Test
    void retriesUntilUsable() {
        AtomicLong clock = new AtomicLong();
        int[] calls = {0};
        ConnectionWait wait = new ConnectionWait(
            () -> ++calls[0] < 3 ? Optional.of("NoClassDefFoundError: org/postgresql/Driver$1") : Optional.empty(),
            clock::get, ConnectionWait.MAX);
        assertEquals(ConnectionWait.Step.RETRY, wait.attempt());
        clock.addAndGet(ConnectionWait.INTERVAL.toNanos());
        assertEquals(ConnectionWait.Step.RETRY, wait.attempt());
        assertEquals("NoClassDefFoundError: org/postgresql/Driver$1", wait.lastReason());
        clock.addAndGet(ConnectionWait.INTERVAL.toNanos());
        assertEquals(ConnectionWait.Step.USABLE, wait.attempt());
        assertEquals(3, wait.attempts());
    }

    @Test
    void givesUpAfterTwoMinutesEveryFiveSeconds() {
        AtomicLong clock = new AtomicLong();
        ConnectionWait wait = new ConnectionWait(() -> Optional.of("SQLState 08001: refused"), clock::get,
            Duration.ofMinutes(2));
        ConnectionWait.Step step;
        do {
            step = wait.attempt();
            clock.addAndGet(ConnectionWait.INTERVAL.toNanos());
        } while (step == ConnectionWait.Step.RETRY);
        assertEquals(ConnectionWait.Step.GAVE_UP, step);
        assertEquals(25, wait.attempts(), "attempts at 0, 5, ..., 120 s");
        assertEquals(Duration.ofSeconds(5), ConnectionWait.INTERVAL);
        assertEquals(Duration.ofMinutes(2), ConnectionWait.MAX);
    }
}
