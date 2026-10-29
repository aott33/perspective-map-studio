import { Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import { KindDisplay, LIVE_INITIAL, LiveState, LiveValue } from '../live';
import { ALL_OK, countParts, countText, needsYou, summaryText, total } from '../needsyou';

const T = '2026-10-28T10:00:00Z';
const NOW = Date.parse('2026-10-28T10:04:00Z');

const good = (value: unknown): LiveValue => ({ value, quality: 'Good', t: T, stale: false, reason: '' });
const stale = (value: unknown, reason: string, t: string | null = T): LiveValue => ({ value, quality: 'Bad', t, stale: true, reason });

const PAD: Kind = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] };
const LINE: Kind = { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 5, fields: [] };

const PAD_DISPLAY: KindDisplay = {
    kindId: 'pad', comms: true,
    kpis: [{ key: 'pressure', label: 'Pressure', unit: 'psi', icon: true, on: true }, { key: 'flow', label: 'Flow', unit: '', icon: false, on: true }],
    alarms: { on: true, count: true, summary: true }, link: ''
};
const LINE_DISPLAY: KindDisplay = {
    kindId: 'line', comms: false, kpis: [{ key: 'flow', label: 'Flow', unit: '', icon: true, on: true }],
    alarms: { on: false, count: true, summary: true }, link: ''
};

function point(id: string, name: string, kind = 'pad', deleted = false): MapItemRecord {
    return { id, kind, name, geometry: { type: 'Point', coordinates: [-104.97, 39.74] }, properties: {}, assetId: null,
        overrides: {}, ends: null, attachment: null, version: 1, deleted };
}

function line(id: string, name: string): MapItemRecord {
    return { id, kind: 'line', name, geometry: { type: 'LineString', coordinates: [[-104.97, 39.74], [-104.96, 39.75]] }, properties: {},
        assetId: null, overrides: {}, ends: null, attachment: null, version: 1, deleted: false };
}

const ITEMS = [point('a', 'Pad A'), point('b', 'Pad B'), point('c', 'Pad C'), point('d', 'Pad D'), point('e', 'Pad E'),
    point('f', 'Pad F'), point('gone', 'Pad gone', 'pad', true), line('l', 'Line L'), point('n', 'Pad N')];

function live(items: LiveState['items']): LiveState {
    return { ...LIVE_INITIAL, items, display: { pad: PAD_DISPLAY, line: LINE_DISPLAY } };
}

