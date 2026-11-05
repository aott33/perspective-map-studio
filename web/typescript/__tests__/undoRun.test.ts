// Undo to here in the store delegate (epic 4 entry 23, owner 2026-11-05, R28): the history's row chosen undoes it and
// every later step as a run of single undos, one reverse batch each, in order, the next sent only after the last saved;
// a refusal stops the run with its reason on the save status, and another edit ends it. The delegate is driven as the
// Gateway would: every `edits.apply` it fires is answered by an `edits.apply.reply` or an `error`. Perspective's base
// class is stood in for (a virtual module: the package ships no entry Jest resolves), so the test runs in node.

jest.mock('@inductiveautomation/perspective-client', () => ({
    ComponentStoreDelegate: class {
        component: unknown;
        fired: unknown[] = [];

        constructor(component: unknown) {
            this.component = component;
        }

        notify(): void {
            // The component's redraw; nothing to draw here.
        }

        fireEvent(_name: string, message: unknown): void {
            this.fired.push(message);
        }
    }
}), { virtual: true });

import { AbstractUIElementStore } from '@inductiveautomation/perspective-client';
import { Kind } from '../adapters';
import { EditBatch } from '../contract';
import { MESSAGE_EVENT, MessageTypes } from '../messages';
import { MapStudioStoreDelegate } from '../MapStudioStoreDelegate';
import { REPLY_TIMEOUT_MS } from '../unsaved';
import { redoLabel, undoHistory, undoLabel } from '../undoStack';

const PAD: Kind = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] };

interface Sent {
    id: string;
    type: string;
    body: EditBatch;
}

let delegate: MapStudioStoreDelegate;
let logged: string[];
let seq = 0;

/** Every edits.apply the delegate fired, in order. */
function sent(): Sent[] {
    return ((delegate as unknown as { fired: Sent[] }).fired).filter((m) => m.type === MessageTypes.EDITS_APPLY);
}

/** The last edits.apply fired. */
function last(): Sent {
    const all = sent();
    return all[all.length - 1];
}

/** The Gateway saves a batch: each op's record one version past its base. */
function save(message: Sent): void {
    seq++;
    delegate.handleEvent(MESSAGE_EVENT, {
        v: 1, type: MessageTypes.EDITS_APPLY_REPLY, id: message.id,
        body: { batchId: message.body.batchId, seq, results: message.body.ops.map((op) => ({ entity: op.entity, id: op.id, version: op.baseVersion + 1 })) }
    });
}

/** The Gateway refuses a batch with `code` and `message`. */
function refuse(message: Sent, code: string, words: string): void {
    delegate.handleEvent(MESSAGE_EVENT, { v: 1, type: MessageTypes.ERROR, id: message.id, body: { code, message: words, batchId: message.body.batchId } });
}

/** Three pads added and saved, oldest first: the matrix's "three saved edits". */
function threePads(): string[] {
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
        ids.push(delegate.createPoint([-104.99 + i * 0.01, 39.74], PAD));
        save(last());
    }
    return ids;
}

beforeEach(() => {
    jest.useFakeTimers();
    logged = [];
    jest.spyOn(console, 'info').mockImplementation((...args: unknown[]) => {
        logged.push(args.map(String).join(' '));
    });
    delegate = new MapStudioStoreDelegate({} as unknown as AbstractUIElementStore);
});

