// A kind's setup as the Kinds screen reads and saves it (epic 4 entry 12a; kindSetup.ts). First the hazard: every save replaces the
// whole setup, so each part edited in turn on each of the five seed setups must leave every other part stored unchanged, values
// this screen does not draw included (K10). Then the matrix's logic: the edits (K2 to K4, K7, K9), the key from the label, a
// refusal's words placed by the order the rows were sent in (K5, K6), the header's words (K1), the resolve notes (K8), and the
// conflict card of a setup, which offers one choice (K11).
import { Asset, Kind } from '../adapters';
import { Conflict, EditBatch, KindSetupRecord, MapItemRecord } from '../contract';
import {
    Fields, MAX_KEY, POPUP_VIEW_HAS_PARAMS, SetupEdit, applyEdit, forgetSeen, popupPathEdit, batchSetup, compareNames, geometryWord, headerSubline, insertAt, isFullPath, itemsOfKind, keyFromLabel,
    noPreviewText, overridesText, paramMissing, pathsToResolve, pausedText, placeholderList, previewKey, previewOf, previewOptions, readPreview,
    readSetup, refusalPlace, removeBlocked, resolveKey, resolveNote, rowMissing, sameSetup, setupBatch, shownKind, styleRuleLine, waitingSave,
    writePreview
} from '../kindSetup';
import { UnsavedEntry, isSetupSave, onTopBatch, saveCardFor } from '../unsaved';
import { headerSaveWords } from '../problems';
import { CONNECTED } from '../connection';
import { STORE_UNKNOWN } from '../storeState';
import { SAVE_IDLE } from '../save';

// The five kind setups the dev map seeds (ops/project/ignition/script-python/mapstudio_seed/code.py), as stored.
const PAD_SETUP = {
    comms: { path: '{asset.path}/Comms', on: true },
    kpis: [
        { key: 'pressure', label: 'Pressure', path: '{asset.path}/Pressure', unit: 'psi', on: true, icon: true },
        { key: 'flow', label: 'Flow', path: '{asset.path}/Flow', unit: 'bbl/d', on: true, icon: false }],
    alarms: { path: '{asset.path}', count: true, summary: true },
    link: '/pad/{item.name}',
    styleRule: { source: { path: '{asset.path}/Status' }, type: 'states', cases: [
        { value: 1, preset: 'attention' }, { value: 2, preset: 'warning' }, { value: 3, preset: 'fault' }, { value: 4, preset: 'dimmed' }] }
};
const LINE_SETUP = {
    kpis: [{ key: 'flow', label: 'Flow', path: '{asset.path}/Flow', unit: 'bbl/d', on: true, icon: true }],
    styleRule: { source: { kpi: 'flow' }, type: 'bands', cases: [
        { min: null, max: 50, preset: 'normal' }, { min: 50, max: 200, preset: 'attention' }, { min: 200, max: null, preset: 'fault' }] }
};
const GEOFENCE_SETUP = {
    areaTints: { property: 'operator', tints: [{ category: 'North', tint: 'tint-1' }, { category: 'South', tint: 'tint-4' }] }
};
const TAP_SETUP = {
    comms: { path: '{asset.path}/Comms', on: true },
    kpis: [{ key: 'pressure', label: 'Pressure', path: '{asset.path}/Pressure', unit: 'psi', on: true, icon: true }],
    alarms: { path: '{asset.path}', count: true, summary: true },
    styleRule: { source: { kpi: 'pressure' }, type: 'bands', cases: [
        { min: null, max: 450, preset: 'normal' }, { min: 450, max: 600, preset: 'attention' }, { min: 600, max: null, preset: 'fault' }] }
};
const VALVE_SETUP = {
    comms: { path: '{asset.path}/Comms', on: true },
    kpis: [{ key: 'position', label: 'Position', path: '{asset.path}/Position', unit: '%', on: true, icon: false }]
};
const SEEDS: Array<[string, Record<string, unknown>]> = [
    ['pad', PAD_SETUP], ['line', LINE_SETUP], ['geofence', GEOFENCE_SETUP], ['tap', TAP_SETUP], ['valve', VALVE_SETUP]
];

const PAD: Kind = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [
    { key: 'operator', label: 'Operator', type: 'text', required: false, choices: [] },
    { key: 'wells', label: 'Wells', type: 'integer', required: false, choices: [] }] };
const LINE: Kind = { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 5, fields: [] };
const FENCE: Kind = { id: 'geofence', name: 'Geofence', geometry: 'line', icon: 'geofence', labelRank: 0, fields: [], area: true };
const CTB: Kind = { id: 'ctb', name: 'CTB battery', geometry: 'point', icon: 'tank-battery', labelRank: 4, fields: [] };

