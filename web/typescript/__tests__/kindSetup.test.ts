// A kind's setup as the Kinds screen reads and saves it (epic 4 entry 12a; kindSetup.ts). First the hazard: every save replaces the
// whole setup, so each part edited in turn on each of the five seed setups must leave every other part stored unchanged, values
// this screen does not draw included (K10). Then the matrix's logic: the edits (K2 to K4, K7, K9), the key from the label, a
// refusal's words placed by the order the rows were sent in (K5, K6), the header's words (K1), the resolve notes (K8), and the
// conflict card of a setup, which offers one choice (K11).
import { Asset, Kind } from '../adapters';
import { Conflict, EditBatch, KindSetupRecord, MapItemRecord } from '../contract';
import {
    Fields, MAX_KEY, NO_RULE, POPUP_VIEW_HAS_PARAMS, RuleDraft, RuleSource, SetupEdit, applyEdit, checkRule, checkTints, draftSource, expressionPresets, fixedCategories, foldRule,
    forgetSeen, hasOwnRule, inStepVersion, liveNowText, popupPathEdit, previewLine, showOnMapOff, storedRuleOf, batchSetup, compareNames, geometryWord, headerSubline, insertAt,
    isFullPath, itemsOfKind, keyFromLabel, LiveNowFacts,
    noPreviewText, overridesText, paramMissing, pathsToResolve, pausedText, placeholderList, presetsFor, previewKey, previewOf, previewOptions, readPreview,
    readSetup, refusalPlace, removeBlocked, resolveKey, resolveNote, rowMissing, ruleDraft, ruleKpi, ruleTypes, sameRule, sameSetup, sameTints, setupBatch,
    shownKind, sourceName, tintRows, tintsDraft, typedNumber, typedValue, unsavedText, valueText, waitingSave, withSource, writePreview
} from '../kindSetup';
import { KeyValueStore, UnsavedEntry, UnsavedQueue, isSetupSave, onTopBatch, readEntries, saveCardFor, storageKey } from '../unsaved';
import { headerSaveWords } from '../problems';
import { ItemState } from '../live';
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
        { edit: { part: 'kpi.add', row: { key: 'gas', label: 'Gas price', path: '[default]Shared/GasPrice', unit: '' } }, touches: ['kpis'] },
        // Entry 12b1 (S10): the rule and the tints, each replaced whole and removed.
        { edit: { part: 'styleRule', rule: { source: { path: '{asset.path}/Status' }, type: 'states', cases: [{ value: 1, preset: 'fault' }] } }, touches: ['styleRule'] },
        { edit: { part: 'styleRule', rule: { source: { instruments: 'worst' } } }, touches: ['styleRule'] },
        { edit: { part: 'styleRule', rule: { type: 'expression', expression: "if({value} > 600, 'warning', 'normal')" } }, touches: ['styleRule'] },
        { edit: { part: 'styleRule', rule: null }, touches: ['styleRule'] },
        { edit: { part: 'areaTints', tints: { property: 'operator', tints: [{ category: 'East', tint: 'tint-2' }] } }, touches: ['areaTints'] },
        { edit: { part: 'areaTints', tints: null }, touches: ['areaTints'] }
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
        expect(readSetup(null)).toEqual({ comms: null, kpis: [], alarms: null, link: '', popupView: null, styleRule: null, areaTints: null });
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
        expect(refusalPlace('Op 0 (pad): styleRule.source.kpi: gas is not the key of one of this setup\'s kpis.', sent))
            .toEqual({ at: Fields.ruleSource, words: 'gas is not the key of one of this setup\'s kpis.' });
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
        item('1', 'P12', { assetId: 'P12' }), item('2', 'P2', { assetId: 'P14', overrides: { styleRule: { source: { path: '[default]x' } } } }),
        item('3', 'P4', { overrides: { comms: { path: '[default]y' }, kpis: [{ key: 'pressure', path: '[default]z' }] } }), item('4', 'Gone', { deleted: true }),
        item('5', 'L1', { kind: 'line' })
    ];

    test('a kind\'s geometry in a word and its live items', () => {
        expect([PAD, LINE, FENCE].map(geometryWord)).toEqual(['Point', 'Line', 'Area']);
        expect(itemsOfKind(items, 'pad').map((i) => i.name)).toEqual(['P12', 'P2', 'P4']);
    });

    test('the overrides counted and named, one per item and part, the items by name', () => {
        expect(overridesText([])).toBe('No overrides');
        expect(overridesText([items[1]])).toBe('1 override (P2 style rule)');
        expect(overridesText(items.filter((i) => i.kind === 'pad'), ['pressure'])).toBe('3 overrides (P2 style rule, P4 comms and 1 more)');
    });

    test('entry 12c1: only what the Gateway applies is counted (owner decision 5)', () => {
        // A key the kind does not have, a link, a popup view, tints and a path that is not full are stored and not counted.
        expect(overridesText(items.filter((i) => i.kind === 'pad'), [])).toBe('2 overrides (P2 style rule, P4 comms)');
        const ignored = item('6', 'P6', { overrides: { link: '/x', popupView: { path: 'A/B' }, areaTints: { property: 'p', tints: [] },
            comms: { path: '{asset.path}/Comms' }, kpis: [{ key: 'gone', path: '[default]a' }, { key: 'pressure', path: 'Mesa/x' }] } });
        expect(overridesText([ignored], ['pressure'])).toBe('No overrides');
        expect(overridesText([item('7', 'P7', { overrides: { alarms: { path: '[default]Mesa/P7' }, kpis: [{ key: 'pressure', path: '[default]a' }] } })],
            ['pressure'])).toBe('2 overrides (P7 key values, P7 alarms)');
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

describe('the Live now note and the preview item\'s words (12b2)', () => {
    const NORMAL: ItemState = { commsLost: false, stale: false, alarm: null, iconKpi: null, badge: 'normal', preset: 'normal' };
    const facts = (over: Partial<LiveNowFacts> = {}): LiveNowFacts => ({ kind: PAD, name: 'P12', state: NORMAL, ownRule: false, stored: 'rule', unsaved: false, ...over });

    test('P1, P3: what the preview item is now, by the state the Gateway sent', () => {
        expect(liveNowText(facts())).toBe('Live now: P12 is Normal.');
        expect(liveNowText(facts({ state: { ...NORMAL, preset: 'warning' } }))).toBe('Live now: P12 is Warning.');
        expect(liveNowText(facts({ state: { ...NORMAL, preset: 'dimmed' } }))).toBe('Live now: P12 is Out of service.');
        // A state with no preset slot reads as Normal; a line's pattern by its name.
        expect(liveNowText(facts({ state: { ...NORMAL, preset: undefined } }))).toBe('Live now: P12 is Normal.');
        expect(liveNowText(facts({ kind: LINE, name: 'L-1', state: { ...NORMAL, preset: 'dashed' } }))).toBe('Live now: L-1 is Dashed.');
    });

    test('P4: an active alarm wins over the rule, and the note says so with its priority', () => {
        const alarm = { priority: 2 as const, unacked: true, active: 1, stale: false };
        expect(liveNowText(facts({ state: { ...NORMAL, preset: 'fault', alarm, badge: 'alarm' } })))
            .toBe('Live now: P12 is Fault, but its priority 2 alarm wins over the rule.');
    });

    test('P5: Comms lost and Stale show only as that until a fresh value comes', () => {
        expect(liveNowText(facts({ state: { ...NORMAL, commsLost: true, stale: true, badge: 'comms-lost' } })))
            .toBe('Live now: P12 shows only as Comms lost until a fresh value comes.');
        expect(liveNowText(facts({ state: { ...NORMAL, stale: true, badge: 'stale' } }))).toBe('Live now: P12 shows only as Stale until a fresh value comes.');
    });

    test('no rule, the instruments source, and no values yet', () => {
        expect(liveNowText(facts({ stored: 'none' }))).toBe('Live now: P12 draws as Normal. This kind has no style rule.');
        expect(liveNowText(facts({ kind: LINE, name: 'L-1', stored: 'instruments' })))
            .toBe('Live now: each segment of L-1 takes the worst of the instruments at its ends.');
        expect(liveNowText(facts({ state: null }))).toBe('Live now: no live values for P12 yet.');
        // A kind that shows nothing live never has a live row: with no rule its item draws as Normal all the same.
        expect(liveNowText(facts({ state: null, stored: 'none' }))).toBe('Live now: P12 draws as Normal. This kind has no style rule.');
        // With no rule an active alarm still shows on the map, and the note says so.
        expect(liveNowText(facts({ stored: 'none', state: { ...NORMAL, alarm: { priority: 1, unacked: true, active: 1, stale: false }, badge: 'alarm' } })))
            .toBe('Live now: P12 draws as Normal, but its priority 1 alarm shows over it. This kind has no style rule.');
    });

    test('P11: "Not saved yet": the map shows the stored rule until this one is whole', () => {
        expect(liveNowText(facts({ unsaved: true, state: { ...NORMAL, preset: 'attention' } })))
            .toBe('Live now: P12 is Attention. The map shows the stored rule until this one is whole.');
        expect(liveNowText(facts({ unsaved: true, stored: 'none' })))
            .toBe('Live now: P12 draws as Normal. The map draws no rule until this one is whole.');
        expect(liveNowText(facts({ unsaved: true }))).not.toContain('Not saved yet');
    });

    test('P6: a preview item with its own rule is not drawn by the kind\'s; P7: an area draws its tint; and a kind with no item', () => {
        expect(liveNowText(facts({ name: 'Point 2', ownRule: true, state: { ...NORMAL, preset: 'warning' } })))
            .toBe('Point 2 has its own style rule, so this kind\'s rule does not draw on it. Choose another preview item.');
        expect(liveNowText(facts({ kind: FENCE, name: 'P14 lease' }))).toBe('An area draws its category tint, not a preset, so the style rule has no preview on the map.');
        expect(liveNowText(facts({ kind: FENCE, name: null, state: null }))).toContain('An area draws its category tint');
        expect(liveNowText(facts({ name: null, state: null }))).toBe('No well pad is linked to an asset yet, so this kind has no item to show the rule on.');
    });

    test('an item\'s own rule and the kind\'s stored rule as the note reads them', () => {
        expect(hasOwnRule(item('a', 'P2', { overrides: { styleRule: { source: { path: '[default]x' } } } }))).toBe(true);
        expect(hasOwnRule(item('a', 'P2', { overrides: { styleRule: { source: { kpi: 'pressure' }, type: 'states', cases: [] } } }))).toBe(true);
        // A rule whose path is not full is ignored by the Gateway: the kind's rule draws on the item.
        expect(hasOwnRule(item('a', 'P2', { overrides: { styleRule: { source: { path: '{asset.path}/x' } } } }))).toBe(false);
        expect(hasOwnRule(item('a', 'P2', { overrides: { label: 'x' } }))).toBe(false);
        expect(hasOwnRule(item('a', 'P2'))).toBe(false);
        expect(hasOwnRule(undefined)).toBe(false);
        expect(storedRuleOf(null)).toBe('none');
        expect(storedRuleOf({ source: { instruments: 'worst' } })).toBe('instruments');
        expect(storedRuleOf(PAD_SETUP.styleRule)).toBe('rule');
    });

    test('the line under the select says both things the preview item does; Show on map is off with its reason with none', () => {
        expect(previewLine(PAD)).toBe(' - each tag path is checked for this item\'s asset, and it carries the word Preview on the map.');
        expect(previewLine(FENCE)).toBe(' - each tag path is checked for this item\'s asset.');
        expect(showOnMapOff(PAD, true)).toBe('');
        expect(showOnMapOff(PAD, false)).toBe('No well pad is linked to an asset yet, so there is no preview item to show.');
    });

    test('no em dash in any of the words', () => {
        const all = [facts(), facts({ ownRule: true }), facts({ kind: FENCE }), facts({ name: null }), facts({ unsaved: true }), facts({ stored: 'none' })]
            .map(liveNowText).join(' ') + previewLine(PAD) + showOnMapOff(PAD, false);
        expect(all).not.toContain(String.fromCharCode(0x2014));
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
        // The tag path the style rule reads is asked too (entry 12b1), last.
        expect(pathsToResolve(view)).toEqual(['{asset.path}/Comms', '{asset.path}', '{asset.path}/Pressure', '{asset.path}/Flow', '{asset.path}/Status']);
        expect(pathsToResolve(readSetup(LINE_SETUP))).toEqual(['{asset.path}/Flow']);
        expect(pathsToResolve(readSetup(GEOFENCE_SETUP))).toEqual([]);
        expect(resolveKey('pad', 'P14', '{asset.path}/Flow')).not.toBe(resolveKey('pad', 'P12', '{asset.path}/Flow'));
    });
});

describe('the key value a style rule is built on', () => {
    test('Remove is off for the key value the rule is built on (owner decision 2)', () => {
        expect(removeBlocked(readSetup(LINE_SETUP), 'flow')).toBe('Used by the style rule');
        expect(removeBlocked(readSetup(PAD_SETUP), 'pressure')).toBe('');
        expect(removeBlocked(readSetup(TAP_SETUP), 'other')).toBe('');
    });
});

// Entry 12b1: section 6's editor. The plan's matrix rows S1 to S10 as logic; the screen itself is e2e/tests/kindstyle.spec.mjs.
describe('the Style rule editor (12b1)', () => {
    /** A draft whose every type reads `source` (as a stored rule's value is offered to each type). */
    const draft = (over: Partial<RuleDraft> & { source?: RuleSource }): RuleDraft => {
        const { source, ...rest } = over;
        return { ...NO_RULE, ...(source ? { sources: { states: source, bands: source, expression: source } } : {}), ...rest };
    };

    test('the types and presets of a kind: From its instruments only for a line that is not an area; line presets only for a line kind', () => {
        expect(ruleTypes(PAD)).toEqual(['none', 'states', 'bands', 'expression']);
        expect(ruleTypes(LINE)).toEqual(['none', 'states', 'bands', 'expression', 'instruments']);
        expect(ruleTypes(FENCE)).toEqual(['none', 'states', 'bands', 'expression']);
        expect(presetsFor(PAD)).toEqual(['normal', 'attention', 'warning', 'fault', 'dimmed']);
        expect(presetsFor(LINE)).toEqual(['normal', 'attention', 'warning', 'fault', 'dimmed', 'solid', 'dashed', 'dotted']);
        expect(presetsFor(FENCE)).toHaveLength(8);
    });

    test('every seed rule reads into a draft and back to the same rule, so an untouched rule is never sent', () => {
        for (const [kindId, seed] of SEEDS) {
            const kind = kindId === 'line' ? LINE : kindId === 'geofence' ? FENCE : PAD;
            const stored = (seed as Record<string, unknown>).styleRule as Record<string, unknown> | undefined;
            const check = checkRule(ruleDraft(stored), kind);
            expect(check.missing).toEqual([]);
            expect(check.rule).toEqual(stored === undefined ? null : stored);
            expect(sameRule(ruleDraft(stored), stored, kind)).toBe(true);
        }
        // The key order of a stored rule is not a difference.
        expect(sameRule(ruleDraft(LINE_SETUP.styleRule), { cases: LINE_SETUP.styleRule.cases, type: 'bands', source: { kpi: 'flow' } }, LINE)).toBe(true);
        expect(ruleDraft({ source: { instruments: 'worst' } }).type).toBe('instruments');
        expect(ruleDraft({ type: 'later' })).toEqual(NO_RULE);
    });

    test('S1: a Bands rule on Pressure is whole only with its value, a band and every preset; then it is the rule the Gateway takes', () => {
        const start = draft({ type: 'bands' });
        expect(checkRule(start, PAD)).toEqual({ missing: ['Pick the value the rule reads.', 'Add a band.'], rows: [] });
        const half = draft({ type: 'bands', source: { from: 'kpi', key: 'pressure' }, bands: [{ from: '', to: '900', preset: 'normal' }, { from: '900', to: '', preset: '' }] });
        expect(checkRule(half, PAD)).toEqual({ missing: ['Band 2 has no preset.'], rows: [1] });
        expect(unsavedText(checkRule(half, PAD).missing)).toBe('Not saved yet. Band 2 has no preset.');
        const whole = { ...half, bands: [half.bands[0], { ...half.bands[1], preset: 'warning' }] };
        expect(checkRule(whole, PAD)).toEqual({ missing: [], rows: [], rule: { source: { kpi: 'pressure' }, type: 'bands',
            cases: [{ min: null, max: 900, preset: 'normal' }, { min: 900, max: null, preset: 'warning' }] } });
        expect(unsavedText([])).toBe('');
        expect(sameRule(whole, PAD_SETUP.styleRule, PAD)).toBe(false);
    });

    test('S2: States on a typed tag path; a value is read as typed, and a value has one case', () => {
        const rows = [1, 2, 3, 4].map((n) => ({ value: String(n), preset: ['attention', 'warning', 'fault', 'dimmed'][n - 1] }));
        const states = draft({ type: 'states', source: { from: 'path', path: ' {asset.path}/Status ' }, states: rows });
        expect(checkRule(states, PAD).rule).toEqual(PAD_SETUP.styleRule);
        const twice = { ...states, states: rows.concat([{ value: ' 2.0 ', preset: 'normal' }]) };
        expect(checkRule(twice, PAD)).toEqual({ missing: ['Case 5 has the same value as case 2 (2): each value has one case.'], rows: [4] });
        // 1 and "1" are distinct cases (StyleRule.java): the quoted one is text.
        const distinct = { ...states, states: [{ value: '1', preset: 'normal' }, { value: '"1"', preset: 'fault' }, { value: 'true', preset: 'dimmed' },
            { value: 'Open', preset: 'attention' }] };
        expect((checkRule(distinct, PAD).rule as { cases: unknown[] }).cases)
            .toEqual([{ value: 1, preset: 'normal' }, { value: '1', preset: 'fault' }, { value: true, preset: 'dimmed' }, { value: 'Open', preset: 'attention' }]);
        expect(checkRule({ ...withSource(states, { from: 'path', path: ' ' }), states: [{ value: '', preset: '' }] }, PAD).missing)
            .toEqual(['Type the tag path the rule reads.', 'Case 1 has no value.', 'Case 1 has no preset.']);
    });

    test('values and numbers from typed text, and a stored value back as it is typed', () => {
        expect([typedValue('1'), typedValue(' -2.50 '), typedValue('1e3'), typedValue('.5')]).toEqual([1, -2.5, 1000, 0.5]);
        expect([typedValue('true'), typedValue('false'), typedValue('True'), typedValue('Open'), typedValue('1 2')]).toEqual([true, false, 'True', 'Open', '1 2']);
        expect([typedValue('"1"'), typedValue('""'), typedValue('"'), typedValue('  ')]).toEqual(['1', '', '"', undefined]);
        expect([valueText(1), valueText(true), valueText('Open'), valueText('1'), valueText('true'), valueText(''), valueText(null)])
            .toEqual(['1', 'true', 'Open', '"1"', '"true"', '""', '']);
        for (const value of [1, 2.5, false, 'Open', '1', 'true', '', ' padded ', '"quoted"']) {
            expect(typedValue(valueText(value))).toBe(value);
        }
        expect(typedNumber('600')).toBe(600);
        expect([typedNumber('6oo'), typedNumber(''), typedNumber('0x10'), typedNumber('Infinity'), typedNumber('1e999')].every(isNaN)).toBe(true);
    });

    test('S3: a half-built band says why and gives no rule: from not below to, an overlap, an open end in the middle, text for a number', () => {
        const on: RuleSource = { from: 'kpi', key: 'pressure' };
        const bands = (rows: Array<[string, string, string]>): RuleDraft =>
            draft({ type: 'bands', source: on, bands: rows.map(([from, to, preset]) => ({ from, to, preset })) });
        expect(checkRule(bands([['900', '600', '']]), PAD))
            .toEqual({ missing: ['Band 1: its from (900) is not below its to (600).', 'Band 1 has no preset.'], rows: [0] });
        expect(checkRule(bands([['', '900', 'normal'], ['600', '', 'fault']]), PAD).missing)
            .toEqual(['Band 2 starts at 600, below the end of the band before (900): bands are in order and do not overlap.']);
        expect(checkRule(bands([['', '50', 'normal'], ['', '200', 'attention'], ['200', '', 'fault']]), PAD).missing)
            .toEqual(['Band 2 needs a from: only the first band is open below.']);
        expect(checkRule(bands([['0', '', 'normal'], ['50', '200', 'attention']]), PAD).missing)
            .toEqual(['Band 1 needs a to: only the last band is open above.']);
        expect(checkRule(bands([['low', '5', 'normal']]), PAD).missing).toEqual(['Band 1: its from "low" is not a number.']);
        expect(checkRule(bands([['5', '5', 'normal']]), PAD).rule).toBeUndefined();
        // Bands that touch do not overlap; a gap is allowed.
        expect(checkRule(bands([['', '50', 'normal'], ['50', '200', 'attention'], ['300', '', 'fault']]), PAD).missing).toEqual([]);
        expect(checkRule(bands([['1', '2', 'dashed']]), PAD).missing).toEqual(['Band 1: dashed is not a preset of this kind.']);
        expect(checkRule(bands([['1', '2', 'dashed']]), LINE).missing).toEqual([]);
    });

    test('S4: an expression needs its text; its value is optional; the tiles are the presets its text names', () => {
        const text = "if({value} > 600, 'warning', 'normal')";
        expect(checkRule(draft({ type: 'expression' }), PAD)).toEqual({ missing: ['Type the expression.'], rows: [] });
        expect(checkRule(draft({ type: 'expression', expression: ' ' + text + ' ' }), PAD).rule).toEqual({ type: 'expression', expression: text });
        expect(checkRule(draft({ type: 'expression', expression: 'if(', source: { from: 'kpi', key: 'pressure' } }), PAD).rule)
            .toEqual({ source: { kpi: 'pressure' }, type: 'expression', expression: 'if(' });
        expect(expressionPresets(text, PAD)).toEqual(['warning', 'normal']);
        expect(expressionPresets('case({value}, 1, "dashed", 2, \'fault\', \'fault\', \'other\')', PAD)).toEqual(['fault']);
        expect(expressionPresets('case({value}, 1, "dashed", 2, \'fault\')', LINE)).toEqual(['dashed', 'fault']);
    });

    test('S5, S6: From its instruments is the instruments source and nothing else; None removes the rule', () => {
        expect(checkRule(draft({ type: 'instruments', bands: [{ from: '1', to: '', preset: '' }] }), LINE))
            .toEqual({ missing: [], rows: [], rule: { source: { instruments: 'worst' } } });
        expect(checkRule(draft({ type: 'instruments' }), PAD).rule).toBeUndefined();
        expect(checkRule(draft({ type: 'instruments' }), FENCE).rule).toBeUndefined();
        expect(checkRule(draft({ type: 'none', states: [{ value: '', preset: '' }] }), PAD)).toEqual({ missing: [], rows: [], rule: null });
        const removed = applyEdit(LINE_SETUP, { part: 'styleRule', rule: null });
        expect(removed).toEqual({ kpis: LINE_SETUP.kpis });
        // "Used by style rule" goes with the rule.
        expect(ruleKpi(readSetup(LINE_SETUP))).toBe('flow');
        expect(ruleKpi(readSetup(removed))).toBeNull();
        expect(removeBlocked(readSetup(removed), 'flow')).toBe('');
    });

    test('S7: a type switched away from and back has its cases again; the stored rule folds in without losing the others', () => {
        const bands = ruleDraft(LINE_SETUP.styleRule);
        const states = { ...bands, type: 'states' as const };
        expect(checkRule(states, LINE).missing).toEqual(['Add a case.']);
        const back = { ...states, type: 'bands' as const };
        expect(back.bands).toHaveLength(3);
        expect(sameRule(back, LINE_SETUP.styleRule, LINE)).toBe(true);
        // Another editor saved a States rule while my typed bands are remembered.
        const typed = { ...bands, bands: bands.bands.concat([{ from: '900', to: '', preset: 'fault' }]) };
        const theirs = ruleDraft(PAD_SETUP.styleRule);
        const folded = foldRule(typed, theirs);
        expect(folded.type).toBe('states');
        expect(draftSource(folded)).toEqual({ from: 'path', path: '{asset.path}/Status' });
        expect(folded.states).toHaveLength(4);
        expect(folded.bands).toBe(typed.bands);
        expect(folded.sources.bands).toEqual({ from: 'kpi', key: 'flow' });
        // None stored: the values picked are kept for the next rule.
        expect(foldRule(typed, NO_RULE)).toEqual({ ...typed, type: 'none' });
        expect(draftSource(foldRule(typed, NO_RULE))).toEqual({ from: '' });
        // A value picked for one type never changes another's: States on the stored path, Bands on Pressure, States back as stored.
        const pad = ruleDraft(PAD_SETUP.styleRule);
        const asBands = withSource({ ...pad, type: 'bands' as const }, { from: 'kpi', key: 'pressure' });
        expect(draftSource(asBands)).toEqual({ from: 'kpi', key: 'pressure' });
        expect(sameRule({ ...asBands, type: 'states' }, PAD_SETUP.styleRule, PAD)).toBe(true);
        expect(withSource(NO_RULE, { from: 'kpi', key: 'pressure' })).toBe(NO_RULE);
    });

    test('S8: a refused case is the row at that place as sent; the source and the expression each have their place', () => {
        const sent = { styleRule: { source: { path: 'nope' }, type: 'states', cases: [{ value: 1, preset: 'normal' }, { value: 2, preset: 'red' }] } };
        expect(refusalPlace('Op 0 (pad): styleRule.cases[1].preset: "red" is not a preset. Pick a preset: normal, attention, warning, fault, dimmed; colour codes are not accepted.', sent))
            .toEqual({ at: Fields.ruleCase(1), words: '"red" is not a preset. Pick a preset: normal, attention, warning, fault, dimmed; colour codes are not accepted.' });
        expect(Fields.ruleCase(1)).toBe('styleRule.cases.1');
        expect(refusalPlace('Op 0 (pad): styleRule.cases[0]: min must be below max.', sent)).toEqual({ at: 'styleRule.cases.0', words: 'min must be below max.' });
        expect(refusalPlace('Op 0 (pad): styleRule.cases[0].value must be text, a number, or true or false.', sent))
            .toEqual({ at: 'styleRule.cases.0', words: 'styleRule.cases[0].value must be text, a number, or true or false.' });
        expect(refusalPlace('Op 0 (pad): styleRule.source.path: nope is not a tag path.', sent)).toEqual({ at: Fields.ruleSource, words: 'nope is not a tag path.' });
        expect(refusalPlace('Op 0 (pad): styleRule.source: a states rule needs a source, {path} or {kpi}.', sent))
            .toEqual({ at: 'styleRule.source', words: 'a states rule needs a source, {path} or {kpi}.' });
        expect(refusalPlace('Op 0 (pad): styleRule.expression: the expression could not be read: unexpected end.', sent))
            .toEqual({ at: Fields.ruleExpression, words: 'the expression could not be read: unexpected end.' });
        expect(refusalPlace('Op 0 (pad): styleRule: an expression rule has no cases.', sent)).toEqual({ at: Fields.styleRule, words: 'an expression rule has no cases.' });
        expect(refusalPlace('Op 0 (pad): styleRule.type must be states, bands, expression.', sent))
            .toEqual({ at: 'styleRule', words: 'styleRule.type must be states, bands, expression.' });
    });

    test('the version a draft is in step with the store at: every send goes at it, so another editor\'s save since is a conflict', () => {
        const free = { held: false, same: false, settled: false };
        // Made from the stored rule at 5 and changed: another editor's save (6) does not move it while the draft differs.
        expect(inStepVersion(5, 6, free)).toBe(5);
        // The store holds what the draft says (its fold, or nothing changed): in step at the stored version.
        expect(inStepVersion(5, 6, { ...free, same: true })).toBe(6);
        // Its own save settled, the draft typed on since: in step at the version that save gave.
        expect(inStepVersion(5, 6, { ...free, settled: true })).toBe(6);
        // A save of it on its way or refused: nothing moves until it settles.
        expect(inStepVersion(5, 6, { held: true, same: true, settled: true })).toBe(5);
    });

    test('the value named in a States row', () => {
        const kpis = readSetup(PAD_SETUP).kpis;
        expect(sourceName({ from: 'kpi', key: 'pressure' }, kpis)).toBe('Pressure');
        expect(sourceName({ from: 'kpi', key: 'gone' }, kpis)).toBe('gone');
        expect(sourceName({ from: 'path', path: '{asset.path}/Status' }, kpis)).toBe('the value');
        expect(sourceName({ from: '' }, kpis)).toBe('the value');
    });
});

describe('an area kind\'s tints (12b1, S9)', () => {
    const CHOICE: Kind = { ...FENCE, fields: [
        { key: 'operator', label: 'Operator', type: 'choice', required: false, choices: ['North', 'South', 'West'] },
        { key: 'note', label: 'Note', type: 'text', required: false, choices: [] }] };
    const stored = readSetup(GEOFENCE_SETUP).areaTints;

    test('the stored tints are read; a choice field\'s rows are its choices, a stored category that is no choice kept', () => {
        expect(stored).toEqual(GEOFENCE_SETUP.areaTints);
        expect(readSetup(PAD_SETUP).areaTints).toBeNull();
        expect(fixedCategories(CHOICE, 'operator')).toBe(true);
        expect(fixedCategories(CHOICE, 'note')).toBe(false);
        expect(tintsDraft(stored, CHOICE)).toEqual({ property: 'operator',
            rows: [{ category: 'North', tint: 'tint-1' }, { category: 'South', tint: 'tint-4' }, { category: 'West', tint: '' }] });
        expect(tintRows(CHOICE, 'operator', [{ category: 'Old', tint: 'tint-2' }]).map((r) => r.category)).toEqual(['North', 'South', 'West', 'Old']);
        expect(tintsDraft(stored, FENCE).rows).toEqual(GEOFENCE_SETUP.areaTints.tints);
        expect(tintsDraft(null, CHOICE)).toEqual({ property: '', rows: [] });
    });

    test('a choice field: the rows with a tint are saved, one at least; the seed tints are not sent again', () => {
        const draft = tintsDraft(stored, CHOICE);
        expect(checkTints(draft, CHOICE)).toEqual({ missing: [], rows: [], tints: GEOFENCE_SETUP.areaTints });
        expect(sameTints(draft, stored, CHOICE)).toBe(true);
        const west = { ...draft, rows: draft.rows.map((r) => (r.category === 'West' ? { ...r, tint: 'tint-6' } : r)) };
        expect(sameTints(west, stored, CHOICE)).toBe(false);
        expect((checkTints(west, CHOICE).tints as { tints: unknown[] }).tints).toHaveLength(3);
        // A choice field's rows are sent exactly as the field has them, never trimmed.
        const spaced: Kind = { ...FENCE, fields: [{ key: 'operator', label: 'Operator', type: 'choice', required: false, choices: [' North ', 'North'] }] };
        expect(checkTints({ property: 'operator', rows: [{ category: ' North ', tint: 'tint-1' }, { category: 'North', tint: 'tint-2' }] }, spaced).tints)
            .toEqual({ property: 'operator', tints: [{ category: ' North ', tint: 'tint-1' }, { category: 'North', tint: 'tint-2' }] });
        const none = { property: 'operator', rows: tintRows(CHOICE, 'operator', []) };
        expect(checkTints(none, CHOICE)).toEqual({ missing: ['Pick a tint for a category.'], rows: [] });
    });

    test('a text field: the categories are typed, each with a name of its own and a tint; no property removes the part', () => {
        const typed = { property: 'note', rows: [{ category: ' East ', tint: 'tint-2' }, { category: 'East', tint: 'tint-3' }, { category: '', tint: '' },
            { category: 'Far', tint: '' }] };
        expect(checkTints(typed, CHOICE)).toEqual({ rows: [1, 2, 3], missing: ['Category 2 repeats East: each category has one tint.',
            'Category 3 has no tint.', 'Far has no tint.'] });
        // The empty category is one category, as the Gateway takes it (KindSetup.java reads it with text(..., false)); still one per category.
        expect(checkTints({ property: 'note', rows: [{ category: '', tint: 'tint-5' }, { category: 'East', tint: 'tint-2' }] }, CHOICE).tints)
            .toEqual({ property: 'note', tints: [{ category: '', tint: 'tint-5' }, { category: 'East', tint: 'tint-2' }] });
        expect(checkTints({ property: 'note', rows: [{ category: '', tint: 'tint-5' }, { category: '  ', tint: 'tint-2' }] }, CHOICE))
            .toEqual({ rows: [1], missing: ['Category 2 repeats the empty category: each category has one tint.'] });
        expect(checkTints({ property: 'note', rows: [{ category: ' East ', tint: 'tint-2' }] }, CHOICE).tints)
            .toEqual({ property: 'note', tints: [{ category: 'East', tint: 'tint-2' }] });
        expect(checkTints({ property: 'note', rows: [] }, CHOICE).missing).toEqual(['Add a category.']);
        expect(checkTints({ property: '', rows: [{ category: 'x', tint: '' }] }, CHOICE)).toEqual({ missing: [], rows: [], tints: null });
        expect(applyEdit(GEOFENCE_SETUP, { part: 'areaTints', tints: null })).toEqual({});
    });

    test('a refused tint is named by its category as sent; the property has its place', () => {
        const sent = { areaTints: { property: 'operator', tints: [{ category: 'North', tint: 'tint-1' }, { category: 'South', tint: 'red' }] } };
        expect(refusalPlace('Op 0 (geofence): areaTints.tints[1].tint: "red" is not a tint. Pick a tint: tint-1.', sent))
            .toEqual({ at: Fields.tint('South'), words: '"red" is not a tint. Pick a tint: tint-1.' });
        expect(refusalPlace('Op 0 (geofence): areaTints.tints[4].tint: gone', sent).at).toBe(Fields.areaTints);
        expect(refusalPlace('Op 0 (geofence): areaTints.property: "x" is not a form field of "geofence".', sent))
            .toEqual({ at: Fields.tintsProperty, words: '"x" is not a form field of "geofence".' });
        expect(refusalPlace('Op 0 (pad): areaTints: "pad" is not an area kind; only a line kind with area true in the kind list takes areaTints.', sent))
            .toEqual({ at: 'areaTints', words: '"pad" is not an area kind; only a line kind with area true in the kind list takes areaTints.' });
        expect(refusalPlace('Op 0 (geofence): areaTints.tints: a non-empty list of {category, tint} is needed.', sent))
            .toEqual({ at: 'areaTints', words: 'a non-empty list of {category, tint} is needed.' });
    });
});

describe('a refused Revert in the queue (12b1, S11): its conflict card has one choice, before and after a reload', () => {
    const moved: EditBatch = { batchId: 'batch-revert', ops: [{ op: 'update', entity: 'item', id: 'p31', baseVersion: 2,
        data: { geometry: { type: 'Point', coordinates: [-104.969, 39.744] } } }] };
    const theirs = item('p31', 'P31', { version: 3 });
    const conflict: Conflict = { index: 0, entity: 'item', id: 'p31', baseVersion: 2, current: theirs, changedBy: 'mapeditor2',
        changedAt: new Date(2026, 10, 10, 10, 42, 0).toISOString() };
    const reason = { code: 'conflict', message: 'P31 was changed by mapeditor2.', changedBy: 'mapeditor2' };

    class Store implements KeyValueStore {
        data = new Map<string, string>();
        getItem(key: string): string | null {
            return this.data.has(key) ? this.data.get(key) as string : null;
        }
        setItem(key: string, value: string): void {
            this.data.set(key, value);
        }
        removeItem(key: string): void {
            this.data.delete(key);
        }
    }

    test('the same refused edit offers Apply mine on top; marked as a Revert it does not, and the marker is kept with the entry', () => {
        const store = new Store();
        const key = storageKey('mapstudio-dev', 'mapeditor');
        const q = new UnsavedQueue(store, () => undefined);
        q.setKey(key);
        q.enqueue({ ...moved, batchId: 'batch-edit' }, new Date('2026-11-10T10:40:00Z'), [item('p31', 'P31', { version: 2 })]);
        q.enqueue(moved, new Date('2026-11-10T10:41:00Z'), [item('p31', 'P31', { version: 2 })], true);
        q.failed('batch-edit', reason, [conflict]);
        q.failed('batch-revert', reason, [conflict]);
        const [edit, revert] = q.list();
        expect(edit.revert).toBeUndefined();
        expect(revert.revert).toBe(true);
        expect(onTopBatch(edit, 'new')).not.toBeNull();
        expect(onTopBatch(revert, 'new')).toBeNull();
        const facts = { paused: false, dismissed: [], records: [theirs], kinds: [PAD], locale: '' };
        expect(saveCardFor({ ...facts, unsaved: [edit] })).toMatchObject({ kind: 'conflict', onTop: true });
        expect(saveCardFor({ ...facts, unsaved: [revert] })).toMatchObject({ kind: 'conflict', batchId: 'batch-revert', who: 'mapeditor2', onTop: false,
            blocked: '', title: "Not saved - conflict with mapeditor2's change" });
        // After a reload: the queue read again from the browser's store.
        const again = new UnsavedQueue(store, () => undefined);
        again.setKey(key);
        const reread = again.list().find((e) => e.batchId === 'batch-revert') as UnsavedEntry;
        expect(reread.revert).toBe(true);
        expect(saveCardFor({ ...facts, unsaved: [reread] })).toMatchObject({ kind: 'conflict', onTop: false });
        expect(readEntries(JSON.stringify([{ ...revert, revert: 'yes' }]))[0].revert).toBeUndefined();
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
