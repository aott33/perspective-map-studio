package com.aoindustrial.perspective.mapstudio.gateway.spike;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

/** The Alarm Metrics row of the I/O matrix: a pass needs a Good true and a Good false, exactly Good. */
class AlarmMetricsCheckTest {

    private static AlarmMetricsCheck.Seen seen(Object value, boolean good, boolean initial) {
        return new AlarmMetricsCheck.Seen(value, good, initial, "value " + value);
    }

    @Test
    void goodTrueAndGoodFalsePass() {
        assertTrue(AlarmMetricsCheck.toggled(List.of(
            seen(null, false, true), seen(true, true, false), seen(false, true, false))));
    }

    @Test
    void oneValueOnlyDoesNotPass() {
        assertFalse(AlarmMetricsCheck.toggled(List.of(seen(null, false, true), seen(true, true, false))));
    }

    @Test
    void nonGoodQualityDoesNotCount() {
        // Uncertain or Bad deliveries carry values too; only exactly Good ones prove the subscription.
        assertFalse(AlarmMetricsCheck.toggled(List.of(seen(true, false, false), seen(false, false, false))));
        assertFalse(AlarmMetricsCheck.toggled(List.of(seen(true, true, false), seen(false, false, false))));
    }

    @Test
    void nonBooleanValuesDoNotCount() {
        assertFalse(AlarmMetricsCheck.toggled(List.of(seen("true", true, false), seen("false", true, false))));
    }
}
