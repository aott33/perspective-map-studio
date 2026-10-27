package com.aoindustrial.perspective.mapstudio.common.contract;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Set;
import java.util.UUID;

import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;

/**
 * An instrument's place on its line (AD-19, AD-20, epic 2 story 14):
 * {@code {lineId, distanceM}}, the id of a live line map item and the distance along it in
 * metres from its first vertex, measured geodesically ({@link LineMeasure}), stored to 0.1 m.
 * Only an instrument kind's map item has one ({@link ItemCheck}); the write service checks
 * that the line is live and the point is where the distance puts it.
 *
 * @param lineId   the line's id, a UUID in lower-case canonical form
 * @param distanceM metres from the line's first vertex, 0 or more, one decimal
 */
public record Attachment(String lineId, double distanceM) {

    /** The keys an attachment has, exactly. */
    public static final Set<String> KEYS = Set.of("lineId", "distanceM");

    /**
     * An attachment from its JSON object: exactly {@code lineId} (a UUID string, any letter
     * case, kept in lower-case canonical form) and {@code distanceM} (a finite number, 0 or
     * more, rounded half up to 0.1 m).
     *
     * @throws InvalidValue naming the part at fault
     */
    public static Attachment parse(JsonElement value) {
        if (value == null || !value.isJsonObject()) {
            throw new InvalidValue("attachment must be {\"lineId\": line id, \"distanceM\": metres} or null.");
        }
        JsonObject o = value.getAsJsonObject();
        for (String key : o.keySet()) {
            if (!KEYS.contains(key)) {
                throw new InvalidValue("attachment: " + Rows.echo(key) + " is not a key here; the keys are distanceM,"
                    + " lineId.");
            }
        }
        JsonElement line = o.get("lineId");
        if (line == null || !line.isJsonPrimitive() || !line.getAsJsonPrimitive().isString()
                || !EditOp.isUuid(line.getAsString())) {
            throw new InvalidValue("attachment.lineId must be the id of a line map item (a UUID).");
        }
        JsonElement d = o.get("distanceM");
        if (d == null || !d.isJsonPrimitive() || !d.getAsJsonPrimitive().isNumber()) {
            throw new InvalidValue("attachment.distanceM must be a number of metres along the line.");
        }
        double distance = d.getAsDouble();
        if (Double.isNaN(distance) || Double.isInfinite(distance)) {
            throw new InvalidValue("attachment.distanceM must be a finite number.");
        }
        if (distance < 0) {
            throw new InvalidValue("attachment.distanceM must be 0 or more (metres from the line's first vertex), not "
                + Rows.echo(d.getAsString()) + ".");
        }
        return new Attachment(UUID.fromString(line.getAsString()).toString(), round1(distance));
    }

    public JsonObject toJson() {
        JsonObject o = new JsonObject();
        o.addProperty("lineId", lineId);
        o.addProperty("distanceM", distanceM);
        return o;
    }

    /** Rounded half up to one decimal (0.1 m), the stored precision. */
    static double round1(double d) {
        return BigDecimal.valueOf(d).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }
}
