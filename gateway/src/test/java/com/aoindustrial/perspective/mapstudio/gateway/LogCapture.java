package com.aoindustrial.perspective.mapstudio.gateway;

import java.util.List;
import java.util.stream.Collectors;

import org.slf4j.LoggerFactory;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;

/**
 * The lines a named logger writes during a test (LoggerEx logs through SLF4J,
 * which is logback on the SDK's test classpath). Close it to detach.
 */
public final class LogCapture implements AutoCloseable {

    private final Logger logger;
    private final ListAppender<ILoggingEvent> appender = new ListAppender<>();
    private final Level before;

    public LogCapture(String name) {
        this(name, Level.INFO);
    }

    /** Capture from {@code level} up (DEBUG to see a logger's debug lines too). */
    public LogCapture(String name, Level level) {
        logger = (Logger) LoggerFactory.getLogger(name);
        before = logger.getLevel();
        logger.setLevel(level);
        appender.start();
        logger.addAppender(appender);
    }

    /** The formatted messages at {@code level} or above, in order. */
    public List<String> lines(Level level) {
        return appender.list.stream().filter(e -> e.getLevel().isGreaterOrEqual(level))
            .map(ILoggingEvent::getFormattedMessage).collect(Collectors.toList());
    }

    /** The formatted messages at exactly {@code level}, in order. */
    public List<String> exactly(Level level) {
        return appender.list.stream().filter(e -> e.getLevel().equals(level))
            .map(ILoggingEvent::getFormattedMessage).collect(Collectors.toList());
    }

    @Override
    public void close() {
        logger.detachAppender(appender);
        logger.setLevel(before);
        appender.stop();
    }
}
