// The shared geometry module (epic 2 story 14). The vectors are Turf 7.4.0's own, in
// common/src/test/resources/.../line-measure-vectors.json, read by LineMeasureTest.java too.
import { readFileSync } from 'fs';
import { join } from 'path';

import { MapItemRecord } from '../contract';
import {
    EDGES_CROSS, Position, SNAP_PX, canDeleteVertex, canSplitAt, endSideOf, endsFrom, endsWith, instrumentsOn, lengthM, lineDeleteBatch,
    lineGeometryBatch, lineMoveBatch, lineSplitBatch, linesSnappedTo, minVertexCount, nearestSnap, pointAt, pointMoveBatch, project, ringCrosses,
    round1, round6, snapDistanceM, snapTargets, snapTargetsForLine, splitAtBatch, splitName, vertexDeleteBatch, vertexMoveBatch
} from '../geometry';

interface Vectors {
    lines: Array<{ name: string; coordinates: Position[]; lengthM: number;
        along: Array<{ distanceM: number; point: Position }> }>;
}

const VECTORS: Vectors = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'common', 'src', 'test', 'resources',
    'com', 'aoindustrial', 'perspective', 'mapstudio', 'common', 'contract', 'line-measure-vectors.json'), 'utf8'));

const SWD: Position[] = [[-103.52, 31.92], [-103.505, 31.9205], [-103.490423, 31.926]];
const LINE_ID = '11111111-1111-4111-8111-111111111111';
const PT1 = '22222222-2222-4222-8222-222222222222';
const PT2 = '33333333-3333-4333-8333-333333333333';
const FREE = '44444444-4444-4444-8444-444444444444';

function record(id: string, kind: string, name: string, geometry: MapItemRecord['geometry'], version: number,
    attachment: MapItemRecord['attachment'] = null): MapItemRecord {
    return { id, kind, name, geometry, properties: {}, assetId: null, overrides: {}, ends: null, attachment, version,
        deleted: false };
}

function tapAt(id: string, name: string, distanceM: number, version = 1): MapItemRecord {
    const p = pointAt(SWD, distanceM);
    return record(id, 'tap', name, { type: 'Point', coordinates: [round6(p[0]), round6(p[1])] }, version,
        { lineId: LINE_ID, distanceM });
}

const LINE = record(LINE_ID, 'line', 'L-SWD', { type: 'LineString', coordinates: SWD }, 4);
const ITEMS = [tapAt(PT2, 'PT-2', 2841, 2), LINE, tapAt(PT1, 'PT-1', 1143, 2),
    record(FREE, 'tap', 'PT-free', { type: 'Point', coordinates: [-103.51, 31.92] }, 1)];

/** Haversine metres, as LineMeasure.distanceM: the Gateway's 1 m check in the test. */
function metres(a: Position, b: Position): number {
    const r = (d: number) => d * Math.PI / 180;
    const h = Math.sin(r(b[1] - a[1]) / 2) ** 2 + Math.sin(r(b[0] - a[0]) / 2) ** 2 * Math.cos(r(a[1])) * Math.cos(r(b[1]));
    return 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 6371008.8;
}

/** What AttachmentRules checks for one instrument op: within the line plus 1 m, and its point within 1 m of its place. */
function expectOnLine(data: Record<string, unknown>, coords: Position[]): void {
    const at = data.attachment as { distanceM: number };
    const p = (data.geometry as { coordinates: Position }).coordinates;
    expect(at.distanceM).toBeGreaterThanOrEqual(0);
    expect(at.distanceM).toBeLessThanOrEqual(lengthM(coords) + 1);
    expect(metres(p, pointAt(coords, at.distanceM))).toBeLessThan(1);
    expect(round1(at.distanceM)).toBe(at.distanceM);
}

