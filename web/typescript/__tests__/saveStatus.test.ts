// The save status row and the edits waiting under it (epic 4 entry 24, owner 2026-11-05): every Edit-mode problem in words on
// the row, the edits a button that opens them, each named as Undo names its step with its reason under it, Try again (with a
// reason) and Discard, then Hide.
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EditBatch, MapItemRecord } from '../contract';
import { ProblemFacts, editProblems } from '../problems';
import { CONNECTED } from '../connection';
import { SAVE_IDLE, SaveState, lineCreateBatch, updateBatch } from '../save';
import { LocalReasons, UnsavedEntry, editLabel, reasonFromError } from '../unsaved';
import { ProblemRow, ProblemStatus, WaitingList } from '../studio/SaveStatus';

const noop = (): void => undefined;
const DOWN = 'The map store is unavailable (test).';
const CONFLICT_MESSAGE = 'P42 moved on was changed by mapeditor at 14:02 UTC since you loaded it. Nothing in this save was written.';

function entry(n: number, over: Partial<UnsavedEntry> = {}): UnsavedEntry {
    const batch = lineCreateBatch('item-' + n, 'batch-' + n, 'line', 'Gathering line', [[n, 0], [n, 1]], null);
    return { batchId: batch.batchId, batch, queuedAt: '2026-11-05T10:00:00Z', state: 'unsent', ...over };
}

function record(id: string, name: string): MapItemRecord {
    return { id, kind: 'pad', name, geometry: { type: 'Point', coordinates: [0, 0] }, properties: {}, assetId: null, overrides: {},
        ends: null, attachment: null, version: 3, deleted: false };
}

function facts(over: Partial<ProblemFacts>): ProblemFacts {
    return {
        connection: CONNECTED, load: { state: 'loaded', message: '' }, store: { status: 'ready', reason: '' }, level: 'full',
        save: SAVE_IDLE, unsaved: [], sending: [], storageWarning: '', ...over
    };
}

function row(f: ProblemFacts, open = false): string {
    return renderToStaticMarkup(React.createElement(ProblemRow, { save: f.save, problems: editProblems(f), listId: 'waiting', open, onToggle: noop }));
}

const TIMEOUT = { code: LocalReasons.TIMEOUT, message: 'No answer from the Gateway within 15 s.' };

describe('the save status row (entry 24)', () => {
    test('the store unreachable and the edits waiting, one line each, worst first; the edits a button that opens them', () => {
        const f = facts({
            level: null, load: { state: 'failed', message: 'store-unreachable: ' + DOWN }, store: { status: 'unavailable', reason: DOWN },
            unsaved: [entry(1, { reason: TIMEOUT }), entry(2, { reason: TIMEOUT })]
        });
        const html = row(f);
        // Its own class only: the save state beside the title (`.mapstudio-panel-save`) stays there with the row under it.
        expect(html).toMatch(/^<div class="mapstudio-panel-save--row" role="status" data-save-state="idle" data-code="" data-problems="store edits">/);
        expect(html.indexOf('data-problem="store"')).toBeLessThan(html.indexOf('data-problem="edits"'));
        expect(html).toContain('>Map store: ' + DOWN + '</div>');
        expect(html).toMatch(/<button type="button" class="mapstudio-panel-problem mapstudio-panel-problem--edits" data-problem="edits" aria-expanded="false" aria-controls="waiting">/);
        expect(html).toContain('<span class="mapstudio-panel-problem-text">Store unreachable - 2 edits not saved</span>');
        expect(row(f, true)).toContain('mapstudio-panel-problem--open" data-problem="edits" aria-expanded="true"');
    });

    test('a refused undo: the save state and its code on the row, the waiting reverse naming who changed the item', () => {
        const save: SaveState = { state: 'refused', itemId: 'item-1', code: 'conflict', message: CONFLICT_MESSAGE };
        const reason = reasonFromError({ code: 'conflict', message: CONFLICT_MESSAGE });
        const html = row(facts({ save, unsaved: [entry(1, { state: 'refused', reason })] }));
        expect(html).toContain('data-save-state="refused" data-code="conflict" data-problems="edits"');
        expect(html).toContain("1 edit not saved - conflict with another editor&#x27;s change. " + CONFLICT_MESSAGE);
        // Its entry discarded, nothing is said: no stale "Not saved".
        expect(editProblems(facts({ save }))).toEqual([]);
        expect(renderToStaticMarkup(React.createElement(ProblemStatus, {
            save, problems: editProblems(facts({ save })), unsaved: [], records: [], level: 'full', sending: [], onRetry: noop, onDiscard: noop
        }))).toBe('');
    });
});

