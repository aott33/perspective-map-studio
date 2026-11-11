package com.aoindustrial.perspective.mapstudio.common.contract;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;

/**
 * The closed placeholder list of a kind setup (AD-7, AD-16, epic 2 story 9) and the one
 * fill function, so the write service validates with the same rules epic-viewing fills
 * with (the browser has a mirror, {@code web/typescript/placeholders.ts}, tested with the
 * same vectors).
 *
 * <p>Placeholders: {@code {item.id}}, {@code {item.name}}, {@code {asset.id}},
 * {@code {asset.path}} and {@code {item.properties.X}}, X a form field key of the kind.
 * Where each may stand:
 * <ul>
 * <li>a popup link and the setup's alarm page: text with any number of placeholders
 *     ({@link #checkTemplate});</li>
 * <li>a popup view param: a literal (no braces), exactly one placeholder, or
 *     {@code {asset.path}/<suffix>} (owner, 2026-10-27); never named {@code mapItem}
 *     ({@link #checkParam});</li>
 * <li>a tag path: {@code {asset.path}}, {@code {asset.path}/<suffix>} or a full
 *     {@code [provider]path}; in an item override a full path only ({@link #checkTagPath}).</li>
 * </ul>
 */
public final class Placeholders {

    public static final String ITEM_ID = "{item.id}";
    public static final String ITEM_NAME = "{item.name}";
    public static final String ASSET_ID = "{asset.id}";
    public static final String ASSET_PATH = "{asset.path}";
    /** {@code {item.properties.X}}: this prefix, a form field key, then "}". */
    public static final String PROPERTY_PREFIX = "{item.properties.";

    /** The fixed placeholders, in the order messages list them. */
    public static final List<String> FIXED = List.of(ITEM_ID, ITEM_NAME, ASSET_ID, ASSET_PATH);

    /** The name the popup view's own item parameter takes; no author param may use it. */
    public static final String MAP_ITEM_PARAM = "mapItem";

    static final String KNOWN = "{item.id}, {item.name}, {asset.id}, {asset.path} or {item.properties.<field key>}";

    /** What a placeholder is filled from: one map item and its asset (null when it has none). */
    public record ItemView(String itemId, String itemName, String assetId, String assetPath, JsonObject properties) {
    }

    private Placeholders() {
    }

    /**
     * The placeholders of {@code text}, in order; each is checked against the closed list and
     * {@code fieldKeys} (the kind's form field keys; null where no kind is known, as in the
     * setup's alarm page, accepts any key).
     *
     * @throws InvalidValue an unknown placeholder, or a brace with no partner
     */
    static List<String> placeholders(String text, Set<String> fieldKeys) {
        List<String> out = new ArrayList<>();
        int i = 0;
        while (i < text.length()) {
            char c = text.charAt(i);
            if (c == '}') {
                throw new InvalidValue("a } has no {; braces only mark placeholders (" + KNOWN + ").");
            }
            if (c != '{') {
                i++;
                continue;
            }
            int end = text.indexOf('}', i);
            int nextOpen = text.indexOf('{', i + 1);
            if (end < 0 || (nextOpen >= 0 && nextOpen < end)) {
                throw new InvalidValue("a { has no }; braces only mark placeholders (" + KNOWN + ").");
            }
            String p = text.substring(i, end + 1);
            if (!isKnown(p, fieldKeys)) {
                if (p.startsWith(PROPERTY_PREFIX)) {
                    throw new InvalidValue(Rows.echo(p) + " names a property that is not a form field of this kind.");
                }
                throw new InvalidValue(Rows.echo(p) + " is not a placeholder Map Studio knows; use " + KNOWN + ".");
            }
            out.add(p);
            i = end + 1;
        }
        return out;
    }

    private static boolean isKnown(String p, Set<String> fieldKeys) {
        if (FIXED.contains(p)) {
            return true;
        }
        if (p.startsWith(PROPERTY_PREFIX) && p.length() > PROPERTY_PREFIX.length() + 1) {
            String key = p.substring(PROPERTY_PREFIX.length(), p.length() - 1);
            return fieldKeys == null ? key.length() <= Rows.MAX_ID && !key.isBlank() : fieldKeys.contains(key);
        }
        return false;
    }

