import { Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import { buildFeatures } from '../features';
import { lengthM } from '../geometry';
import { LIVE_INITIAL, LiveState, LiveValue, readSegmentSlot, readValuesBatch, segmentState } from '../live';
import { MarkerColors } from '../markers';

/** The segment features of a line with instruments (epic 3 entry 2): cut at the measuring instruments, graded by the batch. */

const COLORS: MarkerColors = {
    disc: 'd', glyph: 'g', halo: 'h', textSecondary: 's', line: 'l', chipEdge: 'c', selection: 'sel',
    commsLost: 'cl', alarm: ['a1', 'a2', 'a3'], font: 'f', attention: 'att', warning: 'warn', fault: 'flt',
    tints: ['t1', 't2', 't3', 't4', 't5', 't6']
};
const KINDS: Kind[] = [
    { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] },
    { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 5, fields: [] },
    { id: 'tap', name: 'Tap', geometry: 'point', icon: 'tap', labelRank: 2, fields: [], instrument: true },
    { id: 'valve', name: 'Line valve', geometry: 'point', icon: 'line-valve', labelRank: 2, fields: [], instrument: true }
];
const SWD: Array<[number, number]> = [[-104.958, 39.7265], [-104.948, 39.723], [-104.925174, 39.719902]];

function item(id: string, kind: string, name: string, geometry: MapItemRecord['geometry'], extra: Partial<MapItemRecord> = {}): MapItemRecord {
    return { id, kind, name, geometry, properties: {}, assetId: null, overrides: {}, ends: null, attachment: null, version: 1, deleted: false, ...extra };
}
const LINE = item('l', 'line', 'L-SWD', { type: 'LineString', coordinates: SWD },
    { properties: { diameter: 6 }, ends: { start: { itemId: 'ctb1' }, end: { itemId: 'swd1' } } });
const CTB1 = item('ctb1', 'pad', 'CTB1', { type: 'Point', coordinates: SWD[0] });
const SWD1 = item('swd1', 'pad', 'SWD1', { type: 'Point', coordinates: SWD[2] });
const PT1 = item('pt1', 'tap', 'PT-1', { type: 'Point', coordinates: [-104.945658, 39.722682] }, { attachment: { lineId: 'l', distanceM: 1143 } });
const LV1 = item('lv1', 'valve', 'LV-1', { type: 'Point', coordinates: [-104.93579, 39.721343] }, { attachment: { lineId: 'l', distanceM: 2000 } });
const PT2 = item('pt2', 'tap', 'PT-2', { type: 'Point', coordinates: [-104.926107, 39.720029] }, { attachment: { lineId: 'l', distanceM: 2841 } });
const ITEMS = [LINE, CTB1, SWD1, PT1, LV1, PT2];
const good = (value: unknown): LiveValue => ({ value, quality: 'Good', t: null, stale: false, reason: '' });
const PSI = { key: 'pressure', label: 'Pressure', unit: 'psi', icon: true, on: true };
const DISPLAY: LiveState['display'] = {
    tap: { kindId: 'tap', comms: true, kpis: [PSI], alarms: { on: true, count: true, summary: true }, link: '' },
    valve: { kindId: 'valve', comms: true, kpis: [{ key: 'position', label: 'Position', unit: '%', icon: false, on: true }], alarms: { on: false, count: true, summary: true }, link: '' },
    line: { kindId: 'line', comms: false, kpis: [], alarms: { on: true, count: true, summary: true }, link: '',
        styleRule: { type: 'instruments', source: 'instruments', cases: [] } }
};
const segment = (from: string, to: string, preset: 'normal' | 'attention' | 'fault', stale = false, alarm: { active: number; unacked: number; priority: number } | null = null) =>
    ({ from, to, preset, stale, reason: stale ? 'PT-1: comms lost' : '', alarm });

