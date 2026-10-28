/**
 * Shared markers (epic 3 entry 7, R5; the template's docs/map.md section 5 item 8): two or more
 * point map items within SHARED_M of each other draw as one marker that opens a pick list. Pure:
 * a sweep by latitude groups the points, and the group takes the worst state of its members and
 * their names as one ("CTB1 and SWD1"). Unit tested in node.
 */

import { ItemState } from './live';

/** The distance within which points share one marker, in metres (the template's SHARED_M). */
export const SHARED_M = 20;
const EARTH_RADIUS_M = 6371008.8;
/** Metres per degree of latitude, for the sweep's window. */
const M_PER_DEG_LAT = (Math.PI / 180) * EARTH_RADIUS_M;

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

/** The names as one: "A", "A and B", "A, B and C". */
export function sharedName(names: string[]): string {
    if (names.length <= 1) {
        return names[0] || '';
    }
    return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
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
