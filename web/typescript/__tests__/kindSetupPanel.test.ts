// The Kinds list and a kind's setup as they are drawn (epic 4 entry 12a; DESIGN.md Kind setup, key screen 6): the list's note, rows
// and the lists' status messages (K1); the setup's header, the Preview item select and the six numbered sections; Add absent at
// four rows and Remove off for the key value the style rule uses (K3); a refusal beside the field it names, else at the top (K5,
// K6); the resolve notes under the paths, and the one note with no linked item (K8); the fields paused with the words given.
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdapterStatus, Asset, Kind } from '../adapters';
import { KindSetupRecord, MapItemRecord } from '../contract';
import { KindSaveState, NO_KIND_SAVES, resolveKey } from '../kindSetup';
import { KINDS_NOTE, KindList } from '../studio/KindList';
import { MarkerColors } from '../markers';
import { KindSetupPanel, KindSetupPanelProps } from '../studio/KindSetupPanel';

const PAD: Kind = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [
    { key: 'operator', label: 'Operator', type: 'text', required: false, choices: [] }] };
const LINE: Kind = { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 5, fields: [] };
const FENCE: Kind = { id: 'geofence', name: 'Geofence', geometry: 'line', icon: 'geofence', labelRank: 0, fields: [], area: true };
const ASSETS: Asset[] = [{ id: 'P14', name: 'Pad 14', kind: 'pad', basePath: '[default]Mesa/P14' }];
const SETUP = {
    comms: { path: '{asset.path}/Comms', on: true },
    kpis: [
        { key: 'pressure', label: 'Pressure', path: '{asset.path}/Pressure', unit: 'psi', on: true, icon: true },
        { key: 'gas', label: 'Gas price', path: '[default]Shared/GasPrice', unit: '', on: false, icon: false }],
    alarms: { path: '{asset.path}', count: true, summary: false },
    link: '/pad/{item.name}',
    popupView: { path: 'Popups/PadDetails', params: { padName: '{item.name}' } },
    styleRule: { source: { kpi: 'pressure' }, type: 'bands', cases: [{ min: null, max: 900, preset: 'normal' }, { min: 900, max: null, preset: 'warning' }] }
};
const RECORD: KindSetupRecord = { kindId: 'pad', setup: SETUP, version: 4, deleted: false };

function item(id: string, name: string, over: Partial<MapItemRecord> = {}): MapItemRecord {
    return { id, kind: 'pad', name, geometry: { type: 'Point', coordinates: [-104.9, 39.7] }, properties: {}, assetId: null, overrides: {},
        ends: null, attachment: null, version: 1, deleted: false, ...over };
}
const ITEMS = [item('a', 'P2', { assetId: 'P14', overrides: { styleRule: { source: { path: '[default]x' } } } }), item('b', 'P3')];

const noop = (): void => undefined;

// Token values as the map reads them from the theme (any text: the tiles only hand them to the marker drawing).
const COLORS: MarkerColors = {
    disc: 'rgb(255, 255, 255)', glyph: 'rgb(30, 30, 30)', halo: 'rgb(250, 250, 250)', textSecondary: 'rgb(120, 120, 120)',
    line: 'rgb(90, 90, 90)', chipEdge: 'rgb(150, 150, 150)', selection: 'rgb(20, 80, 200)',
    commsLost: 'rgb(125, 60, 189)', alarm: ['rgb(200, 0, 0)', 'rgb(173, 95, 0)', 'rgb(50, 114, 217)'], font: 'Inter, sans-serif',
    attention: 'rgb(50, 50, 50)', warning: 'rgb(173, 95, 1)', fault: 'rgb(200, 0, 1)',
    tints: ['rgb(8, 105, 98)', 'rgb(3, 133, 55)', 'rgb(34, 154, 214)', 'rgb(237, 83, 147)', 'rgb(207, 121, 17)', 'rgb(17, 69, 153)']
};

function panel(over: Partial<KindSetupPanelProps> = {}): string {
    const props: KindSetupPanelProps = {
        kind: PAD, record: RECORD, items: ITEMS, assets: ASSETS, previewId: null, onPreview: noop, saves: NO_KIND_SAVES, paused: '', resolves: {},
        alarmPage: '/alarms/{item.name}', onSave: () => true, onClearRefusal: noop, onResolve: noop, ...over
    };
    return renderToStaticMarkup(React.createElement(KindSetupPanel, props));
}

/** The markup of the element that opens with `marker`, up to the next element that opens with `until`. */
function slice(html: string, marker: string, until: string): string {
    const at = html.indexOf(marker);
    if (at < 0) {
        throw new Error('No ' + marker + ' in the markup.');
    }
    const end = html.indexOf(until, at + marker.length);
    return html.slice(at, end < 0 ? undefined : end);
}

