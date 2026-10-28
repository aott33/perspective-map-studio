package com.aoindustrial.perspective.mapstudio.common.contract;

import static com.aoindustrial.perspective.mapstudio.common.contract.KindFixtures.PAD_SETUP;
import static com.aoindustrial.perspective.mapstudio.common.contract.KindFixtures.json;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonObject;

/** Epic 3 entry 5: the path-free projection of a kind setup a viewer may see. */
class KindDisplayTest {

    @Test
    void theFullSetupProjectsToWordsWithNoPath() {
        KindDisplay d = KindDisplay.of("pad", json(PAD_SETUP));
        assertEquals("pad", d.kindId());
        assertTrue(d.comms());
        assertEquals(2, d.kpis().size());
        assertEquals(new KindDisplay.Kpi("pressure", "Pressure", "psi", true, true), d.kpis().get(0));
        assertEquals(new KindDisplay.Kpi("gas", "Gas price", "", false, false), d.kpis().get(1));
        assertTrue(d.alarmsOn());
        assertTrue(d.alarmsCount());
        assertTrue(d.alarmsSummary());
        assertEquals("/pad/{item.name}", d.link());
        assertTrue(d.showsAnything());
        String wire = d.toJson().toString();
        assertFalse(wire.contains("{asset.path}"), wire);
        assertFalse(wire.contains("[default]"), wire);
        assertFalse(wire.contains("path"), wire);
    }

    @Test
    void defaultsAreOnTrueCountAndSummaryTrueIconFalseAndTheLabelIsTheKey() {
        KindDisplay d = KindDisplay.of("pad", json("{\"comms\":{\"path\":\"{asset.path}/Comms\"},"
            + "\"kpis\":[{\"key\":\"flow\",\"path\":\"{asset.path}/Flow\"}],\"alarms\":{\"path\":\"{asset.path}\"}}"));
        assertTrue(d.comms());
        assertEquals(new KindDisplay.Kpi("flow", "flow", "", false, true), d.kpis().get(0));
        assertTrue(d.alarmsOn() && d.alarmsCount() && d.alarmsSummary());
        assertEquals("", d.link());
    }

    @Test
    void anEmptyOrSwitchedOffSetupShowsNothing() {
        assertFalse(KindDisplay.of("pad", new JsonObject()).showsAnything());
        KindDisplay off = KindDisplay.of("pad", json("{\"comms\":{\"path\":\"{asset.path}/Comms\",\"on\":false},"
            + "\"kpis\":[{\"key\":\"flow\",\"path\":\"{asset.path}/Flow\",\"on\":false}]}"));
        assertFalse(off.comms());
        assertFalse(off.showsAnything());
        // Malformed parts are skipped, never thrown on: the browser still draws the rest.
        KindDisplay odd = KindDisplay.of("pad", json("{\"comms\":\"x\",\"kpis\":[1,{\"key\":\"a\"}],\"alarms\":7}"));
        assertFalse(odd.comms());
        assertEquals(0, odd.kpis().size());
        assertFalse(odd.alarmsOn());
    }
}
