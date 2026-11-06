/**
 * Where the map says what is wrong (epic 4 entry 24; owner, 2026-11-05: "yes to both", then "a" after a mock of both
 * places). The spike's status box over the map's bottom edge is gone, its click echo and its success words with it; its
 * problems are said in words in two places:
 *
 * - **Edit mode**: the save status row in the list panel's header, every problem at once, each on its own line, in the
 *   order below (the connection keeps its chip under the toolbar); the edits waiting open the list of them under the row.
 * - **View mode**: the top-centre chip that says "No connection - values from 14:02", one problem at a time, the worst
 *   first: no connection, then the map store unreachable or a setup that cannot be read, then edits waiting, then a
 *   read-only store, then a browser that cannot keep unsaved edits. A viewer sees
 *   only what concerns the map (the connection and the store); the edits, the read-only store and the storage warning
 *   are an editor's (level `phone` or `full`).
 *
 * Pure, unit tested in node; the component reads its delegate's state into `ProblemFacts`.
 */

import { ConnectionState, connectionChipText, connectionDetailText } from './connection';
import { EditLevel } from './contract';
import { SaveState } from './save';
import { StoreState, storeStatusText } from './storeState';
import { UnsavedEntry, unreachable, waitingText } from './unsaved';

/** What a problem is about: the chip's and the row's `data-problem`. */
export type ProblemCode = 'connection' | 'store' | 'edits' | 'read-only' | 'storage';

/**
 * The chip's glyph (DESIGN.md Save status, Save banner): the hourglass for no connection (its values are stale), the cloud
 * for the map store out of reach (the store unreachable, or edits waiting because it is), the warning glyph for every other
 * problem (busy, a setup that cannot be read, a refused edit, a read-only store, the storage warning).
 */
export type ProblemGlyph = 'stale' | 'cloud' | 'warning';

export interface Problem {
    code: ProblemCode;
    /** The words shown. */
    text: string;
    /** The long form, the chip's title; the words themselves where there is none. */
    detail: string;
    glyph: ProblemGlyph;
}

/** The delegate's state the problems are read from. */
/** A geometry save refused for good and the waiting changes made on top of it, dropped with it (entry 5). */
export interface ShapeRefusal {
    revision: number;
    batchId: string;
    ids: string[];
    /** "1 later change to L-SWD was not saved", or ''. */
    dropped: string;
}

export const NO_SHAPE_REFUSAL: ShapeRefusal = { revision: 0, batchId: '', ids: [], dropped: '' };

/** The words for the later changes a refused geometry save took with it: "1 later change to L-SWD was not saved". */
export function droppedText(count: number, name: string): string {
    return count + (count === 1 ? ' later change to ' : ' later changes to ') + name + (count === 1 ? ' was' : ' were') + ' not saved';
}

export interface ProblemFacts {
    connection: ConnectionState;
    load: { state: 'loading' | 'loaded' | 'failed'; message: string };
    store: StoreState;
    /** The level map.load reported, or the last one it reported while a failed load leaves it unknown; null before any. */
    level: EditLevel | null;
    /** The last save's state: the save status beside the title says Saving... from it (the row's problems never do). */
    save: SaveState;
    unsaved: UnsavedEntry[];
    /** The queued batches this tab waits on a reply for. */
    sending: string[];
    storageWarning: string;
    /** The last geometry save refused for good and the later changes it took with it (entry 5); absent before any. */
    shapeRefused?: ShapeRefusal;
}

function problem(code: ProblemCode, text: string, glyph: ProblemGlyph, detail: string = text): Problem {
    return { code, text, detail, glyph };
}

/** An editor's session: the edits, the read-only store and the storage warning concern it; a viewer's map does not show them. */
export function isEditor(level: EditLevel | null): boolean {
    return level === 'phone' || level === 'full';
}

/**
 * A failed map.load in words: "Map store: " and the Gateway's sentence, without the code the delegate keeps before it
 * (`store-unreachable: ...`, readable on the map as `data-load-message`), so it reads as the unavailable store's words do.
 */
export function loadFailureText(message: string): string {
    return 'Map store: ' + message.replace(/^[a-z][a-z0-9-]*: /, '');
}

/**
 * Whether a store-unreachable sentence is the store out of reach (the cloud) rather than the busy answer or a setup the
 * Gateway cannot read or does not have (SetupRegistry's sentences), which take the warning glyph.
 */
export function storeOutOfReach(sentence: string): boolean {
    return sentence.indexOf('Map Studio is busy') !== 0 && sentence.indexOf('The Map Studio setup of project ') !== 0
        && sentence.indexOf(' has no Map Studio setup ') < 0;
}