function section(html: string, name: string): string {
    return slice(html, 'data-section="' + name + '"', 'data-section="');
}

function status(word: AdapterStatus['status'], message: string): AdapterStatus {
    return { status: word, message, function: 'mapstudio_dev.kinds', count: 3, left: 1, refreshedAt: null };
}

describe('the Kinds list (K1)', () => {
    function list(kindStatus: AdapterStatus | null, assetStatus: AdapterStatus | null, kinds: Kind[] = [PAD, LINE, FENCE]): string {
        return renderToStaticMarkup(React.createElement(KindList, { header: null, kinds, counts: { pad: 5, line: 1 }, chosen: 'pad', kindStatus,
            assetStatus, onChoose: noop }));
    }

    test('the note, then one row per kind with its geometry and item count; the chosen one is current', () => {
        const html = list(status('ok', '3 kinds.'), status('ok', '10 assets.'));
        expect(html).toContain(KINDS_NOTE);
        expect(html).toContain('data-rows="3"');
        expect(html).not.toContain('mapstudio-kinds-status');
        const pad = slice(html, 'data-kind="pad" data-geometry="point"', '</button>');
        expect(pad).toContain('data-count="5"');
        expect(pad).toContain('aria-current="true"');
        expect(pad).toContain('Well pad');
        expect(pad).toContain('Point - 5 items');
        expect(slice(html, 'data-kind="line"', '</button>')).toContain('Line - 1 item<');
        const fence = slice(html, 'data-kind="geofence"', '</button>');
        expect(fence).toContain('Area - 0 items');
        expect(fence).not.toContain('aria-current');
    });

    test('a list that is not ok says its message above the rows, the kind list\'s and the asset list\'s', () => {
        const html = list(status('incomplete', '3 kinds from mapstudio_dev.kinds; 1 row left out: row 4 has no id.'), status('failing', 'The asset function failed.'));
        expect(html).toContain('data-list="kinds" data-status="incomplete">3 kinds from mapstudio_dev.kinds; 1 row left out: row 4 has no id.<');
        expect(html).toContain('data-list="assets" data-status="failing">The asset function failed.<');
        expect(html.indexOf('mapstudio-kinds-status')).toBeLessThan(html.indexOf('mapstudio-kind-row'));
    });

    test('no kinds', () => {
        expect(list(status('empty', 'The kind function returned no kinds.'), null, [])).toContain('No kinds yet.');
    });
});

