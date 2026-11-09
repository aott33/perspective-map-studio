/**
 * Recent changes, the rail's History surface (epic-editing entry 11b, R18; DESIGN.md Recent changes panel, EXPERIENCE.md Recent
 * changes): the edit record that `edits.history` reads (entry 11a, contract.ts `HistoryEntry`) as rows of who, what in a sentence
 * and when, each with its values before and after and the batch that reverts it. Pure functions only, unit tested in node; the
 * delegate keeps the pages and sends (MapStudioStoreDelegate.ts), studio/HistoryPanel.tsx draws them.
 *
 * - One row per saved batch, newest first, never grouped (`mergeFirstPage`, `mergeOlderPage` keep the pages by `seq`).
 * - The sentence from the batch's ops (`batchSentence`): "Moved P14 about 40 m north", "Renamed P14 to P14 North", "Added well pad
 *   P40", "Deleted pipeline L-TEST and its 2 instruments in one change", "Changed 20 well pads in one change"; a batch that exactly
 *   reverses an older loaded one reads "Reverted "<its sentence>"" (`revertedOf`).
 * - Revert (`revertBatch`) is the batch's reverse, each op at the row's own `version` (after the op), so the Gateway's ordinary
 *   conflict check is the "changed since" rule: a create deleted, a delete created again from `before`, an update sending
 *   `before`'s fields. Not offered for a change from before the record kept values, nor one with a kind setup op (`revertBlocked`).
 */

import { Kind } from './adapters';
import { EditBatch, EditOp, HistoryEntry, HistoryOp, ItemGeometry, MapItemData } from './contract';
import { distanceM } from './shared';
import { distanceWords } from './linePopup';
import { clockText, fieldLabel, joinWords, moveWords } from './unsaved';

/** The page size Recent changes asks for (the most `edits.history` gives). */
export const HISTORY_PAGE = 50;

/** The note box's words with nothing to undo. */
export const NOTHING_TO_UNDO_YET = 'Nothing to undo yet';

/** The footer under the rows (DESIGN.md: a footer line explains Revert). */
export const REVERT_FOOTER = "Revert undoes that one change, including someone else's, and saves like any edit.";

/** Why a row has no Revert: a change saved before the record kept values. */
export const NOT_KEPT_TEXT = 'The values of this change were not kept, so it cannot be reverted.';

/** Why a row has no Revert: a kind setup, which changes from the Kinds screen. */
export const KIND_SETUP_TEXT = 'Kind setups change from the Kinds screen, so this change has no Revert.';

/** The fields of a map item an op's data may carry (undo.ts DATA_FIELDS), in record order. */
const DATA_FIELDS: Array<keyof MapItemData> = ['kind', 'name', 'geometry', 'properties', 'assetId', 'overrides', 'ends', 'attachment'];

/** What the surface holds of the edit record: the pages read so far, newest first, and the state of the reads. */
export interface HistoryState {
    /** Every entry read, newest first, one per `seq`. */
    entries: HistoryEntry[];
    /** Older batches remain beyond the last page read. */
    more: boolean;
    /** The cursor for "Show older" (the reader's `nextBefore`), or null. */
    nextBefore: number | null;
    /** Entries the first page could not read (a newer Gateway's op), and the older pages'. */
    unreadFirst: number;
    unreadOlder: number;
    /** The first page has answered once. */
    loaded: boolean;
    /** A read in flight: the first page, or an older one; null for none. */
    loading: 'first' | 'older' | null;
    /** A refused or failed read in words, '' for none, and which read it was. */
    error: string;
    errorOn: 'first' | 'older' | null;
}

export const HISTORY_EMPTY: HistoryState = {
    entries: [], more: false, nextBefore: null, unreadFirst: 0, unreadOlder: 0, loaded: false, loading: null, error: '', errorOn: null
};

/** One page of `edits.history.reply`. */
export interface HistoryPage {
    entries: HistoryEntry[];
    more: boolean;
    nextBefore: number | null;
    unread: number;
}

