import { EditBatch, EditLevel } from '../contract';
import { Envelope } from '../messages';
import { lineCreateBatch } from '../save';
import { KeyValueStore, LocalReasons, REPLAY_INTERVAL_MS, REPLY_TIMEOUT_MS, UnsavedQueue, UnsavedReason, storageKey } from '../unsaved';
import { UnsavedSender } from '../unsavedSender';

class FakeStore implements KeyValueStore {
    data = new Map<string, string>();
    fail = false;
    getItem(key: string): string | null {
        return this.data.has(key) ? this.data.get(key) as string : null;
    }
    setItem(key: string, value: string): void {
        if (this.fail) {
            throw new Error('QuotaExceededError');
        }
        this.data.set(key, value);
    }
    removeItem(key: string): void {
        this.data.delete(key);
    }
}

const KEY = storageKey('mapstudio-dev', 'mapeditor');
const T0 = new Date('2026-10-27T10:00:00Z');
const BUSY: UnsavedReason = {
    code: 'store-unreachable',
    message: 'Map Studio is busy with other map requests; nothing was saved. Try again in a moment.'
};
const CONFLICT: UnsavedReason = { code: 'conflict', message: 'Changed by mapoperator.', changedBy: 'mapoperator' };

function line(n: number): EditBatch {
    return lineCreateBatch('item-' + n, 'batch-' + n, [[n, 0], [n, 1]], T0);
}

/** A sender on a fake store with a host that records what it fires. */
function rig(options: { level?: EditLevel | null; store?: FakeStore; key?: boolean } = {}) {
    const store = options.store || new FakeStore();
    const queue = new UnsavedQueue(store, () => undefined);
    if (options.key !== false) {
        queue.setKey(KEY);
    }
    const host = {
        levelNow: (options.level === undefined ? 'full' : options.level) as EditLevel | null,
        online: true,
        throwOnFire: false,
        fired: [] as Array<Envelope<EditBatch>>,
        unsent: [] as Array<[string, string]>,
        changes: 0
    };
    const sender = new UnsavedSender(queue, {
        level: () => host.levelNow,
        connected: () => host.online,
        fire: (m) => {
            if (host.throwOnFire) {
                throw new Error('closed');
            }
            host.fired.push(m);
        },
        changed: () => { host.changes++; },
        unsent: (batchId, reason) => { host.unsent.push([batchId, reason.code]); }
    });
    const last = () => host.fired[host.fired.length - 1];
    return { store, queue, host, sender, last };
}

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

