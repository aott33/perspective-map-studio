/**
 * Shared markers (epic 3 entry 7, R5; the template's docs/map.md section 5 item 8): two or more
 * point map items within SHARED_M of each other draw as one marker that opens a pick list. Pure:
 * a sweep by latitude groups the points, and the group takes the worst state of its members and
 * their names as one ("CTB1 and SWD1"; from three members "A, B +N more"). Unit tested in node.
 */

import { ItemState } from './live';

/** The distance within which points share one marker, in metres (the template's SHARED_M). */
export const SHARED_M = 20;
/**
 * Members this far apart on screen draw as their own markers (owner review notes item 20): the marker's
 * 44 px hit area, so a close zoom shows each item where it is (two items 15 m apart split from zoom 18).
 */
export const MARKER_APART_PX = 44;
const EARTH_RADIUS_M = 6371008.8;
/** Metres per degree of latitude, for the sweep's window. */
const M_PER_DEG_LAT = (Math.PI / 180) * EARTH_RADIUS_M;
/** The equator's length in metres, for the ground distance a pixel covers. */
const EQUATOR_M = 2 * Math.PI * EARTH_RADIUS_M;

/** The ground distance one screen pixel covers at a zoom and latitude, in metres (MapLibre's 512 px tiles). */
export function metresPerPixel(zoom: number, lat: number): number {
    return (EQUATOR_M * Math.cos((lat * Math.PI) / 180)) / (512 * Math.pow(2, zoom));
}

/**
 * The distance within which points share one marker at a zoom (item 20): 20 m, or less once 20 m is more
 * than a marker apart on screen, so a group splits as the user zooms in. Rounded to a tenth of a metre, so
 * a redraw happens only when the value moves.
 */
export function sharedWithinM(zoom: number, lat: number): number {
    const apart = MARKER_APART_PX * metresPerPixel(zoom, lat);
    return Math.round(Math.min(SHARED_M, apart) * 10) / 10;
}

/** The place a shared marker is drawn at: the members' centroid, the same whatever the store's order (item 20). */
export function sharedCentre(points: Array<{ lngLat: [number, number] }>): [number, number] {
    if (points.length === 0) {
        return [0, 0];
    }
    let lng = 0;
    let lat = 0;
    for (const p of points) {
        lng += p.lngLat[0];
        lat += p.lngLat[1];
    }
    return [lng / points.length, lat / points.length];
}

export interface SharedPoint {
    id: string;
    name: string;
    lngLat: [number, number];
}

/** The great-circle distance between two positions in metres (haversine, Turf's radius). */
export function distanceM(a: [number, number], b: [number, number]): number {
    const toRad = (d: number): number => (d * Math.PI) / 180;
    const dLat = toRad(b[1] - a[1]);
    const dLng = toRad(b[0] - a[0]);
    const lat1 = toRad(a[1]);
    const lat2 = toRad(b[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The groups of points within `withinM` of one another (a chain counts: A near B and B near C
 * share one marker), each group in the input's order; a point near none is a group of one.
 */
export function groupShared(points: SharedPoint[], withinM = SHARED_M): SharedPoint[][] {
    const n = points.length;
    const parent = points.map((_, i) => i);
    const find = (i: number): number => {
        while (parent[i] !== i) {
            parent[i] = parent[parent[i]];
            i = parent[i];
        }
        return i;
    };
    const union = (a: number, b: number): void => {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) {
            parent[Math.max(ra, rb)] = Math.min(ra, rb);
        }
    };
    const order = points.map((_, i) => i).sort((a, b) => points[a].lngLat[1] - points[b].lngLat[1]);
    const window = withinM / M_PER_DEG_LAT;
    for (let i = 0; i < n; i++) {
        const a = points[order[i]];
        for (let j = i + 1; j < n; j++) {
            const b = points[order[j]];
            if (b.lngLat[1] - a.lngLat[1] > window) {
                break;
            }
            if (distanceM(a.lngLat, b.lngLat) <= withinM) {
                union(order[i], order[j]);
            }
        }
    }
    const groups = new Map<number, SharedPoint[]>();
    for (let i = 0; i < n; i++) {
        const root = find(i);
        const group = groups.get(root);
        if (group) {
            group.push(points[i]);
        } else {
            groups.set(root, [points[i]]);
        }
    }
    return Array.from(groups.values());
}

/** How many member names a shared marker's label spells out; the rest are counted ("+N more"). */
export const SHARED_NAMES_SHOWN = 2;

/**
 * The names as one: "A", "A and B" (the template's rule for two), and from three members the first
 * two with the rest counted, "A, B +3 more", so five items on one spot no longer read as a five-line
 * list that crowds the map (epic 3 entry 11); the pick list keeps every member.
 */
export function sharedName(names: string[]): string {
    if (names.length <= 1) {
        return names[0] || '';
    }
    if (names.length === 2) {
        return names[0] + ' and ' + names[1];
    }
    return names.slice(0, SHARED_NAMES_SHOWN).join(', ') + ' +' + (names.length - SHARED_NAMES_SHOWN) + ' more';
}

/**
 * The worst state of the members: the highest alarm (unacknowledged over acknowledged at one
 * priority), else comms lost, else stale, else normal; a shared marker shows no KPI.
 */
export function sharedState(states: ItemState[]): ItemState {
    let alarm: ItemState['alarm'] = null;
    let commsLost = false;
    let stale = false;
    for (const s of states) {
        commsLost = commsLost || s.commsLost;
        stale = stale || s.stale;
        if (s.alarm && (!alarm || s.alarm.priority < alarm.priority
            || (s.alarm.priority === alarm.priority && s.alarm.unacked && !alarm.unacked))) {
            alarm = s.alarm;
        }
    }
    const badge: ItemState['badge'] = alarm ? 'alarm' : commsLost ? 'comms-lost' : stale ? 'stale' : 'normal';
    return { commsLost, stale, alarm, iconKpi: null, badge };
}
