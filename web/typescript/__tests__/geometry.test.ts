// The shared geometry module (epic 2 story 14). The vectors are Turf 7.4.0's own, in
// common/src/test/resources/.../line-measure-vectors.json, read by LineMeasureTest.java too.
import { readFileSync } from 'fs';
import { join } from 'path';

import { MapItemRecord } from '../contract';
import {
    Position, instrumentsOn, lengthM, lineDeleteBatch, lineGeometryBatch, lineMoveBatch, lineSplitBatch, pointAt,
    project, round1, round6
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
