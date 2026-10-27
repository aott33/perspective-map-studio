/**
 * Applying `map.changed` in the browser (AD-17, epic 2 story 4). Pure functions
 * only, unit tested in node; the store delegate holds the state.
 *
 * The rule (docs/contract.md, map.changed):
 *   not loaded:          buffer
 *   seq <= current:      ignore
 *   seq == current + 1:  apply records with version > drawn; current = seq
 *   seq >  current + 1:  reload (map.load), keep buffering until the reply
 * An unreadable `map.changed` counts as a gap. `seq` advances only through
 * `map.load.reply` and `map.changed`, never through `edits.apply.reply`.
 */

import { isRecord } from './json';
import { MapItemRecord, MapLoadReplyBody, readMapItem } from './contract';

/** One op of a `map.changed`: the op as saved, the new version, and the stored record after it. */
export interface ChangedOp {
    op: string;
    entity: string;
    id: string;
    version: number;
    /** A map item record when `entity` is `item`; a kind setup record (drawn by epic-viewing) otherwise. */
    record: MapItemRecord | Record<string, unknown>;
}

/** The body of `map.changed`. */
export interface MapChangedBody {
    seq: number;
    batchId: string;
    actor: string;
    ops: ChangedOp[];
}

/** What the browser knows of the map store: the items it draws and the last seq it applied. */
export interface ChangeState {
    /** The last seq applied (from map.load.reply or map.changed). */
    seq: number;
    /** False before the first map.load.reply, and from a gap until the reload's reply. */
    loaded: boolean;
    /** map.changed bodies received while not loaded, in arrival order. */
    buffer: MapChangedBody[];
    /** True when an unreadable map.changed (or a buffer overflow) arrived while not loaded. */
    stale: boolean;
    items: MapItemRecord[];
}

/** What the delegate does after a step: redraw, nothing, or send map.load. */
export type ChangeAction = 'apply' | 'ignore' | 'reload';

export interface ChangeStep {
    state: ChangeState;
    action: ChangeAction;
}

/** Bodies held while not loaded; beyond this the state is marked stale and reloads once loaded. */
export const MAX_BUFFER = 500;

export const CHANGES_INITIAL: ChangeState = { seq: 0, loaded: false, buffer: [], stale: false, items: [] };

/** The body of a map.changed, or null when it is unreadable (missing seq or ops, or a bad item record). */
export function readMapChanged(body: unknown): MapChangedBody | null {
    if (!isRecord(body) || typeof body.seq !== 'number' || !Number.isInteger(body.seq) || !Array.isArray(body.ops)) {
        return null;
    }
    const ops: ChangedOp[] = [];
    for (const raw of body.ops) {
        if (!isRecord(raw) || typeof raw.op !== 'string' || typeof raw.entity !== 'string'
            || typeof raw.id !== 'string' || typeof raw.version !== 'number' || !isRecord(raw.record)) {
            return null;
        }
        let record: ChangedOp['record'] = raw.record;
        if (raw.entity === 'item') {
            const item = readMapItem(raw.record);
            if (!item) {
                return null;
            }
            record = item;
        }
        ops.push({ op: raw.op, entity: raw.entity, id: raw.id, version: raw.version, record });
    }
    return {
        seq: body.seq,
        batchId: typeof body.batchId === 'string' ? body.batchId : '',
        actor: typeof body.actor === 'string' ? body.actor : '',
        ops
    };
}

/**
 * The items with one stored record applied by the version rule: applied only when
 * its version is above the drawn one (or the item is not drawn); a tombstone
 * (`deleted`) removes the item. Returns the same array when nothing changed.
 */
export function applyRecord(items: MapItemRecord[], record: MapItemRecord): MapItemRecord[] {
    const drawn = items.find((i) => i.id === record.id);
    if (drawn && drawn.version >= record.version) {
        return items;
    }
    const out = items.filter((i) => i.id !== record.id);
    if (!record.deleted) {
        out.push(record);
    }
    return out;
}

function applyBody(items: MapItemRecord[], body: MapChangedBody): MapItemRecord[] {
    let out = items;
    for (const op of body.ops) {
        // kindSetup records advance seq only: epic-viewing draws kind setups.
        if (op.entity === 'item') {
            out = applyRecord(out, op.record as MapItemRecord);
        }
    }
    return out;
}

/** One loaded-state step for a readable body. */
function step(state: ChangeState, body: MapChangedBody): ChangeStep {
    if (body.seq <= state.seq) {
        return { state, action: 'ignore' };
    }
    if (body.seq === state.seq + 1) {
        return { state: { ...state, seq: body.seq, items: applyBody(state.items, body) }, action: 'apply' };
    }
    return { state: { ...state, loaded: false, buffer: [body], stale: false }, action: 'reload' };
}

