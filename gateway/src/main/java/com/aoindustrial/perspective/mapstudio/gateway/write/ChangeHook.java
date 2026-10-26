package com.aoindustrial.perspective.mapstudio.gateway.write;

import java.util.List;

import com.aoindustrial.perspective.mapstudio.common.contract.MapItemRecord;

/**
 * Called once after every committed batch (AD-17), outside the transaction, with
 * the full stored records the batch wrote. Entry 4 implements it to send
 * {@code map.changed {seq, ops}} to every open map of the project; this version
 * registers {@link NoChangeHook}. An exception from the hook is logged and does
 * not undo the committed batch.
 */
@FunctionalInterface
public interface ChangeHook {

    void onCommitted(CommittedBatch batch);

    /** A committed batch: the project, its seq, its batchId, who made it, and each op with its stored record. */
    record CommittedBatch(String project, long seq, String batchId, Actor actor, List<CommittedOp> ops) {
    }

    /** One saved op: {@code op} and {@code entity} as sent, and the record as stored after the op (new version). */
    record CommittedOp(String op, String entity, String id, MapItemRecord record) {
    }
}
