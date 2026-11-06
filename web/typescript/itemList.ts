/**
 * The item list's rows (epic 4 entry 2; EXPERIENCE.md Item list and State badge, DESIGN.md list-row
 * and state-badge): every live map item in one flat list, by name, each with its kind's glyph and
 * name and the worst of its live states as a badge from the same `values.batch` the markers draw
 * from (alarm over comms lost over stale over unlinked). The list's Search items field (entry 21,
 * DESIGN.md key screen 4) filters these rows by name, kind name or linked asset name, compared as the
 * View-mode search compares (search.ts `fold`: letter case and accents aside). The grouping by place,
 * the sort, the Filter chips and the footer are entry 7's. From entry 6 (R3) an item linked to an asset that is no longer in
 * the asset list counts as unlinked too, the reason in its badge's title, once the asset list in use can be checked against
 * (itemForm.ts `assetListKnown`). Pure functions only, unit tested in node.
 */

import { AssetName, Kind } from './adapters';
import { MapItemRecord } from './contract';
import { LiveState, itemState } from './live';
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
    assetsKnown = false): ListRow[] {
    const kindById = new Map<string, Kind>();
    kinds.forEach((k) => kindById.set(k.id, k));
    const assetById = new Map<string, string>();
    assetNames.forEach((a) => assetById.set(a.id, a.name));
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
            alarm: state.alarm ? { priority: state.alarm.priority, unacked: state.alarm.unacked } : null
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
    return rows.filter((row) => fold(row.name).indexOf(q) >= 0 || fold(row.kindName).indexOf(q) >= 0
        || (row.assetName !== null && fold(row.assetName).indexOf(q) >= 0));
}
