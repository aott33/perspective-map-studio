package com.aoindustrial.perspective.mapstudio.common.contract;

import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * The closed style lists of a kind setup (AD-16, epic 2 story 9, owner decisions
 * 2026-10-27): a style rule names presets, area tints name tints, and neither ever
 * holds a colour code; epic-viewing maps the names to theme tokens.
 *
 * <ul>
 * <li>{@link #PRESETS}: {@code normal}, {@code attention}, {@code warning}, {@code fault},
 *     {@code dimmed}, for every kind;</li>
 * <li>{@link #LINE_PRESETS}: {@code solid}, {@code dashed}, {@code dotted}, for line kinds
 *     only (weight by pipe size is not a preset in 0.2.0);</li>
 * <li>{@link #TINTS}: {@code tint-1} to {@code tint-6}, no hue promised before ER-27.</li>
 * </ul>
 */
public final class StylePresets {

    public static final List<String> PRESETS = List.of("normal", "attention", "warning", "fault", "dimmed");
    public static final List<String> LINE_PRESETS = List.of("solid", "dashed", "dotted");
    public static final List<String> TINTS = List.of("tint-1", "tint-2", "tint-3", "tint-4", "tint-5", "tint-6");

    /** A few CSS colour words, only to say "that is a colour" in the message. */
    private static final Set<String> COLOUR_WORDS = Set.of("red", "green", "blue", "yellow", "orange", "purple",
        "black", "white", "grey", "gray", "pink", "brown", "cyan", "magenta", "transparent");

    private StylePresets() {
    }

    /** The presets a kind of this geometry may use. */
    public static List<String> presetsFor(Kind kind) {
        if ("line".equals(kind.geometry())) {
            return List.of("normal", "attention", "warning", "fault", "dimmed", "solid", "dashed", "dotted");
        }
        return PRESETS;
    }

    /**
     * @throws InvalidValue when {@code preset} is not one of the kind's presets
     */
    static void checkPreset(String preset, Kind kind) {
        List<String> allowed = presetsFor(kind);
        if (allowed.contains(preset)) {
            return;
        }
        if (LINE_PRESETS.contains(preset)) {
            throw new InvalidValue(preset + " is a line preset and " + kind.id() + " is a point kind. Pick a preset: "
                + String.join(", ", allowed) + ".");
        }
        throw new InvalidValue(what(preset, "preset") + " Pick a preset: " + String.join(", ", allowed)
            + "; colour codes are not accepted.");
    }

    /**
     * @throws InvalidValue when {@code tint} is not one of {@link #TINTS}
     */
    static void checkTint(String tint) {
        if (!TINTS.contains(tint)) {
            throw new InvalidValue(what(tint, "tint") + " Pick a tint: " + String.join(", ", TINTS)
                + "; colour codes are not accepted.");
        }
    }

    /** True when {@code name} is a preset of the kind (what a rule may give, epic 3 entry 1). */
    public static boolean isPreset(String name, Kind kind) {
        return name != null && presetsFor(kind).contains(name);
    }

    /** True for text that reads as a colour: #rgb, #rrggbb, rgb(), hsl() or a colour word. */
    public static boolean looksLikeColour(String s) {
        String t = s.trim().toLowerCase(Locale.ROOT);
        return t.startsWith("#") || t.startsWith("rgb") || t.startsWith("hsl") || COLOUR_WORDS.contains(t);
    }

    private static String what(String value, String noun) {
        return Rows.echo(value) + (looksLikeColour(value) ? " is a colour code, not a " : " is not a ") + noun + ".";
    }
}