function bySeq(entries: HistoryEntry[]): HistoryEntry[] {
    const seen = new Map<number, HistoryEntry>();
    for (const e of entries) {
        seen.set(e.seq, e);
    }
    return Array.from(seen.values()).sort((a, b) => b.seq - a.seq);
}

/**
 * The first page answered (on open, and again on each `map.changed` while open): merged with what is loaded by `seq`, the older
 * pages kept. When the page does not reach the newest loaded entry (more batches came than a page holds), the loaded rows would
 * leave a gap, so the page replaces them.
 */
export function mergeFirstPage(state: HistoryState, page: HistoryPage): HistoryState {
    const base = { ...state, loaded: true, loading: null, error: state.errorOn === 'first' ? '' : state.error,
        errorOn: state.errorOn === 'first' ? null : state.errorOn, unreadFirst: page.unread };
    const newest = state.entries.length > 0 ? state.entries[0].seq : null;
    // Each saved batch takes the project's next seq, so a page whose oldest is the loaded newest's next joins it (a page closed
    // early by the 1,000-op cap included); one further on leaves batches between them unread.
    const gap = newest === null || (page.more && page.nextBefore !== null && page.nextBefore > newest + 1);
    if (gap) {
        return { ...base, entries: bySeq(page.entries), more: page.more, nextBefore: page.nextBefore, unreadOlder: 0 };
    }
    return { ...base, entries: bySeq(page.entries.concat(state.entries)) };
}

/** An older page answered ("Show older"): its rows after the loaded ones, its cursor the next. */
export function mergeOlderPage(state: HistoryState, page: HistoryPage): HistoryState {
    return {
        ...state, loading: null, error: state.errorOn === 'older' ? '' : state.error, errorOn: state.errorOn === 'older' ? null : state.errorOn,
        entries: bySeq(state.entries.concat(page.entries)), more: page.more, nextBefore: page.nextBefore,
        unreadOlder: state.unreadOlder + page.unread
    };
}

/** A read refused or with no answer: said in words; the rows loaded stay. */
export function failRead(state: HistoryState, which: 'first' | 'older', message: string): HistoryState {
    return { ...state, loading: null, error: message, errorOn: which };
}

/** The words of a refused or failed read, with what to do. */
export function readFailedText(which: 'first' | 'older', message: string): string {
    const what = which === 'first' ? 'Recent changes could not be read' : 'Older changes could not be read';
    const why = message.trim().replace(/\.$/, '');
    return what + (why !== '' ? ': ' + why : '') + '.';
}

/* --- Words ------------------------------------------------------------------------------------------------------------------ */

function kindOf(kinds: Kind[], id: string | null): Kind | undefined {
    return id === null ? undefined : kinds.find((k) => k.id === id);
}

/** A kind's name as it reads inside a sentence: "well pad" (an all-capitals word such as "CTB" is kept). */
function lowerName(name: string): string {
    return name.split(' ').map((w) => (w.length > 1 && w === w.toUpperCase() ? w : w.toLowerCase())).join(' ');
}

/** The kind's name in a sentence, from the kind list, else its id, else "item". */
export function kindWords(kinds: Kind[], id: string | null): string {
    const kind = kindOf(kinds, id);
    return kind ? lowerName(kind.name) : id !== null && id !== '' ? id : 'item';
}

/** The plural of a kind's words: "well pads", "batteries", "boxes". */
export function plural(words: string): string {
    if (/[^aeiou]y$/i.test(words)) {
        return words.slice(0, -1) + 'ies';
    }
    if (/(s|x|z|ch|sh)$/i.test(words)) {
        return words + 'es';
    }
    return words + 's';
}

/** "3 well pads", "1 well pad". */
function counted(n: number, words: string): string {
    return n + ' ' + (n === 1 ? words : plural(words));
}

function nameOf(op: HistoryOp): string {
    return op.name !== null && op.name !== '' ? op.name : 'an item';
}

