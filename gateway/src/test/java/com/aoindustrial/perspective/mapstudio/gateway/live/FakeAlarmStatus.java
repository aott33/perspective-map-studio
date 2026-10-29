package com.aoindustrial.perspective.mapstudio.gateway.live;

import java.util.ArrayList;
import java.util.List;

/** An alarm status in memory (epic 3 entry 8): the active alarms a test hands it, by alarms path, or a failure. */
public final class FakeAlarmStatus implements AlarmStatus {

    public final List<ActiveAlarm> active = new ArrayList<>();
    public final List<String> asked = new ArrayList<>();
    public RuntimeException failure;

    @Override
    public List<ActiveAlarm> active(String alarmsPath) {
        asked.add(alarmsPath);
        if (failure != null) {
            throw failure;
        }
        return List.copyOf(active);
    }
}
