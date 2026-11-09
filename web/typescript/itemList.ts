/**
 * The item list's rows (epic 4 entry 2; EXPERIENCE.md Item list and State badge, DESIGN.md list-row
 * and state-badge): every live map item in one flat list, by name, each with its kind's glyph and
 * name and the worst of its live states as a badge from the same `values.batch` the markers draw
 * from (alarm over comms lost over stale over unlinked). The list's Search items field (entry 21,
 * DESIGN.md key screen 4) filters these rows by name, kind name or linked asset name, compared as the
 * View-mode search compares (search.ts `fold`: letter case and accents aside). From entry 6 (R3) an item linked to an asset
 * that is no longer in the asset list counts as unlinked too, the reason in its badge's title, once the asset list in use can
 * be checked against (itemForm.ts `assetListKnown`).
 *
 * Entry 7a (EXPERIENCE.md Item list, DESIGN.md list-row, group-header, filter-chip): `listRows` builds the rows (by name) with
 * each one's place, from its linked asset's base path, its attention rank and its last change; `groupRows` lays them out for
 * the chosen Sort by, kind Filter, Search items text and the session's Just added, as headers, dividers and rows with depth.
 * Pure functions only, unit tested in node.
 */

import { Asset, AssetName, Kind } from './adapters';
import { LastChange, MapItemRecord } from './contract';
import { LiveState, itemState } from './live';
import { rankOf } from './needsyou';
import { fold } from './search';
import { vanishedReason } from './itemForm';

export type ListBadge = 'alarm' | 'comms-lost' | 'stale' | 'unlinked' | 'normal';

/** The Search items field's placeholder (DESIGN.md key screen 4). */
export const LIST_SEARCH_PLACEHOLDER = 'Search items';

/** Its accessible name: what the field searches, which the placeholder does not say. */
export const LIST_SEARCH_LABEL = 'Search items by name, kind or asset';

export interface ListRow {
    id: string;
    name: string;
    kindId: string;
    /** The kind's display name, or its id when the kind list does not have it (an unknown kind, entry 6). */
    kindName: string;
    /** The kind's sprite glyph, '' when unknown. */
    icon: string;
    /** The linked asset's name, or null when the item is not linked or the asset is not listed (as search.ts `buildEntries`). */
    assetName: string | null;
    geometry: 'point' | 'line';
    badge: ListBadge;
    /** The badge's words ("Priority 1 alarm", "Comms lost", "Stale", "Unlinked"), '' when normal. */
    words: string;
    /** Why a linked item reads unlinked (entry 6: "P99 is no longer in the asset list"), '' otherwise. */
    reason: string;
    /** The alarm's priority and acknowledgement, for the glyph; null without an alarm. */
    alarm: { priority: 1 | 2 | 3; unacked: boolean } | null;
    /**
     * The linked asset's base path with the provider prefix dropped (`Mesa/P14/P14-2H`), null when the item is not linked, its
     * asset is gone or its path is not known (entry 7a: the item goes to Not linked).
     */
    assetPath: string | null;
    /** A line kind drawn as an area (entry 7a: with no parent item it goes to Field-wide, as a line does). */
    area: boolean;
    /** Who last changed it and when (map.load's `changed`, then this session's saves), null when not known. */
    changed: LastChange | null;
    /** Its Needs you rank when its state needs attention (alarm, comms lost, stale), null when it does not (needsyou.ts `rankOf`). */
    attention: number | null;
}

/** What `listRows` reads besides the items (entry 7a): the asset list with base paths and the items' last changes. */
export interface ListSources {
    assets?: readonly Asset[] | null;
    changed?: Readonly<Record<string, LastChange>>;
}

/** The badge's words, for the row and its accessible name. */
export function badgeWords(badge: ListBadge, priority: 1 | 2 | 3 | null): string {
    switch (badge) {
        case 'alarm':
            return 'Priority ' + (priority || 1) + ' alarm';
        case 'comms-lost':
            return 'Comms lost';
        case 'stale':
            return 'Stale';
        case 'unlinked':
            return 'Unlinked';
        default:
            return '';
    }
}

