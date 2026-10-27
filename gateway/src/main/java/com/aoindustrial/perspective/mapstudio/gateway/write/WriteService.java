package com.aoindustrial.perspective.mapstudio.gateway.write;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;

import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.util.LoggerEx;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.EditBatch;
import com.aoindustrial.perspective.mapstudio.common.contract.EditOp;
import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;
import com.aoindustrial.perspective.mapstudio.gateway.store.MapStore;
import com.aoindustrial.perspective.mapstudio.gateway.store.StoreGate;

/**
 * The one write path (AD-2): every {@code edits.apply} batch, from the browser or
 * from {@code system.mapstudio.applyEdits}, goes through {@link #apply}.
 *
 * <p>Order (epic 2 stories 2 and 5): the project's map store is ready and writable
 * here (not read only: a newer schema or a standby refuses {@code read-only}); the
 * batch and its ops are well formed; a {@code batchId} already committed replays its
 * stored reply (same actor) or is refused; the level allows every op's shape; every
 * op is one this version carries out (kind setups from entry 3); there is an actor.
 * Then one transaction takes the project's next {@code seq} (locking the project row,
 * which serialises a project's batches), looks for the {@code batchId} again (found:
 * roll back and replay), locks every map item, checks the level against each stored
 * geometry, collects every stale op into one {@code conflict}, then writes the items,
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

    public WriteService(StoreGate gate, MapStore store, ChangeHook hook) {
        this.gate = gate;
        this.store = store;
        this.hook = hook;
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
        batch.requireSupported();
        if (!hasActor) {
            throw new MapStudioException(Messages.CODE_INVALID, "A save needs an actor: who makes the change.");
        }
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
                List<Optional<MapItemRecord>> stored = new ArrayList<>();
                for (EditOp op : batch.ops()) {
                    stored.add(tx.lockItem(project, op.id()));
                }
                for (EditOp op : batch.ops()) {
                    RoleMatrix.checkStored(level, op, stored.get(op.index()));
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
                    MapItemRecord written = write(tx, project, op, stored.get(op.index()).orElse(null));
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
    private static void checkVersion(MapStore.Tx tx, String project, EditOp op, Optional<MapItemRecord> stored,
                                     ConflictReport conflicts) throws SQLException {
        if (EditOp.CREATE.equals(op.op())) {
            if (op.baseVersion() == 0) {
                if (stored.isPresent()) {
                    conflicts.add(tx, project, op, stored.get());
                }
                return;
            }
            if (stored.isEmpty()) {
                throw new MapStudioException(Messages.CODE_INVALID, "Op " + op.index() + ": map item " + op.id()
                    + " was never saved, so it cannot be restored; create it with baseVersion 0.", op.index(), op.id());
            }
            if (!stored.get().deleted() || stored.get().version() != op.baseVersion()) {
                conflicts.add(tx, project, op, stored.get());
            }
            return;
        }
        if (stored.isEmpty()) {
            throw new MapStudioException(Messages.CODE_INVALID, "Op " + op.index() + ": map item " + op.id()
                + " does not exist, so it cannot be " + (EditOp.DELETE.equals(op.op()) ? "deleted." : "updated."),
                op.index(), op.id());
        }
        MapItemRecord current = stored.get();
        if (current.deleted() || current.version() != op.baseVersion()) {
            conflicts.add(tx, project, op, current);
        }
    }

    /** Write one op whose version was checked; returns the record as stored. */
    private static MapItemRecord write(MapStore.Tx tx, String project, EditOp op, MapItemRecord current)
            throws SQLException {
        switch (op.op()) {
            case EditOp.CREATE -> {
                MapItemRecord created = MapItemRecord.fromCreate(op.id(), op.data(), op.index());
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
                MapItemRecord updated = current.updatedWith(op.data(), op.index());
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
}
