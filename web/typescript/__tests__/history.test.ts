// Recent changes (epic-editing entry 11b, R18): the edit record's rows (one per batch, newest first), their sentences, who and when,
// what a row expands to, the batch Revert sends and when it is not offered, and the pages merged by seq. The plan's matrix B2, B3,
// B6 to B9 in pure functions; the delegate's reads and Revert are in historyDelegate.test.ts.

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Kind } from '../adapters';
import { HistoryEntry, HistoryOp } from '../contract';
import {
    HISTORY_EMPTY, HistoryPage, KIND_SETUP_TEXT, NOTHING_TO_UNDO_YET, NOT_KEPT_TEXT, REVERT_FOOTER, batchSentence, canShowOlder, expandOps,
    failRead, geometryWords, historyRows, initialOf, kindWords, mergeFirstPage, mergeOlderPage, nextUndoText, plural, readFailedText,
    revertBatch, revertBlocked, revertLabel, revertedOf, rowSentence, whenText
} from '../history';
import { HistoryPanel } from '../studio/HistoryPanel';

const PAD: Kind = {
    id: 'pad', name: 'Well pad', geometry: 'point', icon: '', labelRank: 0,
    fields: [{ key: 'gasRate', label: 'Gas rate', type: 'number', required: false, choices: [] }]
};
const PIPE: Kind = { id: 'pipe', name: 'Pipeline', geometry: 'line', icon: '', labelRank: 0, fields: [] };
const TAP: Kind = { id: 'tap', name: 'Pressure tap', geometry: 'point', icon: '', labelRank: 0, fields: [], instrument: true };
const LEASE: Kind = { id: 'lease', name: 'Lease', geometry: 'line', icon: '', labelRank: 0, fields: [], area: true };
const KINDS = [PAD, PIPE, TAP, LEASE];

const point = (c: [number, number]) => ({ type: 'Point', coordinates: c });
const P14_AT: [number, number] = [-103.8689, 32.2297];
// About 40 m north of it.
const P14_NORTH: [number, number] = [-103.8689, 32.23006];

function op(partial: Partial<HistoryOp> & Pick<HistoryOp, 'op' | 'id'>): HistoryOp {
    return { entity: 'item', name: null, kind: 'pad', version: 1, before: null, after: null, ...partial };
}

function entry(seq: number, ops: HistoryOp[], actor = 'mapeditor', at = '2026-11-09T10:42:05Z'): HistoryEntry {
    return { seq, batchId: 'b' + seq, actor, at, source: 'session', ops };
}

const record = (name: string, kind: string, geometry: unknown, extra: Record<string, unknown> = {}) => ({
    id: name.toLowerCase(), kind, name, geometry, properties: {}, assetId: null, overrides: {}, ends: null, attachment: null,
    version: 1, deleted: false, ...extra
});

const move = (seq: number, version: number, from: [number, number], to: [number, number], actor = 'mapeditor') => entry(seq, [op({
    op: 'update', id: 'p14', name: 'P14', version, before: { geometry: point(from) }, after: { geometry: point(to) }
})], actor);

