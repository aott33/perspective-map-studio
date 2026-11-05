// The undo stack (epic 4 entry 2): one step per saved edit, last first, each reversed at its current version.
// Entry 23: the history (the last ten done steps, newest first, with how long ago) and the undo-to-here run.
import { EditBatch, MapItemRecord } from '../contract';
import {
    HISTORY_SIZE, UNDO_EMPTY, UndoStack, agoText, busyText, canRedo, canUndo, failPending, finishPending, historyFooterText, ownVersion, pushStep, rebase,
    redoLabel, runAfterSave, startRedo, startRun, startUndo, stepLabel, undoHistory, undoLabel
} from '../undoStack';

const PAD = '33333333-3333-4333-8333-333333333333';

function pad(version: number, extra: Partial<MapItemRecord> = {}): MapItemRecord {
    return { id: PAD, kind: 'pad', name: 'Well pad', geometry: { type: 'Point', coordinates: [-104.97, 39.74] }, properties: {},
        assetId: null, overrides: {}, ends: null, attachment: null, version, deleted: false, ...extra };
}

const CREATE: EditBatch = { batchId: 'b1', ops: [{ op: 'create', entity: 'item', id: PAD, baseVersion: 0,
    data: { kind: 'pad', name: 'Well pad', geometry: { type: 'Point', coordinates: [-104.97, 39.74] } } }] };
const RENAME: EditBatch = { batchId: 'b2', ops: [{ op: 'update', entity: 'item', id: PAD, baseVersion: 1, data: { name: 'P31' } }] };
const LINK: EditBatch = { batchId: 'b3', ops: [{ op: 'update', entity: 'item', id: PAD, baseVersion: 2, data: { assetId: 'P12' } }] };

/** When the tracer's saves were made (epoch ms): a minute apart. */
const T0 = Date.UTC(2026, 10, 5, 14, 0, 0);
const MIN = 60_000;

/** The tracer's three saves: the pad added, renamed, linked. */
function threeSteps(): UndoStack {
    let stack = pushStep(UNDO_EMPTY, { label: stepLabel('add', 'Well pad'), batch: CREATE, before: [], results: [{ entity: 'item', id: PAD, version: 1 }],
        at: T0 });
    stack = pushStep(stack, { label: stepLabel('rename', 'P31'), batch: RENAME, before: [pad(1)], results: [{ entity: 'item', id: PAD, version: 2 }],
        at: T0 + MIN });
    stack = pushStep(stack, { label: stepLabel('link', 'P31'), batch: LINK, before: [pad(2, { name: 'P31' })],
        results: [{ entity: 'item', id: PAD, version: 3 }], at: T0 + 2 * MIN });
    return stack;
}

describe('the stack and its labels', () => {
    test('a saved edit is the last done step, named on the Undo button; nothing to redo', () => {
        const stack = threeSteps();
        expect(stack.done).toBe(3);
        expect(stack.steps.map((s) => s.label)).toEqual(['add Well pad', 'rename P31', 'link P31']);
        expect(undoLabel(stack)).toBe('Undo: link P31');
        expect(redoLabel(stack)).toBe('');
        expect(canUndo(stack)).toBe(true);
        expect(canRedo(stack)).toBe(false);
        expect(undoLabel(UNDO_EMPTY)).toBe('');
        expect(canUndo(UNDO_EMPTY)).toBe(false);
    });

    test('stepLabel names the action and the item as the plan does', () => {
        expect(stepLabel('add', 'Well pad')).toBe('add Well pad');
        expect(stepLabel('move', 'P31')).toBe('move P31');
        expect(stepLabel('unlink', 'P31')).toBe('unlink P31');
    });
});

