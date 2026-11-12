// Details as the item form draws it (epic 4 entry 6, R3, R12; DESIGN.md Properties panel): the kind's fields after Location
// in the kind list's order and as their types, "Required" by a required label and the missing ones named at the top, Name
// underlined with its tooltip and description while another item has the name on a different asset, an unknown kind's
// values read only with Kind alone taking input (while the kind list is in use; else its status message), a vanished asset said
// under Asset, and the asset list's status message. From the review: a kind field sent and refused shows the record's value
// again once the item's saves settle, and a field changed and changed back before the first reply sends the change back.
import { METRIC_UNITS } from '../geometry';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdapterStatus, Asset, AssetName, FormField, Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import { liveNowBlock } from '../itemOverrides';
import { readSetup } from '../kindSetup';
import { ItemValues } from '../live';
import { createPlaceSource } from '../placeCheck';
import { PropertiesPanel, PropertiesPanelProps } from '../studio/PropertiesPanel';
import { SelectionCount } from '../studio/SelectionCount';

const noopCount = (): void => undefined;

const FIELDS: FormField[] = [
    { key: 'operator', label: 'Operator', type: 'text', required: false, choices: [] },
    { key: 'wells', label: 'Wells', type: 'integer', required: false, choices: [] },
    { key: 'status', label: 'Status', type: 'choice', required: true, choices: ['producing', 'shut in', 'abandoned'] }
];
const PAD: Kind = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: FIELDS };
const LINE: Kind = { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 5, fields: [
    { key: 'diameter', label: 'Diameter (in)', type: 'number', required: false, choices: [] },
    { key: 'buried', label: 'Buried', type: 'boolean', required: false, choices: [] }] };
const NAMES: AssetName[] = [{ id: 'P14', name: 'Pad 14' }, { id: 'P15', name: 'Pad 15' }];
const ASSETS: Asset[] = [{ id: 'P14', name: 'Pad 14', kind: 'pad', basePath: '[default]Mesa/P14' },
    { id: 'P15', name: 'Pad 15', kind: 'pad', basePath: '[default]Mesa/P15' }];
const OK: AdapterStatus = { status: 'ok', message: '10 assets from mapstudio_dev.assets.', function: 'mapstudio_dev.assets', count: 10, left: 0,
    refreshedAt: null };
const KINDS_OK: AdapterStatus = { status: 'ok', message: '5 kinds from mapstudio_dev.kinds.', function: 'mapstudio_dev.kinds', count: 5, left: 0,
    refreshedAt: null };

const noop = (): void => undefined;

/** The opening tag (`<input ...>`, `<select ...>`, `<option ...>`) that holds `marker`, so each attribute is checked whatever their order. */
function tag(html: string, marker: string): string {
    const at = html.indexOf(marker);
    if (at < 0) {
        throw new Error('No ' + marker + ' in the markup.');
    }
    return html.slice(html.lastIndexOf('<', at), html.indexOf('>', at) + 1);
}

