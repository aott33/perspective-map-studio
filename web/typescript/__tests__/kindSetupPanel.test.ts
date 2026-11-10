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

    test('the six sections in DESIGN.md\'s order, numbered', () => {
        const html = panel();
        const order = ['icon', 'keyValues', 'comms', 'alarms', 'popup', 'styleRule'].map((s) => html.indexOf('data-section="' + s + '"'));
        expect(order.every((at) => at > 0)).toBe(true);
        expect(order.slice().sort((a, b) => a - b)).toEqual(order);
        for (const [n, title] of [[1, 'Icon'], [2, 'Key values'], [3, 'Comms'], [4, 'Alarms'], [5, 'Popup'], [6, 'Style rule']]) {
            expect(html).toContain('<span class="mapstudio-kindsetup-number">' + n + '</span> ' + title);
        }
        expect(section(html, 'icon')).toContain('comes from the project&#x27;s kind list');
        expect(section(html, 'styleRule')).toContain('Bands on Pressure: 2 bands');
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
