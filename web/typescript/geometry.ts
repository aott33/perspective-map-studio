/**
 * The shared geometry module (AD-19, epic 2 story 14): distances along a line and the one
 * batch that keeps a line's instruments on it when the line moves, changes shape, is split
 * or is deleted; from epic 4 entry 5 the batches of changing geometry (a vertex moved, inserted,
 * deleted, a split at a point, a point item moved with the snapped ends of its lines), and from entry 25 the delete of an item
 * with the `ends` naming it cleared. Turf 7.4.0 (`length`, `along`, `nearestPointOnLine`, units metres, earth
 * radius 6371008.8 m); the Gateway checks the result with the same formulas
 * (common/.../contract/LineMeasure.java, shared test vectors). Pure, unit tested in node;
 * the drawing and editing tools of epic-editing call it, nothing draws here.
 */

import { along } from '@turf/along';
import { lineString, point } from '@turf/helpers';
import { length } from '@turf/length';
import { nearestPointOnLine } from '@turf/nearest-point-on-line';

import { EditBatch, EditOp, ItemGeometry, MapItemData, MapItemRecord } from './contract';

export type Position = [number, number];

const METRES = { units: 'meters' as const };

/** Rounded half up to 6 decimals, as the Gateway stores positions (MapItemRecord.round6). */
export function round6(n: number): number {
    return roundTo(n, 6);
}

/** Rounded half up to 0.1 m, as the Gateway stores distanceM (Attachment.round1). */
export function round1(n: number): number {
    return roundTo(n, 1);
}

function roundTo(n: number, places: number): number {
    // Through the shortest decimal text, as Java's BigDecimal.valueOf(d).setScale(places, HALF_UP)
    // does: half away from zero, so 0.05 rounds to 0.1 and -0.05 to -0.1.
    const sign = n < 0 ? -1 : 1;
    const text = Math.abs(n).toString();
    if (text.includes('e')) {
        return sign * Math.round(Math.abs(n) * 10 ** places) / 10 ** places;
    }
    return sign * Number(`${Math.round(Number(`${text}e${places}`))}e-${places}`);
}

/** The line's length in metres (Turf length). */
export function lengthM(coords: Position[]): number {
    return length(lineString(coords), METRES);
}

/** The position distanceM metres along the line from its first vertex (Turf along); the end past the length. */
export function pointAt(coords: Position[], distanceM: number): Position {
    const p = along(lineString(coords), distanceM, METRES).geometry.coordinates;
    return [p[0], p[1]];
}

/** Where a point lands on the line: the nearest place, its distance along the line (0.1 m) and how far off it was. */
export interface Projection {
    /** The stored point: the place at distanceM, rounded to 6 decimals. */
    point: Position;
    distanceM: number;
    /** Metres from the given point to the nearest place on the line. */
    offM: number;
}

/** The nearest place on the line to a point (Turf nearestPointOnLine), as an instrument stores it. */
export function project(coords: Position[], p: Position): Projection {
    const nearest = nearestPointOnLine(lineString(coords), point(p), METRES);
    const distanceM = Math.max(0, round1(nearest.properties.lineDistance));
    const at = pointAt(coords, distanceM);
    return { point: [round6(at[0]), round6(at[1])], distanceM, offM: nearest.properties.pointDistance };
}

