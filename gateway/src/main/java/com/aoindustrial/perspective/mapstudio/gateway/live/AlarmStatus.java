package com.aoindustrial.perspective.mapstudio.gateway.live;

import java.time.Instant;
import java.util.List;

/**
 * Ignition's alarm status as the default popup's alarm summary needs it (AD-7, epic 3 entry 8): the
 * active alarms below one tag path, read when a map's popup is open and that item's values change.
 * A read only: Map Studio acknowledges nothing (FR-5). On the Gateway it is
 * {@link IgnitionAlarmStatus}; tests use a fake.
 */
public interface AlarmStatus {

    /**
     * One active alarm below the path: its name (the alarm's label when it has one, else its name),
     * the source below the alarms path in words (the tag's path under it, {@code ""} for an alarm on
     * the path itself; never the provider or the base path), the map's priority (1 to 3; 0 for
     * Diagnostic), whether it is unacknowledged, and when it went active (null when unknown).
     */
    record ActiveAlarm(String name, String source, int priority, boolean unacked, Instant activeTime) {
    }

    /**
     * The active alarms (acknowledged or not) whose source is {@code alarmsPath} ({@code [provider]a/b})
     * or below it, in no particular order.
     *
     * @throws RuntimeException when the alarm system could not answer; the caller says so in words
     */
    List<ActiveAlarm> active(String alarmsPath);
}
