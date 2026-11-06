// The item form's rules (epic 4 entry 6, R3, R12; itemForm.ts): a typed field read as the Gateway's ItemCheck types it, the
// values a kind change keeps, the required fields missing, the other items sharing a name on a different asset, the asset
// list's state under Asset, a vanished asset and an unknown kind in words, and the last values kept per project and kind.
import { AdapterStatus, AssetName, FormField, Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import {
    FormStore, assetListKnown, assetListNote, assetVanished, fieldText, fitsField, isUnset, keptProperties, missingRequired, missingText,
    nameTwins, prefillFor, prefillKey, readField, readPrefill, rememberValue, sameName, twinText, unknownKindText, vanishedText, withValue
} from '../itemForm';

// The dev kinds (ops/project/ignition/script-python/mapstudio_dev/code.py).
const OPERATOR: FormField = { key: 'operator', label: 'Operator', type: 'text', required: false, choices: [] };
const WELLS: FormField = { key: 'wells', label: 'Wells', type: 'integer', required: false, choices: [] };
const STATUS: FormField = { key: 'status', label: 'Status', type: 'choice', required: true, choices: ['producing', 'shut in', 'abandoned'] };
const DIAMETER: FormField = { key: 'diameter', label: 'Diameter (in)', type: 'number', required: false, choices: [] };
const BURIED: FormField = { key: 'buried', label: 'Buried', type: 'boolean', required: false, choices: [] };
const TAG: FormField = { key: 'tag', label: 'Tag', type: 'text', required: false, choices: [] };

const PAD: Kind = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [OPERATOR, WELLS, STATUS] };
const LINE: Kind = { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 5, fields: [DIAMETER, BURIED] };
const TAP: Kind = { id: 'tap', name: 'Tap', geometry: 'point', icon: 'tap', labelRank: 2, instrument: true, fields: [TAG] };
const VALVE: Kind = { id: 'valve', name: 'Line valve', geometry: 'point', icon: 'line-valve', labelRank: 1, instrument: true, fields: [TAG] };

function status(word: AdapterStatus['status'], count: number, message = 'words'): AdapterStatus {
    return { status: word, message, function: 'mapstudio_dev.assets', count, left: 0, refreshedAt: null };
}

function item(id: string, name: string, assetId: string | null, extra: Partial<MapItemRecord> = {}): MapItemRecord {
    return { id, kind: 'pad', name, geometry: { type: 'Point', coordinates: [0, 0] }, properties: {}, assetId, overrides: {}, ends: null,
        attachment: null, version: 1, deleted: false, ...extra };
}

