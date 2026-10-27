package com.aoindustrial.perspective.mapstudio.common.contract;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.Map;

import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonNull;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonPrimitive;

/**
 * A map item record checked against its kind (AD-20, epic 2 story 9): the geometry type
 * matches the kind ({@code point}: a Point, {@code line}: a LineString), every property is
 * a form field of the kind and has the field's type, and the overrides are a partial kind
 * setup ({@link KindSetup#parse} with full tag paths only). Field-driven, so a new record
 * field is one more case: an {@code attachment} (story 14) needs an instrument kind.
 *
 * <p>Normalising (once, on the Gateway): a CSV-style string in a {@code number},
 * {@code integer} or {@code boolean} field becomes the value ({@code "12"} to 12,
 * {@code " 4.5 "} to 4.5, {@code "true"} to true), a blank string there becomes null; any
 * other value is stored as sent. A null property means "not set". Required fields are
 * not enforced at save in 0.2.0 (owner, 2026-10-27): the draw tool, the script checks and
 * imports create items before their form is filled; epic-editing flags them.
 */
public final class ItemCheck {

    /** At most this many digits before the decimal point (a double reaches about 1.8e308). */
    static final int MAX_DIGITS = 309;

    /** At most this many digits after the decimal point, or this negative scale (an exponent). */
    static final int MAX_SCALE = 400;

    private ItemCheck() {
    }

    /**
     * The record as it is stored: properties normalised, everything else unchanged.
     *
     * @throws InvalidValue naming the kind, the geometry or the field at fault
     */
    public static MapItemRecord check(MapItemRecord item, Kind kind) {
        String type = item.geometry().has("type") ? item.geometry().get("type").getAsString() : "";
        String expected = "line".equals(kind.geometry()) ? "LineString" : "Point";
        if (!expected.equals(type)) {
            throw new InvalidValue("kind " + Rows.echo(kind.id()) + " is a " + kind.geometry() + " kind, so its"
                + " geometry is a " + expected + ", not a " + type + ".");
        }
        JsonObject properties = new JsonObject();
        for (Map.Entry<String, JsonElement> p : item.properties().entrySet()) {
            FormField field = kind.field(p.getKey());
            if (field == null) {
                throw new InvalidValue("properties." + Rows.echo(p.getKey()) + " is not a form field of kind "
                    + Rows.echo(kind.id()) + (kind.fields().isEmpty() ? ", which has none." : "; its fields are "
                    + String.join(", ", kind.fields().stream().map(FormField::key).toList()) + "."));
            }
            properties.add(p.getKey(), value(field, p.getValue()));
        }
        try {
            KindSetup.parse(item.overrides(), kind, true);
        } catch (InvalidValue ex) {
            throw ex.at("overrides");
        }
        if (item.attachment() != null && !kind.instrument()) {
            throw new InvalidValue("attachment: kind " + Rows.echo(kind.id()) + " is not an instrument kind, so its map"
                + " items are not attached to a line; send attachment null, or mark the kind instrument true in the"
                + " kind list.");
        }
        return new MapItemRecord(item.id(), item.kind(), item.name(), item.geometry(), properties, item.assetId(),
            item.overrides(), item.ends(), item.attachment(), item.version(), item.deleted());
    }

    /** One property value by its field's type, CSV strings converted. */
    static JsonElement value(FormField field, JsonElement v) {
        if (v == null || v.isJsonNull()) {
            return JsonNull.INSTANCE;
        }
        String where = "properties." + field.key();
        boolean string = v.isJsonPrimitive() && v.getAsJsonPrimitive().isString();
        switch (field.type()) {
            case "text" -> {
                if (!string) {
                    throw new InvalidValue(where + " is a text field, so its value is text.");
                }
                return v;
            }
            case "choice" -> {
                if (!string || !field.choices().contains(v.getAsString())) {
                    throw new InvalidValue(where + " is a choice field; its value is one of "
                        + String.join(", ", field.choices()) + ".");
                }
                return v;
            }
            case "boolean" -> {
                if (v.isJsonPrimitive() && v.getAsJsonPrimitive().isBoolean()) {
                    return v;
                }
                if (string) {
                    String s = v.getAsString().trim().toLowerCase(Locale.ROOT);
                    if (s.isEmpty()) {
                        return JsonNull.INSTANCE;
                    }
                    if (s.equals("true") || s.equals("false")) {
                        return new JsonPrimitive(Boolean.parseBoolean(s));
                    }
                }
                throw new InvalidValue(where + " is a true or false field, not " + shown(v) + ".");
            }
            case "number", "integer" -> {
                boolean integer = "integer".equals(field.type());
                BigDecimal n;
                try {
                    n = number(v);
                } catch (NumberFormatException ex) {
                    throw new InvalidValue(where + " is " + (integer ? "a whole number" : "a number")
                        + " field, not " + shown(v) + ".");
                }
                if (n == null) {
                    return JsonNull.INSTANCE;
                }
                // Bounded before any conversion: "1e999999999" is cheap to read but costs
                // gigabytes as a whole number (Quick review, epic 2 story 9).
                if (Math.abs((long) n.scale()) > MAX_SCALE || (long) n.precision() - n.scale() > MAX_DIGITS) {
                    throw new InvalidValue(where + " is " + (integer ? "a whole number" : "a number")
                        + " field; " + shown(v) + " is out of range.");
                }
                if (integer) {
                    long whole;
                    try {
                        whole = n.longValueExact();
                    } catch (ArithmeticException ex) {
                        throw new InvalidValue(where + " is a whole number field, not " + shown(v)
                            + (n.stripTrailingZeros().scale() > 0 ? "." : " (out of range)."));
                    }
                    return string ? new JsonPrimitive(whole) : v;
                }
                if (Double.isInfinite(n.doubleValue())) {
                    throw new InvalidValue(where + " is a number field; " + shown(v) + " is out of range.");
                }
                if (!string) {
                    return v;
                }
                BigDecimal s = n.stripTrailingZeros();
                return s.scale() <= 0 ? new JsonPrimitive(s.toBigIntegerExact()) : new JsonPrimitive(s);
            }
            default -> throw new InvalidValue(where + " has the unknown field type " + field.type() + ".");
        }
    }

    /**
     * The number in {@code v} (a JSON number, or a string holding one), null for a blank string.
     *
     * @throws NumberFormatException when {@code v} holds no number
     */
    private static BigDecimal number(JsonElement v) {
        if (!v.isJsonPrimitive()) {
            throw new NumberFormatException();
        }
        JsonPrimitive p = v.getAsJsonPrimitive();
        if (p.isNumber()) {
            return new BigDecimal(p.getAsString());
        }
        if (!p.isString()) {
            throw new NumberFormatException();
        }
        String s = p.getAsString().trim();
        return s.isEmpty() ? null : new BigDecimal(s);
    }

    private static String shown(JsonElement v) {
        return v.isJsonPrimitive() && v.getAsJsonPrimitive().isString() ? "\"" + Rows.echo(v.getAsString()) + "\""
            : Rows.echo(v.toString());
    }
}
