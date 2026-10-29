package com.aoindustrial.perspective.mapstudio.gateway.live;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import com.inductiveautomation.ignition.common.QualifiedPath;
import com.inductiveautomation.ignition.common.alarming.AlarmEvent;
import com.inductiveautomation.ignition.common.alarming.AlarmFilter;
import com.inductiveautomation.ignition.common.alarming.AlarmState;
import com.inductiveautomation.ignition.common.alarming.EventData;
import com.inductiveautomation.ignition.common.alarming.query.AlarmQueryResult;
import com.inductiveautomation.ignition.common.alarming.query.conditions.EnumCondition;
import com.inductiveautomation.ignition.gateway.alarming.AlarmManager;

import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.TagPaths;

/**
 * The Gateway's alarm status through {@code AlarmManager.queryStatus} (epic 3 entry 8): one query
 * for the active alarms ({@code ActiveUnacked}, {@code ActiveAcked}), then the alarms whose source
 * tag is the alarms path or below it, matched here on the source's provider and tag path (the
 * {@code prov} and {@code tag} components of the alarm's {@code QualifiedPath}), the same tags the
 * path's Alarm Metrics aggregate. The source and state fields of {@code AlarmFilter} are the ones
 * {@code system.alarm.queryStatus} builds its filter from (docs/platform-checks.md, "Epic 3 entry 8").
 * A read only; nothing here acknowledges.
 */
public final class IgnitionAlarmStatus implements AlarmStatus {

    private static final String PROVIDER = "prov";
    private static final String TAG = "tag";

    private final AlarmManager alarms;

    public IgnitionAlarmStatus(AlarmManager alarms) {
        this.alarms = alarms;
    }

    @Override
    public List<ActiveAlarm> active(String alarmsPath) {
        TagPaths.Full full;
        try {
            full = TagPaths.parseFull(alarmsPath);
        } catch (MapStudioException ex) {
            return List.of();
        }
        AlarmFilter filter = new AlarmFilter();
        filter.and(AlarmFilter.STATE, new EnumCondition<>(AlarmState.ActiveUnacked, AlarmState.ActiveAcked));
        AlarmQueryResult result = alarms.queryStatus(filter);
        List<ActiveAlarm> out = new ArrayList<>();
        for (AlarmEvent event : result) {
            String suffix = sourceBelow(event.getSource(), full.provider(), full.path());
            if (suffix == null) {
                continue;
            }
            out.add(new ActiveAlarm(name(event), suffix, AlarmMetrics.priority(event.getPriority()),
                !event.isAcked(), activeTime(event)));
        }
        return out;
    }

    /**
     * The alarm's source tag path below {@code path} when its provider is {@code provider} and its tag
     * is {@code path} or under it ({@code ""} for the path itself, {@code Pressure} for a tag one
     * below); null when it is not. Path parts compare exactly, case as stored.
     */
    static String sourceBelow(QualifiedPath source, String provider, String path) {
        if (source == null || !provider.equals(source.getPathComponent(PROVIDER))) {
            return null;
        }
        String tag = source.getPathComponent(TAG);
        if (tag == null) {
            return null;
        }
        if (tag.equals(path)) {
            return "";
        }
        if (tag.startsWith(path + "/")) {
            return tag.substring(path.length() + 1);
        }
        return null;
    }

    private static String name(AlarmEvent event) {
        String label = event.getLabel();
        if (label != null && !label.isBlank()) {
            return label;
        }
        String name = event.getName();
        return name == null ? "" : name;
    }

    private static Instant activeTime(AlarmEvent event) {
        EventData data = event.getActiveData();
        return data == null || data.getTimestamp() <= 0 ? null : Instant.ofEpochMilli(data.getTimestamp());
    }
}
