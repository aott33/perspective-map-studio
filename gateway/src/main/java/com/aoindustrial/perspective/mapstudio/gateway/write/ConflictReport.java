package com.aoindustrial.perspective.mapstudio.gateway.write;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.inductiveautomation.ignition.common.gson.JsonArray;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.Conflict;
import com.aoindustrial.perspective.mapstudio.common.contract.EditOp;
import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.gateway.store.MapStore;

/**
 * Collects every stale op of one batch (epic 2 story 2) and turns them into one
 * {@code conflict} refusal: the stored record of each, who changed it last and when,
 * and a plain-words message naming the map item, or the count when there are several.
 */
final class ConflictReport {

    private final List<Conflict> conflicts = new ArrayList<>();
    private final List<Boolean> exists = new ArrayList<>();

    /** Record a stale op; {@code current} is its stored record. */
    void add(MapStore.Tx tx, String project, EditOp op, MapItemRecord current) throws SQLException {
        Optional<MapStore.LastEdit> last = tx.lastEdit(project, op.entity(), op.id());
        conflicts.add(new Conflict(op.index(), op.entity(), op.id(), op.baseVersion(), current,
            last.map(MapStore.LastEdit::actor).orElse(null), last.map(MapStore.LastEdit::at).orElse(null)));
        exists.add(EditOp.CREATE.equals(op.op()) && op.baseVersion() == 0);
    }

    boolean isEmpty() {
        return conflicts.isEmpty();
    }

    /** The refusal: code {@code conflict}, {@code op} the first stale op, every conflict listed. */
    MapStudioException refusal() {
        JsonArray array = new JsonArray();
        for (Conflict c : conflicts) {
            array.add(c.toJson());
        }
        Conflict first = conflicts.get(0);
        return new MapStudioException(Messages.CODE_CONFLICT, message(), first.index(), first.id(), array);
    }

    String message() {
        if (conflicts.size() > 1) {
            return conflicts.size() + " map items were changed by others since you loaded them."
                + " Nothing in this save was written.";
        }
        Conflict c = conflicts.get(0);
        String name = c.current() != null && !c.current().name().isBlank() ? c.current().name() : "Map item " + c.id();
        String who = c.changedBy() == null ? "" : " by " + c.changedBy()
            + (c.changedAt() == null ? "" : " at " + hhmm(c.changedAt()) + " UTC");
        if (exists.get(0)) {
            return name + " already exists (saved" + who + "), so it was not created again."
                + " Nothing in this save was written.";
        }
        if (c.current() != null && c.current().deleted()) {
            return name + " was deleted" + who + " since you loaded it. Nothing in this save was written.";
        }
        return name + " was changed" + who + " since you loaded it. Nothing in this save was written.";
    }

    /** "14:02" from "2026-10-26T14:02:00Z". */
    private static String hhmm(String iso) {
        int t = iso.indexOf('T');
        return t >= 0 && iso.length() >= t + 6 ? iso.substring(t + 1, t + 6) : iso;
    }
}