describe('sending the unsaved queue (UnsavedSender)', () => {
    test('saved: queued before the send, removed by the reply, no timer left', () => {
        const { store, queue, host, sender, last } = rig();
        sender.enqueueAndSend(line(1), T0);
        expect(store.data.has(KEY)).toBe(true);
        expect(host.fired.length).toBe(1);
        expect(last().type).toBe('edits.apply');
        expect(last().body).toEqual(line(1));
        expect(sender.isSending('batch-1')).toBe(true);
        const out = sender.onSaved(last().id, 'batch-1');
        expect(out.kind).toBe('saved');
        expect(out.kind === 'saved' && out.entry ? out.entry.batchId : '').toBe('batch-1');
        expect(queue.list()).toEqual([]);
        expect(store.data.has(KEY)).toBe(false);
        jest.advanceTimersByTime(REPLY_TIMEOUT_MS * 3);
        expect(host.unsent).toEqual([]);
        expect(host.fired.length).toBe(1);
    });

    test('no reply in 15 s: unsent with timeout, replayed by the 15 s timer with the same batch', () => {
        const { queue, host, sender, last } = rig();
        sender.enqueueAndSend(line(1), T0);
        const first = last();
        jest.advanceTimersByTime(REPLY_TIMEOUT_MS - 1);
        expect(host.unsent).toEqual([]);
        jest.advanceTimersByTime(1);
        expect(host.unsent).toEqual([['batch-1', LocalReasons.TIMEOUT]]);
        expect(queue.get('batch-1')!.state).toBe('unsent');
        expect(sender.isSending('batch-1')).toBe(false);
        jest.advanceTimersByTime(REPLAY_INTERVAL_MS);
        expect(host.fired.length).toBe(2);
        expect(last().id).not.toBe(first.id);
        expect(JSON.stringify(last().body)).toBe(JSON.stringify(first.body));
    });

    test('a late reply to a timed-out send still saves the batch', () => {
        const { queue, sender, last } = rig();
        sender.enqueueAndSend(line(1), T0);
        const first = last();
        jest.advanceTimersByTime(REPLY_TIMEOUT_MS);
        expect(sender.onSaved(first.id, 'batch-1').kind).toBe('saved');
        expect(queue.list()).toEqual([]);
    });

    test('an earlier send\'s refusal is ignored while a newer send of the batch is in flight', () => {
        const { queue, sender, last } = rig();
        sender.enqueueAndSend(line(1), T0);
        const first = last();
        jest.advanceTimersByTime(REPLY_TIMEOUT_MS + REPLAY_INTERVAL_MS);
        const second = last();
        expect(second.id).not.toBe(first.id);
        expect(sender.onError(first.id, CONFLICT)).toEqual({ kind: 'ignored' });
        expect(queue.get('batch-1')!.state).toBe('unsent');
        expect(sender.isSending('batch-1')).toBe(true);
        const out = sender.onError(second.id, CONFLICT);
        expect(out.kind).toBe('failed');
        expect(queue.get('batch-1')!.state).toBe('refused');
        expect(queue.get('batch-1')!.reason!.changedBy).toBe('mapoperator');
    });

    test('busy is transient: replayed by the timer; a conflict is final and not replayed', () => {
        const { queue, host, sender, last } = rig();
        sender.enqueueAndSend(line(1), T0);
        sender.onError(last().id, BUSY);
        expect(queue.get('batch-1')!.state).toBe('unsent');
        expect(host.fired.length).toBe(1);
        jest.advanceTimersByTime(REPLAY_INTERVAL_MS);
        expect(host.fired.length).toBe(2);
        sender.onError(last().id, CONFLICT);
        expect(queue.get('batch-1')!.state).toBe('refused');
        jest.advanceTimersByTime(REPLAY_INTERVAL_MS * 4);
        expect(host.fired.length).toBe(2);
        // Try again replays it now.
        sender.retry('batch-1');
        expect(host.fired.length).toBe(3);
    });

    test('the replay chain: one batch at a time, oldest first, past a refused one', () => {
        const store = new FakeStore();
        const seed = new UnsavedQueue(store, () => undefined);
        seed.setKey(KEY);
        seed.enqueue(line(1), T0);
        seed.enqueue(line(2), T0);
        seed.enqueue(line(3), T0);
        const { host, sender, last, queue } = rig({ store });
        sender.replay();
        expect(host.fired.map((m) => m.body.batchId)).toEqual(['batch-1']);
        sender.onError(last().id, CONFLICT);
        expect(host.fired.map((m) => m.body.batchId)).toEqual(['batch-1', 'batch-2']);
        sender.onSaved(last().id, 'batch-2');
        expect(host.fired.map((m) => m.body.batchId)).toEqual(['batch-1', 'batch-2', 'batch-3']);
        sender.onSaved(last().id, 'batch-3');
        expect(queue.list().map((e) => [e.batchId, e.state])).toEqual([['batch-1', 'refused']]);
        expect(host.fired.length).toBe(3);
    });

    test('the level gate: stored entries replay only at phone or full; a new batch is sent at any level', () => {
        const store = new FakeStore();
        const seed = new UnsavedQueue(store, () => undefined);
        seed.setKey(KEY);
        seed.enqueue(line(1), T0);
        const { host, sender } = rig({ store, level: null });
        sender.replay();
        jest.advanceTimersByTime(REPLAY_INTERVAL_MS * 2);
        expect(host.fired).toEqual([]);
        host.levelNow = 'none';
        sender.replay();
        expect(host.fired).toEqual([]);
        sender.enqueueAndSend(line(2), T0);
        expect(host.fired.map((m) => m.body.batchId)).toEqual(['batch-2']);
        host.levelNow = 'phone';
        sender.onError(host.fired[0].id, { code: 'role', message: 'No.' });
        expect(host.fired.map((m) => m.body.batchId)).toEqual(['batch-2', 'batch-1']);
    });

    test('no storage key (no project name): the entries in memory are replayed all the same', () => {
        const { queue, host, sender } = rig({ key: false });
        sender.enqueueAndSend(line(1), T0);
        expect(queue.storageKey).toBeNull();
        jest.advanceTimersByTime(REPLY_TIMEOUT_MS + REPLAY_INTERVAL_MS);
        expect(host.fired.length).toBe(2);
    });

    test('not connected: unsent at once with disconnected, and a fire that throws counts the same', () => {
        const { queue, host, sender } = rig();
        host.online = false;
        sender.enqueueAndSend(line(1), T0);
        expect(host.fired).toEqual([]);
        expect(host.unsent).toEqual([['batch-1', LocalReasons.DISCONNECTED]]);
        host.online = true;
        host.throwOnFire = true;
        sender.enqueueAndSend(line(2), T0);
        expect(host.unsent[1]).toEqual(['batch-2', LocalReasons.DISCONNECTED]);
        expect(sender.sending()).toEqual([]);
        host.throwOnFire = false;
        jest.advanceTimersByTime(REPLAY_INTERVAL_MS);
        expect(host.fired.map((m) => m.body.batchId)).toEqual(['batch-1']);
        expect(queue.list().length).toBe(2);
    });

    test('storage fails: the batch is still sent and replayed from memory', () => {
        const store = new FakeStore();
        store.fail = true;
        const { host, sender, queue } = rig({ store });
        sender.enqueueAndSend(line(1), T0);
        expect(host.fired.length).toBe(1);
        expect(queue.storageUnavailable).toBe(true);
        jest.advanceTimersByTime(REPLY_TIMEOUT_MS + REPLAY_INTERVAL_MS);
        expect(host.fired.length).toBe(2);
    });

    test('Discard is refused while the batch is in flight; afterwards a late refusal is ignored', () => {
        const { queue, host, sender, last } = rig();
        sender.enqueueAndSend(line(1), T0);
        const first = last();
        expect(sender.discard('batch-1')).toBe(false);
        expect(queue.list().length).toBe(1);
        jest.advanceTimersByTime(REPLY_TIMEOUT_MS);
        expect(sender.discard('batch-1')).toBe(true);
        expect(queue.list()).toEqual([]);
        expect(sender.owns(first.id)).toBe(false);
        expect(sender.onError(first.id, CONFLICT)).toEqual({ kind: 'ignored' });
        jest.advanceTimersByTime(REPLAY_INTERVAL_MS * 2);
        expect(host.fired.length).toBe(1);
    });

    test('a storage event: another tab\'s discard clears this tab\'s in-flight send, and its error is ignored', () => {
        const store = new FakeStore();
        const a = rig({ store });
        a.sender.enqueueAndSend(line(1), T0);
        const sent = a.last();
        const b = rig({ store });
        expect(b.queue.list().length).toBe(1);
        expect(b.sender.discard('batch-1')).toBe(true);
        a.sender.storage('some.other.key');
        expect(a.sender.isSending('batch-1')).toBe(true);
        a.sender.storage(KEY);
        expect(a.sender.isSending('batch-1')).toBe(false);
        expect(a.queue.list()).toEqual([]);
        expect(a.sender.onError(sent.id, BUSY)).toEqual({ kind: 'ignored' });
        expect(a.queue.list()).toEqual([]);
        jest.advanceTimersByTime(REPLY_TIMEOUT_MS + REPLAY_INTERVAL_MS);
        expect(a.host.unsent).toEqual([]);
        expect(a.host.fired.length).toBe(1);
    });

    test('two tabs may both replay one entry; the second reply finds nothing left to remove', () => {
        const store = new FakeStore();
        const seed = new UnsavedQueue(store, () => undefined);
        seed.setKey(KEY);
        seed.enqueue(line(1), T0);
        const a = rig({ store });
        const b = rig({ store });
        a.sender.replay();
        b.sender.replay();
        expect(a.host.fired[0].body).toEqual(b.host.fired[0].body);
        expect(a.sender.onSaved(a.last().id, 'batch-1').kind).toBe('saved');
        const second = b.sender.onSaved(b.last().id, 'batch-1');
        expect(second).toEqual({ kind: 'saved', batchId: 'batch-1', entry: undefined });
        expect(store.data.has(KEY)).toBe(false);
    });

    test('stop clears every timer', () => {
        const { host, sender } = rig();
        sender.enqueueAndSend(line(1), T0);
        sender.stop();
        jest.advanceTimersByTime(REPLY_TIMEOUT_MS + REPLAY_INTERVAL_MS * 3);
        expect(host.unsent).toEqual([]);
        expect(host.fired.length).toBe(1);
        expect(jest.getTimerCount()).toBe(0);
    });
});
