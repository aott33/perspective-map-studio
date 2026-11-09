// Recent changes in the store delegate (epic-editing entry 11b, R18): the first page of the edit record asked when History opens and
// again on each map.changed while it is open (merged by seq), Show older with the reader's cursor, a refused or unanswered read in
// words, and Revert sent through sendBatch as an ordinary edit and one undo step, refused as any edit is. The matrix's B1, B2, B4,
// B5 and B9 driven as the Gateway would answer. Perspective's base class is stood in for, as in savePause.test.ts.

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
import { EditBatch, HistoryEntry, MapItemRecord } from '../contract';
import { MESSAGE_EVENT, MessageTypes } from '../messages';
import { HISTORY_TIMEOUT_MS, MapStudioStoreDelegate } from '../MapStudioStoreDelegate';
import { undoLabel } from '../undoStack';

const AT: [number, number] = [-103.8689, 32.2297];
const NORTH: [number, number] = [-103.8689, 32.23006];

const P31: MapItemRecord = {
    id: 'p31', kind: 'pad', name: 'P31', geometry: { type: 'Point', coordinates: NORTH }, properties: {}, assetId: null,
    overrides: {}, ends: null, attachment: null, version: 2, deleted: false
};

let delegate: MapStudioStoreDelegate;

type Fired = { id: string; type: string; body: EditBatch & { before?: number; limit?: number } };

function fired(): Fired[] {
    return (delegate as unknown as { fired: Fired[] }).fired;
}

function ofType(type: string): Fired[] {
    return fired().filter((m) => m.type === type);
}

function lastOf(type: string): Fired {
    const all = ofType(type);
    return all[all.length - 1];
}

function reply(type: string, id: string, body: unknown): void {
    delegate.handleEvent(MESSAGE_EVENT, { v: 1, type, id, body });
}

/** B's move of P31, saved as seq 7 at version 2. */
function moveOf(seq: number, version: number, from: [number, number], to: [number, number], actor: string): HistoryEntry {
    return {
        seq, batchId: 'b' + seq, actor, at: '2026-11-09T10:42:05Z', source: 'session',
        ops: [{ op: 'update', entity: 'item', id: 'p31', name: 'P31', kind: 'pad', version,
            before: { geometry: { type: 'Point', coordinates: from } }, after: { geometry: { type: 'Point', coordinates: to } } }]
    };
}

function page(entries: HistoryEntry[], more = false): unknown {
    return { entries, more };
}

function history() {
    return delegate.mapStateToProps().history;
}

beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'debug').mockImplementation(() => undefined);
    delegate = new MapStudioStoreDelegate({} as unknown as AbstractUIElementStore);
    delegate.sendMapLoad();
    reply(MessageTypes.MAP_LOAD_REPLY, lastOf(MessageTypes.MAP_LOAD).id, { level: 'full', seq: 7, items: [P31], user: 'mapeditor' });
});

