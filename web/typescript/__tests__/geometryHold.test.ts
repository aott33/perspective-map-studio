// Geometry changes in the store delegate (epic 4 entry 5): a change whose batch touches an item with a save in flight waits as a
// builder and is built from the records once that save settles, so a drag, Move then a click, a bar action and a typed move
// all save, in order, and never on a stale record; nothing is dropped. The delegate is driven as the Gateway would: every
// `edits.apply` it fires is answered by an `edits.apply.reply` or an `error`. Perspective's base class is stood in for (a
// virtual module), as in undoRun.test.ts.

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
import { undoLabel } from '../undoStack';

const PAD: Kind = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] };
const LINE: Kind = { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 0, fields: [] };
const CTB: [number, number] = [-105.012, 39.7262];
const BEND: [number, number] = [-105.009441, 39.720791];
const SWD: [number, number] = [-104.983671, 39.715476];

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

function record(id: string): MapItemRecord {
    return delegate.mapStateToProps().items.find((i) => i.id === id)!;
}

/** CTB1 and a three-point line whose start snaps to it, both saved. */
function padAndLine(): { pad: string; line: string } {
    const pad = delegate.createPoint(CTB, PAD);
    save(last());
    const line = delegate.createLine([CTB, BEND, SWD], LINE, { start: { itemId: pad } });
    save(last());
    return { pad, line };
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

describe('a geometry change waits for the saves it touches and is built from the records then (entry 5)', () => {
    test('the pad moved while its line\'s reshape is in flight: nothing sent, then the move built on the reshaped line once it is saved', () => {
        const { pad, line } = padAndLine();
        const inserted: Array<[number, number]> = [CTB, BEND, [-104.99, 39.718], SWD];
        expect(delegate.reshapeLine(line, inserted)).toBe(true);
        const reshape = last();
        const before = sent().length;

        expect(delegate.moveItem(pad, [-105.0125, 39.7265])).toBe(true);
        expect(sent()).toHaveLength(before);
        expect(delegate.mapStateToProps().editInFlight).toBe(true);

        save(reshape);
        expect(sent()).toHaveLength(before + 1);
        const move = last().body;
        expect(move.ops.map((op) => [op.id, op.baseVersion])).toEqual([[pad, 1], [line, 2]]);
        expect((move.ops[1].data!.geometry as { coordinates: Array<[number, number]> }).coordinates)
            .toEqual([[-105.0125, 39.7265], BEND, [-104.99, 39.718], SWD]);
        save(last());
        expect(record(line).geometry.coordinates).toEqual([[-105.0125, 39.7265], BEND, [-104.99, 39.718], SWD]);
        expect(delegate.mapStateToProps().editInFlight).toBe(false);
        expect(undoLabel(delegate.mapStateToProps().undo)).toBe('Undo: move Well pad');
    });

    test('a typed move of a pad whose create is still in flight waits for the create and goes at its saved version', () => {
        const pad = delegate.createPoint(CTB, PAD);
        const create = last();
        const before = sent().length;
        expect(delegate.moveItem(pad, [-105.02, 39.73])).toBe(true);
        expect(sent()).toHaveLength(before);
        save(create);
        expect(sent()).toHaveLength(before + 1);
        expect(last().body.ops).toEqual([{ op: 'update', entity: 'item', id: pad, baseVersion: 1,
            data: { geometry: { type: 'Point', coordinates: [-105.02, 39.73] } } }]);
        save(last());
        expect(record(pad).geometry.coordinates).toEqual([-105.02, 39.73]);
    });

    test('changes made while one is in flight go in order, one after the other, each on the record the last left', () => {
        const { line } = padAndLine();
        expect(delegate.moveVertex(line, 1, [-105.0, 39.72], null)).toBe(true);
        const first = last();
        const before = sent().length;
        expect(delegate.deleteVertex(line, 1)).toBe(true);
        expect(delegate.moveVertex(line, 1, [-104.99, 39.716], null)).toBe(true);
        expect(sent()).toHaveLength(before);

        save(first);
        expect(sent()).toHaveLength(before + 1);
        expect(last().body.ops[0]).toMatchObject({ id: line, baseVersion: 2, data: { geometry: { coordinates: [CTB, SWD] } } });
        save(last());
        expect(sent()).toHaveLength(before + 2);
        expect(last().body.ops[0]).toMatchObject({ id: line, baseVersion: 3, data: { geometry: { coordinates: [CTB, [-104.99, 39.716]] } } });
        save(last());
        expect(record(line).version).toBe(4);
        expect(delegate.mapStateToProps().editInFlight).toBe(false);
    });

    test('a refusal of the save it waits on lets it go, built on the record as it stayed; nothing is dropped', () => {
        const { pad, line } = padAndLine();
        expect(delegate.moveVertex(line, 1, [-105.0, 39.72], null)).toBe(true);
        const refused = last();
        const before = sent().length;
        expect(delegate.moveItem(pad, [-105.0125, 39.7265])).toBe(true);
        expect(sent()).toHaveLength(before);
        refuse(refused, 'conflict', 'L-SWD was changed by mapoperator at 14:02 UTC since you loaded it. Nothing in this save was written.');
        expect(sent()).toHaveLength(before + 1);
        const move = last().body;
        expect(move.ops.map((op) => [op.id, op.baseVersion])).toEqual([[pad, 1], [line, 1]]);
        expect((move.ops[1].data!.geometry as { coordinates: Array<[number, number]> }).coordinates).toEqual([[-105.0125, 39.7265], BEND, SWD]);
        // The newer change's Saving... is on the save status, not the older refusal.
        expect(delegate.mapStateToProps().save).toEqual({ state: 'saving', itemId: pad });
    });

    test('a change that cannot be built when its turn comes (its point gone) is the only one let go', () => {
        const { line } = padAndLine();
        expect(delegate.deleteVertex(line, 1)).toBe(true);
        const first = last();
        const before = sent().length;
        // Point 3 of a line that has two once the first change saves.
        expect(delegate.moveVertex(line, 2, [-104.99, 39.716], null)).toBe(true);
        expect(delegate.moveVertex(line, 0, [-105.013, 39.727], null)).toBe(true);
        save(first);
        expect(sent()).toHaveLength(before + 1);
        expect(last().body.ops[0]).toMatchObject({ id: line, data: { geometry: { coordinates: [[-105.013, 39.727], SWD] } } });
    });
});
