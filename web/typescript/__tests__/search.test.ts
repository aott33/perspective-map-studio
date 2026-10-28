import { Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import { SEARCH_LIMIT, buildEntries, chosenText, fold, resultDetail, searchEntries } from '../search';

const PAD: Kind = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] };
const LINE: Kind = { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 5, fields: [] };
const FENCE: Kind = { id: 'geofence', name: 'Geofence', geometry: 'line', icon: 'geofence', labelRank: 0, fields: [], area: true };

function point(id: string, name: string, kind = 'pad', assetId: string | null = null, deleted = false): MapItemRecord {
    return { id, kind, name, geometry: { type: 'Point', coordinates: [-104.97, 39.74] }, properties: {}, assetId,
        overrides: {}, ends: null, attachment: null, version: 1, deleted };
}

function line(id: string, name: string, kind = 'line'): MapItemRecord {
    return { id, kind, name, geometry: { type: 'LineString', coordinates: [[-104.97, 39.74], [-104.96, 39.75]] }, properties: {},
        assetId: null, overrides: {}, ends: null, attachment: null, version: 1, deleted: false };
}

const ASSETS = [{ id: 'P12', name: 'Pad 12' }, { id: 'P14', name: 'Pad 14' }];
const ITEMS = [
    point('a1', 'Pad 1'), point('a12', 'Pad 12'), point('a14', 'Pad 14'), point('a2', 'Pad 2'),
    point('p1', 'Point 1', 'pad', 'P12'), point('p2', 'Point 2', 'pad', 'P14'), point('p3', 'Point 3', 'pad', 'P99'),
    line('l1', 'Tracer line'), line('f1', 'North fence', 'geofence'),
    point('gone', 'Pad 14 old', 'pad', null, true), point('odd', 'Éclair pad', 'unknown-kind')
];
const ENTRIES = buildEntries(ITEMS, [PAD, LINE, FENCE], ASSETS);

describe('the search (epic 3 entry 9)', () => {
    test('fold drops letter case, accents and extra spaces', () => {
        expect(fold('  Pad   14 ')).toBe('pad 14');
        expect(fold('ÉCLAIR Señor')).toBe('eclair senor');
        expect(fold('')).toBe('');
    });

    test('the entries come from the live items with their kind words and asset names', () => {
        expect(ENTRIES.map((e) => e.id)).not.toContain('gone');
        const p1 = ENTRIES.find((e) => e.id === 'p1')!;
        expect(p1).toEqual({ id: 'p1', name: 'Point 1', kindId: 'pad', kindName: 'Well pad', icon: 'well-pad', geometry: 'point',
            area: false, assetName: 'Pad 12' });
        expect(ENTRIES.find((e) => e.id === 'p3')!.assetName).toBeNull();
        const fence = ENTRIES.find((e) => e.id === 'f1')!;
        expect(fence.geometry).toBe('line');
        expect(fence.area).toBe(true);
        const odd = ENTRIES.find((e) => e.id === 'odd')!;
        expect(odd.kindName).toBe('unknown-kind');
        expect(odd.icon).toBe('');
    });

    test('an empty or blank query gives nothing', () => {
        expect(searchEntries(ENTRIES, '')).toEqual([]);
        expect(searchEntries(ENTRIES, '   ')).toEqual([]);
    });

    test('a name prefix ranks first, then an asset prefix, then a name that holds the query, then an asset that does', () => {
        // Names that start with "pad 1" (by name), then the points whose asset name starts with it.
        expect(searchEntries(ENTRIES, 'pad 1').map((r) => r.id + ':' + r.matched))
            .toEqual(['a1:name', 'a12:name', 'a14:name', 'p1:asset', 'p2:asset']);
        // Nothing starts with "ad 1": the names that hold it first, then the asset names that do.
        expect(searchEntries(ENTRIES, 'ad 1').map((r) => r.id + ':' + r.matched))
            .toEqual(['a1:name', 'a12:name', 'a14:name', 'p1:asset', 'p2:asset']);
        // "pad": the pads by name prefix, the points by asset prefix, then "Éclair pad", which holds it.
        expect(searchEntries(ENTRIES, 'pad').map((r) => r.id + ':' + r.matched))
            .toEqual(['a1:name', 'a12:name', 'a14:name', 'a2:name', 'p1:asset', 'p2:asset', 'odd:name']);
    });

    test('letter case and accents do not matter', () => {
        expect(searchEntries(ENTRIES, 'PÁD 14').map((r) => r.id)).toEqual(['a14', 'p2']);
        expect(searchEntries(ENTRIES, 'eclair').map((r) => r.id)).toEqual(['odd']);
        expect(searchEntries(ENTRIES, 'tracer').map((r) => r.id + ':' + r.geometry)).toEqual(['l1:line']);
    });

    test('the detail names the kind, and the asset too when the asset matched', () => {
        const [byName] = searchEntries(ENTRIES, 'Pad 14');
        expect(byName.id).toBe('a14');
        expect(byName.detail).toBe('Well pad');
        const byAsset = searchEntries(ENTRIES, 'Pad 14')[1];
        expect(byAsset.id).toBe('p2');
        expect(byAsset.detail).toBe('Well pad - Pad 14');
        expect(resultDetail(ENTRIES.find((e) => e.id === 'p3')!, 'asset')).toBe('Well pad');
    });

    test('the list is capped', () => {
        const many = [];
        for (let i = 0; i < 20; i++) {
            many.push(point('m' + i, 'Pad ' + (i + 100)));
        }
        const results = searchEntries(buildEntries(many, [PAD], []), 'pad');
        expect(results).toHaveLength(SEARCH_LIMIT);
        expect(results[0].name).toBe('Pad 100');
        expect(searchEntries(buildEntries(many, [PAD], []), 'pad', 3)).toHaveLength(3);
    });

    test('the live region names the chosen item', () => {
        expect(chosenText(ENTRIES[0])).toBe('Pad 1 selected');
    });
});