describe('readField: a typed field as ItemCheck types it', () => {
    test('blank is not set in every type; text keeps what was typed, outer spaces aside', () => {
        for (const f of [OPERATOR, WELLS, STATUS, DIAMETER, BURIED]) {
            expect(readField(f, '   ')).toEqual({ value: null });
        }
        expect(readField(OPERATOR, '  Acme Oil ')).toEqual({ value: 'Acme Oil' });
        expect(readField(OPERATOR, 'abc')).toEqual({ value: 'abc' });
    });

    test('a whole number field takes a whole number, sent as a number; anything else is said in words and not saved', () => {
        expect(readField(WELLS, '3')).toEqual({ value: 3 });
        expect(readField(WELLS, ' 12 ')).toEqual({ value: 12 });
        expect(readField(WELLS, '3.0')).toEqual({ value: 3 });
        expect(readField(WELLS, '1e3')).toEqual({ value: 1000 });
        expect(readField(WELLS, '-2')).toEqual({ value: -2 });
        expect(readField(WELLS, '-0')).toEqual({ value: 0 });
        for (const bad of ['abc', '3.5', '0x10', '1,5', 'Infinity', '3 wells', '1e-3']) {
            expect(readField(WELLS, bad)).toEqual({ problem: 'Wells takes a whole number' });
        }
        expect(readField(WELLS, '1e400')).toEqual({ problem: 'Wells is out of range' });
        // Past what the browser holds exactly: out of range here, though the Gateway would take it.
        expect(readField(WELLS, '9007199254740993')).toEqual({ problem: 'Wells is out of range' });
    });

    test('a number field takes any decimal as BigDecimal reads it, sent as a number', () => {
        expect(readField(DIAMETER, '4.5')).toEqual({ value: 4.5 });
        expect(readField(DIAMETER, ' .5 ')).toEqual({ value: 0.5 });
        expect(readField(DIAMETER, '6.')).toEqual({ value: 6 });
        expect(readField(DIAMETER, '+2e1')).toEqual({ value: 20 });
        expect(readField(DIAMETER, 'six')).toEqual({ problem: 'Diameter (in) takes a number' });
        expect(readField(DIAMETER, '0x10')).toEqual({ problem: 'Diameter (in) takes a number' });
        expect(readField(DIAMETER, '1e999')).toEqual({ problem: 'Diameter (in) is out of range' });
    });

    test('a choice is one of its choices; a boolean is true or false', () => {
        expect(readField(STATUS, 'shut in')).toEqual({ value: 'shut in' });
        expect(readField(STATUS, 'drilling')).toEqual({ problem: 'Status is one of producing, shut in, abandoned' });
        expect(readField(BURIED, 'TRUE')).toEqual({ value: true });
        expect(readField(BURIED, 'false')).toEqual({ value: false });
        expect(readField(BURIED, 'yes')).toEqual({ problem: 'Buried is true or false' });
    });

    test('a stored value as its input shows it', () => {
        expect(fieldText(undefined)).toBe('');
        expect(fieldText(null)).toBe('');
        expect(fieldText('Acme')).toBe('Acme');
        expect(fieldText(3)).toBe('3');
        expect(fieldText(true)).toBe('true');
        expect(fieldText({ a: 1 })).toBe('{"a":1}');
    });
});

describe('a kind change keeps the values the new kind defines, with their type', () => {
    test('fitsField: the stored types the map store keeps', () => {
        expect(fitsField(OPERATOR, 'Acme')).toBe(true);
        expect(fitsField(OPERATOR, 3)).toBe(false);
        expect(fitsField(WELLS, 3)).toBe(true);
        expect(fitsField(WELLS, 3.5)).toBe(false);
        expect(fitsField(WELLS, '3')).toBe(false);
        expect(fitsField(DIAMETER, 4.5)).toBe(true);
        expect(fitsField(STATUS, 'shut in')).toBe(true);
        expect(fitsField(STATUS, 'drilling')).toBe(false);
        expect(fitsField(BURIED, false)).toBe(true);
        expect(fitsField(BURIED, 'false')).toBe(false);
        expect(fitsField(OPERATOR, null)).toBe(false);
    });

    test('a tap with its Tag changed to a line valve keeps Tag; a pad changed to a tap drops every value', () => {
        expect(keptProperties({ tag: 'PT-9' }, VALVE)).toEqual({ tag: 'PT-9' });
        expect(keptProperties({ operator: 'Acme', wells: 3, status: 'producing' }, TAP)).toEqual({});
        // A key both define but of another type is dropped too: the Gateway would refuse it.
        expect(keptProperties({ tag: 7 }, VALVE)).toEqual({});
        expect(keptProperties({ diameter: 6, buried: true, extra: 'x' }, LINE)).toEqual({ diameter: 6, buried: true });
    });

    test('withValue: a copy with the one key set; not set leaves it out', () => {
        const before = { operator: 'Acme', wells: 3 };
        expect(withValue(before, 'status', 'shut in')).toEqual({ operator: 'Acme', wells: 3, status: 'shut in' });
        expect(withValue(before, 'wells', null)).toEqual({ operator: 'Acme' });
        expect(before).toEqual({ operator: 'Acme', wells: 3 });
    });
});