describe('the edits waiting under the row (entry 24)', () => {
    test('each named as Undo names its step, its reason under it, Try again once it has a reason, Discard off while it is sent, then Hide', () => {
        const refused = reasonFromError({ code: 'role', message: 'You do not have a role that lets you change the map.' });
        const rename: UnsavedEntry = { batchId: 'batch-r', batch: updateBatch('p14', 'batch-r', 3, { name: 'P14 North' }),
            queuedAt: '2026-11-05T10:00:00Z', state: 'refused', reason: refused };
        const html = renderToStaticMarkup(React.createElement(WaitingList, {
            id: 'waiting', entries: [entry(1, { reason: TIMEOUT }), rename, entry(3)], records: [record('p14', 'P14')], level: 'full',
            sending: ['batch-1'], onRetry: noop, onDiscard: noop, onHide: noop
        }));
        expect(html).toContain('id="waiting" class="mapstudio-unsaved" role="group" aria-label="Edits not saved" data-unsaved-count="3"');
        expect(html.match(/<li /g)).toHaveLength(3);
        expect(html).toContain('data-batch-id="batch-1" data-unsaved-state="unsent" data-code="timeout"><span class="mapstudio-unsaved-edit">Add Gathering line</span>'
            + '<span class="mapstudio-unsaved-text">Not saved - store unreachable (no answer from the Gateway)</span>');
        expect(html).toContain('data-batch-id="batch-r" data-unsaved-state="refused" data-code="role"><span class="mapstudio-unsaved-edit">Rename P14 North</span>'
            + '<span class="mapstudio-unsaved-text">Not saved - You do not have a role that lets you change the map.</span>');
        expect(html).toContain('data-batch-id="batch-3" data-unsaved-state="unsent" data-code="">');
        expect(html).toContain('Not saved yet - saving ...');
        // Try again on the two with a reason; Discard on every one, off for the batch being sent.
        expect(html.match(/mapstudio-unsaved-retry/g)).toHaveLength(2);
        expect(html.match(/mapstudio-unsaved-discard/g)).toHaveLength(3);
        expect(html).toContain('class="mapstudio-unsaved-button mapstudio-unsaved-discard" disabled="" title="Being sent; wait for the answer."');
        // Hide names Esc, which hides the list too (epic 4 entry 25's review: each control with a key names it).
        expect(html).toMatch(/<button type="button" class="mapstudio-unsaved-button mapstudio-unsaved-hide" title="Hide \(Esc\)" aria-keyshortcuts="Escape">Hide<\/button><\/div>$/);
    });

    test('a waiting edit in Undo\'s words: add, rename, move, link, unlink, edit, delete, the name from the batch or the record', () => {
        const records = [record('p14', 'P14'), record('swd1', 'SWD1'), record('l-test', 'L-TEST')];
        const one = (op: EditBatch['ops'][number]): EditBatch => ({ batchId: 'b', ops: [op] });
        expect(editLabel(lineCreateBatch('n', 'b', 'line', 'Gathering line', [[0, 0], [1, 1]], null), records)).toBe('add Gathering line');
        expect(editLabel(updateBatch('p14', 'b', 3, { name: 'P14 North' }), records)).toBe('rename P14 North');
        expect(editLabel(updateBatch('swd1', 'b', 3, { geometry: { type: 'Point', coordinates: [1, 1] } }), records)).toBe('move SWD1');
        expect(editLabel(updateBatch('p14', 'b', 3, { assetId: 'a-14' }), records)).toBe('link P14');
        expect(editLabel(updateBatch('p14', 'b', 3, { assetId: null }), records)).toBe('unlink P14');
        expect(editLabel(updateBatch('p14', 'b', 3, { kind: 'tank' }), records)).toBe('edit P14');
        expect(editLabel(one({ op: 'delete', entity: 'item', id: 'l-test', baseVersion: 3 }), records)).toBe('delete L-TEST');
        // A line's delete with its instruments is named by the line, its first op.
        expect(editLabel({ batchId: 'b', ops: [{ op: 'delete', entity: 'item', id: 'l-test', baseVersion: 3 },
            { op: 'delete', entity: 'item', id: 'tap-1', baseVersion: 1 }] }, records)).toBe('delete L-TEST');
        // A record the map no longer holds, and a kind setup.
        expect(editLabel(updateBatch('gone', 'b', 3, { geometry: { type: 'Point', coordinates: [1, 1] } }), records)).toBe('move an item');
        expect(editLabel(one({ op: 'update', entity: 'kindSetup', id: 'pad', baseVersion: 1, data: {} }), records)).toBe('edit a kind setup');
    });
});