/** An op from before the record kept values (map store schema 3): both null. */
export function notKept(op: HistoryOp): boolean {
    return op.before === null && op.after === null;
}

function changedKeys(op: HistoryOp): string[] {
    const keys = Object.keys(op.after || {}).concat(Object.keys(op.before || {}));
    return keys.filter((k, i) => keys.indexOf(k) === i);
}

function pointOf(g: unknown): [number, number] | null {
    const geometry = g as ItemGeometry | null;
    return geometry && geometry.type === 'Point' && Array.isArray(geometry.coordinates)
        ? geometry.coordinates as [number, number] : null;
}

function isLine(g: unknown): boolean {
    const geometry = g as ItemGeometry | null;
    return !!geometry && geometry.type === 'LineString';
}

function attachedTo(record: Record<string, unknown> | null): string | null {
    const a = record ? record.attachment as { lineId?: unknown } | null : null;
    return a && typeof a.lineId === 'string' ? a.lineId : null;
}

/** An update op in a sentence: what changed of one item. */
function updateSentence(op: HistoryOp, kinds: Kind[], locale: string, split: boolean): string {
    const name = nameOf(op);
    if (notKept(op)) {
        return 'Changed ' + name;
    }
    const before = op.before || {};
    const after = op.after || {};
    const keys = changedKeys(op);
    if (keys.length === 1 && keys[0] === 'name') {
        const was = typeof before.name === 'string' && before.name !== '' ? before.name : 'an item';
        return 'Renamed ' + was + ' to ' + (typeof after.name === 'string' && after.name !== '' ? after.name : 'an item');
    }
    if (keys.indexOf('geometry') >= 0 && keys.every((k) => k === 'geometry' || k === 'attachment' || k === 'ends')) {
        const from = pointOf(before.geometry);
        const to = pointOf(after.geometry);
        if (from && to) {
            return 'Moved ' + name + ' ' + moveWords(from, to, locale);
        }
        return (split ? 'Split ' : 'Reshaped ') + name;
    }
    if (keys.length === 1 && keys[0] === 'assetId') {
        return after.assetId === null || after.assetId === undefined ? 'Unlinked ' + name : 'Linked ' + name + ' to an asset';
    }
    if (keys.length === 1 && keys[0] === 'kind') {
        return 'Changed ' + name + "'s kind to " + kindWords(kinds, typeof after.kind === 'string' ? after.kind : null);
    }
    const words: string[] = [];
    for (const key of keys) {
        if (key === 'name') {
            words.push('name');
        } else if (key === 'kind') {
            words.push('kind');
        } else if (key === 'assetId') {
            words.push('asset link');
        } else if (key === 'geometry') {
            words.push(pointOf(after.geometry) ? 'location' : 'shape');
        } else if (key === 'properties') {
            const a = (before.properties || {}) as Record<string, unknown>;
            const b = (after.properties || {}) as Record<string, unknown>;
            const props = Object.keys(b).concat(Object.keys(a).filter((k) => !(k in b)));
            for (const p of props) {
                if (JSON.stringify(a[p]) !== JSON.stringify(b[p])) {
                    words.push(fieldLabel(kinds, op.kind || '', p));
                }
            }
        } else if (key === 'overrides') {
            words.push('style');
        } else if (key === 'ends') {
            words.push('ends');
        } else if (key === 'attachment') {
            words.push('place on its line');
        } else if (key === 'setup') {
            words.push('setup');
        }
    }
    return words.length > 0 ? 'Changed ' + name + "'s " + joinWords(words) : 'Changed ' + name;
}

function coordsOf(g: unknown): Array<[number, number]> | null {
    const geometry = g as ItemGeometry | null;
    return geometry && geometry.type === 'LineString' && Array.isArray(geometry.coordinates)
        ? geometry.coordinates as Array<[number, number]> : null;
}

function samePoint(a: [number, number] | undefined, b: [number, number] | null): boolean {
    return !!a && !!b && a[0] === b[0] && a[1] === b[1];
}