describe('the sentence of a batch (B2, B6, B8)', () => {
    test('a move, a rename, an add, a link and a field change', () => {
        expect(batchSentence(move(1, 2, P14_AT, P14_NORTH), KINDS)).toBe('Moved P14 about 40 m north');
        expect(batchSentence(entry(2, [op({ op: 'update', id: 'p14', name: 'P14 North', version: 3,
            before: { name: 'P14' }, after: { name: 'P14 North' } })]), KINDS)).toBe('Renamed P14 to P14 North');
        expect(batchSentence(entry(3, [op({ op: 'create', id: 'p40', name: 'P40', after: record('P40', 'pad', point(P14_AT)) })]), KINDS))
            .toBe('Added well pad P40');
        expect(batchSentence(entry(4, [op({ op: 'update', id: 'p14', name: 'P14', before: { assetId: null }, after: { assetId: 'a1' } })]), KINDS))
            .toBe('Linked P14 to an asset');
        expect(batchSentence(entry(5, [op({ op: 'update', id: 'p14', name: 'P14', before: { properties: { gasRate: 1 } },
            after: { properties: { gasRate: 2 } } })]), KINDS)).toBe("Changed P14's Gas rate");
    });

    test('entry 12c1: an override is named by its part, a Reset as a reset (owner decision 3)', () => {
        const labels = (kind: string, key: string) => (kind === 'pad' && key === 'pressure' ? 'Pressure' : undefined);
        const RULE = { source: { path: '[default]Mesa/P14/Pressure' }, type: 'expression', expression: "'normal'" };
        const set = entry(6, [op({ op: 'update', id: 'p2', name: 'Point 2', before: { overrides: { styleRule: RULE } },
            after: { overrides: { styleRule: RULE, kpis: [{ key: 'pressure', path: '[default]Mesa/P12/Pressure' }] } } })]);
        expect(batchSentence(set, KINDS, '', labels)).toBe("Changed Point 2's Pressure path");
        // With no label known (the kind setups not loaded) the key is said.
        expect(batchSentence(set, KINDS)).toBe("Changed Point 2's pressure path");
        const reset = entry(7, [op({ op: 'update', id: 'p2', name: 'Point 2', before: { overrides: { comms: { path: '[default]c', on: true } } },
            after: { overrides: {} } })]);
        expect(batchSentence(reset, KINDS, '', labels)).toBe("Reset Point 2's comms path");
        expect(batchSentence(entry(8, [op({ op: 'update', id: 'p2', name: 'Point 2', before: { overrides: {} }, after: { overrides: { styleRule: RULE } } })]), KINDS))
            .toBe("Changed Point 2's style rule");
        // A kind change that dropped the overrides in the same save (owner decision 2).
        expect(batchSentence(entry(9, [op({ op: 'update', id: 'p2', name: 'Point 2', before: { kind: 'pad', properties: {}, overrides: { styleRule: RULE } },
            after: { kind: 'tap', properties: {}, overrides: {} } })]), KINDS)).toBe("Changed Point 2's kind to pressure tap and dropped its overrides");
        // A value changed with the kind: the fields as before, then the overrides.
        expect(batchSentence(entry(10, [op({ op: 'update', id: 'p2', name: 'Point 2', before: { kind: 'pad', properties: { gasRate: 1 }, overrides: { styleRule: RULE } },
            after: { kind: 'tap', properties: {}, overrides: {} } })]), KINDS)).toMatch(/^Changed Point 2's kind and .+ and dropped its overrides$/);
        // A switch changed alone (a script) is the part's override, not its path.
        const switched = entry(11, [op({ op: 'update', id: 'p2', name: 'Point 2', before: { overrides: { comms: { path: '[default]c', on: true } } },
            after: { overrides: { comms: { path: '[default]c', on: false } } } })]);
        expect(batchSentence(switched, KINDS, '', labels)).toBe("Changed Point 2's comms override");
        expect(expandOps(switched, { kinds: KINDS, kpiLabel: labels })[0].fields.map((f) => f.label)).toEqual(['Comms override']);
        // The row expanded: each path before and after, "From kind" where the item had none of its own.
        expect(expandOps(set, { kinds: KINDS, kpiLabel: labels })[0].fields)
            .toEqual([{ label: 'Pressure path override', before: 'From kind', after: '[default]Mesa/P12/Pressure' }]);
        expect(expandOps(reset, { kinds: KINDS, kpiLabel: labels })[0].fields)
            .toEqual([{ label: 'Comms path override', before: '[default]c', after: 'From kind' }]);
        expect(historyRows([set], KINDS, '', new Date('2026-11-09T10:43:00Z'), labels)[0].sentence).toBe("Changed Point 2's Pressure path");
    });

    test('a line deleted with its instruments in one change (EXPERIENCE.md Instruments)', () => {
        const line = op({ op: 'delete', id: 'l', name: 'L-TEST', kind: 'pipe', version: 4, before: record('L-TEST', 'pipe', { type: 'LineString', coordinates: [[0, 0], [1, 1]] }) });
        const tap = (id: string) => op({ op: 'delete', id, name: id, kind: 'tap', version: 2,
            before: record(id, 'tap', point([0, 0]), { attachment: { lineId: 'l', distanceM: 10 } }) });
        expect(batchSentence(entry(9, [line, tap('PT-1'), tap('PT-2')]), KINDS)).toBe('Deleted pipeline L-TEST and its 2 instruments in one change');
        expect(batchSentence(entry(9, [line, tap('PT-1')]), KINDS)).toBe('Deleted pipeline L-TEST and its instrument in one change');
        expect(batchSentence(entry(9, [line]), KINDS)).toBe('Deleted pipeline L-TEST');
    });

    test('a bulk change of 20 pads and a 1,000-op batch read as one change (B6)', () => {
        const ops = Array.from({ length: 20 }, (_, i) => op({ op: 'update', id: 'p' + i, name: 'P' + i,
            before: { properties: { gasRate: 1 } }, after: { properties: { gasRate: 2 } } }));
        expect(batchSentence(entry(10, ops), KINDS)).toBe('Changed 20 well pads in one change');
        const big = Array.from({ length: 1000 }, (_, i) => op({ op: 'create', id: 'n' + i, name: 'N' + i, after: record('N' + i, 'pad', point(P14_AT)) }));
        expect(batchSentence(entry(11, big), KINDS)).toBe('Added 1000 well pads in one change');
        expect(historyRows([entry(11, big)], KINDS)).toHaveLength(1);
    });

    test('a pad moved with the line ends it carries reads as the pad moved; a split reads as a split', () => {
        const pad = op({ op: 'update', id: 'p14', name: 'P14', version: 2, before: { geometry: point(P14_AT) }, after: { geometry: point(P14_NORTH) } });
        const line = op({ op: 'update', id: 'l', name: 'L-SWD', kind: 'pipe', before: { geometry: { type: 'LineString', coordinates: [[0, 0], P14_AT] } },
            after: { geometry: { type: 'LineString', coordinates: [[0, 0], P14_NORTH] } } });
        expect(batchSentence(entry(12, [pad, line]), KINDS)).toBe('Moved P14 about 40 m north');
        // A line not ending on the pad is a change of its own.
        const other = op({ op: 'update', id: 'l2', name: 'L-2', kind: 'pipe', before: { geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } },
            after: { geometry: { type: 'LineString', coordinates: [[0, 0], [1, 2]] } } });
        expect(batchSentence(entry(12, [pad, other]), KINDS)).toBe('Changed 2 items in one change');
        const created = op({ op: 'create', id: 'l3', name: 'L-2 2', kind: 'pipe', after: record('L-2 2', 'pipe', { type: 'LineString', coordinates: [[1, 1], [2, 2]] }) });
        const tap = op({ op: 'update', id: 't', name: 'PT-1', kind: 'tap', before: { geometry: point([1, 1]), attachment: { lineId: 'l2', distanceM: 5 } },
            after: { geometry: point([1.5, 1.5]), attachment: { lineId: 'l3', distanceM: 2 } } });
        expect(batchSentence(entry(13, [other, created, tap]), KINDS)).toBe('Split L-2');
        expect(batchSentence(entry(14, [other, tap]), KINDS)).toBe('Reshaped L-2');
        expect(batchSentence(entry(14, [other, { ...tap, before: { ...tap.before, attachment: { lineId: 'x', distanceM: 5 } },
            after: { ...tap.after, attachment: { lineId: 'x', distanceM: 2 } } }]), KINDS)).toBe('Changed 2 items in one change');
    });

    test('20 pads moved in one batch read as one change, not as the first pad\'s move (B6)', () => {
        const ops = Array.from({ length: 20 }, (_, i) => op({ op: 'update', id: 'p' + i, name: 'P' + i,
            before: { geometry: point([-103.8 + i * 0.01, 32.2]) }, after: { geometry: point([-103.8 + i * 0.01, 32.21]) } }));
        expect(batchSentence(entry(18, ops), KINDS)).toBe('Changed 20 well pads in one change');
    });

    test('an empty batch has a plain sentence; a batch with items and a kind setup names both (B8)', () => {
        expect(batchSentence(entry(19, []), KINDS)).toBe('Saved a change with nothing in it');
        const setup: HistoryOp = { op: 'update', entity: 'kindSetup', id: 'pad', name: null, kind: 'pad', version: 3, before: {}, after: {} };
        expect(batchSentence(entry(20, [setup, { ...setup, id: 'pipe', kind: 'pipe' }]), KINDS)).toBe('Changed 2 kind setups in one change');
        expect(batchSentence(entry(21, [op({ op: 'create', id: 'p40', name: 'P40', after: record('P40', 'pad', point(P14_AT)) }), setup]), KINDS))
            .toBe('Added well pad P40, and changed the well pad kind setup');
    });

    test('a kind setup is worded with its kind (B8); an old row with no values still says what (B7)', () => {
        const setup = entry(15, [{ op: 'update', entity: 'kindSetup', id: 'pad', name: null, kind: 'pad', version: 3, before: { setup: {} }, after: { setup: { a: 1 } } }]);
        expect(batchSentence(setup, KINDS)).toBe('Changed the well pad kind setup');
        expect(batchSentence(entry(16, [op({ op: 'update', id: 'p14', name: 'P14' })]), KINDS)).toBe('Changed P14');
        expect(batchSentence(entry(17, [op({ op: 'create', id: 'p40', name: 'P40' })]), KINDS)).toBe('Added well pad P40');
    });

    test('kind words: lower case, the kind id when unknown, plurals', () => {
        expect(kindWords(KINDS, 'pad')).toBe('well pad');
        expect(kindWords([{ ...PAD, name: 'CTB site' }], 'pad')).toBe('CTB site');
        expect(kindWords(KINDS, 'nope')).toBe('nope');
        expect(plural('battery')).toBe('batteries');
        expect(plural('box')).toBe('boxes');
        expect(plural('well pad')).toBe('well pads');
    });
});

