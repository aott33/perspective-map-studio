// Details as the item form draws it (epic 4 entry 6, R3, R12; DESIGN.md Properties panel): the kind's fields after Location
// in the kind list's order and as their types, "Required" by a required label and the missing ones named at the top, Name
// underlined with its tooltip and description while another item has the name on a different asset, an unknown kind's
// values read only with Kind alone taking input (while the kind list is in use; else its status message), a vanished asset said
// under Asset, and the asset list's status message. From the review: a kind field sent and refused shows the record's value
// again once the item's saves settle, and a field changed and changed back before the first reply sends the change back.
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdapterStatus, Asset, AssetName, FormField, Kind } from '../adapters';
import { MapItemRecord } from '../contract';
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
        item, kind: PAD, kinds: [PAD], assets: [], assetNames: NAMES, assetStatus: OK, items: [item], assetRows: ASSETS, kindStatus: KINDS_OK,
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