function item(id: string, name: string, over: Partial<MapItemRecord> = {}): MapItemRecord {
    return { id, kind: 'pad', name, geometry: { type: 'Point', coordinates: [-104.9, 39.7] }, properties: {}, assetId: null, overrides: {},
        ends: null, attachment: null, version: 1, deleted: false, ...over };
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** One edit per part the screen saves, each paired with the top-level keys it may change. */
function editsFor(setup: Record<string, unknown>): Array<{ edit: SetupEdit; touches: string[] }> {
    const view = readSetup(setup);
    const first = view.kpis[0];
    const all: Array<{ edit: SetupEdit; touches: string[] }> = [
        { edit: { part: 'comms.path', path: '{asset.path}/Heartbeat' }, touches: ['comms'] },
        { edit: { part: 'comms.path', path: '' }, touches: ['comms'] },
        { edit: { part: 'comms.on', on: false }, touches: ['comms'] },
        { edit: { part: 'alarms.path', path: '{asset.path}/Alarms' }, touches: ['alarms'] },
        { edit: { part: 'alarms.path', path: '' }, touches: ['alarms'] },
        { edit: { part: 'alarms.count', on: false }, touches: ['alarms'] },
        { edit: { part: 'alarms.summary', on: false }, touches: ['alarms'] },
        { edit: { part: 'link', link: '/site/{asset.id}' }, touches: ['link'] },
        { edit: { part: 'link', link: '' }, touches: ['link'] },
        { edit: { part: 'popupView.path', path: 'Popups/PadDetails' }, touches: ['popupView'] },
        { edit: { part: 'popupView.path', path: '' }, touches: ['popupView'] },
        { edit: { part: 'param.add', name: 'padName', value: '{item.name}' }, touches: ['popupView'] },
        { edit: { part: 'kpi.add', row: { key: 'gas', label: 'Gas price', path: '[default]Shared/GasPrice', unit: '' } }, touches: ['kpis'] }
    ];
    if (first) {
        all.push(
            { edit: { part: 'kpi', key: first.key, patch: { path: '{asset.path}/Other' } }, touches: ['kpis'] },
            { edit: { part: 'kpi', key: first.key, patch: { label: 'Renamed', unit: 'kPa' } }, touches: ['kpis'] },
            { edit: { part: 'kpi', key: first.key, patch: { on: false } }, touches: ['kpis'] },
            { edit: { part: 'kpi.icon', key: first.key, icon: !first.icon }, touches: ['kpis'] },
            { edit: { part: 'kpi.remove', key: first.key }, touches: ['kpis'] }
        );
    }
    return all;
}

describe('the whole setup passes through (K10): each part edited in turn on each of the five seed setups', () => {
    for (const [kindId, seed] of SEEDS) {
        test(kindId + ': every other part is stored unchanged, the same object', () => {
            for (const { edit, touches } of editsFor(seed)) {
                const stored = clone(seed);
                const frozen = clone(seed);
                const next = applyEdit(stored, edit);
                // The stored setup is never changed in place.
                expect(stored).toEqual(frozen);
                for (const key of Object.keys(stored)) {
                    if (touches.indexOf(key) < 0) {
                        expect(next[key]).toBe(stored[key]);
                    }
                }
                // No part appears that the edit did not name.
                for (const key of Object.keys(next)) {
                    if (!(key in stored)) {
                        expect(touches).toContain(key);
                    }
                }
            }
        });
    }

    test('a value this screen does not draw passes through at the top level and inside an edited part', () => {
        const stored = { ...clone(PAD_SETUP), future: { any: [1, 2] }, comms: { path: '{asset.path}/Comms', on: true, later: 'kept' },
            kpis: [{ ...PAD_SETUP.kpis[0], later: 7 }, PAD_SETUP.kpis[1]] };
        const comms = applyEdit(stored, { part: 'comms.path', path: '{asset.path}/Heartbeat' });
        expect(comms.future).toBe(stored.future);
        expect(comms.comms).toEqual({ path: '{asset.path}/Heartbeat', on: true, later: 'kept' });
        const kpi = applyEdit(stored, { part: 'kpi', key: 'pressure', patch: { path: '{asset.path}/P' } });
        expect((kpi.kpis as unknown[])[0]).toEqual({ ...PAD_SETUP.kpis[0], later: 7, path: '{asset.path}/P' });
        expect((kpi.kpis as unknown[])[1]).toBe(stored.kpis[1]);
        expect(kpi.styleRule).toBe(stored.styleRule);
    });

    test('the pad setup with its Pressure path changed keeps its style rule as it was (the acceptance criterion)', () => {
        const next = applyEdit(PAD_SETUP, { part: 'kpi', key: 'pressure', patch: { path: '{asset.path}/Flow' } });
        expect(next.styleRule).toBe(PAD_SETUP.styleRule);
        expect(next).toEqual({ ...PAD_SETUP, kpis: [{ ...PAD_SETUP.kpis[0], path: '{asset.path}/Flow' }, PAD_SETUP.kpis[1]] });
    });
});

describe('the setup read with its defaults', () => {
    test('on, count and summary default true, icon false; a part the setup lacks is null', () => {
        const view = readSetup({ comms: { path: 'a' }, kpis: [{ key: 'k', path: 'p' }], alarms: { path: 'x' } });
        expect(view.comms).toEqual({ path: 'a', on: true });
        expect(view.kpis).toEqual([{ key: 'k', label: '', path: 'p', unit: '', on: true, icon: false }]);
        expect(view.alarms).toEqual({ path: 'x', count: true, summary: true });
        expect(view.link).toBe('');
        expect(view.popupView).toBeNull();
        expect(readSetup(null)).toEqual({ comms: null, kpis: [], alarms: null, link: '', popupView: null, styleRule: null });
    });

    test('the popup view\'s params are rows in the stored order', () => {
        const view = readSetup({ popupView: { path: 'Popups/PadDetails', params: { padName: '{item.name}', area: 'Mesa' } } });
        expect(view.popupView).toEqual({ path: 'Popups/PadDetails', params: [{ name: 'padName', value: '{item.name}' }, { name: 'area', value: 'Mesa' }] });
    });
});

describe('the edits (K2, K3, K4, K7, K9)', () => {
    test('K2: a key value\'s path changed, by its key', () => {
        const next = readSetup(applyEdit(PAD_SETUP, { part: 'kpi', key: 'pressure', patch: { path: '{asset.path}/Casing' } }));
        expect(next.kpis.map((k) => [k.key, k.path])).toEqual([['pressure', '{asset.path}/Casing'], ['flow', '{asset.path}/Flow']]);
    });

    test('K3: a row added, starred (one star only) and switched off', () => {
        let setup = applyEdit(PAD_SETUP, { part: 'kpi.add', row: { key: 'gas', label: 'Gas price', path: '[default]Shared/GasPrice', unit: '' } });
        expect(readSetup(setup).kpis[2]).toEqual({ key: 'gas', label: 'Gas price', path: '[default]Shared/GasPrice', unit: '', on: true, icon: false });
        setup = applyEdit(setup, { part: 'kpi.icon', key: 'gas', icon: true });
        expect(readSetup(setup).kpis.map((k) => k.icon)).toEqual([false, false, true]);
        // A row that never had the star is the stored object still.
        expect((setup.kpis as unknown[])[1]).toBe(PAD_SETUP.kpis[1]);
        setup = applyEdit(setup, { part: 'kpi', key: 'flow', patch: { on: false } });
        expect(readSetup(setup).kpis.map((k) => k.on)).toEqual([true, false, true]);
        setup = applyEdit(setup, { part: 'kpi.icon', key: 'gas', icon: false });
        expect(readSetup(setup).kpis.some((k) => k.icon)).toBe(false);
    });

    test('K3: an add of a key already stored sets its values and adds no second row; a remove of the last row drops the part', () => {
        const again = applyEdit(PAD_SETUP, { part: 'kpi.add', row: { key: 'flow', label: 'Flow rate', path: '{asset.path}/Flow', unit: 'bbl/d' } });
        expect(readSetup(again).kpis.map((k) => k.label)).toEqual(['Pressure', 'Flow rate']);
        expect('kpis' in applyEdit(VALVE_SETUP, { part: 'kpi.remove', key: 'position' })).toBe(false);
    });

    test('K4: comms and alarms paths and the popup parts; a switch of a part that is not there changes nothing', () => {
        expect(readSetup(applyEdit(PAD_SETUP, { part: 'comms.on', on: false })).comms).toEqual({ path: '{asset.path}/Comms', on: false });
        expect(readSetup(applyEdit(PAD_SETUP, { part: 'alarms.count', on: false })).alarms).toEqual({ path: '{asset.path}', count: false, summary: true });
        expect(readSetup(applyEdit(PAD_SETUP, { part: 'alarms.summary', on: false })).alarms).toEqual({ path: '{asset.path}', count: true, summary: false });
        expect(applyEdit(LINE_SETUP, { part: 'comms.on', on: false })).toBe(LINE_SETUP);
        expect(applyEdit(LINE_SETUP, { part: 'alarms.count', on: false })).toBe(LINE_SETUP);
        // A path typed empty takes its part away: the Gateway takes no part without its path.
        expect('comms' in applyEdit(PAD_SETUP, { part: 'comms.path', path: '' })).toBe(false);
        expect('link' in applyEdit(PAD_SETUP, { part: 'link', link: '' })).toBe(false);
    });

    test('K7: params are added, set, renamed in place and removed; none without a popup view', () => {
        expect(applyEdit(PAD_SETUP, { part: 'param.add', name: 'padName', value: '{item.name}' })).toBe(PAD_SETUP);
        let setup = applyEdit(PAD_SETUP, { part: 'popupView.path', path: 'Popups/PadDetails' });
        expect(setup.popupView).toEqual({ path: 'Popups/PadDetails' });
        setup = applyEdit(setup, { part: 'param.add', name: 'padName', value: '' });
        setup = applyEdit(setup, { part: 'param.add', name: 'area', value: 'Mesa' });
        setup = applyEdit(setup, { part: 'param.value', name: 'padName', value: '{item.name}' });
        expect(setup.popupView).toEqual({ path: 'Popups/PadDetails', params: { padName: '{item.name}', area: 'Mesa' } });
        setup = applyEdit(setup, { part: 'param.name', name: 'padName', to: 'pad' });
        expect(Object.keys((setup.popupView as { params: object }).params)).toEqual(['pad', 'area']);
        setup = applyEdit(setup, { part: 'param.remove', name: 'pad' });
        setup = applyEdit(setup, { part: 'param.remove', name: 'area' });
        expect(setup.popupView).toEqual({ path: 'Popups/PadDetails' });
        expect(applyEdit(setup, { part: 'param.value', name: 'gone', value: 'x' })).toBe(setup);
    });

    test('an emptied Popup view path removes the view only when it has no params (owner, 2026-11-10)', () => {
        const bare = applyEdit(PAD_SETUP, { part: 'popupView.path', path: 'Popups/PadDetails' });
        expect('popupView' in applyEdit(bare, { part: 'popupView.path', path: '' })).toBe(false);
        expect(popupPathEdit('', 0)).toEqual({ part: 'popupView.path', path: '' });
        // With params the stored view stands: nothing is sent, and the field says to remove them first.
        const withParam = applyEdit(bare, { part: 'param.add', name: 'padName', value: '{item.name}' });
        expect(applyEdit(withParam, { part: 'popupView.path', path: '' })).toBe(withParam);
        expect(popupPathEdit('', 1)).toEqual({ problem: POPUP_VIEW_HAS_PARAMS });
        expect(POPUP_VIEW_HAS_PARAMS).toBe('Remove its params first. The popup view is kept.');
        // A new path is set either way, the params kept.
        expect(popupPathEdit('Popups/Other', 1)).toEqual({ part: 'popupView.path', path: 'Popups/Other' });
        expect(applyEdit(withParam, { part: 'popupView.path', path: 'Popups/Other' }).popupView)
            .toEqual({ path: 'Popups/Other', params: { padName: '{item.name}' } });
    });

    test('an edit that changes nothing gives the stored setup back', () => {
        expect(applyEdit(PAD_SETUP, { part: 'kpi', key: 'nope', patch: { path: 'x' } })).toBe(PAD_SETUP);
        expect(sameSetup(applyEdit(PAD_SETUP, { part: 'link', link: '/pad/{item.name}' }), PAD_SETUP)).toBe(true);
        expect(sameSetup(applyEdit(PAD_SETUP, { part: 'link', link: '/x' }), PAD_SETUP)).toBe(false);
    });

    test('K9: the batch is a create at version 0 when the kind has no setup, else an update at the stored version', () => {
        const setup = applyEdit(null, { part: 'link', link: '/meter/{item.name}' });
        expect(setupBatch('meter', 'b1', undefined, setup)).toEqual({ batchId: 'b1', ops: [
            { op: 'create', entity: 'kindSetup', id: 'meter', baseVersion: 0, data: { setup: { link: '/meter/{item.name}' } } }] });
        const stored: KindSetupRecord = { kindId: 'pad', setup: PAD_SETUP, version: 4, deleted: false };
        const update = setupBatch('pad', 'b2', stored, setup);
        expect(update.ops[0]).toMatchObject({ op: 'update', entity: 'kindSetup', id: 'pad', baseVersion: 4 });
        // A field typed before another editor's save goes at the version it was typed on; a deleted setup is restored at its tombstone's.
        expect(setupBatch('pad', 'b3', stored, setup, 3).ops[0].baseVersion).toBe(3);
        expect(setupBatch('pad', 'b4', undefined, setup, undefined, 6).ops[0]).toMatchObject({ op: 'create', baseVersion: 6 });
        expect(batchSetup(update, 'pad')).toBe(setup);
        expect(batchSetup(update, 'line')).toBeNull();
    });
});

describe('the key from the label (owner decision 1)', () => {
    test('letters and digits in lower case, a number on a clash, never empty, at most 64 characters', () => {
        expect(keyFromLabel('Gas price', [])).toBe('gasprice');
        expect(keyFromLabel('Tubing P. (psi) #2', [])).toBe('tubingppsi2');
        expect(keyFromLabel('Pressure', ['pressure'])).toBe('pressure2');
        expect(keyFromLabel('Pressure', ['pressure', 'pressure2'])).toBe('pressure3');
        expect(keyFromLabel(' - ', [])).toBe('value');
        expect(keyFromLabel('%', ['value'])).toBe('value2');
        expect(keyFromLabel('Débit', [])).toBe('débit');
        const long = 'a'.repeat(80);
        expect(keyFromLabel(long, [])).toHaveLength(MAX_KEY);
        const clash = keyFromLabel(long, ['a'.repeat(MAX_KEY)]);
        expect(clash).toHaveLength(MAX_KEY);
        expect(clash.endsWith('2')).toBe(true);
    });
});

describe('a refusal placed (K5, K6, owner decision c)', () => {
    const sent = {
        kpis: [{ key: 'pressure', path: '{asset.path}/Pressure' }, { key: 'gas', path: 'nope' }],
        popupView: { path: 'Popups/PadDetails', params: { mapItem: '{item.id}', padName: 'a {item.name}', 'odd: name': '{item.foo}' } }
    };

    test('K5: the link\'s words beside Link, without the op', () => {
        const place = refusalPlace('Op 0 (pad): link is a Perspective page path starting with one / (/pad/{item.name}), not //x.', sent);
        expect(place).toEqual({ at: Fields.link, words: 'link is a Perspective page path starting with one / (/pad/{item.name}), not //x.' });
        expect(refusalPlace('Op 0 (pad): link: {item.foo} is not a placeholder Map Studio knows; use {item.id}.', sent))
            .toEqual({ at: 'link', words: '{item.foo} is not a placeholder Map Studio knows; use {item.id}.' });
    });

    test('K6: a param is named by its name as sent, whatever it holds', () => {
        expect(refusalPlace('Op 0 (pad): popupView.params.mapItem: the popup view always receives the map item as mapItem, so no param may be named mapItem.', sent))
            .toEqual({ at: Fields.param('mapItem'), words: 'the popup view always receives the map item as mapItem, so no param may be named mapItem.' });
        expect(refusalPlace('Op 0 (pad): popupView.params.padName: a {item.name} mixes text and placeholders; a param is a literal.', sent))
            .toEqual({ at: 'popupView.params.padName', words: 'a {item.name} mixes text and placeholders; a param is a literal.' });
        expect(refusalPlace('Op 0 (pad): popupView.params.odd: name: {item.foo} is not a placeholder Map Studio knows.', sent).at)
            .toBe(Fields.param('odd: name'));
        expect(refusalPlace('Op 0 (pad): popupView.params.unknown: words', sent)).toEqual({ at: '', words: 'popupView.params.unknown: words' });
    });

    test('a key value is the row at that place as sent, found by its key', () => {
        expect(refusalPlace('Op 0 (pad): kpis[1].path: nope is not a tag path; use {asset.path}.', sent))
            .toEqual({ at: 'kpis.gas.path', words: 'nope is not a tag path; use {asset.path}.' });
        expect(refusalPlace('Op 0 (pad): kpis[0].key: pressure is used by another KPI; keys are unique.', sent).at).toBe('kpis.pressure');
        expect(refusalPlace('Op 0 (pad): kpis[1].label must be text.', sent)).toEqual({ at: 'kpis.gas.label', words: 'kpis[1].label must be text.' });
        expect(refusalPlace('Op 0 (pad): kpis[7].path: gone', sent).at).toBe('');
    });

    test('the paths, the style rule, and a message that names no field', () => {
        expect(refusalPlace('Op 0 (pad): comms.path: x is not a tag path.', sent)).toEqual({ at: 'comms.path', words: 'x is not a tag path.' });
        expect(refusalPlace('Op 0 (pad): alarms.path must be text, a tag path.', sent).at).toBe('alarms.path');
        expect(refusalPlace('Op 0 (pad): popupView.path must not be empty.', sent).at).toBe('popupView.path');
        expect(refusalPlace('Op 0 (pad): styleRule.source.kpi: gas is not the key of one of this setup\'s kpis.', sent).at).toBe(Fields.styleRule);
        // The Gateway writes some messages with no id after the op.
        expect(refusalPlace('Op 0: update is not supported in this version.', sent)).toEqual({ at: '', words: 'update is not supported in this version.' });
        expect(refusalPlace('Op 0: link: bad', sent)).toEqual({ at: 'link', words: 'bad' });
        expect(refusalPlace('Op 0 (pad): kpis has 5 values; at most 4 are shown.', sent)).toEqual({ at: '', words: 'kpis has 5 values; at most 4 are shown.' });
        expect(refusalPlace('The kind list is not available (empty): no kinds. Nothing was saved.', null))
            .toEqual({ at: '', words: 'The kind list is not available (empty): no kinds. Nothing was saved.' });
    });
});

describe('the list and the header (K1)', () => {
    const items = [
        item('1', 'P12', { assetId: 'P12' }), item('2', 'P2', { assetId: 'P14', overrides: { styleRule: { source: { path: 'x' } } } }),
        item('3', 'P4', { overrides: { comms: { path: 'y' }, kpis: [] } }), item('4', 'Gone', { deleted: true }),
        item('5', 'L1', { kind: 'line' })
    ];

    test('a kind\'s geometry in a word and its live items', () => {
        expect([PAD, LINE, FENCE].map(geometryWord)).toEqual(['Point', 'Line', 'Area']);
        expect(itemsOfKind(items, 'pad').map((i) => i.name)).toEqual(['P12', 'P2', 'P4']);
    });

    test('the overrides counted and named, one per item and part, the items by name', () => {
        expect(overridesText([])).toBe('No overrides');
        expect(overridesText([items[1]])).toBe('1 override (P2 style rule)');
        expect(overridesText(items.filter((i) => i.kind === 'pad'))).toBe('3 overrides (P2 style rule, P4 comms and 1 more)');
    });

    test('the subline: geometry, how many items, the overrides', () => {
        expect(headerSubline(PAD, [items[0], items[1], items[4]])).toBe('Point - applies to 2 items - 1 override (P2 style rule)');
        expect(headerSubline(LINE, items)).toBe('Line - applies to 1 item - no overrides');
    });

    test('names in order, digits by value', () => {
        expect(['P12', 'p2', 'P1', 'CTB1'].sort(compareNames)).toEqual(['CTB1', 'P1', 'p2', 'P12']);
    });

    test('the kind shown is the chosen one while the list has it, else the first', () => {
        expect(shownKind([PAD, LINE], 'line')).toBe(LINE);
        expect(shownKind([PAD, LINE], 'tank')).toBe(PAD);
        expect(shownKind([PAD, LINE], null)).toBe(PAD);
        expect(shownKind([], 'pad')).toBeNull();
    });
});

describe('the preview item (owner decision 5)', () => {
    const assets: Asset[] = [
        { id: 'P12', name: 'Pad 12', kind: 'pad', basePath: '[default]Mesa/P12' }, { id: 'P14', name: 'Pad 14', kind: 'pad', basePath: '[default]Mesa/P14' },
        { id: 'L3', name: 'Line 3', kind: 'line', basePath: '[default]Mesa/Lines/L3' }];
    const items = [item('a', 'Point 3', { assetId: 'P12' }), item('b', 'Point 2', { assetId: 'P14' }), item('c', 'Point 1'),
        item('d', 'Wrong', { assetId: 'L3' }), item('e', 'Lost', { assetId: 'P99' })];

    test('the kind\'s linked items by name; the first is the preview item until another is chosen', () => {
        const options = previewOptions(items, 'pad', assets);
        expect(options.map((o) => [o.name, o.assetId, o.folder])).toEqual([['Point 2', 'P14', '[default]Mesa/P14'], ['Point 3', 'P12', '[default]Mesa/P12']]);
        expect(previewOf(options, null)!.itemId).toBe('b');
        expect(previewOf(options, 'a')!.itemId).toBe('a');
        // One that left the list falls back to the first.
        expect(previewOf(options, 'gone')!.itemId).toBe('b');
        expect(previewOf([], 'a')).toBeNull();
    });

    test('with no linked item one note says so', () => {
        expect(previewOptions(items, 'line', assets)).toEqual([]);
        expect(noPreviewText(PAD)).toBe('No well pad is linked to an asset yet, so its tag paths cannot be checked.');
    });

    test('remembered per project and kind for the browser session; a store that refuses is ignored', () => {
        const held = new Map<string, string>();
        const store = { getItem: (k: string) => held.get(k) || null, setItem: (k: string, v: string) => { held.set(k, v); } };
        const key = previewKey('mapstudio-dev', 'pad');
        expect(key).toBe('mapstudio.kindpreview.v1:mapstudio-dev:pad');
        expect(readPreview(store, key)).toBeNull();
        writePreview(store, key, 'b');
        expect(readPreview(store, key)).toBe('b');
        expect(readPreview(store, previewKey('mapstudio-dev', 'line'))).toBeNull();
        const refusing = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); } };
        expect(readPreview(refusing, key)).toBeNull();
        expect(() => writePreview(refusing, key, 'b')).not.toThrow();
        expect(readPreview(null, key)).toBeNull();
        expect(() => writePreview(store, null, 'b')).not.toThrow();
    });
});