describe('who and when (B2)', () => {
    test('the initial, and the time "10:42" today, else "Nov 7, 10:42"', () => {
        expect(initialOf('mapeditor')).toBe('M');
        expect(initialOf('')).toBe('?');
        const now = new Date(2026, 10, 9, 15, 0);
        expect(whenText(new Date(2026, 10, 9, 10, 42).toISOString(), now)).toBe('10:42');
        expect(whenText(new Date(2026, 10, 7, 10, 42).toISOString(), now)).toBe('Nov 7, 10:42');
        expect(whenText(new Date(2025, 10, 7, 9, 5).toISOString(), now)).toBe('Nov 7 2025, 09:05');
        expect(whenText('nope', now)).toBe('');
    });

    test('rows newest first, one per batch, each with who, what, when and Revert or why not', () => {
        const rows = historyRows([move(2, 3, P14_NORTH, P14_AT, 'mapoperator'), move(1, 2, P14_AT, P14_NORTH)], KINDS, '', new Date(2026, 10, 9, 23, 0));
        expect(rows.map((r) => [r.seq, r.actor, r.initial, r.blocked])).toEqual([[2, 'mapoperator', 'M', ''], [1, 'mapeditor', 'M', '']]);
        expect(rows[1].sentence).toBe('Moved P14 about 40 m north');
    });
});

