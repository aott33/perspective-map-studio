// The item form's saves in the store delegate (epic 4 entry 6, R12): a finished field is one update of the whole `properties`
// (the changed key merged onto the newest the page knows, a save still in flight included), "edit <name>", undone as one step;
// the value is kept per project and kind in localStorage and the next item of that kind starts with it (never a name, a place
// or a link); a kind change carries the values the new kind defines and drops the rest in the same update, and its undo puts
// them back. The delegate is driven as the Gateway would; Perspective's base class is stood in for, as in undoRun.test.ts.

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
import { FormField, Kind } from '../adapters';
import { EditBatch, MapItemRecord } from '../contract';
import { MESSAGE_EVENT, MessageTypes } from '../messages';
import { MapStudioStoreDelegate } from '../MapStudioStoreDelegate';
import { prefillKey } from '../itemForm';
import { undoLabel } from '../undoStack';

const OPERATOR: FormField = { key: 'operator', label: 'Operator', type: 'text', required: false, choices: [] };
const WELLS: FormField = { key: 'wells', label: 'Wells', type: 'integer', required: false, choices: [] };
const STATUS: FormField = { key: 'status', label: 'Status', type: 'choice', required: true, choices: ['producing', 'shut in', 'abandoned'] };
const TAG: FormField = { key: 'tag', label: 'Tag', type: 'text', required: false, choices: [] };
const PAD: Kind = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [OPERATOR, WELLS, STATUS] };
const TAP: Kind = { id: 'tap', name: 'Tap', geometry: 'point', icon: 'tap', labelRank: 2, instrument: true, fields: [TAG] };
const VALVE: Kind = { id: 'valve', name: 'Line valve', geometry: 'point', icon: 'line-valve', labelRank: 1, instrument: true, fields: [TAG] };
const AT: [number, number] = [-105.012, 39.7262];

interface Sent {
    id: string;
    type: string;
    body: EditBatch;
}

let delegate: MapStudioStoreDelegate;
let stored: Map<string, string>;
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

function record(id: string): MapItemRecord {
    return delegate.mapStateToProps().items.find((i) => i.id === id)!;
}

/** map.load answered with the dev kinds, so a kind change knows the new kind's fields. */
function loaded(): void {
    delegate.sendMapLoad();
    const load = ((delegate as unknown as { fired: Array<{ id: string; type: string }> }).fired).filter((m) => m.type === MessageTypes.MAP_LOAD);
    delegate.handleEvent(MESSAGE_EVENT, { v: 1, type: MessageTypes.MAP_LOAD_REPLY, id: load[load.length - 1].id,
        body: { level: 'full', seq: 0, items: [], kinds: [PAD, TAP, VALVE] } });
}

beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    // The browser's localStorage, as a map: the delegate reads `window.localStorage` when it is made.
    stored = new Map<string, string>();
    const localStorage = {
        getItem: (k: string) => (stored.has(k) ? stored.get(k)! : null),
        setItem: (k: string, v: string) => { stored.set(k, v); },
        removeItem: (k: string) => { stored.delete(k); }
    };
    (globalThis as unknown as { window: unknown }).window = { localStorage };
    // The client the delegate reads the project name from (MapStudioStoreDelegate `clientOf`).
    const component = { view: { page: { parent: { projectName: 'mapstudio-dev' } } } };
    delegate = new MapStudioStoreDelegate(component as unknown as AbstractUIElementStore);
    loaded();
});