describe('a kind\'s setup', () => {
    test('the header: the name, the subline and the preview item with its asset folder', () => {
        const html = panel();
        expect(html).toContain('data-kind="pad"');
        expect(html).toContain('data-version="4"');
        expect(html).toContain('Point - applies to 2 items - 1 override (P2 style rule)');
        const preview = slice(html, 'data-field="preview"', 'mapstudio-kindsetup-body');
        expect(preview).toContain('<option selected="" value="a">P2 - [default]Mesa/P14</option>');
        expect(preview).toContain('[default]Mesa/P14</span>');
        expect(html).toContain('data-preview="a"');
    });

    test('12b2: Show on map beside the select, the line under it, and the Live now note last in section 6', () => {
        const NORMAL = { commsLost: false, stale: false, alarm: null, iconKpi: null, badge: 'normal' as const, preset: 'warning' as const };
        // P2 has its own rule (decision 3): the note says so.
        const own = panel({ previewState: NORMAL, previewOwnRule: true });
        const preview = slice(own, 'data-field="preview"', 'mapstudio-kindsetup-body');
        expect(preview).toContain('mapstudio-kindsetup-show');
        expect(preview).toContain('>Show on map</button>');
        expect(preview).toContain('data-off=""');
        expect(preview).not.toContain('disabled=""');
        expect(preview).toContain('each tag path is checked for this item&#x27;s asset, and it carries the word Preview on the map.');
        const note = (html: string): string => slice(html, 'class="mapstudio-rule-live"', '</section>');
        expect(note(own)).toContain('role="status" aria-live="polite" data-preview="a"');
        expect(note(own)).toContain('P2 has its own style rule, so this kind&#x27;s rule does not draw on it. Choose another preview item.');
        // The note is the section's last child.
        expect(own.indexOf('mapstudio-rule-live')).toBeGreaterThan(own.indexOf('mapstudio-rule-case'));
        expect(note(own)).toMatch(/<\/div>$/);
        // Another item, its state from the Gateway; with an alarm the note says it wins.
        const items = [item('b', 'P3', { assetId: 'P14' })];
        expect(note(panel({ items, previewState: NORMAL }))).toContain('Live now: P3 is Warning.');
        expect(note(panel({ items, previewState: { ...NORMAL, alarm: { priority: 1, unacked: true, active: 1, stale: false }, badge: 'alarm' } })))
            .toContain('Live now: P3 is Warning, but its priority 1 alarm wins over the rule.');
        expect(note(panel({ items }))).toContain('Live now: no live values for P3 yet.');
        // No preview item: the button is off with its reason, and the note says the kind has no item.
        const none = panel({ items: [item('b', 'P3')] });
        const off = slice(none, 'mapstudio-kindsetup-show-holder', '</div>');
        expect(off).toContain('title="No well pad is linked to an asset yet, so there is no preview item to show."');
        expect(off).toContain('disabled=""');
        // The reason is the button's description, not only hover text.
        const described = /aria-describedby="([^"]+)"/.exec(off)![1];
        expect(none).toContain('<span id="' + described + '" hidden="">No well pad is linked to an asset yet, so there is no preview item to show.</span>');
        expect(note(none)).toContain('No well pad is linked to an asset yet, so this kind has no item to show the rule on.');
        // An area kind (decision 4).
        const fence = panel({ kind: FENCE, record: undefined, items: [] });
        expect(note(fence)).toContain('An area draws its category tint, not a preset, so the style rule has no preview on the map.');
    });

    test('the six sections in DESIGN.md\'s order, numbered', () => {
        const html = panel();
        const order = ['icon', 'keyValues', 'comms', 'alarms', 'popup', 'styleRule'].map((s) => html.indexOf('data-section="' + s + '"'));
        expect(order.every((at) => at > 0)).toBe(true);
        expect(order.slice().sort((a, b) => a - b)).toEqual(order);
        for (const [n, title] of [[1, 'Icon'], [2, 'Key values'], [3, 'Comms'], [4, 'Alarms'], [5, 'Popup'], [6, 'Style rule']]) {
            expect(html).toContain('<span class="mapstudio-kindsetup-number">' + n + '</span> ' + title);
        }
        expect(section(html, 'icon')).toContain('comes from the project&#x27;s kind list');
        expect(section(html, 'styleRule')).toContain('data-rule="bands"');
        expect(section(html, 'styleRule')).toContain('Builds on key values');
        expect(section(html, 'alarms')).toContain('/alarms/{item.name}</span> - set in the Designer');
        expect(section(html, 'popup')).toContain('Order is fixed: comms, values, alarms');
    });

    test('K3: the rows with their switch and star; Remove is off for the one the rule uses; Add shows below four rows', () => {
        const html = section(panel(), 'keyValues');
        expect(html).toContain('data-rows="2"');
        const pressure = slice(html, 'data-key="pressure"', 'data-key="gas"');
        expect(pressure).toContain('value="{asset.path}/Pressure"');
        expect(slice(pressure, 'data-field="kpis.pressure.on"', '</div>')).toContain('checked=""');
        expect(slice(pressure, 'data-field="kpis.pressure.icon"', '</button>')).toContain('aria-pressed="true"');
        expect(slice(pressure, 'mapstudio-kv-remove', '</button>')).toContain('disabled=""');
        expect(pressure).toContain('title="Used by the style rule"');
        expect(pressure).toContain('Used by style rule');
        const gas = slice(html, 'data-key="gas"', 'mapstudio-kv-add');
        expect(slice(gas, 'data-field="kpis.gas.on"', '</div>')).not.toContain('checked');
        expect(slice(gas, 'data-field="kpis.gas.icon"', '</button>')).toContain('aria-pressed="false"');
        expect(slice(gas, 'mapstudio-kv-remove', '</button>')).not.toContain('disabled');
        expect(html).toContain('Add a key value');
    });

    test('K3: Add is absent at four rows', () => {
        const four = { ...SETUP, kpis: SETUP.kpis.concat([
            { key: 'a', label: 'A', path: '{asset.path}/A', unit: '', on: true, icon: false },
            { key: 'b', label: 'B', path: '{asset.path}/B', unit: '', on: true, icon: false }]) };
        const html = section(panel({ record: { ...RECORD, setup: four } }), 'keyValues');
        expect(html).toContain('data-rows="4"');
        expect(html).not.toContain('Add a key value');
    });

    test('the popup: its parts as the setup holds them, the link, the view and its params, a picker on the link and each value', () => {
        const html = section(panel(), 'popup');
        expect(slice(html, 'data-field="popup.comms"', '</div>')).toContain('checked=""');
        expect(slice(html, 'data-field="popup.alarmCount"', '</div>')).toContain('checked=""');
        expect(slice(html, 'data-field="popup.alarmSummary"', '</div>')).not.toContain('checked');
        expect(slice(html, 'data-field="link"', 'data-field="popupView.path"')).toContain('value="/pad/{item.name}"');
        expect(slice(html, 'data-field="link"', 'data-field="popupView.path"')).toContain('data-picker-for="link"');
        const param = slice(html, 'data-field="popupView.params.padName"', 'mapstudio-param-add');
        expect(param).toContain('value="padName"');
        expect(param).toContain('value="{item.name}"');
        expect(param).toContain('data-picker-for="param:padName:value"');
    });

    test('a kind with no setup: every part empty, the popup parts off until their path is set, no param until the view is', () => {
        const html = panel({ kind: LINE, record: undefined, items: [] });
        expect(html).toContain('data-version="0"');
        expect(html).toContain('Line - applies to 0 items - no overrides');
        expect(section(html, 'keyValues')).toContain('No key values yet');
        expect(section(html, 'styleRule')).toContain('No style rule');
        expect(section(html, 'styleRule')).toContain('data-rule="none"');
        const popup = section(html, 'popup');
        expect(slice(popup, 'data-field="popup.comms"', '</div>')).toContain('title="Set the heartbeat path first"');
        expect(slice(popup, 'data-field="popup.comms"', '</div>')).toContain('disabled=""');
        expect(slice(popup, 'mapstudio-param-add', '>Add a param<')).toContain('disabled=""');
    });

    test('K8: a resolve note under each stored path for the preview item\'s asset; a full path is the same tag for every pad', () => {
        const resolves = {
            [resolveKey('pad', 'P14', '{asset.path}/Pressure')]: { state: 'resolved' as const, n: 1, m: 1 },
            [resolveKey('pad', 'P14', '{asset.path}/Comms')]: { state: 'resolved' as const, n: 3, m: 5 },
            [resolveKey('pad', 'P14', '{asset.path}')]: { state: 'failed' as const, message: 'The tag system did not answer within 5 s.' }
        };
        const html = panel({ resolves });
        const pressure = slice(html, 'data-field="kpis.pressure.path"', 'mapstudio-kv-actions');
        expect(pressure).toContain('data-state="resolved" data-warning="false"');
        expect(pressure).toContain('Resolves for 1 of 1 well pads');
        const gas = slice(html, 'data-field="kpis.gas.path"', 'mapstudio-kv-actions');
        expect(gas).toContain('data-state="shared" data-warning="true"');
        expect(gas).toContain('Same tag for every well pad');
        const comms = slice(html, 'data-field="comms.path"', 'data-field="comms.on"');
        expect(comms).toContain('mapstudio-resolve-note--warning');
        expect(comms).toContain('Resolves for 3 of 5 well pads');
        expect(slice(html, 'data-field="alarms.path"', 'data-field="alarmPage"')).toContain('Could not check this path: The tag system did not answer within 5 s.');
    });

    test('K8: with no linked item of the kind one note under the Preview item select says so, and none stands under the paths', () => {
        const html = panel({ items: [item('b', 'P3')] });
        expect(html).toContain('No well pad is linked to an asset yet, so its tag paths cannot be checked.');
        expect(html).toContain('<option selected="" value="">No linked item</option>');
        expect(html).not.toContain('mapstudio-resolve-note');
        expect(html).toContain('data-preview=""');
    });

    test('K5, K6: a refusal stands beside the field it names; one that names none stands at the top', () => {
        const refusal = (field: string, at: string, words: string) => ({ field, at, words, code: 'invalid', batchId: 'b' });
        const saves: KindSaveState = { saving: [], done: 2, refusals: [
            refusal('link', 'link', 'link is a Perspective page path starting with one / (/pad/{item.name}), not //x.'),
            refusal('param:padName:value', 'popupView.params.padName', 'a {item.name} mixes text and placeholders.'),
            refusal('kpis.gas.path', '', 'The kind list is not available (empty). Nothing was saved.')] };
        const html = panel({ saves });
        const link = slice(html, 'data-field="link"', 'data-field="popupView.path"');
        expect(link).toContain('mapstudio-field-refusal');
        expect(link).toContain('not //x.');
        expect(link).toContain('aria-invalid="true"');
        expect(slice(html, 'data-field="popupView.params.padName"', 'mapstudio-param-add')).toContain('a {item.name} mixes text and placeholders.');
        const top = slice(html, 'mapstudio-kindsetup-top-refusal', 'data-section="icon"');
        expect(top).toContain('The kind list is not available (empty). Nothing was saved.');
        expect(html.match(/mapstudio-field-refusal-text/g)).toHaveLength(3);
        // A conflict has no words here: its card says them.
        expect(panel({ saves: { saving: ['link'], done: 0, refusals: [{ field: 'link', at: '', words: '', code: 'conflict', batchId: 'b' }] } }))
            .not.toContain('mapstudio-field-refusal');
    });

    // Entry 12b1: section 6 as it is drawn from the stored rule (the typing and the saves are e2e/tests/kindstyle.spec.mjs).
    describe('section 6, the Style rule editor (12b1)', () => {
        const rule = (html: string): string => section(html, 'styleRule');
        const withRule = (styleRule: unknown, kind: Kind = PAD): string =>
            panel({ kind, record: { kindId: kind.id, setup: { kpis: SETUP.kpis, styleRule } as Record<string, unknown>, version: 2, deleted: false }, colors: COLORS });

        test('the type is a segmented choice in the panel tabs\' look; From its instruments only for a line kind that is not an area', () => {
            const html = rule(panel());
            expect(html.match(/data-type="[a-z]+"/g)).toEqual(['data-type="none"', 'data-type="states"', 'data-type="bands"', 'data-type="expression"']);
            expect(html).toContain('<button type="button" data-type="bands" aria-pressed="true" class="mapstudio-panel-tab mapstudio-rule-type mapstudio-panel-tab--active">Bands</button>');
            expect(rule(panel({ kind: LINE, record: undefined, items: [] }))).toContain('data-type="instruments"');
            expect(rule(panel({ kind: LINE, record: undefined, items: [] }))).toContain('>From its instruments</button>');
            expect(rule(panel({ kind: FENCE, record: undefined, items: [] }))).not.toContain('data-type="instruments"');
        });

        test('S1: Bands on a key value: the value select lists every key value, switched-off ones too; a row per band with its preset and tile', () => {
            const html = rule(panel({ colors: COLORS }));
            const source = slice(html, 'data-field="styleRule.source"', 'mapstudio-rule-case');
            expect(source).toContain('<option selected="" value="kpi:pressure">Pressure</option>');
            expect(source).toContain('<option value="kpi:gas">Gas price (off in the popup)</option>');
            expect(source).toContain('<option value="path">A tag path</option>');
            expect(html.match(/class="mapstudio-rule-case"/g)).toHaveLength(2);
            const second = slice(html, 'data-index="1"', 'Add a band');
            expect(second).toContain('class="mapstudio-input mapstudio-kindsetup-input mapstudio-rule-from" value="900"');
            expect(second).toContain('placeholder="Open above"');
            expect(second).toContain('<option selected="" value="warning">Warning</option>');
            // The closed list by name, never a colour: a point kind has no line presets.
            expect(second).not.toContain('value="dashed"');
            expect(second).not.toMatch(/#[0-9a-fA-F]{3,6}"?>/);
            const tile = slice(second, 'mapstudio-rule-tile', 'mapstudio-rule-remove');
            expect(tile).toContain('data-preset="warning"');
            expect(tile).toContain('<svg');
            expect(tile).toContain('mapstudio-rule-word">Warning</span>');
            // A stored rule is whole: nothing says Not saved yet.
            expect(html).toContain('data-unsaved="false"');
            // The note is one node that stays mounted (entry 12c3), with no words while nothing is missing.
            expect(html).toMatch(/class="mapstudio-rule-unsaved" role="status" data-unsaved="false"><\/span>/);
        });

        test('S2: States on a tag path: "When the value is", the typed path with its resolve note, a tile per case', () => {
            const styleRule = { source: { path: '{asset.path}/Status' }, type: 'states', cases: [{ value: 1, preset: 'attention' }, { value: '1', preset: 'fault' }] };
            const key = resolveKey('pad', 'P14', '{asset.path}/Status');
            const html = rule(panel({ record: { ...RECORD, setup: { ...SETUP, styleRule } }, colors: COLORS, resolves: { [key]: { state: 'resolved', n: 1, m: 1 } } }));
            expect(html).toContain('data-source="path"');
            expect(html).toContain('mapstudio-rule-path" value="{asset.path}/Status"');
            expect(html).toContain('Resolves for 1 of 1 well pads');
            // Said once above the rows (entry 12c3); each row's field is named by it and its place.
            expect(html.match(/mapstudio-rule-when-label">When the value is</g)).toHaveLength(1);
            // Each row's value is labelled by the one label and by its own row ("Case 2").
            const when = /<span id="([^"]+)" class="mapstudio-field-label mapstudio-rule-when-label">/.exec(html)![1];
            expect(html).toContain('<div id="' + when + '-1" class="mapstudio-rule-case" role="group" aria-label="Case 2"');
            expect(html).toContain('aria-labelledby="' + when + ' ' + when + '-1"');
            // The rows are parted by a divider, with no card border: no label of their own, and the selects say the tiles' words.
            expect(html).not.toContain('mapstudio-rule-when"');
            expect(html).toContain('<option value="dimmed">Out of service</option>');
            expect(html).toContain('mapstudio-rule-value" value="1"');
            expect(html).toContain('mapstudio-rule-value" value="&quot;1&quot;"');
            expect(html.match(/class="mapstudio-rule-tile" data-preset="(attention|fault)"/g)).toHaveLength(2);
            expect(rule(withRule({ source: { kpi: 'pressure' }, type: 'states', cases: [{ value: 1, preset: 'fault' }] }))).toContain('When Pressure is');
        });

        test('S4: Expression: a multi-line field, the hint, and the Gateway\'s reason beside it when refused', () => {
            const styleRule = { type: 'expression', expression: "if({value} > 600, 'warning', 'normal')" };
            const saves: KindSaveState = { saving: [], done: 1, refusals: [
                { field: 'styleRule', at: 'styleRule.expression', words: 'the expression could not be read: unexpected end.', code: 'invalid', batchId: 'b1' }] };
            const html = rule(panel({ record: { ...RECORD, setup: { ...SETUP, styleRule } }, colors: COLORS, saves }));
            const field = slice(html, 'data-field="styleRule.expression"', 'mapstudio-rule-named');
            expect(field).toContain('<textarea');
            expect(field).toContain('if({value} &gt; 600, &#x27;warning&#x27;, &#x27;normal&#x27;)</textarea>');
            expect(field).toContain('{value}</span> is the one reference');
            expect(field).toContain('The result is a preset name, as text: normal, attention, warning, fault, dimmed.');
            expect(field).toContain('the expression could not be read: unexpected end.');
            expect(field).toContain('aria-invalid="true"');
            // Its value is optional, and its tiles are the presets its text names.
            expect(html).toContain('<option selected="" value="">No value</option>');
            expect(html.match(/class="mapstudio-rule-tile" data-preset="(warning|normal)"/g)).toHaveLength(2);
        });

        test('S5, S6: From its instruments has no value or cases, one line; None says No style rule', () => {
            const html = rule(withRule({ source: { instruments: 'worst' } }, LINE));
            expect(html).toContain('data-rule="instruments"');
            expect(html).toContain('Each segment takes the worst of the instruments at its ends.');
            expect(html).not.toContain('data-field="styleRule.source"');
            expect(html).not.toContain('mapstudio-rule-case');
            const none = rule(panel({ record: { ...RECORD, setup: { ...SETUP, styleRule: undefined } } }));
            expect(none).toContain('data-rule="none"');
            expect(none).toContain('No style rule');
            // "Used by style rule" stands on the key value a saved rule reads, and goes with the rule.
            expect(section(panel(), 'keyValues')).toContain('Used by style rule');
            expect(section(panel({ record: { ...RECORD, setup: { ...SETUP, styleRule: undefined } } }), 'keyValues')).not.toContain('Used by style rule');
        });

        test('S8: a refused case\'s words stand beside that row; a line kind\'s preset list has the line presets', () => {
            const saves: KindSaveState = { saving: [], done: 1, refusals: [
                { field: 'styleRule', at: 'styleRule.cases.1', words: 'min must be below max.', code: 'invalid', batchId: 'b1' }] };
            const html = rule(panel({ saves }));
            expect(slice(html, 'data-index="0"', 'data-index="1"')).not.toContain('mapstudio-field-refusal');
            const second = slice(html, 'data-index="1"', 'Add a band');
            expect(second).toContain('min must be below max.');
            expect(second).toContain('aria-invalid="true"');
            expect(html.match(/mapstudio-field-refusal-text/g)).toHaveLength(1);
            const line = rule(withRule({ source: { kpi: 'pressure' }, type: 'bands', cases: [{ min: 0, max: 1, preset: 'dashed' }] }, LINE));
            expect(line).toContain('<option selected="" value="dashed">Dashed</option>');
            expect(line).toContain('<option value="dotted">Dotted</option>');
        });

        test('S9: an area kind\'s tints under the rule: the property, a choice field\'s choices as rows, each with its tint and swatch', () => {
            const fence: Kind = { ...FENCE, fields: [
                { key: 'operator', label: 'Operator', type: 'choice', required: false, choices: ['North', 'South', 'West'] }] };
            const record: KindSetupRecord = { kindId: 'geofence', version: 1, deleted: false,
                setup: { areaTints: { property: 'operator', tints: [{ category: 'North', tint: 'tint-1' }, { category: 'South', tint: 'tint-4' }] } } };
            const html = rule(panel({ kind: fence, record, items: [], colors: COLORS }));
            const tints = html.slice(html.indexOf('data-field="areaTints"'));
            expect(tints).toContain('<option selected="" value="operator">Operator</option>');
            expect(tints).toContain('<option value="">No tints</option>');
            expect(tints.match(/class="mapstudio-tint-row"[^>]*data-category="[A-Za-z]+" data-tint="[a-z0-9-]*"/g))
                .toEqual(['North', 'South', 'West'].map((c, i) => 'class="mapstudio-tint-row" role="group" aria-label="Tint of ' + c + '" data-category="' + c
                    + '" data-tint="' + ['tint-1', 'tint-4', ''][i] + '"'));
            expect(slice(tints, 'data-category="South"', 'data-category="West"')).toContain('<option selected="" value="tint-4">tint-4</option>');
            expect(slice(tints, 'data-category="South"', 'data-category="West"')).toContain('<svg');
            expect(tints).not.toContain('mapstudio-tints-unsaved');
            // A text field's categories are typed; a kind that is not an area has no tints.
            const typed = rule(panel({ kind: { ...FENCE, fields: PAD.fields }, record, items: [] }));
            expect(typed).toContain('class="mapstudio-input mapstudio-kindsetup-input mapstudio-tint-category" value="North"');
            expect(typed).toContain('Add a category');
            expect(rule(panel())).not.toContain('data-field="areaTints"');
            expect(rule(panel({ kind: LINE, record: undefined, items: [] }))).not.toContain('data-field="areaTints"');
        });

        test('paused: no control of the rule or the tints takes input', () => {
            const html = rule(panel({ paused: 'Paused - the map store is unreachable' }));
            const controls = html.match(/<(?:input|select|button|textarea) [^>]*>/g) || [];
            expect(controls.length).toBeGreaterThan(8);
            expect(controls.every((c) => c.indexOf('disabled=""') >= 0)).toBe(true);
        });
    });

    test('paused: the words at the top and no field takes input', () => {
        const html = panel({ paused: "Not saved - conflict with mapeditor2's change" });
        expect(html).toContain('mapstudio-kindsetup-paused');
        expect(html).toContain('Not saved - conflict with mapeditor2&#x27;s change');
        const body = html.slice(html.indexOf('mapstudio-kindsetup-body'));
        const inputs = body.match(/<input [^>]*>/g) || [];
        expect(inputs.length).toBeGreaterThan(10);
        expect(inputs.every((i) => i.indexOf('disabled=""') >= 0)).toBe(true);
        expect(body).not.toMatch(/<button [^>]*mapstudio-kv-star(?![^>]*disabled)[^>]*>/);
    });

    test('no em dash anywhere in the surface\'s words', () => {
        expect(panel()).not.toContain(String.fromCharCode(0x2014));
        expect(panel({ kind: LINE, record: undefined, items: [] })).not.toContain(String.fromCharCode(0x2014));
    });
});

