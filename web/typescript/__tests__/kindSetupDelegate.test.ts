// The Kinds screen's saves in the store delegate (epic 4 entry 12a): one edited part saved as the kind's whole setup, built from
// the newest stored one when it is sent (K2, K10), one save per kind in flight and the later edits after it at the version its
// reply gave, a create at version 0 for a kind with no setup (K9), never an undo step (K12), an invalid reply's words kept for the
// field they name while the stored setup stands (K5, K6), another editor's save meeting the field typed before it as a conflict
// that stays in the queue with its card (K11), and `tags.resolve` asked for the resolve notes (K8). Driven as the Gateway would
// answer; Perspective's base class is stood in for, as in historyDelegate.test.ts.

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
import { KindSetupRecord } from '../contract';
import { resolveKey } from '../kindSetup';
import { MESSAGE_EVENT, MessageTypes } from '../messages';
import { MapStudioStoreDelegate, RESOLVE_TIMEOUT_MS } from '../MapStudioStoreDelegate';
import { isSetupSave, saveCardFor } from '../unsaved';

const PAD_SETUP = {
    comms: { path: '{asset.path}/Comms', on: true },
    kpis: [
        { key: 'pressure', label: 'Pressure', path: '{asset.path}/Pressure', unit: 'psi', on: true, icon: true },
        { key: 'flow', label: 'Flow', path: '{asset.path}/Flow', unit: 'bbl/d', on: true, icon: false }],
    alarms: { path: '{asset.path}', count: true, summary: true },
    link: '/pad/{item.name}',
    styleRule: { source: { path: '{asset.path}/Status' }, type: 'states', cases: [{ value: 1, preset: 'attention' }] }
};
const PAD: KindSetupRecord = { kindId: 'pad', setup: PAD_SETUP, version: 3, deleted: false };
const KINDS = [
    { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] },
    { id: 'meter', name: 'Meter', geometry: 'point', icon: 'meter', labelRank: 2, fields: [], instrument: true }
];
const BUSY = 'Map Studio is busy with other map requests; nothing was saved. Try again in a moment.';

type Op = { op: string; entity: string; id: string; baseVersion: number; data: { setup: Record<string, unknown> } };
type Fired = { id: string; type: string; body: { batchId: string; ops: Op[]; kindId?: string; assetId?: string; path?: string } };

let delegate: MapStudioStoreDelegate;

function ofType(type: string): Fired[] {
    return (delegate as unknown as { fired: Fired[] }).fired.filter((m) => m.type === type);
}

function lastOf(type: string): Fired {
    const all = ofType(type);
    return all[all.length - 1];
}

function reply(type: string, id: string, body: unknown): void {
    delegate.handleEvent(MESSAGE_EVENT, { v: 1, type, id, body });
}

function applies(): Fired[] {
    return ofType(MessageTypes.EDITS_APPLY);
}

/** The Gateway saved the last edits.apply: its kind setup at `version`. */
function saved(version: number, message: Fired = lastOf(MessageTypes.EDITS_APPLY)): void {
    reply(MessageTypes.EDITS_APPLY_REPLY, message.id, { batchId: message.body.batchId, seq: 20 + version,
        results: message.body.ops.map((op) => ({ entity: op.entity, id: op.id, version })) });
}

function refused(code: string, text: string, extra: Record<string, unknown> = {}, message: Fired = lastOf(MessageTypes.EDITS_APPLY)): void {
    reply(MessageTypes.ERROR, message.id, { code, message: text, batchId: message.body.batchId, ...extra });
}

function state() {
    return delegate.mapStateToProps();
}

function stored(kindId: string): KindSetupRecord | undefined {
    return state().kindSetups.find((k) => k.kindId === kindId);
}

function saves(kindId: string) {
    return state().kindSaves[kindId];
}

/** Another editor's save of the pad setup, as map.changed tells every open map. */
function theirChange(version: number, setup: Record<string, unknown>, seq: number): void {
    reply(MessageTypes.MAP_CHANGED, 'c' + seq, { seq, batchId: 'their-' + seq, actor: 'mapeditor2', ops: [
        { op: 'update', entity: 'kindSetup', id: 'pad', version, record: { kindId: 'pad', setup, version, deleted: false } }] });
}

beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'debug').mockImplementation(() => undefined);
    delegate = new MapStudioStoreDelegate({} as unknown as AbstractUIElementStore);
    delegate.sendMapLoad();
    reply(MessageTypes.MAP_LOAD_REPLY, lastOf(MessageTypes.MAP_LOAD).id,
        { level: 'full', seq: 7, items: [], kinds: KINDS, kindSetups: [PAD], user: 'mapeditor' });
});

afterEach(() => {
    delegate.stopReplay();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('a finished field is saved as the whole setup (K2, K9, K10, K12)', () => {
    test('K2: one part changed on the stored setup, an update at the stored version; the reply\'s version is the stored one after', () => {
        expect(delegate.saveKindSetup('pad', 'kpis.pressure.path', { part: 'kpi', key: 'pressure', patch: { path: '{asset.path}/Flow' } }, 3)).toBe(true);
        const op = lastOf(MessageTypes.EDITS_APPLY).body.ops[0];
        expect(op).toMatchObject({ op: 'update', entity: 'kindSetup', id: 'pad', baseVersion: 3 });
        expect(op.data.setup).toEqual({ ...PAD_SETUP, kpis: [{ ...PAD_SETUP.kpis[0], path: '{asset.path}/Flow' }, PAD_SETUP.kpis[1]] });
        expect(saves('pad')).toEqual({ saving: ['kpis.pressure.path'], refusals: [], done: 0 });
        expect(state().save.state).toBe('saving');
        saved(4);
        expect(stored('pad')).toEqual({ kindId: 'pad', setup: op.data.setup, version: 4, deleted: false });
        expect(saves('pad')).toEqual({ saving: [], refusals: [], done: 1 });
        expect(state().save).toMatchObject({ state: 'saved', itemId: 'pad', version: 4 });
        expect(state().unsaved).toEqual([]);
    });

    test('K10: a second field finished while the first is saved waits, and is built on what the first stored, at its reply\'s version', () => {
        delegate.saveKindSetup('pad', 'comms.path', { part: 'comms.path', path: '{asset.path}/Heartbeat' }, 3);
        delegate.saveKindSetup('pad', 'link', { part: 'link', link: '/site/{asset.id}' }, 3);
        expect(applies()).toHaveLength(1);
        expect(saves('pad').saving).toEqual(['comms.path', 'link']);
        saved(4);
        expect(applies()).toHaveLength(2);
        const second = lastOf(MessageTypes.EDITS_APPLY).body.ops[0];
        expect(second.baseVersion).toBe(4);
        // The second save carries the first field's new value, not the copy it was typed beside.
        expect(second.data.setup).toEqual({ ...PAD_SETUP, comms: { path: '{asset.path}/Heartbeat', on: true }, link: '/site/{asset.id}' });
        saved(5);
        expect(stored('pad')!.version).toBe(5);
        expect(saves('pad')).toEqual({ saving: [], refusals: [], done: 2 });
    });

    test('K9: a kind with no setup is saved as a create at version 0', () => {
        delegate.saveKindSetup('meter', 'link', { part: 'link', link: '/meter/{item.name}' }, 0);
        expect(lastOf(MessageTypes.EDITS_APPLY).body.ops[0]).toEqual(
            { op: 'create', entity: 'kindSetup', id: 'meter', baseVersion: 0, data: { setup: { link: '/meter/{item.name}' } } });
        saved(1);
        expect(stored('meter')).toEqual({ kindId: 'meter', setup: { link: '/meter/{item.name}' }, version: 1, deleted: false });
        // The first-run checklist's step 1 counts it.
        expect(state().kindSetups).toHaveLength(2);
    });

    test('K9: a create that meets a setup deleted before is sent again at the tombstone\'s version, which restores it', () => {
        delegate.saveKindSetup('meter', 'link', { part: 'link', link: '/meter/{item.name}' }, 0);
        refused('conflict', 'The Meter kind setup was changed.', { conflicts: [{ index: 0, entity: 'kindSetup', id: 'meter', baseVersion: 0,
            current: { kindId: 'meter', setup: { link: '/old' }, version: 6, deleted: true }, changedBy: 'script', changedAt: '2026-11-01T10:00:00Z' }] });
        expect(applies()).toHaveLength(2);
        expect(lastOf(MessageTypes.EDITS_APPLY).body.ops[0]).toMatchObject({ op: 'create', id: 'meter', baseVersion: 6, data: { setup: { link: '/meter/{item.name}' } } });
        expect(state().unsaved).toHaveLength(1);
        saved(7);
        expect(stored('meter')!.version).toBe(7);
        expect(state().unsaved).toEqual([]);
    });

    test('a setup deleted by a script while the page is open is saved again from the screen: a create at the tombstone\'s version', () => {
        reply(MessageTypes.MAP_CHANGED, 'c8', { seq: 8, batchId: 'script-8', actor: 'script', ops: [
            { op: 'delete', entity: 'kindSetup', id: 'pad', version: 4, record: { kindId: 'pad', setup: PAD_SETUP, version: 4, deleted: true } }] });
        expect(stored('pad')).toBeUndefined();
        // The panel shows no setup (version 0); a field typed now is a create that restores the deleted one.
        delegate.saveKindSetup('pad', 'link', { part: 'link', link: '/again' }, 0);
        expect(applies()).toHaveLength(1);
        expect(lastOf(MessageTypes.EDITS_APPLY).body.ops[0]).toEqual(
            { op: 'create', entity: 'kindSetup', id: 'pad', baseVersion: 4, data: { setup: { link: '/again' } } });
        saved(5);
        expect(stored('pad')).toEqual({ kindId: 'pad', setup: { link: '/again' }, version: 5, deleted: false });
        expect(state().unsaved).toEqual([]);
        // The next edit is an ordinary update at the stored version.
        delegate.saveKindSetup('pad', 'link', { part: 'link', link: '/once more' }, 5);
        expect(lastOf(MessageTypes.EDITS_APPLY).body.ops[0]).toMatchObject({ op: 'update', baseVersion: 5 });
    });

    test('K12: a setup save is no undo step, and Undo does not wait on it', () => {
        delegate.saveKindSetup('pad', 'link', { part: 'link', link: '/x' }, 3);
        expect(state().editInFlight).toBe(false);
        saved(4);
        expect(state().undo.steps).toEqual([]);
        expect(state().undo.done).toBe(0);
    });

    test('an edit that changes nothing sends nothing and is settled; a kind not in the list, or a paused store, is not taken', () => {
        expect(delegate.saveKindSetup('pad', 'link', { part: 'link', link: '/pad/{item.name}' }, 3)).toBe(true);
        expect(applies()).toHaveLength(0);
        expect(saves('pad')).toEqual({ saving: [], refusals: [], done: 1 });
        expect(delegate.saveKindSetup('tank', 'link', { part: 'link', link: '/x' }, 0)).toBe(false);
    });
});

describe('a refused value (K5, K6)', () => {
    test('K5: the Gateway\'s words stand beside Link; the entry leaves the queue, the stored link stands, and nothing says saved', () => {
        delegate.saveKindSetup('pad', 'link', { part: 'link', link: '//x' }, 3);
        const batchId = lastOf(MessageTypes.EDITS_APPLY).body.batchId;
        refused('invalid', 'Op 0 (pad): link is a Perspective page path starting with one / (/pad/{item.name}), not //x.', { op: { index: 0, id: 'pad' } });
        expect(saves('pad')).toEqual({ saving: [], done: 1, refusals: [{ field: 'link', at: 'link', code: 'invalid', batchId,
            words: 'link is a Perspective page path starting with one / (/pad/{item.name}), not //x.' }] });
        expect(state().unsaved).toEqual([]);
        expect(stored('pad')).toEqual(PAD);
        expect(state().save).toMatchObject({ state: 'refused', code: 'invalid' });
        // The field saved again clears its words; saved, none stand.
        delegate.saveKindSetup('pad', 'link', { part: 'link', link: '/x' }, 3);
        expect(saves('pad').refusals).toEqual([]);
        saved(4);
        expect(stored('pad')!.setup.link).toBe('/x');
    });

    test('K6: a param is refused beside its row, by its name as sent; a later edit still goes, on the stored setup', () => {
        delegate.saveKindSetup('pad', 'popupView.path', { part: 'popupView.path', path: 'Popups/PadDetails' }, 3);
        saved(4);
        delegate.saveKindSetup('pad', 'popupView.params.mapItem', { part: 'param.add', name: 'mapItem', value: '{item.id}' }, 4);
        delegate.saveKindSetup('pad', 'comms.on', { part: 'comms.on', on: false }, 4);
        refused('invalid', 'Op 0 (pad): popupView.params.mapItem: the popup view always receives the map item as mapItem, so no param may be named mapItem.');
        expect(saves('pad').refusals).toMatchObject([{ field: 'popupView.params.mapItem', at: 'popupView.params.mapItem',
            words: 'the popup view always receives the map item as mapItem, so no param may be named mapItem.' }]);
        // The next edit was built on the stored setup, without the refused param.
        const next = lastOf(MessageTypes.EDITS_APPLY).body.ops[0];
        expect(next.baseVersion).toBe(4);
        expect(next.data.setup.popupView).toEqual({ path: 'Popups/PadDetails' });
        expect(next.data.setup.comms).toEqual({ path: '{asset.path}/Comms', on: false });
        saved(5);
        expect(saves('pad').refusals).toHaveLength(1);
        // The panel leaving clears what left the queue.
        delegate.clearKindRefusals('pad');
        expect(saves('pad').refusals).toEqual([]);
    });

    test('a key value\'s refusal is placed by the order the rows were sent in', () => {
        delegate.saveKindSetup('pad', 'kpis.gas', { part: 'kpi.add', row: { key: 'gas', label: 'Gas', path: 'nope', unit: '' } }, 3);
        refused('invalid', 'Op 0 (pad): kpis[2].path: nope is not a tag path; use {asset.path}, {asset.path}/<path> or a full path such as [default]Shared/GasPrice.');
        expect(saves('pad').refusals[0]).toMatchObject({ field: 'kpis.gas', at: 'kpis.gas.path' });
        delegate.clearKindRefusals('pad', 'kpis.gas');
        expect(saves('pad').refusals).toEqual([]);
    });
});

// Entry 12b1: the rule and the tints are each one part, sent whole on the stored setup; a refused case stands beside its row.
describe('the style rule and the area tints saved as parts (12b1: S1, S6, S8, S10)', () => {
    const bands = { source: { kpi: 'pressure' }, type: 'bands', cases: [{ min: null, max: 900, preset: 'normal' }, { min: 900, max: null, preset: 'warning' }] };

    test('S1, S10: a whole rule replaces the stored one and every other part is sent as stored; None removes it', () => {
        expect(delegate.saveKindSetup('pad', 'styleRule', { part: 'styleRule', rule: bands }, 3)).toBe(true);
        const op = lastOf(MessageTypes.EDITS_APPLY).body.ops[0];
        expect(op).toMatchObject({ op: 'update', entity: 'kindSetup', id: 'pad', baseVersion: 3 });
        expect(op.data.setup).toEqual({ ...PAD_SETUP, styleRule: bands });
        for (const key of ['comms', 'kpis', 'alarms', 'link'] as const) {
            expect(op.data.setup[key]).toBe(PAD_SETUP[key]);
        }
        saved(4);
        expect(stored('pad')!.setup.styleRule).toEqual(bands);
        expect(state().undo.done).toBe(0);
        delegate.saveKindSetup('pad', 'styleRule', { part: 'styleRule', rule: null }, 4);
        const removed = lastOf(MessageTypes.EDITS_APPLY).body.ops[0];
        expect(removed.baseVersion).toBe(4);
        expect('styleRule' in removed.data.setup).toBe(false);
        expect(removed.data.setup.kpis).toBe(PAD_SETUP.kpis);
    });

    test('the stored rule sent again changes nothing and sends nothing', () => {
        const before = applies().length;
        delegate.saveKindSetup('pad', 'styleRule', { part: 'styleRule', rule: JSON.parse(JSON.stringify(PAD_SETUP.styleRule)) }, 3);
        expect(applies()).toHaveLength(before);
        expect(saves('pad')).toEqual({ saving: [], refusals: [], done: 1 });
    });

    test('S8: a refused case stands beside the row at that place as sent, the stored rule stands; the expression\'s reason beside its field', () => {
        const rule = { ...bands, cases: [bands.cases[0], { min: 900, max: 600, preset: 'warning' }] };
        delegate.saveKindSetup('pad', 'styleRule', { part: 'styleRule', rule }, 3);
        refused('invalid', 'Op 0 (pad): styleRule.cases[1]: min must be below max.');
        expect(saves('pad').refusals).toEqual([expect.objectContaining({ field: 'styleRule', at: 'styleRule.cases.1', words: 'min must be below max.', code: 'invalid' })]);
        expect(stored('pad')).toEqual(PAD);
        expect(state().unsaved).toEqual([]);
        delegate.saveKindSetup('pad', 'styleRule', { part: 'styleRule', rule: { type: 'expression', expression: 'if(' } }, 3);
        // Saved again: the last refusal's words go.
        expect(saves('pad').refusals).toEqual([]);
        refused('invalid', 'Op 0 (pad): styleRule.expression: the expression could not be read: unexpected end of the expression.');
        expect(saves('pad').refusals[0]).toMatchObject({ field: 'styleRule', at: 'styleRule.expression',
            words: 'the expression could not be read: unexpected end of the expression.' });
    });

    test('S9: the tints are one part; a refused tint is named by its category as sent', () => {
        const tints = { property: 'operator', tints: [{ category: 'North', tint: 'tint-1' }, { category: 'South', tint: 'tint-9' }] };
        delegate.saveKindSetup('pad', 'areaTints', { part: 'areaTints', tints }, 3);
        const op = lastOf(MessageTypes.EDITS_APPLY).body.ops[0];
        expect(op.data.setup).toEqual({ ...PAD_SETUP, areaTints: tints });
        expect(op.data.setup.styleRule).toBe(PAD_SETUP.styleRule);
        refused('invalid', 'Op 0 (pad): areaTints.tints[1].tint: "tint-9" is not a tint. Pick a tint: tint-1, tint-2, tint-3, tint-4, tint-5, tint-6; colour codes are not accepted.');
        expect(saves('pad').refusals[0]).toMatchObject({ field: 'areaTints', at: 'areaTints.tints.South' });
    });
});

describe('two editors (K11)', () => {
    test('another editor\'s save shows at once; the field typed before it is saved at the version it was typed on, and is a conflict', () => {
        // A began typing in Link at version 3; B saved the comms path.
        const theirs = { ...PAD_SETUP, comms: { path: '{asset.path}/Heartbeat', on: true } };
        theirChange(4, theirs, 8);
        expect(stored('pad')).toEqual({ kindId: 'pad', setup: theirs, version: 4, deleted: false });
        delegate.saveKindSetup('pad', 'link', { part: 'link', link: '/mine' }, 3);
        const sent = lastOf(MessageTypes.EDITS_APPLY).body;
        expect(sent.ops[0].baseVersion).toBe(3);
        // Built on B's setup all the same: only the version says the field was typed before it.
        expect(sent.ops[0].data.setup).toEqual({ ...theirs, link: '/mine' });
        refused('conflict', 'The Well pad kind setup was changed by mapeditor2 since you loaded it. Nothing in this save was written.', {
            conflicts: [{ index: 0, entity: 'kindSetup', id: 'pad', baseVersion: 3, current: { kindId: 'pad', setup: theirs, version: 4, deleted: false },
                changedBy: 'mapeditor2', changedAt: '2026-11-09T10:42:05Z' }] });
        // The entry stays in the queue with its card, which offers only their version; the field keeps what was typed meanwhile.
        const entry = state().unsaved[0];
        expect(entry).toMatchObject({ batchId: sent.batchId, state: 'refused', reason: { code: 'conflict', changedBy: 'mapeditor2' } });
        expect(isSetupSave(entry)).toBe(true);
        const card = saveCardFor({ unsaved: state().unsaved, paused: false, dismissed: [], records: [], kinds: KINDS as never, locale: '' });
        expect(card).toMatchObject({ kind: 'conflict', who: 'mapeditor2', onTop: false });
        expect(saves('pad')).toMatchObject({ saving: ['link'], refusals: [{ field: 'link', code: 'conflict', words: '' }] });
        // Apply mine on top is not offered for a setup.
        delegate.applyOnTop(sent.batchId);
        expect(applies()).toHaveLength(1);
        expect(state().unsaved).toHaveLength(1);
        delegate.useTheirs(sent.batchId);
        expect(state().unsaved).toEqual([]);
        expect(saves('pad')).toEqual({ saving: [], refusals: [], done: 1 });
        expect(stored('pad')!.setup).toEqual(theirs);
    });

    test('a field typed after their save has shown is saved at the stored version; this page\'s own saves are never another editor\'s', () => {
        theirChange(4, { ...PAD_SETUP, link: '/theirs' }, 8);
        delegate.saveKindSetup('pad', 'comms.on', { part: 'comms.on', on: false }, 4);
        expect(lastOf(MessageTypes.EDITS_APPLY).body.ops[0].baseVersion).toBe(4);
        const mine = lastOf(MessageTypes.EDITS_APPLY);
        // The Gateway tells this map of its own save too, before the reply: it is not another editor's.
        reply(MessageTypes.MAP_CHANGED, 'c9', { seq: 9, batchId: mine.body.batchId, actor: 'mapeditor', ops: [
            { op: 'update', entity: 'kindSetup', id: 'pad', version: 5, record: { kindId: 'pad', setup: mine.body.ops[0].data.setup, version: 5, deleted: false } }] });
        saved(5, mine);
        // A field typed on version 4, finished after this page's own save made 5, goes at 5.
        delegate.saveKindSetup('pad', 'link', { part: 'link', link: '/mine' }, 4);
        expect(lastOf(MessageTypes.EDITS_APPLY).body.ops[0].baseVersion).toBe(5);
    });

    test('busy keeps the save queued and replaying, entry 10\'s; Discard lets it go and the next edit is sent', () => {
        delegate.saveKindSetup('pad', 'link', { part: 'link', link: '/x' }, 3);
        delegate.saveKindSetup('pad', 'comms.on', { part: 'comms.on', on: false }, 3);
        const first = lastOf(MessageTypes.EDITS_APPLY);
        refused('store-unreachable', BUSY);
        expect(state().unsaved).toMatchObject([{ batchId: first.body.batchId, state: 'unsent', reason: { code: 'store-unreachable' } }]);
        expect(state().savePaused).toBe(false);
        expect(saves('pad').saving).toEqual(['link', 'comms.on']);
        delegate.discardUnsaved(first.body.batchId);
        // The discarded edit is gone; the waiting one is sent on the stored setup.
        const next = lastOf(MessageTypes.EDITS_APPLY).body.ops[0];
        expect(next.data.setup).toEqual({ ...PAD_SETUP, comms: { path: '{asset.path}/Comms', on: false } });
        expect(saves('pad').saving).toEqual(['comms.on']);
    });

    test('a save answered store-unreachable pauses editing; no kind setup save is taken until the store answers', () => {
        delegate.saveKindSetup('pad', 'link', { part: 'link', link: '/x' }, 3);
        refused('store-unreachable', 'The map store is unreachable.');
        expect(state().savePaused).toBe(true);
        expect(delegate.saveKindSetup('pad', 'comms.on', { part: 'comms.on', on: false }, 3)).toBe(false);
        // The replay saves it: the pause ends and the stored setup is the one sent.
        saved(4);
        expect(state().savePaused).toBe(false);
        expect(stored('pad')!.setup.link).toBe('/x');
    });
});

describe('the resolve notes (K8)', () => {
    const key = (path: string): string => resolveKey('pad', 'P14', path);

    test('tags.resolve is asked per path with the preview item\'s asset; the reply is the count, or a full path', () => {
        delegate.askResolve('pad', 'P14', ['{asset.path}/Pressure', '{asset.path}/Flow']);
        const asks = ofType(MessageTypes.TAGS_RESOLVE);
        expect(asks.map((m) => m.body)).toEqual([
            { kindId: 'pad', assetId: 'P14', path: '{asset.path}/Pressure' }, { kindId: 'pad', assetId: 'P14', path: '{asset.path}/Flow' }]);
        expect(state().resolves[key('{asset.path}/Pressure')]).toEqual({ state: 'asking' });
        reply(MessageTypes.TAGS_RESOLVE_REPLY, asks[0].id, { path: '{asset.path}/Pressure', relative: true, n: 3, m: 5 });
        reply(MessageTypes.TAGS_RESOLVE_REPLY, asks[1].id, { path: '[default]Shared/Flow', relative: false });
        expect(state().resolves[key('{asset.path}/Pressure')]).toEqual({ state: 'resolved', n: 3, m: 5 });
        expect(state().resolves[key('{asset.path}/Flow')]).toEqual({ state: 'shared' });
        // The point click's reply line is not touched by these replies.
        expect(state().lastReply).toBe('');
    });

    test('the items a path fails for reach the note\'s state by name (entry 13a)', () => {
        delegate.askResolve('pad', 'P14', ['{asset.path}/Pressure']);
        reply(MessageTypes.TAGS_RESOLVE_REPLY, lastOf(MessageTypes.TAGS_RESOLVE).id, { path: '{asset.path}/Pressure', relative: true, n: 3, m: 30,
            failing: [{ id: 'i1', name: 'P15' }, { id: 'i2', name: 'P16' }], failingMore: 25 });
        expect(state().resolves[key('{asset.path}/Pressure')]).toEqual({ state: 'resolved', n: 3, m: 30, failing: ['P15', 'P16'], failingMore: 25 });
    });

    test('a path being asked is not asked twice; asked again later, the earlier answer shows until the new one comes', () => {
        delegate.askResolve('pad', 'P14', ['{asset.path}/Pressure']);
        delegate.askResolve('pad', 'P14', ['{asset.path}/Pressure']);
        expect(ofType(MessageTypes.TAGS_RESOLVE)).toHaveLength(1);
        reply(MessageTypes.TAGS_RESOLVE_REPLY, lastOf(MessageTypes.TAGS_RESOLVE).id, { path: '{asset.path}/Pressure', relative: true, n: 5, m: 5 });
        delegate.askResolve('pad', 'P14', ['{asset.path}/Pressure']);
        expect(ofType(MessageTypes.TAGS_RESOLVE)).toHaveLength(2);
        expect(state().resolves[key('{asset.path}/Pressure')]).toEqual({ state: 'resolved', n: 5, m: 5 });
    });

    test('a refused check and one with no answer are said in words', () => {
        delegate.askResolve('pad', 'P14', ['{asset.path}/Pressure', '{asset.path}/Flow']);
        const asks = ofType(MessageTypes.TAGS_RESOLVE);
        reply(MessageTypes.ERROR, asks[0].id, { code: 'tags-unavailable', message: 'The tag system did not answer within 5 s.' });
        expect(state().resolves[key('{asset.path}/Pressure')]).toEqual({ state: 'failed', message: 'The tag system did not answer within 5 s.' });
        jest.advanceTimersByTime(RESOLVE_TIMEOUT_MS + 1);
        expect(state().resolves[key('{asset.path}/Flow')]).toEqual({ state: 'failed', message: 'the Gateway did not answer in time.' });
        // A late reply nothing waits for changes nothing.
        reply(MessageTypes.TAGS_RESOLVE_REPLY, asks[1].id, { path: '{asset.path}/Flow', relative: true, n: 1, m: 1 });
        expect(state().resolves[key('{asset.path}/Flow')].state).toBe('failed');
    });
});
