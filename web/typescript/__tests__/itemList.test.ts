// The item list's rows (epic 4 entry 2): every live item by name with its live badge; the Search items
// field's filter (entry 21): name, kind name or linked asset name, case and accents aside, the list's order kept.
import { AssetName, Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import { LIVE_INITIAL, LiveState, LiveValue } from '../live';
import { badgeWords, filterRows, listRows } from '../itemList';

const PAD: Kind = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] };
const LINE: Kind = { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 5, fields: [] };

function item(id: string, name: string, kind: string, extra: Partial<MapItemRecord> = {}): MapItemRecord {
    return { id, kind, name, geometry: kind === 'line' ? { type: 'LineString', coordinates: [[0, 0], [1, 1]] } : { type: 'Point', coordinates: [0, 0] },
        properties: {}, assetId: 'A', overrides: {}, ends: null, attachment: null, version: 1, deleted: false, ...extra };
}

const GOOD: LiveValue = { value: 1, quality: 'Good', t: '2026-11-04T10:00:00Z', stale: false, reason: '' };
const BAD: LiveValue = { value: null, quality: 'Bad_NotFound', t: null, stale: true, reason: 'Bad_NotFound' };

const LIVE: LiveState = {
    ...LIVE_INITIAL,
    display: { pad: { kindId: 'pad', comms: true, kpis: [{ key: 'p', label: 'P', unit: '', icon: true, on: true }],
        alarms: { on: true, count: true, summary: true }, link: '' } as LiveState['display'][string] },
    items: {
        p1: { id: 'p1', comms: { ...GOOD, value: true }, kpis: { p: GOOD }, alarms: { ...GOOD, value: { active: 1, unacked: 1, priority: 2 } }, problems: [] },
        p2: { id: 'p2', comms: { ...GOOD, value: false }, kpis: { p: { ...GOOD, stale: true, reason: 'comms lost' } }, problems: [] },
        p3: { id: 'p3', comms: { ...GOOD, value: true }, kpis: { p: BAD }, problems: [] }
    }
};

describe('listRows', () => {
    test('every live item by name with its kind and the worst state as its badge', () => {
        const rows = listRows([
            item('p3', 'Pad 3', 'pad'), item('p1', 'Pad 1', 'pad'), item('p2', 'pad 2', 'pad'),
            item('p4', 'Pad 10', 'pad', { assetId: null }), item('l1', 'Line A', 'line', { assetId: null }),
            item('gone', 'Gone', 'pad', { deleted: true }), item('x', 'Odd', 'tank')
        ], [PAD, LINE], LIVE);
        expect(rows.map((r) => r.name)).toEqual(['Line A', 'Odd', 'Pad 1', 'pad 2', 'Pad 3', 'Pad 10']);
        const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
        expect(byId.p1).toMatchObject({ kindName: 'Well pad', icon: 'well-pad', geometry: 'point', badge: 'alarm', words: 'Priority 2 alarm',
            alarm: { priority: 2, unacked: true } });
        expect(byId.p2).toMatchObject({ badge: 'comms-lost', words: 'Comms lost', alarm: null });
        expect(byId.p3).toMatchObject({ badge: 'stale', words: 'Stale' });
        expect(byId.p4).toMatchObject({ badge: 'unlinked', words: 'Unlinked' });
        expect(byId.l1).toMatchObject({ kindName: 'Gathering line', geometry: 'line', badge: 'unlinked' });
        expect(byId.x).toMatchObject({ kindName: 'tank', icon: '', badge: 'normal', words: '' });
    });

    test('an item with no values and an asset is normal; the badge words are the legend\'s', () => {
        const rows = listRows([item('p9', 'Pad 9', 'pad')], [PAD], LIVE_INITIAL);
        expect(rows[0].badge).toBe('normal');
        expect(badgeWords('alarm', 1)).toBe('Priority 1 alarm');
        expect(badgeWords('alarm', null)).toBe('Priority 1 alarm');
        expect(badgeWords('normal', null)).toBe('');
    });
});

describe('the rows\' asset names (entry 21)', () => {
    test('a linked item carries its asset\'s name from assetNames; an unlinked one, or one whose asset is not listed, null', () => {
        const names: AssetName[] = [{ id: 'A', name: 'Pad 14' }, { id: 'S', name: 'SWD 1' }];
        const rows = listRows([
            item('p1', 'Pad 1', 'pad'), item('s1', 'Disposal', 'pad', { assetId: 'S' }),
            item('u1', 'Loose', 'pad', { assetId: null }), item('g1', 'Ghost', 'pad', { assetId: 'GONE' })
        ], [PAD], LIVE_INITIAL, names);
        const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
        expect(byId.p1.assetName).toBe('Pad 14');
        expect(byId.s1.assetName).toBe('SWD 1');
        expect(byId.u1.assetName).toBeNull();
        expect(byId.g1.assetName).toBeNull();
        // Without assetNames (the parameter left out) every row's asset name is null.
        expect(listRows([item('p1', 'Pad 1', 'pad')], [PAD], LIVE_INITIAL)[0].assetName).toBeNull();
    });
});

