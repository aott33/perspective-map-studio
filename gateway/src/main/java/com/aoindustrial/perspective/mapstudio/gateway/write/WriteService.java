package com.aoindustrial.perspective.mapstudio.gateway.write;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.util.LoggerEx;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.EditBatch;
import com.aoindustrial.perspective.mapstudio.common.contract.EditOp;
import com.aoindustrial.perspective.mapstudio.common.contract.InvalidValue;
import com.aoindustrial.perspective.mapstudio.common.contract.ItemCheck;
import com.aoindustrial.perspective.mapstudio.common.contract.Kind;
import com.aoindustrial.perspective.mapstudio.common.contract.KindSetup;
import com.aoindustrial.perspective.mapstudio.common.contract.KindSetupRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Rows;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;
import com.aoindustrial.perspective.mapstudio.common.contract.StoredRecord;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.AdapterSnapshot;
import com.aoindustrial.perspective.mapstudio.gateway.store.MapStore;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreGate;

/**
 * The one write path (AD-2): every {@code edits.apply} batch, from the browser or
 * from {@code system.mapstudio.applyEdits}, goes through {@link #apply}.
 *
 * <p>Order (epic 2 stories 2 and 5): the project's map store is ready and writable
 * here (not read only: a newer schema or a standby refuses {@code read-only}); the
 * batch and its ops are well formed; a {@code batchId} already committed replays its
 * stored reply (same actor) or is refused; the level allows every op's shape; there is
 * an actor; the project's kind list is in use, read once for the batch, unless every op
 * is a delete (epic 2 story 9). Then one transaction takes the project's next {@code seq}
 * (locking the project row, which serialises a project's batches), looks for the
 * {@code batchId} again (found: roll back and replay), locks every map item and kind
 * setup, checks the level against each stored geometry, collects every stale op into one
 * {@code conflict}, then checks each op's record against the kind list
 * ({@link ItemCheck}, {@link KindSetup}; {@code invalid} naming the op) and writes it,
 * one edit record row per op and the batch row; it commits all or nothing; then the
 * change hook is called once. Any refusal is a {@link MapStudioException} with its
 * code and, where an op is at fault, the op's index and id; nothing is written.
 */
public final class WriteService {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.write");

    /** PostgreSQL's unique_violation: on the batch row, a concurrent commit of the same batchId. */
    static final String SQLSTATE_UNIQUE_VIOLATION = "23505";

    private final StoreGate gate;
    private final MapStore store;
    private final ChangeHook hook;
    private final Function<String, AdapterSnapshot> adapters;

    /** {@code adapters} gives a project's cached kind list (the host adapters' snapshot), read once per batch. */
    public WriteService(StoreGate gate, MapStore store, ChangeHook hook, Function<String, AdapterSnapshot> adapters) {
        this.gate = gate;
        this.store = store;
        this.hook = hook;
        this.adapters = adapters;
    }

    /** Thrown inside the transaction when the batch is already committed: rolls back, then replays. */
    private static final class Replay extends RuntimeException {
        final transient MapStore.StoredBatch stored;

        Replay(MapStore.StoredBatch stored) {
            super(null, null, false, false);
            this.stored = stored;
        }
    }

    /**
     * Save one batch for a project.
     *
     * @param level the caller's level ({@code full}, {@code phone}, {@code none}); scripts run as {@code full}
     * @throws MapStudioException when the batch is refused; nothing is written then
     */
    public EditResult apply(String project, JsonElement batchJson, Actor actor, String level) {
        return apply(project, batchJson, actor, setup -> level);
    }

