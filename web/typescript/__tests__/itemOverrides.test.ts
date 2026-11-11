// One item's Live now block and its per-item path overrides (epic 4 entry 12c1, R5; itemOverrides.ts): the block's rows from a
// kind's setup, an item and its live values (L1, L10, L12); one row's override or Reset onto the newest overrides with every other
// stored part untouched (L2 to L5, L11); the full-path check and a refusal's words (L6, L7); what the Gateway applies and so
// what is marked and counted (L11); and the words by part for Undo and Recent changes (L8).
import { readSetup } from '../kindSetup';
import {
    ALARMS_ROW, ASSET_MISSING_NOTE, COMMS_ROW, OFF_IN_POPUP, UNLINKED_NOTE, isFullTagPath, appliedParts, applyRowEdit, changeWords, isApplied, kpiLabelsOf, kpiRow, liveNowBlock, openSetupText,
    overrideChanges, overrideLabel, overridePath, overrideSentence, ownRuleApplied, pathProblem, refusalWords, rowKey, rowWords, sameOverrides, tagPathFault
} from '../itemOverrides';
import { ItemValues, LiveValue } from '../live';
import { ItemView } from '../placeholders';

const SETUP = {
    comms: { path: '{asset.path}/Comms', on: true },
    kpis: [
        { key: 'pressure', label: 'Pressure', path: '{asset.path}/Pressure', unit: 'psi', on: true, icon: true },
        { key: 'flow', label: 'Flow', path: '{asset.path}/Flow', unit: 'bbl/d', on: true, icon: false },
        { key: 'gas', label: 'Gas price', path: '[default]Shared/GasPrice', unit: '', on: false, icon: false }
    ],
    alarms: { path: '{asset.path}', count: true, summary: false },
    link: '/pad/{item.name}'
};
const P12: ItemView = { itemId: 'i12', itemName: 'P12', assetId: 'P12', assetPath: '[default]Mesa/P12', properties: {} };
const UNLINKED: ItemView = { itemId: 'i9', itemName: 'Point 9', assetId: null, assetPath: null, properties: {} };
const NOW = Date.parse('2026-11-10T12:00:30Z');

function live(value: unknown, extra: Partial<LiveValue> = {}): LiveValue {
    return { value, quality: 'Good', t: '2026-11-10T12:00:18Z', stale: false, reason: '', ...extra } as LiveValue;
}

const VALUES: ItemValues = {
    id: 'i12', comms: live(true), kpis: { pressure: live(512.34), flow: live(40) },
    alarms: live({ active: 1, unacked: 1, priority: 1 }), problems: []
};

/** `values` null: before the first batch. */
function block(overrides: Record<string, unknown> = {}, values: ItemValues | null = VALUES, view = P12, setup: Record<string, unknown> | null = SETUP) {
    return liveNowBlock({ kindName: 'Well pad', setup: setup ? readSetup(setup) : null, overrides, view, values: values || undefined, now: NOW });
}