/**
 * An update that only follows the lead op of its batch: a line whose end sits on the moved lead item and moved with it, or an
 * instrument attached to the lead line (or to a line the batch split off it), kept on it. Any other update is a change of its own.
 */
function followsLead(op: HistoryOp, lead: HistoryOp, lineIds: Set<string>): boolean {
    if (op === lead || op.op !== 'update' || notKept(op)) {
        return false;
    }
    const before = op.before || {};
    const after = op.after || {};
    const from = pointOf((lead.before || {}).geometry);
    const to = pointOf((lead.after || {}).geometry);
    const was = coordsOf(before.geometry);
    const now = coordsOf(after.geometry);
    if (from && to && was && now && changedKeys(op).every((k) => k === 'geometry' || k === 'ends')) {
        const first = samePoint(was[0], from) && samePoint(now[0], to);
        const last = samePoint(was[was.length - 1], from) && samePoint(now[now.length - 1], to);
        return first || last;
    }
    const on = [attachedTo(after), attachedTo(before)].some((line) => line !== null && lineIds.has(line));
    return on && changedKeys(op).every((k) => k === 'geometry' || k === 'attachment');
}

/** The kind setups of a batch in words, for a sentence: "the well pad kind setup", "2 kind setups". */
function setupWords(setups: HistoryOp[], kinds: Kind[]): string {
    return setups.length === 1 ? 'the ' + kindWords(kinds, setups[0].kind || setups[0].id) + ' kind setup' : setups.length + ' kind setups';
}

/**
 * The batch in a sentence (EXPERIENCE.md Recent changes): its first map item op leads ("Moved P14 about 40 m north", "Renamed P14 to
 * P14 North", "Added well pad P40", "Deleted pipeline L-TEST and its 2 instruments in one change"); several items changed alike read
 * as a count ("Changed 20 well pads in one change", "Added 120 items in one change"); a kind setup as "Changed the well pad kind
 * setup". The name each op carries is the one used, so an old change reads the name the item had then.
 */
export function batchSentence(entry: HistoryEntry, kinds: Kind[] = [], locale: string = ''): string {
    const items = entry.ops.filter((o) => o.entity === 'item');
    const setups = entry.ops.filter((o) => o.entity === 'kindSetup');
    if (items.length === 0) {
        if (setups.length === 0) {
            return 'Saved a change with nothing in it';
        }
        return 'Changed ' + setupWords(setups, kinds) + (setups.length > 1 ? ' in one change' : '');
    }
    const sentence = itemSentence(entry, items, kinds, locale);
    // A batch with kind setups too names them, so a row never hides one.
    return setups.length === 0 ? sentence : sentence + ', and changed ' + setupWords(setups, kinds);
}

