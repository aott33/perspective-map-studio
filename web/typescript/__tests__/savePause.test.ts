// The save problems in the delegate (epic 4 entry 10, R2 to R4, R6): a save answered store-unreachable (not busy) pauses the
// tools and Undo with the items kept until a save or a load succeeds; busy pauses nothing; a conflict keeps the other editor's
// record on the entry, "Use <name>'s version" discards mine and draws theirs, "Apply mine on top" sends a new batch at the stored
// version that undoes as one step back to theirs. Perspective's base class is stood in for, as in loadRetry.test.ts.

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
import { EditBatch, MapItemRecord } from '../contract';
import { MESSAGE_EVENT, MessageTypes } from '../messages';
import { MapStudioStoreDelegate } from '../MapStudioStoreDelegate';
import { REPLAY_INTERVAL_MS } from '../unsaved';

const BUSY = 'Map Studio is busy with other map requests; nothing was saved. Try again in a moment.';
const DOWN = 'The map store is unavailable (test).';

const P14: MapItemRecord = {
    id: 'p14', kind: 'pad', name: 'P14', geometry: { type: 'Point', coordinates: [-103.8689, 32.2297] }, properties: {}, assetId: null,
    overrides: {}, ends: null, attachment: null, version: 3, deleted: false
};

let delegate: MapStudioStoreDelegate;

type Fired = { id: string; type: string; body: EditBatch };

function fired(): Fired[] {
    return (delegate as unknown as { fired: Fired[] }).fired;
}

function lastOf(type: string): Fired {
    const all = fired().filter((m) => m.type === type);
    return all[all.length - 1];
}

function reply(type: string, id: string, body: unknown): void {
    delegate.handleEvent(MESSAGE_EVENT, { v: 1, type, id, body });
}

function saved(message: Fired, version: number): void {
    reply(MessageTypes.EDITS_APPLY_REPLY, message.id, {
        batchId: message.body.batchId, seq: 1, results: message.body.ops.map((op) => ({ entity: op.entity, id: op.id, version }))
    });
}

function refused(message: Fired, code: string, text: string, conflicts?: unknown[]): void {
    reply(MessageTypes.ERROR, message.id, { code, message: text, batchId: message.body.batchId, ...(conflicts ? { conflicts } : {}) });
}

function state() {
    return delegate.mapStateToProps();
}

beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'debug').mockImplementation(() => undefined);
    delegate = new MapStudioStoreDelegate({} as unknown as AbstractUIElementStore);
    delegate.sendMapLoad();
    reply(MessageTypes.MAP_LOAD_REPLY, lastOf(MessageTypes.MAP_LOAD).id, { level: 'full', seq: 0, items: [P14], user: 'jordan' });
});

