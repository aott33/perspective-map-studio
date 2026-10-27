/**
 * The reverse of a saved batch (AD-2, AD-19, epic 2 story 14): one batch that undoes it as
 * one step, so undoing a line delete restores the line and its instruments together. Pure,
 * unit tested in node; the undo stack itself is epic-editing's.
 *
 * - an update reverses to an update at the new version carrying the old values of the fields it changed;
 * - a delete reverses to a create at the tombstone's version (a restore) with the record's fields;
 * - a create (or a restore) reverses to a delete at the version it was saved at.
 */

import { EditBatch, EditOp, MapItemData, MapItemRecord } from './contract';

/** The fields of a record an op's data may carry, in record order. */
const DATA_FIELDS: Array<keyof MapItemData> =
    ['kind', 'name', 'geometry', 'properties', 'assetId', 'overrides', 'ends', 'attachment'];

function dataOf(record: MapItemRecord): MapItemData {
    const out: MapItemData = {};
    for (const f of DATA_FIELDS) {
        (out as Record<string, unknown>)[f] = record[f];
    }
    return out;
}

/**
 * The batch that undoes `batch`, saved with `results` (the edits.apply.reply's), given the
 * records as they were before it (`before`; a create's id need not be there). Map item ops
 * only: a kind setup op throws.
 */
export function reverseBatch(batchId: string, before: MapItemRecord[], batch: EditBatch,
    results: Array<{ entity: string; id: string; version: number }>): EditBatch {
    const old = new Map(before.map((r) => [r.id, r]));
    const ops: EditOp[] = [];
    for (const op of batch.ops) {
        if (op.entity !== 'item') {
            throw new Error(`reverseBatch handles map item ops only, not ${op.entity}.`);
        }
        const result = results.find((r) => r.entity === 'item' && r.id === op.id);
        if (!result) {
            throw new Error(`The reply has no version for map item ${op.id}.`);
        }
        const prior = old.get(op.id);
        if (op.op === 'create') {
            ops.push({ op: 'delete', entity: 'item', id: op.id, baseVersion: result.version });
        } else if (op.op === 'delete') {
            if (!prior) {
                throw new Error(`The record of map item ${op.id} before the delete is needed to restore it.`);
            }
            ops.push({ op: 'create', entity: 'item', id: op.id, baseVersion: result.version, data: dataOf(prior) });
        } else {
            if (!prior) {
                throw new Error(`The record of map item ${op.id} before the update is needed to reverse it.`);
            }
            const data: MapItemData = {};
            for (const f of Object.keys(op.data || {}) as Array<keyof MapItemData>) {
                (data as Record<string, unknown>)[f] = prior[f];
            }
            ops.push({ op: 'update', entity: 'item', id: op.id, baseVersion: result.version, data });
        }
    }
    return { batchId, ops };
}
