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

import { isRecord } from './json';
import { Conflict, EditBatch, EditLevel, EditOp, ErrorCodes, MapItemRecord, readConflicts, readMapItem, readUnitsData } from './contract';
import { ErrorBody } from './messages';
import { stepLabel } from './undoStack';
import { Kind } from './adapters';
import { distanceM } from './shared';
import { DistanceUnits, METRIC_UNITS, distanceText } from './geometry';
import { KpiLabels, NO_LABELS, overrideChanges } from './itemOverrides';

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
    /**
     * The conflict reply's stale ops (epic 4 entry 10, contract.ts `Conflict`): the stored record of each, who changed it and
     * when, kept on an entry refused for a conflict so the conflict card can say what the other editor changed; absent otherwise.
     */
    conflict?: Conflict[];
    /**
     * The records the batch's ops started from (entry 10), written when it is queued: the card names the fields the other
     * editor changed since (a point's move as a distance and a compass word). An entry queued before entry 10 has none.
     */
    before?: MapItemRecord[];
    /**
     * The batch is a Revert of a row of Recent changes (entry 12b1's rider, owner 2026-11-10), kept with the entry so it holds
     * after a reload: a refused Revert's conflict card offers only "Use <name>'s version", since the reverse put on top of the
     * change made since would take that change back unseen. Absent otherwise.
     */
    revert?: boolean;
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

function readBatch(value: unknown): EditBatch | null {
    if (!isRecord(value) || typeof value.batchId !== 'string' || !Array.isArray(value.ops) || value.ops.length === 0) {
        return null;
    }
    for (const op of value.ops) {
        if (!isRecord(op) || (op.op !== 'create' && op.op !== 'update' && op.op !== 'delete')
            || (op.entity !== 'item' && op.entity !== 'kindSetup' && op.entity !== 'settings') || typeof op.id !== 'string'
            || typeof op.baseVersion !== 'number'
            || !(isRecord(op.data) || (op.op === 'delete' && op.data === undefined))) {
            // A delete carries no `data` (docs/contract.md); every other op carries an object.
            return null;
        }
    }
    return value as unknown as EditBatch;
}

/**
 * A units value in words (epic 4 entry 19b, the owner's decision 6; the Layers row's words from entry 20b): "US, long labels",
 * "Metric, short labels", "Auto, short labels";
 * '' when it is not `{system, labels}`.
 */
export function unitsWords(value: unknown): string {
    const data = readUnitsData(value);
    if (!data) {
        return '';
    }
    const system = data.system === 'us' ? 'US' : data.system === 'metric' ? 'Metric' : 'Auto';
    return system + ', ' + (data.labels === 'long' ? 'long labels' : 'short labels');
}