afterEach(() => {
    delegate.stopReplay();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

test('a save answered store-unreachable pauses editing and Undo, keeps the items, and a replay that saves ends it', () => {
    delegate.renameItem('p14', 'P14 north');
    const first = lastOf(MessageTypes.EDITS_APPLY);
    // Its queued entry keeps the record the rename started from.
    expect(state().unsaved[0].before).toEqual([P14]);
    refused(first, 'store-unreachable', DOWN);
    expect(state()).toMatchObject({ editing: 'off', savePaused: true });
    expect(state().store.status).toBe('ready');
    expect(state().items.map((i) => i.id)).toEqual(['p14']);
    const sent = fired().length;
    delegate.undo();
    expect(fired().length).toBe(sent);

    // The 15 s replay sends the stored batch unchanged; its reply ends the pause.
    jest.advanceTimersByTime(REPLAY_INTERVAL_MS);
    const again = lastOf(MessageTypes.EDITS_APPLY);
    expect(again.id).not.toBe(first.id);
    expect(again.body).toEqual(first.body);
    saved(again, 4);
    expect(state()).toMatchObject({ editing: 'on', savePaused: false, unsaved: [] });
});

test('a load that succeeds ends the pause too; busy pauses nothing', () => {
    delegate.renameItem('p14', 'P14 north');
    refused(lastOf(MessageTypes.EDITS_APPLY), 'store-unreachable', DOWN);
    expect(state().savePaused).toBe(true);
    delegate.sendMapLoad();
    reply(MessageTypes.MAP_LOAD_REPLY, lastOf(MessageTypes.MAP_LOAD).id, { level: 'full', seq: 0, items: [P14], user: 'jordan' });
    expect(state()).toMatchObject({ editing: 'on', savePaused: false });

    delegate.renameItem('p14', 'P14 south');
    refused(lastOf(MessageTypes.EDITS_APPLY), 'store-unreachable', BUSY);
    expect(state()).toMatchObject({ editing: 'on', savePaused: false });
});

test('the unreachable card\'s Try again with nothing to replay sends map.load; a discard leaving nothing does too', () => {
    delegate.renameItem('p14', 'P14 north');
    const message = lastOf(MessageTypes.EDITS_APPLY);
    refused(message, 'store-unreachable', DOWN);
    const loads = fired().filter((m) => m.type === MessageTypes.MAP_LOAD).length;
    delegate.discardUnsaved(message.body.batchId);
    expect(state().unsaved).toEqual([]);
    expect(fired().filter((m) => m.type === MessageTypes.MAP_LOAD).length).toBe(loads + 1);
    expect(state().savePaused).toBe(true);
    delegate.retryStore();
    expect(fired().filter((m) => m.type === MessageTypes.MAP_LOAD).length).toBe(loads + 2);
    reply(MessageTypes.MAP_LOAD_REPLY, lastOf(MessageTypes.MAP_LOAD).id, { level: 'full', seq: 0, items: [P14], user: 'jordan' });
    expect(state()).toMatchObject({ editing: 'on', savePaused: false });
});

describe('a conflict', () => {
    const THEIRS: MapItemRecord = { ...P14, name: 'P14 east', version: 4 };
    const CONFLICTS = [{ index: 0, entity: 'item', id: 'p14', baseVersion: 3, current: THEIRS, changedBy: 'sam', changedAt: '2026-11-09T10:42:00Z' }];
    const TEXT = 'P14 east was changed by sam at 10:42 UTC since you loaded it. Nothing in this save was written.';

    test('is kept on the entry with the other editor\'s record', () => {
        delegate.setKind('p14', 'tank');
        refused(lastOf(MessageTypes.EDITS_APPLY), 'conflict', TEXT, CONFLICTS);
        const [entry] = state().unsaved;
        expect(entry.state).toBe('refused');
        expect(entry.conflict).toEqual(CONFLICTS);
        expect(entry.before).toEqual([P14]);
    });

    test('Use <name>\'s version: my entry discarded, the item drawn as stored', () => {
        delegate.setKind('p14', 'tank');
        const message = lastOf(MessageTypes.EDITS_APPLY);
        refused(message, 'conflict', TEXT, CONFLICTS);
        const sent = fired().length;
        delegate.useTheirs(message.body.batchId);
        expect(state().unsaved).toEqual([]);
        expect(state().items.find((i) => i.id === 'p14')).toMatchObject({ name: 'P14 east', version: 4 });
        expect(fired().length).toBe(sent);
    });

    test('Apply mine on top: a new batch at the stored version, one undo step that restores theirs', () => {
        delegate.setKind('p14', 'tank');
        const message = lastOf(MessageTypes.EDITS_APPLY);
        refused(message, 'conflict', TEXT, CONFLICTS);
        delegate.applyOnTop(message.body.batchId);
        const onTop = lastOf(MessageTypes.EDITS_APPLY);
        expect(onTop.body.batchId).not.toBe(message.body.batchId);
        expect(onTop.body.ops).toEqual([{ op: 'update', entity: 'item', id: 'p14', baseVersion: 4, data: { kind: 'tank' } }]);
        expect(state().unsaved.map((e) => e.batchId)).toEqual([onTop.body.batchId]);
        saved(onTop, 5);
        expect(state().unsaved).toEqual([]);
        expect(state().items.find((i) => i.id === 'p14')).toMatchObject({ kind: 'tank', name: 'P14 east', version: 5 });
        expect(state().undo.steps.length).toBe(1);
        delegate.undo();
        const reverse = lastOf(MessageTypes.EDITS_APPLY);
        expect(reverse.body.ops[0]).toMatchObject({ op: 'update', id: 'p14', baseVersion: 5, data: { kind: 'pad' } });
    });

    test('Apply mine on top is not sent when they deleted the item', () => {
        delegate.setKind('p14', 'tank');
        const message = lastOf(MessageTypes.EDITS_APPLY);
        refused(message, 'conflict', 'P14 was deleted by sam since you loaded it. Nothing in this save was written.',
            [{ ...CONFLICTS[0], current: { ...P14, version: 4, deleted: true } }]);
        const sent = fired().length;
        delegate.applyOnTop(message.body.batchId);
        expect(fired().length).toBe(sent);
        expect(state().unsaved.length).toBe(1);
    });
});

describe('the pause ends', () => {
    test('when another tab saved this tab\'s entries: the storage event leaves nothing unsent, so map.load checks the store', () => {
        const data = new Map<string, string>();
        const storage = { getItem: (k: string) => (data.has(k) ? data.get(k) as string : null), setItem: (k: string, v: string) => { data.set(k, v); },
            removeItem: (k: string) => { data.delete(k); } };
        (global as unknown as { window: unknown }).window = { localStorage: storage };
        try {
            delegate.stopReplay();
            delegate = new MapStudioStoreDelegate({ view: { page: { parent: { projectName: 'p' } } } } as unknown as AbstractUIElementStore);
            delegate.sendMapLoad();
            reply(MessageTypes.MAP_LOAD_REPLY, lastOf(MessageTypes.MAP_LOAD).id, { level: 'full', seq: 0, items: [P14], user: 'jordan' });
            delegate.renameItem('p14', 'P14 north');
            refused(lastOf(MessageTypes.EDITS_APPLY), 'store-unreachable', DOWN);
            expect(state().savePaused).toBe(true);
            const key = Array.from(data.keys())[0];
            const loads = fired().filter((m) => m.type === MessageTypes.MAP_LOAD).length;
            data.delete(key);
            delegate.onStorage(key);
            expect(state().unsaved).toEqual([]);
            expect(fired().filter((m) => m.type === MessageTypes.MAP_LOAD).length).toBe(loads + 1);
            reply(MessageTypes.MAP_LOAD_REPLY, lastOf(MessageTypes.MAP_LOAD).id, { level: 'full', seq: 0, items: [P14], user: 'jordan' });
            expect(state()).toMatchObject({ savePaused: false, editing: 'on' });
        } finally {
            delete (global as unknown as { window?: unknown }).window;
        }
    });

    test('when a save is answered anything but the store out of reach: a conflict shows, not hidden under the pause', () => {
        delegate.renameItem('p14', 'P14 north');
        const first = lastOf(MessageTypes.EDITS_APPLY);
        refused(first, 'store-unreachable', DOWN);
        expect(state().savePaused).toBe(true);
        jest.advanceTimersByTime(REPLAY_INTERVAL_MS);
        refused(lastOf(MessageTypes.EDITS_APPLY), 'conflict', 'P14 was changed by sam since you loaded it. Nothing in this save was written.',
            [{ index: 0, entity: 'item', id: 'p14', baseVersion: 3, current: { ...P14, version: 4 }, changedBy: 'sam', changedAt: null }]);
        expect(state()).toMatchObject({ savePaused: false, editing: 'on' });
    });
});

test('Apply mine on top waits while another save of the entry\'s item is in flight; the entry and the card stay', () => {
    delegate.setKind('p14', 'tank');
    const message = lastOf(MessageTypes.EDITS_APPLY);
    refused(message, 'conflict', 'P14 was changed by sam since you loaded it. Nothing in this save was written.',
        [{ index: 0, entity: 'item', id: 'p14', baseVersion: 3, current: { ...P14, version: 4 }, changedBy: 'sam', changedAt: null }]);
    delegate.renameItem('p14', 'P14 again');
    const sent = fired().length;
    delegate.applyOnTop(message.body.batchId);
    expect(fired().length).toBe(sent);
    expect(state().unsaved.map((e) => e.batchId)).toContain(message.body.batchId);
});
