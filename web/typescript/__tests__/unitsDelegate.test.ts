// The Layers row's saves in the store delegate (epic 4 entry 20b, R27): `saveUnits` builds one settings op from the held record
// (a create at 0 or at the tombstone's version, an update or a delete at the held version), keeps one save in flight with a later
// press waiting for the reply's version, shows the press at once and puts it back on a refusal. The matrix's U2 to U6, U8, U9 and
// U10 driven as the Gateway would answer. Perspective's base class is stood in for, as in savePause.test.ts.

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
import { EditBatch } from '../contract';
import { METRIC_UNITS } from '../geometry';
import { MESSAGE_EVENT, MessageTypes } from '../messages';
import { MapStudioStoreDelegate } from '../MapStudioStoreDelegate';
import { saveCardFor } from '../unsaved';

let delegate: MapStudioStoreDelegate;

type Fired = { id: string; type: string; body: EditBatch };

function ofType(type: string): Fired[] {
    return (delegate as unknown as { fired: Fired[] }).fired.filter((m) => m.type === type);
}

function sent(): Fired[] {
    return ofType(MessageTypes.EDITS_APPLY);
}

function last(): Fired {
    const all = sent();
    return all[all.length - 1];
}

function reply(type: string, id: string, body: unknown): void {
    delegate.handleEvent(MESSAGE_EVENT, { v: 1, type, id, body });
}

function saved(message: Fired, version: number): void {
    reply(MessageTypes.EDITS_APPLY_REPLY, message.id, { batchId: message.body.batchId, seq: 1, results: [{ entity: 'settings', id: 'units', version }] });
}

function refused(message: Fired, code: string, text: string, conflicts?: unknown[]): void {
    reply(MessageTypes.ERROR, message.id, { code, message: text, batchId: message.body.batchId, ...(conflicts ? { conflicts } : {}) });
}

function state() {
    return delegate.mapStateToProps();
}

function load(settings: unknown = {}, seq = 0): void {
    delegate.sendMapLoad();
    const loads = ofType(MessageTypes.MAP_LOAD);
    reply(MessageTypes.MAP_LOAD_REPLY, loads[loads.length - 1].id, {
        level: 'full', seq, items: [], user: 'mapeditor',
        setup: { refreshIntervalSeconds: 10, basemaps: ['none'], alarmPage: '', units: 'metric' }, settings
    });
}

beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'debug').mockImplementation(() => undefined);
    delegate = new MapStudioStoreDelegate({} as unknown as AbstractUIElementStore);
    load();
});

