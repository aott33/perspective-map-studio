/**
 * The shared geometry module (AD-19, epic 2 story 14): distances along a line and the one
 * batch that keeps a line's instruments on it when the line moves, changes shape, is split
 * or is deleted. Turf 7.4.0 (`length`, `along`, `nearestPointOnLine`, units metres, earth
 * radius 6371008.8 m); the Gateway checks the result with the same formulas
 * (common/.../contract/LineMeasure.java, shared test vectors). Pure, unit tested in node;
 * the drawing and editing tools of epic-editing call it, nothing draws here.
 */

import { along } from '@turf/along';
import { lineString, point } from '@turf/helpers';
import { length } from '@turf/length';
import { nearestPointOnLine } from '@turf/nearest-point-on-line';

import { EditBatch, EditOp, MapItemData, MapItemRecord } from './contract';

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

/** A delete of a line: the line and every instrument on it, in one batch (owner, 2026-10-27). */
export function lineDeleteBatch(batchId: string, line: MapItemRecord, items: MapItemRecord[]): EditBatch {
    const ops: EditOp[] = [{ op: 'delete', entity: 'item', id: line.id, baseVersion: line.version }];
    for (const instrument of instrumentsOn(items, line.id)) {
        ops.push({ op: 'delete', entity: 'item', id: instrument.id, baseVersion: instrument.version });
    }
    return { batchId, ops };
}
