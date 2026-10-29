import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import { lineNodes, segmentAt, segmentNodes, splitAt } from '../features';
import { lengthM } from '../geometry';
import { LinePopup } from '../LinePopup';
import {
    PopupNode, distanceText, instrumentsComms, instrumentsHeading, lineSubline, nodeValue, popupInstruments, popupNodes, rowName,
    segmentWords
} from '../linePopup';
import { LIVE_INITIAL, LiveState, LiveValue, KindDisplay } from '../live';
import { popupViewParams } from '../popupParams';

/** L-SWD of the plan: 2,922 m from CTB1 to SWD1 with PT-1 at 1,143 m, LV-1 at 2,000 m and PT-2 at 2,841 m. */
const SWD: Array<[number, number]> = [[-104.958, 39.7265], [-104.948, 39.723], [-104.925174, 39.719902]];
const T = '2026-10-28T10:00:00Z';
const NOW = Date.parse('2026-10-28T10:00:09Z');

const KINDS: Kind[] = [
    { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] },
    { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 5, fields: [] },
    { id: 'tap', name: 'Tap', geometry: 'point', icon: 'tap', labelRank: 2, fields: [], instrument: true },
    { id: 'valve', name: 'Line valve', geometry: 'point', icon: 'line-valve', labelRank: 2, fields: [], instrument: true }
];

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
const ITEMS = [LINE, CTB1, SWD1, PT2, LV1, PT1];

const good = (value: unknown): LiveValue => ({ value, quality: 'Good', t: T, stale: false, reason: '' });
const stale = (value: unknown, reason: string): LiveValue => ({ value, quality: 'Bad', t: T, stale: true, reason });
const display = (kindId: string, kpis: KindDisplay['kpis'], comms = true): KindDisplay =>
    ({ kindId, comms, kpis, alarms: { on: kindId === 'tap', count: true, summary: true }, link: '' });
const PSI = { key: 'pressure', label: 'Pressure', unit: 'psi', icon: true, on: true };

const LIVE: LiveState = {
    ...LIVE_INITIAL,
    display: {
        tap: display('tap', [PSI]),
        valve: display('valve', [{ key: 'position', label: 'Position', unit: '%', icon: false, on: true }]),
        pad: display('pad', [PSI]),
        line: display('line', [{ key: 'flow', label: 'Flow', unit: 'bbl/d', icon: true, on: true }], false)
    },
    items: {
        ctb1: { id: 'ctb1', comms: good(true), kpis: { pressure: good(412) }, problems: [] },
        swd1: { id: 'swd1', comms: good(true), kpis: { pressure: good(365) }, problems: [] },
        pt1: { id: 'pt1', comms: good(true), kpis: { pressure: good(398) }, alarms: good({ active: 0, unacked: 0, priority: 0 }), problems: [] },
        pt2: { id: 'pt2', comms: good(true), kpis: { pressure: good(371) }, alarms: good({ active: 0, unacked: 0, priority: 0 }), problems: [] },
        lv1: { id: 'lv1', comms: good(true), kpis: { position: good(100) }, problems: [] },
        l: { id: 'l', kpis: { flow: good(20) }, style: { preset: 'normal', stale: false, reason: '' }, problems: [],
            segments: [{ from: 'ctb1', to: 'pt1', preset: 'normal', stale: false, reason: '', alarm: null },
                { from: 'pt1', to: 'pt2', preset: 'normal', stale: false, reason: '', alarm: null },
                { from: 'pt2', to: 'swd1', preset: 'normal', stale: false, reason: '', alarm: null }] }
    }
};

describe('a line\'s nodes and segments (epic 3 entry 2)', () => {
    test('the nodes in order, the valve bounding no segment, and the segment a distance falls in', () => {
        const nodes = lineNodes(LINE, [PT1, LV1, PT2], LIVE, lengthM(SWD));
        expect(nodes.map((n) => [n.id, n.role, n.measures])).toEqual([
            ['ctb1', 'start', false], ['pt1', 'instrument', true], ['lv1', 'instrument', false], ['pt2', 'instrument', true], ['swd1', 'end', false]
        ]);
        expect(segmentNodes(nodes).map((n) => n.id)).toEqual(['ctb1', 'pt1', 'pt2', 'swd1']);
        expect(segmentAt(nodes, 600)).toEqual({ fromId: 'ctb1', toId: 'pt1' });
        expect(segmentAt(nodes, 1600)).toEqual({ fromId: 'pt1', toId: 'pt2' });
        expect(segmentAt(nodes, 2880)).toEqual({ fromId: 'pt2', toId: 'swd1' });
        // Floating ends and no display: every instrument bounds a segment until the first full batch says otherwise.
        const floating = lineNodes({ ...LINE, ends: null }, [LV1], LIVE_INITIAL, 2922);
        expect(floating.map((n) => n.id)).toEqual(['start', 'lv1', 'end']);
        expect(floating[1].measures).toBe(false);
        expect(segmentAt(floating, 100)).toEqual({ fromId: 'start', toId: 'end' });
    });

    test('the line cut at the measuring instruments keeps its vertices and the cut points', () => {
        const pieces = splitAt(SWD, [1143, 2841]);
        expect(pieces).toHaveLength(3);
        expect(pieces[0][0]).toEqual(SWD[0]);
        expect(pieces[0]).toHaveLength(3);
        expect(pieces[0][1]).toEqual(SWD[1]);
        expect(pieces[0][2][0]).toBeCloseTo(-104.945658, 5);
        expect(pieces[1][0]).toEqual(pieces[0][2]);
        expect(pieces[2][pieces[2].length - 1]).toEqual(SWD[2]);
        expect(lengthM(pieces[0]) + lengthM(pieces[1]) + lengthM(pieces[2])).toBeCloseTo(lengthM(SWD), 3);
        expect(lengthM(pieces[0])).toBeCloseTo(1143, 0);
        // A cut past the end is a two-point piece at the end; no cut is the whole line.
        expect(splitAt(SWD, [5000])[1]).toEqual([SWD[2], SWD[2]]);
        expect(splitAt(SWD, [])).toEqual([SWD]);
    });
});