    /**
     * A popup link or alarm page: text with any number of known placeholders.
     *
     * @throws InvalidValue naming the problem
     */
    public static void checkTemplate(String text, Set<String> fieldKeys) {
        placeholders(text, fieldKeys);
    }

    /**
     * One popup view param: a literal with no braces, exactly one placeholder, or
     * {@code {asset.path}/<suffix>}; never named {@code mapItem}.
     *
     * @throws InvalidValue naming the param
     */
    public static void checkParam(String name, String value, Set<String> fieldKeys) {
        if (name == null || name.isBlank()) {
            throw new InvalidValue("(no name): a param needs a name.");
        }
        if (MAP_ITEM_PARAM.equals(name)) {
            throw new InvalidValue(MAP_ITEM_PARAM + ": the popup view always receives the map item as "
                + MAP_ITEM_PARAM + ", so no param may be named " + MAP_ITEM_PARAM + ".");
        }
        try {
            List<String> found = placeholders(value, fieldKeys);
            if (found.isEmpty() || (found.size() == 1 && found.get(0).equals(value))) {
                return;
            }
            // {asset.path}/ and a tag path: the suffix by the one tag path rule (TagPaths, entry 13a).
            if (found.size() == 1 && value.startsWith(ASSET_PATH + "/")) {
                TagPaths.Fault fault = TagPaths.fault(value);
                if (fault == null) {
                    return;
                }
                if (fault != TagPaths.Fault.NO_SUFFIX) {
                    throw new InvalidValue(faultWords(value, fault, true));
                }
            }
        } catch (InvalidValue ex) {
            throw new InvalidValue(Rows.echo(name) + ": " + ex.getMessage());
        }
        throw new InvalidValue(Rows.echo(name) + ": " + Rows.echo(value) + " mixes text and placeholders; a param is"
            + " a literal, exactly one placeholder, or {asset.path}/ and a tag path.");
    }

    /**
     * A stored tag path, by the one rule the lookups use ({@link TagPaths#fault}, entry 13a):
     * {@code {asset.path}} or {@code {asset.path}/<suffix>} (when {@code assetRelativeAllowed}), or a
     * full {@code [provider]path}; no empty part ({@code a//b}), no bracket after the provider, no
     * brace in a suffix.
     *
     * @throws InvalidValue naming the problem
     */
    public static void checkTagPath(String value, boolean assetRelativeAllowed) {
        if (value == null || value.isBlank()) {
            throw new InvalidValue("a tag path is needed.");
        }
        TagPaths.Fault fault = TagPaths.fault(value);
        // An override's full-path rule first: a path below the asset is told that once, whatever else is wrong with it.
        boolean belowAsset = value.equals(ASSET_PATH)
            || (value.startsWith(ASSET_PATH + "/") && fault != TagPaths.Fault.NO_SUFFIX && fault != TagPaths.Fault.TOO_LONG);
        if (belowAsset && !assetRelativeAllowed) {
            throw new InvalidValue("an override's tag path is a full path such as [default]Mesa/P12/Pressure, not "
                + Rows.echo(value) + ".");
        }
        if (fault != null) {
            throw new InvalidValue(faultWords(value, fault, assetRelativeAllowed));
        }
    }

    /** A fault of the rule in the words of a refused save; the browser says the same (itemOverrides.ts). */
    static String faultWords(String value, TagPaths.Fault fault, boolean assetRelativeAllowed) {
        String path = Rows.echo(value);
        return switch (fault) {
            case EMPTY -> "a tag path is needed.";
            case TOO_LONG -> "the tag path is longer than " + TagPaths.MAX_LENGTH + " characters.";
            case EMPTY_PART -> path + " has an empty part between two /; a tag path has a name between every two /.";
            case BRACKET -> path + " has a [ or ] after its start; a tag path names its provider once, at its start.";
            case BRACE -> path + " has a { or } inside it; braces only mark {asset.path} at the start of a tag path.";
            case RELATIVE_PROVIDER -> path + " does not name its provider; use a full path such as"
                + " [default]Shared/GasPrice, not a relative one.";
            default -> path + " is not a tag path; use " + (assetRelativeAllowed
                ? "{asset.path}, {asset.path}/<path> or a full path such as [default]Shared/GasPrice."
                : "a full path such as [default]Shared/GasPrice.");
        };
    }

