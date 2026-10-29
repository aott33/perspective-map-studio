import {
    LIVE_INITIAL, LiveValue, ageText, alarmCountsText, alarmLineText, alarmsText, applyBatch, areaTint, commsText, itemState,
    readKindDisplay, readPopupDetail, readValuesBatch, staleText, valueText
} from '../live';
import { readReply } from '../messages';

const T = '2026-10-28T10:00:00Z';
const NOW = Date.parse('2026-10-28T10:00:12Z');

const good = (value: unknown): LiveValue => ({ value, quality: 'Good', t: T, stale: false, reason: '' });
const stale = (value: unknown, reason: string, quality = 'Good'): LiveValue => ({ value, quality, t: T, stale: true, reason });

const DISPLAY = {
    kindId: 'pad', comms: true,
    kpis: [{ key: 'pressure', label: 'Pressure', unit: 'psi', icon: true, on: true },
        { key: 'flow', label: 'Flow', unit: 'bbl/d', icon: false, on: true },
        { key: 'gas', label: 'Gas price', unit: '', icon: false, on: false }],
    alarms: { on: true, count: true, summary: true }, link: '/pad/{item.name}'
};

const P1 = {
    id: 'p1', comms: good(true), kpis: { pressure: good(412.456), flow: good(80) },
    alarms: good({ active: 1, unacked: 1, priority: 1 }), problems: []
};

describe('values.batch reading (epic 3 entry 5)', () => {
    test('a full batch with its display is read, bad items left out', () => {
        const reply = readReply({ v: 1, type: 'values.batch', id: 'b1', body: {
            seq: 7, full: true, items: [P1, { nope: 1 }, { id: 'p2', kpis: { pressure: { value: 1 } }, problems: 'x' }],
            kindDisplay: [DISPLAY, { kindId: 'line' }] } });
        expect(reply.kind).toBe('values.batch');
        if (reply.kind !== 'values.batch' || !reply.body) {
            throw new Error('unreadable');
        }
        expect(reply.body.seq).toBe(7);
        expect(reply.body.full).toBe(true);
        expect(reply.body.items.map((i) => i.id)).toEqual(['p1', 'p2']);
        expect(reply.body.items[0]).toEqual(P1);
        // A slot without quality and stale is not a LiveValue; the item keeps its id.
        expect(reply.body.items[1]).toEqual({ id: 'p2', kpis: {}, problems: [] });
        expect(reply.body.kindDisplay).toHaveLength(2);
        expect(reply.body.kindDisplay![1]).toEqual({ kindId: 'line', comms: false, kpis: [],
            alarms: { on: false, count: true, summary: true }, link: '' });
    });

    test('a malformed batch reads as null and is never a throw', () => {
        expect(readValuesBatch(null)).toBeNull();
        expect(readValuesBatch({ seq: 1, items: [] })).toBeNull();
        expect(readValuesBatch({ seq: 'x', full: true, items: [] })).toBeNull();
        expect(readReply({ v: 1, type: 'values.batch', id: 'b', body: { seq: 1 } }))
            .toEqual({ kind: 'values.batch', id: 'b', body: null });
        expect(readKindDisplay({})).toBeNull();
    });

    test('a full batch replaces every item and the display; a changes-only batch replaces its items', () => {
        const first = applyBatch(LIVE_INITIAL, { seq: 1, full: true, items: [P1, { ...P1, id: 'p2' }], kindDisplay: [DISPLAY] });
        expect(Object.keys(first.items).sort()).toEqual(['p1', 'p2']);
        expect(first.display.pad).toEqual(DISPLAY);
        expect(first.fulls).toBe(1);
        const changed = { ...P1, kpis: { pressure: good(500) } };
        const second = applyBatch(first, { seq: 2, full: false, items: [changed] });
        expect(second.items.p1).toEqual(changed);
        expect(second.items.p2).toEqual({ ...P1, id: 'p2' });
        expect(second.display.pad).toEqual(DISPLAY);
        expect(second.seq).toBe(2);
        expect(second.batches).toBe(2);
        expect(second.fulls).toBe(1);
        const third = applyBatch(second, { seq: 3, full: true, items: [P1], kindDisplay: [] });
        expect(Object.keys(third.items)).toEqual(['p1']);
        expect(third.display).toEqual({});
    });

    test('the popup detail of a pushed item is kept with its item until the next one (entry 8)', () => {
        const detail = { basePath: '[default]Mesa/P12', alarmsPath: '[default]Mesa/P12',
            alarms: { counts: { 1: 1, 2: 0, 3: 0 }, list: [{ name: 'High pressure', source: 'Pressure', priority: 1, unacked: true, activeTime: T }], reason: '' } };
        const reply = readReply({ v: 1, type: 'values.batch', id: 'b2', body: { seq: 4, full: false, items: [{ ...P1, popup: detail }] } });
        if (reply.kind !== 'values.batch' || !reply.body) {
            throw new Error('unreadable');
        }
        expect(reply.body.items[0].popup).toEqual(detail);
        const pushed = applyBatch(LIVE_INITIAL, reply.body);
        expect(pushed.popup).toEqual({ itemId: 'p1', detail });
        const later = applyBatch(pushed, { seq: 5, full: true, items: [P1], kindDisplay: [DISPLAY] });
        // A batch without a detail keeps the last one.
        expect(later.popup).toEqual({ itemId: 'p1', detail });
        expect(later.items.p1.popup).toBeUndefined();
        // A detail with no alarms part, and a malformed one.
        expect(readPopupDetail({ basePath: null, alarmsPath: null })).toEqual({ basePath: null, alarmsPath: null });
        expect(readPopupDetail({ basePath: 'x', alarmsPath: 'x', alarms: { counts: { 1: 'a' }, list: [{ nope: 1 }, { name: 'A' }], reason: 7 } }))
            .toEqual({ basePath: 'x', alarmsPath: 'x', alarms: { counts: { 1: 0, 2: 0, 3: 0 }, list: [{ name: 'A', source: '', priority: 0, unacked: false, activeTime: null }], reason: '' } });
        expect(readPopupDetail('no')).toBeNull();
        expect(LIVE_INITIAL.popup).toBeNull();
    });

    test('a kind display carries its popup view with text params only; no path, no view (entry 8)', () => {
        const d = readKindDisplay({ ...DISPLAY, popupView: { path: 'Popups/PadAlarms', params: { padName: '{item.name}', n: 1 } } });
        expect(d && d.popupView).toEqual({ path: 'Popups/PadAlarms', params: { padName: '{item.name}' } });
        expect(readKindDisplay({ ...DISPLAY, popupView: { path: '', params: {} } })!.popupView).toBeUndefined();
        expect(readKindDisplay(DISPLAY)!.popupView).toBeUndefined();
    });
});

