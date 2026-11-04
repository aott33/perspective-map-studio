// The item list's rows (epic 4 entry 2): every live item by name with its live badge.
import { Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import { LIVE_INITIAL, LiveState, LiveValue } from '../live';
import { badgeWords, listRows } from '../itemList';

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
