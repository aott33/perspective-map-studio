import { Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import { insideRing, itemDistanceM } from '../geometry';
import { distanceWords, usesMiles } from '../linePopup';
import { KindDisplay, LIVE_INITIAL, LiveState } from '../live';
import { needsYou, rowDistanceM } from '../needsyou';
import { NEAREST_COUNT, buildEntries, nearestEntries } from '../search';

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

describe('a distance in words (linePopup.ts distanceWords)', () => {
    test('en-US counts in miles, everything else in kilometres', () => {
        expect(usesMiles('en-US')).toBe(true);
        expect(usesMiles('en-us')).toBe(true);
        expect(usesMiles('en-GB')).toBe(false);
        expect(usesMiles('fr-CA')).toBe(false);
        expect(usesMiles('')).toBe(false);
    });

    test('miles: under 0.1 mi in feet rounded to 10, tenths below 10, whole above', () => {
        expect(distanceWords(100, 'en-US')).toBe('330 ft');
        // The rule, not the plan's "850 ft" example: 850 ft is past 0.1 mi (528 ft), so it reads in miles.
        expect(distanceWords(259, 'en-US')).toBe('0.2 mi');
        expect(distanceWords(0, 'en-US')).toBe('0 ft');
        expect(distanceWords(160, 'en-US')).toBe('520 ft');
        expect(distanceWords(161, 'en-US')).toBe('0.1 mi');
        expect(distanceWords(650, 'en-US')).toBe('0.4 mi');
        expect(distanceWords(3701, 'en-US')).toBe('2.3 mi');
        expect(distanceWords(19312, 'en-US')).toBe('12 mi');
        expect(distanceWords(16050, 'en-US')).toBe('10 mi');
    });

    test('kilometres: under 1 km in metres rounded to 10, tenths below 10, whole above', () => {
        expect(distanceWords(423, 'en-GB')).toBe('420 m');
        expect(distanceWords(650, 'en-GB')).toBe('650 m');
        expect(distanceWords(1100, 'de-DE')).toBe('1.1 km');
        expect(distanceWords(996, 'en-GB')).toBe('1.0 km');
        expect(distanceWords(12000, 'en-GB')).toBe('12 km');
        expect(distanceWords(9970, 'en-GB')).toBe('10 km');
        expect(distanceWords(-5, 'en-GB')).toBe('0 m');
        expect(distanceWords(NaN, 'en-GB')).toBe('0 m');
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
