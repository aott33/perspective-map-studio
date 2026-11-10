/**
 * The GeoJSON the map's sources draw (epic 3 entry 7): point markers (shared ones merged), lines
 * with their look, each line's midpoint mark (its name chip and alarm badge), the selected line's
 * flow arrow, and the bounds key Fit keeps by. Pure, unit tested in node; MapStudio.tsx hands the
 * result to the sources.
 *
 * Instruments on lines (entry 2; AD-11, AD-19): a line with instruments is cut into one feature per
 * segment between its measuring instruments (`lineNodes`, `splitAt`: derived from the attachments,
 * never stored), each drawn as the Gateway's `segments` slot grades it (the worst of its two end
 * instruments; the line's own alarm or comms lost still colours the whole line); a click lands on a
 * segment feature, whose `from` and `to` name the popup's segment. An instrument draws as its kind's
 * marker with the instrument disc at its place, and the two instruments at the open segment's ends
 * take the selection ring.
 */

import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';
import { Kind } from './adapters';
import { MapItemRecord } from './contract';
import { Position, instrumentsOn, lengthM, pointAt } from './geometry';
import { ItemState, LiveState, SEGMENT_END, SEGMENT_START, areaTint, iconKpiOf, itemState, segmentState } from './live';
import {
    AreaProperties, LineProperties, MarkerColors, MarkerProperties, areaProperties, badgeImageId, labelRank, lineLook, lineProperties,
    RANK_SELECTED, markerProperties, previewWord, stateWord
} from './markers';
import { SHARED_M, groupShared, sharedCentre, sharedName, sharedState } from './shared';

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

/** The selected line's geometry, which the arrow layer repeats the flow arrow along (item 22). */
export interface ArrowProperties {
    id: string;
}

/**
 * A floating end of the selected line (epic 4 entry 4; DESIGN.md Map line, EXPERIENCE.md Snap: snapped and
 * floating ends look different): a small mark in the selection token at an end that snaps to nothing, none
 * at a snapped one, whose item's marker already stands there. Read from `ends`, never from the coordinates (AD-19).
 */
export interface EndProperties {
    id: string;
    role: 'start' | 'end';
}

export interface MapFeatures {
    points: FeatureCollection<Point, MarkerProperties>;
    lines: FeatureCollection<LineString, LineProperties>;
    /** The items of area kinds (a line kind with `area: true`), closed, with their category tint (entry 1). */
    areas: FeatureCollection<Polygon, AreaProperties>;
    marks: FeatureCollection<Point, LineMarkProperties>;
    /** The selected line (one feature, its whole geometry), along which the flow arrow repeats. */
    arrow: FeatureCollection<LineString, ArrowProperties>;
    /** The selected line's floating ends (entry 4), one mark each; none for an area or a snapped end. */
    ends: FeatureCollection<Point, EndProperties>;
    /** The items' bounds as "west,south,east,north" (6 decimals), or '' with no item. */
    boundsKey: string;
    bounds: [number, number, number, number] | null;
    /** How many markers stand for two or more items. */
    shared: number;
    /** Where each member of a shared marker is drawn (the group's centroid), by item id; a popup anchors there (item 20). */
    anchors: Record<string, [number, number]>;
    /** How many line items the line features stand for (a line with instruments is several features). */
    lineItems: number;
}

/** The two nodes round the clicked spot of a line (AD-7): instrument ids, snapped end item ids, or `start` and `end`. */
export interface SegmentRef {
    fromId: string;
    toId: string;
}

export interface Selection {
    id: string;
    kind: 'point' | 'line';
    /** The open segment of a selected line (entry 2): its two end instruments are highlighted. */
    segment?: SegmentRef | null;
}

/** One node of a line in order: the item its start snaps to (or the floating start), each instrument, the end. */
export interface LineNode {
    /** The map item's id, or `start` and `end` for a floating end. */
    id: string;
    role: 'start' | 'end' | 'instrument';
    distanceM: number;
    /** An instrument whose kind setup names an icon KPI bounds a segment (decision 1); the ends never do. */
    measures: boolean;
}

/**
 * The line's nodes (entry 2): the start (the snapped item's id, else `start`), the attached instruments
 * in order of distance with whether each measures (`iconKpiOf` its kind's display), and the end.
 */
export function lineNodes(line: MapItemRecord, instruments: MapItemRecord[], live: LiveState, lineLengthM: number): LineNode[] {
    const ends = line.ends || {};
    const nodes: LineNode[] = [{ id: ends.start ? ends.start.itemId : SEGMENT_START, role: 'start', distanceM: 0, measures: false }];
    for (const i of instruments) {
        nodes.push({
            id: i.id, role: 'instrument', distanceM: i.attachment ? i.attachment.distanceM : 0,
            measures: iconKpiOf(live.display[i.kind]) !== null
        });
    }
    nodes.push({ id: ends.end ? ends.end.itemId : SEGMENT_END, role: 'end', distanceM: lineLengthM, measures: false });
    return nodes;
}