/** The option of a select whose value is `value`, with its words. */
function option(html: string, selectId: string, value: string): string {
    const from = html.indexOf('id="' + selectId + '"');
    const select = html.slice(from, html.indexOf('</select>', from));
    const m = select.match(new RegExp('<option[^>]*value="' + value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*>([^<]*)</option>'));
    if (!m) {
        throw new Error('No option ' + value + ' in ' + selectId + '.');
    }
    return m[0];
}

function record(extra: Partial<MapItemRecord> = {}): MapItemRecord {
    return { id: 'p1', kind: 'pad', name: 'P31', geometry: { type: 'Point', coordinates: [-104.97, 39.74] }, properties: {}, assetId: 'P15',
        overrides: {}, ends: null, attachment: null, version: 2, deleted: false, ...extra };
}

function props(overrides: Partial<PropertiesPanelProps> = {}): PropertiesPanelProps {
    const item = overrides.item || record();
    return {
        item, kind: PAD, kinds: [PAD], units: METRIC_UNITS, assets: [], assetNames: NAMES, assetStatus: OK, items: [item], assetRows: ASSETS, kindStatus: KINDS_OK,
        saving: false, newest: item.properties, pending: false, paused: false, autoFocusName: false, onNameFocused: noop, onClose: noop,
        onRename: noop, onMove: noop, canMoveByClick: true, moving: false, onMoveStart: noop, onLink: noop, onKind: noop, onProperty: noop,
        onDelete: noop, toolInHand: false, delKey: true, places: createPlaceSource(() => new Promise(() => undefined)), onZoomTo: noop,
        ...overrides
    };
}

function panel(overrides: Partial<PropertiesPanelProps> = {}): string {
    return renderToStaticMarkup(React.createElement(PropertiesPanel, props(overrides)));
}

describe('the kind\'s fields (entry 6)', () => {
    test('after Location and before Asset, in the kind list\'s order, each as its type; Status required with "Not set" first', () => {
        const html = panel({ item: record({ properties: { operator: 'Acme', wells: 3 } }) });
        const at = (s: string): number => html.indexOf(s);
        expect(at('mapstudio-field--location')).toBeLessThan(at('data-field="operator"'));
        expect(at('data-field="operator"')).toBeLessThan(at('data-field="wells"'));
        expect(at('data-field="wells"')).toBeLessThan(at('data-field="status"'));
        expect(at('data-field="status"')).toBeLessThan(at('mapstudio-field--asset'));
        const operator = tag(html, 'id="mapstudio-prop-p1-0"');
        expect(operator).toMatch(/^<input /);
        for (const a of ['type="text"', 'class="mapstudio-input mapstudio-field-prop"', 'value="Acme"', 'aria-required="false"']) {
            expect(operator).toContain(a);
        }
        const wells = tag(html, 'id="mapstudio-prop-p1-1"');
        for (const a of ['type="text"', 'value="3"', 'inputMode="numeric"']) {
            expect(wells).toContain(a);
        }
        expect(html).toContain('data-field="status" data-type="choice" data-required="true"');
        expect(html).toContain('<label class="mapstudio-field-label" for="mapstudio-prop-p1-2">Status</label><span class="mapstudio-field-required">Required</span>');
        expect(tag(html, 'id="mapstudio-prop-p1-2"')).toMatch(/^<select [^>]*aria-required="true"/);
        expect(option(html, 'mapstudio-prop-p1-2', '')).toMatch(/selected=""[^>]*>Not set<\/option>$/);
        expect(html).toMatch(/>Not set<\/option><option value="producing">producing<\/option><option value="shut in">shut in<\/option><option value="abandoned">abandoned<\/option><\/select>/);
        // Only Status is required: one "Required" mark.
        expect(html.match(/mapstudio-field-required/g)).toHaveLength(1);
    });

    test('a required field not set: "Missing: Status" at the top, before Name; set, the line goes', () => {
        const html = panel();
        expect(html).toContain('data-missing="Missing: Status"');
        expect(html).toContain('<div class="mapstudio-panel-note mapstudio-panel-missing" role="status">Missing: Status</div>');
        expect(html.indexOf('mapstudio-panel-missing')).toBeLessThan(html.indexOf('mapstudio-field-name'));
        const set = panel({ item: record({ properties: { status: 'shut in' } }) });
        expect(set).not.toContain('mapstudio-panel-missing');
        expect(option(set, 'mapstudio-prop-p1-2', 'shut in')).toContain('selected=""');
    });

    test('a line\'s boolean is a checkbox with its label beside it; its number takes decimals', () => {
        const line = record({ id: 'l1', kind: 'line', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: { buried: true } });
        const html = panel({ item: line, kind: LINE, kinds: [LINE] });
        const buried = tag(html, 'id="mapstudio-prop-l1-1"');
        for (const a of ['type="checkbox"', 'class="mapstudio-field-prop mapstudio-field-check"', 'checked=""']) {
            expect(buried).toContain(a);
        }
        expect(html).toContain('<label class="mapstudio-field-check-label" for="mapstudio-prop-l1-1">Buried</label>');
        expect(tag(html, 'id="mapstudio-prop-l1-0"')).toContain('inputMode="decimal"');
        expect(html).not.toContain('mapstudio-panel-missing');
    });

    test('paused with the store: every field takes no input', () => {
        const html = panel({ paused: true });
        expect(tag(html, 'id="mapstudio-prop-p1-0"')).toContain('disabled=""');
        expect(tag(html, 'id="mapstudio-prop-p1-1"')).toContain('disabled=""');
        expect(tag(html, 'id="mapstudio-prop-p1-2"')).toContain('disabled=""');
    });
});

describe('a duplicate name (R3)', () => {
    test('another live item named P31 on another asset: Name underlined, its tooltip and description naming it; on the same asset, nothing', () => {
        const self = record();
        const html = panel({ items: [self, record({ id: 'p2', name: ' p31', assetId: 'P14' })] });
        const name = tag(html, 'mapstudio-field-name');
        for (const a of ['class="mapstudio-input mapstudio-field-name mapstudio-field-name--twin"', 'value="P31"',
            'title="Also the name of the item linked to Mesa/P14"', 'aria-describedby="mapstudio-twin-p1"',
            'data-twin="Also the name of the item linked to Mesa/P14"']) {
            expect(name).toContain(a);
        }
        expect(html).toContain('<span id="mapstudio-twin-p1" class="mapstudio-visually-hidden">Also the name of the item linked to Mesa/P14</span>');
        // Outside the label: the description is not part of Name's name.
        expect(html.indexOf('<span id="mapstudio-twin-p1"')).toBeGreaterThan(html.indexOf('</label>', html.indexOf('mapstudio-field-name')));
        // An asset the asset list does not list is named by its id.
        expect(panel({ items: [self, record({ id: 'p2', name: 'P31', assetId: 'P99' })] }))
            .toContain('title="Also the name of the item linked to P99"');
        const same = panel({ items: [self, record({ id: 'p2', name: 'P31', assetId: 'P15' })] });
        expect(same).not.toContain('mapstudio-field-name--twin');
        expect(same).toContain('data-twin=""');
    });
});

describe('an unknown kind, a vanished asset and the asset list\'s status (R3)', () => {
    test('a tank: "Unknown kind" with the sentence, its stored values read only, Kind alone taking input', () => {
        const tank = record({ kind: 'tank', properties: { capacity: 400, note: '' } });
        const html = panel({ item: tank, kind: undefined, kinds: [PAD] });
        expect(html).toContain('data-kind-known="false"');
        expect(option(html, 'mapstudio-kind-p1', 'tank')).toMatch(/selected=""[^>]*>Unknown kind<\/option>$/);
        expect(option(html, 'mapstudio-kind-p1', 'pad')).toMatch(/>Well pad<\/option>$/);
        expect(html).toContain('<span id="mapstudio-kind-hint-p1" class="mapstudio-field-hint mapstudio-field-kind-hint">'
            + 'tank is no longer in the kind list; its values are kept</span>');
        expect(html).toContain('<div class="mapstudio-field mapstudio-field--stored" data-field="capacity"><span class="mapstudio-field-label">capacity</span>'
            + '<span class="mapstudio-field-text mapstudio-field-stored">400</span></div>');
        expect(html).not.toContain('data-field="note"');
        expect(html).not.toContain('mapstudio-field-prop');
        expect(tag(html, 'mapstudio-field-name')).toContain('disabled=""');
        const kind = tag(html, 'id="mapstudio-kind-p1"');
        expect(kind).not.toContain('disabled');
        expect(kind).toContain('aria-describedby="mapstudio-kind-hint-p1"');
        expect(tag(html, 'id="mapstudio-asset-p1"')).toContain('disabled=""');
        expect(tag(html, 'mapstudio-field-unlink')).toContain('disabled=""');
        expect(tag(html, 'mapstudio-field-move')).toContain('disabled=""');
        expect(tag(html, 'mapstudio-field-lat')).toContain('disabled=""');
        // The footer's delete is as it was: a delete needs no kind list.
        expect(tag(html, 'mapstudio-panel-delete')).not.toContain('disabled');
        expect(html).toContain('Unknown kind - linked to Pad 15');
    });

    test('linked to P99, not in the asset list: "Not linked: P99 ..." under Asset, the link kept, the subline not linked', () => {
        const html = panel({ item: record({ assetId: 'P99' }) });
        expect(html).toContain('data-vanished="true"');
        expect(option(html, 'mapstudio-asset-p1', 'P99')).toMatch(/selected=""[^>]*>P99 \(not in the asset list\)<\/option>$/);
        expect(html).toContain('mapstudio-field-asset-hint">Not linked: P99 is no longer in the asset list</span>');
        expect(html).toContain('Well pad - not linked');
        // An asset of another kind that is listed keeps its name.
        expect(option(panel({ item: record({ assetId: 'P14' }) }), 'mapstudio-asset-p1', 'P14')).toMatch(/selected=""[^>]*>Pad 14<\/option>$/);
        // While the list loads, nothing is said to have vanished.
        const loading = panel({ item: record({ assetId: 'P99' }), assetNames: [], assetStatus: { ...OK, status: 'loading', count: 0 } });
        expect(loading).toContain('data-vanished="false"');
    });

    test('the asset list empty or incomplete: its message under Asset; ok, none', () => {
        const empty = panel({ assetNames: [], assetStatus: { ...OK, status: 'empty', count: 0, message: 'The asset function mapstudio_dev.assets returned no assets.' } });
        expect(empty).toContain('<span class="mapstudio-field-asset-status" role="status" data-status="empty">'
            + 'The asset function mapstudio_dev.assets returned no assets.</span>');
        const incomplete = panel({ assetStatus: { ...OK, status: 'incomplete', message: '2 of 12 assets from mapstudio_dev.assets left out: ...' } });
        expect(incomplete).toContain('data-status="incomplete">2 of 12 assets from mapstudio_dev.assets left out: ...</span>');
        expect(panel()).not.toContain('mapstudio-field-asset-status');
    });
});

describe('the kind list not in use (entry 6\'s review)', () => {
    test('while it loads: no "Unknown kind", the kind list\'s message instead; the item\'s values read only and its fields off as for an unknown kind', () => {
        const loading: AdapterStatus = { ...KINDS_OK, status: 'loading', count: 0, message: 'Loading the kind list from mapstudio_dev.kinds.' };
        const html = panel({ item: record({ properties: { status: 'producing' } }), kind: undefined, kinds: [], kindStatus: loading });
        expect(html).not.toContain('Unknown kind');
        expect(html).not.toContain('no longer in the kind list');
        expect(html).toContain('data-kind-known="false"');
        expect(html).toContain('data-kind-list="unknown"');
        expect(html).toContain('<span id="mapstudio-kind-hint-p1" class="mapstudio-field-hint mapstudio-field-kind-hint">'
            + 'Loading the kind list from mapstudio_dev.kinds.</span>');
        expect(option(html, 'mapstudio-kind-p1', 'pad')).toMatch(/selected=""[^>]*>pad<\/option>$/);
        expect(html).toContain('pad - linked to Pad 15');
        expect(html).toContain('data-field="status"><span class="mapstudio-field-label">status</span>');
        expect(tag(html, 'mapstudio-field-name')).toContain('disabled=""');
        expect(tag(html, 'id="mapstudio-asset-p1"')).toContain('disabled=""');
    });

    test('not configured, or failing with no list kept: its message; failing with a list kept, the kind is unknown', () => {
        const none: AdapterStatus = { ...KINDS_OK, status: 'not-configured', count: 0, message: 'The setup names no kind function.' };
        expect(panel({ kind: undefined, kinds: [], kindStatus: none })).toContain('mapstudio-field-kind-hint">The setup names no kind function.</span>');
        const failing: AdapterStatus = { ...KINDS_OK, status: 'failing', count: 0, message: 'The kind function mapstudio_dev.kinds failed.' };
        expect(panel({ kind: undefined, kinds: [], kindStatus: failing })).toContain('mapstudio-field-kind-hint">The kind function mapstudio_dev.kinds failed.</span>');
        const kept = panel({ item: record({ kind: 'tank' }), kind: undefined, kindStatus: { ...failing, count: 5 } });
        expect(kept).toContain('data-kind-list="known"');
        expect(kept).toContain('tank is no longer in the kind list; its values are kept');
        // No status at all (an older Gateway): nothing said, nothing called unknown.
        const older = panel({ kind: undefined, kinds: [], kindStatus: null });
        expect(older).not.toContain('Unknown kind');
        expect(older).not.toContain('mapstudio-field-kind-hint');
        expect(tag(older, 'id="mapstudio-kind-p1"')).not.toContain('aria-describedby');
    });
});

/**
 * The panel driven as React would, without a DOM: its state changes applied at once, in order, and a props change followed by
 * componentDidUpdate. What a field shows is read from its render.
 */
function mounted(initial: PropertiesPanelProps): {
    sent: Array<[string, unknown]>;
    type: (key: string, text: string) => void;
    finish: (field: FormField) => void;
    choose: (field: FormField, value: string | boolean | null) => void;
    update: (next: Partial<PropertiesPanelProps>) => void;
    shown: (index: number) => string;
} {
    const sent: Array<[string, unknown]> = [];
    const panelProps = { ...initial, onProperty: (key: string, value: unknown) => { sent.push([key, value]); } };
    const inst = new PropertiesPanel(panelProps);
    const raw = inst as unknown as {
        state: object;
        props: PropertiesPanelProps;
        setState: (u: unknown) => void;
        onFieldText: (key: string) => (ev: { target: { value: string } }) => void;
        commitField: (field: FormField) => () => void;
        chooseField: (field: FormField, value: string | boolean | null) => void;
    };
    raw.setState = (u: unknown) => {
        const patch = typeof u === 'function' ? (u as (s: object, p: object) => object)(raw.state, raw.props) : u;
        raw.state = { ...raw.state, ...(patch as object) };
    };
    return {
        sent,
        type: (key, text) => raw.onFieldText(key)({ target: { value: text } }),
        finish: (field) => raw.commitField(field)(),
        choose: (field, value) => raw.chooseField(field, value),
        update: (next) => {
            const prev = raw.props;
            raw.props = { ...prev, ...next };
            inst.componentDidUpdate(prev);
        },
        shown: (index) => {
            const html = renderToStaticMarkup(inst.render());
            const t = tag(html, 'id="mapstudio-prop-p1-' + index + '"');
            if (t.startsWith('<select')) {
                const m = html.slice(html.indexOf(t)).match(/<option selected="" value="([^"]*)"/);
                return m ? m[1] : '';
            }
            const m = t.match(/ value="([^"]*)"/);
            return m ? m[1] : '';
        }
    };
}