    /**
     * Save one batch for a project, with the caller's level worked out by {@code levelOf}
     * from the same setup the batch is checked and saved against: the setup is read once
     * per call, so a role removed by a scan between two reads cannot let a batch through.
     *
     * @throws MapStudioException when the batch is refused; nothing is written then
     */
    public EditResult apply(String project, JsonElement batchJson, Actor actor, Function<Setup, String> levelOf) {
        Setup setup = gate.requireWritable(project);
        String level = levelOf.apply(setup);
        EditBatch batch = EditBatch.parse(batchJson);
        boolean hasActor = actor != null && actor.name() != null && !actor.name().isBlank();
        if (hasActor) {
            // Without an actor nothing was ever committed, so there is nothing to replay.
            Optional<MapStore.StoredBatch> earlier;
            try {
                earlier = store.inTransaction(setup.connection(), tx -> tx.findBatch(project, batch.batchId()));
            } catch (SQLException ex) {
                throw unreachable(project, setup, ex);
            }
            if (earlier.isPresent()) {
                return replay(project, batch, actor, earlier.get());
            }
        }
        for (EditOp op : batch.ops()) {
            RoleMatrix.check(level, op);
        }
        if (!hasActor) {
            throw new MapStudioException(Messages.CODE_INVALID, "A save needs an actor: who makes the change.");
        }
        Map<String, Kind> kinds = kindList(project, batch);
        List<ChangeHook.CommittedOp> committed = new ArrayList<>();
        EditResult result;
        try {
            result = store.inTransaction(setup.connection(), tx -> {
                committed.clear();
                long seq = tx.nextSeq(project);
                Optional<MapStore.StoredBatch> raced = tx.findBatch(project, batch.batchId());
                if (raced.isPresent()) {
                    throw new Replay(raced.get());
                }
                List<Optional<? extends StoredRecord>> stored = new ArrayList<>();
                for (EditOp op : batch.ops()) {
                    stored.add(isItem(op) ? tx.lockItem(project, op.id()) : tx.lockKindSetup(project, op.id()));
                }
                for (EditOp op : batch.ops()) {
                    if (isItem(op)) {
                        RoleMatrix.checkStored(level, op, stored.get(op.index()).map(MapItemRecord.class::cast));
                    }
                }
                ConflictReport conflicts = new ConflictReport();
                for (EditOp op : batch.ops()) {
                    checkVersion(tx, project, op, stored.get(op.index()), conflicts);
                }
                if (!conflicts.isEmpty()) {
                    throw conflicts.refusal();
                }
                List<EditResult.OpResult> results = new ArrayList<>();
                for (EditOp op : batch.ops()) {
                    StoredRecord current = stored.get(op.index()).orElse(null);
                    StoredRecord written = isItem(op) ? write(tx, project, op, (MapItemRecord) current, kinds)
                        : writeKindSetup(tx, project, op, (KindSetupRecord) current, kinds);
                    tx.insertEdit(new MapStore.EditRow(project, batch.batchId(), seq, op.entity(), op.id(),
                        op.op(), written.version(), actor.name(), actor.source()));
                    results.add(new EditResult.OpResult(op.entity(), op.id(), written.version()));
                    committed.add(new ChangeHook.CommittedOp(op.op(), op.entity(), op.id(), written));
                }
                EditResult r = new EditResult(batch.batchId(), seq, List.copyOf(results));
                tx.insertBatch(project, batch.batchId(), seq, actor.name(), r.toJson());
                return r;
            });
        } catch (Replay ex) {
            return replay(project, batch, actor, ex.stored);
        } catch (SQLException ex) {
            if (SQLSTATE_UNIQUE_VIOLATION.equals(ex.getSQLState())) {
                Optional<MapStore.StoredBatch> raced = Optional.empty();
                try {
                    raced = store.inTransaction(setup.connection(), tx -> tx.findBatch(project, batch.batchId()));
                } catch (SQLException again) {
                    throw unreachable(project, setup, again);
                }
                if (raced.isPresent()) {
                    return replay(project, batch, actor, raced.get());
                }
            }
            throw unreachable(project, setup, ex);
        }
        log.debugf("Project %s: batch %s saved as seq %d by %s (%s), %d op(s).", project, result.batchId(),
            result.seq(), actor.name(), actor.source(), result.results().size());
        try {
            hook.onCommitted(new ChangeHook.CommittedBatch(project, result.seq(), result.batchId(), actor,
                List.copyOf(committed)));
        } catch (RuntimeException ex) {
            log.error("The change hook failed after batch " + result.batchId() + " of project " + project
                + " was saved: " + ex.getClass().getSimpleName(), ex);
        }
        return result;
    }