describe('segment features (epic 3 entry 2)', () => {
    test('a line with instruments is one feature per segment between its measuring instruments, each as the Gateway graded it', () => {
        const live: LiveState = { ...LIVE_INITIAL, display: DISPLAY, items: {
            l: { id: 'l', kpis: {}, style: { preset: 'attention', stale: false, reason: '' }, problems: [],
                segments: [segment('ctb1', 'pt1', 'normal'), segment('pt1', 'pt2', 'attention'), segment('pt2', 'swd1', 'attention')] },
            pt1: { id: 'pt1', comms: good(true), kpis: { pressure: good(398) }, problems: [] },
            pt2: { id: 'pt2', comms: good(true), kpis: { pressure: good(500) }, problems: [] }
        } };
        const out = buildFeatures(ITEMS, KINDS, live, null, COLORS);
        expect(out.lines.features).toHaveLength(3);
        expect(out.lineItems).toBe(1);
        expect(out.lines.features.map((f) => [f.properties.from, f.properties.to, f.properties.hue, f.properties.dashed, f.properties.weight])).toEqual([
            ['ctb1', 'pt1', '', false, 4], ['pt1', 'pt2', 'attention', false, 4], ['pt2', 'swd1', 'attention', false, 4]
        ]);
        expect(out.lines.features.every((f) => f.properties.id === 'l')).toBe(true);
        expect(lengthM(out.lines.features[0].geometry.coordinates as Array<[number, number]>)).toBeCloseTo(1143, 0);
        // The midpoint mark is the whole line's; its chip carries the line's own style word.
        expect(out.marks.features).toHaveLength(1);
        expect(out.marks.features[0].properties.label).toBe('L-SWD Attention');
        // The instruments draw as instrument markers at their places; the valve too.
        const pt1 = out.points.features.find((f) => f.properties.id === 'pt1')!;
        expect(pt1.properties.marker).toMatch(/,true\]$/);
        expect(pt1.geometry.coordinates).toEqual(PT1.geometry.coordinates);
        expect(out.points.features.find((f) => f.properties.id === 'lv1')!.properties.marker).toContain('"line-valve"');
        expect(out.points.features.find((f) => f.properties.id === 'ctb1')!.properties.marker).toMatch(/"normal"\]$/);
    });

    test('a stale end dashes its segments, an end alarm colours them, the line\'s own alarm colours the whole line', () => {
        const stale: LiveState = { ...LIVE_INITIAL, display: DISPLAY, items: {
            l: { id: 'l', kpis: {}, style: { preset: 'normal', stale: true, reason: 'PT-1: comms lost' }, problems: [],
                segments: [segment('ctb1', 'pt1', 'normal', true), segment('pt1', 'pt2', 'normal', true), segment('pt2', 'swd1', 'normal')] }
        } };
        const dashed = buildFeatures(ITEMS, KINDS, stale, null, COLORS);
        expect(dashed.lines.features.map((f) => f.properties.dashed)).toEqual([true, true, false]);
        expect(dashed.marks.features[0].properties.label).toBe('L-SWD Stale');
        const alarmed: LiveState = { ...LIVE_INITIAL, display: DISPLAY, items: {
            l: { id: 'l', kpis: {}, style: { preset: 'fault', stale: false, reason: '' }, problems: [],
                segments: [segment('ctb1', 'pt1', 'normal'), segment('pt1', 'pt2', 'fault', false, { active: 1, unacked: 1, priority: 1 }),
                    segment('pt2', 'swd1', 'fault', false, { active: 1, unacked: 1, priority: 1 })] }
        } };
        const hued = buildFeatures(ITEMS, KINDS, alarmed, null, COLORS);
        expect(hued.lines.features.map((f) => f.properties.color)).toEqual(['l', 'a1', 'a1']);
        expect(hued.marks.features[0].properties.badge).toBe('');
        // The line's own alarm: every segment in its hue, the badge at the midpoint.
        const own: LiveState = { ...alarmed, items: { l: { ...alarmed.items.l, alarms: good({ active: 1, unacked: 0, priority: 2 }) } } };
        const whole = buildFeatures(ITEMS, KINDS, own, null, COLORS);
        expect(whole.lines.features.map((f) => f.properties.color)).toEqual(['a2', 'a2', 'a2']);
        expect(whole.marks.features[0].properties.badge).toContain('alarm-2-acknowledged');
    });

    test('the open segment is marked and its two instruments take the ring; a line without the slot keeps its own look', () => {
        const live: LiveState = { ...LIVE_INITIAL, display: { ...DISPLAY, line: { ...DISPLAY.line, styleRule: undefined } }, items: {
            l: { id: 'l', kpis: {}, problems: [] }
        } };
        const out = buildFeatures(ITEMS, KINDS, live, { id: 'l', kind: 'line', segment: { fromId: 'pt1', toId: 'pt2' } }, COLORS);
        expect(out.lines.features.map((f) => [f.properties.selected, f.properties.segmentSelected])).toEqual([[true, false], [true, true], [true, false]]);
        expect(out.lines.features.every((f) => f.properties.hue === '' && !f.properties.dashed)).toBe(true);
        const selected = out.points.features.filter((f) => f.properties.selected).map((f) => f.properties.id).sort();
        expect(selected).toEqual(['pt1', 'pt2']);
        expect(out.arrow.features).toHaveLength(1);
        // No instruments: one feature, start to end, the thin neutral look.
        const bare = buildFeatures([LINE, CTB1, SWD1], KINDS, live, null, COLORS);
        expect(bare.lines.features).toHaveLength(1);
        expect(bare.lines.features[0].properties).toMatchObject({ from: 'ctb1', to: 'swd1', weight: 2, segmentSelected: false });
    });

    test('the segments slot is read from a batch and a graded segment\'s state draws as stale, preset or alarm', () => {
        const body = readValuesBatch({ seq: 1, full: false, items: [{ id: 'l', kpis: {}, problems: [],
            segments: [segment('a', 'b', 'attention'), { from: 'b', to: 'c', preset: 'nope', stale: false }, segment('c', 'd', 'normal', true, { active: 1, unacked: 0, priority: 2 })] }] })!;
        expect(body.items[0].segments).toHaveLength(2);
        expect(body.items[0].segments![1]).toEqual({ from: 'c', to: 'd', preset: 'normal', stale: true, reason: 'PT-1: comms lost', alarm: { active: 1, unacked: 0, priority: 2 } });
        expect(readSegmentSlot({ from: 'a', to: 'b', preset: 'fault', stale: false })).toEqual({ from: 'a', to: 'b', preset: 'fault', stale: false, reason: '', alarm: null });
        expect(readSegmentSlot({ from: 'a', preset: 'fault', stale: false })).toBeNull();
        expect(segmentState(segment('a', 'b', 'attention'))).toMatchObject({ stale: false, badge: 'normal', preset: 'attention', alarm: null });
        expect(segmentState(segment('a', 'b', 'attention', true))).toMatchObject({ stale: true, badge: 'stale', preset: 'normal' });
        expect(segmentState(segment('a', 'b', 'fault', false, { active: 2, unacked: 1, priority: 1 }))).toMatchObject({
            badge: 'alarm', preset: 'fault', alarm: { priority: 1, unacked: true, active: 2, stale: false }
        });
    });
});