describe('a kind field\'s save settling (entry 6\'s review)', () => {
    const [OPERATOR, , STATUS] = FIELDS;

    test('Operator sent and refused: once the item\'s saves settle, the field shows the record\'s value again', () => {
        const base = record({ properties: { status: 'producing' } });
        const p = mounted(props({ item: base }));
        p.type('operator', 'Acme');
        p.finish(OPERATOR);
        expect(p.sent).toEqual([['operator', 'Acme']]);
        p.update({ saving: true, newest: { status: 'producing', operator: 'Acme' } });
        expect(p.shown(0)).toBe('Acme');
        // Refused for good: the batch is given up, nothing in flight; the record never held Acme.
        p.update({ saving: false, newest: base.properties });
        expect(p.shown(0)).toBe('');
    });

    test('a choice sent and dropped goes back too; a field typed again since it was sent keeps its keystrokes; a saved one stays', () => {
        const base = record({ properties: { status: 'producing' } });
        const p = mounted(props({ item: base }));
        p.choose(STATUS, 'shut in');
        p.type('operator', 'Acme');
        p.finish(OPERATOR);
        p.update({ saving: true, newest: { status: 'shut in', operator: 'Acme' } });
        p.type('operator', 'Acme Oil');
        p.update({ saving: false, newest: base.properties });
        expect(p.shown(2)).toBe('producing');
        expect(p.shown(0)).toBe('Acme Oil');

        // Saved: the record holds it, and it stays when the saves settle.
        const q = mounted(props({ item: base }));
        q.choose(STATUS, 'shut in');
        q.update({ saving: true, newest: { status: 'shut in' } });
        const saved = record({ version: 3, properties: { status: 'shut in' } });
        q.update({ item: saved, saving: false, newest: saved.properties });
        expect(q.shown(2)).toBe('shut in');
    });

    test('changed and changed back before the first reply: the change back is sent, compared with the value in flight', () => {
        const base = record({ properties: { operator: 'X', status: 'producing' } });
        const p = mounted(props({ item: base }));
        p.type('operator', 'A');
        p.finish(OPERATOR);
        p.update({ saving: true, newest: { operator: 'A', status: 'producing' } });
        p.type('operator', 'X');
        p.finish(OPERATOR);
        expect(p.sent).toEqual([['operator', 'A'], ['operator', 'X']]);
        p.choose(STATUS, 'abandoned');
        p.update({ newest: { operator: 'X', status: 'abandoned' } });
        p.choose(STATUS, 'producing');
        expect(p.sent).toEqual([['operator', 'A'], ['operator', 'X'], ['status', 'abandoned'], ['status', 'producing']]);
        // The value in flight finished again: nothing more is sent, and the field keeps showing it.
        p.update({ newest: { operator: 'X', status: 'producing' } });
        p.type('operator', ' X ');
        p.finish(OPERATOR);
        expect(p.sent).toHaveLength(4);
        expect(p.shown(0)).toBe('X');
    });
});

