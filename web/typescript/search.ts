/**
 * The search's pure part (epic 3 entry 9, R4; EXPERIENCE.md Search, DESIGN.md search-field): the
 * entries built from the loaded map (every live map item with its kind and the name of the asset it
 * is linked to, from `assetNames`), and the query over them. A query matches a map item by its name or
 * by its linked asset's name, without regard to letter case or accents; the results are ranked by
 * where the match is (a name that starts with the query first, then an asset name that does, then a
 * name that holds it, then an asset name that does), by name within each, and capped. Everything
 * runs in the browser from what map.load gave it: no message goes to the Gateway. Unit tested in node.
 */

import { AssetName, Kind } from './adapters';
import { MapItemRecord } from './contract';

/** How many results the list shows at most. */
export const SEARCH_LIMIT = 8;

/** The zoom a chosen point is shown at, at least: the kind glyph, the name and the icon KPI are all drawn from 15. */
export const CHOSEN_POINT_ZOOM = 15;

/** The field's placeholder (DESIGN.md search-field). */
export const SEARCH_PLACEHOLDER = 'Search sites, wells or lines';

/** What the list says with a query that matches nothing (EXPERIENCE.md, "No search results"). */
export const NO_MATCHES = 'No matches';

/** One map item as the search knows it. */
export interface SearchEntry {
    id: string;
    name: string;
    kindId: string;
    /** The kind's display name, or its id when the kind list does not have it. */
    kindName: string;
    /** The kind's icon id, for the row's glyph ('' when none). */
    icon: string;
    geometry: 'point' | 'line';
    /** A line kind drawn as an area. */
    area: boolean;
    /** The linked asset's name, or null when the item is not linked (or the asset is not listed). */
    assetName: string | null;
}

/** A result: the entry and how it matched. */
export interface SearchResult extends SearchEntry {
    matched: 'name' | 'asset';
    /** The row's second line: the kind, or the kind and the asset when the asset matched. */
    detail: string;
}

/**
 * The text as the search compares it: lower case, accents stripped (NFD, the combining marks
 * removed), and one space between words.
 */
export function fold(text: string): string {
    let s = text;
    if (typeof s.normalize === 'function') {
        s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    }
    return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** The entries of the loaded map: every live item, its kind's words and its asset's name. */
export function buildEntries(items: readonly MapItemRecord[], kinds: readonly Kind[], assetNames: readonly AssetName[]): SearchEntry[] {
    const kindById = new Map<string, Kind>();
    for (const kind of kinds) {
        kindById.set(kind.id, kind);
    }
    const assetById = new Map<string, string>();
    for (const asset of assetNames) {
        assetById.set(asset.id, asset.name);
    }
    const out: SearchEntry[] = [];
    for (const item of items) {
        if (item.deleted) {
            continue;
        }
        const kind = kindById.get(item.kind);
        const assetName = item.assetId !== null ? assetById.get(item.assetId) : undefined;
        out.push({
            id: item.id,
            name: item.name,
            kindId: item.kind,
            kindName: kind ? kind.name : item.kind,
            icon: kind ? kind.icon : '',
            geometry: item.geometry.type === 'Point' ? 'point' : 'line',
            area: !!(kind && kind.area),
            assetName: assetName === undefined ? null : assetName
        });
    }
    return out;
}

/** The rank of one entry against a folded query: 0 to 3 as described above, or -1 for no match. */
function rank(entry: SearchEntry, query: string): { tier: number; matched: 'name' | 'asset' } | null {
    const name = fold(entry.name);
    const asset = entry.assetName === null ? '' : fold(entry.assetName);
    if (name.startsWith(query)) {
        return { tier: 0, matched: 'name' };
    }
    if (asset !== '' && asset.startsWith(query)) {
        return { tier: 1, matched: 'asset' };
    }
    if (name.indexOf(query) >= 0) {
        return { tier: 2, matched: 'name' };
    }
    if (asset !== '' && asset.indexOf(query) >= 0) {
        return { tier: 3, matched: 'asset' };
    }
    return null;
}

/** The row's second line: the kind, or the kind and the asset when the asset matched. */
export function resultDetail(entry: SearchEntry, matched: 'name' | 'asset'): string {
    if (matched === 'asset' && entry.assetName !== null) {
        return entry.kindName + ' - ' + entry.assetName;
    }
    return entry.kindName;
}

/** The results for a query: an empty query gives none; at most `limit`, ranked as described above. */
export function searchEntries(entries: readonly SearchEntry[], query: string, limit = SEARCH_LIMIT): SearchResult[] {
    const q = fold(query);
    if (q === '') {
        return [];
    }
    const ranked: Array<{ entry: SearchEntry; tier: number; matched: 'name' | 'asset'; key: string }> = [];
    for (const entry of entries) {
        const r = rank(entry, q);
        if (r) {
            ranked.push({ entry, tier: r.tier, matched: r.matched, key: fold(entry.name) });
        }
    }
    ranked.sort((a, b) => {
        if (a.tier !== b.tier) {
            return a.tier - b.tier;
        }
        if (a.key !== b.key) {
            return a.key < b.key ? -1 : 1;
        }
        return a.entry.id < b.entry.id ? -1 : a.entry.id > b.entry.id ? 1 : 0;
    });
    return ranked.slice(0, Math.max(0, limit)).map((r) => ({ ...r.entry, matched: r.matched, detail: resultDetail(r.entry, r.matched) }));
}

/** The words the live region says after a choice. */
export function chosenText(entry: SearchEntry): string {
    return entry.name + ' selected';
}
