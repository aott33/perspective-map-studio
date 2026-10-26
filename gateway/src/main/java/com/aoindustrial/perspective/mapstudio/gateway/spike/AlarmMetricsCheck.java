package com.aoindustrial.perspective.mapstudio.gateway.spike;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import com.inductiveautomation.ignition.common.model.values.QualifiedValue;
import com.inductiveautomation.ignition.common.model.values.QualityCode;
import com.inductiveautomation.ignition.common.tags.model.TagManager;
import com.inductiveautomation.ignition.common.tags.model.TagPath;
import com.inductiveautomation.ignition.common.tags.model.event.TagChangeEvent;
import com.inductiveautomation.ignition.common.tags.model.event.TagChangeListener;
import com.inductiveautomation.ignition.common.tags.paths.parser.TagPathParser;
import com.inductiveautomation.ignition.common.util.LoggerEx;

/**
 * Spike check 1: a Java tag subscription to {@code <path>/Alarm Metrics.<prop>} on
 * a tag folder and on a UDT instance. The dev project's alarm toggles every 30 s
 * from an expression, so a working subscription sees true and false, each with
 * exactly Good quality, within 90 s. The same paths are also read once with
 * {@code readAsync}, for the record only (IA: direct reads are not supported).
 */
public final class AlarmMetricsCheck {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.check.alarm-metrics");

    static final long WAIT_SECONDS = 90;

    /** One delivered event: the value, whether its quality is exactly Good, and the words for the log. */
    record Seen(Object value, boolean good, boolean initial, String text) {
        static Seen of(TagChangeEvent event) {
            QualifiedValue qv = event.getValue();
            Object value = qv == null ? null : qv.getValue();
            QualityCode quality = qv == null ? null : qv.getQuality();
            boolean good = quality != null && quality.isGood() && "Good".equals(quality.getName());
            String text = String.format("%svalue %s quality %s", event.isInitial() ? "initial " : "", value, quality);
            return new Seen(value, good, event.isInitial(), text);
        }

        boolean isGood(boolean expected) {
            return good && Boolean.valueOf(expected).equals(value);
        }
    }

    private final TagManager tags;
    private final Map<TagPath, TagChangeListener> listeners = new ConcurrentHashMap<>();
    private final Map<TagPath, List<Seen>> seen = new ConcurrentHashMap<>();

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
            while (System.nanoTime() < deadline && !allToggled()) {
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
            List<Seen> events = seen.get(path);
            boolean pathOk = toggled(events);
            ok &= pathOk;
            evidence.append(String.format("subscription %s: %d events in %ds (%s)%s; ",
                path, events.size(), WAIT_SECONDS,
                events.stream().map(Seen::text).collect(Collectors.joining(", ")),
                pathOk ? "" : " - expected a true and a false, each with quality exactly Good"));
        }
        return ok ? CheckResult.pass(name, evidence.toString()) : CheckResult.fail(name, evidence.toString());
    }

    private void record(TagPath path, TagChangeEvent event) {
        Seen entry = Seen.of(event);
        List<Seen> events = seen.get(path);
        if (events != null) {
            events.add(entry);
        }
        log.infof("%s -> %s", path, entry.text());
    }

    /** True once a path delivered both a Good true and a Good false. */
    static boolean toggled(List<Seen> events) {
        return events.stream().anyMatch(e -> e.isGood(true)) && events.stream().anyMatch(e -> e.isGood(false));
    }

    private boolean allToggled() {
        return seen.values().stream().allMatch(AlarmMetricsCheck::toggled);
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