describe('expand: the values before and after (B3, B7)', () => {
    test('a move: latitude and longitude before and after', () => {
        const [first] = expandOps(move(1, 2, P14_AT, P14_NORTH), { kinds: KINDS });
        expect(first.title).toBe('P14 (well pad) - changed');
        expect(first.fields).toEqual([{ label: 'Location', before: '32.229700, -103.868900', after: '32.230060, -103.868900' }]);
    });

    test('a line as its points and length; an area around; a field by its label; an added item', () => {
        expect(geometryWords({ type: 'LineString', coordinates: [[-103.52, 31.92], [-103.505, 31.9205], [-103.490423, 31.926]] }, false))
            .toBe('3 points, 2.9 km');
        expect(geometryWords({ type: 'LineString', coordinates: [[0, 0], [0, 0.001], [0.001, 0.001]] }, true)).toMatch(/^3 points, \d+ m around$/);
        const [prop] = expandOps(entry(5, [op({ op: 'update', id: 'p14', name: 'P14', before: { properties: { gasRate: 1 } },
            after: { properties: { gasRate: 2 } } })]), { kinds: KINDS });
        expect(prop.fields).toEqual([{ label: 'Gas rate', before: '1', after: '2' }]);
        const [added] = expandOps(entry(3, [op({ op: 'create', id: 'p40', name: 'P40', after: record('P40', 'pad', point(P14_AT), { assetId: 'a1' }) })]),
            { kinds: KINDS, assetName: (id) => (id === 'a1' ? 'Mesa/P40' : id) });
        expect(added.title).toBe('P40 (well pad) - added');
        expect(added.fields).toEqual([
            { label: 'Kind', before: 'Not on the map', after: 'Well pad' },
            { label: 'Name', before: 'Not on the map', after: 'P40' },
            { label: 'Location', before: 'Not on the map', after: '32.229700, -103.868900' },
            { label: 'Asset link', before: 'Not on the map', after: 'Mesa/P40' }
        ]);
    });

    test('an old row says the values were not kept; a kind setup says it changes from Kinds', () => {
        const [old] = expandOps(entry(16, [op({ op: 'update', id: 'p14', name: 'P14' })]));
        expect(old.fields).toEqual([]);
        expect(old.note).toMatch(/not kept/);
        const [setup] = expandOps(entry(15, [{ op: 'update', entity: 'kindSetup', id: 'pad', name: null, kind: 'pad', version: 3, before: {}, after: {} }]),
            { kinds: KINDS });
        expect(setup.title).toBe('The well pad kind setup');
        expect(setup.note).toBe(KIND_SETUP_TEXT);
    });
});