    /** The stored reply of a committed batch for the same actor; another actor's reuse is {@code invalid}. */
    private static EditResult replay(String project, EditBatch batch, Actor actor, MapStore.StoredBatch stored) {
        if (!actor.name().equals(stored.actor())) {
            throw new MapStudioException(Messages.CODE_INVALID, "This save id was already used for another"
                + " change; send a new batchId. Nothing was saved.");
        }
        EditResult result = EditResult.fromJson(stored.result());
        log.debugf("Project %s: batch %s sent again by %s; its saved reply (seq %d) is returned.", project,
            batch.batchId(), actor.name(), result.seq());
        return result;
    }

    private static MapStudioException unreachable(String project, Setup setup, SQLException ex) {
        log.errorf("Map Studio could not save a batch of project %s on database connection %s (SQLState %s): %s",
            project, setup.connection(), ex.getSQLState(), ex.getClass().getSimpleName());
        return new MapStudioException(Messages.CODE_STORE_UNREACHABLE,
            "The map store could not save the change (SQLState " + ex.getSQLState() + "); nothing was saved.");
    }

    /**
     * Add the op to {@code conflicts} when its baseVersion does not match what is stored;
     * refuse with {@code invalid} at once when it names a map item that was never stored.
     */
    private static void checkVersion(MapStore.Tx tx, String project, EditOp op,
                                     Optional<? extends StoredRecord> stored, ConflictReport conflicts)
            throws SQLException {
        if (EditOp.CREATE.equals(op.op())) {
            if (op.baseVersion() == 0) {
                if (stored.isPresent()) {
                    conflicts.add(tx, project, op, stored.get());
                }
                return;
            }
            if (stored.isEmpty()) {
                throw new MapStudioException(Messages.CODE_INVALID, "Op " + op.index() + ": " + what(op)
                    + " was never saved, so it cannot be restored; create it with baseVersion 0.", op.index(), op.id());
            }
            if (!stored.get().deleted() || stored.get().version() != op.baseVersion()) {
                conflicts.add(tx, project, op, stored.get());
            }
            return;
        }
        if (stored.isEmpty()) {
            throw new MapStudioException(Messages.CODE_INVALID, "Op " + op.index() + ": " + what(op)
                + " does not exist, so it cannot be " + (EditOp.DELETE.equals(op.op()) ? "deleted." : "updated."),
                op.index(), op.id());
        }
        StoredRecord current = stored.get();
        if (current.deleted() || current.version() != op.baseVersion()) {
            conflicts.add(tx, project, op, current);
        }
    }

    /** Write one map item op whose version was checked; returns the record as stored. */
    private static MapItemRecord write(MapStore.Tx tx, String project, EditOp op, MapItemRecord current,
                                       Map<String, Kind> kinds) throws SQLException {
        switch (op.op()) {
            case EditOp.CREATE -> {
                MapItemRecord created = checked(MapItemRecord.fromCreate(op.id(), op.data(), op.index()), kinds, op);
                if (current == null) {
                    tx.insertItem(project, created);
                    return created;
                }
                // A restore: the tombstone's row takes the create's data, live again, version + 1.
                MapItemRecord restored = new MapItemRecord(op.id(), created.kind(), created.name(), created.geometry(),
                    created.properties(), created.assetId(), created.overrides(), created.ends(),
                    current.version() + 1, false);
                tx.updateItem(project, restored);
                return restored;
            }
            case EditOp.UPDATE -> {
                MapItemRecord updated = checked(current.updatedWith(op.data(), op.index()), kinds, op);
                tx.updateItem(project, updated);
                return updated;
            }
            case EditOp.DELETE -> {
                MapItemRecord tombstone = new MapItemRecord(current.id(), current.kind(), current.name(),
                    current.geometry(), current.properties(), current.assetId(), current.overrides(), current.ends(),
                    current.version() + 1, true);
                tx.updateItem(project, tombstone);
                return tombstone;
            }
            default -> throw new MapStudioException(Messages.CODE_INVALID, "Op " + op.index() + ": " + op.op()
                + " is not supported in this version.", op.index(), op.id());
        }
    }

