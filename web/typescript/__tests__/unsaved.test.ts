import { EditBatch } from '../contract';
import { lineCreateBatch } from '../save';
import {
    KeyValueStore, LocalReasons, SIGN_IN_TEXT, STORAGE_PREFIX, UnsavedQueue, entryText, isBusy, isTransient,
    readEntries, reasonFromError, savedRecords, storageKey, summaryText, unsavedItems
} from '../unsaved';

/** A Map-backed store; `fail` makes every call throw (quota, private window). */
class FakeStore implements KeyValueStore {
    data = new Map<string, string>();
    fail = false;
    getItem(key: string): string | null {
        if (this.fail) {
            throw new Error('denied');
        }
        return this.data.has(key) ? this.data.get(key) as string : null;
    }
    setItem(key: string, value: string): void {
        if (this.fail) {
            throw new Error('QuotaExceededError');
        }
        this.data.set(key, value);
    }
    removeItem(key: string): void {
        if (this.fail) {
            throw new Error('denied');
        }
        this.data.delete(key);
    }
}

const KEY = storageKey('mapstudio-dev', 'mapeditor');
const T0 = new Date('2026-10-27T10:00:00Z');

function line(n: number): EditBatch {
    return lineCreateBatch('item-' + n, 'batch-' + n, [[n, 0], [n, 1]], T0);
}

function queue(store: FakeStore = new FakeStore(), warn: () => void = () => undefined): UnsavedQueue {
    const q = new UnsavedQueue(store, warn);
    q.setKey(KEY);
    return q;
}

function stored(store: FakeStore): Array<{ batchId: string; state: string }> {
    return JSON.parse(store.data.get(KEY) || '[]');
}

