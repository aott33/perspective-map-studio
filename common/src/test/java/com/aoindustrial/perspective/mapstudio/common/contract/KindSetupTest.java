package com.aoindustrial.perspective.mapstudio.common.contract;

import static com.aoindustrial.perspective.mapstudio.common.contract.KindFixtures.BANDS;
import static com.aoindustrial.perspective.mapstudio.common.contract.KindFixtures.GEOFENCE;
import static com.aoindustrial.perspective.mapstudio.common.contract.KindFixtures.LINE;
import static com.aoindustrial.perspective.mapstudio.common.contract.KindFixtures.PAD;
import static com.aoindustrial.perspective.mapstudio.common.contract.KindFixtures.PAD_SETUP;
import static com.aoindustrial.perspective.mapstudio.common.contract.KindFixtures.json;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonObject;

/** The kind setup schema (epic 2 story 9): every part, the closed lists, and the I/O matrix's refusals. */
class KindSetupTest {

    @Test
    void theFullSetupIsAcceptedUnchanged() {
        JsonObject sent = json(PAD_SETUP);
        assertEquals(sent, KindSetup.parse(sent, PAD, false));
        JsonObject bands = json(PAD_SETUP);
        bands.add("styleRule", json(BANDS));
        assertEquals(bands, KindSetup.parse(bands, PAD, false));
        assertEquals(json("{}"), KindSetup.parse(json("{}"), PAD, false));
        JsonObject expression = json("{\"styleRule\":{\"type\":\"expression\",\"expression\":\"{pressure} > 900\"}}");
        assertEquals(expression, KindSetup.parse(expression, PAD, false));
    }

    @Test
    void areaTintsAreForAreaKindsOnly() {
        JsonObject tints = json("{\"areaTints\":{\"property\":\"operator\",\"tints\":["
            + "{\"category\":\"North\",\"tint\":\"tint-1\"},{\"category\":\"South\",\"tint\":\"tint-6\"}]}}");
        assertEquals(tints, KindSetup.parse(tints, GEOFENCE, false));
        assertTrue(refused(tints.toString(), LINE).startsWith("areaTints: line is not an area kind"));
        assertTrue(refused("{\"areaTints\":{\"property\":\"operator\",\"tints\":[{\"category\":\"N\",\"tint\":\"#00ff00\"}]}}",
            GEOFENCE).equals("areaTints.tints[0].tint: #00ff00 is a colour code, not a tint. Pick a tint: tint-1, tint-2,"
            + " tint-3, tint-4, tint-5, tint-6; colour codes are not accepted."));
        assertTrue(refused("{\"areaTints\":{\"property\":\"operator\",\"tints\":[{\"category\":\"N\",\"tint\":\"sand\"}]}}",
            GEOFENCE).contains("sand is not a tint"));
        assertTrue(refused("{\"areaTints\":{\"property\":\"zone\",\"tints\":[{\"category\":\"N\",\"tint\":\"tint-1\"}]}}",
            GEOFENCE).contains("zone is not a form field"));
        assertTrue(refused("{\"areaTints\":{\"property\":\"operator\",\"tints\":[{\"category\":\"N\",\"tint\":\"tint-1\"},"
            + "{\"category\":\"N\",\"tint\":\"tint-2\"}]}}", GEOFENCE).contains("has another tint"));
    }

    @Test
    void aPresetOutsideTheListOrAColourCodeIsRefused() {
        assertEquals("styleRule.cases[0].preset: red is a colour code, not a preset. Pick a preset: normal, attention,"
            + " warning, fault, dimmed; colour codes are not accepted.", refused(rule("states",
            "[{\"value\":1,\"preset\":\"red\"}]"), PAD));
        assertTrue(refused(rule("states", "[{\"value\":1,\"preset\":\"#ff0000\"}]"), PAD)
            .contains("#ff0000 is a colour code, not a preset"));
        assertTrue(refused(rule("states", "[{\"value\":1,\"preset\":\"loud\"}]"), PAD).contains("loud is not a preset"));
        assertTrue(refused(rule("states", "[{\"value\":1,\"preset\":\"dashed\"}]"), PAD)
            .contains("dashed is a line preset and pad is a point kind"));
        JsonObject linePreset = json(rule("states", "[{\"value\":1,\"preset\":\"dashed\"},{\"value\":2,\"preset\":\"dotted\"}]"));
        assertEquals(linePreset, KindSetup.parse(linePreset, LINE, false));
    }