describe('undo, last first, each at the record\'s current version', () => {
    test('the link, then the name, then the pad, each a reverse batch at the version this session last gave the item', () => {
        let stack = threeSteps();
        const current3 = pad(3, { name: 'P31', assetId: 'P12' });
        const undo1 = startUndo(stack, 'u1', [current3]);
        expect(undo1).not.toBeNull();
        expect(undo1!.batch).toEqual({ batchId: 'u1', ops: [{ op: 'update', entity: 'item', id: PAD, baseVersion: 3, data: { assetId: null } }] });
        expect(undoLabel(undo1!.stack)).toBe('');
        expect(canUndo(undo1!.stack)).toBe(false);
        stack = finishPending(undo1!.stack, 'u1', [{ entity: 'item', id: PAD, version: 4 }]);
        expect(stack.done).toBe(2);
        expect(stack.pending).toBeNull();
        expect(undoLabel(stack)).toBe('Undo: rename P31');
        expect(redoLabel(stack)).toBe('Redo: link P31');

        // The rename's reply said version 2, but the item is at 4 now: the reverse goes at 4.
        const current4 = pad(4, { name: 'P31' });
        const undo2 = startUndo(stack, 'u2', [current4]);
        expect(undo2!.batch).toEqual({ batchId: 'u2', ops: [{ op: 'update', entity: 'item', id: PAD, baseVersion: 4, data: { name: 'Well pad' } }] });
        stack = finishPending(undo2!.stack, 'u2', [{ entity: 'item', id: PAD, version: 5 }]);
        expect(undoLabel(stack)).toBe('Undo: add Well pad');

        const undo3 = startUndo(stack, 'u3', [pad(5)]);
        expect(undo3!.batch).toEqual({ batchId: 'u3', ops: [{ op: 'delete', entity: 'item', id: PAD, baseVersion: 5 }] });
        stack = finishPending(undo3!.stack, 'u3', [{ entity: 'item', id: PAD, version: 6 }]);
        expect(stack.done).toBe(0);
        expect(undoLabel(stack)).toBe('');
        expect(redoLabel(stack)).toBe('Redo: add Well pad');
    });

    test('redo replays in order: the pad comes back as a restore at the tombstone version, then the name, then the link', () => {
        let stack = threeSteps();
        const current3 = pad(3, { name: 'P31', assetId: 'P12' });
        for (const [id, records, version] of [['u1', [current3], 4], ['u2', [pad(4, { name: 'P31' })], 5], ['u3', [pad(5)], 6]] as const) {
            const started = startUndo(stack, id, records.slice());
            stack = finishPending(started!.stack, id, [{ entity: 'item', id: PAD, version }]);
        }
        // Undone: the delegate dropped the tombstone, so the restore keeps the delete reply's version (6).
        const redo1 = startRedo(stack, 'r1', []);
        expect(redo1!.batch).toEqual({ batchId: 'r1', ops: [{ op: 'create', entity: 'item', id: PAD, baseVersion: 6,
            data: { kind: 'pad', name: 'Well pad', geometry: { type: 'Point', coordinates: [-104.97, 39.74] }, properties: {},
                assetId: null, overrides: {}, ends: null, attachment: null } }] });
        stack = finishPending(redo1!.stack, 'r1', [{ entity: 'item', id: PAD, version: 7 }]);
        expect(stack.done).toBe(1);
        expect(undoLabel(stack)).toBe('Undo: add Well pad');
        expect(redoLabel(stack)).toBe('Redo: rename P31');

        const redo2 = startRedo(stack, 'r2', [pad(7)]);
        expect(redo2!.batch).toEqual({ batchId: 'r2', ops: [{ op: 'update', entity: 'item', id: PAD, baseVersion: 7, data: { name: 'P31' } }] });
        stack = finishPending(redo2!.stack, 'r2', [{ entity: 'item', id: PAD, version: 8 }]);
        const redo3 = startRedo(stack, 'r3', [pad(8, { name: 'P31' })]);
        expect(redo3!.batch).toEqual({ batchId: 'r3', ops: [{ op: 'update', entity: 'item', id: PAD, baseVersion: 8, data: { assetId: 'P12' } }] });
        stack = finishPending(redo3!.stack, 'r3', [{ entity: 'item', id: PAD, version: 9 }]);
        expect(stack.done).toBe(3);
        expect(redoLabel(stack)).toBe('');
        // And the step can be undone again, at the new version.
        expect(startUndo(stack, 'u4', [pad(9, { name: 'P31', assetId: 'P12' })])!.batch.ops[0].baseVersion).toBe(9);
    });

    test('a move undoes to the old geometry and redoes to the new one', () => {
        const moved: EditBatch = { batchId: 'm', ops: [{ op: 'update', entity: 'item', id: PAD, baseVersion: 1,
            data: { geometry: { type: 'Point', coordinates: [-104.9, 39.7] } } }] };
        let stack = pushStep(UNDO_EMPTY, { label: stepLabel('move', 'Well pad'), batch: moved, before: [pad(1)],
            results: [{ entity: 'item', id: PAD, version: 2 }], at: T0 });
        const undo = startUndo(stack, 'u', [pad(2, { geometry: { type: 'Point', coordinates: [-104.9, 39.7] } })]);
        expect(undo!.batch.ops[0]).toEqual({ op: 'update', entity: 'item', id: PAD, baseVersion: 2,
            data: { geometry: { type: 'Point', coordinates: [-104.97, 39.74] } } });
        stack = finishPending(undo!.stack, 'u', [{ entity: 'item', id: PAD, version: 3 }]);
        const redo = startRedo(stack, 'r', [pad(3)]);
        expect(redo!.batch.ops[0]).toEqual({ op: 'update', entity: 'item', id: PAD, baseVersion: 3,
            data: { geometry: { type: 'Point', coordinates: [-104.9, 39.7] } } });
    });
});