afterEach(() => {
    delegate.stopReplay();
    delete (globalThis as unknown as { window?: unknown }).window;
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('a finished field saves the whole properties as one update (entry 6)', () => {
    test('Operator then Wells: two updates, each with every value; the second, finished while the first is saved, keeps the first', () => {
        const pad = delegate.createPoint(AT, PAD);
        save(last());
        delegate.editProperty(pad, 'operator', 'Acme');
        const first = last();
        expect(first.body.ops).toEqual([{ op: 'update', entity: 'item', id: pad, baseVersion: 1, data: { properties: { operator: 'Acme' } } }]);
        const before = sent().length;
        // Finished before the first's reply: held, and built on the first's properties, not the record's.
        delegate.editProperty(pad, 'wells', 3);
        expect(sent()).toHaveLength(before);
        save(first);
        expect(sent()).toHaveLength(before + 1);
        expect(last().body.ops).toEqual([{ op: 'update', entity: 'item', id: pad, baseVersion: 2,
            data: { properties: { operator: 'Acme', wells: 3 } } }]);
        save(last());
        expect(record(pad).properties).toEqual({ operator: 'Acme', wells: 3 });
        expect(undoLabel(delegate.mapStateToProps().undo)).toBe('Undo: edit Well pad');

        // Not set leaves the key out; the undo of it is one step that puts the value back.
        delegate.editProperty(pad, 'wells', null);
        expect(last().body.ops[0].data).toEqual({ properties: { operator: 'Acme' } });
        save(last());
        delegate.undo();
        expect(last().body.ops).toEqual([{ op: 'update', entity: 'item', id: pad, baseVersion: 4,
            data: { properties: { operator: 'Acme', wells: 3 } } }]);
        save(last());
        expect(record(pad).properties).toEqual({ operator: 'Acme', wells: 3 });
    });

    test('a field finished while the item\'s create is saved goes after it, at its version, on the create\'s properties', () => {
        stored.set(prefillKey('mapstudio-dev', 'pad'), JSON.stringify({ status: 'producing' }));
        const pad = delegate.createPoint(AT, PAD);
        const create = last();
        const before = sent().length;
        delegate.editProperty(pad, 'operator', 'Acme');
        expect(sent()).toHaveLength(before);
        save(create);
        expect(last().body.ops).toEqual([{ op: 'update', entity: 'item', id: pad, baseVersion: 1,
            data: { properties: { status: 'producing', operator: 'Acme' } } }]);
    });
});

describe('a new item takes its kind\'s last values (R12: prefill)', () => {
    test('Operator Acme finished on a pad: the next pad starts with it, named after its kind and unlinked; a tap starts blank', () => {
        const first = delegate.createPoint(AT, PAD);
        save(last());
        expect(last().body.ops[0].data).not.toHaveProperty('properties');
        delegate.editProperty(first, 'operator', 'Acme');
        save(last());
        delegate.editProperty(first, 'status', 'shut in');
        save(last());
        expect(JSON.parse(stored.get(prefillKey('mapstudio-dev', 'pad'))!)).toEqual({ operator: 'Acme', status: 'shut in' });

        const second = delegate.createPoint([-105.0, 39.73], PAD);
        const create = last().body.ops[0];
        expect(create).toMatchObject({ op: 'create', id: second, baseVersion: 0 });
        expect(create.data).toEqual({ kind: 'pad', name: 'Well pad', geometry: { type: 'Point', coordinates: [-105.0, 39.73] },
            properties: { operator: 'Acme', status: 'shut in' } });
        save(last());
        expect(record(second)).toMatchObject({ name: 'Well pad', assetId: null, properties: { operator: 'Acme', status: 'shut in' } });

        const tap = delegate.createPoint([-105.01, 39.73], TAP);
        expect(last().body.ops[0].data).not.toHaveProperty('properties');
        expect(tap).not.toBe(second);
    });

    test('a kept value the kind no longer defines, or no longer has the type of, is not prefilled', () => {
        stored.set(prefillKey('mapstudio-dev', 'pad'), JSON.stringify({ operator: 'Acme', wells: 2.5, depth: 900, status: 'drilling' }));
        delegate.createPoint(AT, PAD);
        expect(last().body.ops[0].data!.properties).toEqual({ operator: 'Acme' });
    });
});

describe('a kind change keeps the values the new kind defines (entry 6)', () => {
    test('a tap with Tag set changed to a line valve keeps Tag; a pad changed to a tap drops every value, and Undo puts them back', () => {
        const tap = delegate.createPoint(AT, TAP);
        save(last());
        delegate.editProperty(tap, 'tag', 'PT-9');
        save(last());
        delegate.setKind(tap, 'valve');
        expect(last().body.ops).toEqual([{ op: 'update', entity: 'item', id: tap, baseVersion: 2,
            data: { kind: 'valve', properties: { tag: 'PT-9' } } }]);
        save(last());
        expect(record(tap)).toMatchObject({ kind: 'valve', properties: { tag: 'PT-9' } });

        const pad = delegate.createPoint([-105.0, 39.73], PAD);
        save(last());
        delegate.editProperty(pad, 'operator', 'Acme');
        save(last());
        delegate.editProperty(pad, 'status', 'producing');
        save(last());
        delegate.setKind(pad, 'tap');
        expect(last().body.ops[0].data).toEqual({ kind: 'tap', properties: {} });
        save(last());
        expect(record(pad)).toMatchObject({ kind: 'tap', properties: {} });
        expect(undoLabel(delegate.mapStateToProps().undo)).toBe('Undo: edit Well pad');
        delegate.undo();
        expect(last().body.ops[0].data).toEqual({ kind: 'pad', properties: { operator: 'Acme', status: 'producing' } });
        save(last());
        expect(record(pad)).toMatchObject({ kind: 'pad', properties: { operator: 'Acme', status: 'producing' } });
    });

    test('a kind change while a field\'s save is in flight keeps that field\'s new value', () => {
        const tap = delegate.createPoint(AT, TAP);
        save(last());
        delegate.editProperty(tap, 'tag', 'PT-7');
        const edit = last();
        delegate.setKind(tap, 'valve');
        save(edit);
        expect(last().body.ops[0].data).toEqual({ kind: 'valve', properties: { tag: 'PT-7' } });
    });
});
