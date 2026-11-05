import { CONNECTED } from '../connection';
import { lineCreateBatch, SAVE_IDLE } from '../save';
import { STORE_UNKNOWN } from '../storeState';
import { LocalReasons, STORAGE_WARNING, UnsavedEntry, reasonFromError, waitingText } from '../unsaved';
import {
    ProblemFacts, chipProblem, editProblems, editsWait, isEditor, loadFailureText, storeProblem, viewProblems
} from '../problems';

const AT = new Date(2026, 10, 5, 14, 2, 30).getTime();
const LOST = { lost: true, frozen: true, valuesAt: AT };
const SETUP = 'The Map Studio setup of project mapstudio-dev cannot be read: refreshIntervalSeconds must be a whole number from 1 to 3600, not "ten"';
const DOWN = 'The map store is unavailable (test).';
const BUSY = 'Map Studio is busy with other map requests; nothing was saved. Try again in a moment.';
const READ_ONLY = 'This Gateway is the standby of a redundant pair; saving is off here.';
const CONFLICT_MESSAGE = 'P31 was changed by mapoperator at 14:02 UTC since you loaded it. Nothing in this save was written.';

/** A healthy editor's map: nothing to say. */
function facts(over: Partial<ProblemFacts> = {}): ProblemFacts {
    return {
        connection: CONNECTED,
        load: { state: 'loaded', message: '' },
        store: { status: 'ready', reason: '' },
        level: 'full',
        save: SAVE_IDLE,
        unsaved: [],
        sending: [],
        storageWarning: '',
        ...over
    };
}

function entry(n: number, over: Partial<UnsavedEntry> = {}): UnsavedEntry {
    const batch = lineCreateBatch('item-' + n, 'batch-' + n, 'line', 'Line ' + n, [[n, 0], [n, 1]], null);
    return { batchId: batch.batchId, batch, queuedAt: '2026-11-05T10:00:00Z', state: 'unsent', ...over };
}

const TIMEOUT = { code: LocalReasons.TIMEOUT, message: 'No answer from the Gateway within 15 s.' };
const conflict = reasonFromError({
    code: 'conflict', message: CONFLICT_MESSAGE,
    conflicts: [{ index: 0, entity: 'item', id: 'item-1', baseVersion: 1, current: null, changedBy: 'mapoperator', changedAt: null }]
});