describe('the resolve notes (K8)', () => {
    test('N of M in the kind\'s words, the warning token when fewer than all', () => {
        expect(resolveNote('{asset.path}/Pressure', PAD, { state: 'resolved', n: 5, m: 5 }))
            .toEqual({ text: 'Resolves for 5 of 5 well pads', warning: false, state: 'resolved' });
        expect(resolveNote('{asset.path}/Pressure', PAD, { state: 'resolved', n: 3, m: 5 }))
            .toEqual({ text: 'Resolves for 3 of 5 well pads', warning: true, state: 'resolved' });
        expect(resolveNote('{asset.path}/Level', CTB, { state: 'resolved', n: 1, m: 1 })!.text).toBe('Resolves for 1 of 1 CTB batteries');
    });

    test('a full path is the same tag for every item, in the warning token, without asking', () => {
        expect(isFullPath('[default]Shared/GasPrice')).toBe(true);
        expect(isFullPath('{asset.path}/Pressure')).toBe(false);
        expect(resolveNote('[default]Shared/GasPrice', PAD, undefined)).toEqual({ text: 'Same tag for every well pad', warning: true, state: 'shared' });
        expect(resolveNote('{asset.path}/x', PAD, { state: 'shared' })!.text).toBe('Same tag for every well pad');
    });

    test('asking, a failed check in words, and nothing for no path or a path not asked', () => {
        expect(resolveNote('{asset.path}/Pressure', PAD, { state: 'asking' })).toEqual({ text: 'Checking...', warning: false, state: 'asking' });
        expect(resolveNote('{asset.path}/Pressure', PAD, { state: 'failed', message: 'The tag system did not answer within 5 s.' }))
            .toEqual({ text: 'Could not check this path: The tag system did not answer within 5 s.', warning: true, state: 'failed' });
        expect(resolveNote('', PAD, undefined)).toBeNull();
        expect(resolveNote('{asset.path}/Pressure', PAD, undefined)).toBeNull();
    });

    test('the paths asked are those below the asset, each once', () => {
        const view = readSetup({ ...PAD_SETUP, kpis: PAD_SETUP.kpis.concat([
            { key: 'gas', label: 'Gas', path: '[default]Shared/GasPrice', unit: '', on: true, icon: false },
            { key: 'again', label: 'Again', path: '{asset.path}/Flow', unit: '', on: true, icon: false }]) });
        expect(pathsToResolve(view)).toEqual(['{asset.path}/Comms', '{asset.path}', '{asset.path}/Pressure', '{asset.path}/Flow']);
        expect(pathsToResolve(readSetup(GEOFENCE_SETUP))).toEqual([]);
        expect(resolveKey('pad', 'P14', '{asset.path}/Flow')).not.toBe(resolveKey('pad', 'P12', '{asset.path}/Flow'));
    });
});

