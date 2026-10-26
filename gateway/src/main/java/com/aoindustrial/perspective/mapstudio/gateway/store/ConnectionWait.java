package com.aoindustrial.perspective.mapstudio.gateway.store;

import java.time.Duration;
import java.util.Optional;
import java.util.function.LongSupplier;

/**
 * The start-up wait for a database connection (epic Notes, assumption of 2026-10-26):
 * try every 5 s for up to 2 minutes while the connection is not usable, such as
 * during the transient {@code NoClassDefFoundError: org/postgresql/Driver$1} of a
 * fresh Gateway (docs/platform-checks.md, check 5). The scheduling lives in
 * {@link StoreRegistry}; this class only decides, so it is tested with a fake clock.
 */
public final class ConnectionWait {

    public static final Duration INTERVAL = Duration.ofSeconds(5);
    public static final Duration MAX = Duration.ofMinutes(2);

    /** One probe of the connection: empty when usable, else the reason in plain words. */
    @FunctionalInterface
    public interface Probe {
        Optional<String> unusableReason();
    }

    public enum Step { USABLE, RETRY, GAVE_UP }

    private final Probe probe;
    private final LongSupplier nanoClock;
    private final long maxNanos;
    private long startedAt = -1;
    private int attempts;
    private String lastReason = "";

    public ConnectionWait(Probe probe, LongSupplier nanoClock, Duration max) {
        this.probe = probe;
        this.nanoClock = nanoClock;
        this.maxNanos = max.toNanos();
    }

    /** Probe once and decide: usable, try again after {@link #INTERVAL}, or give up. */
    public Step attempt() {
        long now = nanoClock.getAsLong();
        if (startedAt < 0) {
            startedAt = now;
        }
        attempts++;
        Optional<String> reason = probe.unusableReason();
        if (reason.isEmpty()) {
            return Step.USABLE;
        }
        lastReason = reason.get();
        return now - startedAt >= maxNanos ? Step.GAVE_UP : Step.RETRY;
    }

    public int attempts() {
        return attempts;
    }

    public String lastReason() {
        return lastReason;
    }
}