/**
 * The map store unreachable, or a setup that cannot be read (the Gateway answers both `store-unreachable`, the setup's
 * reason in its sentence), or the busy answer to a load. Each holds until a load succeeds: the delegate keeps the failed
 * load's words while each 15 s retry loads (and an unavailable store keeps its reason), so nothing blinks.
 */
export function storeProblem(facts: ProblemFacts): Problem | null {
    if (facts.store.status === 'unavailable') {
        return problem('store', storeStatusText(facts.store), storeOutOfReach(facts.store.reason) ? 'cloud' : 'warning');
    }
    if (facts.load.state !== 'loaded' && facts.load.message !== '') {
        const text = loadFailureText(facts.load.message);
        return problem('store', text, storeOutOfReach(text.slice('Map store: '.length)) ? 'cloud' : 'warning');
    }
    return null;
}

/**
 * Whether queued edits wait: every batch is queued before it is sent, so a save in flight is none; an entry waits once it
 * has a reason (refused, or unsent after a failure) or is no longer being sent.
 */
export function editsWait(unsaved: UnsavedEntry[], sending: string[]): boolean {
    return unsaved.some((e) => e.reason !== undefined || sending.indexOf(e.batchId) < 0);
}

/**
 * The edits waiting ("Store unreachable - 2 edits not saved", "1 edit not saved - conflict with ..."). A refused or unsent
 * save counts only while its batch waits in the queue, which is when this line says it: once its entry has gone (a
 * Discard, or saved by a replay) its state says nothing, so no stale "Not saved" stays.
 */
export function editsProblem(facts: ProblemFacts): Problem | null {
    if (editsWait(facts.unsaved, facts.sending)) {
        return problem('edits', withDropped(waitingText(facts.unsaved, facts.level), facts), unreachable(facts.unsaved) ? 'cloud' : 'warning');
    }
    return null;
}

/**
 * The waiting edits' words with the later changes a refused geometry save took with it (entry 5), while that refused edit
 * still waits in the queue: "... Nothing in this save was written, and 1 later change to L-SWD was not saved."
 */
function withDropped(text: string, facts: ProblemFacts): string {
    const refused = facts.shapeRefused;
    if (!refused || refused.dropped === '' || !facts.unsaved.some((e) => e.batchId === refused.batchId)) {
        return text;
    }
    return text.replace(/\.\s*$/, '') + ', and ' + refused.dropped + '.';
}

function readOnlyProblem(facts: ProblemFacts): Problem | null {
    return facts.store.status === 'read-only' ? problem('read-only', storeStatusText(facts.store), 'warning') : null;
}

function storageProblem(facts: ProblemFacts): Problem | null {
    return facts.storageWarning !== '' ? problem('storage', facts.storageWarning, 'warning') : null;
}

/** No connection, or reconnected and reloading: the chip's words as before, the long form its title. */
export function connectionProblem(connection: ConnectionState): Problem | null {
    const text = connectionChipText(connection);
    return text !== '' ? problem('connection', text, 'stale', connectionDetailText(connection)) : null;
}

/**
 * The save status beside the list header's title, always shown (the problems on the row under it): "Saving..." while a
 * batch is out, "Not saved" while edits wait, else "Saved".
 */
export function headerSaveWords(facts: ProblemFacts): string {
    if (facts.save.state === 'saving') {
        return 'Saving...';
    }
    return editsWait(facts.unsaved, facts.sending) ? 'Not saved' : 'Saved';
}

function present(list: Array<Problem | null>): Problem[] {
    return list.filter((p): p is Problem => p !== null);
}

/** The save status row's problems in Edit mode, worst first, every one at once (the connection is the chip's there). */
export function editProblems(facts: ProblemFacts): Problem[] {
    return present([storeProblem(facts), editsProblem(facts), readOnlyProblem(facts), storageProblem(facts)]);
}

/** The View-mode problems, worst first: the connection and the store for everyone, the rest for an editor only. */
export function viewProblems(facts: ProblemFacts): Problem[] {
    const forEveryone = [connectionProblem(facts.connection), storeProblem(facts)];
    const forEditors = isEditor(facts.level) ? [editsProblem(facts), readOnlyProblem(facts), storageProblem(facts)] : [];
    return present(forEveryone.concat(forEditors));
}

/**
 * The top-centre chip's one problem, or null: in View mode the worst of `viewProblems`; in Edit mode the connection
 * alone, under the toolbar, since the save status row says the rest.
 */
export function chipProblem(facts: ProblemFacts, editMode: boolean): Problem | null {
    if (editMode) {
        return connectionProblem(facts.connection);
    }
    const all = viewProblems(facts);
    return all.length > 0 ? all[0] : null;
}
