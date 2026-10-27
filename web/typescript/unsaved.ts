/**
 * Unsaved edits in the browser (epic 2 story 8; AD-10, FR-29, FR-31). Every batch
 * is written to an ordered queue in `localStorage` before it is sent, and stays
 * there until an `edits.apply.reply` for its `batchId` arrives or the user
 * discards it. A replay sends the stored batch unchanged (same `batchId`, ops and
 * `baseVersion`s; story 2's retry rule makes a resend of a committed batch return
 * the first reply). Pure, unit tested in node: the store is passed in, never `window`.
 *
 * The queue is kept per project and user (owner decision, 2026-10-27): the key is
 * `mapstudio.unsaved.v1:<project>:<user>`, the user from `map.load.reply`'s `user`
 * ('' for a session that has none, level `none`). Until the key is known the
 * entries live in memory only and move into storage once it is.
 */

import { EditBatch, EditLevel, ErrorCodes, MapItemRecord } from './contract';
import { ErrorBody } from './messages';

/** The storage the queue writes to: `localStorage` in the browser, a fake in tests. */
export interface KeyValueStore {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export const STORAGE_PREFIX = 'mapstudio.unsaved.v1:';

/** How long a sent batch waits for its reply before it counts as unsent. */
export const REPLY_TIMEOUT_MS = 15_000;

/** How often unsent entries are replayed while some remain. */
export const REPLAY_INTERVAL_MS = 15_000;

/** The browser's own reasons for an unsent entry (no Gateway code). */
export const LocalReasons = {
    TIMEOUT: 'timeout',
    DISCONNECTED: 'disconnected'
} as const;

export interface UnsavedReason {
    code: string;
    message: string;
    /** The other editor, on a `conflict`; absent when the Gateway did not name one. */
    changedBy?: string;
}

/**
 * `unsent`: kept and replayed automatically (no reason yet while first sent).
 * `refused`: a final refusal, kept with its reason until Try again or Discard.
 */
export type UnsavedState = 'unsent' | 'refused';

export interface UnsavedEntry {
    batchId: string;
    batch: EditBatch;
    /** ISO 8601, when the batch was first queued; the queue's order. */
    queuedAt: string;
    state: UnsavedState;
    reason?: UnsavedReason;
}

export const STORAGE_WARNING =
    'This browser cannot keep unsaved edits; an edit not saved now is lost when the page closes.';

export const SIGN_IN_TEXT = 'Sign in with a Map Studio editing role to save these edits.';

/** The storage key for a project and user. */
export function storageKey(project: string, user: string): string {
    return STORAGE_PREFIX + project + ':' + user;
}

/**
 * Whether a code is transient (kept unsent, replayed automatically) or final (kept
 * refused, replayed only on Try again).
 */
export function isTransient(code: string): boolean {
    return code === LocalReasons.TIMEOUT || code === LocalReasons.DISCONNECTED
        || code === ErrorCodes.STORE_UNREACHABLE || code === ErrorCodes.READ_ONLY;
}

/** The Gateway's busy answer (MapStudioDelegate.busyReply): store-unreachable with this sentence. */
export function isBusy(reason: UnsavedReason | undefined): boolean {
    return !!reason && reason.code === ErrorCodes.STORE_UNREACHABLE && reason.message.indexOf('Map Studio is busy') === 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBatch(value: unknown): EditBatch | null {
    if (!isRecord(value) || typeof value.batchId !== 'string' || !Array.isArray(value.ops) || value.ops.length === 0) {
        return null;
    }
    for (const op of value.ops) {
        if (!isRecord(op) || (op.op !== 'create' && op.op !== 'update' && op.op !== 'delete')
            || (op.entity !== 'item' && op.entity !== 'kindSetup') || typeof op.id !== 'string'
            || typeof op.baseVersion !== 'number'
            || !(isRecord(op.data) || (op.op === 'delete' && op.data === undefined))) {
            // A delete carries no `data` (docs/contract.md); every other op carries an object.
            return null;
        }
    }
    return value as unknown as EditBatch;
}

function readReason(value: unknown): UnsavedReason | undefined {
    if (!isRecord(value) || typeof value.code !== 'string' || typeof value.message !== 'string') {
        return undefined;
    }
    const reason: UnsavedReason = { code: value.code, message: value.message };
    if (typeof value.changedBy === 'string') {
        reason.changedBy = value.changedBy;
    }
    return reason;
}

/** One stored entry, or null when it is malformed. */
export function readEntry(value: unknown): UnsavedEntry | null {
    if (!isRecord(value) || typeof value.batchId !== 'string' || typeof value.queuedAt !== 'string'
        || (value.state !== 'unsent' && value.state !== 'refused')) {
        return null;
    }
    const batch = readBatch(value.batch);
    if (!batch || batch.batchId !== value.batchId) {
        return null;
    }
    const entry: UnsavedEntry = { batchId: value.batchId, batch, queuedAt: value.queuedAt, state: value.state };
    const reason = readReason(value.reason);
    if (reason) {
        entry.reason = reason;
    }
    return entry;
}

/** The stored queue: malformed entries (and a malformed list) are dropped, the rest kept in order. */
export function readEntries(raw: string | null): UnsavedEntry[] {
    if (raw === null || raw === '') {
        return [];
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        return [];
    }
    if (!Array.isArray(parsed)) {
        return [];
    }
    const out: UnsavedEntry[] = [];
    const seen = new Set<string>();
    for (const value of parsed) {
        const entry = readEntry(value);
        if (entry && !seen.has(entry.batchId)) {
            seen.add(entry.batchId);
            out.push(entry);
        }
    }
    return out;
}

/** The reason of an error reply, with the other editor's name on a `conflict`. */
export function reasonFromError(error: ErrorBody): UnsavedReason {
    const reason: UnsavedReason = { code: error.code, message: error.message };
    if (error.code === ErrorCodes.CONFLICT && error.conflicts) {
        const named = error.conflicts.find((c) => c.changedBy);
        if (named && named.changedBy) {
            reason.changedBy = named.changedBy;
        }
    }
    return reason;
}

/**
 * The ordered queue of one project and user. Every change re-reads storage first
 * (another tab may have changed it) and writes the whole list back. A storage call
 * that throws (quota, private window) calls `onStorageFailure` once, and from then on
 * this tab's memory decides until a write succeeds again: the key is cleared at once
 * (so an entry stored before the failure, later discarded or saved here, cannot come
 * back on the next page open), storage is not re-read, and every change and every
 * `refresh` tries the write again.
 */
export class UnsavedQueue {
    private key: string | null = null;
    private entries: UnsavedEntry[] = [];
    /** True once a storage call has thrown (or there is no storage); the warning has been given. */
    private failedOnce = false;
    /** True while memory may hold changes storage lacks (the last storage call threw). */
    private memoryAhead = false;

    constructor(private readonly storage: KeyValueStore | null, private readonly onStorageFailure: () => void) {
        if (!storage) {
            this.failedOnce = true;
        }
    }

    /** The storage key in use, or null before the user is known. */
    get storageKey(): string | null {
        return this.key;
    }

    /** True once storage has failed (or there is none); a later write may still succeed. */
    get storageUnavailable(): boolean {
        return this.failedOnce;
    }

    /**
     * Use the queue of `key`. Entries held while no key was known move into it, after the
     * stored ones; a change from one key to another drops the old key's entries from view
     * (they stay stored for their own user).
     */
    setKey(key: string): void {
        if (key === this.key) {
            return;
        }
        const held = this.key === null ? this.entries : [];
        this.key = key;
        this.memoryAhead = false;
        this.entries = this.read();
        if (held.length > 0) {
            this.change((list) => {
                for (const e of held) {
                    if (!list.some((x) => x.batchId === e.batchId)) {
                        list.push(e);
                    }
                }
            });
        }
    }

    /**
     * Re-read storage (a `storage` event from another tab, the replay timer); true when the
     * list changed. While memory is ahead of a failed storage it tries the write instead.
     */
    refresh(): boolean {
        if (this.key === null) {
            return false;
        }
        if (this.memoryAhead) {
            this.write();
            return false;
        }
        const before = JSON.stringify(this.entries);
        this.entries = this.read();
        return JSON.stringify(this.entries) !== before;
    }

    /** The queue in order, oldest first. */
    list(): UnsavedEntry[] {
        return this.entries.slice();
    }

    get(batchId: string): UnsavedEntry | undefined {
        return this.entries.find((e) => e.batchId === batchId);
    }

    /** Write a new batch at the end of the queue, before it is sent. */
    enqueue(batch: EditBatch, now: Date): UnsavedEntry {
        const entry: UnsavedEntry = { batchId: batch.batchId, batch, queuedAt: now.toISOString(), state: 'unsent' };
        this.change((list) => {
            if (!list.some((e) => e.batchId === batch.batchId)) {
                list.push(entry);
            }
        });
        return entry;
    }

    /** An `edits.apply.reply` for the batch: it is saved, remove it. */
    saved(batchId: string): void {
        this.change((list) => remove(list, batchId));
    }

    /** No answer, a disconnected client, or an error reply: unsent or refused by the code's class. */
    failed(batchId: string, reason: UnsavedReason): void {
        this.change((list) => {
            const entry = list.find((e) => e.batchId === batchId);
            if (entry) {
                entry.state = isTransient(reason.code) ? 'unsent' : 'refused';
                entry.reason = reason;
            }
        });
    }

    /** Try again: a refused entry becomes unsent, so the next replay sends it. */
    retry(batchId: string): void {
        this.change((list) => {
            const entry = list.find((e) => e.batchId === batchId);
            if (entry && entry.state === 'refused') {
                entry.state = 'unsent';
            }
        });
    }

    /** Discard: the entry is removed and never sent again. */
    discard(batchId: string): void {
        this.change((list) => remove(list, batchId));
    }

    /**
     * The oldest unsent entry not in flight, or null. A refused entry is skipped: replay
     * continues past it, each batch judged alone (owner decision, 2026-10-27).
     */
    nextToReplay(inFlight: ReadonlySet<string>): UnsavedEntry | null {
        for (const e of this.entries) {
            if (e.state === 'unsent' && !inFlight.has(e.batchId)) {
                return e;
            }
        }
        return null;
    }

    /** Whether any entry waits for an automatic replay. */
    hasUnsent(): boolean {
        return this.entries.some((e) => e.state === 'unsent');
    }

    private read(): UnsavedEntry[] {
        if (this.key === null || !this.storage || this.memoryAhead) {
            return this.entries;
        }
        try {
            return readEntries(this.storage.getItem(this.key));
        } catch (err) {
            this.fail();
            return this.entries;
        }
    }

    private change(fn: (list: UnsavedEntry[]) => void): void {
        const list = this.read().map((e) => ({ ...e }));
        fn(list);
        this.entries = list;
        this.write();
    }

    /** Write the whole list (remove the key when it is empty); on a throw, clear the key. */
    private write(): void {
        if (this.key === null || !this.storage) {
            return;
        }
        try {
            if (this.entries.length === 0) {
                this.storage.removeItem(this.key);
            } else {
                this.storage.setItem(this.key, JSON.stringify(this.entries));
            }
            this.memoryAhead = false;
        } catch (err) {
            this.fail();
            try {
                this.storage.removeItem(this.key);
            } catch (ignored) {
                // Storage refuses everything; memory is all there is.
            }
        }
    }

    private fail(): void {
        this.memoryAhead = true;
        if (!this.failedOnce) {
            this.failedOnce = true;
            this.onStorageFailure();
        }
    }
}

function remove(list: UnsavedEntry[], batchId: string): void {
    const i = list.findIndex((e) => e.batchId === batchId);
    if (i >= 0) {
        list.splice(i, 1);
    }
}

/** The map items an entry's create ops would store, drawn as unsaved (version 0). */
export function unsavedItems(entries: UnsavedEntry[]): MapItemRecord[] {
    const out: MapItemRecord[] = [];
    for (const e of entries) {
        for (const op of e.batch.ops) {
            const d = op.data;
            if (op.op !== 'create' || op.entity !== 'item' || !d || !d.geometry) {
                continue;
            }
            out.push({
                id: op.id,
                kind: typeof d.kind === 'string' ? d.kind : '',
                name: typeof d.name === 'string' ? d.name : '',
                geometry: d.geometry,
                properties: d.properties || {},
                assetId: typeof d.assetId === 'string' ? d.assetId : null,
                overrides: d.overrides || {},
                ends: d.ends || null,
                attachment: d.attachment || null,
                version: 0,
                deleted: false
            });
        }
    }
    return out;
}

/** The records a saved batch's create ops stored, with the versions of its reply. */
export function savedRecords(batch: EditBatch, results: Array<{ entity: string; id: string; version: number }>):
    MapItemRecord[] {
    const out: MapItemRecord[] = [];
    for (const item of unsavedItems([{ batchId: batch.batchId, batch, queuedAt: '', state: 'unsent' }])) {
        const result = results.find((r) => r.entity === 'item' && r.id === item.id);
        out.push({ ...item, version: result ? result.version : 1 });
    }
    return out;
}

/** The words for one entry (EXPERIENCE.md). `level` is the session's level, null before map.load. */
export function entryText(entry: UnsavedEntry, level: EditLevel | null): string {
    const reason = entry.reason;
    if (entry.state === 'unsent' && level === 'none') {
        return 'Not saved - ' + SIGN_IN_TEXT;
    }
    if (!reason) {
        return 'Not saved yet - saving ...';
    }
    if (reason.code === ErrorCodes.CONFLICT) {
        return 'Not saved - conflict with ' + (reason.changedBy ? reason.changedBy + "'s" : "another editor's")
            + ' change. ' + reason.message;
    }
    if (isBusy(reason)) {
        return 'Not saved - Map Studio is busy';
    }
    switch (reason.code) {
        case LocalReasons.TIMEOUT:
            return 'Not saved - store unreachable (no answer from the Gateway)';
        case LocalReasons.DISCONNECTED:
            return 'Not saved - store unreachable (not connected to the Gateway)';
        case ErrorCodes.STORE_UNREACHABLE:
            return 'Not saved - store unreachable. ' + reason.message;
        default:
            return 'Not saved - ' + reason.message;
    }
}

function edits(n: number): string {
    return n === 1 ? '1 edit' : n + ' edits';
}

/** The summary line over the list, or '' when the queue is empty. */
export function summaryText(entries: UnsavedEntry[], level: EditLevel | null): string {
    if (entries.length === 0) {
        return '';
    }
    if (level === 'none') {
        return edits(entries.length) + ' not saved. ' + SIGN_IN_TEXT;
    }
    const unreachable = entries.some((e) => e.state === 'unsent' && !!e.reason && !isBusy(e.reason)
        && (e.reason.code === LocalReasons.TIMEOUT || e.reason.code === LocalReasons.DISCONNECTED
            || e.reason.code === ErrorCodes.STORE_UNREACHABLE));
    return (unreachable ? 'Store unreachable - ' : '') + edits(entries.length) + ' not saved';
}