describe('the block (L1, L10, L12)', () => {
    test('L1: Comms, the key values in the setup\'s order (the icon value starred) and Alarms, with values and filled paths', () => {
        const b = block();
        expect(b.rows.map((r) => r.id)).toEqual(['comms', 'kpi:pressure', 'kpi:flow', 'kpi:gas', 'alarms']);
        expect(b.rows.map((r) => r.name)).toEqual(['Comms', 'Pressure', 'Flow', 'Gas price', 'Alarms']);
        expect(b.rows.map((r) => r.icon)).toEqual([false, true, false, false, false]);
        expect(b.rows.map((r) => r.value)).toEqual(['OK - 12 s ago', '512.3 psi', '40 bbl/d', OFF_IN_POPUP, '1 alarm - Priority 1, unacknowledged']);
        expect(b.rows.map((r) => r.path)).toEqual(['[default]Mesa/P12/Comms', '[default]Mesa/P12/Pressure', '[default]Mesa/P12/Flow',
            '[default]Shared/GasPrice', '[default]Mesa/P12']);
        expect(b.rows.every((r) => r.override === null && r.path === r.start)).toBe(true);
        expect(b.unlinked).toBe(false);
        expect(b.empty).toBe('');
    });

    test('a key value switched off in the popup says so and shows no value, whatever the Gateway sends', () => {
        const values = { ...VALUES, kpis: { ...VALUES.kpis, gas: live(3.2) } };
        const gas = block({}, values).rows[3];
        expect(gas).toMatchObject({ off: true, value: OFF_IN_POPUP, stale: false });
    });

    test('before the first values, stale and comms lost, as the popup says them', () => {
        expect(block({}, null).rows.map((r) => r.value)).toEqual(['No data', 'No data', 'No data', OFF_IN_POPUP, 'Alarm state unknown']);
        const lost: ItemValues = { ...VALUES, comms: live(false), kpis: { pressure: live(512, { stale: true, reason: 'comms lost' }), flow: live(40) } };
        const b = block({}, lost);
        expect(b.rows[0]).toMatchObject({ value: 'Comms lost - 12 s ago', lost: true });
        expect(b.rows[1]).toMatchObject({ value: '512 psi', stale: true, note: 'Stale - comms lost' });
        expect(b.rows[2]).toMatchObject({ value: '40 bbl/d', stale: false, note: '' });
    });

    test('L2: an override shows its own path and is marked; the others keep the kind\'s', () => {
        const b = block({ kpis: [{ key: 'pressure', path: '[default]Mesa/P14/Pressure' }] });
        expect(b.rows[1]).toMatchObject({ override: '[default]Mesa/P14/Pressure', path: '[default]Mesa/P14/Pressure', start: '[default]Mesa/P12/Pressure',
            kindPath: '{asset.path}/Pressure' });
        expect(b.rows.filter((r) => r.override !== null).map((r) => r.id)).toEqual(['kpi:pressure']);
    });

    test('L10: an unlinked item shows the kind\'s paths as written, and an override starts from them', () => {
        const b = block({}, null, UNLINKED);
        expect(b).toMatchObject({ unlinked: true, assetMissing: false, note: UNLINKED_NOTE });
        expect(block()).toMatchObject({ unlinked: false, assetMissing: false, note: '' });
        expect(b.rows.map((r) => r.path)).toEqual(['{asset.path}/Comms', '{asset.path}/Pressure', '{asset.path}/Flow', '[default]Shared/GasPrice', '{asset.path}']);
        expect(b.rows[1].start).toBe('{asset.path}/Pressure');
        // Its own path still shows.
        expect(block({ comms: { path: '[default]Mesa/P9/Comms' } }, null, UNLINKED).rows[0]).toMatchObject({ override: '[default]Mesa/P9/Comms' });
    });

    test('a linked item whose asset is not in the asset list is not called unlinked: its own note, the paths as written', () => {
        const b = block({}, null, { ...P12, assetPath: null });
        expect(b).toMatchObject({ unlinked: false, assetMissing: true, note: ASSET_MISSING_NOTE });
        expect(ASSET_MISSING_NOTE).toBe('The paths show as the kind has them, since its asset is not in the asset list.');
        expect(b.rows[1].path).toBe('{asset.path}/Pressure');
    });

    test('L12: a kind with no setup, or one with none of the three parts, shows one line and the button\'s words', () => {
        expect(block({}, null, P12, null)).toMatchObject({ rows: [], empty: 'Well pad has no setup yet, so its items show no live values.' });
        expect(block({}, null, P12, { link: '/pad' })).toMatchObject({ rows: [],
            empty: "Well pad's setup has no comms, key values or alarms, so its items show no live values." });
        expect(openSetupText('Well pad')).toBe("Open Well pad's setup");
    });

    test('L11: a stored part the Gateway does not apply is not marked', () => {
        const stored = { link: '/other', kpis: [{ key: 'gone', path: '[default]a' }, { key: 'flow', path: 'Mesa/Flow' }], comms: { path: '{asset.path}/C' } };
        expect(block(stored).rows.every((r) => r.override === null)).toBe(true);
    });

    test('row ids', () => {
        expect(kpiRow('pressure')).toBe('kpi:pressure');
        expect(rowKey('kpi:pressure')).toBe('pressure');
        expect(rowKey(COMMS_ROW)).toBeNull();
        expect(rowKey(ALARMS_ROW)).toBeNull();
    });
});