describe('a reverse in flight, refused, or overtaken', () => {
    test('while a reverse is in flight both buttons are off and a second start is refused', () => {
        const stack = threeSteps();
        const started = startUndo(stack, 'u1', [pad(3, { name: 'P31', assetId: 'P12' })]);
        expect(canUndo(started!.stack)).toBe(false);
        expect(canRedo(started!.stack)).toBe(false);
        expect(startUndo(started!.stack, 'u2', [])).toBeNull();
        expect(startRedo(started!.stack, 'r1', [])).toBeNull();
    });

    test('a refused reverse leaves the step where it was, ready to try again', () => {
        const stack = threeSteps();
        const started = startUndo(stack, 'u1', [pad(3, { name: 'P31', assetId: 'P12' })]);
        const failed = failPending(started!.stack, 'u1');
        expect(failed.pending).toBeNull();
        expect(failed.done).toBe(3);
        expect(undoLabel(failed)).toBe('Undo: link P31');
        expect(failPending(stack, 'nope')).toBe(stack);
        expect(finishPending(started!.stack, 'nope', [])).toBe(started!.stack);
    });

    test('a new edit after an undo drops the redo chain; an undo in flight stays, a redo in flight is dropped', () => {
        let stack = threeSteps();
        const undo = startUndo(stack, 'u1', [pad(3, { name: 'P31', assetId: 'P12' })]);
        stack = finishPending(undo!.stack, 'u1', [{ entity: 'item', id: PAD, version: 4 }]);
        expect(redoLabel(stack)).toBe('Redo: link P31');
        const move: EditBatch = { batchId: 'm', ops: [{ op: 'update', entity: 'item', id: PAD, baseVersion: 4,
            data: { geometry: { type: 'Point', coordinates: [-104.9, 39.7] } } }] };
        stack = pushStep(stack, { label: 'move P31', batch: move, before: [pad(4, { name: 'P31' })], results: [{ entity: 'item', id: PAD, version: 5 }], at: T0 });
        expect(stack.steps.map((s) => s.label)).toEqual(['add Well pad', 'rename P31', 'move P31']);
        expect(redoLabel(stack)).toBe('');
        expect(undoLabel(stack)).toBe('Undo: move P31');

        const redoing = startRedo(finishPending(startUndo(stack, 'u2', [pad(5, { name: 'P31' })])!.stack, 'u2',
            [{ entity: 'item', id: PAD, version: 6 }]), 'r1', [pad(6, { name: 'P31' })]);
        const overtaken = pushStep(redoing!.stack, { label: 'rename P32', batch: RENAME, before: [pad(6)], results: [{ entity: 'item', id: PAD, version: 7 }],
            at: T0 });
        expect(overtaken.pending).toBeNull();
        expect(overtaken.steps.map((s) => s.label)).toEqual(['add Well pad', 'rename P31', 'rename P32']);
        expect(finishPending(overtaken, 'r1', [{ entity: 'item', id: PAD, version: 8 }])).toBe(overtaken);

        const undoing = startUndo(overtaken, 'u3', [pad(7)]);
        const pushedWhileUndoing = pushStep(undoing!.stack, { label: 'link P32', batch: LINK, before: [pad(7)], results: [{ entity: 'item', id: PAD, version: 8 }],
            at: T0 });
        expect(pushedWhileUndoing.pending).toEqual(undoing!.stack.pending);
    });

    test('a step whose reverse cannot be built (its record is gone) is refused, not sent wrong', () => {
        const stack = pushStep(UNDO_EMPTY, { label: 'rename P31', batch: RENAME, before: [], results: [{ entity: 'item', id: PAD, version: 2 }], at: T0 });
        expect(startUndo(stack, 'u', [pad(2)])).toBeNull();
    });

    test('rebase takes the version this session\'s own steps last gave each item and leaves an unknown one alone', () => {
        const stack = threeSteps();
        const batch: EditBatch = { batchId: 'x', ops: [
            { op: 'update', entity: 'item', id: PAD, baseVersion: 1, data: { name: 'a' } },
            { op: 'delete', entity: 'item', id: 'other', baseVersion: 9 }] };
        expect(ownVersion(stack, PAD)).toBe(3);
        expect(ownVersion(stack, 'other')).toBeNull();
        expect(rebase(batch, stack).ops.map((op) => op.baseVersion)).toEqual([3, 9]);
    });

    test('another editor\'s later version is never the base (FR-17): the reverse keeps the own one, for the Gateway to refuse conflict', () => {
        const stack = threeSteps();
        // mapoperator moved the pad on to version 7 since this session's link (version 3): the records say 7.
        const theirs = pad(7, { name: 'P31', assetId: 'P12', geometry: { type: 'Point', coordinates: [-104.9, 39.7] } });
        const undo = startUndo(stack, 'u1', [theirs]);
        expect(undo!.batch.ops[0].baseVersion).toBe(3);
        // The records before the reverse are still taken from what is on the map, for a later redo.
        expect(undo!.stack.pending!.before).toEqual([theirs]);
    });

    test('never mutates the stack it is given', () => {
        const stack = threeSteps();
        const copy = JSON.parse(JSON.stringify(stack));
        const started = startUndo(stack, 'u1', [pad(3, { name: 'P31', assetId: 'P12' })]);
        finishPending(started!.stack, 'u1', [{ entity: 'item', id: PAD, version: 4 }]);
        pushStep(stack, { label: 'x', batch: RENAME, before: [], results: [], at: T0 });
        expect(stack).toEqual(copy);
    });
});