describe('the count with several selected (entry 8)', () => {
    test('"3 selected", Clear and the footer\'s Delete; no fields; Delete off with its reason while paused, a tool in hand or none saved', () => {
        const html = renderToStaticMarkup(React.createElement(SelectionCount,
            { count: 3, deletable: 3, paused: false, toolInHand: false, onClear: noopCount, onDelete: noopCount }));
        expect(html).toContain('<h2 class="mapstudio-several-count" role="status">3 selected</h2>');
        expect(html).toContain('>Clear</button>');
        expect(html).toContain('title="Delete (Del)" aria-label="Delete 3 items" aria-keyshortcuts="Delete" data-off=""');
        expect(html).not.toContain('mapstudio-field');
        expect(html).not.toContain('mapstudio-panel-tab');
        const tool = renderToStaticMarkup(React.createElement(SelectionCount,
            { count: 2, deletable: 2, paused: false, toolInHand: true, onClear: noopCount, onDelete: noopCount }));
        expect(tool).toContain('data-off="Off while a tool is in hand - Esc puts it down"');
        const none = renderToStaticMarkup(React.createElement(SelectionCount,
            { count: 2, deletable: 0, paused: false, toolInHand: false, onClear: noopCount, onDelete: noopCount }));
        expect(none).toContain('data-off="Not saved yet"');
    });
});