describe('one row\'s override or Reset onto the newest overrides (L2 to L5, L11)', () => {
    const RULE = { source: { path: '[default]Mesa/P14/Pressure' }, type: 'expression', expression: "'normal'" };

    test('L2, L3: a key value\'s override is its entry {key, path}; a second key is added; every other part is the stored object', () => {
        const stored = { styleRule: RULE, link: '/other' };
        const one = applyRowEdit(stored, SETUP, 'kpi:pressure', '[default]Mesa/P14/Pressure');
        expect(one).toEqual({ styleRule: RULE, link: '/other', kpis: [{ key: 'pressure', path: '[default]Mesa/P14/Pressure' }] });
        expect(one.styleRule).toBe(RULE);
        const two = applyRowEdit(one, SETUP, 'kpi:flow', '[default]Mesa/P14/Flow');
        expect(two.kpis).toEqual([{ key: 'pressure', path: '[default]Mesa/P14/Pressure' }, { key: 'flow', path: '[default]Mesa/P14/Flow' }]);
        expect((two.kpis as unknown[])[0]).toBe((one.kpis as unknown[])[0]);
        expect(two.styleRule).toBe(RULE);
        // Nothing of the stored object was changed in place.
        expect(stored).toEqual({ styleRule: RULE, link: '/other' });
    });

    test('owner decision 1: a key value\'s override changes its path only; an entry\'s other stored values are kept', () => {
        const stored = { kpis: [{ key: 'pressure', path: '[default]a', on: false }, { key: 'gone', path: '[default]g' }] };
        expect(applyRowEdit(stored, SETUP, 'kpi:pressure', '[default]b').kpis)
            .toEqual([{ key: 'pressure', path: '[default]b', on: false }, { key: 'gone', path: '[default]g' }]);
    });

    test('L4: Reset removes the entry and keeps the other; the last Reset leaves no kpis', () => {
        const both = { kpis: [{ key: 'pressure', path: '[default]p' }, { key: 'flow', path: '[default]f' }], link: '/other' };
        const flow = applyRowEdit(both, SETUP, 'kpi:pressure', null);
        expect(flow).toEqual({ kpis: [{ key: 'flow', path: '[default]f' }], link: '/other' });
        expect(applyRowEdit(flow, SETUP, 'kpi:flow', null)).toEqual({ link: '/other' });
        expect('kpis' in applyRowEdit(flow, SETUP, 'kpi:flow', null)).toBe(false);
    });

    test('L5: Comms and Alarms are the kind\'s part with the path replaced, the kind\'s switches kept; Reset removes the part', () => {
        const comms = applyRowEdit({}, SETUP, COMMS_ROW, '[default]Mesa/P14/Comms');
        expect(comms).toEqual({ comms: { path: '[default]Mesa/P14/Comms', on: true } });
        const alarms = applyRowEdit(comms, SETUP, ALARMS_ROW, '[default]Mesa/P14');
        expect(alarms).toEqual({ comms: { path: '[default]Mesa/P14/Comms', on: true }, alarms: { path: '[default]Mesa/P14', count: true, summary: false } });
        expect(applyRowEdit(alarms, SETUP, COMMS_ROW, null)).toEqual({ alarms: { path: '[default]Mesa/P14', count: true, summary: false } });
        expect(applyRowEdit(applyRowEdit(alarms, SETUP, COMMS_ROW, null), SETUP, ALARMS_ROW, null)).toEqual({});
        // An override the item already has keeps its own switches and takes the new path; only a new one starts from the kind's part.
        expect(applyRowEdit({ comms: { path: '[default]a', on: false } }, SETUP, COMMS_ROW, '[default]b')).toEqual({ comms: { path: '[default]b', on: false } });
        expect(applyRowEdit({ alarms: { path: '[default]a', count: false, summary: true } }, SETUP, ALARMS_ROW, '[default]b'))
            .toEqual({ alarms: { path: '[default]b', count: false, summary: true } });
        // A kind whose switch is off keeps it off for the item.
        expect(applyRowEdit({}, { comms: { path: '{asset.path}/C', on: false } }, COMMS_ROW, '[default]c')).toEqual({ comms: { path: '[default]c', on: false } });
    });

    test('an edit that changes nothing returns the newest overrides themselves, so nothing is sent', () => {
        const stored = { kpis: [{ key: 'pressure', path: '[default]p' }], comms: { path: '[default]c', on: true } };
        expect(applyRowEdit(stored, SETUP, 'kpi:pressure', '[default]p')).toBe(stored);
        expect(applyRowEdit(stored, SETUP, COMMS_ROW, '[default]c')).toBe(stored);
        expect(applyRowEdit(stored, SETUP, 'kpi:flow', null)).toBe(stored);
        expect(applyRowEdit(stored, SETUP, ALARMS_ROW, null)).toBe(stored);
        expect(applyRowEdit(stored, SETUP, 'nothing', '[default]x')).toBe(stored);
        expect(sameOverrides(applyRowEdit(null, SETUP, ALARMS_ROW, null), {})).toBe(true);
    });

    test('L11: a stored link override passes through every edit untouched', () => {
        const stored = { link: '/other', popupView: { path: 'A/B' } };
        const set = applyRowEdit(stored, SETUP, 'kpi:pressure', '[default]p');
        expect(set.link).toBe('/other');
        expect(set.popupView).toBe(stored.popupView);
        expect(applyRowEdit(set, SETUP, 'kpi:pressure', null)).toEqual(stored);
    });
});