describe('filterRows (entry 21, the Search items field)', () => {
    const TANK: Kind = { id: 'tank', name: 'Tank battery', geometry: 'point', icon: 'tank-battery', labelRank: 4, fields: [] };
    const names: AssetName[] = [{ id: 'S', name: 'SWD 1' }, { id: 'M', name: 'Mésa Compressor' }, { id: 'A', name: 'Pad 14' }];
    const rows = listRows([
        item('l1', 'L-SWD', 'line', { assetId: null }), item('c1', 'CTB1', 'tank', { assetId: null }),
        item('p2', 'Point 2', 'pad', { assetId: 'S' }), item('p3', 'Point 3', 'pad', { assetId: 'M' }),
        item('e1', 'Écluse', 'pad'), item('p9', 'Pad 9', 'pad')
    ], [PAD, LINE, TANK], LIVE_INITIAL, names);
    const ids = (query: string): string[] => filterRows(rows, query).map((r) => r.id);

    test('an empty or blank query keeps every row, in the list\'s order', () => {
        expect(rows.map((r) => r.name)).toEqual(['CTB1', 'Écluse', 'L-SWD', 'Pad 9', 'Point 2', 'Point 3']);
        expect(ids('')).toEqual(rows.map((r) => r.id));
        expect(ids('   ')).toEqual(rows.map((r) => r.id));
        // A copy: the list's own rows are never the filter's.
        expect(filterRows(rows, '')).not.toBe(rows);
    });

    test('the name, the kind name and the linked asset name each match, in the list\'s order', () => {
        // The name: L-SWD; the linked asset: Point 2 on SWD 1.
        expect(ids('swd')).toEqual(['l1', 'p2']);
        // The kind name: CTB1 is a Tank battery; nothing else holds it.
        expect(ids('battery')).toEqual(['c1']);
        // The kind name of every pad, whatever its name, in the list's order.
        expect(ids('well pad')).toEqual(['e1', 'p9', 'p2', 'p3']);
        // The asset name alone: Pad 14 is the asset of Écluse and Pad 9 (the test items' default asset A).
        expect(ids('pad 14')).toEqual(['e1', 'p9']);
    });

    test('letter case and accents aside, as the View-mode search compares, and spaces folded', () => {
        expect(ids('SWD')).toEqual(ids('swd'));
        expect(ids('ecluse')).toEqual(['e1']);
        expect(ids('ÉCLUSE')).toEqual(['e1']);
        expect(ids('mesa')).toEqual(['p3']);
        expect(ids('  point   3 ')).toEqual(['p3']);
    });

    test('a query nothing holds keeps no row', () => {
        expect(ids('zzz')).toEqual([]);
        expect(ids('swd 2')).toEqual([]);
    });
});

describe('a vanished asset counts as unlinked (entry 6, R3)', () => {
    test('with the asset list known, a link to an asset not among the names reads Unlinked with the reason; without it, as before', () => {
        const names: AssetName[] = [{ id: 'A', name: 'Pad 14' }];
        const items = [item('p1', 'Pad 1', 'pad'), item('g1', 'Ghost', 'pad', { assetId: 'P99' }), item('u1', 'Loose', 'pad', { assetId: null })];
        const known = Object.fromEntries(listRows(items, [PAD], LIVE_INITIAL, names, true).map((r) => [r.id, r]));
        expect(known.p1).toMatchObject({ badge: 'normal', reason: '' });
        expect(known.g1).toMatchObject({ badge: 'unlinked', words: 'Unlinked', assetName: null, reason: 'P99 is no longer in the asset list' });
        expect(known.u1).toMatchObject({ badge: 'unlinked', reason: '' });
        // The list not known (loading, not configured, an older Gateway): the link is taken as it is.
        const unknown = Object.fromEntries(listRows(items, [PAD], LIVE_INITIAL, names).map((r) => [r.id, r]));
        expect(unknown.g1).toMatchObject({ badge: 'normal', reason: '' });
        // A live state still wins over the badge: a vanished asset's alarm shows as the alarm.
        const alarmed = listRows([item('p1', 'Pad 1', 'pad', { assetId: 'P99' })], [PAD], LIVE, names, true);
        expect(alarmed[0]).toMatchObject({ badge: 'alarm', reason: 'P99 is no longer in the asset list' });
    });
});
