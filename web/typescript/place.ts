/**
 * The map's place for the browser session (owner re-test R4 (a), 0.3.0): the centre, the zoom, the selected
 * item and whether its popup is open, remembered per project, page path and component, so a page round trip
 * (View alarms to the alarm page and the browser's back, or any other page and back) opens the map where it
 * was with the card still open. `sessionStorage`, so a new browser session (or another tab) starts from the
 * page's starting area. A browser that refuses storage (a private window, blocked site data) keeps nothing
 * and the map opens on its starting area as before. Pure apart from the store it is handed; unit tested in node.
 */

import { isRecord } from './json';

/** The selected item the place keeps: a point, or a line with the segment its popup showed. */
export interface PlaceSelection {
    id: string;
    kind: 'point' | 'line';
    /** A line popup's segment (its two instruments), or null. */
    segment: { fromId: string; toId: string } | null;
}

export interface Place {
    center: [number, number];
    zoom: number;
    selected: PlaceSelection | null;
    /** True when the selected item's popup (card, sheet or line card) was open. */
    popup: boolean;
    /** Where a line's popup was anchored (the clicked point on the line), or null. */
    popupAt: [number, number] | null;
}

/** The part of `Storage` the place uses (sessionStorage in the browser, a map in the tests). */
export interface PlaceStore {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

const PREFIX = 'mapstudio.place.v1|';

/** The key of one map's place: the project, the page path and the component's address on the page. */
export function placeKey(project: string | null, pagePath: string, address: string): string {
    return PREFIX + (project || '') + '|' + pagePath + '|' + address;
}

function finite(v: unknown): v is number {
    return typeof v === 'number' && isFinite(v);
}

function lngLatOf(v: unknown): [number, number] | null {
    return Array.isArray(v) && v.length === 2 && finite(v[0]) && finite(v[1])
        && v[0] >= -180 && v[0] <= 180 && v[1] >= -85.06 && v[1] <= 85.06 ? [v[0], v[1]] : null;
}

/** A stored place read back, or null when there is none or it does not read as one (never trusted blindly). */
export function parsePlace(raw: string | null): Place | null {
    if (!raw) {
        return null;
    }
    let value: unknown;
    try {
        value = JSON.parse(raw);
    } catch (err) {
        return null;
    }
    if (!isRecord(value)) {
        return null;
    }
    const center = lngLatOf(value.center);
    if (!center || !finite(value.zoom) || value.zoom < 0 || value.zoom > 24) {
        return null;
    }
    let selected: PlaceSelection | null = null;
    const s = value.selected;
    if (isRecord(s) && typeof s.id === 'string' && s.id !== '' && (s.kind === 'point' || s.kind === 'line')) {
        const seg = s.segment;
        const segment = s.kind === 'line' && isRecord(seg) && typeof seg.fromId === 'string' && typeof seg.toId === 'string'
            ? { fromId: seg.fromId, toId: seg.toId } : null;
        selected = { id: s.id, kind: s.kind, segment };
    }
    const popup = selected !== null && value.popup === true;
    return { center, zoom: value.zoom, selected, popup, popupAt: popup ? lngLatOf(value.popupAt) : null };
}

/** The place stored under `key`, or null (none, unreadable, or a store that refuses). */
export function readPlace(store: PlaceStore | null, key: string): Place | null {
    try {
        return store ? parsePlace(store.getItem(key)) : null;
    } catch (err) {
        return null;
    }
}

/** Remember the place under `key`; a refusing store (private window, full) is ignored. */
export function writePlace(store: PlaceStore | null, key: string, place: Place): void {
    try {
        if (store) {
            store.setItem(key, JSON.stringify(place));
        }
    } catch (err) {
        // The place is a convenience: without storage the map opens on its starting area next time.
    }
}
