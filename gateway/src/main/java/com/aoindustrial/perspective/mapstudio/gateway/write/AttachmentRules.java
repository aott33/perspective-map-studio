package com.aoindustrial.perspective.mapstudio.gateway.write;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.Attachment;
import com.aoindustrial.perspective.mapstudio.common.contract.EditOp;
import com.aoindustrial.perspective.mapstudio.common.contract.Kind;
import com.aoindustrial.perspective.mapstudio.common.contract.LineMeasure;
import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Rows;
import com.aoindustrial.perspective.mapstudio.gateway.store.MapStore;

/**
 * Instruments stay on their lines (AD-19, epic 2 story 14), checked once per batch inside the
 * write transaction after every op is written, so on the state the whole batch leaves: a line
 * and its instruments created, moved or restored together pass in any op order, and a refusal
 * rolls everything back.
 *
 * <ul>
 *   <li>Every line the batch deletes, whose geometry it changes, whose kind it changes, or whose
 *       kind is not a line kind that is not an area, has no live instrument
 *       still attached to it that this batch has no op carrying {@code attachment} for
 *       (owner, 2026-10-27: a rename or a property change needs none). Checked first, so
 *       that refusal names the line.</li>
 *   <li>Every live map item the batch writes with an {@code attachment} points at a live line
 *       map item (written in this batch, else as stored) of a line kind in the kind list that is not
 *       an area, with
 *       {@code distanceM} at most the line's length plus {@link #TOLERANCE_M}, and its point
 *       within {@link #TOLERANCE_M} of the place {@code distanceM} gives on the line (owner,
 *       2026-10-27). The Gateway never projects; it checks the browser's result.</li>
 * </ul>
 *
 * Every refusal is {@code invalid}, naming the op at fault, the instrument and the line.
 */
final class AttachmentRules {

    /** How far an instrument's distance may pass the line's end, and its point its place, in metres. */
    static final double TOLERANCE_M = 1.0;

    private AttachmentRules() {
    }

    /** One written map item op: the op, the record before it (null for a create) and after it. */
    record Written(EditOp op, MapItemRecord before, MapItemRecord after) {
    }

    /**
     * @param written the batch's map item ops in op order, each with its stored record before and after
     * @throws MapStudioException {@code invalid} naming the op, when an instrument would be off its line
     */
    static void check(MapStore.Tx tx, String project, List<Written> written, Map<String, Kind> kinds)
            throws SQLException {
        Map<String, Written> byId = new LinkedHashMap<>();
        written.forEach(w -> byId.put(w.after().id(), w));
        for (Written w : written) {
            MapItemRecord before = w.before();
            if (before == null || before.deleted() || !before.isLine()) {
                continue;
            }
            MapItemRecord after = w.after();
            boolean moved = !after.deleted() && !after.geometry().equals(before.geometry());
            // A kind change, or a kind that is not a line instruments may go on (an area, or not in the
            // kind list), also needs every instrument in the batch: one left behind would sit on an area.
            boolean notTarget = !after.deleted() && (!after.kind().equals(before.kind())
                || !lineTarget(kinds.get(after.kind())));
            if (!after.deleted() && !moved && !notTarget) {
                continue;
            }
            List<String> left = new ArrayList<>();
            for (MapItemRecord instrument : tx.liveAttached(project, before.id())) {
                Written own = byId.get(instrument.id());
                if (own == null || own.op().data() == null || !own.op().data().has("attachment")) {
                    left.add(name(instrument));
                }
            }
            if (!left.isEmpty()) {
                String count = left.size() == 1 ? "1 instrument" : left.size() + " instruments";
                String fix = after.deleted() ? "Delete its instruments in the same save."
                    : moved ? "Send each instrument's new place in the same save."
                    : "Its new kind " + Rows.echo(after.kind()) + " is not a line instruments go on;"
                        + " delete or detach its instruments in the same save.";
                throw invalid(w.op(), "line " + name(before) + " has " + count + " (" + String.join(", ", left)
                    + ") this save does not move or delete. " + fix);
            }
        }
        Map<String, Optional<MapItemRecord>> read = new HashMap<>();
        for (Written w : written) {
            MapItemRecord item = w.after();
            if (item.deleted() || item.attachment() == null) {
                continue;
            }
            Attachment at = item.attachment();
            Written lineOp = byId.get(at.lineId());
            Optional<MapItemRecord> line;
            if (lineOp != null) {
                line = Optional.of(lineOp.after());
            } else {
                line = read.get(at.lineId());
                if (line == null) {
                    line = tx.lockItem(project, at.lineId());
                    read.put(at.lineId(), line);
                }
            }
            checkOne(w.op(), item, at, line.orElse(null), kinds);
        }
    }