describe('the tag buttons (entry 13b)', () => {
    const buttons = (html: string): string[] => html.match(/<button[^>]*mapstudio-tag-button[^>]*>/g) || [];
    const forOf = (button: string): string => (/data-tag-for="([^"]*)"/.exec(button) || ['', ''])[1];

    test('each path of Key values, Comms and Alarms ends in a tag button named for its value', () => {
        const html = panel({ onBrowse: noop });
        // From entry 13c a popup param's value has the button too (the last one here).
        expect(buttons(html).map(forOf)).toEqual(['kpis.pressure.path', 'kpis.gas.path', 'comms.path', 'alarms.path', 'param:padName']);
        expect(buttons(html)[0]).toContain('title="Pick a tag" aria-label="Pick a tag for Pressure" aria-haspopup="dialog" aria-expanded="false"');
        expect(buttons(html)[2]).toContain('aria-label="Pick a tag for heartbeat path"');
        // The link and the popup view's own path are not tag paths.
        expect(slice(html, 'data-field="link"', 'data-field="popupView.params.padName"')).not.toContain('mapstudio-tag-button');
    });

    test('entry 13c: a param\'s value and the style rule\'s tag path have the button; a rule on a key value has none', () => {
        const html = panel({ onBrowse: noop });
        expect(buttons(html)[4]).toContain('aria-label="Pick a tag for param padName"');
        expect(buttons(html).map(forOf)).not.toContain('styleRule.path');
        const onPath = { ...RECORD, setup: { ...SETUP, styleRule: { ...SETUP.styleRule, source: { path: '{asset.path}/Status' } } } };
        const withPath = panel({ onBrowse: noop, record: onPath });
        expect(buttons(withPath).map(forOf)).toEqual(['kpis.pressure.path', 'kpis.gas.path', 'comms.path', 'alarms.path', 'param:padName', 'styleRule.path']);
        expect(buttons(withPath)[5]).toContain('aria-label="Pick a tag for the style rule"');
        // Without a way to open the browser (anyone but a full editor in the studio) the rule's path stands alone.
        expect(buttons(panel({ record: onPath }))).toEqual([]);
        const open = panel({ onBrowse: noop, record: onPath, browsing: 'styleRule.path' });
        expect(buttons(open).filter((b) => b.indexOf('aria-expanded="true"') >= 0).map(forOf)).toEqual(['styleRule.path']);
        expect(open).toContain('class="mapstudio-kindsetup-field mapstudio-rule-source mapstudio-kindsetup-field--browsing"');
        const param = panel({ onBrowse: noop, browsing: 'param:padName' });
        expect(param).toContain('class="mapstudio-param-row mapstudio-param-row--browsing"');
    });

    test('entry 13c: a pick for a stored param is its value edit at the version the card saw; a param or a rule that is gone says so', () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const sent: unknown[] = [];
        const made = (): KindSetupPanel => new KindSetupPanel({
            kind: PAD, record: RECORD, items: ITEMS, assets: ASSETS, previewId: null, onPreview: noop, saves: NO_KIND_SAVES, paused: '', resolves: {},
            alarmPage: '', onSave: (field: string, edit: unknown, seen: number): boolean => { sent.push([field, edit, seen]); return true; },
            onClearRefusal: noop, onResolve: noop });
        expect(made().usePick('param:padName', '{asset.path}/Pressure', 3)).toBe('');
        expect(sent).toEqual([['param:padName:value', { part: 'param.value', name: 'padName', value: '{asset.path}/Pressure' }, 3]]);
        // The stored value again sends nothing.
        expect(made().usePick('param:padName', '{item.name}', 3)).toBe('');
        expect(sent).toHaveLength(1);
        expect(made().usePick('param:gone', '{asset.path}/Pressure', 3)).toBe('Not saved. This param is gone.');
        expect(made().usePick('param.new:p9', '{asset.path}/Pressure', 3)).toBe('Not saved. This param row is gone.');
        expect(made().usePick('styleRule.path', '{asset.path}/Status', 3)).toBe('Not saved. The style rule is no longer open.');
        expect(made().usePick('override:comms', '[default]a/b', 3)).toBe('Not saved. This path cannot take a pick.');
        expect(sent).toHaveLength(1);
    });

    test('the row the card is open for takes the selection tint and its button says it is open', () => {
        const kv = panel({ onBrowse: noop, browsing: 'kpis.gas.path' });
        expect(kv.match(/mapstudio-kv-row--browsing/g)).toHaveLength(1);
        expect(kv).toMatch(/class="mapstudio-kv-row mapstudio-kv-row--browsing" role="group" aria-label="Gas price"/);
        expect(buttons(kv).filter((b) => b.indexOf('aria-expanded="true"') >= 0).map(forOf)).toEqual(['kpis.gas.path']);
        const comms = panel({ onBrowse: noop, browsing: 'comms.path' });
        expect(comms).toContain('class="mapstudio-kindsetup-field mapstudio-kindsetup-field--browsing" data-field="comms.path"');
        expect(comms).not.toContain('mapstudio-kv-row--browsing');
    });

    test('paused, the buttons take no press; with nothing to open the browser there is no button', () => {
        expect(buttons(panel({ onBrowse: noop, paused: 'Not saved - conflict with mapeditor2\'s change' })).every((b) => b.indexOf('disabled=""') >= 0)).toBe(true);
        expect(buttons(panel())).toEqual([]);
    });
});

