// An instrument added and moved from its line (epic 4 entry 9; EXPERIENCE.md Instruments): the delegate's createInstrument sends one
// create with the point and the attachment (geometry.ts `instrumentCreateBatch`), one undo step "add <kind>"; moveInstrument one
// update with both, "move <name>"; each waits for a save of the line, and a change of the line's shape or its delete waits for a
// save that attaches an instrument to it; the lat and lng path (`moveItem`) refuses an instrument. Driven as the Gateway would, as
// in deleteItem.test.ts.

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
import { lengthM, pointAt } from '../geometry';
import { MESSAGE_EVENT, MessageTypes } from '../messages';
import { MapStudioStoreDelegate } from '../MapStudioStoreDelegate';
import { redoLabel, undoLabel } from '../undoStack';

const LINE: Kind = { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 0, fields: [] };
const METER: Kind = { id: 'meter', name: 'Meter', geometry: 'point', icon: 'meter', labelRank: 2, fields: [], instrument: true };
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

function record(id: string): MapItemRecord | undefined {
    return delegate.mapStateToProps().items.find((i) => i.id === id && !i.deleted);
}

function savedLine(): string {
    const line = delegate.createLine([CTB, BEND, SWD], LINE, null);
    save(last());
    return line;
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

describe('an instrument added from its line (entry 9)', () => {
    test('one create with its point and attachment, named after the kind; one undo step "add Meter"; Undo deletes it, Redo makes it again', () => {
        const line = savedLine();
        const id = delegate.createInstrument(line, METER, 2000);
        expect(id).not.toBeNull();
        const op = last().body.ops;
        expect(op).toHaveLength(1);
        expect(op[0]).toMatchObject({ op: 'create', entity: 'item', id, baseVersion: 0,
            data: { kind: 'meter', name: 'Meter', attachment: { lineId: line, distanceM: 2000 } } });
        const at = pointAt([CTB, BEND, SWD], 2000);
        const stored = (op[0].data!.geometry as { coordinates: [number, number] }).coordinates;
        expect(Math.abs(stored[0] - at[0])).toBeLessThan(1e-5);
        expect(Math.abs(stored[1] - at[1])).toBeLessThan(1e-5);
        save(last());
        expect(record(id!)!.attachment).toEqual({ lineId: line, distanceM: 2000 });
        expect(undoLabel(delegate.mapStateToProps().undo)).toBe('Undo: add Meter');
        expect(delegate.mapStateToProps().justAdded[0]).toBe(id);

        delegate.undo();
        expect(last().body.ops.map((o) => [o.op, o.id])).toEqual([['delete', id]]);
        save(last());
        expect(record(id!)).toBeUndefined();
        expect(redoLabel(delegate.mapStateToProps().undo)).toBe('Redo: add Meter');
        delegate.redo();
        expect(last().body.ops[0]).toMatchObject({ op: 'create', id, data: { attachment: { lineId: line, distanceM: 2000 } } });
    });

    test('a line not on the map adds nothing', () => {
        expect(delegate.createInstrument('dddddddd-dddd-4ddd-8ddd-dddddddddddd', METER, 10)).toBeNull();
        expect(sent()).toHaveLength(0);
    });

    test('made while a reshape of the line is saved, it waits and is placed on the saved shape', () => {
        const line = savedLine();
        expect(delegate.moveVertex(line, 1, [-105.0, 39.72], null)).toBe(true);
        const reshape = last();
        const before = sent().length;
        const id = delegate.createInstrument(line, METER, 1000);
        expect(sent()).toHaveLength(before);
        save(reshape);
        expect(sent()).toHaveLength(before + 1);
        const op = last().body.ops[0];
        expect(op.id).toBe(id);
        const at = pointAt([CTB, [-105.0, 39.72], SWD], 1000);
        const stored = (op.data!.geometry as { coordinates: [number, number] }).coordinates;
        expect(Math.abs(stored[0] - at[0])).toBeLessThan(1e-5);
    });

    test('a reshape of the line made while the new instrument is saved waits for it, then carries it', () => {
        const line = savedLine();
        const id = delegate.createInstrument(line, METER, 1000)!;
        const create = last();
        const before = sent().length;
        expect(delegate.moveVertex(line, 1, [-105.0, 39.72], null)).toBe(true);
        expect(sent()).toHaveLength(before);
        save(create);
        expect(sent()).toHaveLength(before + 1);
        expect(last().body.ops.map((o) => o.id)).toEqual([line, id]);
    });
});

describe('an instrument moved along its line (entry 9)', () => {
    test('one update with its point and attachment, "move Meter"; Undo puts both back', () => {
        const line = savedLine();
        const id = delegate.createInstrument(line, METER, 1000)!;
        save(last());
        expect(delegate.moveInstrument(id, 1143)).toBe(true);
        expect(last().body.ops).toHaveLength(1);
        expect(last().body.ops[0]).toMatchObject({ op: 'update', id, baseVersion: 1, data: { attachment: { lineId: line, distanceM: 1143 } } });
        expect(Object.keys(last().body.ops[0].data!).sort()).toEqual(['attachment', 'geometry']);
        save(last());
        expect(undoLabel(delegate.mapStateToProps().undo)).toBe('Undo: move Meter');
        delegate.undo();
        expect(last().body.ops[0]).toMatchObject({ op: 'update', id, data: { attachment: { lineId: line, distanceM: 1000 } } });
    });

    test('past the end it stops at the end; the lat and lng path refuses an instrument', () => {
        const line = savedLine();
        const id = delegate.createInstrument(line, METER, 1000)!;
        save(last());
        const before = sent().length;
        expect(delegate.moveItem(id, [-105.0, 39.72])).toBe(false);
        expect(sent()).toHaveLength(before);
        expect(delegate.moveInstrument(id, 99999)).toBe(true);
        const d = (last().body.ops[0].data!.attachment as { distanceM: number }).distanceM;
        expect(Math.abs(d - lengthM([CTB, BEND, SWD]))).toBeLessThan(0.1);
    });

    test('a point that is not an instrument does not move along a line', () => {
        expect(delegate.moveInstrument('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 5)).toBe(false);
    });
});
