package com.aoindustrial.perspective.mapstudio.gateway.live;

import static com.aoindustrial.perspective.mapstudio.gateway.live.LiveFixtures.ASSETS;
import static com.aoindustrial.perspective.mapstudio.gateway.live.LiveFixtures.OVERRIDDEN;
import static com.aoindustrial.perspective.mapstudio.gateway.live.LiveFixtures.P1;
import static com.aoindustrial.perspective.mapstudio.gateway.live.LiveFixtures.P3;
import static com.aoindustrial.perspective.mapstudio.gateway.live.LiveFixtures.UNLINKED;
import static com.aoindustrial.perspective.mapstudio.gateway.live.LiveFixtures.items;
import static com.aoindustrial.perspective.mapstudio.gateway.live.LiveFixtures.json;
import static com.aoindustrial.perspective.mapstudio.gateway.live.LiveFixtures.pad;
import static com.aoindustrial.perspective.mapstudio.gateway.live.LiveFixtures.padSetup;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.aoindustrial.perspective.mapstudio.common.contract.Asset;
import com.aoindustrial.perspective.mapstudio.common.contract.KindSetupRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;

/** Epic 3 entry 5: the plan rows of the I/O matrix (pure). */
class ValuePlanTest {

    @Test
    void planFromSetupsResolvesAssetPathsAndReportsTheUnresolvedOnes() {
        ValuePlan.Plan plan = ValuePlan.build(List.of(padSetup()), items(), ASSETS);
        // Comms, Pressure, Flow and the three Alarm Metrics for P12 and P14; P15 the same (it has no
        // Comms or Pressure, but that is the tag system's finding, not the plan's); nothing for gas.
        Set<String> expected = new java.util.HashSet<>();
        for (String pad : List.of("P12", "P14", "P15")) {
            for (String suffix : List.of("Comms", "Pressure", "Flow", "Alarm Metrics.ActiveAckCount",
                    "Alarm Metrics.ActiveUnackCount", "Alarm Metrics.HighestActivePriority")) {
                expected.add("[default]Mesa/" + pad + "/" + suffix);
            }
        }
        assertEquals(expected, plan.paths());
        assertFalse(plan.paths().toString().contains("GasPrice"), "a switched-off KPI is never subscribed");
        ValuePlan.ItemPlan p1 = plan.items().get(P1);
        assertEquals("[default]Mesa/P12/Comms", p1.slots().get(ValuePlan.COMMS));
        assertEquals("[default]Mesa/P12/Pressure", p1.slots().get("kpi:pressure"));
        assertEquals("[default]Mesa/P12/Alarm Metrics.HighestActivePriority", p1.slots().get(ValuePlan.ALARM_PRIORITY));
        assertEquals(List.of(), p1.problems());
        assertEquals(Set.of(P1), plan.itemsByPath().get("[default]Mesa/P12/Pressure"));
        // The unlinked pad: every asset-relative slot is a problem, no path, and it is still in the plan.
        ValuePlan.ItemPlan unlinked = plan.items().get(UNLINKED);
        assertEquals(0, unlinked.slots().size());
        assertEquals(List.of(new ValuePlan.Problem("comms", ValuePlan.NO_ASSET),
            new ValuePlan.Problem("kpi:pressure", ValuePlan.NO_ASSET), new ValuePlan.Problem("kpi:flow", ValuePlan.NO_ASSET),
            new ValuePlan.Problem("alarms", ValuePlan.NO_ASSET)), unlinked.problems());
        assertEquals(4, plan.problemCount());
        assertEquals(1, plan.display().size());
        assertEquals("pad", plan.display().get(0).kindId());
        assertFalse(plan.display().toString().contains("{asset.path}"));
    }

    @Test
    void aFullPathIsOneTagForEveryItemAndAMissingAssetIsReported() {
        KindSetupRecord setup = new KindSetupRecord("pad", json("{\"kpis\":[{\"key\":\"header\","
            + "\"path\":\"[default]Plant/Header/Pressure\"}]}"), 1, false);
        ValuePlan.Plan plan = ValuePlan.build(List.of(setup), items(), List.of());
        assertEquals(Set.of("[default]Plant/Header/Pressure"), plan.paths());
        assertEquals(Set.of(P1, LiveFixtures.P2, P3, UNLINKED), plan.itemsByPath().get("[default]Plant/Header/Pressure"));
        // Linked to P12, but the asset list has no assets now.
        ValuePlan.Plan missing = ValuePlan.build(List.of(padSetup()), List.of(pad(P1, "Point 1", "P12", null)), List.of());
        assertEquals(List.of(new ValuePlan.Problem("comms", ValuePlan.ASSET_MISSING),
            new ValuePlan.Problem("kpi:pressure", ValuePlan.ASSET_MISSING), new ValuePlan.Problem("kpi:flow", ValuePlan.ASSET_MISSING),
            new ValuePlan.Problem("alarms", ValuePlan.ASSET_MISSING)), missing.items().get(P1).problems());
        assertEquals(Set.of(), missing.paths());
    }