describe('the required fields still missing', () => {
    test('a pad with Status not set misses Status; false and 0 are values, blank text is not', () => {
        expect(missingRequired(PAD, {}).map((f) => f.key)).toEqual(['status']);
        expect(missingText(missingRequired(PAD, { operator: 'Acme' }))).toBe('Missing: Status');
        expect(missingText(missingRequired(PAD, { status: 'producing' }))).toBe('');
        expect(missingText(missingRequired(PAD, { status: '  ' }))).toBe('Missing: Status');
        const strict: Kind = { ...LINE, fields: [{ ...DIAMETER, required: true }, { ...BURIED, required: true }] };
        expect(missingText(missingRequired(strict, {}))).toBe('Missing: Diameter (in), Buried');
        expect(missingText(missingRequired(strict, { diameter: 0, buried: false }))).toBe('');
        expect(missingRequired(undefined, {})).toEqual([]);
        expect(isUnset(false)).toBe(false);
        expect(isUnset(0)).toBe(false);
    });
});

describe('two items sharing a name on different assets (R3)', () => {
    const names: AssetName[] = [{ id: 'P14', name: 'Pad 14' }, { id: 'P15', name: 'Pad 15' }];
    const items = [
        item('a', 'P14', 'P14'), item('b', ' p14 ', 'P15'), item('c', 'P14', null), item('d', 'P14', 'P14'),
        item('gone', 'P14', 'P12', { deleted: true }), item('e', 'Other', 'P12')
    ];

    test('the same name with letter case and outer spaces aside, on another asset or unlinked; never itself, the same asset or a deleted one', () => {
        expect(sameName(' P14', 'p14 ')).toBe(true);
        expect(sameName('P14', 'P 14')).toBe(false);
        const twins = nameTwins('P14', { id: 'a', assetId: 'P14' }, items, names);
        expect(twins).toEqual([{ id: 'b', assetId: 'P15', assetLabel: 'Pad 15' }, { id: 'c', assetId: null, assetLabel: null }]);
        expect(twinText(twins)).toBe('Also the name of the item linked to Pad 15 and an unlinked item');
        expect(twinText(nameTwins('p14', { id: 'b', assetId: 'P15' }, items, names)))
            .toBe('Also the name of the item linked to Pad 14, the item linked to Pad 14 and an unlinked item');
        // Two unlinked items share no asset, so they are not twins of each other: nothing to underline.
        expect(nameTwins('P14', { id: 'x', assetId: null }, [item('c', 'P14', null)], names)).toEqual([]);
        expect(twinText([])).toBe('');
        expect(nameTwins('  ', { id: 'x', assetId: null }, [item('y', ' ', 'P14')], names)).toEqual([]);
    });

    test('an asset the names do not list is named by its id; several unlinked are counted', () => {
        const twins = nameTwins('Other', { id: 'z', assetId: null }, [item('e', 'Other', 'P12'), item('f', 'other', 'P12')], names);
        expect(twinText(twins)).toBe('Also the name of the item linked to P12 and the item linked to P12');
        expect(twinText(nameTwins('Q', { id: 'z', assetId: 'P14' }, [item('g', 'Q', null), item('h', 'q', null)], names)))
            .toBe('Also the name of 2 unlinked items');
    });
});