describe('the history: the last ten done steps, newest first, with how long ago (entry 23)', () => {
    test('three saved edits list newest first, each with the undos choosing it makes and its time', () => {
        const rows = undoHistory(threeSteps());
        expect(rows).toEqual([
            { label: 'link P31', at: T0 + 2 * MIN, count: 1 },
            { label: 'rename P31', at: T0 + MIN, count: 2 },
            { label: 'add Well pad', at: T0, count: 3 }
        ]);
        expect(undoHistory(UNDO_EMPTY)).toEqual([]);
    });

    test('only done steps are listed: an undone one is Redo\'s; a step whose reverse is in flight stays until it saves', () => {
        const stack = threeSteps();
        const started = startUndo(stack, 'u1', [pad(3, { name: 'P31', assetId: 'P12' })]);
        expect(undoHistory(started!.stack).map((r) => r.label)).toEqual(['link P31', 'rename P31', 'add Well pad']);
        const undone = finishPending(started!.stack, 'u1', [{ entity: 'item', id: PAD, version: 4 }], T0 + 5 * MIN);
        expect(undoHistory(undone).map((r) => [r.label, r.count])).toEqual([['rename P31', 1], ['add Well pad', 2]]);
        // Redone, the step is done again from the redo's time.
        const redo = startRedo(undone, 'r1', [pad(4, { name: 'P31' })]);
        const redone = finishPending(redo!.stack, 'r1', [{ entity: 'item', id: PAD, version: 5 }], T0 + 7 * MIN);
        expect(undoHistory(redone)[0]).toEqual({ label: 'link P31', at: T0 + 7 * MIN, count: 1 });
    });

    test('at most ten rows, the newest ten', () => {
        let stack = UNDO_EMPTY;
        for (let i = 1; i <= 12; i++) {
            stack = pushStep(stack, { label: 'rename P' + i, batch: RENAME, before: [pad(i)], results: [{ entity: 'item', id: PAD, version: i + 1 }],
                at: T0 + i * MIN });
        }
        const rows = undoHistory(stack);
        expect(HISTORY_SIZE).toBe(10);
        expect(rows).toHaveLength(10);
        expect(rows[0]).toEqual({ label: 'rename P12', at: T0 + 12 * MIN, count: 1 });
        expect(rows[9]).toEqual({ label: 'rename P3', at: T0 + 3 * MIN, count: 10 });
    });

    test('how long ago: just now under a minute, then minutes, then hours', () => {
        expect(agoText(T0, T0)).toBe('just now');
        expect(agoText(T0, T0 + 59_999)).toBe('just now');
        expect(agoText(T0, T0 + MIN)).toBe('1 min ago');
        expect(agoText(T0, T0 + 25 * MIN + 30_000)).toBe('25 min ago');
        expect(agoText(T0, T0 + 59 * MIN)).toBe('59 min ago');
        expect(agoText(T0, T0 + 60 * MIN)).toBe('1 h ago');
        expect(agoText(T0, T0 + 150 * MIN)).toBe('2 h ago');
        // A clock that went back reads as just now, never a negative age.
        expect(agoText(T0, T0 - 5 * MIN)).toBe('just now');
    });

    test('the footer counts the marked rows as the mock says it, and says what is in flight', () => {
        expect(historyFooterText(3, '')).toBe('Click to undo back to here: undoes 3 changes');
        expect(historyFooterText(1, '')).toBe('Click to undo back to here: undoes 1 change');
        expect(historyFooterText(0, '')).toBe('Click a step to undo back to it');
        expect(historyFooterText(2, 'Undoing...')).toBe('Undoing...');
        expect(historyFooterText(2, 'Saving...')).toBe('Saving...');
    });

    test('what Undo and Redo wait for: an undo or a redo in flight, or an edit being saved; nothing otherwise', () => {
        const stack = threeSteps();
        expect(busyText(stack, false)).toBe('');
        expect(busyText(UNDO_EMPTY, false)).toBe('');
        expect(busyText(stack, true)).toBe('Saving...');
        const undoing = startUndo(stack, 'u1', [pad(3, { name: 'P31', assetId: 'P12' })])!.stack;
        expect(busyText(undoing, false)).toBe('Undoing...');
        const undone = finishPending(undoing, 'u1', [{ entity: 'item', id: PAD, version: 4 }], T0);
        expect(busyText(startRedo(undone, 'r1', [pad(4, { name: 'P31' })])!.stack, true)).toBe('Redoing...');
    });
});

