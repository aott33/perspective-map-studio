import { Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import { KindDisplay } from '../live';
import { LINE_ROWS, STATE_ROWS, STYLE_ROWS, TOGGLE_KEYS, ToggleStore, legendKey, readToggle, writeToggle } from '../legend';

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
        expect(key.states.map((s) => s.words)).toEqual(['Priority 1 alarm, digit beside', 'Priority 2 alarm', 'Priority 3 alarm', 'Acknowledged',
            'Comms lost', 'Stale value']);
        expect(key.lines).toBe(LINE_ROWS);
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
