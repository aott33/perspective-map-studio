// Delete in the store delegate (epic 4 entry 25; EXPERIENCE.md Delete): one `edits.apply` batch through the queue and one undo
// step, "delete <name>"; a line goes with its instruments, the `ends` naming a deleted item are cleared in the same batch, Undo
// restores every item at its tombstone with its link, properties, kind and geometry and puts the `ends` back, Redo deletes again.
// A delete touching an item with a save in flight waits and is built from the records once it settles, as a geometry change, and
// so does one while a save in flight or waiting its turn (replaying after a transient refusal too) writes `ends` naming an item it
// deletes (the review's patch); an item never saved gets no delete at version 0. The delegate is driven as the Gateway would, as
// in geometryHold.test.ts.

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
import { EditBatch, MapItemRecord } from '../contract';
import { MESSAGE_EVENT, MessageTypes } from '../messages';
import { MapStudioStoreDelegate } from '../MapStudioStoreDelegate';
import { editProblems } from '../problems';
import { REPLAY_INTERVAL_MS } from '../unsaved';
import { redoLabel, undoLabel } from '../undoStack';

const PAD: Kind = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] };
const LINE: Kind = { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 0, fields: [] };
const CTB: [number, number] = [-105.012, 39.7262];
const BEND: [number, number] = [-105.009441, 39.720791];
const SWD: [number, number] = [-104.983671, 39.715476];
const TAP_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

interface Sent {
    id: string;
    type: string;
    body: EditBatch;
}

let delegate: MapStudioStoreDelegate;
let seq = 0;

function sent(): Sent[] {
    return ((delegate as unknown as { fired: Sent[] }).fired).filter((m) => m.type === MessageTypes.EDITS_APPLY);
}

function last(): Sent {
    const all = sent();
    return all[all.length - 1];
}

function save(message: Sent): void {
    seq++;
    delegate.handleEvent(MESSAGE_EVENT, {
        v: 1, type: MessageTypes.EDITS_APPLY_REPLY, id: message.id,
        body: { batchId: message.body.batchId, seq, results: message.body.ops.map((op) => ({ entity: op.entity, id: op.id, version: op.baseVersion + 1 })) }
    });
}

function refuse(message: Sent, code: string, words: string): void {
    delegate.handleEvent(MESSAGE_EVENT, { v: 1, type: MessageTypes.ERROR, id: message.id, body: { code, message: words, batchId: message.body.batchId } });
}

function record(id: string): MapItemRecord | undefined {
    return delegate.mapStateToProps().items.find((i) => i.id === id && !i.deleted);
}

/** CTB1 linked to its asset, and a three-point line whose start snaps to it, both saved. */
function padAndLine(): { pad: string; line: string } {
    const pad = delegate.createPoint(CTB, PAD);
    save(last());
    delegate.linkItem(pad, 'CTB1');
    save(last());
    const line = delegate.createLine([CTB, BEND, SWD], LINE, { start: { itemId: pad } });
    save(last());
    return { pad, line };
}

/** A tap on the line at its bend, saved (the instrument tool is entry 9's: sent as a batch here). */
function tapOn(line: string): string {
    delegate.sendBatch({ batchId: 'tap-create', ops: [{ op: 'create', entity: 'item', id: TAP_ID, baseVersion: 0, data: {
        kind: 'tap', name: 'PT-1', geometry: { type: 'Point', coordinates: BEND }, attachment: { lineId: line, distanceM: 659.4 } } }] },
    TAP_ID, 'add Tap');
    save(last());
    return TAP_ID;
}

beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    delegate = new MapStudioStoreDelegate({} as unknown as AbstractUIElementStore);
});