/** The batch's units op (entry 19b), or undefined. */
function unitsOp(batch: EditBatch): EditOp | undefined {
    return batch.ops.find((o) => o.entity === 'settings');
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
    if (Array.isArray(value.conflict)) {
        const conflict = readConflicts(value.conflict);
        if (conflict.length > 0) {
            entry.conflict = conflict;
        }
    }
    if (Array.isArray(value.before)) {
        const before = value.before.map(readMapItem).filter((r): r is MapItemRecord => r !== null);
        if (before.length > 0) {
            entry.before = before;
        }
    }
    if (value.revert === true) {
        entry.revert = true;
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

    /**
     * Write a new batch at the end of the queue, before it is sent, with the records its ops started from (entry 10) and
     * whether it is a Revert of a row of Recent changes (entry 12b1).
     */
    enqueue(batch: EditBatch, now: Date, before: MapItemRecord[] = [], revert = false): UnsavedEntry {
        const entry: UnsavedEntry = { batchId: batch.batchId, batch, queuedAt: now.toISOString(), state: 'unsent' };
        if (before.length > 0) {
            entry.before = before;
        }
        if (revert) {
            entry.revert = true;
        }
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

    /**
     * No answer, a disconnected client, or an error reply: unsent or refused by the code's class. A conflict keeps the
     * reply's stale ops (`conflict`, entry 10); any other reason drops those of an earlier refusal.
     */
    failed(batchId: string, reason: UnsavedReason, conflict: Conflict[] = []): void {
        this.change((list) => {
            const entry = list.find((e) => e.batchId === batchId);
            if (entry) {
                entry.state = isTransient(reason.code) ? 'unsent' : 'refused';
                entry.reason = reason;
                if (reason.code === ErrorCodes.CONFLICT && conflict.length > 0) {
                    entry.conflict = conflict;
                } else {
                    delete entry.conflict;
                }
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
    return 'Not saved - ' + reasonText(reason);
}

/** A reason in words, as an entry says it after "Not saved - ": the other editor named on a conflict, the busy answer short. */
export function reasonText(reason: UnsavedReason): string {
    if (reason.code === ErrorCodes.CONFLICT) {
        return 'conflict with ' + (reason.changedBy ? reason.changedBy + "'s" : "another editor's") + ' change. ' + reason.message;
    }
    if (isBusy(reason)) {
        return 'Map Studio is busy';
    }
    switch (reason.code) {
        case LocalReasons.TIMEOUT:
            return 'store unreachable (no answer from the Gateway)';
        case LocalReasons.DISCONNECTED:
            return 'store unreachable (not connected to the Gateway)';
        case ErrorCodes.STORE_UNREACHABLE:
            return 'store unreachable. ' + reason.message;
        default:
            return reason.message;
    }
}

function edits(n: number): string {
    return n === 1 ? '1 edit' : n + ' edits';
}

/** Whether an entry waits because the store is out of reach (no answer, not connected, store-unreachable but not busy). */
export function unreachable(entries: UnsavedEntry[]): boolean {
    return entries.some((e) => e.state === 'unsent' && !!e.reason && !isBusy(e.reason)
        && (e.reason.code === LocalReasons.TIMEOUT || e.reason.code === LocalReasons.DISCONNECTED
            || e.reason.code === ErrorCodes.STORE_UNREACHABLE));
}

/** The summary line over the list, or '' when the queue is empty. */
export function summaryText(entries: UnsavedEntry[], level: EditLevel | null): string {
    if (entries.length === 0) {
        return '';
    }
    if (level === 'none') {
        return edits(entries.length) + ' not saved. ' + SIGN_IN_TEXT;
    }
    return (unreachable(entries) ? 'Store unreachable - ' : '') + edits(entries.length) + ' not saved';
}

/**
 * The words for the edits waiting on the save status row and the View-mode chip (epic 4 entry 24, owner 2026-11-05:
 * "2 edits not saved" with the reason): the summary, "Store unreachable - 2 edits not saved" while the store is out of
 * reach (DESIGN.md Save status), else the count and the first reason the queue holds, oldest first, in an entry's words
 * ("1 edit not saved - conflict with mapoperator's change. P31 was changed by ...", "2 edits not saved - Map Studio is
 * busy"), or the count alone while no entry has a reason yet; '' with none.
 */
export function waitingText(entries: UnsavedEntry[], level: EditLevel | null): string {
    const summary = summaryText(entries, level);
    if (summary === '' || level === 'none' || unreachable(entries)) {
        return summary;
    }
    const first = entries.find((e) => e.reason !== undefined);
    return first && first.reason ? summary + ' - ' + reasonText(first.reason) : summary;
}

/**
 * Which edit a queued batch is, in Undo's words (undoStack.ts `stepLabel`; entry 24, each waiting edit named as the owner's
 * mock names it): its first map item op as "add Gathering line", "rename P14" (the new name), "move SWD1", "link P14",
 * "unlink P14", "edit P14" or "delete L-TEST"; the item's name from the batch's own data, else from the record `items`
 * holds, else "an item". A batch of kind setups alone is "edit a kind setup"; one of the units setting alone (entry 19b)
 * "set the units" or "clear the units setting".
 */
export function editLabel(batch: EditBatch, items: MapItemRecord[]): string {
    const op = batch.ops.find((o) => o.entity === 'item');
    if (!op) {
        const units = unitsOp(batch);
        return units ? (units.op === 'delete' ? 'clear the units setting' : 'set the units') : 'edit a kind setup';
    }
    const data = op.data || {};
    const record = items.find((i) => i.id === op.id);
    const name = typeof data.name === 'string' && data.name !== '' ? data.name : record && record.name !== '' ? record.name : 'an item';
    if (op.op === 'create') {
        return stepLabel('add', name);
    }
    if (op.op === 'delete') {
        return 'delete ' + name;
    }
    const keys = Object.keys(data);
    if (keys.length === 1 && keys[0] === 'name') {
        return stepLabel('rename', name);
    }
    if (keys.length === 1 && keys[0] === 'geometry') {
        return stepLabel('move', name);
    }
    if (keys.length === 1 && keys[0] === 'assetId') {
        return stepLabel(data.assetId === null ? 'unlink' : 'link', name);
    }
    return stepLabel('edit', name);
}

/*
 * The save problems' card (epic 4 entry 10; EXPERIENCE.md Save and store states, R26; DESIGN.md Conflict card, Save banner): one
 * card on the map under the toolbar, for the store unreachable, a conflict (who changed what and when, my change kept) or busy.
 * The words and the rebased batch of Apply mine on top are worked out here, pure; the delegate keeps the pause and sends.
 */

/** "10:42": an ISO 8601 time in the browser's own clock, or '' when it cannot be read. */
export function clockText(iso: string | null): string {
    if (iso === null) {
        return '';
    }
    const t = Date.parse(iso);
    if (!isFinite(t)) {
        return '';
    }
    const d = new Date(t);
    const two = (n: number): string => (n < 10 ? '0' : '') + n;
    return two(d.getHours()) + ':' + two(d.getMinutes());
}

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

/** The compass word from one `[lng, lat]` to another, of eight ("north", "south-west"). */
export function compassWord(from: [number, number], to: [number, number]): string {
    const dx = (to[0] - from[0]) * Math.cos((from[1] * Math.PI) / 180);
    const dy = to[1] - from[1];
    const deg = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
    return COMPASS[Math.round(deg / 45) % 8];
}

/** A point's move in words: "about 40 m north" (geometry.ts `distanceText` in the units in force), or "a little" under 5 m. */
export function moveWords(from: [number, number], to: [number, number], distanceUnits: DistanceUnits = METRIC_UNITS): string {
    const m = distanceM(from, to);
    if (m < 5) {
        return 'a little';
    }
    return 'about ' + distanceText(m, distanceUnits) + ' ' + compassWord(from, to);
}

export function same(a: unknown, b: unknown): boolean {
    return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
}

/** A kind's field label for a property key, the key itself when the kind does not name it. */
export function fieldLabel(kinds: Kind[], kindId: string, key: string): string {
    const kind = kinds.find((k) => k.id === kindId);
    const field = kind ? kind.fields.find((f) => f.key === key) : undefined;
    return field && field.label !== '' ? field.label : key;
}

/** The keys whose values differ between two objects, in a stable order (the first object's keys, then the second's). */
function changedKeys(a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined): string[] {
    const x = a || {};
    const y = b || {};
    const keys = Object.keys(x).concat(Object.keys(y).filter((k) => !(k in x)));
    return keys.filter((k) => !same(x[k], y[k]));
}

export function joinWords(words: string[]): string {
    if (words.length <= 1) {
        return words.join('');
    }
    return words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1];
}

function recordPoint(record: MapItemRecord | undefined): [number, number] | null {
    return record && record.geometry.type === 'Point' ? record.geometry.coordinates as [number, number] : null;
}

/** The record an entry's op started from (`before`), or undefined (an older entry, a create). */
function beforeOf(entry: UnsavedEntry, id: string): MapItemRecord | undefined {
    return entry.before ? entry.before.find((r) => r.id === id) : undefined;
}

/** The fields that differ between two records of one map item, in words ("name", "Gas rate", "asset link"); the geometry apart. */
function fieldWords(a: MapItemRecord, b: MapItemRecord, kinds: Kind[], labels: KpiLabels = NO_LABELS): string[] {
    const words: string[] = [];
    if (a.name !== b.name) {
        words.push('name');
    }
    if (a.kind !== b.kind) {
        words.push('kind');
    }
    if (a.assetId !== b.assetId) {
        words.push('asset link');
    }
    for (const key of changedKeys(a.properties, b.properties)) {
        words.push(fieldLabel(kinds, b.kind, key));
    }
    // Entry 12c1 (owner decision 3): an override by its part ("Pressure path", "comms path"), a key value by its label.
    for (const c of overrideChanges(a.overrides, b.overrides, (key) => labels(b.kind, key))) {
        words.push(c.words);
    }
    if (!same(a.ends, b.ends)) {
        words.push('ends');
    }
    return words;
}

/** Why Apply mine on top is not offered for one stale op, or '' when it is: they deleted it, or my add met one that exists. */
function blockedWhy(op: EditOp, c: Conflict): 'deleted' | 'exists' | 'gone' | '' {
    if (c.current === null) {
        return 'gone';
    }
    if (c.current.deleted) {
        // Their delete meets any op of mine, my delete included: there is nothing to go on top of.
        return 'deleted';
    }
    return op.op === 'create' ? 'exists' : '';
}

function opOf(entry: UnsavedEntry, c: Conflict): EditOp | undefined {
    return entry.batch.ops.find((op) => op.entity === c.entity && op.id === c.id);
}

/**
 * The other editor's change in words (the conflict card's sentence, DESIGN.md Conflict card): "Sam moved P14 about 40 m north
 * at 10:42", "Sam changed P14's name and Gas rate at 10:42", "Sam deleted P14 at 10:42"; with no `before` (an older entry) or
 * nothing it can name, "Sam changed P14 at 10:42". The first stale op is named, "and 2 more" after it when there are more.
 */
export function theirChangeText(entry: UnsavedEntry, kinds: Kind[] = [], distanceUnits: DistanceUnits = METRIC_UNITS, records: MapItemRecord[] = [],
    labels: KpiLabels = NO_LABELS): string {
    const conflicts = entry.conflict || [];
    if (conflicts.length === 0) {
        // Refused before entry 10 kept the conflict (decision 3's fallback): who, and the item as Undo names it.
        const who = entry.reason && entry.reason.changedBy ? entry.reason.changedBy : 'Another editor';
        return who + ' changed ' + itemName(entry, records) + ' since you loaded it';
    }
    const c = conflicts[0];
    const who = c.changedBy || (entry.reason && entry.reason.changedBy) || 'Another editor';
    const at = clockText(c.changedAt);
    const when = at !== '' ? ' at ' + at : '';
    const more = conflicts.length > 1 ? ' and ' + (conflicts.length - 1) + ' more' : '';
    if (c.entity === 'settings') {
        // The units setting (entry 19b), as the Gateway's conflict names it.
        return who + (c.current && c.current.deleted ? ' cleared' : ' changed') + ' the units setting' + more + when;
    }
    if (c.entity !== 'item') {
        const kind = kinds.find((k) => k.id === c.id);
        return who + ' changed the ' + (kind ? kind.name : c.id) + ' kind setup' + more + when;
    }
    const current = c.current as MapItemRecord | null;
    const mine = beforeOf(entry, c.id);
    const name = current && current.name !== '' ? current.name : mine && mine.name !== '' ? mine.name : 'an item';
    const op = opOf(entry, c);
    const why = op ? blockedWhy(op, c) : '';
    if (why === 'gone') {
        return name + ' is no longer in the map store' + more;
    }
    if (why === 'deleted') {
        return who + ' deleted ' + name + more + when;
    }
    if (why === 'exists') {
        return who + ' already added ' + name + more + when;
    }
    if (!current || !mine) {
        return who + ' changed ' + name + more + when;
    }
    const from = recordPoint(mine);
    const to = recordPoint(current);
    const moved = from && to && !same(from, to) ? 'moved ' + name + ' ' + moveWords(from, to, distanceUnits) : '';
    const reshaped = !moved && !same(mine.geometry, current.geometry) ? 'shape' : '';
    const fields = (reshaped ? [reshaped] : []).concat(fieldWords(mine, current, kinds, labels));
    if (moved && fields.length > 0) {
        return who + ' ' + moved + ' and changed its ' + joinWords(fields) + more + when;
    }
    if (moved) {
        return who + ' ' + moved + more + when;
    }
    if (fields.length > 0) {
        return who + ' changed ' + name + "'s " + joinWords(fields) + more + when;
    }
    return who + ' changed ' + name + more + when;
}

/** Why only "Use <name>'s version" is offered, in words, or '' when Apply mine on top is (entry 10, decision 1). */
/** The first map item an entry's batch touches, by name: from the batch, else `before`, else the records; "an item" otherwise. */
function itemName(entry: UnsavedEntry, records: MapItemRecord[]): string {
    const op = entry.batch.ops.find((o) => o.entity === 'item');
    if (!op) {
        return unitsOp(entry.batch) ? 'the units setting' : 'a kind setup';
    }
    const named = op.data && typeof op.data.name === 'string' && op.data.name !== '' ? op.data.name : '';
    const record = beforeOf(entry, op.id) || records.find((r) => r.id === op.id);
    return named !== '' ? named : record && record.name !== '' ? record.name : 'an item';
}

export function onTopBlockedText(entry: UnsavedEntry): string {
    if (isConflict(entry) && (!entry.conflict || entry.conflict.length === 0)) {
        return 'The stored version was not kept with this edit, so it cannot go on top.';
    }
    for (const c of entry.conflict || []) {
        const op = opOf(entry, c);
        const why = op ? blockedWhy(op, c) : '';
        if (why === 'deleted') {
            return 'It was deleted, so your change cannot go on top of it.';
        }
        if (why === 'exists') {
            return 'It already exists, so yours cannot be added again.';
        }
        if (why === 'gone') {
            return 'It is no longer in the map store, so your change cannot go on top of it.';
        }
    }
    return '';
}

function valueWords(value: unknown): string {
    if (value === true) {
        return 'switched on';
    }
    if (value === false) {
        return 'switched off';
    }
    if (value === null || value === undefined || value === '') {
        return 'cleared';
    }
    return typeof value === 'object' ? 'changed' : String(value);
}

/** One update op of mine in words: "label position Right, Gas rate switched on", "moved about 40 m north", "name P14b". */
function updateWords(op: EditOp, mine: MapItemRecord | undefined, kinds: Kind[], distanceUnits: DistanceUnits, labels: KpiLabels = NO_LABELS): string[] {
    const data = op.data || {};
    const kindId = typeof data.kind === 'string' ? data.kind : mine ? mine.kind : '';
    const words: string[] = [];
    for (const key of Object.keys(data)) {
        const value = (data as Record<string, unknown>)[key];
        if (mine && same((mine as unknown as Record<string, unknown>)[key], value)) {
            continue;
        }
        if (key === 'name') {
            words.push('name ' + String(value));
        } else if (key === 'kind') {
            const kind = kinds.find((k) => k.id === value);
            words.push('kind ' + (kind ? kind.name : String(value)));
        } else if (key === 'assetId') {
            words.push(value === null ? 'unlinked' : 'linked to an asset');
        } else if (key === 'geometry') {
            const from = recordPoint(mine);
            const g = data.geometry;
            const to = g && g.type === 'Point' ? g.coordinates as [number, number] : null;
            words.push(from && to ? 'moved ' + moveWords(from, to, distanceUnits) : to ? 'a new place' : 'a new shape');
        } else if (key === 'properties') {
            const props = (value || {}) as Record<string, unknown>;
            const keys = mine ? changedKeys(mine.properties, props) : Object.keys(props);
            for (const k of keys) {
                words.push(fieldLabel(kinds, kindId, k) + ' ' + valueWords(props[k]));
            }
        } else if (key === 'overrides') {
            const changes = overrideChanges(mine ? mine.overrides : {}, value, (k) => labels(mine ? mine.kind : kindId, k));
            if (changes.length === 0) {
                words.push('overrides');
            }
            for (const c of changes) {
                words.push(c.words + (c.reset ? ' reset' : c.after !== '' ? ' ' + c.after : ''));
            }
        } else if (key === 'ends') {
            words.push('its ends');
        } else if (key === 'attachment') {
            words.push('its place on its line');
        }
    }
    return words;
}

/**
 * My change in words, the card's "Your change, kept here ...: ..." (EXPERIENCE.md, the mocks): an update's fields that differ
 * from where it started ("label position Right, Gas rate switched on"), with the item's name first when `named` (the busy
 * card: "P14 label position Right"); an add or a delete as Undo names it ("Add Gathering line"). The first map item op; "and 2
 * more items" after it when the batch changes more.
 */
export function yourChangeText(entry: UnsavedEntry, records: MapItemRecord[], kinds: Kind[] = [], distanceUnits: DistanceUnits = METRIC_UNITS,
    named: boolean = false, labels: KpiLabels = NO_LABELS): string {
    const items = entry.batch.ops.filter((o) => o.entity === 'item');
    const op = items[0];
    if (!op) {
        const units = unitsOp(entry.batch);
        if (units) {
            const words = unitsWords(units.data);
            return units.op === 'delete' ? 'the units setting cleared' : words !== '' ? 'the units set to ' + words : 'a change to the units';
        }
        const setup = entry.batch.ops.find((o) => o.entity === 'kindSetup');
        const kind = setup ? kinds.find((k) => k.id === setup.id) : undefined;
        return kind ? 'a change to the ' + kind.name + ' kind setup' : 'Edit a kind setup';
    }
    const more = items.length > 1 ? ' and ' + (items.length - 1) + (items.length === 2 ? ' more item' : ' more items') : '';
    const label = editLabel(entry.batch, records);
    if (op.op !== 'update') {
        return label.charAt(0).toUpperCase() + label.slice(1) + more;
    }
    const mine = beforeOf(entry, op.id) || records.find((r) => r.id === op.id);
    const words = updateWords(op, beforeOf(entry, op.id), kinds, distanceUnits, labels);
    const name = op.data && typeof op.data.name === 'string' && op.data.name !== '' ? op.data.name : mine && mine.name !== '' ? mine.name : 'an item';
    const detail = words.length > 0 ? words.join(', ') : 'a change to ' + name;
    return (named && words.length > 0 ? name + ' ' : '') + detail + more;
}

/** Fields merged onto the stored object: my keys that differ from where I started, set or removed; the rest theirs. */
function mergeOnto(stored: Record<string, unknown>, mine: Record<string, unknown>, started: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...stored };
    for (const key of changedKeys(started, mine)) {
        if (key in mine) {
            out[key] = mine[key];
        } else {
            delete out[key];
        }
    }
    return out;
}

/**
 * Apply mine on top (entry 10, decision 1): a new batch with a new `batchId`, each stale op at its conflict's
 * `current.version` with my op's data; `properties` and `overrides`, which an update carries whole, take only the keys I
 * changed from where I started (`before`) onto the stored ones, so a field the other editor changed and I did not stays
 * theirs. The other ops are as stored. Null when it is not offered: no conflict kept, they deleted the item or my add met
 * one that already exists (`onTopBlockedText`), the batch saves a kind setup (`isSetupSave`, entry 12a), it is a Revert
 * (`revert`, entry 12b1), or it holds settings ops only (the Units row's press, entry 20b: it is no Undo step, and the row is
 * pressed again on the stored value instead). The stored entry is not changed: the caller discards it.
 */
export function onTopBatch(entry: UnsavedEntry, batchId: string): EditBatch | null {
    const conflicts = entry.conflict || [];
    if (conflicts.length === 0 || onTopBlockedText(entry) !== '' || isSetupSave(entry) || entry.revert === true
        || entry.batch.ops.every((op) => op.entity === 'settings')) {
        return null;
    }
    const ops: EditOp[] = [];
    for (const op of entry.batch.ops) {
        const c = conflicts.find((x) => x.entity === op.entity && x.id === op.id);
        if (!c || !c.current) {
            ops.push(op);
            continue;
        }
        const next: EditOp = { ...op, baseVersion: c.current.version };
        const started = op.entity === 'item' ? beforeOf(entry, op.id) : undefined;
        const current = c.current as MapItemRecord;
        if (op.op === 'update' && op.data && started && op.entity === 'item') {
            const data = { ...op.data };
            if (data.properties) {
                data.properties = mergeOnto(current.properties || {}, data.properties, started.properties || {});
            }
            if (data.overrides) {
                data.overrides = mergeOnto(current.overrides || {}, data.overrides, started.overrides || {});
            }
            next.data = data;
        }
        ops.push(next);
    }
    return { batchId, ops };
}

/**
 * Whether an entry saves a kind setup (epic 4 entry 12a). A setup is stored whole, so mine cannot go on top of another editor's
 * without taking their other parts back: its conflict card offers only "Use <name>'s version" (owner decision 6, 2026-11-09; to be
 * weighed again in entry 12b; kept in 12b1, owner decision 5 of 2026-11-10).
 */
export function isSetupSave(entry: UnsavedEntry): boolean {
    return entry.batch.ops.some((op) => op.entity === 'kindSetup');
}

/** Which card shows: the store unreachable, a conflict or busy (entry 10, R26). */
export type SaveCardKind = 'unreachable' | 'conflict' | 'busy';

/** The one card on the map under the toolbar, in words (`saveCardFor`). */
export interface SaveCardData {
    kind: SaveCardKind;
    /** The entry the card is for; '' for the store unreachable, which is for every edit. */
    batchId: string;
    title: string;
    /** What happened, in a sentence. */
    text: string;
    /** What was kept: "Your change, kept here and not saved: ...", or '' (the unreachable card says it in its sentence). */
    kept: string;
    /** "1 of 2" while two or more conflicts wait, else ''. */
    position: string;
    /** The other editor's name, for "Use <name>'s version" (conflict); '' when unknown ("Use their version"). */
    who: string;
    /** Whether Apply mine on top is offered (conflict); when not, `blocked` says why. */
    onTop: boolean;
    blocked: string;
    /** The edits waiting to save when the store is back, unsent ones only (unreachable: "Show my 2 edits"). */
    count: number;
    /** What Esc closes the card for (`dismissKey`); '' for the unreachable card, which does not close. */
    closeKey: string;
}

/** The facts a card is worked out from. */
export interface SaveCardFacts {
    unsaved: UnsavedEntry[];
    /** A save was answered store-unreachable (not busy): the tools are paused until a save or a load succeeds. */
    paused: boolean;
    /** The conflict and busy cards closed with Esc, by `dismissKey` (the batch and its refusal): their entries stay on the row. */
    dismissed: readonly string[];
    records: MapItemRecord[];
    kinds: Kind[];
    distanceUnits: DistanceUnits;
    /** A key value's label by kind and key (itemOverrides.ts `kpiLabelsOf` of the stored kind setups), for an override's words. */
    kpiLabel?: KpiLabels;
}

/**
 * What Esc closes a card for (entry 10, R10): the batch and its refusal, its code and the other editor's time, so a newer
 * conflict for the same batch (after Try again) shows a fresh card. The component also forgets a batch's closed card on Try again.
 */
export function dismissKey(entry: UnsavedEntry): string {
    const c = (entry.conflict || [])[0];
    return entry.batchId + '|' + (entry.reason ? entry.reason.code : '') + '|' + (c && c.changedAt ? c.changedAt : '');
}

/** Whether an entry waits refused for a conflict (the conflict card's). */
export function isConflict(entry: UnsavedEntry): boolean {
    return entry.state === 'refused' && !!entry.reason && entry.reason.code === ErrorCodes.CONFLICT;
}

/** The other editor's name on an entry's conflict, or '' when none is known. */
function otherEditor(entry: UnsavedEntry): string {
    const named = (entry.conflict || []).find((c) => c.changedBy);
    return named && named.changedBy ? named.changedBy : entry.reason && entry.reason.changedBy ? entry.reason.changedBy : '';
}

/**
 * The one card to show (entry 10, decision 2): the store unreachable first, then the conflicts oldest first ("1 of 2" while
 * two or more wait), then busy; null with none. A conflict or busy card closed with Esc is not shown again for its entry.
 */
export function saveCardFor(facts: SaveCardFacts): SaveCardData | null {
    // The edits that wait to save when the store is back (a refused one waits for Try again or Discard, not for the store).
    const n = facts.unsaved.filter((e) => e.state === 'unsent').length;
    if (facts.paused) {
        const yours = n === 1 ? 'Your edit is' : n === 0 ? 'Your edits are' : 'Your ' + n + ' edits are';
        return {
            kind: 'unreachable', batchId: '', title: 'Store unreachable',
            text: 'Map Studio cannot reach the map store. ' + yours + ' kept on this computer, not saved yet, and save when the store '
                + 'is back. Drawing and editing are paused; live values still update.',
            kept: '', position: '', who: '', onTop: false, blocked: '', count: n, closeKey: ''
        };
    }
    const conflicts = facts.unsaved.filter(isConflict);
    const open = conflicts.filter((e) => facts.dismissed.indexOf(dismissKey(e)) < 0);
    if (open.length > 0) {
        const entry = open[0];
        const who = otherEditor(entry);
        const blocked = onTopBlockedText(entry);
        const their = theirChangeText(entry, facts.kinds, facts.distanceUnits, facts.records, facts.kpiLabel);
        return {
            kind: 'conflict', batchId: entry.batchId,
            title: 'Not saved - conflict with ' + (who !== '' ? who + "'s" : "another editor's") + ' change',
            text: their + (blocked === '' ? ', while you were editing it.' : '. ' + blocked),
            kept: 'Your change, kept here and not saved: ' + yourChangeText(entry, facts.records, facts.kinds, facts.distanceUnits, false, facts.kpiLabel) + '.',
            position: conflicts.length >= 2 ? (conflicts.indexOf(entry) + 1) + ' of ' + conflicts.length : '',
            who, onTop: blocked === '' && onTopBatch(entry, 'check') !== null, blocked, count: n, closeKey: dismissKey(entry)
        };
    }
    const busy = facts.unsaved.find((e) => isBusy(e.reason) && facts.dismissed.indexOf(dismissKey(e)) < 0);
    if (busy && busy.reason) {
        return {
            kind: 'busy', batchId: busy.batchId, title: 'Not saved - Map Studio is busy', text: busy.reason.message,
            kept: 'Your change, kept here: ' + yourChangeText(busy, facts.records, facts.kinds, facts.distanceUnits, true, facts.kpiLabel) + '.',
            position: '', who: '', onTop: false, blocked: '', count: n, closeKey: dismissKey(busy)
        };
    }
    return null;
}