describe('item state for the icon', () => {
    test('normal with the icon KPI', () => {
        const normal = itemState({ ...P1, alarms: good({ active: 0, unacked: 0, priority: 0 }) }, DISPLAY);
        expect(normal).toEqual({ commsLost: false, stale: false, alarm: null,
            iconKpi: { key: 'pressure', text: '412.5 psi', stale: false, hasValue: true }, badge: 'normal', preset: 'normal' });
    });

    test('the style slot gives the preset; a stale source makes the item stale with no style (entry 1)', () => {
        const quiet = { ...P1, alarms: good({ active: 0, unacked: 0, priority: 0 }) };
        const warning = itemState({ ...quiet, style: { preset: 'warning', stale: false, reason: '' } }, DISPLAY);
        expect(warning.preset).toBe('warning');
        expect(warning.badge).toBe('normal');
        expect(warning.stale).toBe(false);
        const dropped = itemState({ ...quiet, style: { preset: 'normal', stale: true, reason: 'Bad_Stale' } }, DISPLAY);
        expect(dropped.preset).toBe('normal');
        expect(dropped.stale).toBe(true);
        expect(dropped.badge).toBe('stale');
        // An alarm beside a style: both are there; the marker draws the badge over the ring.
        const both = itemState({ ...P1, style: { preset: 'fault', stale: false, reason: '' } }, DISPLAY);
        expect(both.badge).toBe('alarm');
        expect(both.preset).toBe('fault');
        expect(itemState(quiet, DISPLAY).preset).toBe('normal');
    });

    test('the style slot, the rule display and the area tints are read from a batch; bad ones left out', () => {
        const reply = readReply({ v: 1, type: 'values.batch', id: 'b1', body: {
            seq: 7, full: true,
            items: [{ ...P1, style: { preset: 'attention', stale: false, reason: '' } }, { ...P1, id: 'p2', style: { preset: 'green', stale: false } },
                { ...P1, id: 'p3', style: { preset: 'fault' } }],
            kindDisplay: [{ ...DISPLAY, styleRule: { type: 'bands', source: 'kpi:pressure', cases: [{ label: 'below 900', preset: 'normal' },
                { label: '900 and above', preset: 'warning' }, { label: 'x', preset: 'purple' }] } },
            { kindId: 'geofence', areaTints: { property: 'operator', tints: [{ category: 'North', tint: 'tint-1' }, { category: 'South', tint: 'tint-9' }] } },
            { kindId: 'line', styleRule: { type: 'other', source: 'tag', cases: [] } }] } });
        if (reply.kind !== 'values.batch' || !reply.body) {
            throw new Error('unreadable');
        }
        expect(reply.body.items[0].style).toEqual({ preset: 'attention', stale: false, reason: '' });
        expect(reply.body.items[1].style).toBeUndefined();
        expect(reply.body.items[2].style).toBeUndefined();
        const pad = reply.body.kindDisplay!.find((d) => d.kindId === 'pad')!;
        expect(pad.styleRule).toEqual({ type: 'bands', source: 'kpi:pressure',
            cases: [{ label: 'below 900', preset: 'normal' }, { label: '900 and above', preset: 'warning' }] });
        expect(pad.areaTints).toBeUndefined();
        const geofence = reply.body.kindDisplay!.find((d) => d.kindId === 'geofence')!;
        expect(geofence.areaTints).toEqual({ property: 'operator', tints: [{ category: 'North', tint: 'tint-1' }] });
        expect(reply.body.kindDisplay!.find((d) => d.kindId === 'line')!.styleRule).toBeUndefined();
        expect(areaTint(geofence, { operator: 'North' })).toBe('tint-1');
        expect(areaTint(geofence, { operator: 'South' })).toBeNull();
        expect(areaTint(geofence, { operator: 12 })).toBeNull();
        expect(areaTint(geofence, {})).toBeNull();
        expect(areaTint(pad, { operator: 'North' })).toBeNull();
        expect(areaTint(undefined, { operator: 'North' })).toBeNull();
    });

    test('an alarm: priority, acknowledgement and count; it draws over comms lost', () => {
        const alarmed = itemState(P1, DISPLAY);
        expect(alarmed.alarm).toEqual({ priority: 1, unacked: true, active: 1, stale: false });
        expect(alarmed.badge).toBe('alarm');
        const acked = itemState({ ...P1, alarms: good({ active: 2, unacked: 0, priority: 2 }) }, DISPLAY);
        expect(acked.alarm).toEqual({ priority: 2, unacked: false, active: 2, stale: false });
        const both = itemState({ ...P1, comms: good(false) }, DISPLAY);
        expect(both.commsLost).toBe(true);
        expect(both.badge).toBe('alarm');
        // Diagnostic (priority 0) and no active alarm draw nothing.
        expect(itemState({ ...P1, alarms: good({ active: 1, unacked: 1, priority: 0 }) }, DISPLAY).alarm).toBeNull();
    });

    test('comms lost: the comms slot false or stale makes the item stale with the comms-lost badge', () => {
        const lost = itemState({ ...P1, comms: good(false), alarms: stale({ active: 0, unacked: 0, priority: 0 }, 'comms lost'),
            kpis: { pressure: stale(412, 'comms lost') } }, DISPLAY);
        expect(lost.commsLost).toBe(true);
        expect(lost.stale).toBe(true);
        expect(lost.badge).toBe('comms-lost');
        expect(lost.iconKpi).toEqual({ key: 'pressure', text: '412 psi', stale: true, hasValue: true });
        const noValue = itemState({ ...P1, comms: stale(null, 'no value yet', 'Uncertain_InitialValue') }, DISPLAY);
        expect(noValue.commsLost).toBe(true);
        // With comms off in the display the comms slot is not read.
        const off = itemState({ ...P1, comms: good(false) }, { ...DISPLAY, comms: false });
        expect(off.commsLost).toBe(false);
    });

    test('a stale KPI alone is stale with the stale badge; no values or no display is normal', () => {
        const s = itemState({ ...P1, kpis: { pressure: stale(1, 'Bad_Stale', 'Bad_Stale') },
            alarms: good({ active: 0, unacked: 0, priority: 0 }) }, DISPLAY);
        expect(s.stale).toBe(true);
        expect(s.badge).toBe('stale');
        expect(itemState(undefined, DISPLAY).badge).toBe('normal');
        expect(itemState(P1, undefined).badge).toBe('normal');
    });
});

