// An item's path overrides in the store delegate (epic 4 entry 12c1, R5): one row's override or Reset is one update of the
// item's whole `overrides`, built from the newest the page knows (a save in flight included) with only that row changed, an
// Undo step named by its part; a kind change drops the overrides in the same save and one Undo restores both; a refusal's
// words stand for the row and the stored overrides stand. The delegate is driven as the Gateway would; Perspective's base
// class is stood in for, as in itemFormSave.test.ts.

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
const TANK: Kind = { id: 'tank', name: 'Tank battery', geometry: 'point', icon: 'tank', labelRank: 9, fields: [] };
const SETUP = {
    comms: { path: '{asset.path}/Comms', on: true },
    kpis: [{ key: 'pressure', label: 'Pressure', path: '{asset.path}/Pressure', unit: 'psi', on: true, icon: true },
        { key: 'flow', label: 'Flow', path: '{asset.path}/Flow', unit: 'bbl/d' }],
    alarms: { path: '{asset.path}', count: true, summary: false }
};
const RULE = { source: { path: '[default]Mesa/P14/Pressure' }, type: 'expression', expression: "'normal'" };
const P12: MapItemRecord = { id: 'p12', kind: 'pad', name: 'P12', geometry: { type: 'Point', coordinates: [-105, 39.7] }, properties: {},
    assetId: 'P12', overrides: {}, ends: null, attachment: null, version: 3, deleted: false };
const P2: MapItemRecord = { ...P12, id: 'p2', name: 'Point 2', assetId: 'P14', overrides: { styleRule: RULE, link: '/other' }, version: 5 };
const P14_PRESSURE = '[default]Mesa/P14/Pressure';

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

function refuse(message: Sent, code: string, text: string): void {
    delegate.handleEvent(MESSAGE_EVENT, { v: 1, type: MessageTypes.ERROR, id: message.id, body: { code, message: text, batchId: message.body.batchId } });
}

function state() {
    return delegate.mapStateToProps();
}

function record(id: string): MapItemRecord {
    return state().items.find((i) => i.id === id)!;
}

beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'debug').mockImplementation(() => undefined);
    delegate = new MapStudioStoreDelegate({} as unknown as AbstractUIElementStore);
    delegate.sendMapLoad();
    const load = ((delegate as unknown as { fired: Array<{ id: string; type: string }> }).fired).filter((m) => m.type === MessageTypes.MAP_LOAD);
    delegate.handleEvent(MESSAGE_EVENT, { v: 1, type: MessageTypes.MAP_LOAD_REPLY, id: load[load.length - 1].id,
        body: { level: 'full', seq: 0, items: [P12, P2], kinds: [PAD, TANK], user: 'mapeditor',
            kindSetups: [{ kindId: 'pad', setup: SETUP, version: 2, deleted: false }] } });
});

