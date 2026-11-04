/**
 * The undo stack (epic 4 entry 2; FR-17, EXPERIENCE.md Undo and Redo): one stack per session of the
 * edits this browser saved, each a step with the batch that was saved, the records as they were
 * before it (`before`, taken from the delegate's items at send time) and the reply's versions, with a
 * label naming it ("add Well pad", "move P31", "rename P31", "link P31"). One step per saved edit,
 * last first, nothing grouped (owner decision, 2026-11-04). Undo sends the reverse of the last done
 * step (undo.ts `reverseBatch`, rebased to each record's current version, since later steps may have
 * moved it on), Redo the reverse of the last undone one; when the reverse saves, the step keeps its
 * label and takes the reverse as its batch, so each direction is the other's reverse and the cursor
 * `done` moves. Pure functions only, unit tested in node; the delegate holds the stack and sends.
 */

import { EditBatch, MapItemRecord } from './contract';
import { reverseBatch } from './undo';

/** One op's result in an edits.apply.reply. */
export interface SaveResult {
    entity: string;
    id: string;
    version: number;
}

export interface UndoStep {
    /** The step's words after "Undo: " or "Redo: ". */
    label: string;
    /** The batch that was saved: the edit when the step is done, its reverse once it was undone. */
    batch: EditBatch;
    /** The records of the batch's map items as they were before it (a create's id is absent). */
    before: MapItemRecord[];
    /** The reply's versions, what reverseBatch bases the reverse on. */
    results: SaveResult[];
}

/** The reverse batch in flight for a step (its index), with the records before it, until its reply. */
export interface PendingStep {
    direction: 'undo' | 'redo';
    index: number;
    batch: EditBatch;
    before: MapItemRecord[];
}

export interface UndoStack {
    steps: UndoStep[];
    /** The steps done: `steps[0..done)` are done, `steps[done..]` undone and ready to redo. */
    done: number;
    pending: PendingStep | null;
}

export const UNDO_EMPTY: UndoStack = { steps: [], done: 0, pending: null };

/**
 * A saved edit joins the stack as its last done step; the undone steps after the cursor are dropped (a
 * new edit ends the redo chain). A redo in flight is dropped with them (its late reply then changes
 * nothing); an undo in flight stays, since its step is before the cursor.
 */
export function pushStep(stack: UndoStack, step: UndoStep): UndoStack {
    const pending = stack.pending && stack.pending.direction === 'undo' ? stack.pending : null;
    return { steps: stack.steps.slice(0, stack.done).concat([step]), done: stack.done + 1, pending };
}

export function canUndo(stack: UndoStack): boolean {
    return stack.pending === null && stack.done > 0;
}

export function canRedo(stack: UndoStack): boolean {
    return stack.pending === null && stack.done < stack.steps.length;
}

/** The Undo button's words ("Undo: add Well pad"), or '' with nothing to undo or a reverse in flight. */
export function undoLabel(stack: UndoStack): string {
    return canUndo(stack) ? 'Undo: ' + stack.steps[stack.done - 1].label : '';
}

/** The Redo button's words ("Redo: add Well pad"), or '' with nothing to redo or a reverse in flight. */
export function redoLabel(stack: UndoStack): string {
    return canRedo(stack) ? 'Redo: ' + stack.steps[stack.done].label : '';
}

/** The records of the batch's map items among `records` (the current ones), for the pending step's `before`. */
function recordsOf(records: MapItemRecord[], batch: EditBatch): MapItemRecord[] {
    return records.filter((r) => batch.ops.some((op) => op.entity === 'item' && op.id === r.id));
}

/**
 * The version this session's own last step gave a map item: the highest over the stack's replies (the create's,
 * the latest own update's or reverse's), or null for an id none of them wrote.
 */
export function ownVersion(stack: UndoStack, id: string): number | null {
    let own: number | null = null;
    for (const step of stack.steps) {
        for (const r of step.results) {
            if (r.entity === 'item' && r.id === id && (own === null || r.version > own)) {
                own = r.version;
            }
        }
    }
    return own;
}

/**
 * The reverse at the version this session's own last step gave each record (FR-17): `reverseBatch` bases an op on
 * its step's own reply, but a later own step (or its undo) may have moved the record on. Never a version another
 * session produced: when another editor changed the item since, the stored version is past the own one and the
 * Gateway refuses the reverse `conflict`, naming who changed it, instead of saving over their change.
 */
export function rebase(batch: EditBatch, stack: UndoStack): EditBatch {
    return {
        batchId: batch.batchId,
        ops: batch.ops.map((op) => {
            const own = ownVersion(stack, op.id);
            return own === null ? op : { ...op, baseVersion: own };
        })
    };
}

function start(stack: UndoStack, direction: 'undo' | 'redo', batchId: string, records: MapItemRecord[]):
    { stack: UndoStack; batch: EditBatch } | null {
    const index = direction === 'undo' ? stack.done - 1 : stack.done;
    const step = stack.steps[index];
    if (stack.pending !== null || !step) {
        return null;
    }
    let batch: EditBatch;
    try {
        batch = rebase(reverseBatch(batchId, step.before, step.batch, step.results), stack);
    } catch (err) {
        return null;
    }
    const before = recordsOf(records, batch);
    return { stack: { ...stack, pending: { direction, index, batch, before } }, batch };
}

/**
 * Undo the last done step: the reverse batch to send, and the stack with it pending; null with nothing
 * to undo, a reverse already in flight, or a step whose reverse cannot be built (its records went).
 */
export function startUndo(stack: UndoStack, batchId: string, records: MapItemRecord[]): { stack: UndoStack; batch: EditBatch } | null {
    return start(stack, 'undo', batchId, records);
}

/** Redo the last undone step: the batch that puts it back, and the stack with it pending; null as for undo. */
export function startRedo(stack: UndoStack, batchId: string, records: MapItemRecord[]): { stack: UndoStack; batch: EditBatch } | null {
    return start(stack, 'redo', batchId, records);
}

/**
 * The pending reverse saved: the step takes the reverse as its batch (with the records before it and
 * the reply's versions) and the cursor moves, so the next undo or redo reverses it again. A reply for
 * another batch changes nothing.
 */
export function finishPending(stack: UndoStack, batchId: string, results: SaveResult[]): UndoStack {
    const pending = stack.pending;
    if (!pending || pending.batch.batchId !== batchId) {
        return stack;
    }
    const step = stack.steps[pending.index];
    if (!step) {
        return { ...stack, pending: null };
    }
    const steps = stack.steps.slice();
    steps[pending.index] = { label: step.label, batch: pending.batch, before: pending.before, results };
    return { steps, done: pending.direction === 'undo' ? pending.index : pending.index + 1, pending: null };
}

/** The pending reverse was refused (a conflict, a role): the step stays as it was, ready to try again. */
export function failPending(stack: UndoStack, batchId: string): UndoStack {
    if (!stack.pending || stack.pending.batch.batchId !== batchId) {
        return stack;
    }
    return { ...stack, pending: null };
}

/** The words of a step: what was done to which item ("add Well pad", "move P31", "rename P31", "link P31"). */
export function stepLabel(action: 'add' | 'move' | 'rename' | 'link' | 'unlink', name: string): string {
    return action + ' ' + name;
}