    @Test
    void aRuleMustMatchItsType() {
        assertTrue(refused(rule("bands", "[{\"min\":900,\"max\":null,\"preset\":\"warning\"},"
            + "{\"min\":null,\"max\":900,\"preset\":\"normal\"}]"), PAD).contains("max: only the last band"));
        assertTrue(refused(rule("bands", "[{\"min\":0,\"max\":500,\"preset\":\"normal\"},"
            + "{\"min\":400,\"max\":null,\"preset\":\"warning\"}]"), PAD).contains("do not overlap"));
        assertTrue(refused(rule("bands", "[{\"min\":5,\"max\":5,\"preset\":\"normal\"}]"), PAD)
            .contains("min must be below max"));
        assertTrue(refused("{\"kpis\":[{\"key\":\"pressure\",\"path\":\"{asset.path}/P\"}],\"styleRule\":"
            + "{\"source\":{\"kpi\":\"pressure\"},\"type\":\"expression\",\"expression\":\"x\",\"cases\":[]}}", PAD)
            .contains("an expression rule has no cases"));
        assertTrue(refused("{\"styleRule\":{\"type\":\"expression\",\"expression\":\" \"}}", PAD)
            .contains("must not be empty"));
        assertTrue(refused(rule("states", "[{\"value\":\"a\",\"preset\":\"normal\"},{\"value\":\"a\","
            + "\"preset\":\"fault\"}]"), PAD).contains("has another case"));
        assertTrue(refused("{\"styleRule\":{\"source\":{\"kpi\":\"flow\"},\"type\":\"states\",\"cases\":"
            + "[{\"value\":1,\"preset\":\"normal\"}]}}", PAD).contains("flow is not the key of one of this setup's kpis"));
        assertTrue(refused("{\"styleRule\":{\"type\":\"shades\"}}", PAD).contains("type must be states, bands"));
    }

    @Test
    void kpisLinkAndPopupViewAreChecked() {
        String five = "{\"kpis\":[" + String.join(",", java.util.Collections.nCopies(5,
            "{\"key\":\"k\",\"path\":\"{asset.path}/K\"}")) + "]}";
        assertTrue(refused(five, PAD).contains("at most 4"));
        assertTrue(refused("{\"kpis\":[{\"key\":\"a\",\"path\":\"{asset.path}/A\",\"icon\":true},"
            + "{\"key\":\"b\",\"path\":\"{asset.path}/B\",\"icon\":true}]}", PAD).contains("at most one KPI"));
        assertTrue(refused("{\"kpis\":[{\"key\":\"a\",\"path\":\"{asset.path}/A\"},{\"key\":\"a\","
            + "\"path\":\"{asset.path}/B\"}]}", PAD).contains("keys are unique"));
        assertTrue(refused("{\"kpis\":[{\"key\":\"a\",\"path\":\"Mesa/A\"}]}", PAD).startsWith("kpis[0].path: Mesa/A is"
            + " not a tag path"));
        assertTrue(refused("{\"link\":\"/pad/{item.foo}\"}", PAD).startsWith("link: {item.foo} is not a placeholder"));
        for (String link : new String[] {"javascript:alert(1)", "https://evil.example/{item.name}", "//evil.example/x",
            "/\\\\evil.example/x", "pad/{item.name}"}) {
            assertTrue(refused("{\"link\":\"" + link + "\"}", PAD).startsWith("link is a Perspective page path"),
                link);
        }
        assertTrue(refused("{\"popupView\":{\"path\":\"Popups/P\",\"params\":{\"mapItem\":\"x\"}}}", PAD)
            .startsWith("popupView.params.mapItem: the popup view always receives"));
        assertTrue(refused("{\"popupView\":{\"path\":\"Popups/P\",\"params\":{\"p\":\"P-{item.name}\"}}}", PAD)
            .contains("mixes text and placeholders"));
        assertTrue(refused("{\"popupView\":{\"path\":\"Popups/P\",\"params\":{\"p\":\"{item.foo}\"}}}", PAD)
            .startsWith("popupView.params.p: {item.foo} is not a placeholder"));
        assertTrue(refused("{\"popupView\":{\"params\":{}}}", PAD).contains("needs a view path"));
        assertTrue(refused("{\"colour\":\"red\"}", PAD).startsWith("colour is not a part of the kind setup"));
        assertTrue(refused("{\"comms\":{\"path\":\"{asset.path}/Comms\",\"colour\":\"red\"}}", PAD)
            .contains("colour is not a key here"));
    }

    @Test
    void anOverrideTakesFullTagPathsOnly() {
        JsonObject full = json("{\"kpis\":[{\"key\":\"p\",\"path\":\"[default]Mesa/P12/Pressure\"}],\"styleRule\":"
            + "{\"source\":{\"kpi\":\"pressure\"},\"type\":\"states\",\"cases\":[{\"value\":1,\"preset\":\"attention\"}]}}");
        assertEquals(full, KindSetup.parse(full, PAD, true));
        InvalidValue ex = assertThrows(InvalidValue.class, () -> KindSetup.parse(json("{\"kpis\":[{\"key\":\"p\","
            + "\"path\":\"{asset.path}/X\"}]}"), PAD, true));
        assertTrue(ex.getMessage().startsWith("kpis[0].path: an override's tag path is a full path"), ex.getMessage());
        assertTrue(assertThrows(InvalidValue.class, () -> KindSetup.parse(json("{\"icon\":\"x\"}"), PAD, true))
            .getMessage().startsWith("icon is not a part of overrides"));
    }

    private static String rule(String type, String cases) {
        return "{\"styleRule\":{\"source\":{\"path\":\"{asset.path}/State\"},\"type\":\"" + type + "\",\"cases\":"
            + cases + "}}";
    }

    private static String refused(String setup, Kind kind) {
        return assertThrows(InvalidValue.class, () -> KindSetup.parse(json(setup), kind, false)).getMessage();
    }
}