/**
 * The rows of the list: the live items by name (letter case and accents aside), each with its badge and the
 * name of the asset it is linked to, from `map.load.reply`'s `assetNames` (the lists' `assetNames`). With `assetsKnown` (the
 * asset list in use can be checked against, entry 6) an item whose asset is not among them is unlinked, with the reason.
 */
export function listRows(items: MapItemRecord[], kinds: Kind[], live: LiveState, assetNames: readonly AssetName[] = [],
    assetsKnown = false, sources: ListSources = {}): ListRow[] {
    const kindById = new Map<string, Kind>();
    kinds.forEach((k) => kindById.set(k.id, k));
    const assetById = new Map<string, string>();
    assetNames.forEach((a) => assetById.set(a.id, a.name));
    const pathById = new Map<string, string>();
    (sources.assets || []).forEach((a) => pathById.set(a.id, a.basePath));
    const changed = sources.changed || {};
    const rows: ListRow[] = [];
    for (const item of items) {
        if (item.deleted) {
            continue;
        }
        const kind = kindById.get(item.kind);
        const state = itemState(live.items[item.id], live.display[item.kind]);
        const assetName = item.assetId !== null ? assetById.get(item.assetId) : undefined;
        const vanished = item.assetId !== null && assetsKnown && assetName === undefined;
        const badge: ListBadge = state.alarm ? 'alarm' : state.commsLost ? 'comms-lost' : state.stale ? 'stale'
            : item.assetId === null || vanished ? 'unlinked' : 'normal';
        rows.push({
            id: item.id,
            name: item.name,
            kindId: item.kind,
            kindName: kind ? kind.name : item.kind,
            icon: kind ? kind.icon : '',
            assetName: assetName === undefined ? null : assetName,
            geometry: item.geometry.type === 'Point' ? 'point' : 'line',
            badge,
            words: badgeWords(badge, state.alarm ? state.alarm.priority : null),
            reason: vanished && item.assetId !== null ? vanishedReason(item.assetId) : '',
            alarm: state.alarm ? { priority: state.alarm.priority, unacked: state.alarm.unacked } : null,
            assetPath: item.assetId !== null && !vanished ? placePath(pathById.get(item.assetId)) : null,
            area: !!(kind && kind.area),
            changed: Object.prototype.hasOwnProperty.call(changed, item.id) ? changed[item.id] : null,
            attention: state.badge === 'normal' ? null : rankOf(state)
        });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id));
    return rows;
}

/**
 * The rows the Search items field keeps (entry 21): those whose name, kind name or linked asset name holds the
 * query, compared as the View-mode search compares (`fold`: lower case, accents stripped, one space between
 * words), in the order the list gives them. A query that folds to nothing keeps every row.
 */
export function filterRows(rows: readonly ListRow[], query: string): ListRow[] {
    const q = fold(query);
    if (q === '') {
        return rows.slice();
    }
    return rows.filter((row) => rowMatches(row, q));
}

/** Whether a row's name, kind name or asset name holds the folded query `q`. */
function rowMatches(row: ListRow, q: string): boolean {
    return fold(row.name).indexOf(q) >= 0 || fold(row.kindName).indexOf(q) >= 0
        || (row.assetName !== null && fold(row.assetName).indexOf(q) >= 0);
}

/**
 * An asset's base path as a place (entry 7a): the provider prefix `[...]` dropped, empty segments and the slashes around them
 * trimmed, `[default]Mesa/P14/` giving `Mesa/P14`; null for no path or one with no segment.
 */
export function placePath(basePath: string | undefined | null): string | null {
    if (typeof basePath !== 'string') {
        return null;
    }
    const segments = basePath.replace(/^\[[^\]]*\]/, '').split('/').map((p) => p.trim()).filter((p) => p !== '');
    return segments.length > 0 ? segments.join('/') : null;
}

/** The list's Sort by choices (entry 7a), Needs attention first (the default). */
export type ListSort = 'attention' | 'place' | 'kind' | 'name' | 'changed';

