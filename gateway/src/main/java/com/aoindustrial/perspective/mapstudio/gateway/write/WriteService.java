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
 * <p>Order: the project's map store is ready; the batch and its ops are well
 * formed; every op is one this version carries out; the level allows every op;
 * then one transaction takes the project's next {@code seq}, locks and checks each
 * map item's version, writes the items, one edit record row per op and the batch
 * row; it commits all or nothing; then the change hook is called once. Any refusal
 * is a {@link MapStudioException} with its code and, where an op is at fault, the
 * op's index and id; nothing is written.
 */
public final class WriteService {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.write");

    /** PostgreSQL's unique_violation: here, a batchId already saved (retries are entry 2's). */
    static final String SQLSTATE_UNIQUE_VIOLATION = "23505";

    private final StoreGate gate;
    private final MapStore store;
    private final ChangeHook hook;

    public WriteService(StoreGate gate, MapStore store, ChangeHook hook) {
        this.gate = gate;
        this.store = store;
        this.hook = hook;
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
        Setup setup = gate.requireReady(project);
        String level = levelOf.apply(setup);
        EditBatch batch = EditBatch.parse(batchJson);
        batch.requireSupported();
        for (EditOp op : batch.ops()) {
            RoleMatrix.check(level, op);
        }
        if (actor == null || actor.name() == null || actor.name().isBlank()) {
            throw new MapStudioException(Messages.CODE_INVALID, "A save needs an actor: who makes the change.");
        }
        List<ChangeHook.CommittedOp> committed = new ArrayList<>();
        EditResult result;
        try {
            result = store.inTransaction(setup.connection(), tx -> {
                committed.clear();
                long seq = tx.nextSeq(project);
                List<EditResult.OpResult> results = new ArrayList<>();
                for (EditOp op : batch.ops()) {
                    MapItemRecord written = applyOp(tx, project, op);
                    tx.insertEdit(new MapStore.EditRow(project, batch.batchId(), seq, op.entity(), op.id(), op.op(),
                        written.version(), actor.name(), actor.source()));
                    results.add(new EditResult.OpResult(op.entity(), op.id(), written.version()));
                    committed.add(new ChangeHook.CommittedOp(op.op(), op.entity(), op.id(), written));
                }
                EditResult r = new EditResult(batch.batchId(), seq, List.copyOf(results));
                tx.insertBatch(project, batch.batchId(), seq, actor.name(), r.toJson());
                return r;
            });
        } catch (SQLException ex) {
            if (SQLSTATE_UNIQUE_VIOLATION.equals(ex.getSQLState())) {
                throw new MapStudioException(Messages.CODE_INVALID, "The batch " + batch.batchId()
                    + " was already saved; send a new batchId for a new change.");
            }
            log.errorf("Map Studio could not save a batch of project %s on database connection %s (SQLState %s): %s",
                project, setup.connection(), ex.getSQLState(), ex.getClass().getSimpleName());
            throw new MapStudioException(Messages.CODE_STORE_UNREACHABLE,
                "The map store could not save the change (SQLState " + ex.getSQLState() + "); nothing was saved.");
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

    private static MapItemRecord applyOp(MapStore.Tx tx, String project, EditOp op) throws SQLException {
        Optional<MapItemRecord> stored = tx.lockItem(project, op.id());
        switch (op.op()) {
            case EditOp.CREATE -> {
                if (stored.isPresent()) {
                    throw new MapStudioException(Messages.CODE_CONFLICT, "Op " + op.index() + ": map item " + op.id()
                        + " already exists (version " + stored.get().version() + "); it was not created again.",
                        op.index(), op.id());
                }
                MapItemRecord created = MapItemRecord.fromCreate(op.id(), op.data(), op.index());
                tx.insertItem(project, created);
                return created;
            }
            case EditOp.UPDATE -> {
                if (stored.isEmpty()) {
                    throw new MapStudioException(Messages.CODE_INVALID, "Op " + op.index() + ": map item " + op.id()
                        + " does not exist, so it cannot be updated.", op.index(), op.id());
                }
                MapItemRecord current = stored.get();
                if (current.version() != op.baseVersion()) {
                    throw new MapStudioException(Messages.CODE_CONFLICT, "Op " + op.index() + ": map item " + op.id()
                        + " was changed by someone else (it is at version " + current.version() + ", the change was made"
                        + " on version " + op.baseVersion() + "). Nothing was saved.", op.index(), op.id());
                }
                MapItemRecord updated = current.updatedWith(op.data(), op.index());
                tx.updateItem(project, updated);
                return updated;
            }
            default -> throw new MapStudioException(Messages.CODE_INVALID, "Op " + op.index() + ": " + op.op()
                + " is not supported in this version.", op.index(), op.id());
        }
    }
}
