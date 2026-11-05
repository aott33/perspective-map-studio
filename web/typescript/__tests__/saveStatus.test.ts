// The list header's save status row and the edits waiting under it (epic 4 entry 24, owner 2026-11-05): every Edit-mode
// problem in words on the row, the edits a button that opens them, each with Try again (with a reason) and Discard, then Hide.
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProblemFacts, editProblems } from '../problems';
import { CONNECTED } from '../connection';
import { SAVE_IDLE, SaveState, lineCreateBatch } from '../save';
import { LocalReasons, UnsavedEntry, reasonFromError } from '../unsaved';
import { ProblemRow, WaitingList } from '../studio/SaveStatus';

const noop = (): void => undefined;
const DOWN = 'The map store is unavailable (test).';
const CONFLICT_MESSAGE = 'P42 moved on was changed by mapeditor at 14:02 UTC since you loaded it. Nothing in this save was written.';

function entry(n: number, over: Partial<UnsavedEntry> = {}): UnsavedEntry {
    const batch = lineCreateBatch('item-' + n, 'batch-' + n, 'line', 'Line ' + n, [[n, 0], [n, 1]], null);
    return { batchId: batch.batchId, batch, queuedAt: '2026-11-05T10:00:00Z', state: 'unsent', ...over };
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
        expect(html).toContain('class="mapstudio-panel-save mapstudio-panel-save--row mapstudio-panel-save--idle"');
        expect(html).toContain('role="status"');
        expect(html).toContain('data-problems="store edits"');
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
        // Its entry discarded, the save's own words stay until the next save.
        expect(row(facts({ save }))).toContain('<div class="mapstudio-panel-problem mapstudio-panel-problem--save" data-problem="save">Not saved - '
            + CONFLICT_MESSAGE + '</div>');
    });
});

describe('the edits waiting under the row (entry 24)', () => {
    test('each in words, Try again once it has a reason, Discard off while it is being sent, then Hide', () => {
        const refused = reasonFromError({ code: 'role', message: 'You do not have a role that lets you change the map.' });
        const html = renderToStaticMarkup(React.createElement(WaitingList, {
            id: 'waiting', entries: [entry(1, { reason: TIMEOUT }), entry(2, { state: 'refused', reason: refused }), entry(3)], level: 'full',
            sending: ['batch-1'], onRetry: noop, onDiscard: noop, onHide: noop
        }));
        expect(html).toContain('id="waiting" class="mapstudio-unsaved" role="group" aria-label="Edits not saved" data-unsaved-count="3"');
        expect(html.match(/<li /g)).toHaveLength(3);
        expect(html).toContain('data-batch-id="batch-1" data-unsaved-state="unsent" data-code="timeout"');
        expect(html).toContain('<span class="mapstudio-unsaved-text">Not saved - store unreachable (no answer from the Gateway)</span>');
        expect(html).toContain('data-batch-id="batch-2" data-unsaved-state="refused" data-code="role"');
        expect(html).toContain('Not saved - You do not have a role that lets you change the map.');
        expect(html).toContain('data-batch-id="batch-3" data-unsaved-state="unsent" data-code=""');
        expect(html).toContain('Not saved yet - saving ...');
        // Try again on the two with a reason; Discard on every one, off for the batch being sent.
        expect(html.match(/mapstudio-unsaved-retry/g)).toHaveLength(2);
        expect(html.match(/mapstudio-unsaved-discard/g)).toHaveLength(3);
        expect(html).toContain('class="mapstudio-unsaved-button mapstudio-unsaved-discard" disabled="" title="Being sent; wait for the answer."');
        expect(html).toMatch(/<button type="button" class="mapstudio-unsaved-button mapstudio-unsaved-hide">Hide<\/button><\/div>$/);
    });
});