describe('distances along a line, the same vectors as LineMeasureTest.java', () => {
    test('lengths and points along match Turf 7.4.0', () => {
        expect(VECTORS.lines.map((l) => l.name)).toEqual(['L-SWD', 'dev-line', 'high-latitude', 'antimeridian',
            'closed-ring', 'repeated-vertex', 'zero-length']);
        let n = 0;
        for (const line of VECTORS.lines) {
            expect(lengthM(line.coordinates)).toBeCloseTo(line.lengthM, 6);
            for (const v of line.along) {
                const p = pointAt(line.coordinates, v.distanceM);
                expect(p[0]).toBeCloseTo(v.point[0], 10);
                expect(p[1]).toBeCloseTo(v.point[1], 10);
                n++;
            }
        }
        expect(n).toBeGreaterThanOrEqual(50);
        expect(lengthM(SWD)).toBeCloseTo(2922.35, 2);
    });

    test('rounding is half away from zero, as the Gateway stores (BigDecimal HALF_UP)', () => {
        expect(round1(1143.05)).toBe(1143.1);
        expect(round1(1143.04999)).toBe(1143);
        expect(round1(0.25)).toBe(0.3);
        expect(round6(-103.5000005)).toBe(-103.500001);
        expect(round6(31.9204994)).toBe(31.920499);
        expect(round6(1e-7)).toBe(0);
    });

    test('a point projects to its nearest place, measured from the first vertex', () => {
        const place = pointAt(SWD, 1143);
        const off: Position = [place[0], place[1] + 30 / 6371008.8 * 180 / Math.PI];
        const p = project(SWD, off);
        expect(Math.abs(p.distanceM - 1143)).toBeLessThan(2); // due north is not quite square to the segment
        expect(p.offM).toBeGreaterThan(29);
        expect(p.offM).toBeLessThan(31);
        expect(metres(p.point, pointAt(SWD, p.distanceM))).toBeLessThan(0.2);
        expect(project(SWD, [-103.53, 31.92]).distanceM).toBe(0);
        expect(project(SWD, [-103.48, 31.93]).distanceM).toBe(round1(lengthM(SWD)));
    });

    test('a ring, a repeated vertex and a zero-length line project as the Gateway measures them', () => {
        const byName = (name: string) => VECTORS.lines.find((l) => l.name === name)!.coordinates;
        const ring = byName('closed-ring');
        const start = project(ring, ring[0]);
        expect(start.distanceM).toBe(0);
        expect(start.point).toEqual(ring[0]);
        const corner = project(ring, ring[1]);
        expect(corner.distanceM).toBe(round1(metres(ring[0], ring[1])));
        expect(metres(corner.point, ring[1])).toBeLessThan(0.1);
        const repeated = byName('repeated-vertex');
        const atVertex = round1(metres(repeated[0], repeated[1]));
        for (const d of [atVertex - 1, atVertex, atVertex + 1]) {
            const p = project(repeated, pointAt(repeated, d));
            expect(Math.abs(p.distanceM - d)).toBeLessThanOrEqual(0.1);
            expect(metres(p.point, pointAt(repeated, p.distanceM))).toBeLessThan(0.2); // 6 decimals is about 0.1 m
            expect(metres(p.point, pointAt(SWD, p.distanceM))).toBeLessThan(0.2); // as if the vertex were not repeated
        }
        const zero = byName('zero-length');
        const z = project(zero, [-104.98, 39.75]);
        expect(z.distanceM).toBe(0);
        expect(z.point).toEqual(zero[0]);
        expect(lengthM(zero)).toBe(0);
    });

    test('the instruments on a line, ordered by distance; free and other items are not', () => {
        expect(instrumentsOn(ITEMS, LINE_ID).map((i) => i.name)).toEqual(['PT-1', 'PT-2']);
        expect(instrumentsOn([...ITEMS.slice(0, 3), { ...tapAt(FREE, 'gone', 10), deleted: true }], LINE_ID)
            .map((i) => i.name)).toEqual(['PT-1', 'PT-2']);
        expect(instrumentsOn(ITEMS, PT1)).toEqual([]);
    });
});

