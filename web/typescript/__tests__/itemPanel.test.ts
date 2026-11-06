// Details as the item form draws it (epic 4 entry 6, R3, R12; DESIGN.md Properties panel): the kind's fields after Location
// in the kind list's order and as their types, "Required" by a required label and the missing ones named at the top, Name
// underlined with its tooltip and description while another item has the name on a different asset, an unknown kind's
// values read only with Kind alone taking input, a vanished asset said under Asset, and the asset list's status message.
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdapterStatus, AssetName, FormField, Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import { PropertiesPanel, PropertiesPanelProps } from '../studio/PropertiesPanel';

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
const OK: AdapterStatus = { status: 'ok', message: '10 assets from mapstudio_dev.assets.', function: 'mapstudio_dev.assets', count: 10, left: 0,
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

function panel(overrides: Partial<PropertiesPanelProps> = {}): string {
    const item = overrides.item || record();
    return renderToStaticMarkup(React.createElement(PropertiesPanel, {
        item, kind: PAD, kinds: [PAD], assets: [], assetNames: NAMES, assetStatus: OK, items: [item], pending: false, paused: false,
        autoFocusName: false, onNameFocused: noop, onClose: noop, onRename: noop, onMove: noop, canMoveByClick: true, moving: false,
        onMoveStart: noop, onLink: noop, onKind: noop, onProperty: noop, onDelete: noop, toolInHand: false, delKey: true, ...overrides
    }));
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
            'title="Also the name of the item linked to Pad 14"', 'aria-describedby="mapstudio-twin-p1"',
            'data-twin="Also the name of the item linked to Pad 14"']) {
            expect(name).toContain(a);
        }
        expect(html).toContain('<span id="mapstudio-twin-p1" class="mapstudio-visually-hidden">Also the name of the item linked to Pad 14</span>');
        // Outside the label: the description is not part of Name's name.
        expect(html.indexOf('<span id="mapstudio-twin-p1"')).toBeGreaterThan(html.indexOf('</label>', html.indexOf('mapstudio-field-name')));
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