function itemSentence(entry: HistoryEntry, items: HistoryOp[], kinds: Kind[], locale: string): string {
    const lead = items[0];
    const sameKind = (ops: HistoryOp[]): string =>
        ops.every((o) => o.kind === ops[0].kind) ? kindWords(kinds, ops[0].kind) : 'item';
    if (items.every((o) => o.op === 'delete')) {
        const deleted = new Set(items.map((o) => o.id));
        const primary = items.filter((o) => {
            const line = attachedTo(o.before);
            return line === null || !deleted.has(line);
        });
        const instruments = items.length - primary.length;
        if (primary.length === 1) {
            const p = primary[0];
            const base = 'Deleted ' + kindWords(kinds, p.kind) + ' ' + nameOf(p);
            return instruments === 0 ? base
                : base + ' and its ' + (instruments === 1 ? 'instrument' : instruments + ' instruments') + ' in one change';
        }
        return 'Deleted ' + counted(primary.length, sameKind(primary)) + ' in one change';
    }
    const deletes = items.filter((o) => o.op === 'delete');
    const others = items.filter((o) => o.op !== 'delete');
    if (deletes.length > 0 && others.every((o) => o.op === 'update' && changedKeys(o).every((k) => k === 'ends'))) {
        // A delete that cleared the ends of lines that named the item (entry 25): the delete is the change.
        return itemSentence(entry, deletes, kinds, locale);
    }
    if (items.every((o) => o.op === 'create')) {
        if (items.length === 1) {
            return 'Added ' + kindWords(kinds, lead.kind) + ' ' + nameOf(lead);
        }
        return 'Added ' + counted(items.length, sameKind(items)) + ' in one change';
    }
    if (lead.op === 'create') {
        return 'Added ' + kindWords(kinds, lead.kind) + ' ' + nameOf(lead);
    }
    if (lead.op === 'update') {
        const split = items.some((o) => o.op === 'create' && isLine((o.after || {}).geometry)) && isLine((lead.after || {}).geometry);
        const lineIds = new Set([lead.id].concat(split ? items.filter((o) => o.op === 'create').map((o) => o.id) : []));
        const rest = items.filter((o) => o !== lead && !followsLead(o, lead, lineIds) && !(split && o.op === 'create'));
        if (rest.length === 0) {
            return updateSentence(lead, kinds, locale, split);
        }
        const all = [lead].concat(rest);
        if (all.every((o) => o.op === 'update')) {
            return 'Changed ' + counted(all.length, sameKind(all)) + ' in one change';
        }
        return 'Changed ' + counted(all.length, 'item') + ' in one change';
    }
    return 'Changed ' + counted(items.length, 'item') + ' in one change';
}

function same(a: unknown, b: unknown): boolean {
    return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
}

function dataOnly(record: Record<string, unknown> | null): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const f of DATA_FIELDS) {
        if (record && f in record) {
            out[f] = record[f];
        }
    }
    return out;
}

/** Whether `later`'s op exactly reverses `earlier`'s, with nothing saved to the item between them. */
function reversesOp(later: HistoryOp, earlier: HistoryOp): boolean {
    if (later.entity !== earlier.entity || later.id !== earlier.id || later.version !== earlier.version + 1
        || notKept(later) || notKept(earlier)) {
        return false;
    }
    if (earlier.op === 'create') {
        return later.op === 'delete';
    }
    if (earlier.op === 'delete') {
        return later.op === 'create' && same(dataOnly(later.after), dataOnly(earlier.before));
    }
    return later.op === 'update' && same(dataOnly(later.after), dataOnly(earlier.before))
        && same(dataOnly(later.before), dataOnly(earlier.after));
}

/** Whether `later` reverses the whole of `earlier` (a Revert, or an undo): every op of one undone by an op of the other. */
export function reverses(later: HistoryEntry, earlier: HistoryEntry): boolean {
    if (later.seq <= earlier.seq || later.ops.length !== earlier.ops.length || later.ops.length === 0) {
        return false;
    }
    return earlier.ops.every((e) => later.ops.some((l) => reversesOp(l, e)));
}

/** The older loaded entry `entry` reverses, or null: its row reads "Reverted "<that sentence>"". */
export function revertedOf(entry: HistoryEntry, entries: HistoryEntry[]): HistoryEntry | null {
    for (const e of entries) {
        if (e.seq < entry.seq && reverses(entry, e)) {
            return e;
        }
    }
    return null;
}

/** The row's sentence: its own, or "Reverted "..."" when it reverses an older loaded row. */
export function rowSentence(entry: HistoryEntry, entries: HistoryEntry[], kinds: Kind[] = [], locale: string = ''): string {
    const reverted = revertedOf(entry, entries);
    return reverted ? 'Reverted "' + batchSentence(reverted, kinds, locale) + '"' : batchSentence(entry, kinds, locale);
}

/** The undo step's words for a Revert (undoStack.ts labels: lower case after "Undo: "): "revert "Moved P31 about 40 m north"". */
export function revertLabel(sentence: string): string {
    return 'revert "' + sentence + '"';
}