describe('undo to here: a run of single undos (entry 23)', () => {
    test('the second newest chosen is a run of two; each saved reverse leaves one fewer, the last ends it', () => {
        const stack = threeSteps();
        const run = startRun(stack, 2);
        expect(run).toEqual({ left: 2 });
        const next = runAfterSave(run!);
        expect(next).toEqual({ left: 1 });
        expect(runAfterSave(next!)).toBeNull();
    });

    test('never more than the done steps or the history\'s ten; nothing with nothing to undo, a reverse in flight, or a bad count', () => {
        const stack = threeSteps();
        expect(startRun(stack, 5)).toEqual({ left: 3 });
        let many = UNDO_EMPTY;
        for (let i = 1; i <= 12; i++) {
            many = pushStep(many, { label: 'rename P' + i, batch: RENAME, before: [pad(i)], results: [{ entity: 'item', id: PAD, version: i + 1 }], at: T0 });
        }
        expect(startRun(many, 12)).toEqual({ left: 10 });
        expect(startRun(UNDO_EMPTY, 1)).toBeNull();
        expect(startRun(stack, 0)).toBeNull();
        expect(startRun(stack, -1)).toBeNull();
        expect(startRun(stack, 1.5)).toBeNull();
        const inFlight = startUndo(stack, 'u1', [pad(3, { name: 'P31', assetId: 'P12' })])!.stack;
        expect(startRun(inFlight, 2)).toBeNull();
    });

    test('the run\'s steps are the single undos, in order, one reverse batch each, each at the version the last one gave', () => {
        // The second newest chosen out of three: the link's reverse, then the name's; the pad stays.
        let stack = threeSteps();
        let run = startRun(stack, 2);
        const sent: EditBatch[] = [];
        const records: MapItemRecord[][] = [[pad(3, { name: 'P31', assetId: 'P12' })], [pad(4, { name: 'P31' })]];
        let version = 4;
        while (run !== null) {
            const started = startUndo(stack, 'u' + version, records[sent.length]);
            sent.push(started!.batch);
            stack = finishPending(started!.stack, 'u' + version, [{ entity: 'item', id: PAD, version }], T0 + version * MIN);
            version++;
            run = runAfterSave(run);
        }
        expect(sent).toEqual([
            { batchId: 'u4', ops: [{ op: 'update', entity: 'item', id: PAD, baseVersion: 3, data: { assetId: null } }] },
            { batchId: 'u5', ops: [{ op: 'update', entity: 'item', id: PAD, baseVersion: 4, data: { name: 'Well pad' } }] }
        ]);
        expect(stack.done).toBe(1);
        expect(undoLabel(stack)).toBe('Undo: add Well pad');
        // Redo then redoes one.
        expect(redoLabel(stack)).toBe('Redo: rename P31');
    });
});
