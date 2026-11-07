import { Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import { KindDisplay } from '../live';
import {
    KINDS_COLLAPSE_OVER, LINE_ROWS, STATE_ROWS, STYLE_ROWS, TOGGLE_KEYS, ToggleStore, kindsHeading, kindsStartCollapsed, legendKey, readToggle, sameLegendKey, showsYouRow,
    writeToggle
} from '../legend';

const PAD: Kind = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] };
const SWD: Kind = { id: 'swd', name: 'SWD', geometry: 'point', icon: 'swd', labelRank: 8, fields: [] };
const LINE: Kind = { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 5, fields: [] };
const FENCE: Kind = { id: 'geofence', name: 'Geofence', geometry: 'line', icon: 'geofence', labelRank: 0, fields: [], area: true };

function item(id: string, kind: string, deleted = false): MapItemRecord {
    return { id, kind, name: id, geometry: { type: 'Point', coordinates: [0, 0] }, properties: {}, assetId: null, overrides: {}, ends: null,
        attachment: null, version: 1, deleted };
}

const PAD_DISPLAY: KindDisplay = {
    kindId: 'pad', comms: true, kpis: [], alarms: { on: true, count: true, summary: true }, link: '',
    styleRule: { type: 'states', source: 'tag', cases: [{ label: '1', preset: 'attention' }] }
};
const FENCE_DISPLAY: KindDisplay = {
    kindId: 'geofence', comms: false, kpis: [], alarms: { on: false, count: true, summary: true }, link: '',
    areaTints: { property: 'operator', tints: [{ category: 'North', tint: 'tint-1' }, { category: 'South', tint: 'tint-4' }] }
};

describe('the legend key (epic 3 entry 3)', () => {
    test('lists the kinds in use in the kind list order, the fixed states and lines, the styles and tints a setup turns on', () => {
        const key = legendKey([item('a', 'pad'), item('b', 'line'), item('c', 'geofence'), item('d', 'swd', true), item('e', 'unknown')],
            [SWD, PAD, LINE, FENCE], { pad: PAD_DISPLAY, geofence: FENCE_DISPLAY });
        expect(key.kinds).toEqual([
            { id: 'pad', name: 'Well pad', icon: 'well-pad', draw: 'point' },
            { id: 'line', name: 'Gathering line', icon: 'pipeline', draw: 'line' },
            { id: 'geofence', name: 'Geofence', icon: 'geofence', draw: 'area' }
        ]);
        expect(key.states).toBe(STATE_ROWS);
        expect(key.states.map((s) => s.words)).toEqual(['Priority 1 alarm, digit beside', 'Priority 2 alarm', 'Priority 3 alarm',
            'Acknowledged: outlined, with "!"', 'Comms lost', 'Stale value']);
        expect(key.lines).toBe(LINE_ROWS);
        // Weight by size alone (item 11) and the flow arrow as the drawn direction on the selected line (item 22).
        expect(key.lines.map((l) => l.words)).toEqual(['Pipeline, weight by size', 'Thin: no size given', 'Dashed: no data or comms lost',
            'Hue: the highest alarm', 'Selected: arrows show the drawn direction']);
        expect(key.lines[4]).toMatchObject({ token: 'selection', arrow: true });
        expect(key.styles).toBe(STYLE_ROWS);
        expect(key.styles.map((s) => s.words)).toEqual(['Attention', 'Warning', 'Fault', 'Out of service']);
        expect(key.tints).toEqual([
            { kindName: 'Geofence', category: 'North', tint: 'tint-1' },
            { kindName: 'Geofence', category: 'South', tint: 'tint-4' },
            { kindName: 'Geofence', category: 'No category', tint: null }
        ]);
    });

    test('no styles without a rule, no tints without any, no kinds with no items', () => {
        const key = legendKey([], [PAD, FENCE], {});
        expect(key.kinds).toEqual([]);
        expect(key.styles).toEqual([]);
        expect(key.tints).toEqual([]);
        expect(key.states.length).toBe(6);
    });

    test('the toggles are on unless the store says off, and a refusing store is ignored', () => {
        const held = new Map<string, string>();
        const store: ToggleStore = { getItem: (k) => held.get(k) ?? null, setItem: (k, v) => { held.set(k, v); } };
        expect(readToggle(store, 'lines')).toBe(true);
        writeToggle(store, 'lines', false);
        expect(held.get(TOGGLE_KEYS.lines)).toBe('off');
        expect(readToggle(store, 'lines')).toBe(false);
        expect(readToggle(store, 'names')).toBe(true);
        writeToggle(store, 'names', true);
        expect(held.get(TOGGLE_KEYS.names)).toBe('on');
        expect(readToggle(null, 'lines')).toBe(true);
        const refusing: ToggleStore = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); } };
        expect(readToggle(refusing, 'names')).toBe(true);
        expect(() => writeToggle(refusing, 'names', false)).not.toThrow();
    });
});