/** The live map items attached to the line, ordered by distanceM then id. */
export function instrumentsOn(items: MapItemRecord[], lineId: string): MapItemRecord[] {
    return items
        .filter((i) => !i.deleted && i.attachment !== null && i.attachment.lineId === lineId)
        .sort((a, b) => (a.attachment!.distanceM - b.attachment!.distanceM) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function lineCoords(line: MapItemRecord): Position[] {
    if (line.geometry.type !== 'LineString') {
        throw new Error(`Map item ${line.id} is not a line.`);
    }
    return line.geometry.coordinates;
}

function pointOf(item: MapItemRecord): Position {
    if (item.geometry.type !== 'Point') {
        throw new Error(`Map item ${item.id} is not a point.`);
    }
    return item.geometry.coordinates;
}

function rounded(coords: Position[]): Position[] {
    return coords.map(([x, y]) => [round6(x), round6(y)]);
}

/** One instrument's update op: its new point and attachment on the line `lineId` with these coordinates. */
function placeOp(instrument: MapItemRecord, lineId: string, coords: Position[], from: Position): EditOp {
    const p = project(coords, from);
    return {
        op: 'update',
        entity: 'item',
        id: instrument.id,
        baseVersion: instrument.version,
        data: {
            geometry: { type: 'Point', coordinates: p.point },
            attachment: { lineId, distanceM: p.distanceM }
        }
    };
}

/**
 * A reshape or vertex change (insert, move or delete a vertex) of a line: one batch with the
 * line's new geometry and, for each instrument on it, its nearest place on the new geometry.
 */
export function lineGeometryBatch(batchId: string, line: MapItemRecord, newCoords: Position[],
    items: MapItemRecord[]): EditBatch {
    const coords = rounded(newCoords);
    const ops: EditOp[] = [{
        op: 'update', entity: 'item', id: line.id, baseVersion: line.version,
        data: { geometry: { type: 'LineString', coordinates: coords } }
    }];
    for (const instrument of instrumentsOn(items, line.id)) {
        ops.push(placeOp(instrument, line.id, coords, pointOf(instrument)));
    }
    return { batchId, ops };
}

/**
 * A move of the whole line by [dLng, dLat]: the line's vertices and each instrument's point
 * move by the same offset, and each instrument is placed at the nearest place on the moved
 * line to its moved point, so it keeps its place along the line.
 */
export function lineMoveBatch(batchId: string, line: MapItemRecord, delta: Position, items: MapItemRecord[]): EditBatch {
    const shift = ([x, y]: Position): Position => [x + delta[0], y + delta[1]];
    const coords = rounded(lineCoords(line).map(shift));
    const ops: EditOp[] = [{
        op: 'update', entity: 'item', id: line.id, baseVersion: line.version,
        data: { geometry: { type: 'LineString', coordinates: coords } }
    }];
    for (const instrument of instrumentsOn(items, line.id)) {
        ops.push(placeOp(instrument, line.id, coords, shift(pointOf(instrument))));
    }
    return { batchId, ops };
}

/** The new line of a split: its id and the create data (kind, name, properties and so on) except geometry. */
export interface SplitPart {
    id: string;
    data: MapItemData;
}

/**
 * A split of a line into `partA` (kept by the line) and `partB` (a new line): each instrument
 * goes to the part it projects onto (the nearer; part A on a tie), measured from that part's start.
 */
export function lineSplitBatch(batchId: string, line: MapItemRecord, partA: Position[], partB: Position[],
    newLine: SplitPart, items: MapItemRecord[]): EditBatch {
    const a = rounded(partA);
    const b = rounded(partB);
    const ops: EditOp[] = [
        {
            op: 'update', entity: 'item', id: line.id, baseVersion: line.version,
            data: { geometry: { type: 'LineString', coordinates: a } }
        },
        {
            op: 'create', entity: 'item', id: newLine.id, baseVersion: 0,
            data: { ...newLine.data, geometry: { type: 'LineString', coordinates: b } }
        }
    ];
    for (const instrument of instrumentsOn(items, line.id)) {
        const from = pointOf(instrument);
        const onA = project(a, from);
        const onB = project(b, from);
        ops.push(onB.offM < onA.offM ? placeOp(instrument, newLine.id, b, from) : placeOp(instrument, line.id, a, from));
    }
    return { batchId, ops };
}

/**
 * Changing geometry (epic 4 entry 5; EXPERIENCE.md Change geometry, AD-19, AD-20): the batches the handles, Move then a
 * click and the chosen point's bar send, each one `edits.apply` batch and one undo step. A line keeps its instruments at
 * their nearest place on the new shape (lineGeometryBatch) and a split puts each on the part it sits on (lineSplitBatch).
 * `ends` stay stored, never inferred: a line's end vertex moved names the item it now snaps to or, floating, leaves that
 * side out; a point item moved carries the first or last vertex of every line whose `ends` name it. An area is an
 * unclosed ring (AD-20), so it has no ends and no split.
 */

/** Which end of a line a side of `ends` is. */
export type EndSide = 'start' | 'end';

/** `ends` with one side naming `itemId`, or with that side left out for null (a floating end); null when no side is left. */
export function endsWith(ends: MapItemRecord['ends'], side: EndSide, itemId: string | null): MapItemRecord['ends'] {
    const next: { start?: { itemId: string }; end?: { itemId: string } } = {};
    if (ends && ends.start && side !== 'start') {
        next.start = { itemId: ends.start.itemId };
    }
    if (ends && ends.end && side !== 'end') {
        next.end = { itemId: ends.end.itemId };
    }
    if (itemId !== null) {
        next[side] = { itemId };
    }
    return next.start || next.end ? next : null;
}

function sameEnds(a: MapItemRecord['ends'], b: MapItemRecord['ends']): boolean {
    const start = (e: MapItemRecord['ends']) => (e && e.start ? e.start.itemId : null);
    const end = (e: MapItemRecord['ends']) => (e && e.end ? e.end.itemId : null);
    return start(a) === start(b) && end(a) === end(b);
}

/** The line op of a line batch (its first op) with `ends` added when they changed. */
function withEnds(batch: EditBatch, line: MapItemRecord, ends: MapItemRecord['ends']): EditBatch {
    if (sameEnds(line.ends, ends)) {
        return batch;
    }
    const [first, ...rest] = batch.ops;
    return { batchId: batch.batchId, ops: [{ ...first, data: { ...first.data, ends } }, ...rest] };
}

/** Why a change to an area is refused (the drag's select mode, like the Area tool, never lets a ring's edges cross). */
export const EDGES_CROSS = 'The edges would cross';

function turn(o: Position, a: Position, b: Position): number {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function within(a: Position, b: Position, p: Position): boolean {
    return Math.min(a[0], b[0]) <= p[0] && p[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= p[1] && p[1] <= Math.max(a[1], b[1]);
}

/** Whether the segments a-b and c-d meet (crossing, or touching or overlapping in a line). */
function segmentsMeet(a: Position, b: Position, c: Position, d: Position): boolean {
    const d1 = turn(c, d, a);
    const d2 = turn(c, d, b);
    const d3 = turn(a, b, c);
    const d4 = turn(a, b, d);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
        return true;
    }
    return (d1 === 0 && within(c, d, a)) || (d2 === 0 && within(c, d, b)) || (d3 === 0 && within(a, b, c)) || (d4 === 0 && within(a, b, d));
}

/**
 * Whether an area's ring (its points unclosed, AD-20) has two edges that meet other than at the point they share: the check
 * Move then a click and Delete point run before an area's batch is built (entry 5), planar in longitude and latitude.
 */
export function ringCrosses(ring: Position[]): boolean {
    const n = ring.length;
    if (n < 4) {
        return false;
    }
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (j === i + 1 || (i === 0 && j === n - 1)) {
                continue;
            }
            if (segmentsMeet(ring[i], ring[(i + 1) % n], ring[j], ring[(j + 1) % n])) {
                return true;
            }
        }
    }
    return false;
}

/** The fewest vertices a line keeps (two) and an area's ring (three). */
export function minVertexCount(area: boolean): number {
    return area ? 3 : 2;
}

/** Whether a vertex may be deleted: never below two for a line or three for an area. */
export function canDeleteVertex(vertexCount: number, area: boolean): boolean {
    return vertexCount > minVertexCount(area);
}

/** Whether a line may be split at a vertex: an inner vertex of a line; never an end, never an area. */
export function canSplitAt(vertexCount: number, index: number, area: boolean): boolean {
    return !area && index > 0 && index < vertexCount - 1;
}

/** The side of `ends` a vertex is: the first vertex of a line is its start, the last its end; an inner vertex or an area's none. */
export function endSideOf(vertexCount: number, index: number, area: boolean): EndSide | null {
    if (area) {
        return null;
    }
    return index === 0 ? 'start' : index === vertexCount - 1 ? 'end' : null;
}

/**
 * One vertex of a line or an area moved to `to` (its handle dragged, or Move then a click): one batch with the new shape and
 * the line's instruments at their nearest place on it. A line's first or last vertex names the item it now snaps to
 * (`snapTo`, from the Snap toggle's target) in `ends`, or with null floats and its side of `ends` goes.
 */
export function vertexMoveBatch(batchId: string, line: MapItemRecord, index: number, to: Position, snapTo: string | null,
    items: MapItemRecord[], area: boolean): EditBatch {
    const coords = lineCoords(line).map(([x, y]) => [x, y] as Position);
    if (index < 0 || index >= coords.length) {
        throw new Error(`Map item ${line.id} has no vertex ${index}.`);
    }
    coords[index] = [to[0], to[1]];
    if (area && ringCrosses(coords)) {
        throw new Error(EDGES_CROSS);
    }
    const batch = lineGeometryBatch(batchId, line, coords, items);
    const side = endSideOf(coords.length, index, area);
    return side === null ? batch : withEnds(batch, line, endsWith(line.ends, side, snapTo));
}

/**
 * One vertex of a line or an area removed (the chosen point's Delete point): one batch with the shape without it and the
 * instruments re-placed; never below two vertices for a line or three for an area. A line's first or last vertex removed
 * leaves the next one as the end, which floats: that side of `ends` goes.
 */
export function vertexDeleteBatch(batchId: string, line: MapItemRecord, index: number, items: MapItemRecord[], area: boolean): EditBatch {
    const coords = lineCoords(line);
    if (index < 0 || index >= coords.length) {
        throw new Error(`Map item ${line.id} has no vertex ${index}.`);
    }
    if (!canDeleteVertex(coords.length, area)) {
        throw new Error(`Map item ${line.id} keeps at least ${minVertexCount(area)} vertices.`);
    }
    const kept = coords.filter((_c, i) => i !== index);
    if (area && ringCrosses(kept)) {
        throw new Error(EDGES_CROSS);
    }
    const batch = lineGeometryBatch(batchId, line, kept, items);
    const side = endSideOf(coords.length, index, area);
    return side === null ? batch : withEnds(batch, line, endsWith(line.ends, side, null));
}

/** The new part's name on a split (owner, 2026-11-06): the line's name and " 2". */
export function splitName(name: string): string {
    return name + ' 2';
}

/**
 * A line split at an inner vertex (the chosen point's Split here; owner, 2026-11-06): one batch in which the line keeps its
 * name, asset link, start and the vertices up to the split point, and the new line `newId` takes the vertices from the split
 * point on with the line's kind, properties and end, the name "<name> 2" and no asset link. The two new ends at the split
 * point float. Each instrument goes to the part it sits on, measured from that part's start (lineSplitBatch, AD-19).
 */
export function splitAtBatch(batchId: string, line: MapItemRecord, index: number, newId: string, items: MapItemRecord[]): EditBatch {
    const coords = lineCoords(line);
    if (!canSplitAt(coords.length, index, false)) {
        throw new Error(`Map item ${line.id} splits only at an inner vertex, not ${index}.`);
    }
    const newEnds = line.ends && line.ends.end ? { end: { itemId: line.ends.end.itemId } } : null;
    const data: MapItemData = {
        kind: line.kind,
        name: splitName(line.name),
        properties: { ...line.properties },
        assetId: null,
        ...(newEnds ? { ends: newEnds } : {})
    };
    const batch = lineSplitBatch(batchId, line, coords.slice(0, index + 1), coords.slice(index), { id: newId, data }, items);
    return withEnds(batch, line, endsWith(line.ends, 'end', null));
}

/** The live lines whose stored `ends` name a map item, with the sides that do, in item order. */
export function linesSnappedTo(items: MapItemRecord[], itemId: string): Array<{ line: MapItemRecord; sides: EndSide[] }> {
    const out: Array<{ line: MapItemRecord; sides: EndSide[] }> = [];
    for (const item of items) {
        if (item.deleted || item.geometry.type !== 'LineString' || !item.ends || item.id === itemId) {
            continue;
        }
        const sides: EndSide[] = [];
        if (item.ends.start && item.ends.start.itemId === itemId) {
            sides.push('start');
        }
        if (item.ends.end && item.ends.end.itemId === itemId) {
            sides.push('end');
        }
        if (sides.length > 0) {
            out.push({ line: item, sides });
        }
    }
    return out;
}

/**
 * A point map item moved to `to` (its drag, Move then a click, or typed latitude and longitude): one batch with its new
 * place and, for every live line whose stored `ends` name it, the line's first or last vertex (or both) moved there too with
 * the line's instruments at their nearest place on its new shape (AD-19: the ends stay stored and still name the item).
 */
export function pointMoveBatch(batchId: string, item: MapItemRecord, to: Position, items: MapItemRecord[]): EditBatch {
    pointOf(item);
    const at: Position = [round6(to[0]), round6(to[1])];
    const ops: EditOp[] = [{
        op: 'update', entity: 'item', id: item.id, baseVersion: item.version,
        data: { geometry: { type: 'Point', coordinates: at } }
    }];
    for (const { line, sides } of linesSnappedTo(items, item.id)) {
        const coords = lineCoords(line).map(([x, y]) => [x, y] as Position);
        for (const side of sides) {
            coords[side === 'start' ? 0 : coords.length - 1] = at;
        }
        // At most one op per id in a batch (docs/contract.md): an id already moved here keeps its first op.
        ops.push(...lineGeometryBatch(batchId, line, coords, items).ops.filter((op) => !ops.some((o) => o.id === op.id)));
    }
    return { batchId, ops };
}

/** A delete of a line: the line and every instrument on it, in one batch (owner, 2026-10-27). */
export function lineDeleteBatch(batchId: string, line: MapItemRecord, items: MapItemRecord[]): EditBatch {
    const ops: EditOp[] = [{ op: 'delete', entity: 'item', id: line.id, baseVersion: line.version }];
    for (const instrument of instrumentsOn(items, line.id)) {
        ops.push({ op: 'delete', entity: 'item', id: instrument.id, baseVersion: instrument.version });
    }
    return { batchId, ops };
}

/**
 * A delete of one map item (epic 4 entry 25; EXPERIENCE.md Delete: no confirmation, one undo restores it): one batch with the
 * item and, for a line, every instrument on it (lineDeleteBatch; the Gateway refuses a line deleted without them), then for
 * every live line left whose stored `ends` name an item the batch deletes, an update with that side of `ends` gone, so no line
 * names a deleted item (AD-19: `ends` stay stored, never inferred). The deletes come first, so the reverse (undo.ts) restores
 * the items before it puts the `ends` back; one undo step restores them all with their links, properties, kinds and shapes.
 */
export function itemDeleteBatch(batchId: string, item: MapItemRecord, items: MapItemRecord[]): EditBatch {
    const ops: EditOp[] = item.geometry.type === 'LineString'
        ? lineDeleteBatch(batchId, item, items).ops
        : [{ op: 'delete', entity: 'item', id: item.id, baseVersion: item.version }];
    const gone = new Set(ops.map((op) => op.id));
    for (const line of items) {
        if (line.deleted || gone.has(line.id) || line.geometry.type !== 'LineString' || !line.ends) {
            continue;
        }
        let ends: MapItemRecord['ends'] = line.ends;
        for (const side of ['start', 'end'] as EndSide[]) {
            const named = ends ? ends[side] : undefined;
            if (named && gone.has(named.itemId)) {
                ends = endsWith(ends, side, null);
            }
        }
        if (!sameEnds(line.ends, ends)) {
            ops.push({ op: 'update', entity: 'item', id: line.id, baseVersion: line.version, data: { ends } });
        }
    }
    return { batchId, ops };
}

/**
 * Snapping while a line or an area is drawn (epic 4 entry 4; EXPERIENCE.md Snap, AD-19): the places a
 * vertex may land on, the nearest one within reach of the pointer, and the `ends` the saved line
 * carries for the items its first and last vertex snapped to. The snap target is remembered when the
 * vertex is placed (editing.ts) and `ends` come from those targets, never from the coordinates.
 */

/** A place a vertex may snap to: a point map item at its position, or one vertex of a line map item. */
export interface SnapTarget {
    itemId: string;
    name: string;
    position: Position;
}

/** How near the pointer must be, in screen pixels at the map's zoom, for a target to take the vertex. */
export const SNAP_PX = 20;

/** Web Mercator's world width in metres at the equator (MapLibre's 512 px tiles). */
const EARTH_CIRCUMFERENCE_M = 40075016.686;

/** The snap distance in metres: SNAP_PX screen pixels at the zoom and latitude (512 px tiles). */
export function snapDistanceM(zoom: number, lat: number, px: number = SNAP_PX): number {
    const metresPerPixel = (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (512 * Math.pow(2, zoom));
    return px * metresPerPixel;
}

/**
 * Every snap target of the live map items: each point item once, then each vertex of each line item, each in
 * item order. The points come first so a point item wins a tie with a line vertex at the same place (a line
 * whose end snaps to a pad has a vertex on the pad): the item at that place is what `ends` names.
 */
export function snapTargets(items: MapItemRecord[]): SnapTarget[] {
    const points: SnapTarget[] = [];
    const vertices: SnapTarget[] = [];
    for (const item of items) {
        if (item.deleted) {
            continue;
        }
        if (item.geometry.type === 'Point') {
            points.push({ itemId: item.id, name: item.name, position: [item.geometry.coordinates[0], item.geometry.coordinates[1]] });
        } else {
            for (const c of item.geometry.coordinates) {
                vertices.push({ itemId: item.id, name: item.name, position: [c[0], c[1]] });
            }
        }
    }
    return points.concat(vertices);
}

/** The nearest target within `withinM` metres of a position (the first of equally near ones), or null when none is that near. */
export function nearestSnap(targets: SnapTarget[], at: Position, withinM: number): SnapTarget | null {
    let best: SnapTarget | null = null;
    let bestM = withinM;
    for (const target of targets) {
        const m = target.position[0] === at[0] && target.position[1] === at[1] ? 0 : lengthM([target.position, at]);
        if (best === null ? m <= bestM : m < bestM) {
            best = target;
            bestM = m;
        }
    }
    return best;
}

/**
 * The targets a line's end may snap to while the line is edited (entry 5): every target but the line's own points and its own
 * instruments, since an end on an instrument of its line would move the line under the instrument and leave it off its place.
 */
export function snapTargetsForLine(targets: SnapTarget[], items: MapItemRecord[], lineId: string): SnapTarget[] {
    const own = new Set([lineId].concat(instrumentsOn(items, lineId).map((i) => i.id)));
    return targets.filter((t) => !own.has(t.itemId));
}

/** The saved line's `ends` from the targets its first and last vertex snapped to (null for either floating end); null with both floating. */
export function endsFrom(start: SnapTarget | null, end: SnapTarget | null): MapItemRecord['ends'] {
    if (start === null && end === null) {
        return null;
    }
    return { ...(start ? { start: { itemId: start.itemId } } : {}), ...(end ? { end: { itemId: end.itemId } } : {}) };
}

/** The earth's radius Turf measures with, in metres. */
const EARTH_RADIUS_M = 6371008.8;

/** The great-circle distance between two positions in metres (haversine, Turf's radius). */
function haversineM(a: Position, b: Position): number {
    const toRad = (d: number): number => (d * Math.PI) / 180;
    const dLat = toRad(b[1] - a[1]);
    const dLng = toRad(b[0] - a[0]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Whether a position is inside a ring (its points unclosed or closed), by the even-odd rule on longitude and latitude. */
export function insideRing(ring: Position[], p: Position): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) {
            inside = !inside;
        }
    }
    return inside;
}

/**
 * How far a map item is from a position, in metres, geodesic (epic 4 entry 16; EXPERIENCE.md Search and Needs you): a point
 * to the position; a line to its nearest point (how far to reach it, not to its middle); an area 0 inside and else to its
 * edge. A line or area with too few points is measured to its first point.
 */
export function itemDistanceM(position: Position, geometry: ItemGeometry, area: boolean): number {
    if (geometry.type === 'Point') {
        return haversineM(position, [geometry.coordinates[0], geometry.coordinates[1]]);
    }
    const coords = geometry.coordinates.map((c) => [c[0], c[1]] as Position);
    if (coords.length === 0) {
        return Infinity;
    }
    if (coords.length === 1) {
        return haversineM(position, coords[0]);
    }
    if (area && coords.length >= 3) {
        if (insideRing(coords, position)) {
            return 0;
        }
        const first = coords[0];
        const last = coords[coords.length - 1];
        const ring = first[0] === last[0] && first[1] === last[1] ? coords : coords.concat([first]);
        return nearestPointOnLine(lineString(ring), point(position), METRES).properties.pointDistance;
    }
    return nearestPointOnLine(lineString(coords), point(position), METRES).properties.pointDistance;
}