/** Why a row has no Revert, in words, or '' when it has one. */
export function revertBlocked(entry: HistoryEntry): string {
    if (entry.ops.some((o) => o.entity === 'kindSetup')) {
        return KIND_SETUP_TEXT;
    }
    if (entry.ops.length === 0 || entry.ops.some(notKept)) {
        return NOT_KEPT_TEXT;
    }
    return '';
}

/**
 * The batch that reverts `entry` as one step (the Gateway's ordinary edit, no message of its own): each op at the row's `version`,
 * so a change saved since is refused `conflict` naming who made it. A create is deleted, a delete created again from `before` (a
 * restore at the tombstone's version), an update sends `before`'s fields. Null when Revert is not offered (`revertBlocked`).
 */
export function revertBatch(entry: HistoryEntry, batchId: string): EditBatch | null {
    if (revertBlocked(entry) !== '') {
        return null;
    }
    const ops: EditOp[] = [];
    for (const op of entry.ops) {
        if (op.op === 'create') {
            ops.push({ op: 'delete', entity: 'item', id: op.id, baseVersion: op.version });
        } else if (op.op === 'delete') {
            ops.push({ op: 'create', entity: 'item', id: op.id, baseVersion: op.version, data: dataOnly(op.before) as MapItemData });
        } else {
            const data: Record<string, unknown> = {};
            const before = op.before || {};
            for (const f of DATA_FIELDS) {
                if (f in before || (op.after && f in op.after)) {
                    data[f] = f in before ? before[f] : null;
                }
            }
            ops.push({ op: 'update', entity: 'item', id: op.id, baseVersion: op.version, data: data as MapItemData });
        }
    }
    return { batchId, ops };
}

/* --- Who and when ------------------------------------------------------------------------------------------------------------ */

/** The avatar's initial: the actor's first letter, upper case; "?" for none. */
export function initialOf(actor: string): string {
    const t = actor.trim();
    return t === '' ? '?' : t.charAt(0).toUpperCase();
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** When, in the browser's clock: "10:42" today, else "Nov 7, 10:42" (the year added when it is not this one); '' unreadable. */
export function whenText(iso: string, now: Date = new Date()): string {
    const t = Date.parse(iso);
    if (!isFinite(t)) {
        return '';
    }
    const d = new Date(t);
    const clock = clockText(iso);
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()) {
        return clock;
    }
    const day = MONTHS[d.getMonth()] + ' ' + d.getDate();
    return (d.getFullYear() === now.getFullYear() ? day : day + ' ' + d.getFullYear()) + ', ' + clock;
}

/* --- Expand: the values before and after ------------------------------------------------------------------------------------- */

/** One changed field: its label, and its value before and after in words. */
export interface ExpandField {
    label: string;
    before: string;
    after: string;
}

/** One op's part of an expanded row: the item (or kind setup) and its fields; `note` when the values cannot be shown. */
export interface ExpandOp {
    title: string;
    fields: ExpandField[];
    note: string;
}

const NOT_SET = 'Not set';

function coordText(p: [number, number]): string {
    return p[1].toFixed(6) + ', ' + p[0].toFixed(6);
}

function lengthM(coords: Array<[number, number]>, closed: boolean): number {
    let m = 0;
    for (let i = 1; i < coords.length; i++) {
        m += distanceM(coords[i - 1], coords[i]);
    }
    if (closed && coords.length > 2) {
        m += distanceM(coords[coords.length - 1], coords[0]);
    }
    return m;
}

/** A geometry in words: a point as latitude and longitude, a line or area as its points and length. */
export function geometryWords(g: unknown, area: boolean, locale: string = ''): string {
    const geometry = g as ItemGeometry | null;
    if (!geometry) {
        return NOT_SET;
    }
    const p = pointOf(geometry);
    if (p) {
        return coordText(p);
    }
    if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
        const coords = geometry.coordinates as Array<[number, number]>;
        return coords.length + ' points, ' + distanceWords(lengthM(coords, area), locale) + (area ? ' around' : '');
    }
    return 'A shape';
}