describe('the same key (epic 4 entry 22: the legend is drawn again only when its key changed)', () => {
    const ITEMS = [item('a', 'pad'), item('b', 'line'), item('c', 'geofence')];
    const KINDS = [PAD, LINE, FENCE];

    test('two keys built apart from equal items, kinds and display are the same, row by row', () => {
        const a = legendKey(ITEMS, KINDS, { pad: PAD_DISPLAY, geofence: FENCE_DISPLAY });
        const b = legendKey(ITEMS.map((i) => ({ ...i, version: 2 })), KINDS.map((k) => ({ ...k })),
            { pad: { ...PAD_DISPLAY }, geofence: { ...FENCE_DISPLAY } });
        expect(a).not.toBe(b);
        expect(sameLegendKey(a, b)).toBe(true);
        // Copies of the fixed rows, an optional field left out on one side and undefined on the other, are alike.
        const copied = { ...a, states: a.states.map((r) => ({ ...r })), lines: a.lines.map((r) => ({ ...r, arrow: r.arrow })) };
        expect(sameLegendKey(a, copied)).toBe(true);
        expect(sameLegendKey(legendKey([], [], {}), { kinds: [], states: STATE_ROWS, lines: LINE_ROWS, styles: [], tints: [] })).toBe(true);
    });

    test('a kind on the map or gone, a renamed kind, a style rule turned on, a changed tint or row words differ', () => {
        const base = legendKey(ITEMS, KINDS, { pad: PAD_DISPLAY, geofence: FENCE_DISPLAY });
        expect(sameLegendKey(base, legendKey([...ITEMS, item('d', 'swd')], [...KINDS, SWD], { pad: PAD_DISPLAY, geofence: FENCE_DISPLAY }))).toBe(false);
        expect(sameLegendKey(base, legendKey(ITEMS.slice(0, 2), KINDS, { pad: PAD_DISPLAY, geofence: FENCE_DISPLAY }))).toBe(false);
        expect(sameLegendKey(base, legendKey(ITEMS, [{ ...PAD, name: 'Pad' }, LINE, FENCE], { pad: PAD_DISPLAY, geofence: FENCE_DISPLAY }))).toBe(false);
        expect(sameLegendKey(legendKey(ITEMS, KINDS, { geofence: FENCE_DISPLAY }), base)).toBe(false);
        const retinted: KindDisplay = { ...FENCE_DISPLAY, areaTints: { property: 'operator', tints: [{ category: 'North', tint: 'tint-2' }, { category: 'South', tint: 'tint-4' }] } };
        expect(sameLegendKey(base, legendKey(ITEMS, KINDS, { pad: PAD_DISPLAY, geofence: retinted }))).toBe(false);
        expect(sameLegendKey(base, { ...base, lines: base.lines.map((r, i) => (i === 0 ? { ...r, words: 'Pipeline' } : r)) })).toBe(false);
        expect(sameLegendKey(base, { ...base, lines: base.lines.map((r, i) => (i === 4 ? { ...r, arrow: false } : r)) })).toBe(false);
    });
});

describe('the Kinds section (owner review, item 24)', () => {
    test('starts collapsed with more than six kinds on the map, and says how many', () => {
        expect(KINDS_COLLAPSE_OVER).toBe(6);
        expect(kindsStartCollapsed(6)).toBe(false);
        expect(kindsStartCollapsed(7)).toBe(true);
        expect(kindsHeading(3)).toBe('Kinds');
        expect(kindsHeading(6)).toBe('Kinds');
        expect(kindsHeading(9)).toBe('Kinds (9)');
    });
});

describe('the you-are-here row (epic 4 entry 15)', () => {
    const ITEMS = [item('a', 'pad')];

    test('without a position the key has no row and equals the key built before entry 15', () => {
        const key = legendKey(ITEMS, [PAD], {});
        expect(key.you).toBeUndefined();
        expect(sameLegendKey(key, legendKey(ITEMS, [PAD], {}, false))).toBe(true);
        expect(key.states).toBe(STATE_ROWS);
    });

    test('with a position States end with the row, and the two keys differ, so the legend is drawn again', () => {
        const without = legendKey(ITEMS, [PAD], {});
        const withYou = legendKey(ITEMS, [PAD], {}, true);
        expect(withYou.you).toBe(true);
        expect(withYou.states).toBe(STATE_ROWS);
        expect(sameLegendKey(without, withYou)).toBe(false);
        expect(sameLegendKey(withYou, legendKey(ITEMS, [PAD], {}, true))).toBe(true);
    });

    test('the row is drawn only at the end of States: a fix before the items load shows no section holding it alone', () => {
        expect(showsYouRow(legendKey(ITEMS, [PAD], {}, true))).toBe(true);
        expect(showsYouRow(legendKey(ITEMS, [PAD], {}))).toBe(false);
        expect(showsYouRow({ kinds: [], states: [], lines: [], styles: [], tints: [], you: true })).toBe(false);
    });
});