describe('the full-path check and a refusal\'s words (L6, L7)', () => {
    test('L6: only a full path is taken; anything else is said in the Gateway\'s words', () => {
        expect(pathProblem('[default]Mesa/P14/Pressure')).toBe('');
        expect(pathProblem('{asset.path}/X')).toBe("an override's tag path is a full path such as [default]Mesa/P12/Pressure, not {asset.path}/X.");
        expect(pathProblem('{asset.path}')).toBe("an override's tag path is a full path such as [default]Mesa/P12/Pressure, not {asset.path}.");
        expect(pathProblem('Mesa/X')).toBe('Mesa/X is not a tag path; use a full path such as [default]Shared/GasPrice.');
        expect(pathProblem('  ')).toBe('a tag path is needed.');
        // The Gateway's rule and sentence per case (Placeholders.checkTagPath for an override, TagPaths.fault).
        const notPath = (v: string) => v + ' is not a tag path; use a full path such as [default]Shared/GasPrice.';
        for (const v of ['[default]', '[]x', '[x', '{asset.path}foo', '{asset.path}/', '{item.name}']) {
            expect(pathProblem(v)).toBe(notPath(v));
            expect(isFullTagPath(v)).toBe(false);
        }
        // Entry 13a, G3: what tags.resolve refuses is refused here first, in the Gateway's words (PlaceholdersTest's vectors).
        expect(pathProblem('[default]a//b')).toBe('[default]a//b has an empty part between two /; a tag path has a name between every two /.');
        expect(pathProblem('[default]a/ /b')).toContain('has an empty part between two /');
        expect(pathProblem('[default]/Mesa/P12')).toContain('has an empty part between two /');
        // Below the asset and malformed: the full-path rule, once, before the fault of its form.
        for (const v of ['{asset.path}/a//b', '{asset.path}/a[0]', '{asset.path}/a{b}']) {
            expect(pathProblem(v)).toBe("an override's tag path is a full path such as [default]Mesa/P12/Pressure, not " + v + '.');
        }
        const bracket = (v: string) => v + ' has a [ or ] after its start; a tag path names its provider once, at its start.';
        for (const v of ['[a][b]x', '[default]a[0]', '[default]a/b]']) {
            expect(pathProblem(v)).toBe(bracket(v));
        }
        const brace = (v: string) => v + ' has a { or } inside it; braces only mark {asset.path} at the start of a tag path.';
        for (const v of ['[default]a{item.id}', '[default]a}']) {
            expect(pathProblem(v)).toBe(brace(v));
        }
        expect(pathProblem('[~]Mesa/P12')).toBe('[~]Mesa/P12 does not name its provider; use a full path such as [default]Shared/GasPrice, not a relative one.');
        expect(pathProblem('[.]X')).toContain('does not name its provider');
        expect(pathProblem('[default]' + 'a'.repeat(1024))).toBe('the tag path is longer than 1024 characters.');
        for (const v of ['[default]a//b', '[a][b]x', '[default]a}', '[~]x', '{asset.path}/X']) {
            expect(isFullTagPath(v)).toBe(false);
        }
        // A trailing / is not a part, as for a lookup.
        expect(pathProblem('[default]Mesa/P12/')).toBe('');
        expect(tagPathFault('{asset.path}/Meter/Flow/')).toBeNull();
        expect(tagPathFault('{asset.path}')).toBeNull();
        expect(tagPathFault('')).toBe('empty');
        expect(['[default]a', '[edge]A/B C', '[d]x'].every((v) => pathProblem(v) === '' && isFullTagPath(v))).toBe(true);
        // As the Gateway repeats a long value: 64 characters, then "...".
        expect(pathProblem('x'.repeat(70))).toBe('x'.repeat(64) + '... is not a tag path; use a full path such as [default]Shared/GasPrice.');
    });

    test('L7: a Gateway refusal loses "Op N (id): overrides: " and the part\'s name', () => {
        expect(refusalWords('Op 0 (4f0c): overrides: kpis[0].path: [default] is not a tag path; use a full path such as [default]Shared/GasPrice.'))
            .toBe('[default] is not a tag path; use a full path such as [default]Shared/GasPrice.');
        expect(refusalWords('Op 0 (4f0c): overrides: comms.path: [x]{y} is not a tag path; use a full path such as [default]Shared/GasPrice.'))
            .toBe('[x]{y} is not a tag path; use a full path such as [default]Shared/GasPrice.');
        expect(refusalWords('Op 0 (4f0c): overrides: "label" is not a part of overrides; the parts are comms.'))
            .toBe('"label" is not a part of overrides; the parts are comms.');
        expect(refusalWords('The kind list is not available.')).toBe('The kind list is not available.');
    });

    test('what the Gateway applies as an override path (ValuePlan.isFull)', () => {
        expect(['[default]a', '[edge]A/B'].every(isApplied)).toBe(true);
        expect(['{asset.path}/a', 'Mesa/a', '[]a', '[default]{x}', '', null, 4].some(isApplied)).toBe(false);
    });
});