describe('a pick the panel does not take (entry 13b)', () => {
    const made = (over: Partial<KindSetupPanelProps> = {}): KindSetupPanel => new KindSetupPanel({
        kind: PAD, record: RECORD, items: ITEMS, assets: ASSETS, previewId: null, onPreview: noop, saves: NO_KIND_SAVES, paused: '', resolves: {},
        alarmPage: '', onSave: () => true, onClearRefusal: noop, onResolve: noop, ...over });

    test('a key value or a new row that is gone, the fields paused, or a save not taken: said in words, nothing sent', () => {
        const sent: string[] = [];
        const onSave = (field: string): boolean => { sent.push(field); return true; };
        expect(made({ onSave }).usePick('kpis.gone.path', '{asset.path}/Flow', 4)).toBe('Not saved. This key value row is gone.');
        expect(made({ onSave }).usePick('kpis.new:r9', '{asset.path}/Flow', 4)).toBe('Not saved. This key value row is gone.');
        expect(made({ onSave, paused: 'Not saved - conflict with mapeditor2\'s change' }).usePick('comms.path', '{asset.path}/Flow', 4))
            .toBe('Not saved. Not saved - conflict with mapeditor2\'s change');
        expect(sent).toEqual([]);
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        expect(made({ onSave: () => false }).usePick('comms.path', '{asset.path}/Flow', 4)).toBe('Not saved. Map Studio could not take the save now. Try again.');
    });

    test('a pick that is taken is sent as one edit of that path at the version the card saw; the stored path again sends nothing', () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const sent: unknown[] = [];
        const onSave = (field: string, edit: unknown, seen: number): boolean => { sent.push([field, edit, seen]); return true; };
        expect(made({ onSave }).usePick('kpis.gas.path', '{asset.path}/Flow', 3)).toBe('');
        expect(made({ onSave }).usePick('alarms.path', '{asset.path}', 3)).toBe('');
        expect(sent).toEqual([['kpis.gas.path', { part: 'kpi', key: 'gas', patch: { path: '{asset.path}/Flow' } }, 3]]);
    });
});