function plainWords(value: unknown): string {
    if (value === true) {
        return 'On';
    }
    if (value === false) {
        return 'Off';
    }
    if (value === null || value === undefined || value === '') {
        return NOT_SET;
    }
    if (typeof value === 'object') {
        const keys = Object.keys(value as Record<string, unknown>);
        return keys.length === 0 ? NOT_SET : keys.map((k) => k + ' ' + plainWords((value as Record<string, unknown>)[k])).join(', ');
    }
    return String(value);
}

interface NameLookup {
    kinds: Kind[];
    /** An asset's name by id (the host's asset names), else the id. */
    assetName: (id: string) => string;
    /** A map item's name by id (the loaded items), else ''. */
    itemName: (id: string) => string;
    locale: string;
}

function endsWords(value: unknown, look: NameLookup): string {
    const ends = value as { start?: { itemId?: string }; end?: { itemId?: string } } | null;
    if (!ends || (!ends.start && !ends.end)) {
        return 'Both floating';
    }
    const side = (e: { itemId?: string } | undefined): string => {
        if (!e || typeof e.itemId !== 'string') {
            return 'floating';
        }
        return look.itemName(e.itemId) || 'an item';
    };
    return 'Start ' + side(ends.start) + ', end ' + side(ends.end);
}

function attachmentWords(value: unknown, look: NameLookup): string {
    const a = value as { lineId?: string; distanceM?: number } | null;
    if (!a || typeof a.lineId !== 'string') {
        return NOT_SET;
    }
    const along = typeof a.distanceM === 'number' ? distanceWords(a.distanceM, look.locale) + ' along ' : 'On ';
    return along + (look.itemName(a.lineId) || 'its line');
}

/** The fields one op changed, with their labels and their values before and after in words. */
function fieldsOf(op: HistoryOp, look: NameLookup): ExpandField[] {
    const before = op.before || {};
    const after = op.after || {};
    const kindId = typeof after.kind === 'string' ? after.kind : typeof before.kind === 'string' ? before.kind : op.kind;
    const area = !!(kindOf(look.kinds, kindId) || { area: false }).area;
    const shown = op.op === 'update' ? changedKeys(op) : DATA_FIELDS.filter((f) => f in (op.op === 'create' ? after : before));
    const fields: ExpandField[] = [];
    const empty = op.op === 'create' ? 'Not on the map' : '';
    const gone = op.op === 'delete' ? 'Deleted' : '';
    const pick = (record: Record<string, unknown>, key: string, side: 'before' | 'after'): unknown =>
        (side === 'before' && op.op === 'create') || (side === 'after' && op.op === 'delete') ? undefined : record[key];
    const words = (key: string, value: unknown, side: 'before' | 'after'): string => {
        if (side === 'before' && empty !== '') {
            return empty;
        }
        if (side === 'after' && gone !== '') {
            return gone;
        }
        if (key === 'geometry') {
            return geometryWords(value, area, look.locale);
        }
        if (key === 'kind') {
            const kind = kindOf(look.kinds, typeof value === 'string' ? value : null);
            return kind ? kind.name : plainWords(value);
        }
        if (key === 'assetId') {
            return typeof value === 'string' && value !== '' ? look.assetName(value) : 'Not linked';
        }
        if (key === 'ends') {
            return endsWords(value, look);
        }
        if (key === 'attachment') {
            return attachmentWords(value, look);
        }
        return plainWords(value);
    };
    for (const key of shown) {
        if (key === 'properties') {
            const a = (pick(before, key, 'before') || {}) as Record<string, unknown>;
            const b = (pick(after, key, 'after') || {}) as Record<string, unknown>;
            const props = Object.keys(b).concat(Object.keys(a).filter((k) => !(k in b)));
            for (const p of props) {
                if (op.op === 'update' && same(a[p], b[p])) {
                    continue;
                }
                const label = fieldLabel(look.kinds, kindId || '', p);
                fields.push({ label, before: empty || plainWords(a[p]), after: gone || plainWords(b[p]) });
            }
            continue;
        }
        if (key === 'overrides') {
            const a = (pick(before, key, 'before') || {}) as Record<string, unknown>;
            const b = (pick(after, key, 'after') || {}) as Record<string, unknown>;
            if (op.op !== 'update' && Object.keys(op.op === 'create' ? b : a).length === 0) {
                continue;
            }
            fields.push({ label: 'Style', before: empty || plainWords(a), after: gone || plainWords(b) });
            continue;
        }
        if ((key === 'ends' || key === 'attachment' || key === 'assetId') && op.op !== 'update') {
            const value = op.op === 'create' ? after[key] : before[key];
            if (value === null || value === undefined) {
                continue;
            }
        }
        const label = key === 'geometry' ? (pointOf(after.geometry || before.geometry) ? 'Location' : 'Shape')
            : key === 'assetId' ? 'Asset link' : key === 'attachment' ? 'Place on line'
                : key === 'setup' ? 'Setup' : key.charAt(0).toUpperCase() + key.slice(1);
        fields.push({ label, before: words(key, pick(before, key, 'before'), 'before'), after: words(key, pick(after, key, 'after'), 'after') });
    }
    return fields;
}