/** A `map.changed` arrived; `body` is null when it could not be read. */
export function onChanged(state: ChangeState, body: MapChangedBody | null): ChangeStep {
    if (!state.loaded) {
        if (body === null || state.buffer.length >= MAX_BUFFER) {
            return { state: { ...state, buffer: [], stale: true }, action: 'ignore' };
        }
        return { state: { ...state, buffer: [...state.buffer, body] }, action: 'ignore' };
    }
    if (body === null) {
        return { state: { ...state, loaded: false, buffer: [], stale: false }, action: 'reload' };
    }
    return step(state, body);
}

/**
 * A `map.load.reply` arrived: its items and seq replace the state, then the
 * buffered bodies above its seq are applied in seq order. A gap among them, or a
 * stale buffer, asks for one more reload.
 */
export function onLoad(state: ChangeState, reply: MapLoadReplyBody): ChangeStep {
    let next: ChangeState = { seq: reply.seq, loaded: true, buffer: [], stale: false, items: reply.items };
    if (state.stale) {
        return { state: { ...next, loaded: false }, action: 'reload' };
    }
    const buffered = [...state.buffer].sort((a, b) => a.seq - b.seq);
    for (let i = 0; i < buffered.length; i++) {
        const s = step(next, buffered[i]);
        if (s.action === 'reload') {
            return { state: { ...s.state, buffer: buffered.slice(i) }, action: 'reload' };
        }
        next = s.state;
    }
    return { state: next, action: 'apply' };
}

/** This session's own save: its record by the version rule; seq is not touched. */
export function onSaved(state: ChangeState, record: MapItemRecord): ChangeState {
    const items = applyRecord(state.items, record);
    return items === state.items ? state : { ...state, items };
}

/**
 * The store delegate's change handling, apart from Perspective so it is unit
 * tested in node: holds the state, sends map.load through `sendLoad` (at mount,
 * and once per gap, never a second while one is pending) and counts the gap
 * reloads. Each method returns true when the items changed and must be redrawn.
 */
export class MapChanges {
    state: ChangeState = CHANGES_INITIAL;
    /** Reloads caused by a gap (the first map.load at mount is not one). */
    reloads = 0;
    /** True once a map.load.reply has arrived. */
    loadedOnce = false;
    private loadPending = false;
    /** True from a failed map.load until the next map.load.reply. */
    private loadFailedLast = false;

    constructor(private readonly sendLoad: () => void, private readonly onReload: (afterSeq: number) => void = () => {}) {
    }

    /** The map.load at mount (or any load not caused by a gap). */
    load(): void {
        this.loadPending = true;
        this.sendLoad();
    }

    /** The last seq applied, or null before the first map.load.reply. */
    get seq(): number | null {
        return this.loadedOnce ? this.state.seq : null;
    }

    loaded(reply: MapLoadReplyBody): boolean {
        this.loadPending = false;
        this.loadFailedLast = false;
        this.loadedOnce = true;
        const s = onLoad(this.state, reply);
        this.state = s.state;
        if (s.action === 'reload') {
            this.reload();
        }
        return true;
    }

    /**
     * map.load was answered with an error (the busy reply among them): the map stays
     * not loaded and changes keep buffering; the next map.changed retries the load once.
     */
    loadFailed(): void {
        this.loadPending = false;
        this.loadFailedLast = true;
    }

    /**
     * The delegate's 15 s retry while the last map.load failed (a quiet project sends no
     * map.changed to retry on): sends one map.load when none is pending; false otherwise.
     * Not counted in `reloads` (that counts gap reloads).
     */
    retryFailedLoad(): boolean {
        if (!this.loadFailedLast || this.loadPending) {
            return false;
        }
        this.load();
        return true;
    }

    /**
     * A map.changed. While not loaded after a failed map.load (nothing pending), it
     * starts one new reload, so a single refused load never leaves the map stale
     * until the page is reloaded; a load that fails again waits for the next change.
     */
    changed(body: MapChangedBody | null): boolean {
        const s = onChanged(this.state, body);
        this.state = s.state;
        if (s.action === 'reload' || (!this.state.loaded && this.loadFailedLast && !this.loadPending)) {
            this.reload();
        }
        return s.action === 'apply';
    }

    saved(record: MapItemRecord): boolean {
        const next = onSaved(this.state, record);
        const changed = next !== this.state;
        this.state = next;
        return changed;
    }

    private reload(): void {
        if (this.loadPending) {
            return;
        }
        this.reloads++;
        this.onReload(this.state.seq);
        this.load();
    }
}