export const LIST_SORTS: ReadonlyArray<{ id: ListSort; label: string }> = [
    { id: 'attention', label: 'Needs attention' },
    { id: 'place', label: 'Place' },
    { id: 'kind', label: 'Kind' },
    { id: 'name', label: 'Name' },
    { id: 'changed', label: 'Last changed' }
];

/** A group header (`MESA FIELD`, "Field-wide", "Not linked", "Just added", a kind's name), with its right-hand words. */
export interface ListHeader {
    type: 'header';
    key: string;
    label: string;
    /** "4 NEED ATTENTION" on a field in the Needs attention sort, else ''. */
    right: string;
    /** 'group' for a top group (a field, Not linked, Just added, a kind), 'sub' for a field's Field-wide. */
    level: 'group' | 'sub';
}

/** The "All normal" divider of a field in the Needs attention sort. */
export interface ListDivider {
    type: 'divider';
    key: string;
    label: string;
}

/** One row as laid out: its depth under its site (0 for a site), and its second line. */
export interface ListEntry {
    type: 'row';
    key: string;
    row: ListRow;
    depth: number;
    /** "on P14" for a child row in the place sorts, "Sam - Today 10:42" in Last changed, else ''. */
    note: string;
    /** A row shown only so a matching child reads under its site (Search items), not a match itself. */
    context: boolean;
}

export type ListItem = ListHeader | ListDivider | ListEntry;

/** What `groupRows` lays out the rows by. */
export interface ListView {
    sort: ListSort;
    /** The kind the Filter keeps, or null for All. */
    kind: string | null;
    /** The Search items text. */
    query: string;
    /** The items this session added, newest first (the delegate's `justAdded`). */
    justAdded: readonly string[];
    /** The footer's unlinked filter: only the Not linked rows. */
    unlinkedOnly: boolean;
    /** The time "Today" and "Yesterday" are read against (Last changed). */
    now: Date;
}

export const FIELD_WIDE = 'Field-wide';
export const NOT_LINKED = 'Not linked';
export const JUST_ADDED = 'Just added';
export const ALL_NORMAL = 'All normal';

const byName = (a: ListRow, b: ListRow): number =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id);

/** A field's header words: the first path segment, upper case, "MESA FIELD". */
export function fieldLabel(field: string): string {
    return field.toUpperCase() + ' FIELD';
}

/** The field header's right side: "4 NEED ATTENTION" ('' for none). */
export function attentionLabel(count: number): string {
    return count > 0 ? count + ' NEED ATTENTION' : '';
}

/** The kind chips behind the Filter button (entry 7a): "All 11", then each kind on the map with its count, by name. */
export interface KindChip {
    /** The kind's id, null for All. */
    id: string | null;
    label: string;
    count: number;
}