/** The nodes that bound segments: the ends and the measuring instruments. */
export function segmentNodes(nodes: LineNode[]): LineNode[] {
    return nodes.filter((n) => n.role !== 'instrument' || n.measures);
}

/** The segment a distance along the line falls in: the two bounding nodes round it. */
export function segmentAt(nodes: LineNode[], distanceM: number): SegmentRef {
    const bounds = segmentNodes(nodes);
    for (let i = 1; i < bounds.length - 1; i++) {
        if (distanceM < bounds[i].distanceM) {
            return { fromId: bounds[i - 1].id, toId: bounds[i].id };
        }
    }
    return { fromId: bounds[Math.max(0, bounds.length - 2)].id, toId: bounds[bounds.length - 1].id };
}

/**
 * The line's coordinates cut at the given distances (ascending, in metres from the first vertex) into
 * one piece per segment, each piece keeping the vertices between its cuts; a cut at or past an end
 * yields a piece of two equal points, so every segment stays a drawable feature.
 */
export function splitAt(coords: Position[], cuts: number[]): Position[][] {
    const total = lengthM(coords);
    const pieces: Position[][] = [];
    let piece: Position[] = [coords[0]];
    let travelled = 0;
    let cutIndex = 0;
    for (let i = 0; i + 1 < coords.length; i++) {
        const step = lengthM([coords[i], coords[i + 1]]);
        while (cutIndex < cuts.length && cuts[cutIndex] <= travelled + step) {
            const at = Math.min(total, Math.max(0, cuts[cutIndex]));
            const p = pointAt(coords, at);
            piece.push(p);
            pieces.push(piece);
            piece = [p];
            cutIndex++;
        }
        travelled += step;
        piece.push(coords[i + 1]);
    }
    while (cutIndex < cuts.length) {
        const last = coords[coords.length - 1];
        pieces.push(piece);
        piece = [last, last];
        cutIndex++;
    }
    pieces.push(piece);
    return pieces;
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
 * property (inches) and whether an instrument is attached. `withinM` is the sharing distance at the
 * map's zoom (shared.ts `sharedWithinM`, owner review notes item 20): 20 m until 20 m is more than a
 * marker apart on screen. `previewId` is the preview item of the kind whose setup is open (epic 4 entry 12b2), or null: a point
 * with a marker of its own reads "Preview" in its chip in place of its state word (the ring, the badge and the preset drawn
 * as ever, its labels placed first), a line's label its name and "Preview"; Stale and Comms lost keep their own word, a shared marker keeps the
 * group's chip, and an area carries no word.
 */
export function buildFeatures(items: MapItemRecord[], kinds: Kind[], live: LiveState, selected: Selection | null,
                              colors: MarkerColors, withinM: number = SHARED_M, set: readonly string[] = [],
                              previewId: string | null = null): MapFeatures {
    // A selection of several (epic 4 entry 8): every item in the set takes today's ring or casing; an area in it its casing.
    const inSet = new Set(set);
    const kindById = new Map<string, Kind>();
    kinds.forEach((k) => kindById.set(k.id, k));
    const points: Array<Feature<Point, MarkerProperties>> = [];
    const lines: Array<Feature<LineString, LineProperties>> = [];
    const areas: Array<Feature<Polygon, AreaProperties>> = [];
    const marks: Array<Feature<Point, LineMarkProperties>> = [];
    const arrow: Array<Feature<LineString, ArrowProperties>> = [];
    const ends: Array<Feature<Point, EndProperties>> = [];
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
    // The two instruments at the open segment's ends take the selection ring (entry 2).
    const highlighted = new Set<string>();
    if (selected && selected.kind === 'line' && selected.segment) {
        highlighted.add(selected.segment.fromId);
        highlighted.add(selected.segment.toId);
    }
    let lineItems = 0;

    const pointItems = live_.filter((i) => i.geometry.type === 'Point');
    const groups = groupShared(pointItems.map((i) => ({ id: i.id, name: i.name, lngLat: (i.geometry as Point).coordinates as [number, number] })),
        withinM);
    let shared = 0;
    const anchors: Record<string, [number, number]> = {};
    for (const group of groups) {
        const members = group.map((g) => byId.get(g.id)!);
        const first = members[0];
        const kind = kindById.get(first.kind);
        const isSelected = (selected !== null && selected.kind === 'point' && members.some((m) => m.id === selected.id))
            || members.some((m) => highlighted.has(m.id) || inSet.has(m.id));
        members.forEach((m) => extend((m.geometry as Point).coordinates as Position));
        if (members.length === 1) {
            const state = stateOf(first);
            const properties = markerProperties(first.id, first.name, first.kind, kind ? kind.icon : '', state,
                { labelRank: kind ? kind.labelRank : 0, selected: isSelected, instrument: !!(kind && kind.instrument) });
            if (first.id === previewId) {
                properties.word = previewWord(state);
                // Placed first, as the selected item's label is: a Normal item's own rank is the lowest, and its chip would be
                // the first dropped among crowded items.
                properties.rank = RANK_SELECTED;
            }
            points.push(pointFeature((first.geometry as Point).coordinates as Position, properties));
            continue;
        }
        shared++;
        // The shared marker sits at the members' centroid, and each member's popup anchors there (item 20).
        const coords = sharedCentre(group);
        members.forEach((m) => { anchors[m.id] = coords; });
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
        // The current line (its arrow, floating ends and open segment) or a line in a set of several (its casing alone).
        const isCurrent = selected !== null && selected.kind === 'line' && selected.id === item.id;
        const isSelected = isCurrent || inSet.has(item.id);
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
                    properties: areaProperties(item.id, item.name, item.kind, areaTint(live.display[item.kind], item.properties), colors, isSelected,
                        inSet.has(item.id)),
                    geometry: { type: 'Polygon', coordinates: [ring] }
                });
            }
            continue;
        }
        lineItems++;
        const instruments = instrumentsOn(live_, item.id);
        const diameter = item.properties ? item.properties.diameter : undefined;
        const look = lineLook(state, diameter);
        const nodes = lineNodes(item, instruments, live, coords.length >= 2 ? lengthM(coords) : 0);
        const bounding = segmentNodes(nodes);
        const openSegment = isCurrent && selected ? selected.segment || null : null;
        const segmentOf = (from: LineNode, to: LineNode): { from: string; to: string; segmentSelected: boolean } => ({
            from: from.id, to: to.id,
            segmentSelected: openSegment !== null && openSegment.fromId === from.id && openSegment.toId === to.id
        });
        if (bounding.length <= 2 || coords.length < 2) {
            // No measuring instrument: the whole line is one segment with the line's own look.
            lines.push({
                type: 'Feature',
                properties: { ...lineProperties(item.id, item.name, item.kind, look, colors, isSelected),
                    ...segmentOf(bounding[0], bounding[bounding.length - 1]) },
                geometry: { type: 'LineString', coordinates: coords }
            });
        } else {
            // One feature per segment, each as the Gateway graded it (the segments slot); the line's own
            // alarm or comms lost colours the whole line over any segment look (AD-11).
            const values = live.items[item.id];
            const graded = values && values.segments ? values.segments : [];
            const pieces = splitAt(coords, bounding.slice(1, -1).map((n) => n.distanceM));
            for (let i = 0; i < pieces.length && i + 1 < bounding.length; i++) {
                const from = bounding[i];
                const to = bounding[i + 1];
                const slot = graded.find((g) => g.from === from.id && g.to === to.id);
                const segmentLook = slot && !state.alarm && !state.commsLost ? lineLook(segmentState(slot), diameter) : look;
                lines.push({
                    type: 'Feature',
                    properties: { ...lineProperties(item.id, item.name, item.kind, segmentLook, colors, isSelected), ...segmentOf(from, to) },
                    geometry: { type: 'LineString', coordinates: pieces[i] }
                });
            }
        }
        if (coords.length >= 2) {
            const mid = alongLine(coords, 0.5);
            const word = item.id === previewId ? previewWord(state) : stateWord(state);
            marks.push(pointFeature(mid.point, {
                id: item.id, name: item.name, kind: item.kind,
                label: word ? item.name + ' ' + word : item.name,
                badge: look.badge ? badgeImageId(look.badge, look.priority, look.solid) : '',
                rank: labelRank(state, kind ? kind.labelRank : 0, isSelected),
                selected: isSelected
            }));
            if (isCurrent) {
                // The selected line's geometry: the arrow layer repeats the flow arrow along it in the line's
                // drawn direction, first vertex to last (item 22), under the midpoint chip and badge.
                arrow.push({ type: 'Feature', properties: { id: item.id }, geometry: { type: 'LineString', coordinates: coords } });
                // Its floating ends take a mark (entry 4): an end that snaps to an item has that item's marker there.
                const lineEnds = item.ends || {};
                if (!lineEnds.start) {
                    ends.push(pointFeature(coords[0], { id: item.id, role: 'start' }));
                }
                if (!lineEnds.end) {
                    ends.push(pointFeature(coords[coords.length - 1], { id: item.id, role: 'end' }));
                }
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
        ends: { type: 'FeatureCollection', features: ends },
        boundsKey: bounds ? bounds.map((n) => n.toFixed(6)).join(',') : '',
        bounds,
        shared,
        anchors,
        lineItems
    };
}