describe('what is applied and counted (L11, owner decision 5)', () => {
    test('comms, key values of the kind\'s keys, alarms and a style rule; nothing else', () => {
        const all = { comms: { path: '[default]c' }, kpis: [{ key: 'pressure', path: '[default]p' }], alarms: { path: '[default]a' },
            styleRule: { source: { kpi: 'pressure' } }, link: '/x', popupView: { path: 'A/B' }, areaTints: {} };
        expect(appliedParts(all, ['pressure'])).toEqual(['comms', 'kpis', 'alarms', 'styleRule']);
        expect(appliedParts(all, ['flow'])).toEqual(['comms', 'alarms', 'styleRule']);
        expect(appliedParts({ link: '/x', kpis: [{ key: 'pressure', path: 'x' }], comms: { path: 'y' }, styleRule: { source: { path: 'z' } } }, ['pressure'])).toEqual([]);
        expect(appliedParts(undefined, [])).toEqual([]);
        expect(ownRuleApplied({ styleRule: { source: { path: '[default]p' } } })).toBe(true);
        expect(ownRuleApplied({ styleRule: { source: { instruments: 'worst' } } })).toBe(true);
        expect(ownRuleApplied({ link: '/x' })).toBe(false);
        expect(overridePath({ kpis: [{ key: 'pressure', path: '[default]p' }] }, 'kpi:pressure')).toBe('[default]p');
        expect(overridePath({ kpis: [{ key: 'pressure', path: '[default]p' }] }, 'kpi:flow')).toBeNull();
        expect(overridePath({ alarms: { path: '[default]a' } }, ALARMS_ROW)).toBe('[default]a');
    });
});

