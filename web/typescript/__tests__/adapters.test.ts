import { NO_HOST_LISTS, readAdapterStatus, readAsset, readHostLists, readKind } from '../adapters';
import { readMapLoadReply } from '../contract';

const OK = { status: 'ok', message: '3 kinds from mapstudio_dev.kinds.', function: 'mapstudio_dev.kinds', count: 3, left: 0,
    refreshedAt: '2026-10-26T10:00:00Z' };
const PAD = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10,
    fields: [{ key: 'status', label: 'Status', type: 'choice', required: true, choices: ['producing', 'shut in'] }] };
const P12 = { id: 'P12', name: 'Pad 12', kind: 'pad', basePath: '[default]Mesa/P12' };

describe('host lists in map.load', () => {
    test('kinds, assets and both statuses are read', () => {
        const lists = readHostLists({ kinds: [PAD], assets: [P12], adapters: { kinds: OK, assets: { ...OK, function: 'a.b' } } });
        expect(lists.kinds).toEqual([PAD]);
        expect(lists.assets).toEqual([P12]);
        expect(lists.adapters?.kinds.status).toBe('ok');
        expect(lists.adapters?.assets.function).toBe('a.b');
    });

    test('instrument marks a point kind, sent only when true (epic 2 story 14)', () => {
        const tap = { id: 'tap', name: 'Tap', geometry: 'point', icon: 'tap', labelRank: 0, fields: [], instrument: true };
        expect(readKind(tap)).toEqual(tap);
        expect(readKind({ ...tap, instrument: false })).not.toHaveProperty('instrument');
        expect(readKind({ ...tap, instrument: 'yes' })).not.toHaveProperty('instrument');
    });

    test('a viewer gets no assets: null, not an empty list', () => {
        const lists = readHostLists({ kinds: [PAD], adapters: { kinds: OK, assets: OK } });
        expect(lists.assets).toBeNull();
        expect(lists.assetNames).toEqual([]);
        expect(lists.adapters?.assets.count).toBe(3);
    });

    test('assetNames reach every level, id and name alone; an editor\'s asset list fills them from an older Gateway (entry 9)', () => {
        const viewer = readHostLists({ kinds: [PAD], assetNames: [{ id: 'P12', name: 'Pad 12' }, { id: 'P13' }, 'x'] });
        expect(viewer.assets).toBeNull();
        expect(viewer.assetNames).toEqual([{ id: 'P12', name: 'Pad 12' }]);
        const older = readHostLists({ kinds: [PAD], assets: [P12] });
        expect(older.assetNames).toEqual([{ id: 'P12', name: 'Pad 12' }]);
        expect(readHostLists({ kinds: [PAD], assets: [P12], assetNames: [] }).assetNames).toEqual([]);
    });

    test('a Gateway that sends none of them gives no lists', () => {
        expect(readHostLists({})).toEqual(NO_HOST_LISTS);
        expect(readMapLoadReply({ level: 'none', seq: 0, items: [] })?.lists).toEqual(NO_HOST_LISTS);
    });

    test('rows that are not rows are left out; defaults fill optional fields', () => {
        const lists = readHostLists({
            kinds: [PAD, { id: 'x', name: 'X', geometry: 'polygon' }, 'pad', { id: 'line', name: 'Line', geometry: 'line' }],
            assets: [P12, { id: 'P13' }]
        });
        expect(lists.kinds.map((k) => k.id)).toEqual(['pad', 'line']);
        expect(lists.kinds[1]).toEqual({ id: 'line', name: 'Line', geometry: 'line', icon: '', labelRank: 0, fields: [] });
        expect(lists.assets).toEqual([P12]);
        expect(readKind({ ...PAD, fields: [{ key: 'k', type: 'date' }, { key: 'n', type: 'number' }] })?.fields)
            .toEqual([{ key: 'n', label: 'n', type: 'number', required: false, choices: [] }]);
        expect(readAsset(null)).toBeNull();
    });

    test('a status needs a known word and a message', () => {
        expect(readAdapterStatus({ ...OK, status: 'broken' })).toBeNull();
        expect(readAdapterStatus({ status: 'loading', message: 'Loading.' }))
            .toEqual({ status: 'loading', message: 'Loading.', function: '', count: 0, left: 0, refreshedAt: null });
        expect(readHostLists({ adapters: { kinds: OK } }).adapters).toBeNull();
    });
});
