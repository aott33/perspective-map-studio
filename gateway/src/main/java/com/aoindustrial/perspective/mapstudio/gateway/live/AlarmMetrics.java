package com.aoindustrial.perspective.mapstudio.gateway.live;

import java.util.List;
import java.util.Locale;

/**
 * The Alarm Metrics the cache subscribes to under a kind setup's alarms path (AD-6, epic 3 entry 5),
 * and the priority mapping to the map's three priorities (DESIGN.md: priority 1 triangle for
 * Critical and High, 2 circle for Medium, 3 square for Low; Diagnostic never shows).
 *
 * <p>The path of a metric is {@code <folder or UDT instance>/Alarm Metrics.<Metric>}: the node
 * {@code Alarm Metrics} (with its space) and the metric as the property, read by Java subscription
 * only (docs/platform-checks.md, story 3, check 1: {@code HasActive} delivered Good values; the three
 * count and priority metrics here are checked live by epic 3 entry 5).
 */
public final class AlarmMetrics {

    public static final String NODE = "Alarm Metrics";
    /** The number of active, acknowledged alarms below the path. */
    public static final String ACTIVE_ACKED = "ActiveAckedCount";
    /** The number of active, unacknowledged alarms below the path. */
    public static final String ACTIVE_UNACKED = "ActiveUnackedCount";
    /** The highest priority among the active alarms, as Ignition's priority. */
    public static final String HIGHEST_ACTIVE = "HighestActivePriority";

    public static final List<String> METRICS = List.of(ACTIVE_ACKED, ACTIVE_UNACKED, HIGHEST_ACTIVE);

    private AlarmMetrics() {
    }

    /** {@code <folder>/Alarm Metrics.<metric>}. */
    public static String path(String folder, String metric) {
        String base = folder;
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base + "/" + NODE + "." + metric;
    }

    /**
     * The map's priority for an Ignition priority value: 1 for Critical (4) and High (3), 2 for
     * Medium (2), 3 for Low (1), 0 for Diagnostic (0), none, or anything unreadable. The value may
     * come as a number (the priority's int value) or as the priority's name.
     */
    public static int priority(Object ignition) {
        int level;
        if (ignition instanceof Number n) {
            level = n.intValue();
        } else if (ignition instanceof String s) {
            switch (s.trim().toLowerCase(Locale.ROOT)) {
                case "critical" -> level = 4;
                case "high" -> level = 3;
                case "medium" -> level = 2;
                case "low" -> level = 1;
                default -> level = 0;
            }
        } else if (ignition != null && ignition.getClass().isEnum()) {
            return priority(((Enum<?>) ignition).name());
        } else {
            return 0;
        }
        if (level >= 3) {
            return 1;
        }
        if (level == 2) {
            return 2;
        }
        return level == 1 ? 3 : 0;
    }

    /** A count metric's value as an int; 0 for anything unreadable. */
    public static int count(Object value) {
        return value instanceof Number n ? Math.max(0, n.intValue()) : 0;
    }
}
