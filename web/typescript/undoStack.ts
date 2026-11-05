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
 *
 * Entry 23 (owner, 2026-11-05, R28): Undo and Redo are the toolbar's, and a chevron beside Undo opens the
 * history, the last ten done steps newest first with how long ago each was saved (`undoHistory`, `agoText`).
 * Choosing one undoes it and every later step as a run of single undos (`startRun`, `runAfterSave`): still one
 * reverse batch per step, the next sent only after the last saved, never grouped (the 2026-11-04 rule).
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
    /**
     * When the step's batch was saved (epoch ms, entry 23): the edit's save, then each undo's or redo's, so a done step
     * reads in the history as how long ago it was done (a step redone reads as the redo).
     */
    at: number;
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
 * The pending reverse saved at `at`: the step takes the reverse as its batch (with the records before it,
 * the reply's versions and the time) and the cursor moves, so the next undo or redo reverses it again. A
 * reply for another batch changes nothing.
 */
export function finishPending(stack: UndoStack, batchId: string, results: SaveResult[], at: number = Date.now()): UndoStack {
    const pending = stack.pending;
    if (!pending || pending.batch.batchId !== batchId) {
        return stack;
    }
    const step = stack.steps[pending.index];
    if (!step) {
        return { ...stack, pending: null };
    }
    const steps = stack.steps.slice();
    steps[pending.index] = { label: step.label, batch: pending.batch, before: pending.before, results, at };
    return { steps, done: pending.direction === 'undo' ? pending.index : pending.index + 1, pending: null };
}

/** The pending reverse was refused (a conflict, a role): the step stays as it was, ready to try again. */
export function failPending(stack: UndoStack, batchId: string): UndoStack {
    if (!stack.pending || stack.pending.batch.batchId !== batchId) {
        return stack;
    }
    return { ...stack, pending: null };
}

/** The words of a step: what was done to which item ("add Well pad", "move P31", "rename P31", "link P31", "edit P31" for a kind change). */
export function stepLabel(action: 'add' | 'move' | 'rename' | 'link' | 'unlink' | 'edit', name: string): string {
    return action + ' ' + name;
}

/** How many steps the history lists (owner, 2026-11-05: "the last 10 actions"). */
export const HISTORY_SIZE = 10;

/** One row of the history: a done step, newest first. */
export interface HistoryRow {
    label: string;
    /** When the step was saved (epoch ms). */
    at: number;
    /** How many single undos choosing this row makes: this step and every later one (1 for the newest). */
    count: number;
}

/**
 * The history the chevron beside Undo opens (entry 23): the last ten done steps of this session, newest first,
 * each with the number of undos choosing it makes. Undone steps (Redo's) are not listed; a step whose reverse is
 * in flight still is, until its reply moves the cursor.
 */
export function undoHistory(stack: UndoStack): HistoryRow[] {
    const rows: HistoryRow[] = [];
    for (let i = stack.done - 1; i >= 0 && rows.length < HISTORY_SIZE; i--) {
        const step = stack.steps[i];
        rows.push({ label: step.label, at: step.at, count: stack.done - i });
    }
    return rows;
}

/** How long ago a step was saved, as the history says it: "just now" under a minute, "4 min ago", "2 h ago". */
export function agoText(at: number, now: number): string {
    const seconds = Math.max(0, Math.floor((now - at) / 1000));
    if (seconds < 60) {
        return 'just now';
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return minutes + ' min ago';
    }
    return Math.floor(minutes / 60) + ' h ago';
}

/**
 * Why Undo, Redo and the history wait (entry 23), in their words: a reverse in flight ("Undoing...", "Redoing...") or a
 * tool's or field's edit being saved ("Saving...", its step not on the stack yet); '' when nothing is in flight.
 */
export function busyText(stack: UndoStack, editInFlight: boolean): string {
    if (stack.pending !== null) {
        return stack.pending.direction === 'undo' ? 'Undoing...' : 'Redoing...';
    }
    return editInFlight ? 'Saving...' : '';
}

/**
 * The history's footer: with a row marked (the pointer on it, or the keyboard's focus) how many changes choosing it
 * undoes ("Click to undo back to here: undoes 3 changes", the owner's mock); with none marked how to use it; while
 * something is in flight, what (`busyText`; the rows take no choice meanwhile).
 */
export function historyFooterText(count: number, busy: string): string {
    if (busy !== '') {
        return busy;
    }
    if (count < 1) {
        return 'Click a step to undo back to it';
    }
    return 'Click to undo back to here: undoes ' + count + (count === 1 ? ' change' : ' changes');
}

/**
 * An undo-to-here run (entry 23): the single undos still to send. The delegate sends the first at once and each next one
 * only after the last reverse saved; a refusal or another edit ends it.
 */
export interface UndoRun {
    left: number;
}

/**
 * The run for a history row chosen: `count` single undos (the chosen step and every later one), at most the done steps
 * and the history's ten; null with nothing to undo, a reverse already in flight, or a count that is not a whole number
 * from 1.
 */
export function startRun(stack: UndoStack, count: number): UndoRun | null {
    if (!canUndo(stack) || !Number.isInteger(count) || count < 1) {
        return null;
    }
    return { left: Math.min(count, stack.done, HISTORY_SIZE) };
}

/** One reverse of the run saved: the run with one undo fewer to send, or null when that was its last. */
export function runAfterSave(run: UndoRun): UndoRun | null {
    return run.left > 1 ? { left: run.left - 1 } : null;
}