describe('the line popup\'s words (DESIGN.md line-popup)', () => {
    const nodes = (): PopupNode[] => popupNodes(LINE, ITEMS, KINDS, LIVE, { fromId: 'pt1', toId: 'pt2' });

    test('distances, the subline and the row names', () => {
        expect(distanceText(0)).toBe('0 km');
        expect(distanceText(1143)).toBe('1.1 km');
        expect(distanceText(2922)).toBe('2.9 km');
        expect(distanceText(12345)).toBe('12 km');
        expect(lineSubline('Gathering line', 6, 2922)).toBe('Gathering line - 6 in, 2.9 km');
        expect(lineSubline('Gathering line', undefined, 0)).toBe('Gathering line');
        expect(lineSubline('Gathering line', '4', 500)).toBe('Gathering line - 4 in, 0.5 km');
        const n = nodes();
        expect(n.map(rowName)).toEqual(['CTB1 outlet', 'PT-1', 'LV-1', 'PT-2', 'SWD1 inlet']);
        expect(n.map((x) => x.highlighted)).toEqual([false, true, false, true, false]);
        expect(instrumentsHeading(n)).toBe('Instruments, CTB1 to SWD1');
        const floating = popupNodes({ ...LINE, ends: null }, ITEMS, KINDS, LIVE, null);
        expect(floating.map(rowName)).toEqual(['Line start', 'PT-1', 'LV-1', 'PT-2', 'Line end']);
        expect(instrumentsHeading(floating)).toBe('Instruments');
    });

    test('each row\'s value: the icon KPI, No value for a valve, the stale form, the alarm', () => {
        const n = nodes();
        expect(nodeValue(n[0])).toMatchObject({ text: '412 psi', stale: false, hasValue: true, number: 412, unit: 'psi' });
        expect(nodeValue(n[2])).toMatchObject({ text: 'No value', hasValue: false, number: null });
        const staleLive: LiveState = { ...LIVE, items: { ...LIVE.items,
            pt2: { ...LIVE.items.pt2, kpis: { pressure: stale(371, 'Bad_Stale') } },
            pt1: { ...LIVE.items.pt1, alarms: good({ active: 1, unacked: 1, priority: 1 }) } } };
        const s = popupNodes(LINE, ITEMS, KINDS, staleLive, null);
        expect(nodeValue(s[3])).toMatchObject({ text: 'Stale - 371 psi (last)', stale: true, number: null });
        expect(nodeValue(s[1]).alarm).toEqual({ priority: 1, unacked: true, active: 1, stale: false });
        const lost: LiveState = { ...LIVE, items: { ...LIVE.items,
            pt1: { ...LIVE.items.pt1, comms: good(false), kpis: { pressure: stale(398, 'comms lost') } } } };
        expect(nodeValue(popupNodes(LINE, ITEMS, KINDS, lost, null)[1])).toMatchObject({ text: 'Stale - 398 psi (last)', commsLost: true });
    });

    test('the segment box: the span and the drop, or the stale line naming the instrument', () => {
        const n = nodes();
        expect(segmentWords(n, { fromId: 'pt1', toId: 'pt2' })).toEqual({
            title: 'Segment PT-1 to PT-2', span: '1.1 to 2.8 km', line: '398 to 371 psi - drop 27 psi over 1.7 km', stale: false
        });
        expect(segmentWords(n, { fromId: 'ctb1', toId: 'pt1' })).toEqual({
            title: 'Segment CTB1 outlet to PT-1', span: '0 to 1.1 km', line: '412 to 398 psi - drop 14 psi over 1.1 km', stale: false
        });
        expect(segmentWords(n, null)).toBeNull();
        expect(segmentWords(n, { fromId: 'nope', toId: 'pt1' })).toBeNull();
        const staleLive: LiveState = { ...LIVE, items: { ...LIVE.items, pt2: { ...LIVE.items.pt2, kpis: { pressure: stale(371, 'Bad_Stale') } } } };
        expect(segmentWords(popupNodes(LINE, ITEMS, KINDS, staleLive, null), { fromId: 'pt1', toId: 'pt2' })).toEqual({
            title: 'Segment PT-1 to PT-2', span: '1.1 to 2.8 km', line: 'Stale - drawn dashed until PT-2 updates', stale: true
        });
        const rise: LiveState = { ...LIVE, items: { ...LIVE.items, pt2: { ...LIVE.items.pt2, kpis: { pressure: good(400) } } } };
        expect(segmentWords(popupNodes(LINE, ITEMS, KINDS, rise, null), { fromId: 'pt1', toId: 'pt2' })!.line)
            .toBe('398 to 400 psi - rise 2 psi over 1.7 km');
    });

    test('the comms line over the instruments: OK with the oldest age, or the first stale one', () => {
        expect(instrumentsComms(nodes(), NOW)).toEqual({ word: 'OK', detail: '3 instruments, oldest 9 s ago', lost: false });
        const staleLive: LiveState = { ...LIVE, items: { ...LIVE.items, pt2: { ...LIVE.items.pt2, kpis: { pressure: stale(371, 'Bad_Stale') } } } };
        expect(instrumentsComms(popupNodes(LINE, ITEMS, KINDS, staleLive, null), NOW)).toEqual({ word: 'PT-2 stale', detail: 'last 9 s ago', lost: true });
        const lost: LiveState = { ...LIVE, items: { ...LIVE.items, pt1: { ...LIVE.items.pt1, comms: good(false) } } };
        expect(instrumentsComms(popupNodes(LINE, ITEMS, KINDS, lost, null), NOW)).toEqual({ word: 'PT-1 comms lost', detail: 'last 9 s ago', lost: true });
        expect(instrumentsComms(popupNodes(LINE, [LINE, CTB1, SWD1], KINDS, LIVE, null), NOW)).toBeNull();
    });

    test('the map item object of a custom view carries the ordered instruments and the open segment (AD-7)', () => {
        const instruments = popupInstruments(nodes());
        expect(instruments.map((i) => [i.id, i.name, i.kind, i.distanceM])).toEqual([
            ['pt1', 'PT-1', 'tap', 1143], ['lv1', 'LV-1', 'valve', 2000], ['pt2', 'PT-2', 'tap', 2841]
        ]);
        expect(instruments[0].liveValues).toBe(LIVE.items.pt1);
        const params = popupViewParams({ padName: 'x' }, { id: 'l', name: 'L-SWD', kind: 'line', instruments, segment: { fromId: 'pt1', toId: 'pt2' } },
            null, undefined);
        expect(params.padName).toBe('x');
        expect(params.mapItem).toMatchObject({ id: 'l', name: 'L-SWD', segment: { fromId: 'pt1', toId: 'pt2' } });
        expect((params.mapItem as { instruments: unknown[] }).instruments).toHaveLength(3);
        // A point's map item object (entry 8's shape) carries no instruments and no segment.
        const point = popupViewParams({}, { id: 'p', name: 'P' }, null, undefined).mapItem as Record<string, unknown>;
        expect(point).toMatchObject({ id: 'p', name: 'P' });
        expect(point.instruments).toBeUndefined();
        expect(point.segment).toBeUndefined();
    });

    test('the popup renders the parts in order with the highlighted rows and the values', () => {
        const html = renderToStaticMarkup(React.createElement(LinePopup, {
            line: { id: 'l', name: 'L-SWD', kind: 'line', kindName: 'Gathering line', icon: 'pipeline', diameter: 6, lengthM: 2922 },
            display: LIVE.display.line, values: LIVE.items.l, nodes: nodes(), segment: { fromId: 'pt1', toId: 'pt2' }, now: NOW,
            onClose: () => undefined
        }));
        const parts = Array.from(html.matchAll(/data-part="([a-z]+)"/g)).map((m) => m[1]);
        expect(parts).toEqual(['header', 'segment', 'comms', 'instruments', 'kpis']);
        expect(html).toContain('Gathering line - 6 in, 2.9 km');
        expect(html).toContain('Segment PT-1 to PT-2');
        expect(html).toContain('398 to 371 psi - drop 27 psi over 1.7 km');
        expect(html).toContain('OK - 3 instruments, oldest 9 s ago');
        expect(html).toContain('Instruments, CTB1 to SWD1');
        const rows = Array.from(html.matchAll(/data-row-id="([a-z0-9]+)"[^>]*data-role="([a-z]+)"[^>]*data-highlighted="(true|false)"/g)).map((m) => m.slice(1));
        expect(rows).toEqual([['ctb1', 'start', 'false'], ['pt1', 'instrument', 'true'], ['lv1', 'instrument', 'false'], ['pt2', 'instrument', 'true'], ['swd1', 'end', 'false']]);
        expect(html).toContain('CTB1 outlet');
        expect(html).toContain('SWD1 inlet');
        expect(html).toContain('No value');
        expect(html).toContain('aria-label="Close"');
        expect(html).toContain('data-segment="pt1|pt2"');
        expect(html).toContain('20 bbl/d');
        expect(html).not.toContain('data-part="alarms"');
    });
});
