import { Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import { alongLine, bearingDeg, buildFeatures } from '../features';
import { LIVE_INITIAL, LiveState } from '../live';
import { MarkerColors, RANK_SELECTED, badgeImageId } from '../markers';

const COLORS: MarkerColors = {
    disc: 'd', glyph: 'g', halo: 'h', textSecondary: 's', line: 'l', chipEdge: 'c', selection: 'sel',
    commsLost: 'cl', alarm: ['a1', 'a2', 'a3'], font: 'f'
};

const KINDS: Kind[] = [
    { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] },
    { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 5, fields: [] },
    { id: 'tap', name: 'Tap', geometry: 'point', icon: 'tap', labelRank: 2, fields: [], instrument: true }
];

function item(id: string, kind: string, name: string, geometry: MapItemRecord['geometry'], extra: Partial<MapItemRecord> = {}): MapItemRecord {
    return { id, kind, name, geometry, properties: {}, assetId: null, overrides: {}, ends: null, attachment: null, version: 1, deleted: false, ...extra };
}

const A = item('a', 'pad', 'Pad A', { type: 'Point', coordinates: [-104.99, 39.74] });
const B = item('b', 'pad', 'Pad B', { type: 'Point', coordinates: [-104.99 + 0.0001, 39.74] });
const FAR = item('far', 'pad', 'Far', { type: 'Point', coordinates: [-104.95, 39.75] });
const L = item('l', 'line', 'L-1', { type: 'LineString', coordinates: [[-104.99, 39.74], [-104.95, 39.75]] }, { properties: { diameter: 10 } });

const display = {
    kindId: 'pad', comms: true, kpis: [{ key: 'p', label: 'P', unit: 'psi', icon: true, on: true }], alarms: { on: true, count: true, summary: true }, link: ''
};
const value = (v: unknown, stale = false) => ({ value: v, quality: stale ? 'Bad' : 'Good', t: null, stale, reason: '' });

describe('the map features (epic 3 entry 7)', () => {
    test('two points within 20 m draw as one marker with the names as one and the worst state; a far one alone', () => {
        const live: LiveState = {
            ...LIVE_INITIAL,
            display: { pad: display },
            items: {
                a: { id: 'a', comms: value(true), kpis: { p: value(400) }, problems: [] },
                b: { id: 'b', comms: value(false), kpis: { p: value(1, true) }, problems: [] }
            }
        };
        const out = buildFeatures([A, B, FAR, L], KINDS, live, null, COLORS);
        expect(out.points.features).toHaveLength(2);
        const shared = out.points.features.find((f) => f.properties.members === 2)!;
        expect(shared.properties).toMatchObject({ id: 'shared:a,b', name: 'Pad A and Pad B', memberIds: 'a,b', state: 'comms-lost', word: 'Comms lost', kpi: '' });
        expect(shared.geometry.coordinates).toEqual(A.geometry.coordinates);
        expect(out.shared).toBe(1);
        const far = out.points.features.find((f) => f.properties.id === 'far')!;
        expect(far.properties).toMatchObject({ members: 1, state: 'normal', kpi: '' });
        expect(out.bounds).toEqual([-104.99, 39.74, -104.95, 39.75]);
        expect(out.boundsKey).toBe('-104.990000,39.740000,-104.950000,39.750000');
    });

    test('a line takes its weight from its size only with an instrument on it, the thin neutral look without', () => {
        const none = buildFeatures([L], KINDS, LIVE_INITIAL, null, COLORS);
        expect(none.lines.features[0].properties).toMatchObject({ id: 'l', weight: 2, color: 'l', dashed: false, selected: false });
        expect(none.marks.features[0].properties).toMatchObject({ id: 'l', label: 'L-1', badge: '' });
        expect(none.arrow.features).toHaveLength(0);
        const tap = item('t', 'tap', 'T', { type: 'Point', coordinates: [-104.97, 39.745] }, { attachment: { lineId: 'l', distanceM: 100 } });
        const tapped = buildFeatures([L, tap], KINDS, LIVE_INITIAL, null, COLORS);
        expect(tapped.lines.features[0].properties.weight).toBe(6);
    });

    test('a line in alarm takes the hue and its badge at the midpoint; comms lost dashes it; the selected line gets the arrow', () => {
        const live: LiveState = {
            ...LIVE_INITIAL,
            display: { line: { ...display, kindId: 'line', kpis: [] } },
            items: { l: { id: 'l', comms: value(true), kpis: {}, alarms: value({ active: 1, unacked: 1, priority: 2 }), problems: [] } }
        };
        const out = buildFeatures([L], KINDS, live, { id: 'l', kind: 'line' }, COLORS);
        expect(out.lines.features[0].properties).toMatchObject({ color: 'a2', hue: 'alarm-2', dashed: false, selected: true });
        expect(out.marks.features[0].properties).toMatchObject({ badge: badgeImageId('alarm-2-unacknowledged', 2, true), rank: RANK_SELECTED, selected: true });
        // The badge holds the midpoint, so the arrow sits at the three-quarter point.
        expect(out.arrow.features).toHaveLength(1);
        const q = alongLine(L.geometry.coordinates as Array<[number, number]>, 0.75);
        expect(out.arrow.features[0].geometry.coordinates).toEqual(q.point);
        expect(out.arrow.features[0].properties.bearing).toBeCloseTo(q.bearing, 6);

        const lost: LiveState = { ...live, items: { l: { id: 'l', comms: value(false), kpis: {}, problems: [] } } };
        const dashed = buildFeatures([L], KINDS, lost, { id: 'l', kind: 'line' }, COLORS);
        expect(dashed.lines.features[0].properties).toMatchObject({ color: 'l', dashed: true });
        expect(dashed.marks.features[0].properties.label).toBe('L-1 Comms lost');
        expect(dashed.arrow.features[0].geometry.coordinates).toEqual(alongLine(L.geometry.coordinates as Array<[number, number]>, 0.5).point);
    });

    test('a selected point takes its ring and the first rank; a shared marker is selected through a member', () => {
        const out = buildFeatures([A, B, FAR], KINDS, LIVE_INITIAL, { id: 'b', kind: 'point' }, COLORS);
        const shared = out.points.features.find((f) => f.properties.members === 2)!;
        expect(shared.properties).toMatchObject({ selected: true, rank: RANK_SELECTED });
        expect(shared.properties.marker).toContain('true]');
        expect(out.points.features.find((f) => f.properties.id === 'far')!.properties.selected).toBe(false);
        expect(buildFeatures([], KINDS, LIVE_INITIAL, null, COLORS)).toMatchObject({ bounds: null, boundsKey: '', shared: 0 });
    });

    test('bearings: north 0, east 90, along a line', () => {
        expect(bearingDeg([0, 0], [0, 1])).toBeCloseTo(0, 6);
        expect(bearingDeg([0, 0], [1, 0])).toBeCloseTo(90, 6);
        expect(bearingDeg([0, 0], [0, -1])).toBeCloseTo(180, 6);
        const mid = alongLine([[0, 0], [0, 0.01]], 0.5);
        expect(mid.point[1]).toBeCloseTo(0.005, 6);
        expect(mid.bearing).toBeCloseTo(0, 3);
    });
});