describe('one batch for a line and its instruments', () => {
    test('a reshape places each instrument at its nearest place on the new shape', () => {
        const reshaped: Position[] = [[-103.52, 31.92], [-103.505, 31.9223], [-103.490423, 31.926]];
        const batch = lineGeometryBatch('b1', LINE, reshaped, ITEMS);
        expect(batch.batchId).toBe('b1');
        expect(batch.ops.map((o) => [o.op, o.id, o.baseVersion])).toEqual([['update', LINE_ID, 4], ['update', PT1, 2],
            ['update', PT2, 2]]);
        expect(batch.ops[0].data).toEqual({ geometry: { type: 'LineString', coordinates: reshaped } });
        for (const op of batch.ops.slice(1)) {
            expect(Object.keys(op.data!).sort()).toEqual(['attachment', 'geometry']);
            expect((op.data!.attachment as { lineId: string }).lineId).toBe(LINE_ID);
            expectOnLine(op.data as Record<string, unknown>, reshaped);
        }
    });

    test('a vertex inserted on the line keeps every instrument where it was', () => {
        const mid = pointAt(SWD, 600);
        const inserted: Position[] = [SWD[0], [round6(mid[0]), round6(mid[1])], SWD[1], SWD[2]];
        const batch = lineGeometryBatch('b2', LINE, inserted, ITEMS);
        const d = batch.ops.slice(1).map((o) => (o.data!.attachment as { distanceM: number }).distanceM);
        expect(Math.abs(d[0] - 1143)).toBeLessThan(1);
        expect(Math.abs(d[1] - 2841)).toBeLessThan(1);
        batch.ops.slice(1).forEach((o) => expectOnLine(o.data as Record<string, unknown>, inserted));
    });

    test('a move carries the instruments with the line', () => {
        const batch = lineMoveBatch('b3', LINE, [0.01, -0.005], ITEMS);
        const moved = (batch.ops[0].data!.geometry as { coordinates: Position[] }).coordinates;
        expect(moved[0]).toEqual([-103.51, 31.915]);
        const d = batch.ops.slice(1).map((o) => (o.data!.attachment as { distanceM: number }).distanceM);
        expect(Math.abs(d[0] - 1143)).toBeLessThan(1);
        expect(Math.abs(d[1] - 2841)).toBeLessThan(1);
        batch.ops.slice(1).forEach((o) => expectOnLine(o.data as Record<string, unknown>, moved));
    });

    test('a split moves each instrument to the part it lies on, measured from that part', () => {
        const partB = '55555555-5555-4555-8555-555555555555';
        const batch = lineSplitBatch('b4', LINE, SWD.slice(0, 2), SWD.slice(1), { id: partB,
            data: { kind: 'line', name: 'L-SWD B', properties: {} } }, ITEMS);
        expect(batch.ops.map((o) => [o.op, o.id])).toEqual([['update', LINE_ID], ['create', partB], ['update', PT1],
            ['update', PT2]]);
        expect(batch.ops[1]).toEqual({ op: 'create', entity: 'item', id: partB, baseVersion: 0, data: { kind: 'line',
            name: 'L-SWD B', properties: {}, geometry: { type: 'LineString', coordinates: SWD.slice(1) } } });
        const pt1 = batch.ops[2].data!.attachment!;
        const pt2 = batch.ops[3].data!.attachment!;
        expect(pt1.lineId).toBe(LINE_ID);
        expect(Math.abs(pt1.distanceM - 1143)).toBeLessThan(0.2);
        expect(pt2.lineId).toBe(partB);
        expect(Math.abs(pt2.distanceM - (2841 - lengthM(SWD.slice(0, 2))))).toBeLessThan(0.2);
        expectOnLine(batch.ops[2].data as Record<string, unknown>, SWD.slice(0, 2));
        expectOnLine(batch.ops[3].data as Record<string, unknown>, SWD.slice(1));
    });

    test('a delete deletes the line and its instruments in one batch', () => {
        expect(lineDeleteBatch('b5', LINE, ITEMS)).toEqual({ batchId: 'b5', ops: [
            { op: 'delete', entity: 'item', id: LINE_ID, baseVersion: 4 },
            { op: 'delete', entity: 'item', id: PT1, baseVersion: 2 },
            { op: 'delete', entity: 'item', id: PT2, baseVersion: 2 }] });
    });

    test('a point is not a line', () => {
        expect(() => lineMoveBatch('b6', ITEMS[0], [0, 0], ITEMS)).toThrow('is not a line');
    });
});