describe('Revert: the batch, and when it is not offered (B4, B6, B7, B8)', () => {
    test('a move reverts to an update sending the old place at the row\'s version', () => {
        expect(revertBatch(move(1, 2, P14_AT, P14_NORTH), 'r1')).toEqual({
            batchId: 'r1', ops: [{ op: 'update', entity: 'item', id: 'p14', baseVersion: 2, data: { geometry: point(P14_AT) } }]
        });
    });

    test('a create is deleted, a delete created again from before (record fields only), at the row\'s versions', () => {
        const before = record('L-TEST', 'pipe', { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, { version: 3 });
        const batch = revertBatch(entry(4, [
            op({ op: 'delete', id: 'l', name: 'L-TEST', kind: 'pipe', version: 4, before }),
            op({ op: 'create', id: 'p40', name: 'P40', version: 1, after: record('P40', 'pad', point(P14_AT)) })
        ]), 'r2');
        expect(batch).toEqual({ batchId: 'r2', ops: [
            { op: 'create', entity: 'item', id: 'l', baseVersion: 4, data: {
                kind: 'pipe', name: 'L-TEST', geometry: before.geometry, properties: {}, assetId: null, overrides: {}, ends: null, attachment: null
            } },
            { op: 'delete', entity: 'item', id: 'p40', baseVersion: 1 }
        ] });
    });

    test('a 1,000-op batch reverts as one batch', () => {
        const big = Array.from({ length: 1000 }, (_, i) => op({ op: 'create', id: 'n' + i, name: 'N' + i, after: record('N' + i, 'pad', point(P14_AT)) }));
        const batch = revertBatch(entry(11, big), 'r3');
        expect(batch && batch.ops).toHaveLength(1000);
    });

    test('no Revert for an old row (null values) or a kind setup, the reason in words', () => {
        const old = entry(16, [op({ op: 'update', id: 'p14', name: 'P14' })]);
        expect(revertBlocked(old)).toBe(NOT_KEPT_TEXT);
        expect(revertBatch(old, 'x')).toBeNull();
        const setup = entry(15, [{ op: 'update', entity: 'kindSetup', id: 'pad', name: null, kind: 'pad', version: 3, before: {}, after: {} }]);
        expect(revertBlocked(setup)).toBe(KIND_SETUP_TEXT);
        expect(revertBatch(setup, 'x')).toBeNull();
        expect(revertBlocked(move(1, 2, P14_AT, P14_NORTH))).toBe('');
    });

    test('a revert reads "Reverted ..." over the row it reverses, and its undo step names it; a revert of a revert too', () => {
        const first = move(1, 2, P14_AT, P14_NORTH);
        const reverted = move(2, 3, P14_NORTH, P14_AT, 'mapoperator');
        expect(revertedOf(reverted, [reverted, first])).toBe(first);
        expect(rowSentence(reverted, [reverted, first], KINDS)).toBe('Reverted "Moved P14 about 40 m north"');
        // A move back made by hand later, with a change between, is not a revert.
        expect(revertedOf(move(5, 6, P14_NORTH, P14_AT), [first])).toBeNull();
        const again = move(3, 4, P14_AT, P14_NORTH);
        expect(rowSentence(again, [again, reverted, first], KINDS)).toBe('Reverted "Moved P14 about 40 m south"');
        expect(revertLabel('Moved P14 about 40 m north')).toBe('revert "Moved P14 about 40 m north"');
    });
});

describe('the pages (B1, B2, B9)', () => {
    const page = (seqs: number[], more: boolean, unread = 0): HistoryPage => ({
        entries: seqs.map((s) => move(s, s + 1, P14_AT, P14_NORTH)), more, nextBefore: seqs.length > 0 ? Math.min(...seqs) : null, unread
    });
    const range = (from: number, to: number): number[] => Array.from({ length: from - to + 1 }, (_, i) => from - i);

    test('60 batches: the first page 50 and Show older; the next 10 and Show older gone', () => {
        let s = mergeFirstPage({ ...HISTORY_EMPTY, loading: 'first' }, page(range(60, 11), true));
        expect(s.loaded).toBe(true);
        expect(s.entries).toHaveLength(50);
        expect(canShowOlder(s)).toBe(true);
        expect(s.nextBefore).toBe(11);
        s = mergeOlderPage(s, page(range(10, 1), false));
        expect(s.entries.map((e) => e.seq)).toEqual(range(60, 1));
        expect(canShowOlder(s)).toBe(false);
    });

    test('the first page again after a change: merged by seq, the older pages kept', () => {
        let s = mergeFirstPage(HISTORY_EMPTY, page(range(60, 11), true));
        s = mergeOlderPage(s, page(range(10, 1), false));
        s = mergeFirstPage(s, page(range(61, 12), true));
        expect(s.entries.map((e) => e.seq)).toEqual(range(61, 1));
        expect(canShowOlder(s)).toBe(false);
    });

    test('a first page that does not reach the loaded rows replaces them, so no gap shows', () => {
        let s = mergeFirstPage(HISTORY_EMPTY, page(range(60, 11), true));
        s = mergeFirstPage(s, page(range(200, 151), true));
        expect(s.entries.map((e) => e.seq)).toEqual(range(200, 151));
        expect(s.nextBefore).toBe(151);
    });

    test('a first page closed early by the 1,000-op cap, its oldest the loaded newest\'s next, joins the rows', () => {
        let s = mergeFirstPage(HISTORY_EMPTY, page(range(60, 11), true));
        s = mergeFirstPage(s, page([61], true));
        expect(s.entries.map((e) => e.seq)).toEqual(range(61, 11));
        expect(s.nextBefore).toBe(11);
    });

    test('a failed page keeps the rows and says so; the next answer clears it', () => {
        let s = mergeFirstPage(HISTORY_EMPTY, page(range(60, 11), true));
        s = failRead(s, 'older', readFailedText('older', 'Map Studio is busy.'));
        expect(s.entries).toHaveLength(50);
        expect(s.error).toBe('Older changes could not be read: Map Studio is busy.');
        s = mergeOlderPage(s, page(range(10, 1), false));
        expect(s.error).toBe('');
        expect(readFailedText('first', 'Recent changes need an editing role. Ask for a Map Studio editing role.'))
            .toBe('Recent changes could not be read: Recent changes need an editing role. Ask for a Map Studio editing role.');
    });
});

describe('the panel (B1, B3, B7, B10)', () => {
    const base = {
        header: React.createElement('header', null, 'Recent changes'), expand: (e: HistoryEntry) => expandOps(e, { kinds: KINDS }), busy: '', paused: false,
        onUndo: () => undefined, onRevert: () => undefined, onOlder: () => undefined, onRetry: () => undefined
    };

    test('the note box names the next undo step with Undo; empty it says nothing to undo yet', () => {
        expect(nextUndoText('edit 3 pads')).toBe('Next undo is one step: Undo: edit 3 pads');
        expect(nextUndoText('')).toBe(NOTHING_TO_UNDO_YET);
        const html = renderToStaticMarkup(React.createElement(HistoryPanel, { ...base, history: { ...HISTORY_EMPTY, loaded: true }, rows: [], lastStep: "edit 3 pads", undoLabel: "Undo: edit 3 pads" }));
        expect(html).toContain('Next undo is one step: Undo: edit 3 pads');
        expect(html).toContain('No changes saved yet.');
        expect(html).toContain(REVERT_FOOTER.replace("'", '&#x27;'));
        expect(html).not.toMatch(/mapstudio-history-undo"[^>]*disabled/);
        expect(html).not.toContain('\u2014');
    });

    test('Undo is disabled with the toolbar\'s reason while paused or busy', () => {
        const paused = renderToStaticMarkup(React.createElement(HistoryPanel, { ...base, paused: true, history: HISTORY_EMPTY, rows: [], lastStep: "edit P14", undoLabel: "Undo: edit P14" }));
        expect(paused).toMatch(/disabled="" title="Paused - the map store is unreachable"/);
        const busy = renderToStaticMarkup(React.createElement(HistoryPanel, { ...base, busy: "Saving...", history: HISTORY_EMPTY, rows: [], lastStep: "edit P14", undoLabel: "" }));
        expect(busy).toMatch(/disabled="" title="Saving..."/);
    });

    test('rows: who, what, when, Revert or the reason; rows collapsed with aria-expanded; Show older', () => {
        const entries = [move(2, 3, P14_NORTH, P14_AT, 'mapoperator'), entry(1, [op({ op: 'update', id: 'p14', name: 'P14' })])];
        const history = { ...HISTORY_EMPTY, loaded: true, entries, more: true, nextBefore: 1 };
        const html = renderToStaticMarkup(React.createElement(HistoryPanel, { ...base, history: history, rows: historyRows(entries, KINDS), lastStep: "", undoLabel: "" }));
        expect(html).toContain('data-rows="2"');
        expect(html).toContain('data-seq="2"');
        expect(html).toContain('aria-expanded="false"');
        expect((html.match(/mapstudio-history-revert/g) || []).length).toBe(1);
        expect(html).toContain(NOT_KEPT_TEXT);
        expect(html).toContain('mapoperator - ');
        expect(html).toContain('mapstudio-history-older');
        expect(html).toContain('Nothing to undo yet');
    });

    test('a failed first read says so with Try again', () => {
        const history = failRead(HISTORY_EMPTY, 'first', readFailedText('first', 'busy'));
        const html = renderToStaticMarkup(React.createElement(HistoryPanel, { ...base, history: history, rows: [], lastStep: "", undoLabel: "" }));
        expect(html).toContain('Recent changes could not be read: busy.');
        expect(html).toContain('mapstudio-history-retry');
        expect(html).toContain('data-error="first"');
    });
});