export function kindChips(rows: readonly ListRow[]): KindChip[] {
    const counts = new Map<string, { label: string; count: number }>();
    for (const row of rows) {
        const c = counts.get(row.kindId);
        if (c) {
            c.count++;
        } else {
            counts.set(row.kindId, { label: row.kindName, count: 1 });
        }
    }
    const kinds: KindChip[] = Array.from(counts.entries()).map(([id, c]) => ({ id, label: c.label, count: c.count }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base', numeric: true }));
    const all: KindChip = { id: null, label: 'All', count: rows.length };
    return [all].concat(kinds);
}

/** How many rows go to Not linked (the footer's "N unlinked"): no asset path (not linked, a vanished asset). */
export function unlinkedCount(rows: readonly ListRow[]): number {
    return rows.filter((r) => r.assetPath === null).length;
}

/** "N unlinked" (the footer's button). */
export function unlinkedLabel(count: number): string {
    return count + ' unlinked';
}

function pad2(n: number): string {
    return n < 10 ? '0' + n : String(n);
}

/**
 * When a change was, as Last changed says it (entry 7a): "Today 10:42", "Yesterday 09:15", else the browser locale's short
 * date; local time. '' for a time that cannot be read.
 */
export function whenText(at: string, now: Date): string {
    const t = new Date(at);
    if (!isFinite(t.getTime())) {
        return '';
    }
    const day = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diff = Math.round((day(now) - day(t)) / 86400000);
    const time = pad2(t.getHours()) + ':' + pad2(t.getMinutes());
    if (diff === 0) {
        return 'Today ' + time;
    }
    if (diff === 1) {
        return 'Yesterday ' + time;
    }
    try {
        return t.toLocaleDateString(undefined, { dateStyle: 'short' } as Intl.DateTimeFormatOptions);
    } catch (err) {
        return t.toLocaleDateString();
    }
}

/** A row's Last changed line: "Sam - Today 10:42" (the time alone when no actor is named), '' when not known. */
export function changedText(changed: LastChange | null, now: Date): string {
    if (!changed) {
        return '';
    }
    const when = whenText(changed.at, now);
    if (when === '') {
        return changed.actor;
    }
    return changed.actor !== '' ? changed.actor + ' - ' + when : when;
}

/**
 * Each row's parent (entry 7a): the row whose asset path is the longest proper prefix of its own, segment by segment, among
 * `rows` (P14-2H's `Mesa/P14/P14-2H` under P14's `Mesa/P14`); absent with none.
 */
export function parentsOf(rows: readonly ListRow[]): Map<string, ListRow> {
    const byPath = new Map<string, ListRow>();
    for (const row of rows.slice().sort(byName)) {
        if (row.assetPath !== null && !byPath.has(row.assetPath)) {
            byPath.set(row.assetPath, row);
        }
    }
    const parents = new Map<string, ListRow>();
    for (const row of rows) {
        if (row.assetPath === null) {
            continue;
        }
        const segments = row.assetPath.split('/');
        for (let n = segments.length - 1; n >= 1; n--) {
            const parent = byPath.get(segments.slice(0, n).join('/'));
            if (parent && parent.id !== row.id) {
                parents.set(row.id, parent);
                break;
            }
        }
    }
    return parents;
}

/** An entry for a row at a depth. */
function entry(row: ListRow, depth: number, note: string, context: boolean, prefix: string): ListEntry {
    return { type: 'row', key: prefix + row.id, row, depth, note, context };
}

/** The best (lowest) attention rank of a row and every row under it, or null when none needs attention. */
function treeAttention(row: ListRow, children: Map<string, ListRow[]>): number | null {
    let best = row.attention;
    for (const child of children.get(row.id) || []) {
        const r = treeAttention(child, children);
        if (r !== null && (best === null || r < best)) {
            best = r;
        }
    }
    return best;
}

/**
 * The list laid out (entry 7a; EXPERIENCE.md Item list): the rows the kind Filter keeps (every sort), then the Search items
 * text (in the place sorts a matching child shows under its site row, which comes along as context, as does a parent the
 * Filter, the unlinked filter or Just added leaves out: parents are worked out from every row), then:
 *
 * - **Just added** first in every sort: the items this session added, newest first, and nowhere else.
 * - **Needs attention** (default) and **Place**: one group per field (`MESA FIELD`, the first segment of the asset path, by
 *   name), its sites (points with no parent item) with their children indented under them ("on P14"), then its **Field-wide**
 *   sub-group (lines and areas with no parent item); then **Not linked** (no asset path) after every field. Needs attention
 *   puts first the sites whose own or a child's state needs attention, ranked as Needs you ranks, the field header saying
 *   "N NEED ATTENTION", then an "All normal" divider and the rest by name; Place is the same groups by name with no divider.
 * - **Kind**: flat under one header per kind, by name. **Name**: flat A-Z. **Last changed**: flat, newest first ("Sam -
 *   Today 10:42" on each row), the rows with no known change last, by name.
 *
 * The footer's unlinked filter keeps the Not linked rows alone.
 */
export function groupRows(all: readonly ListRow[], view: ListView): ListItem[] {
    let rows = all.filter((r) => view.kind === null || r.kindId === view.kind);
    if (view.unlinkedOnly) {
        rows = rows.filter((r) => r.assetPath === null);
    }
    const q = fold(view.query);
    const matches = (r: ListRow): boolean => q === '' || rowMatches(r, q);
    const added = new Set(view.justAdded);
    const out: ListItem[] = [];
    const justAdded = view.justAdded.map((id) => rows.find((r) => r.id === id)).filter((r): r is ListRow => !!r && matches(r));
    if (justAdded.length > 0) {
        out.push({ type: 'header', key: 'h:just-added', label: JUST_ADDED, right: '', level: 'group' });
        justAdded.forEach((r) => out.push(entry(r, 0, '', false, 'j:')));
    }
    rows = rows.filter((r) => !added.has(r.id));
    if (view.sort === 'name' || view.sort === 'changed' || view.sort === 'kind') {
        const flat = rows.filter(matches);
        if (view.sort === 'name') {
            flat.sort(byName).forEach((r) => out.push(entry(r, 0, '', false, 'r:')));
        } else if (view.sort === 'changed') {
            const at = (r: ListRow): number => (r.changed ? Date.parse(r.changed.at) : NaN);
            flat.sort((a, b) => {
                const ta = at(a);
                const tb = at(b);
                if (isFinite(ta) && isFinite(tb) && ta !== tb) {
                    return tb - ta;
                }
                if (isFinite(ta) !== isFinite(tb)) {
                    return isFinite(ta) ? -1 : 1;
                }
                return byName(a, b);
            }).forEach((r) => out.push(entry(r, 0, changedText(r.changed, view.now), false, 'r:')));
        } else {
            const kinds = new Map<string, ListRow[]>();
            flat.forEach((r) => kinds.set(r.kindId, (kinds.get(r.kindId) || []).concat([r])));
            Array.from(kinds.values())
                .sort((a, b) => a[0].kindName.localeCompare(b[0].kindName, undefined, { sensitivity: 'base', numeric: true }))
                .forEach((group) => {
                    out.push({ type: 'header', key: 'h:kind:' + group[0].kindId, label: group[0].kindName, right: '', level: 'group' });
                    group.sort(byName).forEach((r) => out.push(entry(r, 0, '', false, 'r:')));
                });
        }
        return out;
    }
    // The place sorts: the tree among the rows the filters keep, then the search keeps a match and the rows above it.
    // The parents come from every row, before the filters: a parent the Filter, the unlinked filter or Just added leaves out
    // still holds its children, shown above them as context (as a search's), so a child never loses its place.
    const parents = parentsOf(all);
    const kept = new Set(rows.map((r) => r.id));
    const shown = new Set<string>();
    const contextOnly = new Set<string>();
    for (const r of rows) {
        if (!matches(r)) {
            continue;
        }
        shown.add(r.id);
        // A parent in Just added is never shown again here (one row per item): its children keep their indent and "on <parent>".
        for (let p = parents.get(r.id); p && !added.has(p.id) && !shown.has(p.id); p = parents.get(p.id)) {
            shown.add(p.id);
        }
    }
    all.forEach((r) => {
        if (shown.has(r.id) && !(kept.has(r.id) && matches(r))) {
            contextOnly.add(r.id);
        }
    });
    const visible = all.filter((r) => shown.has(r.id));
    const children = new Map<string, ListRow[]>();
    const tops: ListRow[] = [];
    for (const r of visible) {
        const p = parents.get(r.id);
        if (p && shown.has(p.id)) {
            children.set(p.id, (children.get(p.id) || []).concat([r]));
        } else {
            tops.push(r);
        }
    }
    const attention = view.sort === 'attention';
    const rank = new Map<string, number | null>();
    tops.forEach((r) => rank.set(r.id, attention ? treeAttention(r, children) : null));
    const ranked = (a: ListRow, b: ListRow): number => {
        const ra = rank.get(a.id);
        const rb = rank.get(b.id);
        const na = ra === null || ra === undefined;
        const nb = rb === null || rb === undefined;
        if (na !== nb) {
            return na ? 1 : -1;
        }
        if (!na && !nb && ra !== rb) {
            return (ra as number) - (rb as number);
        }
        return byName(a, b);
    };
    const pushTree = (r: ListRow, depth: number, parentName: string): void => {
        const up = depth === 0 ? parents.get(r.id) : undefined;
        if (up && added.has(up.id)) {
            // A top row whose parent heads Just added: indented under it, as a child, with no second row for the parent.
            pushTree(r, 1, up.name);
            return;
        }
        out.push(entry(r, depth, depth > 0 ? 'on ' + parentName : '', contextOnly.has(r.id), 'r:'));
        (children.get(r.id) || []).slice().sort(byName).forEach((c) => pushTree(c, depth + 1, r.name));
    };
    const fields = new Map<string, { sites: ListRow[]; wide: ListRow[] }>();
    const notLinked: ListRow[] = [];
    for (const r of tops) {
        if (r.assetPath === null) {
            notLinked.push(r);
            continue;
        }
        const field = r.assetPath.split('/')[0];
        const f = fields.get(field) || { sites: [], wide: [] };
        (r.geometry === 'point' && !r.area ? f.sites : f.wide).push(r);
        fields.set(field, f);
    }
    Array.from(fields.keys()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })).forEach((field) => {
        const f = fields.get(field) as { sites: ListRow[]; wide: ListRow[] };
        const needing = f.sites.concat(f.wide).filter((r) => rank.get(r.id) !== null && rank.get(r.id) !== undefined).length;
        out.push({ type: 'header', key: 'h:field:' + field, label: fieldLabel(field), right: attention ? attentionLabel(needing) : '', level: 'group' });
        const sites = f.sites.slice().sort(ranked);
        // The divider follows the sites needing attention: none of them, no divider (a Field-wide row may still be counted).
        let divided = !attention || !sites.some((r) => rank.get(r.id) !== null && rank.get(r.id) !== undefined);
        for (const site of sites) {
            if (!divided && (rank.get(site.id) === null || rank.get(site.id) === undefined)) {
                out.push({ type: 'divider', key: 'd:' + field, label: ALL_NORMAL });
                divided = true;
            }
            pushTree(site, 0, '');
        }
        if (f.wide.length > 0) {
            out.push({ type: 'header', key: 'h:wide:' + field, label: FIELD_WIDE, right: '', level: 'sub' });
            f.wide.slice().sort(ranked).forEach((r) => pushTree(r, 0, ''));
        }
    });
    if (notLinked.length > 0) {
        out.push({ type: 'header', key: 'h:not-linked', label: NOT_LINKED, right: '', level: 'group' });
        notLinked.slice().sort(ranked).forEach((r) => pushTree(r, 0, ''));
    }
    return out;
}