/** The row expanded: per op the item and the fields it changed, before and after (B3), or why they cannot be shown (B7). */
export function expandOps(entry: HistoryEntry, look: Partial<NameLookup> = {}): ExpandOp[] {
    const full: NameLookup = {
        kinds: look.kinds || [],
        assetName: look.assetName || ((id) => id),
        itemName: look.itemName || (() => ''),
        locale: look.locale || ''
    };
    return entry.ops.map((op) => {
        if (op.entity === 'kindSetup') {
            return { title: 'The ' + kindWords(full.kinds, op.kind || op.id) + ' kind setup', fields: [], note: KIND_SETUP_TEXT };
        }
        const verb = op.op === 'create' ? 'Added' : op.op === 'delete' ? 'Deleted' : 'Changed';
        const title = nameOf(op) + ' (' + kindWords(full.kinds, op.kind) + ') - ' + verb.toLowerCase();
        if (notKept(op)) {
            return { title, fields: [], note: 'The values were not kept for this change (saved before the record kept them).' };
        }
        const fields = fieldsOf(op, full);
        return { title, fields, note: fields.length === 0 ? 'Nothing it changed can be shown.' : '' };
    });
}

/* --- Rows -------------------------------------------------------------------------------------------------------------------- */

/** One row of Recent changes as the panel draws it. */
export interface HistoryRowData {
    seq: number;
    batchId: string;
    actor: string;
    initial: string;
    when: string;
    sentence: string;
    /** Why there is no Revert, in words, or '' when there is one. */
    blocked: string;
    /** How many ops the batch holds. */
    ops: number;
}

/** The rows, newest first, one per batch. */
export function historyRows(entries: HistoryEntry[], kinds: Kind[] = [], locale: string = '', now: Date = new Date()): HistoryRowData[] {
    return entries.map((e) => ({
        seq: e.seq,
        batchId: e.batchId,
        actor: e.actor,
        initial: initialOf(e.actor),
        when: whenText(e.at, now),
        sentence: rowSentence(e, entries, kinds, locale),
        blocked: revertBlocked(e),
        ops: e.ops.length
    }));
}

/** The note box: "Next undo is one step: Undo: edit 3 pads", or "Nothing to undo yet". */
export function nextUndoText(lastStep: string): string {
    return lastStep === '' ? NOTHING_TO_UNDO_YET : 'Next undo is one step: Undo: ' + lastStep;
}

/** "Show older" is offered while older batches remain and their cursor is known. */
export function canShowOlder(state: HistoryState): boolean {
    return state.more && state.nextBefore !== null;
}

/** The words for entries the reader could not read (a newer Gateway's op), or ''. */
export function unreadText(state: HistoryState): string {
    const n = state.unreadFirst + state.unreadOlder;
    return n === 0 ? '' : n + (n === 1 ? ' change' : ' changes') + ' could not be read by this version and are not listed.';
}
