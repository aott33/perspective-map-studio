package com.aoindustrial.perspective.mapstudio.common.contract;

import static com.aoindustrial.perspective.mapstudio.common.contract.KindFixtures.LINE;
import static com.aoindustrial.perspective.mapstudio.common.contract.KindFixtures.PAD;
import static com.aoindustrial.perspective.mapstudio.common.contract.KindFixtures.json;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.gson.JsonNull;
import com.inductiveautomation.ignition.common.gson.JsonPrimitive;

/** Epic 3 entry 1: the pure States and Bands evaluation and the path-free display of a rule. */
class StyleRuleTest {

    static final String STATES = "{\"source\":{\"path\":\"{asset.path}/Status\"},\"type\":\"states\",\"cases\":["
        + "{\"value\":1,\"preset\":\"attention\"},{\"value\":2,\"preset\":\"warning\"},{\"value\":\"off\",\"preset\":\"dimmed\"},"
        + "{\"value\":true,\"preset\":\"fault\"}]}";
    static final String BANDS = "{\"source\":{\"kpi\":\"flow\"},\"type\":\"bands\",\"cases\":["
        + "{\"min\":null,\"max\":50,\"preset\":\"normal\"},{\"min\":50,\"max\":200,\"preset\":\"attention\"},"
        + "{\"min\":200,\"max\":null,\"preset\":\"fault\"}]}";

    @Test
    void statesMatchNumbersTextAndBooleansAndNoCaseIsNormal() {
        StyleRule rule = StyleRule.read(json(STATES));
        assertEquals("states", rule.type());
        assertEquals("{asset.path}/Status", rule.path());
        assertNull(rule.kpi());
        assertEquals("attention", rule.preset(new JsonPrimitive(1)).preset());
        assertEquals("warning", rule.preset(new JsonPrimitive(2.0)).preset());
        assertEquals("warning", rule.preset(new JsonPrimitive("2")).preset(), "a text holding the number");
        assertEquals("dimmed", rule.preset(new JsonPrimitive("off")).preset());
        assertEquals("fault", rule.preset(new JsonPrimitive(true)).preset());
        assertEquals("normal", rule.preset(new JsonPrimitive(7)).preset());
        assertEquals("normal", rule.preset(JsonNull.INSTANCE).preset());
        assertEquals("normal", rule.preset(null).preset());
        assertNull(rule.preset(new JsonPrimitive(7)).problem());
    }

    @Test
    void bandsHoldMinInclusiveMaxExclusiveWithOpenEndsAndANonNumberIsAProblem() {
        StyleRule rule = StyleRule.read(json(BANDS));
        assertEquals("flow", rule.kpi());
        assertEquals("normal", rule.preset(new JsonPrimitive(-3)).preset());
        assertEquals("normal", rule.preset(new JsonPrimitive(49.9)).preset());
        assertEquals("attention", rule.preset(new JsonPrimitive(50)).preset());
        assertEquals("attention", rule.preset(new JsonPrimitive("120")).preset());
        assertEquals("fault", rule.preset(new JsonPrimitive(200)).preset());
        assertEquals("fault", rule.preset(new JsonPrimitive(1e9)).preset());
        StyleRule.Outcome text = rule.preset(new JsonPrimitive("open"));
        assertEquals("normal", text.preset());
        assertEquals("the value is not a number, so no band holds it", text.problem());
        assertNull(rule.preset(JsonNull.INSTANCE).problem(), "no value yet is stale, not a problem");
        // A gap between bands: normal.
        StyleRule gap = StyleRule.read(json("{\"source\":{\"kpi\":\"flow\"},\"type\":\"bands\",\"cases\":["
            + "{\"min\":0,\"max\":10,\"preset\":\"attention\"},{\"min\":20,\"max\":30,\"preset\":\"fault\"}]}"));
        assertEquals("normal", gap.preset(new JsonPrimitive(15)).preset());
    }

    @Test
    void theDisplayCarriesNoPathAndLabelsEachCase() {
        String states = StyleRule.read(json(STATES)).display(PAD).toString();
        assertEquals("{\"type\":\"states\",\"source\":\"tag\",\"cases\":[{\"label\":\"1\",\"preset\":\"attention\"},"
            + "{\"label\":\"2\",\"preset\":\"warning\"},{\"label\":\"off\",\"preset\":\"dimmed\"},{\"label\":\"true\",\"preset\":\"fault\"}]}",
            states);
        assertFalse(states.contains("asset.path"));
        assertEquals("{\"type\":\"bands\",\"source\":\"kpi:flow\",\"cases\":[{\"label\":\"below 50\",\"preset\":\"normal\"},"
            + "{\"label\":\"50 to 200\",\"preset\":\"attention\"},{\"label\":\"200 and above\",\"preset\":\"fault\"}]}",
            StyleRule.read(json(BANDS)).display(LINE).toString());
        String expression = StyleRule.read(json("{\"source\":{\"path\":\"[default]Mesa/P14/Pressure\"},\"type\":\"expression\","
            + "\"expression\":\"if({value} > 600, 'warning', if({value} < 0, \\\"dashed\\\", 'normal'))\"}")).display(PAD).toString();
        assertEquals("{\"type\":\"expression\",\"source\":\"tag\",\"cases\":[{\"label\":\"warning\",\"preset\":\"warning\"},"
            + "{\"label\":\"normal\",\"preset\":\"normal\"}]}", expression, "dashed is not a point preset; the text stays out");
        assertFalse(expression.contains("{value}"));
        assertEquals("{\"type\":\"instruments\",\"source\":\"instruments\",\"cases\":[]}",
            StyleRule.read(json("{\"source\":{\"instruments\":\"worst\"}}")).display(LINE).toString());
    }

    @Test
    void anExpressionRuleEvaluatesNothingHereAndMalformedRulesReadAsNull() {
        StyleRule expression = StyleRule.read(json("{\"type\":\"expression\",\"expression\":\"'fault'\"}"));
        assertEquals("'fault'", expression.expression());
        assertNull(expression.preset(new JsonPrimitive(1)));
        assertTrue(StyleRule.read(json("{\"source\":{\"instruments\":\"worst\"}}")).instruments());
        assertNull(StyleRule.read(null));
        assertNull(StyleRule.read(json("{\"source\":{\"kpi\":\"x\"}}")));
        assertNull(StyleRule.read(json("{\"type\":\"other\"}")));
        assertEquals(List.of("fault", "solid"), StyleRule.presetsIn("case({value}, 1, 'fault', 2, 'solid', 'green')", LINE));
        assertEquals(List.of("fault"), StyleRule.presetsIn("case({value}, 1, 'fault', 2, 'solid', 'green')", PAD));
    }
}