describe('instruments in Details (entry 9)', () => {
    const TAP: Kind = { id: 'tap', name: 'Tap', geometry: 'point', icon: 'tap', labelRank: 2, fields: [], instrument: true };
    const METER: Kind = { id: 'meter', name: 'Meter', geometry: 'point', icon: 'meter', labelRank: 2, fields: [], instrument: true };
    const line = record({ id: 'lswd', kind: 'line', name: 'L-SWD', geometry: { type: 'LineString', coordinates: [[-105.012, 39.7262], [-104.983671, 39.715476]] },
        assetId: null });

    test('a line: Instruments after Location, by name in order with each distance; Add an instrument; None yet when empty', () => {
        const html = panel({ item: line, kind: LINE, kinds: [LINE], instrumentKinds: [TAP, METER], armedKind: null,
            instruments: [{ id: 'pt1', name: 'PT-1', distanceM: 1143 }, { id: 'lv1', name: 'LV-1', distanceM: 2000 }, { id: 'pt2', name: 'PT-2', distanceM: 2841 }] });
        const at = (s: string): number => html.indexOf(s);
        expect(at('mapstudio-field--location')).toBeLessThan(at('mapstudio-field--instruments'));
        expect(at('mapstudio-field--instruments')).toBeLessThan(at('data-field="diameter"'));
        expect(html).toContain('>Instruments<');
        expect(html).toContain('>Add an instrument<');
        expect(tag(html, 'mapstudio-field-add-instrument')).toContain('aria-haspopup="menu"');
        const rows = html.match(/<span class="mapstudio-instrument-name">([^<]*)<\/span><span class="mapstudio-instrument-at">([^<]*)(?=<)/g) || [];
        expect(rows.map((r) => r.replace(/<[^>]+>/g, ' ').trim().replace(/\s+/g, ' '))).toEqual(['PT-1 1.1 km', 'LV-1 2 km', 'PT-2 2.8 km']);
        const empty = panel({ item: line, kind: LINE, kinds: [LINE], instrumentKinds: [TAP], instruments: [] });
        expect(empty).toContain('>None yet<');
        expect(tag(empty, 'mapstudio-field-add-instrument')).not.toContain('aria-haspopup');
        expect(tag(panel({ item: line, kind: LINE, kinds: [LINE], instrumentKinds: [], instruments: [] }), 'mapstudio-field-add-instrument'))
            .toContain('title="The kind list has no instrument kind"');
        // A point or an area has no Instruments row.
        expect(panel()).not.toContain('mapstudio-field--instruments');
    });

    test('an instrument on a line: "On L-SWD at 1.1 km", the distance field, latitude and longitude read only, no Move', () => {
        const pt1 = record({ id: 'pt1', kind: 'tap', name: 'PT-1', assetId: null, attachment: { lineId: 'lswd', distanceM: 1143 } });
        const html = panel({ item: pt1, kind: TAP, kinds: [TAP, METER], canMoveByClick: false, onLine: { name: 'L-SWD', lengthM: 2936.4 } });
        expect(html).toContain('On L-SWD at 1.1 km');
        expect(html).toContain('Distance along the line (m)');
        expect(tag(html, 'mapstudio-input mapstudio-field-distance')).toContain('value="1143"');
        expect(html).toContain('of 2,936 m');
        expect(tag(html, 'mapstudio-field-lat')).toContain('readonly=""');
        expect(tag(html, 'mapstudio-field-lng')).toContain('readonly=""');
        expect(html).not.toContain('mapstudio-field-move');
        expect(html).toContain('Drag it along the line, or type its distance.');
        // The units in force (entry 20a): the place, the field's unit, its value and the length follow them; the stored metres stay.
        const us = panel({ item: pt1, kind: TAP, kinds: [TAP, METER], canMoveByClick: false, onLine: { name: 'L-SWD', lengthM: 2936.4 },
            units: { system: 'us', labels: 'short' } });
        expect(us).toContain('On L-SWD at 3,750 ft');
        expect(us).toContain('Distance along the line (ft)');
        expect(tag(us, 'mapstudio-input mapstudio-field-distance')).toContain('value="3,750"');
        expect(us).toContain('of 9,634 ft');
        expect(option(html, 'mapstudio-kind-pt1', 'meter')).toContain('>Meter<');
        expect(html).not.toContain('value="pad"');
    });

    test('an instrument whose line is not on the map: latitude and longitude still read only, no distance field', () => {
        const pt1 = record({ id: 'pt1', kind: 'tap', name: 'PT-1', assetId: null, attachment: { lineId: 'gone', distanceM: 1143 } });
        const html = panel({ item: pt1, kind: TAP, kinds: [TAP, METER], canMoveByClick: false });
        expect(tag(html, 'mapstudio-field-lat')).toContain('readonly=""');
        expect(tag(html, 'mapstudio-field-lng')).toContain('readonly=""');
        expect(html).not.toContain('mapstudio-field-distance');
        expect(html).toContain('It moves along its line, which is not on the map.');
    });
});

