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

// Entry 7a: the list as designed (EXPERIENCE.md Item list; DESIGN.md list-row, group-header, filter-chip).
import { Asset } from '../adapters';
import { LastChange } from '../contract';
import {
    ListItem, ListSort, ListView, changedText, entriesOf, groupRows, kindChips, parentsOf, placePath, unlinkedCount, unlinkedLabel, whenText
} from '../itemList';

describe('the list grouped by place, sorted, filtered (entry 7a)', () => {
    const AREA: Kind = { id: 'geofence', name: 'Geofence', geometry: 'line', icon: 'geofence', labelRank: 0, fields: [], area: true };
    const TAP: Kind = { id: 'tap', name: 'Tap', geometry: 'point', icon: 'tap', labelRank: 2, fields: [], instrument: true };
    const WELL: Kind = { id: 'well', name: 'Well', geometry: 'point', icon: 'well', labelRank: 3, fields: [] };
    const KINDS = [PAD, LINE, AREA, TAP, WELL];
    const ASSETS: Asset[] = [
        { id: 'CTB1', name: 'CTB 1', kind: 'pad', basePath: '[default]Mesa/CTB1' },
        { id: 'SWD1', name: 'SWD 1', kind: 'pad', basePath: '[default]Mesa/SWD1' },
        { id: 'P12', name: 'Pad 12', kind: 'pad', basePath: '[default]Mesa/P12' },
        { id: 'P14', name: 'Pad 14', kind: 'pad', basePath: '[default]Mesa/P14' },
        { id: 'P14-2H', name: 'P14-2H', kind: 'well', basePath: '[default]Mesa/P14/P14-2H' },
        { id: 'P14-L', name: 'P14 lateral', kind: 'line', basePath: '[default]Mesa/P14/Lateral' },
        { id: 'PT1', name: 'PT-1', kind: 'tap', basePath: '[default]Mesa/PT1' },
        { id: 'LSWD', name: 'L-SWD', kind: 'line', basePath: '[default]Mesa/Lines/LSWD' },
        { id: 'FENCE', name: 'Lease', kind: 'geofence', basePath: '[edge]Mesa/Lease/' },
        { id: 'K1', name: 'Kermit 1', kind: 'pad', basePath: '[default]Kermit/K1' }
    ];
    const NAMES: AssetName[] = ASSETS.map((a) => ({ id: a.id, name: a.name }));
    const ITEMS = [
        item('ctb', 'CTB1', 'pad', { assetId: 'CTB1' }), item('swd', 'SWD1', 'pad', { assetId: 'SWD1' }),
        item('p12', 'Point 1', 'pad', { assetId: 'P12' }), item('p14', 'P14', 'pad', { assetId: 'P14' }),
        item('well', 'P14-2H', 'well', { assetId: 'P14-2H' }), item('lat', 'P14 lateral', 'line', { assetId: 'P14-L' }),
        item('pt1', 'PT-1', 'tap', { assetId: 'PT1' }), item('lswd', 'L-SWD', 'line', { assetId: 'LSWD' }),
        item('fence', 'Lease', 'geofence', { assetId: 'FENCE' }), item('k1', 'K1', 'pad', { assetId: 'K1' }),
        item('s1', 'Scale 1', 'pad', { assetId: null }), item('s2', 'Scale 2', 'pad', { assetId: null }),
        item('ghost', 'Ghost', 'pad', { assetId: 'P99' })
    ];
    const CHANGED: Record<string, LastChange> = {
        ctb: { actor: 'sam', at: '2026-11-08T16:42:00Z' }, swd: { actor: 'alex', at: '2026-11-07T15:00:00Z' },
        p12: { actor: 'sam', at: '2026-11-01T12:00:00Z' }
    };
    // Point 1 in alarm, P14-2H (a child of P14) stale.
    const ALARM_LIVE: LiveState = {
        ...LIVE_INITIAL,
        display: { pad: LIVE.display.pad, well: { ...LIVE.display.pad, kindId: 'well' } },
        items: { p12: { ...LIVE.items.p1, id: 'p12' }, well: { ...LIVE.items.p3, id: 'well' } }
    };
    const NOW = new Date('2026-11-08T18:00:00Z');
    const rows = (live: LiveState = LIVE_INITIAL) => listRows(ITEMS, KINDS, live, NAMES, true, { assets: ASSETS, changed: CHANGED });
    const view = (extra: Partial<ListView> = {}): ListView =>
        ({ sort: 'attention', kind: null, query: '', justAdded: [], unlinkedOnly: false, now: NOW, ...extra });
    /** The layout in short: "# LABEL | right", "-- All normal", or "<indent>name (note)". */
    const lines = (items: ListItem[]): string[] => items.map((i) => i.type === 'header'
        ? (i.level === 'sub' ? '## ' : '# ') + i.label + (i.right ? ' | ' + i.right : '')
        : i.type === 'divider' ? '-- ' + i.label
            : '  '.repeat(i.depth) + i.row.name + (i.note ? ' (' + i.note + ')' : '') + (i.context ? ' [context]' : ''));

    test('a place is the asset base path without the provider prefix', () => {
        expect(placePath('[default]Mesa/P14/P14-2H')).toBe('Mesa/P14/P14-2H');
        expect(placePath('[edge]Mesa/Lease/')).toBe('Mesa/Lease');
        expect(placePath('Mesa//P12')).toBe('Mesa/P12');
        expect(placePath('[default]')).toBeNull();
        expect(placePath(undefined)).toBeNull();
        const byId = Object.fromEntries(rows().map((r) => [r.id, r]));
        expect(byId.well.assetPath).toBe('Mesa/P14/P14-2H');
        expect(byId.s1.assetPath).toBeNull();
        expect(byId.ghost.assetPath).toBeNull();
        expect(byId.fence.area).toBe(true);
        expect(byId.ctb.changed).toEqual(CHANGED.ctb);
        expect(byId.k1.changed).toBeNull();
    });

    test('the parent is the item whose asset path is the longest proper prefix, segment by segment', () => {
        const parents = parentsOf(rows());
        expect(parents.get('well')?.id).toBe('p14');
        expect(parents.get('lat')?.id).toBe('p14');
        expect(parents.get('pt1')).toBeUndefined();
        expect(parents.has('p14')).toBe(false);
        // A deeper item nests under the nearest one: P14-2H/Tubing under P14-2H, not P14.
        const deep = listRows(ITEMS.concat([item('tub', 'Tubing', 'well', { assetId: 'TUB' })]), KINDS, LIVE_INITIAL,
            NAMES.concat([{ id: 'TUB', name: 'Tubing' }]), true,
            { assets: ASSETS.concat([{ id: 'TUB', name: 'Tubing', kind: 'well', basePath: '[default]Mesa/P14/P14-2H/Tubing' }]) });
        expect(parentsOf(deep).get('tub')?.id).toBe('well');
        // Mesa/P1 is no prefix of Mesa/P14: whole segments only.
        const p1 = listRows([item('a', 'P1', 'pad', { assetId: 'A1' }), item('b', 'P14', 'pad', { assetId: 'A2' })], KINDS, LIVE_INITIAL, [], false,
            { assets: [{ id: 'A1', name: 'a', kind: 'pad', basePath: 'Mesa/P1' }, { id: 'A2', name: 'b', kind: 'pad', basePath: 'Mesa/P14' }] });
        expect(parentsOf(p1).size).toBe(0);
    });

    test('Place: fields by name, sites with their children indented, Field-wide for lines and areas, Not linked last', () => {
        expect(lines(groupRows(rows(), view({ sort: 'place' })))).toEqual([
            '# KERMIT FIELD', 'K1',
            '# MESA FIELD', 'CTB1', 'P14', '  P14 lateral (on P14)', '  P14-2H (on P14)', 'Point 1', 'PT-1', 'SWD1',
            '## Field-wide', 'L-SWD', 'Lease',
            '# Not linked', 'Ghost', 'Scale 1', 'Scale 2'
        ]);
    });

    test('Needs attention: the sites needing attention first, ranked as Needs you, the count, then All normal', () => {
        const items = groupRows(rows(ALARM_LIVE), view());
        expect(lines(items)).toEqual([
            '# KERMIT FIELD', 'K1',
            '# MESA FIELD | 2 NEED ATTENTION', 'Point 1', 'P14', '  P14 lateral (on P14)', '  P14-2H (on P14)',
            '-- All normal', 'CTB1', 'PT-1', 'SWD1',
            '## Field-wide', 'L-SWD', 'Lease',
            '# Not linked', 'Ghost', 'Scale 1', 'Scale 2'
        ]);
        // Only a Field-wide line needing attention: the header counts it, and no divider stands before the first site.
        const lineStale: LiveState = { ...LIVE_INITIAL, display: { line: { ...LIVE.display.pad, kindId: 'line' } },
            items: { lswd: { ...LIVE.items.p3, id: 'lswd' } } };
        const wideOnly = lines(groupRows(rows(lineStale), view()));
        expect(wideOnly.slice(2, 4)).toEqual(['# MESA FIELD | 1 NEED ATTENTION', 'CTB1']);
        expect(wideOnly).not.toContain('-- All normal');
        // The default sort with nothing needing attention: no count and no divider.
        expect(lines(groupRows(rows(), view())).slice(2, 4)).toEqual(['# MESA FIELD', 'CTB1']);
        // Rows keep the badge they have, live: the alarm row is the alarm.
        expect(entriesOf(items).find((e) => e.row.id === 'p12')?.row.badge).toBe('alarm');
    });

    test('Just added heads the list newest first in every sort, and is nowhere else', () => {
        for (const sort of ['attention', 'place', 'kind', 'name', 'changed'] as ListSort[]) {
            const items = groupRows(rows(), view({ sort, justAdded: ['s2', 'lswd'] }));
            expect(lines(items).slice(0, 3)).toEqual(['# Just added', 'Scale 2', 'L-SWD']);
            expect(entriesOf(items).filter((e) => e.row.id === 's2' || e.row.id === 'lswd')).toHaveLength(2);
        }
        // A parent just added shows once, in Just added; its children keep their indent and "on P14" in its field, with no second
        // P14 row (entry 7a's review: one row per item id), in every sort and under a search or a filter too.
        for (const sort of ['attention', 'place'] as ListSort[]) {
            for (const extra of [{}, { query: '2h' }, { kind: 'well' }] as Array<Partial<ListView>>) {
                const items = groupRows(rows(), view({ sort, justAdded: ['p14'], ...extra }));
                const ids = entriesOf(items).map((e) => e.row.id);
                expect(new Set(ids).size).toBe(ids.length);
                expect(lines(items)).not.toContain('P14 [context]');
                expect(lines(items)).toContain('  P14-2H (on P14)');
            }
        }
        expect(lines(groupRows(rows(), view({ sort: 'place', justAdded: ['p14'] }))).slice(0, 2)).toEqual(['# Just added', 'P14']);
        expect(lines(groupRows(rows(), view({ sort: 'place', justAdded: ['p14'] })))).toEqual(expect.arrayContaining([
            '  P14 lateral (on P14)', '  P14-2H (on P14)']));
        // An id no longer on the map (an add undone, the delegate dropping it later) shows nothing.
        expect(lines(groupRows(rows(), view({ justAdded: ['gone'] })))[0]).toBe('# KERMIT FIELD');
    });

    test('Kind, Name and Last changed are flat; Last changed newest first with who and when', () => {
        expect(lines(groupRows(rows(), view({ sort: 'name' })))).toEqual(['CTB1', 'Ghost', 'K1', 'L-SWD', 'Lease', 'P14', 'P14 lateral',
            'P14-2H', 'Point 1', 'PT-1', 'Scale 1', 'Scale 2', 'SWD1']);
        expect(lines(groupRows(rows(), view({ sort: 'kind' })))).toEqual(['# Gathering line', 'L-SWD', 'P14 lateral', '# Geofence', 'Lease',
            '# Tap', 'PT-1', '# Well', 'P14-2H', '# Well pad', 'CTB1', 'Ghost', 'K1', 'P14', 'Point 1', 'Scale 1', 'Scale 2', 'SWD1']);
        const changed = entriesOf(groupRows(rows(), view({ sort: 'changed' })));
        expect(changed.slice(0, 3).map((e) => e.row.name)).toEqual(['CTB1', 'SWD1', 'Point 1']);
        expect(changed[0].note).toBe('sam - ' + whenText('2026-11-08T16:42:00Z', NOW));
        expect(changed[3].note).toBe('');
        expect(changed.slice(3).map((e) => e.row.name)).toEqual(['Ghost', 'K1', 'L-SWD', 'Lease', 'P14', 'P14 lateral', 'P14-2H', 'PT-1',
            'Scale 1', 'Scale 2']);
    });

    test('the when of a change: Today, Yesterday, else the locale short date', () => {
        const now = new Date(2026, 10, 8, 18, 0);
        expect(whenText(new Date(2026, 10, 8, 10, 42).toISOString(), now)).toBe('Today 10:42');
        expect(whenText(new Date(2026, 10, 7, 9, 5).toISOString(), now)).toBe('Yesterday 09:05');
        const older = new Date(2026, 10, 1, 9, 5);
        expect(whenText(older.toISOString(), now)).toBe(older.toLocaleDateString(undefined, { dateStyle: 'short' } as Intl.DateTimeFormatOptions));
        expect(whenText('nonsense', now)).toBe('');
        expect(changedText({ actor: 'Sam', at: new Date(2026, 10, 8, 10, 42).toISOString() }, now)).toBe('Sam - Today 10:42');
        expect(changedText({ actor: '', at: new Date(2026, 10, 8, 10, 42).toISOString() }, now)).toBe('Today 10:42');
        expect(changedText(null, now)).toBe('');
    });

    test('Filter keeps one kind in every sort; the chips name each kind on the map with its count', () => {
        expect(kindChips(rows()).map((c) => c.label + ' ' + c.count)).toEqual(['All 13', 'Gathering line 2', 'Geofence 1', 'Tap 1',
            'Well 1', 'Well pad 8']);
        expect(kindChips(rows())[0].id).toBeNull();
        for (const sort of ['attention', 'place', 'kind', 'name', 'changed'] as ListSort[]) {
            // Every row the Filter keeps is a line; a parent of another kind shows only as context, in the place sorts.
            const shown = entriesOf(groupRows(rows(), view({ sort, kind: 'line', justAdded: ['s1'] }))).filter((e) => !e.context)
                .map((e) => e.row.kindId);
            expect(shown.length).toBeGreaterThan(0);
            expect(shown.every((k) => k === 'line')).toBe(true);
        }
        // A well whose pad the Filter leaves out keeps its place: under its pad, shown as context (entry 7a's review).
        expect(lines(groupRows(rows(), view({ sort: 'place', kind: 'well' })))).toEqual(['# MESA FIELD', 'P14 [context]', '  P14-2H (on P14)']);
        // A line child (P14 lateral) under Filter Gathering line stays under P14, not in Field-wide.
        expect(lines(groupRows(rows(), view({ sort: 'place', kind: 'line' })))).toEqual(['# MESA FIELD', 'P14 [context]',
            '  P14 lateral (on P14)', '## Field-wide', 'L-SWD']);
    });

    test('Search items filters within the grouping; a matching child shows under its site row', () => {
        expect(lines(groupRows(rows(), view({ sort: 'place', query: 'swd' })))).toEqual(['# MESA FIELD', 'SWD1', '## Field-wide', 'L-SWD']);
        expect(lines(groupRows(rows(), view({ sort: 'place', query: '2h' })))).toEqual(['# MESA FIELD', 'P14 [context]', '  P14-2H (on P14)']);
        expect(lines(groupRows(rows(), view({ sort: 'name', query: 'swd' })))).toEqual(['L-SWD', 'SWD1']);
        expect(groupRows(rows(), view({ query: 'zzz' }))).toEqual([]);
    });

    test('the footer counts the Not linked rows, and its filter keeps them alone', () => {
        expect(unlinkedCount(rows())).toBe(3);
        expect(unlinkedLabel(3)).toBe('3 unlinked');
        expect(lines(groupRows(rows(), view({ unlinkedOnly: true })))).toEqual(['# Not linked', 'Ghost', 'Scale 1', 'Scale 2']);
        expect(lines(groupRows(rows(), view({ sort: 'name', unlinkedOnly: true })))).toEqual(['Ghost', 'Scale 1', 'Scale 2']);
    });

    test('without the asset list every row is Not linked; keys are unique', () => {
        const bare = listRows(ITEMS, KINDS, LIVE_INITIAL);
        expect(lines(groupRows(bare, view({ sort: 'place' })))[0]).toBe('# Not linked');
        const keys = groupRows(rows(), view({ justAdded: ['s1'] })).map((i) => i.key);
        expect(new Set(keys).size).toBe(keys.length);
    });
});