afterEach(() => {
    delegate.stopReplay();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('a delete is one batch and one undo step (entry 25)', () => {
    test('a pad: deleted with the end naming it cleared; Undo restores both with its link; Redo deletes again', () => {
        const { pad, line } = padAndLine();
        const before = sent().length;
        expect(delegate.deleteItem(pad)).toBe(true);
        expect(sent()).toHaveLength(before + 1);
        expect(last().body.ops).toEqual([
            { op: 'delete', entity: 'item', id: pad, baseVersion: 2 },
            { op: 'update', entity: 'item', id: line, baseVersion: 1, data: { ends: null } }]);
        save(last());
        expect(record(pad)).toBeUndefined();
        expect(record(line)!.ends).toBeNull();
        expect(undoLabel(delegate.mapStateToProps().undo)).toBe('Undo: delete Well pad');

        delegate.undo();
        expect(sent()).toHaveLength(before + 2);
        const restore = last().body;
        expect(restore.ops).toEqual([
            { op: 'create', entity: 'item', id: pad, baseVersion: 3, data: { kind: 'pad', name: 'Well pad',
                geometry: { type: 'Point', coordinates: CTB }, properties: {}, assetId: 'CTB1', overrides: {}, ends: null, attachment: null } },
            { op: 'update', entity: 'item', id: line, baseVersion: 2, data: { ends: { start: { itemId: pad } } } }]);
        save(last());
        expect(record(pad)).toMatchObject({ assetId: 'CTB1', kind: 'pad', version: 4, geometry: { type: 'Point', coordinates: CTB } });
        expect(record(line)!.ends).toEqual({ start: { itemId: pad } });
        expect(redoLabel(delegate.mapStateToProps().undo)).toBe('Redo: delete Well pad');

        delegate.redo();
        expect(last().body.ops).toEqual([
            { op: 'delete', entity: 'item', id: pad, baseVersion: 4 },
            { op: 'update', entity: 'item', id: line, baseVersion: 3, data: { ends: null } }]);
        save(last());
        expect(record(pad)).toBeUndefined();
        expect(record(line)!.ends).toBeNull();
        expect(undoLabel(delegate.mapStateToProps().undo)).toBe('Undo: delete Well pad');
    });

    test('a line: deleted with its instrument in one batch; Undo restores both, the instrument on its line', () => {
        const { pad, line } = padAndLine();
        const tap = tapOn(line);
        expect(delegate.deleteItem(line)).toBe(true);
        expect(last().body.ops).toEqual([
            { op: 'delete', entity: 'item', id: line, baseVersion: 1 },
            { op: 'delete', entity: 'item', id: tap, baseVersion: 1 }]);
        save(last());
        expect(record(line)).toBeUndefined();
        expect(record(tap)).toBeUndefined();
        expect(record(pad)).toBeDefined();
        expect(undoLabel(delegate.mapStateToProps().undo)).toBe('Undo: delete Gathering line');

        delegate.undo();
        expect(last().body.ops.map((op) => [op.op, op.id, op.baseVersion])).toEqual([['create', line, 2], ['create', tap, 2]]);
        expect(last().body.ops[1].data).toMatchObject({ attachment: { lineId: line, distanceM: 659.4 } });
        save(last());
        expect(record(line)).toMatchObject({ ends: { start: { itemId: pad } }, geometry: { coordinates: [CTB, BEND, SWD] } });
        expect(record(tap)!.attachment).toEqual({ lineId: line, distanceM: 659.4 });
    });

    test('a delete made while a save of an item it touches is in flight waits, then is built on the saved records', () => {
        const { pad, line } = padAndLine();
        expect(delegate.moveVertex(line, 1, [-105.0, 39.72], null)).toBe(true);
        const reshape = last();
        const before = sent().length;
        expect(delegate.deleteItem(pad)).toBe(true);
        expect(sent()).toHaveLength(before);
        expect(delegate.mapStateToProps().editInFlight).toBe(true);
        save(reshape);
        expect(sent()).toHaveLength(before + 1);
        expect(last().body.ops).toEqual([
            { op: 'delete', entity: 'item', id: pad, baseVersion: 2 },
            { op: 'update', entity: 'item', id: line, baseVersion: 2, data: { ends: null } }]);
        save(last());
        expect(delegate.mapStateToProps().editInFlight).toBe(false);
    });

    test('an item never saved (its create in flight, or refused for good) gets no delete at version 0: nothing sent', () => {
        const pad = delegate.createPoint(CTB, PAD);
        const create = last();
        const before = sent().length;
        expect(delegate.deleteItem(pad)).toBe(false);
        expect(sent()).toHaveLength(before);
        refuse(create, 'invalid', 'The kind pad is not in the kind list.');
        // Only the waiting edits know it now (Discard under the save status row drops it): still no delete.
        expect(delegate.mapStateToProps().unsaved.map((e) => e.batchId)).toEqual([create.body.batchId]);
        expect(delegate.deleteItem(pad)).toBe(false);
        expect(sent()).toHaveLength(before);
        // Once saved, it deletes at its saved version.
        const saved = delegate.createPoint(SWD, PAD);
        save(last());
        expect(delegate.deleteItem(saved)).toBe(true);
        expect(last().body.ops).toEqual([{ op: 'delete', entity: 'item', id: saved, baseVersion: 1 }]);
    });

    test('a delete waits while a save in flight writes ends naming the pad, then clears them: no line names a deleted item', () => {
        const pad = delegate.createPoint(CTB, PAD);
        save(last());
        // A line with floating ends; its start then dragged onto the pad with Snap on (a save in flight naming the pad).
        const line = delegate.createLine([[-105.0, 39.72], BEND, SWD], LINE, null);
        save(last());
        expect(delegate.moveVertex(line, 0, CTB, pad)).toBe(true);
        const snap = last();
        expect(snap.body.ops[0].data!.ends).toEqual({ start: { itemId: pad } });
        const before = sent().length;
        // Built now, the delete would touch only the pad (the line's record does not name it until the reply): it waits.
        expect(delegate.deleteItem(pad)).toBe(true);
        expect(sent()).toHaveLength(before);
        expect(delegate.mapStateToProps().editInFlight).toBe(true);
        save(snap);
        expect(sent()).toHaveLength(before + 1);
        expect(last().body.ops).toEqual([
            { op: 'delete', entity: 'item', id: pad, baseVersion: 1 },
            { op: 'update', entity: 'item', id: line, baseVersion: 2, data: { ends: null } }]);
        save(last());
        expect(record(line)!.ends).toBeNull();
        expect(delegate.mapStateToProps().editInFlight).toBe(false);
    });

    test('a save naming the pad waiting its turn, then replaying after a transient refusal, holds the delete until it saves', () => {
        delegate.sendMapLoad();
        const load = ((delegate as unknown as { fired: Array<{ id: string; type: string }> }).fired).filter((m) => m.type === MessageTypes.MAP_LOAD);
        delegate.handleEvent(MESSAGE_EVENT, { v: 1, type: MessageTypes.MAP_LOAD_REPLY, id: load[load.length - 1].id,
            body: { level: 'full', seq: 0, items: [] } });
        const pad = delegate.createPoint(CTB, PAD);
        save(last());
        const line = delegate.createLine([CTB, BEND, SWD], LINE, null);
        save(last());
        // A rename of the line in flight, and behind it (held) a batch that snaps the line's start to the pad.
        delegate.renameItem(line, 'L-TEST');
        const rename = last();
        delegate.sendBatch({ batchId: 'snap-ends', ops: [{ op: 'update', entity: 'item', id: line, baseVersion: 2,
            data: { ends: { start: { itemId: pad } } } }] }, line, 'edit L-TEST');
        const before = sent().length;
        expect(delegate.deleteItem(pad)).toBe(true);
        expect(sent()).toHaveLength(before);
        save(rename);
        // The held batch goes; the delete still waits on it.
        expect(sent()).toHaveLength(before + 1);
        const ends = last();
        expect(ends.body.batchId).toBe('snap-ends');
        refuse(ends, 'store-unreachable', 'The map store could not save the change (SQLState 08001); nothing was saved.');
        expect(sent()).toHaveLength(before + 1);
        // The replay sends it again; once it saves, the delete is built with the line's end cleared.
        jest.advanceTimersByTime(REPLAY_INTERVAL_MS);
        expect(sent()).toHaveLength(before + 2);
        expect(last().body.batchId).toBe('snap-ends');
        save(last());
        expect(sent()).toHaveLength(before + 3);
        expect(last().body.ops).toEqual([
            { op: 'delete', entity: 'item', id: pad, baseVersion: 1 },
            { op: 'update', entity: 'item', id: line, baseVersion: 3, data: { ends: null } }]);
    });

    test('an item not on the map: nothing sent', () => {
        padAndLine();
        const before = sent().length;
        expect(delegate.deleteItem('not-there')).toBe(false);
        expect(sent()).toHaveLength(before);
    });

    test('a refused delete: the item stays, the refusal is on the save status row with the edit waiting, no step is pushed', () => {
        const { pad } = padAndLine();
        const stepsBefore = delegate.mapStateToProps().undo.steps.length;
        expect(delegate.deleteItem(pad)).toBe(true);
        const del = last();
        refuse(del, 'conflict', 'Well pad was changed by mapoperator at 14:02 UTC since you loaded it. Nothing in this save was written.');
        const state = delegate.mapStateToProps();
        expect(record(pad)).toBeDefined();
        expect(state.save.state).toBe('refused');
        expect(state.undo.steps).toHaveLength(stepsBefore);
        const facts = { connection: state.connection, load: state.load, store: state.store, level: 'full' as const, save: state.save,
            unsaved: state.unsaved, sending: state.sending, storageWarning: state.storageWarning, shapeRefused: state.shapeRefused };
        const edits = editProblems(facts).find((p) => p.code === 'edits');
        expect(edits && edits.text).toMatch(/changed by mapoperator/);
        expect(state.unsaved.map((e) => e.batchId)).toEqual([del.body.batchId]);
    });
});