describe('the unsaved edits queue', () => {
    test('the key is per project and user', () => {
        expect(KEY).toBe(STORAGE_PREFIX + 'mapstudio-dev:mapeditor');
        expect(storageKey('p', '')).toBe('mapstudio.unsaved.v1:p:');
    });

    test('saved: written before the send, removed by the reply', () => {
        const store = new FakeStore();
        const q = queue(store);
        q.enqueue(line(1), T0);
        expect(stored(store).map((e) => e.batchId)).toEqual(['batch-1']);
        expect(stored(store)[0].state).toBe('unsent');
        q.saved('batch-1');
        expect(store.data.has(KEY)).toBe(false);
        expect(q.list()).toEqual([]);
    });

    test('gateway gone: no reply or disconnected keeps the entry unsent with words', () => {
        const q = queue();
        q.enqueue(line(1), T0);
        q.failed('batch-1', { code: LocalReasons.TIMEOUT, message: 'No answer.' });
        const e = q.list()[0];
        expect(e.state).toBe('unsent');
        expect(entryText(e, 'full')).toBe('Not saved - store unreachable (no answer from the Gateway)');
        expect(summaryText(q.list(), 'full')).toBe('Store unreachable - 1 edit not saved');
        q.failed('batch-1', { code: LocalReasons.DISCONNECTED, message: 'Not connected.' });
        expect(q.nextToReplay(new Set())!.batchId).toBe('batch-1');
    });

    test('page closed and reopened: a new queue on the same storage replays the stored batch byte for byte', () => {
        const store = new FakeStore();
        const batch = line(1);
        queue(store).enqueue(batch, T0);
        const reopened = queue(store);
        const next = reopened.nextToReplay(new Set());
        expect(next).not.toBeNull();
        expect(JSON.stringify(next!.batch)).toBe(JSON.stringify(batch));
        expect(unsavedItems(reopened.list()).map((i) => [i.id, i.version, i.geometry.type])).toEqual([['item-1', 0, 'LineString']]);
    });

    test('busy: store-unreachable with the busy sentence stays unsent', () => {
        const q = queue();
        q.enqueue(line(1), T0);
        const reason = reasonFromError({
            code: 'store-unreachable',
            message: 'Map Studio is busy with other map requests; nothing was saved. Try again in a moment.'
        });
        q.failed('batch-1', reason);
        expect(isBusy(reason)).toBe(true);
        expect(q.list()[0].state).toBe('unsent');
        expect(entryText(q.list()[0], 'full')).toBe('Not saved - Map Studio is busy');
        expect(summaryText(q.list(), 'full')).toBe('1 edit not saved');
    });

    test('conflict: refused, names the other editor, not replayed; Discard removes it', () => {
        const store = new FakeStore();
        const q = queue(store);
        q.enqueue(line(1), T0);
        q.failed('batch-1', reasonFromError({
            code: 'conflict',
            message: 'Line A was changed by mapoperator; nothing was saved.',
            conflicts: [{ index: 0, entity: 'item', id: 'item-1', baseVersion: 1, current: null, changedBy: 'mapoperator', changedAt: null }]
        }));
        const e = q.list()[0];
        expect(e.state).toBe('refused');
        expect(entryText(e, 'full')).toBe(
            "Not saved - conflict with mapoperator's change. Line A was changed by mapoperator; nothing was saved.");
        expect(q.nextToReplay(new Set())).toBeNull();
        q.discard('batch-1');
        expect(store.data.has(KEY)).toBe(false);
        expect(unsavedItems(q.list())).toEqual([]);
    });

    test('conflict with no name says another editor', () => {
        const q = queue();
        q.enqueue(line(1), T0);
        q.failed('batch-1', reasonFromError({ code: 'conflict', message: 'Stale.' }));
        expect(entryText(q.list()[0], 'full')).toBe("Not saved - conflict with another editor's change. Stale.");
    });

    test('role, invalid, stale and unknown codes are final; read-only and store-unreachable are transient', () => {
        for (const code of ['conflict', 'role', 'invalid', 'stale', 'something-new']) {
            expect(isTransient(code)).toBe(false);
        }
        for (const code of ['timeout', 'disconnected', 'store-unreachable', 'read-only']) {
            expect(isTransient(code)).toBe(true);
        }
        const q = queue();
        q.enqueue(line(1), T0);
        q.failed('batch-1', { code: 'role', message: 'You do not have a role that lets you change the map.' });
        expect(q.list()[0].state).toBe('refused');
        expect(entryText(q.list()[0], 'none')).toBe('Not saved - You do not have a role that lets you change the map.');
    });

    test('Try again turns a refusal into unsent', () => {
        const q = queue();
        q.enqueue(line(1), T0);
        q.failed('batch-1', { code: 'role', message: 'No.' });
        q.retry('batch-1');
        expect(q.nextToReplay(new Set())!.batchId).toBe('batch-1');
    });

    test('level none: unsent entries ask to sign in', () => {
        const q = queue();
        q.enqueue(line(1), T0);
        q.failed('batch-1', { code: 'timeout', message: 'No answer.' });
        expect(entryText(q.list()[0], 'none')).toBe('Not saved - ' + SIGN_IN_TEXT);
        expect(summaryText(q.list(), 'none')).toBe('1 edit not saved. ' + SIGN_IN_TEXT);
    });

    test('order: oldest first, one at a time, replay continues past a refused batch', () => {
        const q = queue();
        q.enqueue(line(1), T0);
        q.enqueue(line(2), T0);
        q.enqueue(line(3), T0);
        q.failed('batch-1', { code: 'conflict', message: 'Stale.' });
        expect(q.nextToReplay(new Set())!.batchId).toBe('batch-2');
        expect(q.nextToReplay(new Set(['batch-2']))!.batchId).toBe('batch-3');
        expect(q.list().map((e) => e.batchId)).toEqual(['batch-1', 'batch-2', 'batch-3']);
        expect(summaryText(q.list(), 'full')).toBe('3 edits not saved');
    });

    test('storage fails: the queue keeps working in memory and warns once', () => {
        const store = new FakeStore();
        store.fail = true;
        const warn = jest.fn();
        const q = queue(store, warn);
        q.enqueue(line(1), T0);
        q.enqueue(line(2), T0);
        expect(q.list().map((e) => e.batchId)).toEqual(['batch-1', 'batch-2']);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(q.storageUnavailable).toBe(true);
        q.saved('batch-1');
        expect(q.list().map((e) => e.batchId)).toEqual(['batch-2']);
    });

    test('a quota error on write still keeps the entry in memory', () => {
        const store = new FakeStore();
        const q = queue(store, jest.fn());
        store.setItem = () => { throw new Error('QuotaExceededError'); };
        q.enqueue(line(1), T0);
        expect(q.list().map((e) => e.batchId)).toEqual(['batch-1']);
    });

    test('two tabs: every change re-reads storage, and a second reply finds nothing to remove', () => {
        const store = new FakeStore();
        const a = queue(store);
        const b = queue(store);
        a.enqueue(line(1), T0);
        expect(b.refresh()).toBe(true);
        expect(b.list().map((e) => e.batchId)).toEqual(['batch-1']);
        b.enqueue(line(2), T0);
        a.saved('batch-1');
        expect(stored(store).map((e) => e.batchId)).toEqual(['batch-2']);
        b.saved('batch-1');
        expect(stored(store).map((e) => e.batchId)).toEqual(['batch-2']);
        expect(b.refresh()).toBe(false);
    });

    test('malformed storage: bad entries are dropped, the rest kept in order', () => {
        const good = { batchId: 'batch-1', batch: line(1), queuedAt: T0.toISOString(), state: 'unsent' };
        const good2 = { batchId: 'batch-2', batch: line(2), queuedAt: T0.toISOString(), state: 'refused', reason: { code: 'role', message: 'No.' } };
        const raw = JSON.stringify([good, { batchId: 7 }, { ...good, batchId: 'other' }, null, good2, good]);
        expect(readEntries(raw).map((e) => [e.batchId, e.state])).toEqual([['batch-1', 'unsent'], ['batch-2', 'refused']]);
        expect(readEntries('{not json')).toEqual([]);
        expect(readEntries('{"a":1}')).toEqual([]);
        expect(readEntries(null)).toEqual([]);
        const store = new FakeStore();
        store.data.set(KEY, '{broken');
        const q = queue(store);
        expect(q.list()).toEqual([]);
        q.enqueue(line(3), T0);
        expect(stored(store).map((e) => e.batchId)).toEqual(['batch-3']);
    });

    test('entries held before the key is known move into storage, other users stay hidden', () => {
        const store = new FakeStore();
        store.data.set(storageKey('mapstudio-dev', 'someone'), JSON.stringify([
            { batchId: 'batch-9', batch: line(9), queuedAt: T0.toISOString(), state: 'unsent' }]));
        const q = new UnsavedQueue(store, () => undefined);
        q.enqueue(line(1), T0);
        expect(q.storageKey).toBeNull();
        expect(store.data.has(KEY)).toBe(false);
        q.setKey(KEY);
        expect(stored(store).map((e) => e.batchId)).toEqual(['batch-1']);
        expect(q.list().map((e) => e.batchId)).toEqual(['batch-1']);
        expect(JSON.parse(store.data.get(storageKey('mapstudio-dev', 'someone')) as string)[0].batchId).toBe('batch-9');
    });

    test('a saved batch\'s create ops become records at the reply\'s versions', () => {
        const records = savedRecords(line(1), [{ entity: 'item', id: 'item-1', version: 3 }]);
        expect(records.map((r) => [r.id, r.version, r.kind])).toEqual([['item-1', 3, 'line']]);
        const update: EditBatch = { batchId: 'u', ops: [{ op: 'update', entity: 'item', id: 'x', baseVersion: 1, data: { name: 'n' } }] };
        expect(unsavedItems([{ batchId: 'u', batch: update, queuedAt: '', state: 'unsent' }])).toEqual([]);
    });
});
