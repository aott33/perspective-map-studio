import { Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import { SEARCH_LABEL, SEARCH_LIMIT, SEARCH_PAGE, SEARCH_PLACEHOLDER, allEntries, buildEntries, chosenText, fold, pagedCount, resultDetail, searchEntries } from '../search';

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

describe('the list of every item (owner review, item 8)', () => {
    test('is one alphabetical list of every live item, no groups, no attention order', () => {
        const all = allEntries(ENTRIES);
        // Names folded (case and accents ignored): Éclair sorts with E; deleted items are not entries.
        expect(all.map((r) => r.name)).toEqual(['Éclair pad', 'North fence', 'Pad 1', 'Pad 12', 'Pad 14', 'Pad 2', 'Point 1', 'Point 2', 'Point 3', 'Tracer line']);
        expect(all.every((r) => r.matched === 'name')).toBe(true);
        expect(all[0].detail).toBe('unknown-kind');
        expect(all[2].detail).toBe('Well pad');
        // The same entries in another order give the same list.
        expect(allEntries(ENTRIES.slice().reverse()).map((r) => r.id)).toEqual(all.map((r) => r.id));
    });

    test('typing filters every match, not only eight (the control passes no limit)', () => {
        const many = Array.from({ length: 30 }, (_, i) => point('m' + i, 'Meter ' + i));
        const entries = buildEntries(many, [PAD], []);
        expect(searchEntries(entries, 'meter').length).toBe(SEARCH_LIMIT);
        expect(searchEntries(entries, 'meter', Number.POSITIVE_INFINITY).length).toBe(30);
    });

    test('is drawn a page at a time', () => {
        expect(SEARCH_PAGE).toBe(50);
        expect(pagedCount(300, 0)).toBe(50);
        expect(pagedCount(300, 50)).toBe(50);
        expect(pagedCount(300, 51)).toBe(100);
        expect(pagedCount(300, 300)).toBe(300);
        expect(pagedCount(20, 1)).toBe(20);
        expect(pagedCount(0, 10)).toBe(0);
    });

    test('the placeholder is short for the phone field, the accessible name keeps the long description (item 12)', () => {
        expect(SEARCH_PLACEHOLDER).toBe('Search assets');
        expect(SEARCH_LABEL).toBe('Search sites, wells or lines');
    });
});