describe('the asset list under Asset, a vanished asset and an unknown kind', () => {
    test('the message shows while the list is empty, incomplete, failing, slow or not configured', () => {
        for (const word of ['empty', 'incomplete', 'failing', 'slow', 'not-configured'] as const) {
            expect(assetListNote(status(word, 0, 'The ' + word + ' words.'))).toBe('The ' + word + ' words.');
        }
        expect(assetListNote(status('ok', 10))).toBe('');
        expect(assetListNote(status('loading', 0))).toBe('');
        expect(assetListNote(null)).toBe('');
    });

    test('a link is checked only against a list in use: ok, incomplete, empty, or a failing or slow one that kept a list', () => {
        expect(assetListKnown(status('ok', 10))).toBe(true);
        expect(assetListKnown(status('incomplete', 10))).toBe(true);
        expect(assetListKnown(status('empty', 0))).toBe(true);
        expect(assetListKnown(status('failing', 10))).toBe(true);
        expect(assetListKnown(status('failing', 0))).toBe(false);
        expect(assetListKnown(status('slow', 0))).toBe(false);
        expect(assetListKnown(status('loading', 0))).toBe(false);
        expect(assetListKnown(status('not-configured', 0))).toBe(false);
        expect(assetListKnown(null)).toBe(false);
    });

    test('P99 linked but not in the list reads not linked, with the reason; the kind out of the list says its values are kept', () => {
        const names: AssetName[] = [{ id: 'P14', name: 'Pad 14' }];
        expect(assetVanished('P99', names, status('ok', 1))).toBe(true);
        expect(assetVanished('P14', names, status('ok', 1))).toBe(false);
        expect(assetVanished(null, names, status('ok', 1))).toBe(false);
        expect(assetVanished('P99', [], status('loading', 0))).toBe(false);
        expect(assetVanished('P14', [], status('empty', 0))).toBe(true);
        expect(vanishedText('P99')).toBe('Not linked: P99 is no longer in the asset list');
        expect(unknownKindText('tank')).toBe('tank is no longer in the kind list; its values are kept');
    });
});

describe('the last values per project and kind (R12: prefill)', () => {
    function memory(): FormStore & { data: Map<string, string> } {
        const data = new Map<string, string>();
        return { data, getItem: (k) => (data.has(k) ? data.get(k)! : null), setItem: (k, v) => { data.set(k, v); } };
    }

    test('a finished value is kept per project and kind, "not set" forgets it, and a new item takes those its kind still defines', () => {
        const store = memory();
        const key = prefillKey('mapstudio-dev', 'pad');
        expect(key).toBe('mapstudio.prefill.v1|mapstudio-dev|pad');
        expect(prefillKey(null, 'pad')).toBe('mapstudio.prefill.v1||pad');
        expect(readPrefill(store, key)).toEqual({});
        rememberValue(store, key, 'operator', 'Acme');
        rememberValue(store, key, 'wells', 3);
        rememberValue(store, key, 'status', 'shut in');
        rememberValue(store, key, 'wells', null);
        expect(readPrefill(store, key)).toEqual({ operator: 'Acme', status: 'shut in' });
        expect(prefillFor(PAD, readPrefill(store, key))).toEqual({ operator: 'Acme', status: 'shut in' });
        // Another project or kind keeps its own.
        expect(readPrefill(store, prefillKey('other', 'pad'))).toEqual({});
        expect(readPrefill(store, prefillKey('mapstudio-dev', 'line'))).toEqual({});
        // A value the kind no longer defines, or of a type it no longer has, is not prefilled.
        const changed: Kind = { ...PAD, fields: [OPERATOR, { ...STATUS, choices: ['producing'] }] };
        expect(prefillFor(changed, { operator: 'Acme', status: 'shut in', wells: 3 })).toEqual({ operator: 'Acme' });
    });

    test('a store that refuses or holds what is not a record keeps nothing and throws nothing', () => {
        const refusing: FormStore = {
            getItem: () => { throw new Error('denied'); },
            setItem: () => { throw new Error('full'); }
        };
        expect(readPrefill(refusing, 'k')).toEqual({});
        expect(() => rememberValue(refusing, 'k', 'operator', 'Acme')).not.toThrow();
        expect(readPrefill(null, 'k')).toEqual({});
        expect(() => rememberValue(null, 'k', 'operator', 'Acme')).not.toThrow();
        const odd = memory();
        odd.data.set('k', '[1,2]');
        expect(readPrefill(odd, 'k')).toEqual({});
        odd.data.set('k', '{not json');
        expect(readPrefill(odd, 'k')).toEqual({});
    });
});
