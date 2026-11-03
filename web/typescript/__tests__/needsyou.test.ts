import { Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import { KindDisplay, LIVE_INITIAL, LiveState, LiveValue } from '../live';
import { BAR_QUIET, BAR_UNKNOWN, barKey, barModel, bellLook, countParts, countText, EMPTY_SUMMARY, needsYou, summaryText, total } from '../needsyou';

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
    test('nothing to attend to says so in the hover title only: the bar has no words (item 12)', () => {
        const s = needsYou(ITEMS, [PAD, LINE], live({ n: { id: 'n', comms: good(true), kpis: { pressure: good(400) }, alarms: good({ active: 0, unacked: 0, priority: 0 }), problems: [] } }), NOW);
        expect(s.rows).toEqual([]);
        expect(s.counts).toEqual({ alarm: 0, commsLost: 0, stale: 0 });
        expect(summaryText(s.counts)).toBe(BAR_QUIET);
        expect(BAR_QUIET).not.toContain('All OK');
        expect(bellLook(s)).toEqual({ glyph: 'bell-outline', tone: 'none' });
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
            e: { id: 'e', comms: stale(null, 'Bad_NotFound', null), kpis: {}, problems: [{ slot: 'comms', reason: 'the tag was not found' }] },
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
        expect(s.highestUnackedPriority).toBe(1);
        expect(bellLook(s)).toEqual({ glyph: 'bell', tone: 'p1' });
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

    test('a quality code in the detail reads in plain words (owner review notes item 15)', () => {
        // Comms lost with no value ever and no problem row: the quality name is said in words, not as the code.
        const s = needsYou(ITEMS, [PAD, LINE], live({
            e: { id: 'e', comms: stale(null, 'Bad_NotFound', null), kpis: {}, problems: [] },
            f: { id: 'f', comms: good(true), kpis: { pressure: stale(null, 'Bad_Disabled', null) }, problems: [] }
        }), NOW);
        expect(s.rows.map((r) => r.detail)).toEqual(['No value yet - Tag not found', 'Pressure - Tag disabled']);
    });

    test('an item whose kind has no display, or that has no values, never counts', () => {
        const s = needsYou([point('x', 'X', 'unknown')], [PAD], { ...LIVE_INITIAL, items: { x: { id: 'x', comms: good(false), kpis: {}, problems: [] } }, display: { pad: PAD_DISPLAY } }, NOW);
        expect(s.rows).toEqual([]);
    });

    test('the bell: solid in the hue of the highest unacknowledged priority, neutral and hollow when every alarm is acknowledged (item 12)', () => {
        const pads = [point('a', 'Pad A'), point('b', 'Pad B'), point('c', 'Pad C')];
        const alarm = (id: string, priority: number, unacked: number) => ({ id, comms: good(true), kpis: { pressure: good(950) },
            alarms: good({ active: 1, unacked, priority }), problems: [] });
        // Priority 1 acknowledged, priority 2 and 3 not: the bell takes the priority 2 hue (the highest unacknowledged), the count is all three.
        const mixed = needsYou(pads, [PAD], live({ a: alarm('a', 1, 0), b: alarm('b', 2, 1), c: alarm('c', 3, 1) }), NOW);
        expect(mixed.counts.alarm).toBe(3);
        expect(mixed.highestPriority).toBe(1);
        expect(mixed.highestUnackedPriority).toBe(2);
        expect(bellLook(mixed)).toEqual({ glyph: 'bell', tone: 'p2' });
        // Every alarm acknowledged: neutral and hollow, still counted.
        const acked = needsYou(pads, [PAD], live({ a: alarm('a', 1, 0), b: alarm('b', 2, 0) }), NOW);
        expect(acked.counts.alarm).toBe(2);
        expect(acked.highestUnackedPriority).toBe(0);
        expect(bellLook(acked)).toEqual({ glyph: 'bell-outline', tone: 'acknowledged' });
        // Comms lost alone: the bell is grey and hollow with no alarm.
        const lost = needsYou(pads, [PAD], live({ a: { id: 'a', comms: good(false), kpis: {}, problems: [] } }), NOW);
        expect(lost.counts).toEqual({ alarm: 0, commsLost: 1, stale: 0 });
        expect(bellLook(lost)).toEqual({ glyph: 'bell-outline', tone: 'none' });
        expect(bellLook(EMPTY_SUMMARY)).toEqual({ glyph: 'bell-outline', tone: 'none' });
    });

    test('the bar model: a bell always, comms lost and stale while not zero, words only in the label; unknown is a hollow bell with a question mark (items 12 and 32)', () => {
        const pads = [point('a', 'Pad A'), point('b', 'Pad B'), point('c', 'Pad C')];
        const s = needsYou(pads, [PAD], live({
            a: { id: 'a', comms: good(true), kpis: { pressure: good(950) }, alarms: good({ active: 1, unacked: 1, priority: 2 }), problems: [] },
            b: { id: 'b', comms: good(false), kpis: {}, problems: [] },
            c: { id: 'c', comms: good(true), kpis: { pressure: stale(400, 'Bad_Stale') }, alarms: good({ active: 0, unacked: 0, priority: 0 }), problems: [] }
        }), NOW);
        const m = barModel(s, false);
        expect(m).toEqual({
            state: 'needs', label: 'Needs you 3: 1 alarm, 1 comms lost, 1 stale', bell: 'p2',
            counts: [{ kind: 'alarm', glyph: 'bell', n: '1' }, { kind: 'comms-lost', glyph: 'comms-lost', n: '1' }, { kind: 'stale', glyph: 'stale', n: '1' }]
        });
        // The bar has numbers and glyphs only: no count carries a word.
        expect(m.counts.every((c) => /^[0-9]*$/.test(c.n))).toBe(true);
        // Quiet: one hollow grey bell, no number, the label says so in words for screen readers.
        expect(barModel(EMPTY_SUMMARY, false)).toEqual({ state: 'ok', label: BAR_QUIET, bell: 'none', counts: [{ kind: 'alarm', glyph: 'bell-outline', n: '' }] });
        // Unknown: whatever the last summary was, the bar shows no counts.
        expect(barModel(s, true)).toEqual({ state: 'unknown', label: BAR_UNKNOWN, bell: 'none', counts: [{ kind: 'alarm', glyph: 'bell-outline', n: '?' }] });
        expect(BAR_UNKNOWN).toContain('state unknown');
    });
});

describe('the bar redraws only when its counts or look change (owner re-test R1)', () => {
    const summary = (alarm: number, commsLost: number, stale: number, p = 1, unacked = 1) => ({
        counts: { alarm, commsLost, stale }, rows: [], highestPriority: alarm > 0 ? p : 0, highestUnackedPriority: alarm > 0 ? unacked : 0
    });

    test('the same counts and look give the same key, whatever the rows (a popup opening or closing redraws the map, not the bar)', () => {
        const a = summary(1, 1, 1);
        const b = { ...summary(1, 1, 1), rows: [{ id: 'x' }] as unknown as typeof a.rows };
        expect(barKey(a, false)).toBe(barKey(b, false));
        expect(barKey(EMPTY_SUMMARY, false)).toBe(barKey(summary(0, 0, 0), false));
    });

    test('a changed count, priority, acknowledgement or the unknown state changes the key', () => {
        const base = barKey(summary(1, 1, 1), false);
        expect(barKey(summary(2, 1, 1), false)).not.toBe(base);
        expect(barKey(summary(1, 0, 1), false)).not.toBe(base);
        expect(barKey(summary(1, 1, 0), false)).not.toBe(base);
        expect(barKey(summary(1, 1, 1, 2, 2), false)).not.toBe(base);
        expect(barKey(summary(1, 1, 1, 1, 0), false)).not.toBe(base);
        expect(barKey(summary(1, 1, 1), true)).not.toBe(base);
    });
});
