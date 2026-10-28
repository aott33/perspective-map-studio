/**
 * The GeoJSON the map's sources draw (epic 3 entry 7): point markers (shared ones merged), lines
 * with their look, each line's midpoint mark (its name chip and alarm badge), the selected line's
 * flow arrow, and the bounds key Fit keeps by. Pure, unit tested in node; MapStudio.tsx hands the
 * result to the sources.
 */

import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';
import { Kind } from './adapters';
import { MapItemRecord } from './contract';
import { Position, instrumentsOn, lengthM, pointAt } from './geometry';
import { ItemState, LiveState, areaTint, itemState } from './live';
import {
    AreaProperties, LineProperties, MarkerColors, MarkerProperties, areaProperties, badgeImageId, labelRank, lineLook, lineProperties,
    markerProperties, stateWord
} from './markers';
import { groupShared, sharedName, sharedState } from './shared';

/** A line's midpoint mark: the name chip (with the state word when the line is abnormal) and the alarm badge. */
export interface LineMarkProperties {
    id: string;
    name: string;
    kind: string;
    /** The chip's text: the name, then the state word. */
    label: string;
    /** The badge image id of the line's alarm, or ''. */
    badge: string;
    rank: number;
    selected: boolean;
}

export interface ArrowProperties {
    id: string;
    /** Degrees clockwise from north along the line at the arrow. */
    bearing: number;
}

export interface MapFeatures {
    points: FeatureCollection<Point, MarkerProperties>;
    lines: FeatureCollection<LineString, LineProperties>;
    /** The items of area kinds (a line kind with `area: true`), closed, with their category tint (entry 1). */
    areas: FeatureCollection<Polygon, AreaProperties>;
    marks: FeatureCollection<Point, LineMarkProperties>;
    arrow: FeatureCollection<Point, ArrowProperties>;
    /** The items' bounds as "west,south,east,north" (6 decimals), or '' with no item. */
    boundsKey: string;
    bounds: [number, number, number, number] | null;
    /** How many markers stand for two or more items. */
    shared: number;
}

export interface Selection {
    id: string;
    kind: 'point' | 'line';
}

/** The bearing from a to b in degrees clockwise from north (0 to 360). */
export function bearingDeg(a: Position, b: Position): number {
    const toRad = (d: number): number => (d * Math.PI) / 180;
    const lat1 = toRad(a[1]);
    const lat2 = toRad(b[1]);
    const dLng = toRad(b[0] - a[0]);
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const deg = (Math.atan2(y, x) * 180) / Math.PI;
    return (deg + 360) % 360;
}

/** The place `fraction` of the way along a line and the bearing there (from 1 m before to 1 m after). */
export function alongLine(coords: Position[], fraction: number): { point: Position; bearing: number } {
    const total = lengthM(coords);
    const at = total * fraction;
    const point = pointAt(coords, at);
    const before = pointAt(coords, Math.max(0, at - 1));
    const after = pointAt(coords, Math.min(total, at + 1));
    return { point, bearing: bearingDeg(before, after) };
}

function pointFeature<P>(coordinates: Position, properties: P): Feature<Point, P> {
    return { type: 'Feature', properties, geometry: { type: 'Point', coordinates } };
}

/**
 * The features of the map store's items: points within SHARED_M share one marker with the worst
 * state and the names as one; a selected item takes its ring (a shared marker, when one of its
 * members is selected); lines take their look from their own live state, their `diameter`
 * property (inches) and whether an instrument is attached.
 */
