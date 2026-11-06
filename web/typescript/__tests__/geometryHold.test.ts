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
import { droppedText, editProblems } from '../problems';
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

    test('a refused reshape drops the later changes made on top of it, says so with the refusal, makes the handles again; another item\'s change saves',
        () => {
            const { pad, line } = padAndLine();
            const other = delegate.createPoint([-104.98, 39.71], PAD);
            save(last());
            expect(delegate.moveVertex(line, 1, [-105.0, 39.72], null)).toBe(true);
            const refused = last();
            const before = sent().length;
            // Made while the first is in flight, on the shape the handles show: a midpoint dragged in, the pad its start snaps to.
            expect(delegate.reshapeLine(line, [CTB, [-105.0, 39.72], [-104.99, 39.718], SWD])).toBe(true);
            expect(delegate.moveItem(pad, [-105.0125, 39.7265])).toBe(true);
            expect(delegate.moveItem(other, [-104.981, 39.711])).toBe(true);
            expect(sent()).toHaveLength(before);
            const revision = delegate.mapStateToProps().shapeRefused.revision;

            refuse(refused, 'conflict', 'Gathering line was changed by mapoperator at 14:02 UTC since you loaded it. Nothing in this save was written.');
            // The two changes on the line went with it; the other pad's move saves.
            expect(sent()).toHaveLength(before + 1);
            expect(last().body.ops.map((op) => op.id)).toEqual([other]);
            const state = delegate.mapStateToProps();
            expect(state.shapeRefused).toMatchObject({ revision: revision + 1, batchId: refused.body.batchId, dropped: '2 later changes to Gathering line were not saved' });
            expect(state.shapeRefused.ids).toEqual(expect.arrayContaining([line]));
            // The save status row says it with the refusal, while the refused edit waits in the queue.
            const facts = { connection: state.connection, load: state.load, store: state.store, level: 'full' as const, save: state.save,
                unsaved: state.unsaved, sending: state.sending, storageWarning: state.storageWarning, shapeRefused: state.shapeRefused };
            const edits = editProblems(facts).find((p) => p.code === 'edits');
            expect(edits && edits.text).toMatch(/Nothing in this save was written, and 2 later changes to Gathering line were not saved\.$/);
            // Nothing of the line's changes was written; the line keeps its stored shape.
            save(last());
            expect(record(line).geometry.coordinates).toEqual([CTB, BEND, SWD]);
            expect(record(line).version).toBe(1);
            expect(delegate.mapStateToProps().editInFlight).toBe(false);
            expect(sent()).toHaveLength(before + 1);
            // Once the refused edit is discarded the row says nothing of it.
            delegate.discardUnsaved(refused.body.batchId);
            const after = delegate.mapStateToProps();
            expect(editProblems({ ...facts, unsaved: after.unsaved, sending: after.sending, shapeRefused: after.shapeRefused })
                .some((p) => p.code === 'edits')).toBe(false);
        });

    test('the words for one change and for several', () => {
        expect(droppedText(1, 'L-SWD')).toBe('1 later change to L-SWD was not saved');
        expect(droppedText(3, 'L-SWD')).toBe('3 later changes to L-SWD were not saved');
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