describe('snapping (epic 4 entry 4, AD-19)', () => {
    const CTB1 = record('c1', 'pad', 'CTB1', { type: 'Point', coordinates: [-105.012, 39.7262] }, 1);
    const SWD1 = record('s1', 'pad', 'SWD1', { type: 'Point', coordinates: [-104.983671, 39.715476] }, 1);
    const GONE = { ...record('g', 'pad', 'Gone', { type: 'Point', coordinates: [-105.0, 39.72] }, 2), deleted: true };

    test('the targets are every point item once, then every vertex of every line, each in item order, deleted ones left out', () => {
        const targets = snapTargets([CTB1, GONE, LINE, SWD1]);
        expect(targets.map((t) => t.itemId)).toEqual(['c1', 's1', LINE_ID, LINE_ID, LINE_ID]);
        expect(targets[0]).toEqual({ itemId: 'c1', name: 'CTB1', position: [-105.012, 39.7262] });
        expect(targets[3]).toEqual({ itemId: LINE_ID, name: 'L-SWD', position: SWD[1] });
        expect(snapTargets([])).toEqual([]);
    });

    test('a point item wins a tie with a line vertex at its place (the line that snaps to a pad has a vertex on it)', () => {
        const onPad = record('pad', 'pad', 'CTB1', { type: 'Point', coordinates: SWD[0] }, 1);
        const targets = snapTargets([LINE, onPad]);
        expect(nearestSnap(targets, SWD[0], 100)!.itemId).toBe('pad');
        expect(nearestSnap(targets, [SWD[0][0] + 0.0002, SWD[0][1]], 100)!.itemId).toBe('pad');
    });

    test('the snap distance is SNAP_PX screen pixels at the zoom and latitude (512 px tiles)', () => {
        expect(SNAP_PX).toBe(20);
        // At zoom 13 and 39.7 degrees north one pixel is about 7.35 m.
        expect(snapDistanceM(13, 39.72)).toBeGreaterThan(140);
        expect(snapDistanceM(13, 39.72)).toBeLessThan(150);
        expect(snapDistanceM(14, 39.72)).toBeCloseTo(snapDistanceM(13, 39.72) / 2, 6);
        expect(snapDistanceM(13, 0)).toBeGreaterThan(snapDistanceM(13, 39.72));
        expect(snapDistanceM(13, 39.72, 10)).toBeCloseTo(snapDistanceM(13, 39.72) / 2, 6);
    });

    test('the nearest target within reach takes the vertex; none when every target is further', () => {
        const targets = snapTargets([CTB1, SWD1]);
        // 100 m east of CTB1 (about 0.00117 degrees of longitude at this latitude).
        const near: Position = [-105.012 + 0.00117, 39.7262];
        expect(nearestSnap(targets, near, 150)).toBe(targets[0]);
        expect(nearestSnap(targets, near, 50)).toBeNull();
        expect(nearestSnap(targets, [-105.012, 39.7262], 1)).toBe(targets[0]);
        // Between the two, nearer SWD1.
        expect(nearestSnap(targets, [-104.99, 39.718], 1000)).toBe(targets[1]);
        expect(nearestSnap([], near, 1000)).toBeNull();
    });

    test('the saved ends come from the targets the first and last vertex snapped to, null with both floating', () => {
        const [c1, s1] = snapTargets([CTB1, SWD1]);
        expect(endsFrom(c1, s1)).toEqual({ start: { itemId: 'c1' }, end: { itemId: 's1' } });
        expect(endsFrom(c1, null)).toEqual({ start: { itemId: 'c1' } });
        expect(endsFrom(null, s1)).toEqual({ end: { itemId: 's1' } });
        expect(endsFrom(null, null)).toBeNull();
    });
});

