package com.aoindustrial.perspective.mapstudio.gateway.spike;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;

import com.inductiveautomation.ignition.common.model.values.QualifiedValue;
import com.inductiveautomation.ignition.common.tags.model.TagManager;
import com.inductiveautomation.ignition.common.tags.model.TagPath;
import com.inductiveautomation.ignition.common.tags.model.event.TagChangeEvent;
import com.inductiveautomation.ignition.common.tags.model.event.TagChangeListener;
import com.inductiveautomation.ignition.common.tags.paths.parser.TagPathParser;
import com.inductiveautomation.ignition.common.util.LoggerEx;

/**
 * Spike check 1: a Java tag subscription to {@code <path>/Alarm Metrics.<prop>} on
 * a tag folder and on a UDT instance. The dev project's alarm toggles every 30 s
 * from an expression, so a working subscription sees true and false within 90 s.
 * The same paths are also read once with {@code readAsync}, for the record only
 * (IA: direct reads are not supported).
 */
public final class AlarmMetricsCheck {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.check.alarm-metrics");

    static final long WAIT_SECONDS = 90;
    static final int EVENTS_WANTED = 2;

    private final TagManager tags;
    private final Map<TagPath, TagChangeListener> listeners = new ConcurrentHashMap<>();
    private final Map<TagPath, List<String>> seen = new ConcurrentHashMap<>();

    public AlarmMetricsCheck(TagManager tags) {
        this.tags = tags;
    }

    public CheckResult run(List<String> paths) {
        String name = "alarm-metrics";
        List<TagPath> parsed = new ArrayList<>();
        for (String p : paths) {
            try {
                parsed.add(TagPathParser.parse(p));
            } catch (IOException ex) {
                return CheckResult.fail(name, "cannot parse tag path " + p + ": " + ex.getMessage());
            }
        }
        if (parsed.isEmpty()) {
            return CheckResult.fail(name, "no alarmMetricPaths in the setup");
        }
        StringBuilder evidence = new StringBuilder();
        try {
            for (TagPath path : parsed) {
                seen.put(path, new CopyOnWriteArrayList<>());
                TagChangeListener listener = event -> record(path, event);
                listeners.put(path, listener);
                tags.subscribeAsync(path, listener).get(10, TimeUnit.SECONDS);
            }
            // For the record: what a direct read returns.
            List<QualifiedValue> reads = tags.readAsync(parsed).get(10, TimeUnit.SECONDS);
            for (int i = 0; i < parsed.size(); i++) {
                QualifiedValue qv = reads.get(i);
                evidence.append(String.format("readAsync %s -> %s quality %s; ",
                    parsed.get(i), qv.getValue(), qv.getQuality()));
            }
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(WAIT_SECONDS);
            while (System.nanoTime() < deadline && !enoughEvents()) {
                Thread.sleep(1000);
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return CheckResult.fail(name, "interrupted while waiting for events");
        } catch (Exception ex) {
            return CheckResult.fail(name, ex.getClass().getSimpleName() + ": " + ex.getMessage());
        } finally {
            unsubscribe();
        }
        boolean ok = true;
        for (TagPath path : parsed) {
            List<String> events = seen.get(path);
            long good = events.stream().filter(e -> e.contains("quality Good")).count();
            boolean sawTrue = events.stream().anyMatch(e -> e.contains("value true"));
            boolean sawFalse = events.stream().anyMatch(e -> e.contains("value false"));
            boolean pathOk = good >= EVENTS_WANTED && sawTrue && sawFalse;
            ok &= pathOk;
            evidence.append(String.format("subscription %s: %d events in %ds (%s)%s; ",
                path, events.size(), WAIT_SECONDS, String.join(", ", events),
                pathOk ? "" : " - expected at least " + EVENTS_WANTED + " Good events with true and false"));
        }
        return ok ? CheckResult.pass(name, evidence.toString()) : CheckResult.fail(name, evidence.toString());
    }

    private void record(TagPath path, TagChangeEvent event) {
        QualifiedValue qv = event.getValue();
        String entry = String.format("%svalue %s quality %s", event.isInitial() ? "initial " : "",
            qv == null ? null : qv.getValue(), qv == null ? null : qv.getQuality());
        List<String> events = seen.get(path);
        if (events != null) {
            events.add(entry);
        }
        log.infof("%s -> %s", path, entry);
    }

    private boolean enoughEvents() {
        return seen.values().stream().allMatch(events -> {
            boolean sawTrue = events.stream().anyMatch(e -> e.contains("value true") && e.contains("quality Good"));
            boolean sawFalse = events.stream().anyMatch(e -> e.contains("value false") && e.contains("quality Good"));
            return sawTrue && sawFalse;
        });
    }

    public void unsubscribe() {
        listeners.forEach((path, listener) -> {
            try {
                tags.unsubscribeAsync(path, listener);
            } catch (RuntimeException ex) {
                log.warnf("unsubscribe %s failed: %s", path, ex.toString());
            }
        });
        listeners.clear();
    }
}