// Entry 12c1 (R5; DESIGN.md Properties panel, Override tag): the Live now block at the foot of Details.
describe('the typed distance when the units in force change (entry 20a)', () => {
    const TAP: Kind = { id: 'tap', name: 'Tap', geometry: 'point', icon: 'tap', labelRank: 2, fields: [], instrument: true };
    const pt1 = record({ id: 'pt1', kind: 'tap', name: 'PT-1', assetId: null, attachment: { lineId: 'lswd', distanceM: 1143 } });
    const base = (): PropertiesPanelProps => props({ item: pt1, kind: TAP, kinds: [TAP], canMoveByClick: false, onLine: { name: 'L-SWD', lengthM: 2936.4 } });
    const state = (inst: PropertiesPanel) => inst.state as unknown as { distance: string; distanceProblem: string };

    function panelOf(initial: PropertiesPanelProps): { inst: PropertiesPanel; update: (next: Partial<PropertiesPanelProps>) => void } {
        const inst = new PropertiesPanel(initial);
        const raw = inst as unknown as { state: object; props: PropertiesPanelProps; setState: (u: unknown) => void };
        raw.setState = (u: unknown) => {
            const patch = typeof u === 'function' ? (u as (s: object, p: object) => object)(raw.state, raw.props) : u;
            raw.state = { ...raw.state, ...(patch as object) };
        };
        return { inst, update: (next) => {
            const prev = raw.props;
            raw.props = { ...prev, ...next };
            inst.componentDidUpdate(prev);
        } };
    }

    test('a draft typed and not finished is dropped: the field shows the stored value in the new unit, the refusal goes', () => {
        const p = panelOf(base());
        p.inst.setState({ distance: '1200', distanceProblem: 'Type a distance from 0 to 2,936 m' });
        p.update({ units: { system: 'us', labels: 'short' } });
        // Not "1200" kept to be read as feet (365.8 m): the stored 1143 m, in feet.
        expect(state(p.inst)).toMatchObject({ distance: '3,750', distanceProblem: '' });
        p.inst.setState({ distance: '4000' });
        p.update({ units: { system: 'metric', labels: 'short' } });
        expect(state(p.inst).distance).toBe('1143');
        // A change of the labels alone drops it too; the same units keep a draft.
        p.inst.setState({ distance: '900' });
        p.update({ units: { system: 'metric', labels: 'short' } });
        expect(state(p.inst).distance).toBe('900');
        p.update({ units: { system: 'metric', labels: 'long' } });
        expect(state(p.inst).distance).toBe('1143');
    });

    test('the field\'s label names the unit in the labels in force', () => {
        const html = (units: PropertiesPanelProps['units']) => renderToStaticMarkup(React.createElement(PropertiesPanel, { ...base(), units }));
        const long = html({ system: 'us', labels: 'long' });
        expect(long).toContain('Distance along the line (feet)');
        expect(long).toContain('of 9,634 feet');
        expect(html({ system: 'metric', labels: 'long' })).toContain('Distance along the line (metres)');
        expect(html({ system: 'us', labels: 'short' })).toContain('Distance along the line (ft)');
    });
});