describe('changing geometry (epic 4 entry 5): one batch per change, ends stored and never inferred', () => {
    const CTB = '66666666-6666-4666-8666-666666666666';
    const SWDP = '77777777-7777-4777-8777-777777777777';
    const PART = '88888888-8888-4888-8888-888888888888';
    const OTHER = '99999999-9999-4999-8999-999999999999';
    const ENDS = { start: { itemId: CTB }, end: { itemId: SWDP } };
    const SNAPPED = { ...LINE, ends: ENDS, assetId: 'LSWD', properties: { diameter: 6 }, overrides: { styleRule: { source: { instruments: 'worst' } } } };
    const PAD = record(CTB, 'pad', 'CTB1', { type: 'Point', coordinates: SWD[0] }, 3);
    const PAD_END = record(SWDP, 'pad', 'SWD1', { type: 'Point', coordinates: SWD[2] }, 2);
    const WITH_ENDS = [ITEMS[0], SNAPPED, ITEMS[2], ITEMS[3], PAD, PAD_END];
    const lineOp = (batch: { ops: Array<{ id: string; data?: Record<string, unknown> }> }) => batch.ops.find((o) => o.id === LINE_ID)!;

    test('endsWith names one side or leaves it out, and is null with no side left', () => {
        expect(endsWith(ENDS, 'start', 'x')).toEqual({ start: { itemId: 'x' }, end: { itemId: SWDP } });
        expect(endsWith(ENDS, 'start', null)).toEqual({ end: { itemId: SWDP } });
        expect(endsWith({ end: { itemId: SWDP } }, 'end', null)).toBeNull();
        expect(endsWith(null, 'end', 'x')).toEqual({ end: { itemId: 'x' } });
        expect(endsWith(null, 'start', null)).toBeNull();
    });

    test('the floors and the sides: two points for a line, three for an area; a split at an inner point of a line only', () => {
        expect(minVertexCount(false)).toBe(2);
        expect(minVertexCount(true)).toBe(3);
        expect(canDeleteVertex(3, false)).toBe(true);
        expect(canDeleteVertex(2, false)).toBe(false);
        expect(canDeleteVertex(3, true)).toBe(false);
        expect(canDeleteVertex(4, true)).toBe(true);
        expect([0, 1, 2].map((i) => canSplitAt(3, i, false))).toEqual([false, true, false]);
        expect(canSplitAt(4, 1, true)).toBe(false);
        expect([0, 1, 2].map((i) => endSideOf(3, i, false))).toEqual(['start', null, 'end']);
        expect(endSideOf(3, 0, true)).toBeNull();
    });

    test('an inner vertex moved: one batch with the new shape and the instruments re-placed, ends untouched', () => {
        const to: Position = [-103.505, 31.9223];
        const batch = vertexMoveBatch('m1', SNAPPED, 1, to, null, WITH_ENDS, false);
        expect(batch.ops.map((o) => o.id)).toEqual([LINE_ID, PT1, PT2]);
        expect(lineOp(batch).data).toEqual({ geometry: { type: 'LineString', coordinates: [SWD[0], to, SWD[2]] } });
        batch.ops.slice(1).forEach((o) => expectOnLine(o.data as Record<string, unknown>, [SWD[0], to, SWD[2]]));
    });

    test('an end vertex moved names the item it snaps to, or floats and its side of ends goes; an area has no ends', () => {
        const near: Position = [-103.5201, 31.9201];
        const snapped = vertexMoveBatch('m2', SNAPPED, 2, SWD[2], OTHER, WITH_ENDS, false);
        expect(lineOp(snapped).data!.ends).toEqual({ start: { itemId: CTB }, end: { itemId: OTHER } });
        const floating = vertexMoveBatch('m3', SNAPPED, 0, near, null, WITH_ENDS, false);
        expect(lineOp(floating).data!.ends).toEqual({ end: { itemId: SWDP } });
        expect((lineOp(floating).data!.geometry as { coordinates: Position[] }).coordinates[0]).toEqual(near);
        // Snapped again to the item it names: no ends in the op.
        expect(lineOp(vertexMoveBatch('m4', SNAPPED, 0, SWD[0], CTB, WITH_ENDS, false)).data).not.toHaveProperty('ends');
        expect(lineOp(vertexMoveBatch('m5', LINE, 0, near, null, ITEMS, true)).data).not.toHaveProperty('ends');
        expect(() => vertexMoveBatch('m6', SNAPPED, 3, near, null, WITH_ENDS, false)).toThrow('has no vertex 3');
    });

    test('a vertex deleted: one batch without it, an end point\'s side of ends goes, never below the floor', () => {
        const inner = vertexDeleteBatch('d1', SNAPPED, 1, WITH_ENDS, false);
        expect(lineOp(inner).data).toEqual({ geometry: { type: 'LineString', coordinates: [SWD[0], SWD[2]] } });
        expect(inner.ops.map((o) => o.id)).toEqual([LINE_ID, PT1, PT2]);
        inner.ops.slice(1).forEach((o) => expectOnLine(o.data as Record<string, unknown>, [SWD[0], SWD[2]]));
        const start = vertexDeleteBatch('d2', SNAPPED, 0, WITH_ENDS, false);
        expect(lineOp(start).data!.ends).toEqual({ end: { itemId: SWDP } });
        expect((lineOp(start).data!.geometry as { coordinates: Position[] }).coordinates).toEqual([SWD[1], SWD[2]]);
        const two = { ...SNAPPED, geometry: { type: 'LineString' as const, coordinates: [SWD[0], SWD[2]] } };
        expect(() => vertexDeleteBatch('d3', two, 0, [two], false)).toThrow('keeps at least 2 vertices');
        expect(() => vertexDeleteBatch('d4', LINE, 1, ITEMS, true)).toThrow('keeps at least 3 vertices');
    });

    test('a split at the point between PT-1 and PT-2: the line keeps its name, link and start, the new part the kind, properties and end', () => {
        expect(splitName('L-SWD')).toBe('L-SWD 2');
        const batch = splitAtBatch('s1', SNAPPED, 1, PART, WITH_ENDS);
        expect(batch.ops.map((o) => [o.op, o.id])).toEqual([['update', LINE_ID], ['create', PART], ['update', PT1], ['update', PT2]]);
        expect(batch.ops[0].data).toEqual({ geometry: { type: 'LineString', coordinates: SWD.slice(0, 2) }, ends: { start: { itemId: CTB } } });
        expect(batch.ops[1]).toEqual({ op: 'create', entity: 'item', id: PART, baseVersion: 0, data: {
            kind: 'line', name: 'L-SWD 2', properties: { diameter: 6 }, assetId: null, ends: { end: { itemId: SWDP } },
            geometry: { type: 'LineString', coordinates: SWD.slice(1) } } });
        const pt1 = batch.ops[2].data!.attachment!;
        const pt2 = batch.ops[3].data!.attachment!;
        expect(pt1.lineId).toBe(LINE_ID);
        expect(Math.abs(pt1.distanceM - 1143)).toBeLessThan(0.2);
        expect(pt2.lineId).toBe(PART);
        expect(Math.abs(pt2.distanceM - (2841 - lengthM(SWD.slice(0, 2))))).toBeLessThan(0.2);
        // A line with floating ends: the line keeps none, the new part has none.
        const loose = splitAtBatch('s2', LINE, 1, PART, ITEMS);
        expect(loose.ops[0].data).not.toHaveProperty('ends');
        expect(loose.ops[1].data).not.toHaveProperty('ends');
        expect(() => splitAtBatch('s3', SNAPPED, 0, PART, WITH_ENDS)).toThrow('splits only at an inner vertex');
        expect(() => splitAtBatch('s4', SNAPPED, 2, PART, WITH_ENDS)).toThrow('splits only at an inner vertex');
    });

    test('the lines whose stored ends name an item, with the sides that do; deleted lines and points are not', () => {
        const loop = { ...LINE, id: OTHER, name: 'Loop', ends: { start: { itemId: CTB }, end: { itemId: CTB } } };
        const gone = { ...SNAPPED, id: PART, deleted: true };
        expect(linesSnappedTo([PAD, SNAPPED, loop, gone], CTB).map((s) => [s.line.name, s.sides])).toEqual([['L-SWD', ['start']], ['Loop', ['start', 'end']]]);
        expect(linesSnappedTo([PAD, SNAPPED], SWDP).map((s) => s.sides)).toEqual([['end']]);
        expect(linesSnappedTo([PAD, LINE], CTB)).toEqual([]);
    });

    test('a pad moved carries the snapped ends of its lines in the same batch, each line\'s instruments re-placed', () => {
        const to: Position = [-103.5212345678, 31.9187654321];
        const batch = pointMoveBatch('p1', PAD, to, WITH_ENDS);
        expect(batch.ops.map((o) => [o.id, o.baseVersion])).toEqual([[CTB, 3], [LINE_ID, 4], [PT1, 2], [PT2, 2]]);
        expect(batch.ops[0].data).toEqual({ geometry: { type: 'Point', coordinates: [-103.521235, 31.918765] } });
        const moved = (lineOp(batch).data!.geometry as { coordinates: Position[] }).coordinates;
        expect(moved).toEqual([[-103.521235, 31.918765], SWD[1], SWD[2]]);
        expect(lineOp(batch).data).not.toHaveProperty('ends');
        batch.ops.slice(2).forEach((o) => expectOnLine(o.data as Record<string, unknown>, moved));
        // Both ends of one line on the pad: both move; a pad no line names moves alone.
        const loop = { ...LINE, ends: { start: { itemId: CTB }, end: { itemId: CTB } } };
        const both = pointMoveBatch('p2', PAD, to, [PAD, loop]);
        expect((both.ops[1].data!.geometry as { coordinates: Position[] }).coordinates).toEqual([[-103.521235, 31.918765], SWD[1], [-103.521235, 31.918765]]);
        expect(pointMoveBatch('p3', PAD_END, to, [PAD_END, LINE]).ops.map((o) => o.id)).toEqual([SWDP]);
        expect(() => pointMoveBatch('p4', LINE, to, ITEMS)).toThrow('is not a point');
    });
});