afterEach(() => {
    delegate.stopReplay();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('the reads (B1, B2, B9)', () => {
    test('nothing is read until History opens; opening asks the first page of 50', () => {
        expect(ofType(MessageTypes.EDITS_HISTORY)).toHaveLength(0);
        delegate.setHistoryOpen(true);
        expect(ofType(MessageTypes.EDITS_HISTORY).map((m) => m.body)).toEqual([{ limit: 50 }]);
        expect(history().loading).toBe('first');
        reply(MessageTypes.EDITS_HISTORY_REPLY, lastOf(MessageTypes.EDITS_HISTORY).id, page([moveOf(7, 2, AT, NORTH, 'mapoperator')]));
        expect(history().loaded).toBe(true);
        expect(history().loading).toBeNull();
        expect(history().entries.map((e) => e.seq)).toEqual([7]);
    });

    test('each map.changed while open asks the first page again, merged by seq; closed, nothing is asked', () => {
        delegate.setHistoryOpen(true);
        reply(MessageTypes.EDITS_HISTORY_REPLY, lastOf(MessageTypes.EDITS_HISTORY).id, page([moveOf(7, 2, AT, NORTH, 'mapoperator')]));
        reply(MessageTypes.MAP_CHANGED, 'c8', { seq: 8, ops: [{ op: 'update', entity: 'item', id: 'p31', version: 3,
            record: { ...P31, geometry: { type: 'Point', coordinates: AT }, version: 3 } }] });
        expect(ofType(MessageTypes.EDITS_HISTORY)).toHaveLength(2);
        // A second change while that read is out asks once more after it, not twice at once.
        reply(MessageTypes.MAP_CHANGED, 'c9', { seq: 9, ops: [] });
        expect(ofType(MessageTypes.EDITS_HISTORY)).toHaveLength(2);
        reply(MessageTypes.EDITS_HISTORY_REPLY, lastOf(MessageTypes.EDITS_HISTORY).id,
            page([moveOf(8, 3, NORTH, AT, 'mapeditor'), moveOf(7, 2, AT, NORTH, 'mapoperator')]));
        expect(ofType(MessageTypes.EDITS_HISTORY)).toHaveLength(3);
        expect(history().entries.map((e) => [e.seq, e.actor])).toEqual([[8, 'mapeditor'], [7, 'mapoperator']]);

        delegate.setHistoryOpen(false);
        reply(MessageTypes.MAP_CHANGED, 'c10', { seq: 10, ops: [] });
        expect(ofType(MessageTypes.EDITS_HISTORY)).toHaveLength(3);
    });

    test('Show older asks before the reader\'s cursor; a failed page keeps the rows and says so; Try again asks it again', () => {
        delegate.setHistoryOpen(true);
        const first = Array.from({ length: 50 }, (_, i) => moveOf(60 - i, 2, AT, NORTH, 'mapeditor'));
        reply(MessageTypes.EDITS_HISTORY_REPLY, lastOf(MessageTypes.EDITS_HISTORY).id, page(first, true));
        expect(history().nextBefore).toBe(11);
        delegate.historyOlder();
        expect(lastOf(MessageTypes.EDITS_HISTORY).body).toEqual({ before: 11, limit: 50 });
        expect(history().loading).toBe('older');
        reply(MessageTypes.ERROR, lastOf(MessageTypes.EDITS_HISTORY).id, { code: 'store-unreachable', message: 'Map Studio is busy.' });
        expect(history().entries).toHaveLength(50);
        expect(history().errorOn).toBe('older');
        expect(history().error).toBe('Older changes could not be read: Map Studio is busy.');
        delegate.historyRetry();
        expect(lastOf(MessageTypes.EDITS_HISTORY).body).toEqual({ before: 11, limit: 50 });
        reply(MessageTypes.EDITS_HISTORY_REPLY, lastOf(MessageTypes.EDITS_HISTORY).id,
            page(Array.from({ length: 10 }, (_, i) => moveOf(10 - i, 2, AT, NORTH, 'mapeditor')), false));
        expect(history().entries).toHaveLength(60);
        expect(history().more).toBe(false);
        expect(history().error).toBe('');
    });

    test('a first page and an older page out together: each read has its own timeout, the older one reported with Try again', () => {
        delegate.setHistoryOpen(true);
        reply(MessageTypes.EDITS_HISTORY_REPLY, lastOf(MessageTypes.EDITS_HISTORY).id,
            page(Array.from({ length: 50 }, (_, i) => moveOf(60 - i, 2, AT, NORTH, 'mapeditor')), true));
        delegate.historyOlder();
        const older = lastOf(MessageTypes.EDITS_HISTORY);
        jest.advanceTimersByTime(5_000);
        reply(MessageTypes.MAP_CHANGED, 'c61', { seq: 61, ops: [] });
        const first = lastOf(MessageTypes.EDITS_HISTORY);
        expect(first.body).toEqual({ limit: 50 });
        // The first page answers; the older read is still out and times out on its own clock.
        reply(MessageTypes.EDITS_HISTORY_REPLY, first.id, page([moveOf(61, 2, AT, NORTH, 'mapeditor')], true));
        expect(history().loading).toBe('older');
        jest.advanceTimersByTime(HISTORY_TIMEOUT_MS - 5_000);
        expect(history().errorOn).toBe('older');
        expect(history().error).toBe('Older changes could not be read: the Gateway did not answer in time.');
        expect(history().loading).toBeNull();
        // Its late answer changes nothing; Try again asks the older page again.
        reply(MessageTypes.EDITS_HISTORY_REPLY, older.id, page([], false));
        expect(history().more).toBe(true);
        delegate.historyRetry();
        expect(lastOf(MessageTypes.EDITS_HISTORY).body).toEqual({ before: 11, limit: 50 });
    });

    test('closed (the surface left, or the component unmounted) the reads are let go: no more asks; reopened it asks afresh', () => {
        delegate.setHistoryOpen(true);
        expect(ofType(MessageTypes.EDITS_HISTORY)).toHaveLength(1);
        delegate.setHistoryOpen(false);
        expect(history().loading).toBeNull();
        reply(MessageTypes.MAP_CHANGED, 'c8', { seq: 8, ops: [] });
        jest.advanceTimersByTime(HISTORY_TIMEOUT_MS);
        expect(ofType(MessageTypes.EDITS_HISTORY)).toHaveLength(1);
        expect(history().error).toBe('');
        delegate.setHistoryOpen(true);
        expect(ofType(MessageTypes.EDITS_HISTORY)).toHaveLength(2);
        expect(history().loading).toBe('first');
    });

    test('a refused first read says so; one with no answer in 15 s too', () => {
        delegate.setHistoryOpen(true);
        reply(MessageTypes.ERROR, lastOf(MessageTypes.EDITS_HISTORY).id,
            { code: 'role', message: 'Recent changes need an editing role. Ask for a Map Studio editing role.' });
        expect(history().errorOn).toBe('first');
        expect(history().error).toMatch(/^Recent changes could not be read: Recent changes need an editing role/);
        delegate.historyRetry();
        jest.advanceTimersByTime(HISTORY_TIMEOUT_MS);
        expect(history().error).toBe('Recent changes could not be read: the Gateway did not answer in time.');
        expect(history().loading).toBeNull();
    });
});

describe('Revert (B4, B5)', () => {
    beforeEach(() => {
        delegate.setHistoryOpen(true);
        reply(MessageTypes.EDITS_HISTORY_REPLY, lastOf(MessageTypes.EDITS_HISTORY).id, page([moveOf(7, 2, AT, NORTH, 'mapoperator')]));
    });

    test('another editor\'s move reverted: one edits.apply at the row\'s version, one undo step that puts their move back', () => {
        expect(delegate.revert(7)).toBe(true);
        const sent = lastOf(MessageTypes.EDITS_APPLY);
        expect(sent.body.ops).toEqual([{ op: 'update', entity: 'item', id: 'p31', baseVersion: 2, data: { geometry: { type: 'Point', coordinates: AT } } }]);
        reply(MessageTypes.EDITS_APPLY_REPLY, sent.id, { batchId: sent.body.batchId, seq: 8, results: [{ entity: 'item', id: 'p31', version: 3 }] });
        expect(undoLabel(delegate.mapStateToProps().undo)).toMatch(/^Undo: revert "Moved P31 about (40 m|130 ft) north"$/);
        expect(delegate.mapStateToProps().items.find((i) => i.id === 'p31')!.geometry).toEqual({ type: 'Point', coordinates: AT });
        // Undo puts their move back, at this session's own version.
        delegate.undo();
        const undo = lastOf(MessageTypes.EDITS_APPLY);
        expect(undo.body.ops).toEqual([{ op: 'update', entity: 'item', id: 'p31', baseVersion: 3, data: { geometry: { type: 'Point', coordinates: NORTH } } }]);
    });

    test('a change saved since: refused conflict, the entry kept with who changed it, nothing saved', () => {
        delegate.revert(7);
        const sent = lastOf(MessageTypes.EDITS_APPLY);
        reply(MessageTypes.ERROR, sent.id, {
            code: 'conflict', message: 'P31 was changed by mapoperator at 10:44 UTC since you loaded it. Nothing in this save was written.',
            batchId: sent.body.batchId,
            conflicts: [{ index: 0, entity: 'item', id: 'p31', baseVersion: 2, current: { ...P31, version: 3 }, changedBy: 'mapoperator',
                changedAt: '2026-11-09T10:44:00Z' }]
        });
        const state = delegate.mapStateToProps();
        expect(state.unsaved).toHaveLength(1);
        expect(state.unsaved[0].state).toBe('refused');
        expect(state.unsaved[0].conflict![0].changedBy).toBe('mapoperator');
        expect(state.undo.done).toBe(0);
    });

    test('Revert waits as Undo does: a second press while the first is saved sends nothing; never held behind another save of the item', () => {
        const before = ofType(MessageTypes.EDITS_APPLY).length;
        expect(delegate.revert(7)).toBe(true);
        expect(delegate.revert(7)).toBe(false);
        expect(ofType(MessageTypes.EDITS_APPLY)).toHaveLength(before + 1);
        const sent = lastOf(MessageTypes.EDITS_APPLY);
        reply(MessageTypes.EDITS_APPLY_REPLY, sent.id, { batchId: sent.body.batchId, seq: 8, results: [{ entity: 'item', id: 'p31', version: 3 }] });

        // Another edit of P31 in flight: Revert sends nothing, so it is never rebased past it.
        delegate.renameItem('p31', 'P31 renamed');
        const rename = lastOf(MessageTypes.EDITS_APPLY);
        expect(delegate.revert(7)).toBe(false);
        expect(ofType(MessageTypes.EDITS_APPLY)).toHaveLength(before + 2);
        reply(MessageTypes.EDITS_APPLY_REPLY, rename.id, { batchId: rename.body.batchId, seq: 9, results: [{ entity: 'item', id: 'p31', version: 4 }] });
        expect(ofType(MessageTypes.EDITS_APPLY)).toHaveLength(before + 2);
        // Pressed again once it saved: sent at the row's version, so the Gateway refuses it as changed since.
        expect(delegate.revert(7)).toBe(true);
        expect(lastOf(MessageTypes.EDITS_APPLY).body.ops[0].baseVersion).toBe(2);
    });

    test('the undo step names the row as it reads: reverting a "Reverted ..." row', () => {
        reply(MessageTypes.MAP_CHANGED, 'c8', { seq: 8, ops: [] });
        reply(MessageTypes.EDITS_HISTORY_REPLY, lastOf(MessageTypes.EDITS_HISTORY).id,
            page([moveOf(8, 3, NORTH, AT, 'mapeditor'), moveOf(7, 2, AT, NORTH, 'mapoperator')]));
        delegate.revert(8);
        const sent = lastOf(MessageTypes.EDITS_APPLY);
        reply(MessageTypes.EDITS_APPLY_REPLY, sent.id, { batchId: sent.body.batchId, seq: 9, results: [{ entity: 'item', id: 'p31', version: 4 }] });
        expect(undoLabel(delegate.mapStateToProps().undo)).toMatch(/^Undo: revert "Reverted "Moved P31 about (40 m|130 ft) north""$/);
    });

    test('no Revert for an old row or a row not read; nothing while editing is paused', () => {
        reply(MessageTypes.MAP_CHANGED, 'c8', { seq: 8, ops: [] });
        const old: HistoryEntry = { ...moveOf(8, 3, AT, NORTH, 'mapeditor'), ops: [{ ...moveOf(8, 3, AT, NORTH, 'mapeditor').ops[0], before: null, after: null }] };
        reply(MessageTypes.EDITS_HISTORY_REPLY, lastOf(MessageTypes.EDITS_HISTORY).id, page([old, moveOf(7, 2, AT, NORTH, 'mapoperator')]));
        const before = ofType(MessageTypes.EDITS_APPLY).length;
        expect(delegate.revert(8)).toBe(false);
        expect(delegate.revert(99)).toBe(false);
        expect(ofType(MessageTypes.EDITS_APPLY)).toHaveLength(before);
    });
});
