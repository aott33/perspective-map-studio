import {
    LIVE_INITIAL, LiveValue, ageText, alarmsText, applyBatch, commsText, itemState, readKindDisplay, readValuesBatch,
    staleText, valueText
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
});

describe('item state for the icon', () => {
    test('normal with the icon KPI', () => {
        const normal = itemState({ ...P1, alarms: good({ active: 0, unacked: 0, priority: 0 }) }, DISPLAY);
        expect(normal).toEqual({ commsLost: false, stale: false, alarm: null,
            iconKpi: { key: 'pressure', text: '412.5 psi', stale: false }, badge: 'normal' });
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
        expect(lost.iconKpi).toEqual({ key: 'pressure', text: '412 psi', stale: true });
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
});
