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

describe('the item\'s own style rule is the styleRule row (entry 12c2: T4, T5, T7, T10, T11)', () => {
    const OWN = { source: { path: '[default]Mesa/P12/Status' }, type: 'states', cases: [{ value: 1, preset: 'fault' }] };

    test('T4, T10: a rule is one update of the whole overrides with only styleRule set, an Undo step named for the style rule', () => {
        expect(delegate.editOverride('p12', 'styleRule', OWN, '')).toBe(true);
        expect(last().body.ops).toEqual([{ op: 'update', entity: 'item', id: 'p12', baseVersion: 3, data: { overrides: { styleRule: OWN } } }]);
        // Marked Override at once, from the batch in flight.
        expect(state().inFlightOverrides).toEqual({ p12: { styleRule: OWN } });
        save(last());
        expect(record('p12').overrides).toEqual({ styleRule: OWN });
        expect(undoLabel(state().undo)).toBe("Undo: change P12's style rule");
        delegate.undo();
        expect(last().body.ops[0].data).toEqual({ overrides: {} });
        save(last());
        expect(record('p12').overrides).toEqual({});
    });

    test('T5: Reset removes the rule alone, named "reset"; one with no rule sends nothing', () => {
        expect(delegate.editOverride('p2', 'styleRule', null, '')).toBe(true);
        expect(last().body.ops[0]).toMatchObject({ id: 'p2', baseVersion: 5, data: { overrides: { link: '/other' } } });
        save(last());
        expect(undoLabel(state().undo)).toBe("Undo: reset Point 2's style rule");
        const before = sent().length;
        expect(delegate.editOverride('p12', 'styleRule', null, '')).toBe(false);
        expect(sent()).toHaveLength(before);
    });

    test('T11: the path overrides and every other stored part pass through a rule edit, those still in flight too', () => {
        delegate.editOverride('p12', 'kpi:pressure', P14_PRESSURE, 'Pressure');
        const first = last();
        delegate.editOverride('p12', 'styleRule', OWN, '');
        expect(state().inFlightOverrides.p12).toEqual({ kpis: [{ key: 'pressure', path: P14_PRESSURE }], styleRule: OWN });
        save(first);
        expect(last().body.ops[0]).toMatchObject({ baseVersion: 4, data: { overrides: { kpis: [{ key: 'pressure', path: P14_PRESSURE }], styleRule: OWN } } });
        save(last());
        // A changed rule on Point 2 keeps its stored link; the same rule again sends nothing.
        delegate.editOverride('p2', 'styleRule', OWN, '');
        expect(last().body.ops[0].data).toEqual({ overrides: { styleRule: OWN, link: '/other' } });
        save(last());
        const before = sent().length;
        expect(delegate.editOverride('p2', 'styleRule', { ...OWN }, '')).toBe(false);
        expect(sent()).toHaveLength(before);
    });

    test('T7: a refusal stands beside the part of the rule it names, the entry leaves the queue and the stored overrides stand', () => {
        delegate.editOverride('p12', 'styleRule', OWN, '');
        const edit = last();
        refuse(edit, 'invalid', 'Op 0 (p12): overrides: styleRule.cases[0].preset: Pick a preset: normal, attention, warning, fault, dimmed.');
        expect(state().overrideRefusals).toEqual({ p12: { row: 'styleRule', words: 'Pick a preset: normal, attention, warning, fault, dimmed.', path: '',
            code: 'invalid', batchId: edit.body.batchId, at: 'styleRule.cases.0' } });
        expect(state().unsaved).toEqual([]);
        expect(state().inFlightOverrides).toEqual({});
        expect(record('p12').overrides).toEqual({});
        // A refusal that names no part of the rule stands in the rule's own box; the next rule sent clears it.
        delegate.editOverride('p12', 'styleRule', { ...OWN, cases: [{ value: 2, preset: 'fault' }] }, '');
        expect(state().overrideRefusals).toEqual({});
        refuse(last(), 'role', 'Editing needs the full editing role.');
        expect(state().overrideRefusals.p12).toMatchObject({ row: 'styleRule', at: 'styleRule', words: 'Editing needs the full editing role.' });
        // A conflict is the conflict card's, as any item edit's.
        delegate.clearOverrideRefusal('p12');
        delegate.editOverride('p12', 'styleRule', OWN, '');
        refuse(last(), 'conflict', 'P12 was changed.');
        expect(state().overrideRefusals).toEqual({});
        expect(state().unsaved).toHaveLength(1);
    });

    test('a rule built on an older version of the item goes at that version, so another editor\'s rule since is a conflict', () => {
        // Another editor's rule arrives while this one is half built: the item is at version 4, the draft in step at 3.
        delegate.handleEvent(MESSAGE_EVENT, { v: 1, type: MessageTypes.MAP_CHANGED, id: 'c1', body: { seq: 1,
            ops: [{ op: 'update', entity: 'item', id: 'p12', version: 4, record: { ...P12, overrides: { styleRule: RULE }, version: 4 } }] } });
        expect(record('p12').version).toBe(4);
        expect(delegate.editOverride('p12', 'styleRule', OWN, '', 3)).toBe(true);
        expect(last().body.ops[0]).toMatchObject({ id: 'p12', baseVersion: 3, data: { overrides: { styleRule: OWN } } });
        refuse(last(), 'conflict', 'P12 was changed.');
        // The conflict card's, not a refusal of the rule: the batch stays in the queue and their rule stands.
        expect(state().overrideRefusals).toEqual({});
        expect(state().unsaved).toHaveLength(1);
        expect(record('p12').overrides).toEqual({ styleRule: RULE });
        // With no base, or one that is not older, it goes at the newest version.
        delegate.editOverride('p2', 'styleRule', OWN, '');
        expect(last().body.ops[0]).toMatchObject({ id: 'p2', baseVersion: 5 });
    });

    test('an expression the Gateway cannot read stands beside the expression, in its words without their prefix', () => {
        delegate.editOverride('p12', 'styleRule', { type: 'expression', expression: '{pressure} > 1' }, '');
        refuse(last(), 'invalid', 'Op 0 (p12): overrides.styleRule.expression: the expression could not be read: a style rule may'
            + ' reference {value} only, not {pressure}');
        expect(state().overrideRefusals.p12).toMatchObject({ row: 'styleRule', at: 'styleRule.expression',
            words: 'the expression could not be read: a style rule may reference {value} only, not {pressure}' });
    });

    test('a value of the wrong kind for its row is dropped: a path is not a rule, and a rule is not a path', () => {
        const before = sent().length;
        expect(delegate.editOverride('p12', 'styleRule', '[default]Mesa/P12/Status', '')).toBe(false);
        expect(delegate.editOverride('p12', 'comms', OWN, 'Comms')).toBe(false);
        expect(sent()).toHaveLength(before);
    });
});
