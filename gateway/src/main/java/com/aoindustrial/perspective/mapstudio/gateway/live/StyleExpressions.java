package com.aoindustrial.perspective.mapstudio.gateway.live;

import java.util.Locale;
import java.util.Map;
import java.util.Set;

import com.inductiveautomation.ignition.common.expressions.ConstantExpression;
import com.inductiveautomation.ignition.common.expressions.DefaultFunctionFactory;
import com.inductiveautomation.ignition.common.expressions.Expression;
import com.inductiveautomation.ignition.common.expressions.ExpressionParseContext;
import com.inductiveautomation.ignition.common.expressions.FunctionFactory;
import com.inductiveautomation.ignition.common.expressions.functions.Function;
import com.inductiveautomation.ignition.common.expressions.parsing.ELParserHarness;
import com.inductiveautomation.ignition.common.model.values.QualifiedValue;
import com.inductiveautomation.ignition.common.model.values.QualityCode;

import com.aoindustrial.perspective.mapstudio.common.contract.InvalidValue;
import com.aoindustrial.perspective.mapstudio.common.contract.Kind;
import com.aoindustrial.perspective.mapstudio.common.contract.StylePresets;
import com.aoindustrial.perspective.mapstudio.common.contract.StyleRule;

/**
 * A style rule's expression (AD-16, epic 3 entry 1), in Ignition's own expression language,
 * evaluated by module code (checked live on 8.3.10, docs/platform-checks.md, "Epic 3 entry 1"):
 * the SDK's {@code ELParserHarness} parses the text once, with a parse context that binds the one
 * reference {@code {value}} (the rule's source value, a {@code ConstantExpression}) and offers the
 * SDK's default functions less the ones that reach outside the value ({@link #DENIED}: {@code tag}
 * reads tags, {@code runScript} runs scripts, {@code hasChanged} keeps state), and
 * {@code Expression.execute()} runs it per source delivery.
 *
 * <ul>
 * <li>A text that does not parse (a syntax error, a reference other than {@code {value}}, a denied
 *     or unknown function) is refused at save with the parser's reason ({@link #check}), so a stored
 *     rule always parses.</li>
 * <li>At run time the result must be a preset name of the kind; an exception, a bad quality or any
 *     other result draws {@code normal} and the item reports a {@code style} problem in words.</li>
 * <li>One compiled expression serves every map item of the rule, run on the live thread only
 *     ({@link Compiled#run} is synchronized: the bound value is set and the expression executed as one).</li>
 * </ul>
 */
public final class StyleExpressions {

    /** The default functions a style expression may not use (the parser hands their names in lower case). */
    public static final Map<String, String> DENIED = Map.of("tag", "tag", "runscript", "runScript", "haschanged", "hasChanged");
    /** The one reference an expression may hold. */
    public static final String VALUE = "value";

    /** What one run gives: the preset, or {@code normal} with a problem in words. */
    public record Result(String preset, String problem) {
    }

    /** A parsed expression, run for one source value at a time. */
    public static final class Compiled {
        private final Expression expression;
        private final ConstantExpression value;
        private final Kind kind;

        private Compiled(Expression expression, ConstantExpression value, Kind kind) {
            this.expression = expression;
            this.value = value;
            this.kind = kind;
        }

        /** Run the expression for the source value (a Java value as the tag system delivered it). */
        public synchronized Result run(Object sourceValue) {
            value.setValue(sourceValue);
            value.setQuality(QualityCode.Good);
            QualifiedValue out;
            try {
                out = expression.execute();
            } catch (Exception ex) {
                return new Result(StyleRule.NORMAL, "the expression failed: " + reason(ex));
            }
            if (out == null) {
                return new Result(StyleRule.NORMAL, "the expression gave nothing");
            }
            if (out.getQuality() != null && !out.getQuality().isGood()) {
                return new Result(StyleRule.NORMAL, "the expression gave quality " + out.getQuality().getName());
            }
            Object v = out.getValue();
            String name = v == null ? null : String.valueOf(v).trim();
            if (StylePresets.isPreset(name, kind)) {
                return new Result(name, null);
            }
            return new Result(StyleRule.NORMAL, "the expression gave " + (v == null ? "null" : "\"" + name + "\"")
                + ", not a preset (" + String.join(", ", StylePresets.presetsFor(kind)) + ")");
        }
    }

    private static final FunctionFactory FUNCTIONS = new FunctionFactory() {
        private final FunctionFactory all = DefaultFunctionFactory.getSharedInstance();

        @Override
        public Function getFunction(String name) {
            String denied = name == null ? null : DENIED.get(name.toLowerCase(Locale.ROOT));
            if (denied != null) {
                throw new IllegalArgumentException("the function " + denied + "() may not be used in a style rule; it reaches"
                    + " outside the value");
            }
            return all.getFunction(name);
        }

        @Override
        public Set<String> getFunctionNames() {
            return all.getFunctionNames();
        }

        @Override
        public Set<String> getCategories() {
            return all.getCategories();
        }

        @Override
        public Set<String> getFunctionsInCategory(String category) {
            return all.getFunctionsInCategory(category);
        }
    };

    private StyleExpressions() {
    }

    /**
     * Parse an expression for a kind.
     *
     * @throws InvalidValue with the parser's reason when it cannot be read
     */
    public static Compiled compile(String text, Kind kind) {
        ConstantExpression value = new ConstantExpression(null);
        ExpressionParseContext context = new ExpressionParseContext() {
            @Override
            public Expression createBoundExpression(String reference) {
                if (reference != null && VALUE.equalsIgnoreCase(reference.trim())) {
                    return value;
                }
                throw new IllegalArgumentException("a style rule may reference {value} only, not {" + reference + "}");
            }

            @Override
            public FunctionFactory getFunctionFactory() {
                return FUNCTIONS;
            }
        };
        Expression expression;
        try {
            expression = new ELParserHarness().parse(text, context);
        } catch (Exception ex) {
            throw new InvalidValue("the expression could not be read: " + reason(ex));
        }
        if (expression == null) {
            throw new InvalidValue("the expression could not be read.");
        }
        return new Compiled(expression, value, kind);
    }

    /**
     * The reason an expression cannot be used in a style rule of {@code kind}, or null when it parses
     * (the write path's check, docs/kind-setup.md).
     */
    public static String check(String text, Kind kind) {
        try {
            compile(text, kind);
            return null;
        } catch (InvalidValue ex) {
            return ex.getMessage();
        }
    }

    /** An exception's message in one line (the parser's messages say where), or its class name. */
    private static String reason(Throwable ex) {
        Throwable t = ex;
        while (t.getMessage() == null && t.getCause() != null) {
            t = t.getCause();
        }
        String m = t.getMessage();
        return m == null || m.isBlank() ? ex.getClass().getSimpleName() : m.replaceAll("\\s+", " ").trim();
    }
}
