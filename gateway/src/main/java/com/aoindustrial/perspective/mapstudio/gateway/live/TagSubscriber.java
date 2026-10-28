package com.aoindustrial.perspective.mapstudio.gateway.live;

import java.time.Instant;
import java.util.function.Consumer;

/**
 * The tag system as the live-value cache needs it (AD-6, epic 3 entry 5): subscribe to one full
 * tag path and be told each delivery, then cancel. Never a read (Alarm Metrics answer
 * {@code Bad_Unsupported} to a read, docs/platform-checks.md story 3), never a write. On the
 * Gateway it is {@link IgnitionTagSubscriber}; tests use a fake.
 */
public interface TagSubscriber {

    /** One subscription; cancel it to unsubscribe. Safe to cancel more than once. */
    @FunctionalInterface
    interface Handle {
        void cancel();
    }

    /**
     * One delivery of a subscribed path: the value, Ignition's quality name, whether that quality is
     * good, whether it says the tag does not exist ({@code Bad_NotFound}), and the value's time.
     */
    record Delivery(Object value, String quality, boolean good, boolean notFound, Instant t) {
    }

    /**
     * Subscribe to {@code fullPath} ({@code [provider]a/b}, or {@code [provider]a/Alarm Metrics.Metric});
     * {@code listener} is called on the tag system's thread for every delivery, the initial one included.
     *
     * @throws IllegalArgumentException when the path cannot be parsed
     */
    Handle subscribe(String fullPath, Consumer<Delivery> listener);
}