afterEach(() => {
    delegate.stopReplay();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('the op built from the held record (U2 to U5)', () => {
    test('set, labels, clear and set again: create at 0, update and delete at the held version, create at the tombstone\'s', () => {
        expect(state().unitsPress).toBeNull();
        // U2: US with no override is a create at 0 with short labels, shown at once.
        expect(delegate.saveUnits({ system: 'us' })).toBe(true);
        expect(last().body.ops).toEqual([{ op: 'create', entity: 'settings', id: 'units', baseVersion: 0, data: { system: 'us', labels: 'short' } }]);
        expect(state().unitsPress).toEqual({ units: { system: 'us', labels: 'short' } });
        expect(state().units).toBeNull();
        saved(last(), 1);
        expect(state().units).toEqual({ id: 'units', system: 'us', labels: 'short', version: 1, deleted: false });
        expect(state().unitsPress).toBeNull();
        // U3: Long keeps the system, an update at the held version.
        expect(delegate.saveUnits({ labels: 'long' })).toBe(true);
        expect(last().body.ops).toEqual([{ op: 'update', entity: 'settings', id: 'units', baseVersion: 1, data: { system: 'us', labels: 'long' } }]);
        saved(last(), 2);
        // A system press keeps the labels.
        expect(delegate.saveUnits({ system: 'metric' })).toBe(true);
        expect(last().body.ops).toEqual([{ op: 'update', entity: 'settings', id: 'units', baseVersion: 2, data: { system: 'metric', labels: 'long' } }]);
        saved(last(), 3);
        // U4: From setup is a delete; the press shows no override at once.
        expect(delegate.saveUnits({ system: 'setup' })).toBe(true);
        expect(last().body.ops).toEqual([{ op: 'delete', entity: 'settings', id: 'units', baseVersion: 3 }]);
        expect(state().unitsPress).toEqual({ units: null });
        saved(last(), 4);
        expect(state().units).toBeNull();
        expect(state().unitsPress).toBeNull();
        // U5: Metric after the clear is a create at the tombstone's version, with short labels again.
        expect(delegate.saveUnits({ system: 'metric' })).toBe(true);
        expect(last().body.ops).toEqual([{ op: 'create', entity: 'settings', id: 'units', baseVersion: 4, data: { system: 'metric', labels: 'short' } }]);
        saved(last(), 5);
        expect(state().units).toMatchObject({ system: 'metric', labels: 'short', version: 5 });
        // No Undo step, nothing left in the queue.
        expect(state().undo.steps).toHaveLength(0);
        expect(state().unsaved).toHaveLength(0);
    });

    test('another editor\'s clear seen by map.changed: the next set is a create at its version', () => {
        load({ units: { id: 'units', system: 'us', labels: 'long', version: 2 } }, 5);
        reply(MessageTypes.MAP_CHANGED, 'c6', { seq: 6, batchId: 'other', actor: 'mapoperator', ops: [{ op: 'delete', entity: 'settings', id: 'units', version: 3,
            record: { id: 'units', system: 'us', labels: 'long', version: 3, deleted: true } }] });
        delegate.saveUnits({ system: 'us' });
        expect(last().body.ops).toEqual([{ op: 'create', entity: 'settings', id: 'units', baseVersion: 3, data: { system: 'us', labels: 'short' } }]);
    });

    test('a setting cleared before this page loaded: the create at 0 meets the tombstone and is sent again at its version', () => {
        delegate.saveUnits({ system: 'us' });
        const first = last();
        refused(first, 'conflict', 'The units setting was changed.', [{ index: 0, entity: 'settings', id: 'units', baseVersion: 0,
            current: { id: 'units', system: 'metric', labels: 'long', version: 4, deleted: true }, changedBy: 'mapoperator', changedAt: '2026-11-12T10:44:00Z' }]);
        expect(sent()).toHaveLength(2);
        expect(last().body.batchId).not.toBe(first.body.batchId);
        expect(last().body.ops).toEqual([{ op: 'create', entity: 'settings', id: 'units', baseVersion: 4, data: { system: 'us', labels: 'short' } }]);
        expect(state().unsaved.map((e) => e.batchId)).toEqual([last().body.batchId]);
        expect(state().unitsPress).toEqual({ units: { system: 'us', labels: 'short' } });
        saved(last(), 5);
        expect(state().units).toMatchObject({ system: 'us', labels: 'short', version: 5 });
        expect(state().unsaved).toHaveLength(0);
    });

    test('an override of auto (a script\'s): a labels press keeps it', () => {
        load({ units: { id: 'units', system: 'auto', labels: 'short', version: 1 } }, 1);
        delegate.saveUnits({ labels: 'long' });
        expect(last().body.ops).toEqual([{ op: 'update', entity: 'settings', id: 'units', baseVersion: 1, data: { system: 'auto', labels: 'long' } }]);
    });
});

describe('what sends nothing (U6, U10)', () => {
    test('the pressed button: From setup and Short with no override, the held system and labels with one', () => {
        expect(delegate.saveUnits({ system: 'setup' })).toBe(false);
        // Labels have no meaning without an override: the group is disabled, and a press sends nothing.
        expect(delegate.saveUnits({ labels: 'short' })).toBe(false);
        expect(delegate.saveUnits({ labels: 'long' })).toBe(false);
        load({ units: { id: 'units', system: 'us', labels: 'long', version: 2 } }, 1);
        expect(delegate.saveUnits({ system: 'us' })).toBe(false);
        expect(delegate.saveUnits({ labels: 'long' })).toBe(false);
        expect(sent()).toHaveLength(0);
        expect(state().unitsPress).toBeNull();
    });

    test('the button already pressed by a press in flight', () => {
        delegate.saveUnits({ system: 'us' });
        expect(delegate.saveUnits({ system: 'us' })).toBe(false);
        expect(sent()).toHaveLength(1);
    });

    test('while editing is paused nothing is sent', () => {
        delegate.saveUnits({ system: 'us' });
        refused(last(), 'store-unreachable', 'Map Studio could not reach the map store.');
        expect(state().editing).toBe('off');
        const before = sent().length;
        expect(delegate.saveUnits({ system: 'metric' })).toBe(false);
        expect(sent()).toHaveLength(before);
    });
});

describe('one save in flight (U8)', () => {
    test('US then Long before the first reply: two saves, the second at the first reply\'s version', () => {
        delegate.saveUnits({ system: 'us' });
        expect(delegate.saveUnits({ labels: 'long' })).toBe(true);
        expect(sent()).toHaveLength(1);
        expect(state().unitsPress).toEqual({ units: { system: 'us', labels: 'long' } });
        saved(last(), 1);
        expect(sent()).toHaveLength(2);
        expect(last().body.ops).toEqual([{ op: 'update', entity: 'settings', id: 'units', baseVersion: 1, data: { system: 'us', labels: 'long' } }]);
        expect(state().unitsPress).toEqual({ units: { system: 'us', labels: 'long' } });
        saved(last(), 2);
        expect(state().units).toEqual({ id: 'units', system: 'us', labels: 'long', version: 2, deleted: false });
        expect(state().unitsPress).toBeNull();
    });

    test('a press that waits and ends where the store already is sends nothing more', () => {
        delegate.saveUnits({ system: 'us' });
        delegate.saveUnits({ system: 'metric' });
        delegate.saveUnits({ system: 'us' });
        saved(last(), 1);
        expect(sent()).toHaveLength(1);
        expect(state().unitsPress).toBeNull();
    });

    test('a press while a Revert of the units is being saved waits for it and builds on what it saved', () => {
        load({ units: { id: 'units', system: 'us', labels: 'long', version: 1 } }, 8);
        delegate.setHistoryOpen(true);
        const reads = ofType(MessageTypes.EDITS_HISTORY);
        reply(MessageTypes.EDITS_HISTORY_REPLY, reads[reads.length - 1].id, { more: false, entries: [{
            seq: 8, batchId: 'b8', actor: 'mapoperator', at: '2026-11-12T10:42:05Z', source: 'session',
            ops: [{ op: 'create', entity: 'settings', id: 'units', name: null, kind: 'units', version: 1, before: null, after: { system: 'us', labels: 'long' } }]
        }] });
        expect(delegate.revert(8)).toBe(true);
        const revert = last();
        expect(revert.body.ops).toEqual([{ op: 'delete', entity: 'settings', id: 'units', baseVersion: 1 }]);
        expect(delegate.saveUnits({ system: 'metric' })).toBe(true);
        expect(sent()).toHaveLength(1);
        saved(revert, 2);
        // The override is cleared now: what the press showed (Metric, with the labels it kept) is a create at the tombstone's version.
        expect(last().body.ops).toEqual([{ op: 'create', entity: 'settings', id: 'units', baseVersion: 2, data: { system: 'metric', labels: 'long' } }]);
    });
});

describe('a refusal puts the press back (U9, decision 5)', () => {
    const THEIRS = { id: 'units', system: 'metric', labels: 'long', version: 2, deleted: false };

    test('a conflict: the stored value shows, the press and what waited behind it are gone, the save card tells it', () => {
        load({ units: { id: 'units', system: 'metric', labels: 'short', version: 1 } }, 1);
        delegate.saveUnits({ system: 'us' });
        delegate.saveUnits({ labels: 'long' });
        const first = last();
        refused(first, 'conflict', 'The units setting was changed by mapoperator at 10:44 UTC since you loaded it. Nothing in this save was written.',
            [{ index: 0, entity: 'settings', id: 'units', baseVersion: 1, current: THEIRS, changedBy: 'mapoperator', changedAt: '2026-11-12T10:44:00Z' }]);
        const now = state();
        expect(now.unitsPress).toBeNull();
        expect(now.units).toEqual(THEIRS);
        expect(sent()).toHaveLength(1);
        expect(now.unsaved).toHaveLength(1);
        const card = saveCardFor({ unsaved: now.unsaved, paused: false, dismissed: [], records: now.items, kinds: [], distanceUnits: METRIC_UNITS });
        // Apply mine on top is not offered (decision 7: it would be an Undo step that reverses nothing); the row is pressed again.
        expect(card).toMatchObject({ kind: 'conflict', who: 'mapoperator', onTop: false, blocked: '' });
        const undoBefore = now.undo.steps.length;
        delegate.applyOnTop(first.body.batchId);
        expect(sent()).toHaveLength(1);
        expect(state().undo.steps).toHaveLength(undoBefore);
        // The next press builds on the stored value.
        delegate.saveUnits({ system: 'us' });
        expect(last().body.ops).toEqual([{ op: 'update', entity: 'settings', id: 'units', baseVersion: 2, data: { system: 'us', labels: 'long' } }]);
    });

    test('a role refusal: the press is put back and the entry stays for the save card', () => {
        delegate.saveUnits({ system: 'us' });
        refused(last(), 'role', 'Changing the units needs the full editing role.');
        expect(state().unitsPress).toBeNull();
        expect(state().units).toBeNull();
        expect(state().unsaved).toHaveLength(1);
        expect(state().unsaved[0].state).toBe('refused');
    });

    test('a store that does not answer keeps the press, and the replay that saves settles it', () => {
        delegate.saveUnits({ system: 'us' });
        const first = last();
        refused(first, 'store-unreachable', 'Map Studio could not reach the map store.');
        expect(state().unitsPress).toEqual({ units: { system: 'us', labels: 'short' } });
        delegate.retryStore();
        expect(last().id).not.toBe(first.id);
        expect(last().body.batchId).toBe(first.body.batchId);
        saved(last(), 1);
        expect(state().unitsPress).toBeNull();
        expect(state().units).toMatchObject({ system: 'us', labels: 'short', version: 1 });
    });

    test('another tab saved or dropped the queued save: the flight is settled, the press put back and the next press sent', () => {
        const data = new Map<string, string>();
        const storage = {
            getItem: (k: string) => (data.has(k) ? data.get(k) as string : null),
            setItem: (k: string, v: string) => { data.set(k, v); },
            removeItem: (k: string) => { data.delete(k); }
        };
        (global as unknown as { window: unknown }).window = { localStorage: storage };
        try {
            delegate.stopReplay();
            delegate = new MapStudioStoreDelegate({ view: { page: { parent: { projectName: 'p' } } } } as unknown as AbstractUIElementStore);
            load();
            delegate.saveUnits({ system: 'us' });
            const first = last();
            // No answer the store gave: the entry waits in the queue, the press still shown.
            refused(first, 'store-unreachable', 'Map Studio is busy; try again in a moment.');
            expect(state().unitsPress).toEqual({ units: { system: 'us', labels: 'short' } });
            const key = Array.from(data.keys())[0];
            data.delete(key);
            delegate.onStorage(key);
            expect(state().unsaved).toEqual([]);
            expect(state().unitsPress).toBeNull();
            // The other tab's save reaches this one as a map.changed; the next press builds on it and is sent.
            reply(MessageTypes.MAP_CHANGED, 'c1', { seq: 1, batchId: first.body.batchId, actor: 'mapeditor', ops: [{ op: 'create', entity: 'settings', id: 'units', version: 1,
                record: { id: 'units', system: 'us', labels: 'short', version: 1, deleted: false } }] });
            const before = sent().length;
            expect(delegate.saveUnits({ labels: 'long' })).toBe(true);
            expect(sent()).toHaveLength(before + 1);
            expect(last().body.ops).toEqual([{ op: 'update', entity: 'settings', id: 'units', baseVersion: 1, data: { system: 'us', labels: 'long' } }]);
        } finally {
            delete (global as unknown as { window?: unknown }).window;
        }
    });

    test('Discard of the save that waits for the store puts the press back', () => {
        delegate.saveUnits({ system: 'us' });
        refused(last(), 'store-unreachable', 'Map Studio could not reach the map store.');
        delegate.discardUnsaved(last().body.batchId);
        expect(state().unitsPress).toBeNull();
        expect(state().unsaved).toHaveLength(0);
    });
});