afterEach(() => {
    delegate.stopReplay();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('one row overridden or reset is one update of the whole overrides (L2 to L5)', () => {
    test('L2, L8: a key value\'s override is its entry {key, path}, an Undo step named by its part, undone as one step', () => {
        expect(delegate.editOverride('p12', 'kpi:pressure', P14_PRESSURE, 'Pressure')).toBe(true);
        expect(last().body.ops).toEqual([{ op: 'update', entity: 'item', id: 'p12', baseVersion: 3,
            data: { overrides: { kpis: [{ key: 'pressure', path: P14_PRESSURE }] } } }]);
        // Drawn as an override at once, from the batch in flight.
        expect(state().inFlightOverrides).toEqual({ p12: { kpis: [{ key: 'pressure', path: P14_PRESSURE }] } });
        save(last());
        expect(state().inFlightOverrides).toEqual({});
        expect(record('p12').overrides).toEqual({ kpis: [{ key: 'pressure', path: P14_PRESSURE }] });
        expect(undoLabel(state().undo)).toBe("Undo: change P12's Pressure path");
        delegate.undo();
        expect(last().body.ops[0].data).toEqual({ overrides: {} });
        save(last());
        expect(record('p12').overrides).toEqual({});
    });

    test('L3: a second row finished while the first is saved is built on the first\'s overrides, not the record\'s', () => {
        delegate.editOverride('p12', 'kpi:pressure', P14_PRESSURE, 'Pressure');
        const first = last();
        const before = sent().length;
        delegate.editOverride('p12', 'kpi:flow', '[default]Mesa/P14/Flow', 'Flow');
        expect(sent()).toHaveLength(before);
        expect(state().inFlightOverrides.p12).toEqual({ kpis: [{ key: 'pressure', path: P14_PRESSURE }, { key: 'flow', path: '[default]Mesa/P14/Flow' }] });
        save(first);
        expect(last().body.ops).toEqual([{ op: 'update', entity: 'item', id: 'p12', baseVersion: 4,
            data: { overrides: { kpis: [{ key: 'pressure', path: P14_PRESSURE }, { key: 'flow', path: '[default]Mesa/P14/Flow' }] } } }]);
    });

    test('L4: Reset removes the entry, the other kept; the last Reset leaves no kpis, named "reset"', () => {
        delegate.editOverride('p12', 'kpi:pressure', P14_PRESSURE, 'Pressure');
        save(last());
        delegate.editOverride('p12', 'kpi:flow', '[default]Mesa/P14/Flow', 'Flow');
        save(last());
        delegate.editOverride('p12', 'kpi:pressure', null, 'Pressure');
        expect(last().body.ops[0].data).toEqual({ overrides: { kpis: [{ key: 'flow', path: '[default]Mesa/P14/Flow' }] } });
        save(last());
        expect(undoLabel(state().undo)).toBe("Undo: reset P12's Pressure path");
        delegate.editOverride('p12', 'kpi:flow', null, 'Flow');
        expect(last().body.ops[0].data).toEqual({ overrides: {} });
    });

    test('L5: Comms and Alarms take the kind\'s switches; each resets to nothing', () => {
        delegate.editOverride('p12', 'comms', '[default]Mesa/P14/Comms', 'Comms');
        expect(last().body.ops[0].data).toEqual({ overrides: { comms: { path: '[default]Mesa/P14/Comms', on: true } } });
        save(last());
        expect(undoLabel(state().undo)).toBe("Undo: change P12's comms path");
        delegate.editOverride('p12', 'alarms', '[default]Mesa/P14', 'Alarms');
        expect(last().body.ops[0].data).toEqual({ overrides: { comms: { path: '[default]Mesa/P14/Comms', on: true },
            alarms: { path: '[default]Mesa/P14', count: true, summary: false } } });
        save(last());
        delegate.editOverride('p12', 'comms', null, 'Comms');
        save(last());
        expect(undoLabel(state().undo)).toBe("Undo: reset P12's comms path");
        delegate.editOverride('p12', 'alarms', null, 'Alarms');
        expect(last().body.ops[0].data).toEqual({ overrides: {} });
    });

    test('L11: the item\'s other stored overrides pass through every edit; an edit that changes nothing sends nothing', () => {
        delegate.editOverride('p2', 'kpi:pressure', '[default]Mesa/P12/Pressure', 'Pressure');
        expect(last().body.ops[0].data).toEqual({ overrides: { styleRule: RULE, link: '/other', kpis: [{ key: 'pressure', path: '[default]Mesa/P12/Pressure' }] } });
        save(last());
        const before = sent().length;
        expect(delegate.editOverride('p2', 'kpi:pressure', '[default]Mesa/P12/Pressure', 'Pressure')).toBe(false);
        expect(delegate.editOverride('p2', 'kpi:flow', null, 'Flow')).toBe(false);
        expect(delegate.editOverride('nobody', 'comms', '[default]x', 'Comms')).toBe(false);
        expect(sent()).toHaveLength(before);
        delegate.editOverride('p2', 'kpi:pressure', null, 'Pressure');
        expect(last().body.ops[0].data).toEqual({ overrides: { styleRule: RULE, link: '/other' } });
    });
});

describe('a refused override (L7)', () => {
    const WORDS = '[default] is not a tag path; use a full path such as [default]Shared/GasPrice.';

    test('the Gateway\'s words stand for the row without their prefix, the entry leaves the queue and the stored overrides stand', () => {
        delegate.editOverride('p12', 'kpi:pressure', '[default]', 'Pressure');
        const edit = last();
        refuse(edit, 'invalid', 'Op 0 (p12): overrides: kpis[0].path: ' + WORDS);
        expect(state().overrideRefusals).toEqual({ p12: { row: 'kpi:pressure', words: WORDS, path: '[default]', code: 'invalid', batchId: edit.body.batchId } });
        expect(state().unsaved).toEqual([]);
        expect(state().inFlightOverrides).toEqual({});
        expect(record('p12').overrides).toEqual({});
        expect(state().undo.steps).toHaveLength(0);
        // The next override of the item clears the words and is built on the stored overrides.
        delegate.editOverride('p12', 'kpi:pressure', P14_PRESSURE, 'Pressure');
        expect(state().overrideRefusals).toEqual({});
        expect(last().body.ops[0]).toMatchObject({ baseVersion: 3, data: { overrides: { kpis: [{ key: 'pressure', path: P14_PRESSURE }] } } });
    });

    test('the panel clears the words; a conflict is not a refusal of the row (its card has it)', () => {
        delegate.editOverride('p12', 'comms', '[default]', 'Comms');
        refuse(last(), 'invalid', 'Op 0 (p12): overrides: comms.path: ' + WORDS);
        expect(state().overrideRefusals.p12).toMatchObject({ row: 'comms', words: WORDS });
        delegate.clearOverrideRefusal('p12');
        expect(state().overrideRefusals).toEqual({});
        delegate.editOverride('p12', 'comms', '[default]Mesa/P14/Comms', 'Comms');
        refuse(last(), 'conflict', 'P12 was changed.');
        expect(state().overrideRefusals).toEqual({});
        expect(state().unsaved).toHaveLength(1);
    });

    test('a field\'s refusal is not an override\'s', () => {
        delegate.renameItem('p12', 'P12b');
        refuse(last(), 'invalid', 'Op 0 (p12): name must not be empty.');
        expect(state().overrideRefusals).toEqual({});
    });
});

describe('a kind change drops the overrides in the same save (L9, owner decision 2)', () => {
    test('saved with no overrides; one Undo restores the kind and the overrides', () => {
        delegate.setKind('p2', 'tank');
        expect(last().body.ops).toEqual([{ op: 'update', entity: 'item', id: 'p2', baseVersion: 5, data: { kind: 'tank', properties: {}, overrides: {} } }]);
        save(last());
        expect(record('p2')).toMatchObject({ kind: 'tank', overrides: {} });
        delegate.undo();
        expect(last().body.ops[0].data).toEqual({ kind: 'pad', properties: {}, overrides: { styleRule: RULE, link: '/other' } });
        save(last());
        expect(record('p2')).toMatchObject({ kind: 'pad', overrides: { styleRule: RULE, link: '/other' } });
    });

    test('an item with no overrides sends none; an override still in flight goes with the kind', () => {
        delegate.setKind('p12', 'tank');
        expect(last().body.ops[0].data).toEqual({ kind: 'tank', properties: {} });
        save(last());
        delegate.setKind('p12', 'pad');
        save(last());
        delegate.editOverride('p12', 'kpi:pressure', P14_PRESSURE, 'Pressure');
        const edit = last();
        delegate.setKind('p12', 'tank');
        save(edit);
        expect(last().body.ops[0].data).toEqual({ kind: 'tank', properties: {}, overrides: {} });
    });
});