export function buildFeatures(items: MapItemRecord[], kinds: Kind[], live: LiveState, selected: Selection | null,
                              colors: MarkerColors): MapFeatures {
    const kindById = new Map<string, Kind>();
    kinds.forEach((k) => kindById.set(k.id, k));
    const points: Array<Feature<Point, MarkerProperties>> = [];
    const lines: Array<Feature<LineString, LineProperties>> = [];
    const areas: Array<Feature<Polygon, AreaProperties>> = [];
    const marks: Array<Feature<Point, LineMarkProperties>> = [];
    const arrow: Array<Feature<Point, ArrowProperties>> = [];
    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;
    const extend = ([x, y]: Position): void => {
        west = Math.min(west, x);
        east = Math.max(east, x);
        south = Math.min(south, y);
        north = Math.max(north, y);
    };
    const stateOf = (item: MapItemRecord): ItemState => itemState(live.items[item.id], live.display[item.kind]);
    const live_: MapItemRecord[] = items.filter((i) => !i.deleted);
    const byId = new Map<string, MapItemRecord>();
    live_.forEach((i) => byId.set(i.id, i));

    const pointItems = live_.filter((i) => i.geometry.type === 'Point');
    const groups = groupShared(pointItems.map((i) => ({ id: i.id, name: i.name, lngLat: (i.geometry as Point).coordinates as Position })));
    let shared = 0;
    for (const group of groups) {
        const members = group.map((g) => byId.get(g.id)!);
        const first = members[0];
        const kind = kindById.get(first.kind);
        const isSelected = selected !== null && selected.kind === 'point' && members.some((m) => m.id === selected.id);
        const coords = (first.geometry as Point).coordinates as Position;
        members.forEach((m) => extend((m.geometry as Point).coordinates as Position));
        if (members.length === 1) {
            points.push(pointFeature(coords, markerProperties(first.id, first.name, first.kind, kind ? kind.icon : '', stateOf(first),
                { labelRank: kind ? kind.labelRank : 0, selected: isSelected })));
            continue;
        }
        shared++;
        const sorted = members.slice().sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        const state = sharedState(members.map(stateOf));
        const rank = Math.max(...members.map((m) => {
            const k = kindById.get(m.kind);
            return k ? k.labelRank : 0;
        }));
        points.push(pointFeature(coords, markerProperties('shared:' + sorted.map((m) => m.id).join(','), sharedName(sorted.map((m) => m.name)),
            first.kind, kind ? kind.icon : '', state, { labelRank: rank, selected: isSelected, members: sorted.map((m) => m.id) })));
    }

    for (const item of live_) {
        if (item.geometry.type !== 'LineString') {
            continue;
        }
        const coords = item.geometry.coordinates as Position[];
        coords.forEach(extend);
        const kind = kindById.get(item.kind);
        const state = stateOf(item);
        const isSelected = selected !== null && selected.kind === 'line' && selected.id === item.id;
        if (kind && kind.area) {
            // An area: a closed fill in its category tint (areas only, AD-11) and its outline; no pipeline look.
            if (coords.length >= 3) {
                const ring = coords.slice();
                const first = ring[0];
                const last = ring[ring.length - 1];
                if (first[0] !== last[0] || first[1] !== last[1]) {
                    ring.push(first);
                }
                areas.push({
                    type: 'Feature',
                    properties: areaProperties(item.id, item.name, item.kind, areaTint(live.display[item.kind], item.properties), colors, isSelected),
                    geometry: { type: 'Polygon', coordinates: [ring] }
                });
            }
            continue;
        }
        const look = lineLook(state, item.properties ? item.properties.diameter : undefined, instrumentsOn(live_, item.id).length > 0);
        lines.push({
            type: 'Feature',
            properties: lineProperties(item.id, item.name, item.kind, look, colors, isSelected),
            geometry: { type: 'LineString', coordinates: coords }
        });
        if (coords.length >= 2) {
            const mid = alongLine(coords, 0.5);
            const word = stateWord(state);
            marks.push(pointFeature(mid.point, {
                id: item.id, name: item.name, kind: item.kind,
                label: word ? item.name + ' ' + word : item.name,
                badge: look.badge ? badgeImageId(look.badge, look.priority, look.solid) : '',
                rank: labelRank(state, kind ? kind.labelRank : 0, isSelected),
                selected: isSelected
            }));
            if (isSelected) {
                // The arrow at the midpoint, or at the three-quarter point when the alarm badge holds the midpoint.
                const at = look.badge ? alongLine(coords, 0.75) : mid;
                arrow.push(pointFeature(at.point, { id: item.id, bearing: at.bearing }));
            }
        }
    }
    const bounds: MapFeatures['bounds'] = isFinite(west) ? [west, south, east, north] : null;
    return {
        points: { type: 'FeatureCollection', features: points },
        lines: { type: 'FeatureCollection', features: lines },
        areas: { type: 'FeatureCollection', features: areas },
        marks: { type: 'FeatureCollection', features: marks },
        arrow: { type: 'FeatureCollection', features: arrow },
        boundsKey: bounds ? bounds.map((n) => n.toFixed(6)).join(',') : '',
        bounds,
        shared
    };
}
