import { Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import { insideRing, itemDistanceM } from '../geometry';
import { KindDisplay, LIVE_INITIAL, LiveState } from '../live';
import { needsYou, rowDistanceM } from '../needsyou';
import { NEAREST_COUNT, buildEntries, nearestEntries, positionRedraws } from '../search';

/** Metres in 0.001 degree of latitude (Turf's radius). */
const MILLI_DEG_M = (6371008.8 * Math.PI) / 180 / 1000;

describe('the distance of an item from the user (epic 4 entry 16, geometry.ts)', () => {
    test('a point: the great-circle distance', () => {
        expect(itemDistanceM([0, 0], { type: 'Point', coordinates: [0, 0.01] }, false)).toBeCloseTo(10 * MILLI_DEG_M, 3);
        expect(itemDistanceM([10, 20], { type: 'Point', coordinates: [10, 20] }, false)).toBe(0);
    });

    test('a line: to its nearest point, not its middle or its first vertex', () => {
        const line = { type: 'LineString' as const, coordinates: [[-0.01, 0], [0.01, 0]] as Array<[number, number]> };
        // Straight above the line's middle, 0.002 degrees north: 2 milli-degrees away.
        expect(itemDistanceM([0.005, 0.002], line, false)).toBeCloseTo(2 * MILLI_DEG_M, 0);
        // Past its end: to the end.
        expect(itemDistanceM([0.02, 0], line, false)).toBeCloseTo(10 * MILLI_DEG_M, 0);
    });

    test('an area: 0 inside, else to its edge (an unclosed ring closes)', () => {
        const ring: Array<[number, number]> = [[0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01]];
        const area = { type: 'LineString' as const, coordinates: ring };
        expect(insideRing(ring, [0.005, 0.005])).toBe(true);
        expect(insideRing(ring, [0.02, 0.005])).toBe(false);
        expect(itemDistanceM([0.005, 0.005], area, true)).toBe(0);
        // 0.003 degrees west of the closing edge (from [0, 0.01] back to [0, 0]).
        expect(itemDistanceM([-0.003, 0.005], area, true)).toBeCloseTo(3 * MILLI_DEG_M, 0);
        // The same ring as a line is measured to the line, not filled.
        expect(itemDistanceM([0.005, 0.005], area, false)).toBeGreaterThan(0);
    });
});

const PAD: Kind = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] };
const LINE: Kind = { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 5, fields: [] };
const FENCE: Kind = { id: 'fence', name: 'Geofence', geometry: 'line', icon: 'geofence', labelRank: 0, fields: [], area: true };

function rec(id: string, kind: string, geometry: MapItemRecord['geometry']): MapItemRecord {
    return { id, kind, name: id.toUpperCase(), geometry, properties: {}, assetId: null, overrides: {}, ends: null, attachment: null, version: 1, deleted: false };
}

describe('Nearest in the search (search.ts nearestEntries)', () => {
    const items: MapItemRecord[] = [];
    for (let i = 1; i <= 12; i++) {
        items.push(rec('p' + String(i).padStart(2, '0'), 'pad', { type: 'Point', coordinates: [0, i * 0.001] }));
    }
    items.push(rec('l1', 'line', { type: 'LineString', coordinates: [[-0.01, 0.0045], [0.01, 0.0045]] }));
    items.push(rec('f1', 'fence', { type: 'LineString', coordinates: [[-0.001, -0.001], [0.001, -0.001], [0.001, 0.001], [-0.001, 0.001]] }));
    const entries = buildEntries(items, [PAD, LINE, FENCE], []);

    test('the ten nearest, nearest first, each with its distance; a line to its nearest point, an area 0 inside', () => {
        const near = nearestEntries(entries, [0, 0]);
        expect(near).toHaveLength(NEAREST_COUNT);
        expect(near.map((r) => r.id)).toEqual(['f1', 'p01', 'p02', 'p03', 'p04', 'l1', 'p05', 'p06', 'p07', 'p08']);
        expect(near[0].distanceM).toBe(0);
        expect(near[5].distanceM).toBeCloseTo(4.5 * MILLI_DEG_M, 0);
        expect(near[1].detail).toBe('Well pad');
        for (let i = 1; i < near.length; i++) {
            expect(near[i].distanceM!).toBeGreaterThanOrEqual(near[i - 1].distanceM!);
        }
        expect(nearestEntries(entries, [0, 0], 3).map((r) => r.id)).toEqual(['f1', 'p01', 'p02']);
    });
});

describe('the distance on Needs you rows (needsyou.ts)', () => {
    test('each row carries its geometry, measured from the position; the order stays by state', () => {
        const t = '2026-10-28T10:00:00Z';
        const display: KindDisplay = { kindId: 'pad', comms: true, kpis: [], alarms: { on: true, count: true, summary: true }, link: '' };
        const items = [rec('far', 'pad', { type: 'Point', coordinates: [0, 0.05] }), rec('near', 'pad', { type: 'Point', coordinates: [0, 0.001] })];
        const live: LiveState = { ...LIVE_INITIAL, display: { pad: display }, items: {
            far: { id: 'far', comms: { value: true, quality: 'Good', t, stale: false, reason: '' }, kpis: {},
                alarms: { value: { active: 1, unacked: 1, priority: 1 }, quality: 'Good', t, stale: false, reason: '' }, problems: [] },
            near: { id: 'near', comms: { value: false, quality: 'Good', t, stale: false, reason: '' }, kpis: {},
                alarms: { value: { active: 0, unacked: 0, priority: 0 }, quality: 'Good', t, stale: false, reason: '' }, problems: [] }
        } };
        const summary = needsYou(items, [PAD], live, Date.parse(t) + 4000);
        expect(summary.rows.map((r) => r.id)).toEqual(['far', 'near']);
        expect(summary.rows[0].shape).toEqual({ type: 'Point', coordinates: [0, 0.05] });
        expect(summary.rows[0].area).toBe(false);
        expect(rowDistanceM(summary.rows[0], [0, 0])).toBeCloseTo(50 * MILLI_DEG_M, 0);
        expect(rowDistanceM(summary.rows[1], [0, 0])).toBeCloseTo(MILLI_DEG_M, 0);
    });
});

describe('a new position and an open list (search.ts positionRedraws)', () => {
    test('an A-Z list or typed results are left alone; Nearest follows; the switch comes and goes', () => {
        // A new fix with A-Z shown, or with text typed: no redraw, so the list keeps its scroll.
        expect(positionRedraws(true, true, true, 'az')).toBe(false);
        expect(positionRedraws(false, true, false, 'nearest')).toBe(false);
        expect(positionRedraws(false, false, false, 'az')).toBe(false);
        // Nearest shown: it follows the position.
        expect(positionRedraws(true, true, true, 'nearest')).toBe(true);
        // The first fix puts the switch in; losing it takes the switch out.
        expect(positionRedraws(true, true, false, 'az')).toBe(true);
        expect(positionRedraws(true, false, true, 'az')).toBe(true);
    });
});