describe('the problems in words (epic 4 entry 24)', () => {
    test('a healthy map says nothing in either place, and a save in flight is no problem', () => {
        expect(editProblems(facts())).toEqual([]);
        expect(viewProblems(facts())).toEqual([]);
        expect(chipProblem(facts(), false)).toBeNull();
        expect(chipProblem(facts(), true)).toBeNull();
        // Queued before it is sent, and being sent with no reason yet: the header says Saving..., nothing else.
        const saving = facts({ save: { state: 'saving', itemId: 'item-1' }, unsaved: [entry(1)], sending: ['batch-1'] });
        expect(editsWait(saving.unsaved, saving.sending)).toBe(false);
        expect(editProblems(saving)).toEqual([]);
        expect(viewProblems(saving)).toEqual([]);
        expect(editProblems(facts({ save: { state: 'saved', itemId: 'item-1', version: 1 } }))).toEqual([]);
    });

    test('the store unreachable: the same words while it fails and while each 15 s retry loads, so nothing blinks', () => {
        const failed = facts({
            level: null, load: { state: 'failed', message: 'store-unreachable: ' + DOWN }, store: { status: 'unavailable', reason: DOWN }
        });
        const retrying = { ...failed, load: { state: 'loading' as const, message: '' } };
        expect(storeProblem(failed)).toEqual({ code: 'store', text: 'Map store: ' + DOWN, detail: 'Map store: ' + DOWN });
        expect(storeProblem(retrying)).toEqual(storeProblem(failed));
        expect(editProblems(retrying).map((p) => p.code)).toEqual(['store']);
        expect(chipProblem(retrying, false)).toEqual(storeProblem(failed));
        // The busy answer to a load leaves the store as it was: a problem while it is the last answer.
        const busy = facts({ load: { state: 'failed', message: 'store-unreachable: ' + BUSY } });
        expect(storeProblem(busy)!.text).toBe('Map store: ' + BUSY);
        expect(storeProblem({ ...busy, load: { state: 'loading', message: '' } })).toBeNull();
    });

    test('a setup that cannot be read: its reason in the row and on the chip, the code kept out of the words', () => {
        expect(loadFailureText('store-unreachable: ' + SETUP)).toBe('Map store: ' + SETUP);
        expect(loadFailureText('A sentence: with a colon')).toBe('Map store: A sentence: with a colon');
        // A fresh page whose first load fails: the level is unknown, so it is View mode for anyone, and the chip says why.
        const setup = facts({ level: null, load: { state: 'failed', message: 'store-unreachable: ' + SETUP }, store: STORE_UNKNOWN });
        expect(chipProblem(setup, false)).toEqual({ code: 'store', text: 'Map store: ' + SETUP, detail: 'Map store: ' + SETUP });
        expect(editProblems(setup).map((p) => p.text)).toEqual(['Map store: ' + SETUP]);
    });

    test('edits waiting: "2 edits not saved" with the reason on the row, the same words on an editor\'s chip', () => {
        const two = facts({ unsaved: [entry(1, { reason: TIMEOUT }), entry(2, { reason: TIMEOUT })], sending: ['batch-2'] });
        expect(editProblems(two)).toEqual([{ code: 'edits', text: 'Store unreachable - 2 edits not saved', detail: 'Store unreachable - 2 edits not saved' }]);
        expect(chipProblem(two, false)!.text).toBe('Store unreachable - 2 edits not saved');
        // An entry no longer being sent waits too, with no reason yet (queued while the level was unknown).
        expect(editProblems(facts({ unsaved: [entry(1)] }))[0].text).toBe('1 edit not saved');
        // A refused edit names the reason in an entry's words; the oldest reason is the one said.
        const refused = facts({ unsaved: [entry(1), entry(2, { state: 'refused', reason: conflict })], sending: ['batch-1'] });
        expect(editProblems(refused)[0].text).toBe("2 edits not saved - conflict with mapoperator's change. " + CONFLICT_MESSAGE);
        const busy = reasonFromError({ code: 'store-unreachable', message: BUSY });
        expect(waitingText([entry(1, { reason: busy })], 'full')).toBe('1 edit not saved - Map Studio is busy');
        // The save's own words stand only when its entry has gone (a discard): the waiting edits say it otherwise.
        const both = { ...refused, save: { state: 'refused' as const, itemId: 'item-2', code: 'conflict', message: CONFLICT_MESSAGE } };
        expect(editProblems(both).map((p) => p.code)).toEqual(['edits']);
        const discarded = { ...both, unsaved: [], sending: [] };
        expect(editProblems(discarded)).toEqual([{ code: 'save', text: 'Not saved - ' + CONFLICT_MESSAGE, detail: 'Not saved - ' + CONFLICT_MESSAGE }]);
    });

    test('the chip\'s order: no connection, the store or the setup, the edits, a read-only store, the storage warning', () => {
        const all = facts({
            connection: LOST,
            load: { state: 'failed', message: 'store-unreachable: ' + DOWN },
            store: { status: 'unavailable', reason: DOWN },
            unsaved: [entry(1, { reason: TIMEOUT })],
            storageWarning: STORAGE_WARNING
        });
        expect(viewProblems(all).map((p) => p.code)).toEqual(['connection', 'store', 'edits', 'storage']);
        expect(chipProblem(all, false)).toEqual({
            code: 'connection', text: 'No connection - values from 14:02', detail: expect.stringContaining('The Gateway cannot be reached')
        });
        const loaded = { ...all, load: { state: 'loaded' as const, message: '' }, store: { status: 'read-only' as const, reason: READ_ONLY } };
        expect(viewProblems(loaded).map((p) => p.code)).toEqual(['connection', 'edits', 'read-only', 'storage']);
        const back = { ...loaded, connection: CONNECTED };
        expect(chipProblem(back, false)!.code).toBe('edits');
        expect(chipProblem({ ...back, unsaved: [] }, false)).toEqual({
            code: 'read-only', text: 'Map store: read only. ' + READ_ONLY, detail: 'Map store: read only. ' + READ_ONLY
        });
        expect(chipProblem({ ...back, unsaved: [], store: { status: 'ready', reason: '' } }, false)!.text).toBe(STORAGE_WARNING);
        // The row in Edit mode holds every one but the connection, which keeps its chip under the toolbar there.
        expect(editProblems(loaded).map((p) => p.code)).toEqual(['edits', 'read-only', 'storage']);
        expect(chipProblem(loaded, true)!.code).toBe('connection');
        expect(chipProblem(back, true)).toBeNull();
    });

    test('a viewer sees only what concerns the map: the connection and the store, never an editor\'s edits', () => {
        expect(isEditor('full')).toBe(true);
        expect(isEditor('phone')).toBe(true);
        expect(isEditor('none')).toBe(false);
        expect(isEditor(null)).toBe(false);
        const viewer = facts({
            level: 'none',
            store: { status: 'read-only', reason: READ_ONLY },
            unsaved: [entry(1, { reason: TIMEOUT })],
            save: { state: 'refused', itemId: 'item-1', code: 'role', message: 'No role.' },
            storageWarning: STORAGE_WARNING
        });
        expect(viewProblems(viewer)).toEqual([]);
        expect(viewProblems({ ...viewer, connection: LOST }).map((p) => p.code)).toEqual(['connection']);
        expect(viewProblems({ ...viewer, load: { state: 'failed', message: 'store-unreachable: ' + DOWN } }).map((p) => p.code)).toEqual(['store']);
        // A phone editor's map in View mode (phone widths keep it) is an editor's.
        expect(chipProblem({ ...viewer, level: 'phone' }, false)!.code).toBe('edits');
    });
});