describe('the Style rule section, read only until 12b', () => {
    test('one line of what is stored', () => {
        expect(styleRuleLine(readSetup(PAD_SETUP))).toBe('States on {asset.path}/Status: 4 states');
        expect(styleRuleLine(readSetup(LINE_SETUP))).toBe('Bands on Flow: 3 bands');
        expect(styleRuleLine(readSetup(GEOFENCE_SETUP))).toBe('No style rule');
        expect(styleRuleLine(readSetup({ styleRule: { source: { instruments: 'worst' } } }))).toBe('From the instruments on the line: the worst of them');
        expect(styleRuleLine(readSetup({ styleRule: { type: 'expression', expression: 'x', source: { kpi: 'flow' } } }))).toBe('Expression on flow');
    });

    test('Remove is off for the key value the rule is built on (owner decision 2)', () => {
        expect(removeBlocked(readSetup(LINE_SETUP), 'flow')).toBe('Used by the style rule');
        expect(removeBlocked(readSetup(PAD_SETUP), 'pressure')).toBe('');
        expect(removeBlocked(readSetup(TAP_SETUP), 'other')).toBe('');
    });
});

describe('the placeholder picker and rows not sent', () => {
    test('the closed list with the kind\'s field keys', () => {
        expect(placeholderList(PAD)).toEqual(['{item.id}', '{item.name}', '{asset.id}', '{asset.path}', '{item.properties.operator}', '{item.properties.wells}']);
    });

    test('a placeholder goes in at the caret, over a selection, or at the end', () => {
        expect(insertAt('/pad/', '{item.name}', 5, 5)).toBe('/pad/{item.name}');
        expect(insertAt('/pad/x/detail', '{item.name}', 5, 6)).toBe('/pad/{item.name}/detail');
        expect(insertAt('/pad/', '{item.name}', null, null)).toBe('/pad/{item.name}');
        expect(insertAt('', '{item.name}', 9, 9)).toBe('{item.name}');
    });

    test('K3: a key value row without a label or a path says what is missing', () => {
        expect(rowMissing('', ' ')).toBe('Type a label and a tag path. This row is not saved yet.');
        expect(rowMissing('Gas', '')).toBe('Type a tag path. This row is not saved yet.');
        expect(rowMissing('', '{asset.path}/Gas')).toBe('Type a label. This row is not saved yet.');
        expect(rowMissing('Gas', '{asset.path}/Gas')).toBe('');
    });

    test('a new row whose save settled forgets the version it was typed on, so its next edit is typed on the stored one', () => {
        const rows = [{ key: 'gas', seen: 3 }, { key: 'level', seen: 3 }, { key: null as string | null, seen: 3 }];
        const fieldOf = (r: { key: string | null }): string | null => (r.key !== null ? Fields.kpi(r.key) : null);
        // The conflict of Gas price was answered: only that row starts again.
        expect(forgetSeen(rows, fieldOf, ['kpis.gas'])).toEqual([{ key: 'gas', seen: null }, { key: 'level', seen: 3 }, { key: null, seen: 3 }]);
        expect(forgetSeen(rows, fieldOf, [])).toBe(rows);
        expect(forgetSeen(rows, fieldOf, ['link'])).toBe(rows);
    });

    test('a param needs a name of its own', () => {
        expect(paramMissing(' ', [])).toBe('Type a name. This param is not saved yet.');
        expect(paramMissing('padName', ['padName'])).toBe('Another param has this name. This param is not saved yet.');
        expect(paramMissing('padName', ['area'])).toBe('');
    });
});