    @Test
    void anOverrideReplacesThatItemsPathWithAFullPathOnly() {
        MapItemRecord overridden = pad(OVERRIDDEN, "Override pad", "P12", "{\"kpis\":[{\"key\":\"pressure\","
            + "\"path\":\"[default]Plant/Header/Pressure\"},{\"key\":\"flow\",\"path\":\"{asset.path}/Nope\"}],"
            + "\"comms\":{\"path\":\"[default]Plant/Header/Comms\",\"on\":true}}");
        List<MapItemRecord> both = List.of(pad(P1, "Point 1", "P12", null), overridden);
        ValuePlan.Plan plan = ValuePlan.build(List.of(padSetup()), both, ASSETS);
        ValuePlan.ItemPlan o = plan.items().get(OVERRIDDEN);
        assertEquals("[default]Plant/Header/Pressure", o.slots().get("kpi:pressure"));
        assertEquals("[default]Plant/Header/Comms", o.slots().get(ValuePlan.COMMS));
        assertEquals("[default]Mesa/P12/Flow", o.slots().get("kpi:flow"), "an override that is not a full path is ignored");
        ValuePlan.ItemPlan p1 = plan.items().get(P1);
        assertEquals("[default]Mesa/P12/Pressure", p1.slots().get("kpi:pressure"), "the kind's other items keep theirs");
        assertTrue(plan.paths().contains("[default]Mesa/P12/Pressure") && plan.paths().contains("[default]Plant/Header/Pressure"));
    }

    @Test
    void itemsWithoutASetupAndDeletedSetupsAndSwitchedOffPartsAreLeftOut() {
        KindSetupRecord deleted = new KindSetupRecord("pad", json(LiveFixtures.PAD_SETUP), 2, true);
        assertEquals(ValuePlan.EMPTY.items(), ValuePlan.build(List.of(deleted), items(), ASSETS).items());
        assertEquals(ValuePlan.EMPTY.items(), ValuePlan.build(List.of(), items(), ASSETS).items());
        KindSetupRecord off = new KindSetupRecord("pad", json("{\"comms\":{\"path\":\"{asset.path}/Comms\",\"on\":false},"
            + "\"kpis\":[{\"key\":\"pressure\",\"path\":\"{asset.path}/Pressure\",\"on\":false}]}"), 1, false);
        ValuePlan.Plan plan = ValuePlan.build(List.of(off), items(), ASSETS);
        assertEquals(Set.of(), plan.paths());
        assertTrue(plan.items().isEmpty(), "nothing on: no item in the plan");
        MapItemRecord tomb = pad(P1, "Point 1", "P12", null).at(2, true);
        assertTrue(ValuePlan.build(List.of(padSetup()), List.of(tomb), ASSETS).items().isEmpty());
    }

    @Test
    void alarmMetricsPathsAndPriorities() {
        assertEquals("[default]Mesa/P12/Alarm Metrics.HasActive", AlarmMetrics.path("[default]Mesa/P12/", "HasActive"));
        assertEquals(1, AlarmMetrics.priority(4));
        assertEquals(1, AlarmMetrics.priority(3));
        assertEquals(2, AlarmMetrics.priority(2));
        assertEquals(3, AlarmMetrics.priority(1));
        assertEquals(0, AlarmMetrics.priority(0));
        assertEquals(0, AlarmMetrics.priority(-1));
        assertEquals(1, AlarmMetrics.priority("Critical"));
        assertEquals(2, AlarmMetrics.priority("Medium"));
        assertEquals(0, AlarmMetrics.priority("Diagnostic"));
        assertEquals(0, AlarmMetrics.priority(null));
        assertEquals(3, AlarmMetrics.count(3L));
        assertEquals(0, AlarmMetrics.count("x"));
        assertEquals(new Asset("P12", "Pad 12", "pad", "[default]Mesa/P12"), ASSETS.get(0));
    }
}