    private static void checkOne(EditOp op, MapItemRecord item, Attachment at, MapItemRecord line,
                                 Map<String, Kind> kinds) {
        String instrument = "instrument " + name(item);
        if (line == null) {
            throw invalid(op, instrument + " is attached to map item " + at.lineId() + ", which does not exist.");
        }
        if (line.deleted()) {
            throw invalid(op, instrument + " is attached to line " + name(line) + ", which is deleted.");
        }
        if (!line.isLine()) {
            throw invalid(op, instrument + " is attached to " + name(line) + ", which is a point, not a line.");
        }
        Kind lineKind = kinds.get(line.kind());
        if (lineKind == null) {
            throw invalid(op, instrument + " is attached to " + name(line) + ", whose kind " + Rows.echo(line.kind())
                + " is not in the kind list; instruments go on lines of a line kind that is not an area.");
        }
        if (!lineTarget(lineKind)) {
            throw invalid(op, instrument + " is attached to " + name(line) + ", an area (kind " + Rows.echo(lineKind.id())
                + "); instruments go on lines that are not areas.");
        }
        List<double[]> coords = coordinates(line.geometry());
        double length = LineMeasure.lengthM(coords);
        if (at.distanceM() > length + TOLERANCE_M) {
            throw invalid(op, instrument + " is at " + metres(at.distanceM()) + " along line " + name(line)
                + ", past its end (the line is " + metres(length) + " long).");
        }
        double[] place = LineMeasure.pointAt(coords, at.distanceM());
        double[] point = coordinates(item.geometry()).get(0);
        double off = LineMeasure.distanceM(point, place);
        if (off > TOLERANCE_M) {
            throw invalid(op, instrument + " is " + metres(off) + " from its place on line " + name(line) + " ("
                + metres(at.distanceM()) + " along it); its point must be within " + metres(TOLERANCE_M)
                + " of that place.");
        }
    }

    /** A kind instruments may be attached to: a line kind that is not an area. */
    private static boolean lineTarget(Kind kind) {
        return kind != null && "line".equals(kind.geometry()) && !kind.area();
    }

    /** The positions of a Point (one) or a LineString, as stored. */
    static List<double[]> coordinates(JsonObject geometry) {
        List<double[]> out = new ArrayList<>();
        JsonElement c = geometry.get("coordinates");
        if (c == null || !c.isJsonArray()) {
            return out;
        }
        JsonArray a = c.getAsJsonArray();
        if (!a.isEmpty() && a.get(0).isJsonPrimitive()) {
            out.add(new double[] {a.get(0).getAsDouble(), a.get(1).getAsDouble()});
            return out;
        }
        for (JsonElement p : a) {
            JsonArray pa = p.getAsJsonArray();
            out.add(new double[] {pa.get(0).getAsDouble(), pa.get(1).getAsDouble()});
        }
        return out;
    }

    private static String name(MapItemRecord item) {
        return item.name() == null || item.name().isBlank() ? item.id() : Rows.echo(item.name());
    }

    /** "1,143.0 m". */
    static String metres(double m) {
        return String.format(Locale.ROOT, "%,.1f m", m);
    }

    private static MapStudioException invalid(EditOp op, String message) {
        return new MapStudioException(Messages.CODE_INVALID, "Op " + op.index() + " (" + Rows.echo(op.id()) + "): "
            + message + " Nothing in this save was written.", op.index(), op.id());
    }
}