describe('an area\'s edges never cross, and a line\'s end never snaps to its own instruments (entry 5)', () => {
    // A small square and, inside it, a spike from its left side (a simple ring), in degrees near the dev field.
    const at = ([x, y]: Position): Position => [-104.99 + x * 0.0001, 39.73 + y * 0.0001];
    const SQUARE = [[0, 0], [10, 0], [10, 10], [0, 10]].map((p) => at(p as Position));
    const SPIKED = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 6], [8, 5], [0, 4]].map((p) => at(p as Position));
    const FENCE = record('fence', 'geofence', 'North fence', { type: 'LineString', coordinates: SQUARE }, 2);
    const SPIKE = record('spike', 'geofence', 'Spike', { type: 'LineString', coordinates: SPIKED }, 1);

    test('a ring crosses when two edges that share no point meet; a square, a triangle and the spike do not', () => {
        expect(ringCrosses(SQUARE)).toBe(false);
        expect(ringCrosses(SPIKED)).toBe(false);
        expect(ringCrosses(SQUARE.slice(0, 3))).toBe(false);
        // A bow tie, and a ring whose edge runs along another.
        expect(ringCrosses([[0, 0], [10, 10], [10, 0], [0, 10]].map((p) => at(p as Position)))).toBe(true);
        expect(ringCrosses([[0, 0], [10, 0], [5, 0], [5, 5]].map((p) => at(p as Position)))).toBe(true);
    });

    test('Move then a click and Delete point refuse an area whose edges would cross, in words; a line may cross itself', () => {
        // Point 3 of the square moved across its left side: a bow tie.
        expect(() => vertexMoveBatch('x1', FENCE, 2, at([-5, 5]), null, [FENCE], true)).toThrow(EDGES_CROSS);
        expect(vertexMoveBatch('x2', FENCE, 2, at([12, 12]), null, [FENCE], true).ops).toHaveLength(1);
        expect(vertexMoveBatch('x3', { ...FENCE, kind: 'line' }, 2, at([-5, 5]), null, [FENCE], false).ops).toHaveLength(1);
        // The spiked ring's corner deleted: the new edge from (10, 0) to (0, 10) would run across the spike.
        expect(() => vertexDeleteBatch('x4', SPIKE, 2, [SPIKE], true)).toThrow(EDGES_CROSS);
        expect(vertexDeleteBatch('x5', SPIKE, 0, [SPIKE], true).ops).toHaveLength(1);
    });

    test('a line\'s end leaves its own points and instruments out of its snap targets; another line\'s instruments stay', () => {
        const other = record('other', 'line', 'L-OTHER', { type: 'LineString', coordinates: [[-103.6, 31.9], [-103.59, 31.91]] }, 1);
        const onOther = { ...tapAt('pt9', 'PT-9', 10), attachment: { lineId: 'other', distanceM: 10 } };
        const items = [...ITEMS, other, onOther];
        const targets = snapTargetsForLine(snapTargets(items), items, LINE_ID);
        expect(Array.from(new Set(targets.map((t) => t.name)))).toEqual(['PT-free', 'PT-9', 'L-OTHER']);
        expect(targets.some((t) => t.itemId === PT1 || t.itemId === PT2 || t.itemId === LINE_ID)).toBe(false);
    });
});
