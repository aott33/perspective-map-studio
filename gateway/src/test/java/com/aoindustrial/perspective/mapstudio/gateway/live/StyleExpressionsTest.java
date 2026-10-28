package com.aoindustrial.perspective.mapstudio.gateway.live;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import com.aoindustrial.perspective.mapstudio.common.contract.InvalidValue;
import com.aoindustrial.perspective.mapstudio.common.contract.Kind;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.TestKinds;

/**
 * Epic 3 entry 1: Ignition's expression parser run by module code against one bound value, on the
 * SDK's own jars (the live 8.3.10 run is docs/platform-checks.md, "Epic 3 entry 1").
 */
class StyleExpressionsTest {

    static final Kind PAD = TestKinds.KINDS.get(0);
    static final Kind LINE = TestKinds.KINDS.get(1);

    @Test
    void anIfOnTheValueGivesAPresetAndNoProblem() {
        StyleExpressions.Compiled c = StyleExpressions.compile("if({value} > 600, 'warning', 'normal')", PAD);
        assertEquals(new StyleExpressions.Result("warning", null), c.run(700.0));
        assertEquals(new StyleExpressions.Result("normal", null), c.run(12));
        assertEquals(new StyleExpressions.Result("normal", null), c.run("5"), "text is coerced by the expression");
        StyleExpressions.Compiled cases = StyleExpressions.compile(
            "case({value}, 1, 'attention', 2, 'warning', 3, 'fault', 'normal')", PAD);
        assertEquals("attention", cases.run(1).preset());
        assertEquals("fault", cases.run(3L).preset());
        assertEquals("normal", cases.run(9).preset());
        assertEquals("dashed", StyleExpressions.compile("if({value}, 'dashed', 'solid')", LINE).run(true).preset());
    }

    @Test
    void aResultThatIsNotAPresetOfTheKindOrAFailureDrawsNormalWithAProblem() {
        StyleExpressions.Result dashed = StyleExpressions.compile("'dashed'", PAD).run(1);
        assertEquals("normal", dashed.preset());
        assertTrue(dashed.problem().startsWith("the expression gave \"dashed\", not a preset (normal, attention"), dashed.problem());
        StyleExpressions.Result number = StyleExpressions.compile("{value} * 2", PAD).run(2);
        assertEquals("normal", number.preset());
        assertEquals("the expression gave \"4\", not a preset (normal, attention, warning, fault, dimmed)", number.problem());
        StyleExpressions.Result nul = StyleExpressions.compile("if({value} > 1, 'fault', null)", PAD).run(0);
        assertEquals("normal", nul.preset());
        assertNotNull(nul.problem());
        // A value the expression cannot work with: a problem in words, never an exception out.
        StyleExpressions.Result bad = StyleExpressions.compile("if({value} > 1, 'fault', 'normal')", PAD).run("abc");
        assertEquals("normal", bad.preset());
        assertNotNull(bad.problem());
    }

    @Test
    void parseErrorsOtherReferencesAndDeniedFunctionsAreRefusedAtCompile() {
        assertTrue(StyleExpressions.check("if(", PAD).startsWith("the expression could not be read: Syntax Error"));
        assertEquals("the expression could not be read: a style rule may reference {value} only, not {pressure}",
            StyleExpressions.check("{pressure} > 1", PAD));
        assertEquals("the expression could not be read: the function tag() may not be used in a style rule; it reaches"
            + " outside the value", StyleExpressions.check("tag('[default]x')", PAD));
        assertTrue(StyleExpressions.check("runScript('1')", PAD).contains("runScript()"));
        assertTrue(StyleExpressions.check("hasChanged({value})", PAD).contains("hasChanged()"));
        assertNull(StyleExpressions.check("if({VALUE} > 1, 'fault', 'normal')", PAD), "the reference is not case sensitive");
        assertThrows(InvalidValue.class, () -> StyleExpressions.compile("nope(", PAD));
    }
}