    /**
     * {@code template} with every placeholder filled from {@code item}, or null when one has
     * no value (no asset, a property not set or not a plain value) or the template is not one
     * Map Studio accepts. Pure; never throws. Example: {@code {asset.path}/Pressure} for pad P12
     * whose asset base path is {@code [default]Mesa/P12} gives {@code [default]Mesa/P12/Pressure}.
     */
    public static String fill(String template, ItemView item) {
        if (template == null || item == null) {
            return null;
        }
        StringBuilder out = new StringBuilder();
        int i = 0;
        while (i < template.length()) {
            char c = template.charAt(i);
            if (c == '}') {
                return null;
            }
            if (c != '{') {
                out.append(c);
                i++;
                continue;
            }
            int end = template.indexOf('}', i);
            if (end < 0) {
                return null;
            }
            String value = valueOf(template.substring(i, end + 1), item);
            if (value == null) {
                return null;
            }
            out.append(value);
            i = end + 1;
        }
        return out.toString();
    }

    private static String valueOf(String p, ItemView item) {
        switch (p) {
            case ITEM_ID:
                return item.itemId();
            case ITEM_NAME:
                return item.itemName();
            case ASSET_ID:
                return item.assetId();
            case ASSET_PATH:
                return item.assetPath();
            default:
                break;
        }
        if (!p.startsWith(PROPERTY_PREFIX) || item.properties() == null) {
            return null;
        }
        JsonElement v = item.properties().get(p.substring(PROPERTY_PREFIX.length(), p.length() - 1));
        if (v == null || !v.isJsonPrimitive()) {
            return null;
        }
        if (v.getAsJsonPrimitive().isNumber()) {
            return jsNumber(v.getAsString());
        }
        return v.getAsString();
    }

    /**
     * A JSON number as the browser shows it ({@code String(n)} in JavaScript): the nearest
     * double, its shortest digits, plain from 1e-6 up to below 1e21 and in exponent form
     * ({@code 1e+21}, {@code 1.5e-7}) outside that; {@code 12.0} is {@code "12"}, {@code 4.50}
     * is {@code "4.5"}. Null for a number no double holds (as the browser's non-finite check).
     */
    static String jsNumber(String text) {
        double d;
        try {
            d = Double.parseDouble(text);
        } catch (NumberFormatException ex) {
            return null;
        }
        if (Double.isNaN(d) || Double.isInfinite(d)) {
            return null;
        }
        if (d == 0) {
            return "0";
        }
        // The fewest significant digits that read back as the same double (JavaScript's
        // Number::toString; JDK 17's Double.toString is not always the shortest).
        BigDecimal exact = new BigDecimal(Math.abs(d));
        BigDecimal r = exact;
        for (int p = 1; p <= 17; p++) {
            r = exact.round(new MathContext(p, RoundingMode.HALF_EVEN));
            if (r.doubleValue() == Math.abs(d)) {
                break;
            }
        }
        r = r.stripTrailingZeros();
        String digits = r.unscaledValue().toString();
        int k = digits.length();
        int n = r.precision() - r.scale();
        StringBuilder b = new StringBuilder(d < 0 ? "-" : "");
        if (k <= n && n <= 21) {
            b.append(digits).append("0".repeat(n - k));
        } else if (0 < n && n <= 21) {
            b.append(digits, 0, n).append('.').append(digits, n, k);
        } else if (-6 < n && n <= 0) {
            b.append("0.").append("0".repeat(-n)).append(digits);
        } else {
            int e = n - 1;
            b.append(digits.charAt(0));
            if (k > 1) {
                b.append('.').append(digits, 1, k);
            }
            b.append('e').append(e < 0 ? '-' : '+').append(Math.abs(e));
        }
        return b.toString();
    }
}
