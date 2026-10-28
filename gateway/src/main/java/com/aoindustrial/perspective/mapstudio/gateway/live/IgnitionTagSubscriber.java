package com.aoindustrial.perspective.mapstudio.gateway.live;

import java.io.IOException;
import java.time.Instant;
import java.util.Date;
import java.util.function.Consumer;

import com.inductiveautomation.ignition.common.model.values.QualifiedValue;
import com.inductiveautomation.ignition.common.model.values.QualityCode;
import com.inductiveautomation.ignition.common.tags.model.TagManager;
import com.inductiveautomation.ignition.common.tags.model.TagPath;
import com.inductiveautomation.ignition.common.tags.model.event.TagChangeEvent;
import com.inductiveautomation.ignition.common.tags.model.event.TagChangeListener;
import com.inductiveautomation.ignition.common.tags.paths.parser.TagPathParser;
import com.inductiveautomation.ignition.common.util.LoggerEx;

/**
 * {@link TagSubscriber} over the Gateway's tag manager: {@code TagPathParser.parse} and
 * {@code TagManager.subscribeAsync(path, listener)}, the way the spike's Alarm Metrics check
 * subscribed (docs/platform-checks.md, story 3, check 1, live 8.3.10): the first delivery is
 * {@code Uncertain_InitialValue}, a Good value follows. {@code unsubscribeAsync} cancels.
 */
public final class IgnitionTagSubscriber implements TagSubscriber {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.live");

    private final TagManager tags;

    public IgnitionTagSubscriber(TagManager tags) {
        this.tags = tags;
    }

    @Override
    public Handle subscribe(String fullPath, Consumer<Delivery> listener) {
        TagPath path;
        try {
            path = TagPathParser.parse(fullPath);
        } catch (IOException | RuntimeException ex) {
            throw new IllegalArgumentException("The tag path could not be read: " + ex.getClass().getSimpleName());
        }
        TagChangeListener tagListener = event -> listener.accept(delivery(event));
        tags.subscribeAsync(path, tagListener).whenComplete((v, ex) -> {
            if (ex != null) {
                log.warnf("Could not subscribe to %s: %s", fullPath, ex.getClass().getSimpleName());
            }
        });
        return () -> {
            try {
                tags.unsubscribeAsync(path, tagListener);
            } catch (RuntimeException ex) {
                log.debugf("Could not unsubscribe from %s: %s", fullPath, ex.getClass().getSimpleName());
            }
        };
    }

    /** The delivery for one tag change event; a missing value or quality reads as Bad. */
    static Delivery delivery(TagChangeEvent event) {
        QualifiedValue qv = event == null ? null : event.getValue();
        QualityCode quality = qv == null ? null : qv.getQuality();
        String name = quality == null ? "Bad" : quality.getName();
        boolean good = quality != null && quality.isGood();
        boolean notFound = quality != null && quality.is(QualityCode.Bad_NotFound);
        Date time = qv == null ? null : qv.getTimestamp();
        return new Delivery(qv == null ? null : qv.getValue(), name, good, notFound,
            time == null ? Instant.now() : time.toInstant());
    }
}