describe('the popup\'s words', () => {
    test('values, ages, comms, alarms and stale marks', () => {
        expect(valueText(good(412.456), 'psi')).toBe('412.5 psi');
        expect(valueText(good(12), '')).toBe('12');
        expect(valueText(good(true), '')).toBe('On');
        expect(valueText(good('running'), '')).toBe('running');
        expect(valueText(good(null), 'psi')).toBe('No value');
        expect(ageText(T, NOW)).toBe('12 s ago');
        expect(ageText('2026-10-28T09:57:00Z', NOW)).toBe('3 min ago');
        expect(ageText('2026-10-28T08:00:00Z', NOW)).toBe('2 h ago');
        expect(ageText('2026-10-25T08:00:00Z', NOW)).toBe('3 d ago');
        expect(ageText(null, NOW)).toBe('');
        expect(commsText(good(true), NOW)).toEqual({ word: 'OK', detail: '12 s ago', lost: false });
        expect(commsText(good(false), NOW)).toEqual({ word: 'Comms lost', detail: '12 s ago', lost: true });
        expect(commsText(stale(true, 'Bad_Stale', 'Bad_Stale'), NOW).word).toBe('Comms lost');
        expect(commsText(undefined, NOW)).toEqual({ word: 'No value yet', detail: '', lost: false });
        expect(commsText(stale(null, 'no value yet', 'Uncertain_InitialValue'), NOW)).toEqual({ word: 'No value yet', detail: 'no value yet', lost: true });
        expect(alarmsText(good({ active: 0, unacked: 0, priority: 0 }))).toBe('No active alarms');
        expect(alarmsText(good({ active: 1, unacked: 1, priority: 1 }))).toBe('1 alarm - Priority 1, unacknowledged');
        expect(alarmsText(good({ active: 3, unacked: 0, priority: 2 }))).toBe('3 alarms - Priority 2, acknowledged');
        expect(alarmsText(undefined)).toBe('No value yet');
        expect(alarmsText(stale(null, 'comms lost'))).toBe('No value yet - comms lost');
        expect(staleText(stale(1, 'comms lost'), '1 psi')).toBe('Stale - 1 psi (comms lost)');
        expect(staleText(good(1), '1 psi')).toBe('1 psi');
    });

    test('an alarm in words with its source and age, and the counts by priority (entry 8)', () => {
        expect(alarmLineText({ name: 'Casing pressure high', source: 'Pressure', priority: 1, unacked: true, activeTime: '2026-10-28T09:56:00Z' }, NOW))
            .toBe('Casing pressure high - Pressure, 4 min ago');
        expect(alarmLineText({ name: 'Down', source: '', priority: 1, unacked: true, activeTime: null }, NOW)).toBe('Down');
        expect(alarmCountsText({ counts: { 1: 2, 2: 0, 3: 1 }, list: [], reason: '' })).toBe('2 priority 1, 1 priority 3');
        expect(alarmCountsText({ counts: { 1: 1, 2: 0, 3: 0 }, list: [], reason: '' })).toBe('');
        expect(alarmCountsText({ counts: { 1: 0, 2: 0, 3: 0 }, list: [], reason: '' })).toBe('');
    });
});