describe('the words by part (L8, owner decision 3)', () => {
    const label = (key: string) => (key === 'pressure' ? 'Pressure' : undefined);

    test('what changed between two overrides, part by part and key by key', () => {
        const set = overrideChanges({}, { kpis: [{ key: 'pressure', path: '[default]p' }] }, label);
        expect(set).toEqual([{ part: 'kpis', words: 'Pressure path', reset: false, before: '', after: '[default]p' }]);
        const reset = overrideChanges({ comms: { path: '[default]c', on: true }, link: '/x' }, { link: '/x' }, label);
        expect(reset).toEqual([{ part: 'comms', words: 'comms path', reset: true, before: '[default]c', after: '' }]);
        // A key value with no label known is said by its key; the other parts by name.
        expect(changeWords(overrideChanges({ styleRule: { a: 1 } }, { kpis: [{ key: 'flow', path: '[default]f' }], alarms: { path: '[default]a' } }, label)))
            .toBe('flow path, alarms path and style rule');
        expect(overrideChanges({ link: '/x' }, { link: '/x' })).toEqual([]);
        // A switch changed alone is the part's override, not its path.
        expect(overrideChanges({ comms: { path: '[default]c', on: true } }, { comms: { path: '[default]c', on: false } }, label))
            .toEqual([{ part: 'comms', words: 'comms override', reset: false, before: '', after: '' }]);
        expect(overrideChanges({ kpis: [{ key: 'pressure', path: '[default]p' }] }, { kpis: [{ key: 'pressure', path: '[default]p', on: false }] }, label))
            .toEqual([{ part: 'kpis', words: 'Pressure override', reset: false, before: '', after: '' }]);
        expect(overrideChanges(null, undefined)).toEqual([]);
    });

    test('Recent changes\' sentence and Undo\'s label', () => {
        expect(overrideSentence('Point 2', overrideChanges({}, { kpis: [{ key: 'pressure', path: '[default]p' }] }, label))).toBe("Changed Point 2's Pressure path");
        expect(overrideSentence('Point 2', overrideChanges({ comms: { path: '[default]c' } }, {}, label))).toBe("Reset Point 2's comms path");
        expect(overrideSentence('Point 2', [])).toBe('');
        expect(overrideLabel(false, 'Point 2', rowWords('kpi:pressure', 'Pressure'))).toBe("change Point 2's Pressure path");
        expect(overrideLabel(true, 'Point 2', rowWords(COMMS_ROW, 'Comms'))).toBe("reset Point 2's comms path");
        expect(rowWords(ALARMS_ROW, 'Alarms')).toBe('alarms');
    });

    test('a key value\'s label from the stored kind setups', () => {
        const labels = kpiLabelsOf([{ kindId: 'pad', setup: SETUP }]);
        expect(labels('pad', 'pressure')).toBe('Pressure');
        expect(labels('pad', 'nope')).toBeUndefined();
        expect(labels('line', 'pressure')).toBeUndefined();
    });
});