/**
 * The rows under a group header (epic 4 entry 8: "Select all in MESA FIELD", "Select all in group"), in the order shown: a field's
 * rows down to the next field or top group, its Field-wide rows included; a Field-wide or any other group's rows down to the next
 * header. Context rows (a site shown only so a matching child reads under it) are never taken. Empty for a key not in the layout.
 */
export function groupIds(items: readonly ListItem[], key: string): string[] {
    const at = items.findIndex((i) => i.type === 'header' && i.key === key);
    if (at < 0) {
        return [];
    }
    const head = items[at] as ListHeader;
    const field = head.key.indexOf('h:field:') === 0;
    const out: string[] = [];
    for (let j = at + 1; j < items.length; j++) {
        const item = items[j];
        if (item.type === 'header' && (!field || item.level === 'group')) {
            break;
        }
        if (item.type === 'row' && !item.context && out.indexOf(item.row.id) < 0) {
            out.push(item.row.id);
        }
    }
    return out;
}

/** The words of a header's Select all (entry 8): "Select all in MESA FIELD" under a field, "Select all in group" on any other. */
export function selectAllText(header: ListHeader): string {
    return header.key.indexOf('h:field:') === 0 ? 'Select all in ' + header.label : 'Select all in group';
}

/** "Select all in filter" (entry 8), above the list while a kind filter, the unlinked filter or a search is on. */
export const SELECT_ALL_IN_FILTER = 'Select all in filter';

/** The rows of a layout, in order (what the list's keyboard and counts read). */
export function entriesOf(items: readonly ListItem[]): ListEntry[] {
    return items.filter((i): i is ListEntry => i.type === 'row');
}