    /** Write one kind setup op whose version was checked; returns the record as stored. */
    private static KindSetupRecord writeKindSetup(MapStore.Tx tx, String project, EditOp op, KindSetupRecord current,
                                                  Map<String, Kind> kinds) throws SQLException {
        if (EditOp.DELETE.equals(op.op())) {
            KindSetupRecord tombstone = new KindSetupRecord(current.kindId(), current.setup(), current.version() + 1,
                true);
            tx.updateKindSetup(project, tombstone);
            return tombstone;
        }
        JsonObject data = op.data();
        for (String key : data.keySet()) {
            if (!KindSetupRecord.SETUP.equals(key)) {
                throw invalid(op, "Unknown field " + Rows.echo(key) + " in the kind setup data; a kind setup op carries"
                    + " {\"setup\": {...}}.");
            }
        }
        if (!data.has(KindSetupRecord.SETUP)) {
            throw invalid(op, "A kind setup " + op.op() + " needs data {\"setup\": {...}}.");
        }
        Kind kind = kinds.get(op.id());
        if (kind == null) {
            throw invalid(op, "kind " + Rows.echo(op.id()) + " is not in the project's kind list, so it cannot have a kind setup.");
        }
        JsonObject setup;
        try {
            setup = KindSetup.parse(data.get(KindSetupRecord.SETUP), kind, false);
        } catch (InvalidValue ex) {
            throw invalid(op, ex.getMessage());
        }
        if (current == null) {
            KindSetupRecord created = new KindSetupRecord(op.id(), setup, 1, false);
            tx.insertKindSetup(project, created);
            return created;
        }
        // An update, or a restore of a tombstone (a create at its version): version + 1, live.
        KindSetupRecord next = new KindSetupRecord(op.id(), setup, current.version() + 1, false);
        tx.updateKindSetup(project, next);
        return next;
    }

    /** The map item record checked and normalised against its kind. */
    private static MapItemRecord checked(MapItemRecord item, Map<String, Kind> kinds, EditOp op) {
        Kind kind = kinds.get(item.kind());
        if (kind == null) {
            throw invalid(op, "kind " + Rows.echo(item.kind()) + " is not in the project's kind list (" + String.join(", ",
                kinds.keySet()) + ").");
        }
        try {
            return ItemCheck.check(item, kind);
        } catch (InvalidValue ex) {
            throw invalid(op, ex.getMessage());
        }
    }

    /**
     * The project's kind list in use, by id, read once for the batch. A batch of deletes only
     * needs none (owner decision, 2026-10-27); any other batch is refused {@code invalid} when
     * no list is in use (none read yet, the function returned none, or it never answered well).
     */
    private Map<String, Kind> kindList(String project, EditBatch batch) {
        Map<String, Kind> byId = new LinkedHashMap<>();
        boolean needed = batch.ops().stream().anyMatch(op -> !EditOp.DELETE.equals(op.op()));
        if (!needed) {
            return byId;
        }
        AdapterSnapshot lists = adapters.apply(project);
        if (lists == null || lists.kinds().isEmpty()) {
            String status = lists == null ? "loading" : lists.kindsStatus().status();
            String message = lists == null ? "" : " " + lists.kindsStatus().message();
            throw new MapStudioException(Messages.CODE_INVALID, "The kind list is not available (" + status + "):"
                + message + " Nothing was saved.");
        }
        lists.kinds().forEach(k -> byId.put(k.id(), k));
        return byId;
    }

    private static boolean isItem(EditOp op) {
        return EditOp.ENTITY_ITEM.equals(op.entity());
    }

    /** "map item <id>" or "the kind setup of <kind>", for a message. */
    private static String what(EditOp op) {
        return isItem(op) ? "map item " + op.id() : "the kind setup of " + Rows.echo(op.id());
    }

    private static MapStudioException invalid(EditOp op, String message) {
        return new MapStudioException(Messages.CODE_INVALID, "Op " + op.index() + " (" + Rows.echo(op.id()) + "): " + message,
            op.index(), op.id());
    }
}