afterEach(() => {
    delegate.stopReplay();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('undo to here, a run of single undos (entry 23)', () => {
    test('the second newest chosen: two undos, newest first, one batch each, the next only after the last saved; the oldest stays; Redo redoes one',
        () => {
            const [p1, p2, p3] = threePads();
            const history = undoHistory(delegate.mapStateToProps().undo);
            expect(history.map((r) => [r.label, r.count])).toEqual([['add Well pad', 1], ['add Well pad', 2], ['add Well pad', 3]]);
            const before = sent().length;

            delegate.undoTo(2);
            // One reverse at a time: the newest pad's delete, and nothing else until it is saved.
            expect(sent()).toHaveLength(before + 1);
            expect(last().body.ops).toEqual([{ op: 'delete', entity: 'item', id: p3, baseVersion: 1 }]);
            expect(delegate.mapStateToProps().save).toEqual({ state: 'saving', itemId: p3 });
            save(last());
            // Saved: the next single undo goes, the second newest pad's delete.
            expect(sent()).toHaveLength(before + 2);
            expect(last().body.ops).toEqual([{ op: 'delete', entity: 'item', id: p2, baseVersion: 1 }]);
            expect(delegate.mapStateToProps().save).toEqual({ state: 'saving', itemId: p2 });
            save(last());
            // The run is done: nothing more is sent, the oldest stays.
            expect(sent()).toHaveLength(before + 2);
            const state = delegate.mapStateToProps();
            expect(state.undo.done).toBe(1);
            expect(state.undo.pending).toBeNull();
            expect(undoLabel(state.undo)).toBe('Undo: add Well pad');
            expect(undoHistory(state.undo)).toHaveLength(1);
            expect(state.items.filter((i) => !i.deleted).map((i) => i.id)).toEqual([p1]);
            expect(state.save).toEqual({ state: 'saved', itemId: p2, version: 2 });

            // Redo then redoes one step: the second newest pad comes back, and only it.
            expect(redoLabel(state.undo)).toBe('Redo: add Well pad');
            delegate.redo();
            expect(sent()).toHaveLength(before + 3);
            expect(last().body.ops).toMatchObject([{ op: 'create', entity: 'item', id: p2 }]);
            save(last());
            expect(sent()).toHaveLength(before + 3);
            expect(delegate.mapStateToProps().undo.done).toBe(2);
        });

    test('a refusal stops the run: no next undo is sent, the reason is on the save status, the refused step stays to try again', () => {
        const [, p2, p3] = threePads();
        const before = sent().length;
        delegate.undoTo(3);
        save(last());
        expect(last().body.ops).toEqual([{ op: 'delete', entity: 'item', id: p2, baseVersion: 1 }]);
        const words = 'Well pad was changed by mapoperator at 14:02 UTC since you loaded it. Nothing in this save was written.';
        refuse(last(), 'conflict', words);
        // Stopped: the oldest pad's undo is never sent.
        expect(sent()).toHaveLength(before + 2);
        const state = delegate.mapStateToProps();
        expect(state.save).toEqual({ state: 'refused', itemId: p2, code: 'conflict', message: words });
        expect(state.undo.pending).toBeNull();
        expect(state.undo.done).toBe(2);
        expect(undoLabel(state.undo)).toBe('Undo: add Well pad');
        // The newest pad's undo saved (it left the map); the second newest stays, its undo refused.
        expect(state.items.some((i) => i.id === p3 && !i.deleted)).toBe(false);
        expect(state.items.some((i) => i.id === p2 && !i.deleted)).toBe(true);
        expect(logged.some((l) => l.includes('Undo to here stopped: the undo of batch'))).toBe(true);
    });

    test('another edit ends the run: the reverse in flight settles, no next one is sent', () => {
        const [p1, p2, p3] = threePads();
        const before = sent().length;
        delegate.undoTo(3);
        const reverse = last();
        expect(reverse.body.ops[0].id).toBe(p3);
        delegate.renameItem(p1, 'P31');
        const rename = last();
        expect(rename.body.ops).toEqual([{ op: 'update', entity: 'item', id: p1, baseVersion: 1, data: { name: 'P31' } }]);
        expect(logged).toContain('[MapStudio] Undo to here stopped: another edit was made.');
        save(reverse);
        save(rename);
        // Two batches only: the first undo and the rename; the run sent nothing after the reverse saved.
        expect(sent()).toHaveLength(before + 2);
        const state = delegate.mapStateToProps();
        expect(undoLabel(state.undo)).toBe('Undo: rename P31');
        expect(state.items.find((i) => i.id === p2)!.deleted).toBe(false);
    });

    test('a single undo (the Undo button, Ctrl+Z) is one step and no run; a bad count or a reverse in flight starts none', () => {
        threePads();
        const before = sent().length;
        delegate.undoTo(0);
        delegate.undoTo(1.5);
        expect(sent()).toHaveLength(before);
        delegate.undo();
        expect(sent()).toHaveLength(before + 1);
        // A reverse in flight: the history's choice waits (nothing new is sent).
        delegate.undoTo(2);
        expect(sent()).toHaveLength(before + 1);
        save(last());
        expect(sent()).toHaveLength(before + 1);
        expect(delegate.mapStateToProps().undo.done).toBe(2);
    });

    test('a temporary refusal (busy) stops the run too: when a replay later saves that undo, nothing more is sent', () => {
        const [, p2, p3] = threePads();
        const before = sent().length;
        delegate.undoTo(3);
        const first = last();
        expect(first.body.ops[0].id).toBe(p3);
        refuse(first, 'store-unreachable', 'Map Studio is busy with other map requests; nothing was saved. Try again in a moment.');
        expect(sent()).toHaveLength(before + 1);
        expect(logged.some((l) => l.includes('Undo to here stopped: the undo of batch ' + first.body.batchId + ' was refused (store-unreachable)'))).toBe(true);
        // The queue keeps the undo and a replay saves it later: the step is undone, and no next undo goes unasked.
        save(first);
        expect(sent()).toHaveLength(before + 1);
        const state = delegate.mapStateToProps();
        expect(state.undo.done).toBe(2);
        expect(state.undo.pending).toBeNull();
        expect(state.items.some((i) => i.id === p2 && !i.deleted)).toBe(true);
    });

    test('an undo of the run with no answer (the reply timer) stops the run as well', () => {
        threePads();
        const before = sent().length;
        delegate.undoTo(2);
        const first = last();
        jest.advanceTimersByTime(REPLY_TIMEOUT_MS + 1);
        expect(logged.some((l) => l.includes('Undo to here stopped: the undo of batch ' + first.body.batchId + ' was not sent (timeout)'))).toBe(true);
        // A late answer saves it; nothing more is sent.
        save(first);
        expect(sent()).toHaveLength(before + 1);
        expect(delegate.mapStateToProps().undo.done).toBe(2);
    });

    test('while a tool\'s or a field\'s edit is in flight, Undo, Redo and the history wait, so the edit never lands past the cursor', () => {
        // The reviewer's trace: steps A, B and C saved, a rename of A in flight, the second newest chosen.
        const [a, , c] = threePads();
        delegate.renameItem(a, 'P31');
        const rename = last();
        const before = sent().length;
        expect(delegate.mapStateToProps().editInFlight).toBe(true);
        delegate.undoTo(2);
        delegate.undo();
        delegate.redo();
        expect(sent()).toHaveLength(before);
        expect(logged).toContain('[MapStudio] Undo to here waits: an edit is still being saved.');
        expect(logged).toContain('[MapStudio] Undo waits: an edit is still being saved.');
        expect(logged).toContain('[MapStudio] Redo waits: an edit is still being saved.');

        // Saved: the rename is the newest step, and the second newest chosen now undoes the rename, then C, in that order.
        save(rename);
        let state = delegate.mapStateToProps();
        expect(state.editInFlight).toBe(false);
        expect(undoHistory(state.undo).map((r) => r.label)).toEqual(['rename P31', 'add Well pad', 'add Well pad', 'add Well pad']);
        delegate.undoTo(2);
        expect(last().body.ops).toEqual([{ op: 'update', entity: 'item', id: a, baseVersion: 2, data: { name: 'Well pad' } }]);
        save(last());
        expect(last().body.ops).toEqual([{ op: 'delete', entity: 'item', id: c, baseVersion: 1 }]);
        save(last());
        state = delegate.mapStateToProps();
        expect(state.undo.done).toBe(2);
        // Redo puts them back in order, C's add first and then the rename, never reversing a saved edit.
        delegate.redo();
        expect(last().body.ops).toMatchObject([{ op: 'create', entity: 'item', id: c }]);
        save(last());
        delegate.redo();
        expect(last().body.ops).toEqual([{ op: 'update', entity: 'item', id: a, baseVersion: 3, data: { name: 'P31' } }]);
    });
});
