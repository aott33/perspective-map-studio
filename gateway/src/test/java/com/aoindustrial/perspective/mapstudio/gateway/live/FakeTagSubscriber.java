package com.aoindustrial.perspective.mapstudio.gateway.live;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/** A tag system in memory: records subscriptions and delivers what a test hands it. */
public final class FakeTagSubscriber implements TagSubscriber {

    public final Map<String, Consumer<Delivery>> listeners = new LinkedHashMap<>();
    public final List<String> subscribed = new ArrayList<>();
    public final List<String> cancelled = new ArrayList<>();
    public Instant now = Instant.parse("2026-10-28T10:00:00Z");

    @Override
    public Handle subscribe(String fullPath, Consumer<Delivery> listener) {
        if (fullPath.contains("Unparseable")) {
            throw new IllegalArgumentException("The tag path could not be read");
        }
        subscribed.add(fullPath);
        listeners.put(fullPath, listener);
        return () -> {
            cancelled.add(fullPath);
            listeners.remove(fullPath);
        };
    }

    /** A Good delivery of a value. */
    public void deliver(String path, Object value) {
        deliver(path, value, "Good", true, false);
    }

    public void deliver(String path, Object value, String quality, boolean good, boolean notFound) {
        Consumer<Delivery> listener = listeners.get(path);
        if (listener == null) {
            throw new AssertionError("not subscribed: " + path);
        }
        listener.accept(new Delivery(value, quality, good, notFound, now));
    }

    /** The initial delivery every real subscription gets first. */
    public void initial(String path) {
        deliver(path, null, "Uncertain_InitialValue", false, false);
    }

    public void notFound(String path) {
        deliver(path, null, "Bad_NotFound", false, true);
    }
}
