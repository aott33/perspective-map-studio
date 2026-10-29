package com.aoindustrial.perspective.mapstudio.common.contract;

import static com.aoindustrial.perspective.mapstudio.common.contract.KindFixtures.PAD_SETUP;
import static com.aoindustrial.perspective.mapstudio.common.contract.KindFixtures.json;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
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
        // No tag path: the comms and KPI paths stay on the Gateway. The popup view's templates (epic 3
        // entry 8) are on the wire as stored: a template resolves only with the item's base path.
        assertFalse(wire.contains("[default]"), wire);
        assertFalse(wire.contains("/Comms"), wire);
        assertTrue(d.hasPopupView());
        assertEquals("{\"path\":\"Popups/PadDetails\",\"params\":{\"padName\":\"{item.name}\",\"tagPath\":\"{asset.path}\","
            + "\"area\":\"Mesa\",\"pressure\":\"{asset.path}/Pressure\"}}", d.popupView().toString());
        assertEquals(d.popupView(), d.toJson().getAsJsonObject("popupView"));
    }

    @Test
    void aPopupViewNeedsAPathAndKeepsOnlyTextParams() {
        // Epic 3 entry 8: no path (or a blank one) means the default popup; a param that is not text is dropped.
        assertFalse(KindDisplay.of("pad", json("{\"popupView\":{\"path\":\"\",\"params\":{\"a\":\"b\"}}}")).hasPopupView());
        assertFalse(KindDisplay.of("pad", json("{\"popupView\":{\"params\":{\"a\":\"b\"}}}")).hasPopupView());
        assertNull(KindDisplay.of("pad", json("{\"link\":\"/pad/{item.name}\"}")).popupView());
        KindDisplay d = KindDisplay.of("pad", json("{\"popupView\":{\"path\":\"Popups/X\",\"params\":{\"a\":\"b\",\"n\":1}}}"));
        assertEquals("{\"path\":\"Popups/X\",\"params\":{\"a\":\"b\"}}", d.popupView().toString());
        assertFalse(d.showsAnything(), "a popup view alone shows no default part");
        assertFalse(KindDisplay.of("pad", json("{\"popupView\":{\"path\":\"Popups/X\"}}")).toJson().getAsJsonObject("popupView")
            .getAsJsonObject("params").has("a"));
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

    @Test
    void theStyleRuleAndTheAreaTintsProjectWithoutAPath() {
        // The fixture's States rule names {asset.path}/State: the display says "tag" and lists the cases.
        KindDisplay d = KindDisplay.of("pad", json(PAD_SETUP), KindFixtures.PAD);
        assertEquals("{\"type\":\"states\",\"source\":\"tag\",\"cases\":[{\"label\":\"running\",\"preset\":\"normal\"},"
            + "{\"label\":\"stopped\",\"preset\":\"fault\"}]}", d.styleRule().toString());
        String wire = d.toJson().toString();
        assertTrue(wire.contains("\"styleRule\""));
        assertFalse(wire.contains("State"), wire);
        // The rule's source path stays on the Gateway; the popup view's templates are on the wire (entry 8).
        assertFalse(d.styleRule().toString().contains("asset.path"), wire);
        assertFalse(d.toJson().has("areaTints"));
        KindDisplay tints = KindDisplay.of("geofence", json("{\"areaTints\":{\"property\":\"operator\",\"tints\":["
            + "{\"category\":\"North\",\"tint\":\"tint-1\"}]}}"), KindFixtures.GEOFENCE);
        assertEquals("{\"property\":\"operator\",\"tints\":[{\"category\":\"North\",\"tint\":\"tint-1\"}]}",
            tints.toJson().getAsJsonObject("areaTints").toString());
        assertFalse(tints.toJson().has("styleRule"));
        assertFalse(tints.showsAnything(), "tints alone draw no popup part");
        assertNull(KindDisplay.of("pad", json("{\"styleRule\":7}")).styleRule());
    }
}