describe('the Needs you summary (epic 3 entry 3)', () => {
    test('nothing to attend to reads All OK', () => {
        const s = needsYou(ITEMS, [PAD, LINE], live({ n: { id: 'n', comms: good(true), kpis: { pressure: good(400) }, alarms: good({ active: 0, unacked: 0, priority: 0 }), problems: [] } }), NOW);
        expect(s.rows).toEqual([]);
        expect(s.counts).toEqual({ alarm: 0, commsLost: 0, stale: 0 });
        expect(summaryText(s.counts)).toBe(ALL_OK);
        expect(total(s.counts)).toBe(0);
        expect(needsYou(ITEMS, [PAD, LINE], LIVE_INITIAL, NOW).rows).toEqual([]);
    });

    test('counts once per item in its worst state, ranked alarms by priority (unacknowledged first), then comms lost, then stale, by name', () => {
        const s = needsYou(ITEMS, [PAD, LINE], live({
            // A priority 2 alarm, unacknowledged.
            a: { id: 'a', comms: good(true), kpis: { pressure: good(950) }, alarms: good({ active: 1, unacked: 1, priority: 2 }), problems: [] },
            // A priority 1 alarm, acknowledged, with its comms lost too: counted once, as an alarm.
            b: { id: 'b', comms: stale(true, 'comms lost'), kpis: { pressure: stale(950, 'comms lost') },
                alarms: { ...good({ active: 2, unacked: 0, priority: 1 }), stale: true, reason: 'comms lost' }, problems: [] },
            // A priority 1 alarm, unacknowledged: first of all.
            c: { id: 'c', comms: good(true), kpis: { pressure: good(950) }, alarms: good({ active: 1, unacked: 1, priority: 1 }), problems: [] },
            // Comms lost (the slot says false), heard 4 min ago.
            d: { id: 'd', comms: good(false), kpis: { pressure: stale(400, 'comms lost') }, alarms: stale(null, 'comms lost'), problems: [] },
            // Comms lost with no value ever (the tag was not found).
            e: { id: 'e', comms: stale(null, 'the tag was not found', null), kpis: {}, problems: [{ slot: 'comms', reason: 'the tag was not found' }] },
            // Stale: a key value at bad quality, comms fine.
            f: { id: 'f', comms: good(true), kpis: { pressure: stale(400, 'Bad_Stale'), flow: good(1) }, alarms: good({ active: 0, unacked: 0, priority: 0 }), problems: [] },
            // A stale line (its icon KPI never delivered).
            l: { id: 'l', kpis: { flow: stale(null, 'no value yet', null) }, problems: [] },
            // Normal.
            n: { id: 'n', comms: good(true), kpis: { pressure: good(400) }, alarms: good({ active: 0, unacked: 0, priority: 0 }), problems: [] },
            // Deleted items never count, whatever their values say.
            gone: { id: 'gone', comms: good(false), kpis: {}, problems: [] }
        }), NOW);
        expect(s.counts).toEqual({ alarm: 3, commsLost: 2, stale: 2 });
        expect(s.highestPriority).toBe(1);
        expect(s.rows.map((r) => r.id)).toEqual(['c', 'b', 'a', 'd', 'e', 'l', 'f']);
        expect(s.rows.map((r) => r.state)).toEqual(['alarm', 'alarm', 'alarm', 'comms-lost', 'comms-lost', 'stale', 'stale']);
        expect(s.rows.map((r) => r.glyph)).toEqual(['alarm-1-unacknowledged', 'alarm-1-acknowledged', 'alarm-2-unacknowledged',
            'comms-lost', 'comms-lost', 'stale', 'stale']);
        expect(s.rows.map((r) => r.words)).toEqual(['Priority 1 alarm, unacknowledged', 'Priority 1 alarm, acknowledged',
            'Priority 2 alarm, unacknowledged', 'Comms lost', 'Comms lost', 'Stale value', 'Stale value']);
        expect(s.rows.map((r) => r.detail)).toEqual(['1 alarm - 4 min ago', '2 alarms - 4 min ago - Comms lost', '1 alarm - 4 min ago',
            'Last heard 4 min ago', 'No value yet - The tag was not found', 'Flow - No value yet', 'Pressure - last 4 min ago']);
        expect(s.rows[0]).toMatchObject({ name: 'Pad C', kindName: 'Well pad', icon: 'well-pad', geometry: 'point', priority: 1 });
        expect(s.rows[5]).toMatchObject({ name: 'Line L', kindName: 'Gathering line', icon: 'pipeline', geometry: 'line', priority: 0 });
        expect(summaryText(s.counts)).toBe('Needs you 7: 3 alarms, 2 comms lost, 2 stale');
        expect(countParts({ alarm: 0, commsLost: 1, stale: 0 })).toEqual([{ kind: 'comms-lost', text: '1 comms lost' }]);
        expect(summaryText({ alarm: 1, commsLost: 1, stale: 1 })).toBe('Needs you 3: 1 alarm, 1 comms lost, 1 stale');
        expect(countText('stale', 3)).toBe('3 stale');
    });

    test('an item whose kind has no display, or that has no values, never counts', () => {
        const s = needsYou([point('x', 'X', 'unknown')], [PAD], { ...LIVE_INITIAL, items: { x: { id: 'x', comms: good(false), kpis: {}, problems: [] } }, display: { pad: PAD_DISPLAY } }, NOW);
        expect(s.rows).toEqual([]);
    });
});