describe('a setup save in the queue (K11): paused fields, and a conflict card with one choice', () => {
    const batch: EditBatch = setupBatch('pad', 'batch-setup', { kindId: 'pad', setup: PAD_SETUP, version: 3, deleted: false },
        applyEdit(PAD_SETUP, { part: 'link', link: '/mine' }), 3);
    const theirs: KindSetupRecord = { kindId: 'pad', setup: { ...PAD_SETUP, link: '/theirs' }, version: 4, deleted: false };
    const conflict: Conflict = { index: 0, entity: 'kindSetup', id: 'pad', baseVersion: 3, current: theirs, changedBy: 'mapeditor2',
        changedAt: new Date(2026, 10, 9, 10, 42, 0).toISOString() };
    const refused: UnsavedEntry = { batchId: batch.batchId, batch, queuedAt: '2026-11-09T10:40:00Z', state: 'refused',
        reason: { code: 'conflict', message: 'The Well pad kind setup was changed by mapeditor2.', changedBy: 'mapeditor2' }, conflict: [conflict] };

    test('the card names the other editor and the kind, keeps my change in words, and offers only their version', () => {
        expect(isSetupSave(refused)).toBe(true);
        expect(onTopBatch(refused, 'new')).toBeNull();
        const card = saveCardFor({ unsaved: [refused], paused: false, dismissed: [], records: [], kinds: [PAD], locale: '' });
        expect(card).toMatchObject({
            kind: 'conflict', batchId: 'batch-setup', who: 'mapeditor2', onTop: false, blocked: '',
            title: "Not saved - conflict with mapeditor2's change",
            text: 'mapeditor2 changed the Well pad kind setup at 10:42, while you were editing it.',
            kept: 'Your change, kept here and not saved: a change to the Well pad kind setup.'
        });
    });

    test('the kind\'s fields are paused with entry 10\'s words while its save waits', () => {
        expect(waitingSave([refused], 'pad')).toBe(refused);
        expect(waitingSave([refused], 'line')).toBeNull();
        expect(pausedText(false, refused)).toBe("Not saved - conflict with mapeditor2's change");
        const busy: UnsavedEntry = { ...refused, state: 'unsent', conflict: undefined,
            reason: { code: 'store-unreachable', message: 'Map Studio is busy with other map requests; nothing was saved. Try again in a moment.' } };
        expect(pausedText(false, busy)).toBe('Not saved - Map Studio is busy');
        expect(pausedText(false, { ...busy, reason: { code: 'timeout', message: 'No answer.' } })).toBe('Not saved - store unreachable');
        expect(pausedText(false, { ...busy, reason: { code: 'read-only', message: 'A standby Gateway.' } })).toBe('Not saved - the map store is read only');
        expect(pausedText(true, null)).toBe('Paused - the map store is unreachable');
        // A save on its way for the first time pauses nothing.
        const first: UnsavedEntry = { batchId: batch.batchId, batch, queuedAt: '', state: 'unsent' };
        expect(waitingSave([first], 'pad')).toBeNull();
        expect(pausedText(false, null)).toBe('');
    });

    test('with a refusal standing beside a field nothing says Saved (the acceptance criterion)', () => {
        const facts = { connection: CONNECTED, load: { state: 'loaded' as const, message: '' }, store: STORE_UNKNOWN, level: 'full' as const,
            save: SAVE_IDLE, unsaved: [], sending: [], storageWarning: '' };
        expect(headerSaveWords(facts)).toBe('Saved');
        expect(headerSaveWords({ ...facts, kindRefused: true })).toBe('Not saved');
    });
});