describe('the Live now block (entry 12c1)', () => {
    const SETUP = readSetup({
        comms: { path: '{asset.path}/Comms' },
        kpis: [{ key: 'pressure', label: 'Pressure', path: '{asset.path}/Pressure', unit: 'psi', icon: true },
            { key: 'gas', label: 'Gas price', path: '[default]Shared/GasPrice', on: false }],
        alarms: { path: '{asset.path}' }
    });
    const VIEW = { itemId: 'p1', itemName: 'P31', assetId: 'P15', assetPath: '[default]Mesa/P15', properties: {} };
    const good = (value: unknown) => ({ value, quality: 'Good', t: null, stale: false, reason: '' });
    const VALUES = { id: 'p1', comms: good(true), kpis: { pressure: good(512) }, alarms: good({ active: 0, unacked: 0, priority: 0 }), problems: [] };
    const block = (overrides: Record<string, unknown> = {}, view = VIEW) =>
        liveNowBlock({ kindName: 'Well pad', setup: SETUP, overrides, view, values: VALUES as unknown as ItemValues, now: 0 });
    /** One row's markup, from its opening tag to the next row's (or the block's end). */
    function row(html: string, id: string): string {
        const from = html.indexOf('data-row="' + id + '"');
        if (from < 0) {
            throw new Error('No row ' + id + '.');
        }
        const next = html.indexOf('mapstudio-livenow-row', from + 1);
        return html.slice(html.lastIndexOf('<', from), next < 0 ? html.indexOf('</section>', from) : next);
    }

    describe('entry 13c: the tag button beside an override\'s field (C4)', () => {
        const buttons = (html: string): string[] => html.match(/<button[^>]*mapstudio-tag-button[^>]*>/g) || [];
        /** The panel with Override pressed on one row. */
        const opened = (over: Partial<PropertiesPanelProps>, rowId = 'kpi:pressure'): string => {
            class Opened extends PropertiesPanel {
                constructor(p: PropertiesPanelProps) {
                    super(p);
                    this.state = { ...this.state, overrideRow: rowId, overrideText: '[default]Mesa/P15/Pressure' };
                }
            }
            return renderToStaticMarkup(React.createElement(Opened, props({ liveNow: block(), onOverride: noop, ...over })));
        };

        test('no button until Override is pressed; then one beside the field, for a full editor only', () => {
            expect(buttons(panel({ liveNow: block(), onOverride: noop, onBrowse: noop }))).toEqual([]);
            expect(buttons(opened({}))).toEqual([]);
            const html = opened({ onBrowse: noop });
            expect(buttons(html)).toHaveLength(1);
            expect(buttons(html)[0]).toContain('data-tag-for="override:kpi:pressure"');
            expect(buttons(html)[0]).toContain('aria-label="Pick a tag for Pressure on P31 only" aria-haspopup="dialog" aria-expanded="false"');
            expect(row(html, 'kpi:pressure')).toContain('<div class="mapstudio-override-line"><input ');
            const browsing = opened({ onBrowse: noop, browsing: 'override:kpi:pressure' });
            expect(buttons(browsing)[0]).toContain('aria-expanded="true"');
            expect(browsing).toContain('class="mapstudio-override-line mapstudio-override-line--browsing"');
            expect(buttons(opened({ onBrowse: noop, paused: true }))[0]).toContain('disabled=""');
        });

        const made = (over: Partial<PropertiesPanelProps> = {}): { inst: PropertiesPanel; sent: unknown[] } => {
            const sent: unknown[] = [];
            const inst = new PropertiesPanel(props({ liveNow: block(), onOverride: (r, path, name) => { sent.push([r, path, name]); }, ...over }));
            const raw = inst as unknown as { state: object; setState: (u: unknown, then?: () => void) => void };
            raw.setState = (u: unknown, then?: () => void): void => {
                raw.state = { ...raw.state, ...(typeof u === 'function' ? (u as (s: object) => object)(raw.state) : u as object) };
                if (then) {
                    then();
                }
            };
            return { inst, sent };
        };

        test('a pick is the override\'s edit, as the field finished with that path: one update, and the field closes', () => {
            const { inst, sent } = made();
            expect(inst.usePick('override:kpi:pressure', '[default]Mesa/P15/Casing')).toBe('');
            expect(sent).toEqual([['kpi:pressure', '[default]Mesa/P15/Casing', 'Pressure']]);
            expect((inst.state as unknown as { overrideRow: string | null }).overrideRow).toBeNull();
            const alarms = made();
            expect(alarms.inst.usePick('override:alarms', '[default]Mesa/P16')).toBe('');
            expect(alarms.sent).toEqual([['alarms', '[default]Mesa/P16', 'Alarms']]);
        });

        test('the path shown already, or the one just refused, is not taken: the reason is said and nothing is sent', () => {
            const same = made();
            expect(same.inst.usePick('override:kpi:pressure', '[default]Mesa/P15/Pressure')).toBe('Not saved. P31 reads this tag already.');
            expect(same.sent).toEqual([]);
            const refused = made({ overrideRefusal: { row: 'comms', words: 'The Gateway said no.', path: '[default]a/b', batchId: 'b1' } });
            expect(refused.inst.usePick('override:comms', '[default]a/b')).toBe('The Gateway said no.');
            expect(refused.sent).toEqual([]);
        });

        test('Override pressed on another row finishes the field still open, as a blur does, before the other opens', () => {
            const { inst, sent } = made();
            const raw = inst as unknown as { state: { overrideRow: string | null; overrideText: string }; startOverride: (row: unknown) => void;
                rowOf: (id: string) => unknown };
            raw.startOverride(raw.rowOf('kpi:pressure'));
            raw.state = { ...raw.state, overrideText: '[default]Mesa/P15/Casing' };
            raw.startOverride(raw.rowOf('comms'));
            expect(sent).toEqual([['kpi:pressure', '[default]Mesa/P15/Casing', 'Pressure']]);
            expect(raw.state.overrideRow).toBe('comms');
            expect(raw.state.overrideText).toBe('[default]Mesa/P15/Comms');
        });

        test('a row that is gone, a pause or a path that is not full says why', () => {
            expect(made().inst.usePick('override:kpi:gone', '[default]a/b')).toBe('Not saved. This row is gone.');
            expect(made({ paused: true }).inst.usePick('override:comms', '[default]a/b')).toBe('Not saved. Editing is paused.');
            expect(made().inst.usePick('override:comms', '{asset.path}/X'))
                .toBe('Not saved: an override\'s tag path is a full path such as [default]Mesa/P12/Pressure, not {asset.path}/X.');
            expect(made().inst.usePick('own.styleRule.path', '[default]a/b')).toBe('Not saved. The style rule is no longer open.');
            expect(made().inst.usePick('comms.path', '[default]a/b')).toBe('Not saved. This path cannot take a pick.');
        });
    });

    test('L1: after Asset, the label with From kind, then Comms, the key values and Alarms with values and filled paths', () => {
        const html = panel({ liveNow: block() });
        expect(html.indexOf('mapstudio-livenow"')).toBeGreaterThan(html.indexOf('mapstudio-field--asset'));
        expect(html.indexOf('mapstudio-livenow"')).toBeLessThan(html.indexOf('mapstudio-panel-footer'));
        expect(tag(html, 'class="mapstudio-livenow"')).toContain('data-rows="4"');
        // The heading that names the block holds the label alone; the tag stands beside it.
        expect(html).toMatch(/<h3 class="mapstudio-livenow-heading" id="mapstudio-livenow-p1">Live now<\/h3><span class="mapstudio-kindsetup-tag mapstudio-fromkind-tag">From kind<\/span>/);
        expect(tag(html, 'class="mapstudio-livenow"')).toContain('aria-labelledby="mapstudio-livenow-p1"');
        expect((html.match(/data-row="[^"]+"/g) || [])).toEqual(['data-row="comms"', 'data-row="kpi:pressure"', 'data-row="kpi:gas"', 'data-row="alarms"']);
        const pressure = row(html, 'kpi:pressure');
        expect(pressure).toContain('data-override="false"');
        expect(pressure).toContain('aria-label="Icon value"');
        expect(pressure).toContain('mapstudio-livenow-value--icon');
        expect(pressure).toContain('512 psi');
        expect(pressure).toContain('<span class="mapstudio-mono mapstudio-livenow-path">[default]Mesa/P15/Pressure</span>');
        expect(pressure).toContain('mapstudio-fromkind-tag');
        expect(pressure).not.toContain('mapstudio-override-tag');
        expect(pressure).not.toContain('mapstudio-override-reset');
        expect(pressure).toMatch(/mapstudio-override-edit[^>]*>Override</);
        expect(row(html, 'comms')).toContain('OK');
        expect(row(html, 'kpi:gas')).toContain('data-off="true"');
        expect(row(html, 'kpi:gas')).toContain('Off in the popup');
        expect(row(html, 'alarms')).toContain('No active alarms');
        expect(html).not.toContain('mapstudio-livenow-unlinked');
        // No em dash anywhere in the panel.
        expect(html).not.toContain(String.fromCharCode(0x2014));
    });

    test('L2: an overridden row carries the Override tag and Reset; the others keep From kind', () => {
        const html = panel({ liveNow: block({ kpis: [{ key: 'pressure', path: '[default]Mesa/P14/Pressure' }] }) });
        const pressure = row(html, 'kpi:pressure');
        expect(pressure).toContain('data-override="true"');
        expect(pressure).toContain('<span class="mapstudio-override-tag">Override</span>');
        expect(pressure).toMatch(/mapstudio-override-reset[^>]*>Reset</);
        expect(pressure).toContain('[default]Mesa/P14/Pressure');
        expect(pressure).not.toContain('mapstudio-fromkind-tag');
        expect(row(html, 'comms')).toContain('data-override="false"');
        expect((html.match(/mapstudio-override-tag/g) || [])).toHaveLength(1);
    });

    test('L7: a refused Reset\'s words stand under its row; paused, the buttons take no input', () => {
        const refused = panel({ liveNow: block({ comms: { path: '[default]Mesa/P14/Comms' } }),
            overrideRefusal: { row: 'comms', words: 'Editing needs the full editing role.', path: '', batchId: 'b1' } });
        expect(row(refused, 'comms')).toMatch(/mapstudio-override-problem" role="alert">Editing needs the full editing role\.</);
        expect(row(refused, 'alarms')).not.toContain('mapstudio-override-problem');
        const paused = panel({ liveNow: block({ comms: { path: '[default]Mesa/P14/Comms' } }), paused: true });
        expect(tag(row(paused, 'comms'), 'mapstudio-override-reset')).toContain('disabled');
        expect(tag(row(paused, 'comms'), 'mapstudio-override-edit')).toContain('disabled');
    });

    test('L10: an unlinked item shows the paths as written and the note', () => {
        const html = panel({ liveNow: block({}, { ...VIEW, assetId: null as unknown as string, assetPath: null as unknown as string }) });
        expect(tag(html, 'class="mapstudio-livenow"')).toContain('data-unlinked="true"');
        expect(row(html, 'kpi:pressure')).toContain('{asset.path}/Pressure');
        expect(html).toContain('Not linked, so the paths show as the kind has them. Linking an asset fills them.');
    });

    test('a linked item whose asset is not in the asset list is not told "Not linked"', () => {
        const html = panel({ liveNow: block({}, { ...VIEW, assetPath: null as unknown as string }) });
        expect(tag(html, 'class="mapstudio-livenow"')).toContain('data-unlinked="false"');
        expect(tag(html, 'class="mapstudio-livenow"')).toContain('data-asset-missing="true"');
        expect(html).toContain('The paths show as the kind has them, since its asset is not in the asset list.');
        expect(html).not.toContain('Not linked, so the paths');
    });

    test('a refusal an earlier visit left is cleared when the panel opens, and a closed field takes its refusal with it', () => {
        const cleared: string[] = [];
        const refusal = { row: 'comms', words: 'no', path: '[default]x', batchId: 'b1' };
        const opened = new PropertiesPanel(props({ liveNow: block(), overrideRefusal: refusal, onClearOverrideRefusal: (id) => cleared.push(id) }));
        opened.componentDidMount();
        expect(cleared).toEqual(['p1']);
        const typing = new PropertiesPanel(props({ liveNow: block(), overrideRefusal: refusal, onClearOverrideRefusal: (id) => cleared.push(id) }));
        typing.setState = (() => undefined) as typeof typing.setState;
        (typing as unknown as { closeOverride(row: string): void }).closeOverride('alarms');
        expect(cleared).toEqual(['p1']);
        (typing as unknown as { closeOverride(row: string): void }).closeOverride('comms');
        expect(cleared).toEqual(['p1', 'p1']);
        // With no refusal nothing is cleared.
        new PropertiesPanel(props({ liveNow: block(), onClearOverrideRefusal: (id) => cleared.push(id) })).componentDidMount();
        expect(cleared).toHaveLength(2);
    });

    test('L12: a kind with no setup shows one line and the button; an unknown kind shows no block', () => {
        const none = liveNowBlock({ kindName: 'Well pad', setup: null, overrides: {}, view: VIEW, values: undefined, now: 0 });
        const html = panel({ liveNow: none });
        expect(tag(html, 'class="mapstudio-livenow"')).toContain('data-rows="0"');
        expect(html).toContain('Well pad has no setup yet, so its items show no live values.');
        expect(html).toMatch(/mapstudio-livenow-setup[^>]*>Open Well pad&#x27;s setup</);
        expect(panel({ liveNow: block(), kind: undefined })).not.toContain('mapstudio-livenow');
        expect(panel()).not.toContain('mapstudio-livenow');
    });
});
