/**
 * Where the map says what is wrong (epic 4 entry 24; owner, 2026-11-05: "yes to both", then "a" after a mock of both
 * places). The spike's status box over the map's bottom edge is gone, its click echo and its success words with it; its
 * problems are said in words in two places:
 *
 * - **Edit mode**: the save status row in the list panel's header, every problem at once, each on its own line, in the
 *   order below (the connection keeps its chip under the toolbar); the edits waiting open the list of them under the row.
 * - **View mode**: the top-centre chip that says "No connection - values from 14:02", one problem at a time, the worst
 *   first: no connection, then the map store unreachable or a setup that cannot be read, then edits waiting (a refused or
 *   unsent save when none waits), then a read-only store, then a browser that cannot keep unsaved edits. A viewer sees
 *   only what concerns the map (the connection and the store); the edits, the read-only store and the storage warning
 *   are an editor's (level `phone` or `full`).
 *
 * Pure, unit tested in node; the component reads its delegate's state into `ProblemFacts`.
 */

import { ConnectionState, connectionChipText, connectionDetailText } from './connection';
import { EditLevel } from './contract';
import { SaveState, saveStatusWords } from './save';
import { StoreState, storeStatusText } from './storeState';
import { UnsavedEntry, waitingText } from './unsaved';

/** What a problem is about: the chip's and the row's `data-problem`. */
export type ProblemCode = 'connection' | 'store' | 'edits' | 'save' | 'read-only' | 'storage';

export interface Problem {
    code: ProblemCode;
    /** The words shown. */
    text: string;
    /** The long form, the chip's title; the words themselves where there is none. */
    detail: string;
}

/** The delegate's state the problems are read from. */
export interface ProblemFacts {
    connection: ConnectionState;
    load: { state: 'loading' | 'loaded' | 'failed'; message: string };
    store: StoreState;
    /** The level map.load reported, or the last one it reported while a failed load leaves it unknown; null before any. */
    level: EditLevel | null;
    save: SaveState;
    unsaved: UnsavedEntry[];
    /** The queued batches this tab waits on a reply for. */
    sending: string[];
    storageWarning: string;
}

function problem(code: ProblemCode, text: string, detail: string = text): Problem {
    return { code, text, detail };
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
 * The map store unreachable, or a setup that cannot be read (the Gateway answers both `store-unreachable`, the setup's
 * reason in its sentence), or the busy answer to a load. An unavailable store stays a problem while each 15 s retry
 * loads, in the same words, so nothing blinks; the busy answer is a problem only while it is the last answer.
 */
export function storeProblem(facts: ProblemFacts): Problem | null {
    if (facts.store.status === 'unavailable') {
        return problem('store', storeStatusText(facts.store));
    }
    if (facts.load.state === 'failed') {
        return problem('store', loadFailureText(facts.load.message));
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
 * The edits waiting ("Store unreachable - 2 edits not saved", "1 edit not saved - conflict with ..."), or with none waiting
 * a save refused or unsent whose entry has gone (a discard), in the save status's words ("Not saved - ...").
 */
export function editsProblem(facts: ProblemFacts): Problem | null {
    if (editsWait(facts.unsaved, facts.sending)) {
        return problem('edits', waitingText(facts.unsaved, facts.level));
    }
    if (facts.save.state === 'refused' || facts.save.state === 'unsent') {
        return problem('save', saveStatusWords(facts.save));
    }
    return null;
}

function readOnlyProblem(facts: ProblemFacts): Problem | null {
    return facts.store.status === 'read-only' ? problem('read-only', storeStatusText(facts.store)) : null;
}

function storageProblem(facts: ProblemFacts): Problem | null {
    return facts.storageWarning !== '' ? problem('storage', facts.storageWarning) : null;
}

/** No connection, or reconnected and reloading: the chip's words as before, the long form its title. */
export function connectionProblem(connection: ConnectionState): Problem | null {
    const text = connectionChipText(connection);
    return text !== '' ? problem('connection', text, connectionDetailText(connection)) : null;
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
