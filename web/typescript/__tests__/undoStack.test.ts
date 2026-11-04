// The undo stack (epic 4 entry 2): one step per saved edit, last first, each reversed at its current version.
import { EditBatch, MapItemRecord } from '../contract';
import {
    UNDO_EMPTY, UndoStack, canRedo, canUndo, failPending, finishPending, ownVersion, pushStep, rebase, redoLabel, startRedo, startUndo,
    stepLabel, undoLabel
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

/** The tracer's three saves: the pad added, renamed, linked. */
function threeSteps(): UndoStack {
    let stack = pushStep(UNDO_EMPTY, { label: stepLabel('add', 'Well pad'), batch: CREATE, before: [], results: [{ entity: 'item', id: PAD, version: 1 }] });
    stack = pushStep(stack, { label: stepLabel('rename', 'P31'), batch: RENAME, before: [pad(1)], results: [{ entity: 'item', id: PAD, version: 2 }] });
    stack = pushStep(stack, { label: stepLabel('link', 'P31'), batch: LINK, before: [pad(2, { name: 'P31' })],
        results: [{ entity: 'item', id: PAD, version: 3 }] });
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
            results: [{ entity: 'item', id: PAD, version: 2 }] });
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
        stack = pushStep(stack, { label: 'move P31', batch: move, before: [pad(4, { name: 'P31' })], results: [{ entity: 'item', id: PAD, version: 5 }] });
        expect(stack.steps.map((s) => s.label)).toEqual(['add Well pad', 'rename P31', 'move P31']);
        expect(redoLabel(stack)).toBe('');
        expect(undoLabel(stack)).toBe('Undo: move P31');

        const redoing = startRedo(finishPending(startUndo(stack, 'u2', [pad(5, { name: 'P31' })])!.stack, 'u2',
            [{ entity: 'item', id: PAD, version: 6 }]), 'r1', [pad(6, { name: 'P31' })]);
        const overtaken = pushStep(redoing!.stack, { label: 'rename P32', batch: RENAME, before: [pad(6)], results: [{ entity: 'item', id: PAD, version: 7 }] });
        expect(overtaken.pending).toBeNull();
        expect(overtaken.steps.map((s) => s.label)).toEqual(['add Well pad', 'rename P31', 'rename P32']);
        expect(finishPending(overtaken, 'r1', [{ entity: 'item', id: PAD, version: 8 }])).toBe(overtaken);

        const undoing = startUndo(overtaken, 'u3', [pad(7)]);
        const pushedWhileUndoing = pushStep(undoing!.stack, { label: 'link P32', batch: LINK, before: [pad(7)], results: [{ entity: 'item', id: PAD, version: 8 }] });
        expect(pushedWhileUndoing.pending).toEqual(undoing!.stack.pending);
    });

    test('a step whose reverse cannot be built (its record is gone) is refused, not sent wrong', () => {
        const stack = pushStep(UNDO_EMPTY, { label: 'rename P31', batch: RENAME, before: [], results: [{ entity: 'item', id: PAD, version: 2 }] });
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
        pushStep(stack, { label: 'x', batch: RENAME, before: [], results: [] });
        expect(stack).toEqual(copy);
    });
});
