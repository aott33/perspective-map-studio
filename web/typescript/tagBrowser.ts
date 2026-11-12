/**
 * The tag browser's pure parts (epic 4 entry 13b; DESIGN.md Tag browser, EXPERIENCE.md Tag browser): what the card's tree shows
 * of one provider from the folders the Gateway answered (`tags.browse`, one level per folder opened), which rows the keyboard
 * moves over, what is a pick for the value being picked, and the card's words (the For line, the type column, the note under
 * the Path field, the provider it cannot browse). Nothing here sends a message or touches the page, so it is unit tested in
 * node; the card is studio/TagBrowser.tsx and the asks are the store delegate's.
 *
 * A tag path is never converted here: a pick's `{asset.path}/...` form is the Gateway's answer to `tags.resolve` (owner,
 * 2026-11-11: no TypeScript copy of `TagPaths.resolve`).
 */

import { Kind } from './adapters';
import { pathProblem } from './itemOverrides';
import { lowerKind, resolveNote } from './kindSetup';
import { TagChild, TagChildType, TagProvider } from './messages';

/**
 * The value a pick is for. Of a kind's setup: a key value by its place among the rows (from 1), the comms heartbeat, the alarm
 * source and, from entry 13c, the style rule's tag path (`rule`) and a popup view param's value (`param`). Of one item (entry
 * 13c): a Live now row's override (`override`) and the item's own style rule (`ownRule`).
 */
export interface PickTarget {
    part: 'kpi' | 'comms' | 'alarms' | 'rule' | 'param' | 'override' | 'ownRule';
    /** A key value's number among the kind's rows, stored and new, from 1. */
    index?: number;
    /** A popup param's name ('' for a new row not named yet); an override's row name, "Casing pressure". */
    name?: string;
    /** An item target: the item's name, "P14". */
    item?: string;
    /** An override of the item's Alarms row: a folder is a pick, as for a kind's Alarms. */
    folders?: boolean;
}

/** Whether the pick is for one item alone (an override row, the item's own rule): always its full path, never asked of the Gateway. */
export function isItemTarget(target: PickTarget): boolean {
    return target.part === 'override' || target.part === 'ownRule';
}

function targetOf(of: PickTarget | PickTarget['part']): PickTarget {
    return typeof of === 'string' ? { part: of } : of;
}

/** Whether a folder or a UDT instance is a pick for the value: Alarms only, a kind's or an item's override of it. */
function takesFolders(of: PickTarget | PickTarget['part']): boolean {
    const target = targetOf(of);
    return target.part === 'alarms' || (target.part === 'override' && target.folders === true);
}

/** What the Gateway said of one folder of one provider, or that it is being asked. */
export type FolderAnswer =
    | { state: 'loading' }
    | { state: 'loaded'; children: readonly TagChild[]; truncated: boolean }
    /** `code` is the Gateway's error code, or `timeout` when it did not answer in time. */
    | { state: 'failed'; code: string; message: string };

/** What `tags.resolve` said of a picked path for the preview item's asset: the path to save and what it resolves for. */
export type PickAnswer =
    | { state: 'asking' }
    | { state: 'answered'; path: string; relative: boolean; n?: number; m?: number; failing?: readonly string[]; failingMore?: number }
    /** `code` is the Gateway's error code (`invalid` for a path it refuses), or `timeout`; absent from an older caller. */
    | { state: 'failed'; message: string; code?: string };

/** Everything the Gateway answered while the card is open: the providers, the folders by `browseKey`, the picks by full path. */
export interface BrowseAnswers {
    providers: readonly TagProvider[];
    folders: Readonly<Record<string, FolderAnswer>>;
    picks: Readonly<Record<string, PickAnswer>>;
}

export const NO_BROWSE: BrowseAnswers = { providers: [], folders: {}, picks: {} };

/** The code of an ask the Gateway did not answer in time. */
export const TIMEOUT_CODE = 'timeout';

/**
 * The key one folder's answer is kept under: the provider ('' for the default one before its name is known) and the folder
 * ('' for the root), without letter case, as Ignition compares tag paths.
 */
export function browseKey(provider: string | null, folder: string): string {
    return (provider || '').toLowerCase() + '\n' + folder.toLowerCase();
}

/** A full path's provider and what follows it: `[default]Mesa/P14` is `default` and `Mesa/P14`; null for anything else. */
export function splitFullPath(path: string): { provider: string; folder: string } | null {
    const m = /^\[([^\[\]]+)\](.*)$/.exec(path);
    if (!m) {
        return null;
    }
    return { provider: m[1], folder: m[2].replace(/^\/+|\/+$/g, '') };
}

/** A row's id: its path inside the provider, without letter case. */
function idOf(folder: string): string {
    return folder.toLowerCase();
}

/** The folders from the provider's top down to `folder`, itself last: `Mesa/P14` gives `Mesa`, `Mesa/P14`. */
export function ancestors(folder: string): string[] {
    const parts = folder.split('/').filter((p) => p !== '');
    return parts.map((_, i) => parts.slice(0, i + 1).join('/'));
}

/** The asset folder the card opens at: the preview item's name and its asset's base path, split. */
export interface AssetFolder {
    /** The preview item's name, "P14". */
    name: string;
    provider: string;
    folder: string;
}

/** The preview item's asset folder, or null with no preview item or a base path that is not a full path. */
export function assetFolderOf(preview: { name: string; folder: string } | null): AssetFolder | null {
    const split = preview ? splitFullPath(preview.folder) : null;
    return preview && split ? { name: preview.name, provider: split.provider, folder: split.folder } : null;
}

/** The tree as the card holds it: one provider, the folders open in it, the row the keyboard is on and the row picked. */
export interface TreeState {
    /** The provider shown; null is the Gateway's default one before its first answer named it. */
    provider: string | null;
    /** The ids of the open folders. */
    open: readonly string[];
    /** The id of the row the keyboard is on, or null (the first row then). */
    focus: string | null;
    picked: TagChild | null;
}

/** The card as it opens: at the asset folder, opened, the keyboard on it; with none, the default provider's root. */
export function startState(asset: AssetFolder | null): TreeState {
    if (!asset) {
        return { provider: null, open: [], focus: null, picked: null };
    }
    const open = ancestors(asset.folder).map(idOf);
    return { provider: asset.provider, open, focus: open.length > 0 ? open[open.length - 1] : null, picked: null };
}

/** Another provider chosen: its root, nothing open and nothing picked. */
export function chooseProvider(state: TreeState, provider: string): TreeState {
    return sameProvider(state.provider, provider) ? state : { provider, open: [], focus: null, picked: null };
}

function sameProvider(a: string | null, b: string | null): boolean {
    return (a || '').toLowerCase() === (b || '').toLowerCase();
}

/** Whether the tree is away from the asset folder: another provider, or the asset folder not open. */
export function outsideAsset(state: TreeState, asset: AssetFolder | null): boolean {
    if (!asset) {
        return false;
    }
    return !sameProvider(state.provider, asset.provider) || ancestors(asset.folder).some((f) => state.open.indexOf(idOf(f)) < 0);
}

/** Back at the asset folder: its provider, the folder opened, the keyboard on it; the pick is kept. */
export function toAssetFolder(state: TreeState, asset: AssetFolder): TreeState {
    const own = ancestors(asset.folder).map(idOf);
    const kept = sameProvider(state.provider, asset.provider) ? state.open : [];
    return {
        provider: asset.provider, open: kept.concat(own.filter((id) => kept.indexOf(id) < 0)),
        focus: own.length > 0 ? own[own.length - 1] : null, picked: state.picked
    };
}

/**
 * The asset folder could not be opened (the Gateway does not have it, decision 8): the Gateway's words, or '' while it is
 * loading, loaded or failed for another reason.
 */
export function assetProblem(answers: BrowseAnswers, asset: AssetFolder | null): string {
    const answer = asset ? answers.folders[browseKey(asset.provider, asset.folder)] : undefined;
    return answer && answer.state === 'failed' && answer.code === 'invalid' ? answer.message : '';
}

// ---- The rows ----

/** One row of the tree in view. */
export interface TreeRow {
    /** A node's path inside the provider, without letter case; a row under a folder is that folder's id and its kind. */
    id: string;
    kind: 'node' | 'loading' | 'empty' | 'failed' | 'truncated';
    /** From 0 at the provider's top. */
    depth: number;
    /** The id of the folder it stands in, null at the top. */
    parent: string | null;
    /** A node: its path inside the provider. Any other row: the folder it stands under. */
    folder: string;
    node: TagChild | null;
    /** Whether it has a chevron: a folder, a UDT instance or type, or anything the Gateway says has children. */
    opens: boolean;
    open: boolean;
    /** The asset folder itself: tagged "Asset folder". */
    assetFolder: boolean;
    /** Inside the asset folder: the guide on its left. */
    guided: boolean;
    /** The words of a row that is not a node; the Gateway's for a failed folder. */
    words: string;
    /** A failed folder's code; '' otherwise. */
    code: string;
}

export const LOADING_WORDS = 'Loading...';
export const EMPTY_WORDS = 'No tags in this folder';
export const TRUNCATED_WORDS = 'Showing the first 1,000.';

function opensOf(node: TagChild): boolean {
    return node.hasChildren || node.type === 'folder' || node.type === 'udt-instance' || node.type === 'udt-type';
}

/** A node's path inside its provider: the full path without `[provider]`. */
export function folderOf(node: TagChild): string {
    const split = splitFullPath(node.path);
    return split ? split.folder : node.path;
}

/**
 * The rows in view, top to bottom: the provider's top level, and under each open folder its children, "Loading..." while it is
 * asked, "No tags in this folder", the Gateway's words when it failed, and "Showing the first 1,000." after a truncated one.
 * The top level's own failure is not a row (`rootProblem`: it replaces the tree).
 */
export function rowsInView(state: TreeState, answers: BrowseAnswers, asset: AssetFolder | null): TreeRow[] {
    const assetId = asset && sameProvider(state.provider, asset.provider) && assetProblem(answers, asset) === '' ? idOf(asset.folder) : null;
    const rows: TreeRow[] = [];
    const under = (folder: string, depth: number, guided: boolean): void => {
        const parent = folder === '' ? null : idOf(folder);
        const aside = (kind: TreeRow['kind'], words: string, code = ''): TreeRow => ({
            id: idOf(folder) + '\n' + kind, kind, depth, parent, folder, node: null, opens: false, open: false, assetFolder: false, guided, words, code
        });
        const answer = answers.folders[browseKey(state.provider, folder)];
        if (!answer || answer.state === 'loading') {
            rows.push(aside('loading', LOADING_WORDS));
            return;
        }
        if (answer.state === 'failed') {
            if (folder !== '') {
                rows.push(aside('failed', answer.message, answer.code));
            }
            return;
        }
        if (answer.children.length === 0) {
            rows.push(aside('empty', EMPTY_WORDS));
        }
        for (const node of answer.children) {
            const own = folderOf(node);
            const id = idOf(own);
            const opens = opensOf(node);
            const open = opens && state.open.indexOf(id) >= 0;
            const isAsset = assetId !== null && id === assetId;
            rows.push({ id, kind: 'node', depth, parent, folder: own, node, opens, open, assetFolder: isAsset, guided, words: '', code: '' });
            if (open) {
                under(own, depth + 1, guided || isAsset);
            }
        }
        if (answer.truncated) {
            rows.push(aside('truncated', TRUNCATED_WORDS));
        }
    };
    under('', 0, false);
    return rows;
}

/** The folders the tree needs and nothing was asked of yet: the top level, then each open folder in view. */
export function foldersToAsk(state: TreeState, answers: BrowseAnswers, asset: AssetFolder | null = null): string[] {
    const out: string[] = [];
    const need = (folder: string): void => {
        if (!answers.folders[browseKey(state.provider, folder)] && out.indexOf(folder) < 0) {
            out.push(folder);
        }
    };
    need('');
    // An open folder is asked even before its row shows (the card opens at the asset folder with every level above it).
    // Each is asked in the spelling the Gateway or the asset list gave it.
    const known = new Map<string, string>();
    if (asset && sameProvider(state.provider, asset.provider)) {
        ancestors(asset.folder).forEach((f) => known.set(idOf(f), f));
    }
    Object.keys(answers.folders).forEach((key) => {
        const answer = answers.folders[key];
        if (answer.state === 'loaded') {
            answer.children.forEach((c) => known.set(idOf(folderOf(c)), folderOf(c)));
        }
    });
    state.open.forEach((id) => need(known.get(id) || id));
    return out;
}

/** The rows the keyboard moves over: the nodes, and a failed folder's words (Enter asks again). */
function reachable(row: TreeRow): boolean {
    return row.kind === 'node' || row.kind === 'failed';
}

/** The row the keyboard is on: the focused one while it is in view, else the first it can reach; null for none. */
export function focusRow(rows: readonly TreeRow[], focus: string | null): TreeRow | null {
    return rows.find((r) => reachable(r) && r.id === focus) || rows.find(reachable) || null;
}

/** What a key does in the tree. */
export type TreeAction =
    | { type: 'focus'; id: string }
    | { type: 'open'; row: TreeRow }
    | { type: 'close'; row: TreeRow }
    | { type: 'pick'; row: TreeRow }
    | { type: 'retry'; row: TreeRow };

/**
 * A key in the tree (EXPERIENCE.md Accessibility Floor): Up and Down move, Home and End go to the ends, Right opens a closed
 * folder or steps into an open one, Left closes an open folder or goes to the parent, Enter or Space picks a row (asks a failed
 * folder again). Null for a key the tree does not take, or a move with nowhere to go.
 */
export function keyAction(rows: readonly TreeRow[], focus: string | null, key: string): TreeAction | null {
    const on = focusRow(rows, focus);
    if (!on) {
        return null;
    }
    const reach = rows.filter(reachable);
    const at = reach.indexOf(on);
    const to = (row: TreeRow | undefined): TreeAction | null => (row && row !== on ? { type: 'focus', id: row.id } : null);
    switch (key) {
        case 'ArrowDown':
            return to(reach[at + 1]);
        case 'ArrowUp':
            return to(reach[at - 1]);
        case 'Home':
            return to(reach[0]);
        case 'End':
            return to(reach[reach.length - 1]);
        case 'ArrowRight':
            if (on.kind !== 'node' || !on.opens) {
                return null;
            }
            return on.open ? to(reach.find((r) => r.parent === on.id)) : { type: 'open', row: on };
        case 'ArrowLeft':
            if (on.kind === 'node' && on.open) {
                return { type: 'close', row: on };
            }
            return on.parent !== null ? to(reach.find((r) => r.kind === 'node' && r.id === on.parent)) : null;
        case 'Enter':
        case ' ':
        case 'Spacebar':
            if (on.kind === 'failed') {
                return canRetry(on.code) ? { type: 'retry', row: on } : null;
            }
            return { type: 'pick', row: on };
        default:
            return null;
    }
}

/** A folder opened: it joins the open ones. */
export function openFolder(state: TreeState, id: string): TreeState {
    return state.open.indexOf(id) >= 0 ? state : { ...state, open: state.open.concat([id]) };
}

/** A folder closed: the keyboard comes up to it when it was on a row inside. */
export function closeFolder(state: TreeState, id: string): TreeState {
    const inside = state.focus !== null && state.focus.indexOf(id + '/') === 0;
    const under = state.focus !== null && state.focus.indexOf(id + '\n') === 0;
    return { ...state, open: state.open.filter((o) => o !== id), focus: inside || under ? id : state.focus };
}

// ---- What is a pick ----

/** Whether a row can be used for the value: a tag for any; for Alarms a folder or a UDT instance too (owner decision 5). */
export function canPick(node: TagChild, of: PickTarget | PickTarget['part']): boolean {
    return node.type === 'tag' || (takesFolders(of) && (node.type === 'folder' || node.type === 'udt-instance'));
}

/** Why a picked row cannot be used, or ''. */
export function pickProblem(node: TagChild, of: PickTarget | PickTarget['part']): string {
    if (canPick(node, of)) {
        return '';
    }
    if (takesFolders(of)) {
        return 'Pick a tag or a folder.';
    }
    return node.type === 'other' ? 'Pick a tag.' : 'Pick a tag, not a folder.';
}

/**
 * The primary button: "Use for P14" for one item's override or own rule (entry 13c); "Use this folder" for a folder or a UDT
 * instance picked for a kind's Alarms; else "Use this tag".
 */
export function useText(node: TagChild | null, of: PickTarget | PickTarget['part']): string {
    const target = targetOf(of);
    if (isItemTarget(target)) {
        return 'Use for ' + (target.item || 'this item');
    }
    return node && node.type !== 'tag' && canPick(node, target) ? 'Use this folder' : 'Use this tag';
}

// ---- Words ----

const TYPE_WORDS: Record<TagChildType, string> = {
    tag: 'Tag', folder: 'Folder', 'udt-instance': 'UDT instance', 'udt-type': 'UDT type', other: 'Other'
};

/** The type column (owner decision 1): what the Gateway sends, in words. */
export function typeWord(type: TagChildType): string {
    return TYPE_WORDS[type] || TYPE_WORDS.other;
}

/**
 * The For line: "For: Key value 2 of the Well pad kind", "For: Comms of the Well pad kind", "For: Alarms of the Well pad kind",
 * and from entry 13c "For: Style rule of the Well pad kind", "For: Popup param wellId of the Well pad kind" (a new row not named
 * yet: "For: A new popup param of the Well pad kind"), "For: Casing pressure on P14 only - an override" and
 * "For: Style rule of P14 only".
 */
export function forLine(target: PickTarget, kind: Kind): string {
    const item = target.item || 'this item';
    if (target.part === 'override') {
        return 'For: ' + (target.name || 'A path') + ' on ' + item + ' only - an override';
    }
    if (target.part === 'ownRule') {
        return 'For: Style rule of ' + item + ' only';
    }
    const what = target.part === 'kpi' ? 'Key value ' + (target.index || 1)
        : target.part === 'comms' ? 'Comms'
        : target.part === 'alarms' ? 'Alarms'
        : target.part === 'rule' ? 'Style rule'
        : target.name ? 'Popup param ' + target.name : 'A new popup param';
    return 'For: ' + what + ' of the ' + kind.name + ' kind';
}

/** The select's providers: the default first, then the rest as the Gateway lists them; the one shown is kept while it is absent (stopped). */
export function providerOptions(providers: readonly TagProvider[], shown: string | null): TagProvider[] {
    const out = providers.filter((p) => p.isDefault).concat(providers.filter((p) => !p.isDefault));
    if (shown !== null && !out.some((p) => sameProvider(p.name, shown))) {
        out.push({ name: shown, isDefault: false });
    }
    return out;
}

/** The provider the tree shows, by its name: the default one's once the Gateway named it; null before. */
export function shownProvider(state: TreeState, answers: BrowseAnswers): string | null {
    if (state.provider !== null) {
        const named = answers.providers.find((p) => sameProvider(p.name, state.provider));
        return named ? named.name : state.provider;
    }
    const first = answers.providers.find((p) => p.isDefault);
    return first ? first.name : null;
}

/** Whether a failed ask may be asked again: a refused role is not (the Gateway would say the same). */
export function canRetry(code: string): boolean {
    return code !== 'role';
}

/** A provider's top level that failed: what stands in the tree's place. */
export interface RootProblem {
    /** "Can't browse Site2" for a provider that does not answer; '' when the Gateway's words stand alone. */
    title: string;
    words: string;
    retry: boolean;
    code: string;
}

/**
 * The top level of the provider shown failed: a provider that does not answer (`tags-unavailable`, or no answer in time) is
 * "Can't browse <provider>" with the sentence and Try again; a refused role or an invalid ask is the Gateway's words in place,
 * with no Try again for a role. Null while the top level is loading or loaded.
 */
export function rootProblem(state: TreeState, answers: BrowseAnswers): RootProblem | null {
    const answer = answers.folders[browseKey(state.provider, '')];
    if (!answer || answer.state !== 'failed') {
        return null;
    }
    const unavailable = answer.code === 'tags-unavailable' || answer.code === TIMEOUT_CODE;
    const name = shownProvider(state, answers);
    // Another provider is offered only when the select has one to offer.
    const others = answers.providers.some((p) => !sameProvider(p.name, name));
    return {
        title: unavailable ? "Can't browse " + (name !== null ? name : 'the default provider') : '',
        words: answer.code === TIMEOUT_CODE ? answer.message + (others ? ' Try again, or pick another provider.' : ' Try again.') : answer.message,
        retry: canRetry(answer.code), code: answer.code
    };
}

/**
 * Whether the default provider's top level is to be asked for the providers' sake: the top level of a named provider failed
 * (the asset's provider is stopped or unknown, or did not answer) while no provider is known yet, so the select would offer
 * nothing else. Asked once (no provider, no folder); its reply fills the select.
 */
export function needsProviders(state: TreeState, answers: BrowseAnswers): boolean {
    const root = answers.folders[browseKey(state.provider, '')];
    return state.provider !== null && !!root && root.state === 'failed' && answers.providers.length === 0 && !answers.folders[browseKey(null, '')];
}

/** The note under the Path field. */
export interface CardNote {
    /** `plain` on the note surface; `shared` and `warning` on the warning tint with its edge and glyph. */
    tone: 'plain' | 'shared' | 'warning';
    /** The shared-tag note's title, "Same tag for every well pad"; '' otherwise. */
    title: string;
    text: string;
    /** The path as it will be saved, in bold monospace; '' before there is one. */
    path: string;
    /** "Resolves for 4 of 5 well pads. Not for Point 3.", or null. */
    resolve: { text: string; warning: boolean } | null;
    /** The path "Use this tag" saves, or null while it is inert. */
    save: string | null;
    /** One item's pick (entry 13c): the note ends in the Override tag. */
    override?: boolean;
}

function plain(text: string): CardNote {
    return { tone: 'plain', title: '', text, path: '', resolve: null, save: null };
}

function warning(text: string): CardNote {
    return { tone: 'warning', title: '', text, path: '', resolve: null, save: null };
}

/** A path's last name, for the shared-tag sentence of a typed path: `[default]Plant/AmbientTemp` is `AmbientTemp`. */
function lastName(path: string): string {
    const split = splitFullPath(path);
    const parts = (split ? split.folder : path).split('/').filter((p) => p !== '');
    return parts.length > 0 ? parts[parts.length - 1] : path;
}

/** What every item of the kind does with one shared path, by the value it is for. */
function sharedEnd(target: PickTarget, kind: string): string {
    switch (target.part) {
        case 'alarms':
            return 'every ' + kind + ' shows the alarms below it.';
        case 'rule':
            return 'every ' + kind + "'s rule reads this one tag.";
        case 'param':
            return 'every ' + kind + "'s popup view gets this one path.";
        default:
            return 'every ' + kind + ' shows this one tag.';
    }
}

/** The words of an item's pick: "Saved for P14 only, as the full path". */
export function itemNoteText(item: string): string {
    return 'Saved for ' + item + ' only, as the full path';
}

/**
 * The note of one item's override or own rule (entry 13c, owner decisions 6 to 8): the card opens at that item's own asset
 * folder (the default provider's top with no asset), every pick is its full path and nothing is asked of the Gateway; a typed
 * path is checked by the override's own full-path check, in its words.
 */
function itemNote(o: { target: PickTarget; asset: AssetFolder | null; picked: TagChild | null; typed: string | null; assetProblem: string }): CardNote {
    const item = o.target.item || 'this item';
    const saved = (path: string): CardNote =>
        ({ tone: 'plain', title: '', text: itemNoteText(item), path, resolve: null, save: path, override: true });
    if (o.typed !== null && o.typed !== '') {
        const problem = pathProblem(o.typed);
        return problem !== '' ? warning(problem) : saved(o.typed);
    }
    if (o.picked) {
        const problem = pickProblem(o.picked, o.target);
        return problem !== '' ? plain(problem) : saved(o.picked.path);
    }
    const tail = ' A pick is saved for ' + item + ' only, as the full path.';
    if (!o.asset) {
        return plain(item + ' is not linked to an asset with a tag folder, so the tree starts at the top.' + tail);
    }
    if (o.assetProblem !== '') {
        return plain(o.assetProblem + ' ' + item + "'s asset folder could not be opened, so the tree starts at the top." + tail);
    }
    return plain('Opened at ' + item + "'s asset folder." + tail);
}

/**
 * The note under the Path field, and with it what "Use this tag" saves. With nothing picked it says where the card opened;
 * a row that is no pick says so; a pick waits for the Gateway's answer (`tags.resolve` with the preview item's asset): inside
 * the asset folder `{asset.path}/...` and what it resolves for, outside it the shared-tag note with the full path. With no
 * preview item there is nothing to ask and every pick is its full path (owner decision 10).
 *
 * From entry 13c a typed path (`typed`, not null while the Path field holds typed text) is answered as a pick is: the Gateway's
 * answer to the text as typed, a full path and `{asset.path}/...` alike, kept under that text in `picks`; its refusal shows its
 * own words and saves nothing. Where no asset can be asked (no linked item, or one item's target) the override's own full-path
 * check answers. One item's target (`target.part` `override` or `ownRule`) is `itemNote`.
 */
export function cardNote(o: {
    kind: Kind; part: PickTarget['part']; asset: AssetFolder | null; picked: TagChild | null; pick: PickAnswer | undefined;
    /** The Gateway's words when the asset folder could not be opened, or ''. */
    assetProblem: string;
    /** The preview item's name when it has one whose asset's base path is no full tag path (no `asset` then); else absent. */
    noFolder?: string | null;
    /** The whole target, for the words of the newer parts; `{part}` when absent. */
    target?: PickTarget;
    /** The text typed in the Path field, trimmed; null while the field shows the tree's pick (or nothing). */
    typed?: string | null;
}): CardNote {
    const target = o.target || { part: o.part };
    const typed = o.typed === undefined || o.typed === null || o.typed === '' ? null : o.typed;
    if (isItemTarget(target)) {
        return itemNote({ target, asset: o.asset, picked: o.picked, typed, assetProblem: o.assetProblem });
    }
    const kind = lowerKind(o.kind);
    const shared = 'Same tag for every ' + kind;
    // Why there is no asset folder: no linked item of the kind, or a preview item whose asset names no tag folder.
    const none = o.noFolder ? o.noFolder + "'s asset has no tag folder" : 'No ' + kind + ' is linked to an asset';
    if (!o.picked && typed === null) {
        if (!o.asset) {
            return plain(none + (o.noFolder ? ' to open, so the tree starts at the top.' : ', so there is no asset folder to open.')
                + ' A pick is saved as the full path, the same tag for every ' + kind + '.');
        }
        if (o.assetProblem !== '') {
            return plain(o.assetProblem + ' ' + o.asset.name + "'s asset folder could not be opened, so the tree starts at the top.");
        }
        return plain('Opened at ' + o.asset.name + "'s asset folder, the preview item. A tag in it is saved for every " + kind
            + ' as {asset.path}/.... Go up to pick a tag anywhere else.');
    }
    if (o.picked && typed === null) {
        const problem = pickProblem(o.picked, target);
        if (problem !== '') {
            return plain(problem);
        }
    }
    const full = typed !== null ? typed : (o.picked as TagChild).path;
    const name = typed !== null ? lastName(typed) : (o.picked as TagChild).name;
    if (!o.asset) {
        if (typed !== null) {
            // Nothing can be asked: the browser's own full-path check answers, and a path under the asset is told why not here.
            if (typed === '{asset.path}' || typed.indexOf('{asset.path}/') === 0) {
                return warning(none + ', so ' + typed + ' cannot be checked here. Type a full path such as [default]Shared/GasPrice.');
            }
            const problem = pathProblem(typed);
            if (problem !== '') {
                return warning(problem);
            }
        }
        return { tone: 'shared', title: shared, text: none + ', so it is saved as the full path.', path: full, resolve: null, save: full };
    }
    if (!o.pick || o.pick.state === 'asking') {
        return plain('Checking...');
    }
    if (o.pick.state === 'failed') {
        // A typed path the Gateway refuses: its own words. Any other failure (no answer, the tag system) says the check failed.
        return warning(typed !== null && o.pick.code === 'invalid' ? o.pick.message : 'Could not check this path: ' + o.pick.message);
    }
    if (!o.pick.relative) {
        return {
            tone: 'shared', title: shared,
            text: name + ' is outside ' + o.asset.name + "'s asset folder, so it is saved as the full path and " + sharedEnd(target, kind),
            path: o.pick.path, resolve: null, save: o.pick.path
        };
    }
    const counted = o.pick.n !== undefined && o.pick.m !== undefined
        ? resolveNote(o.pick.path, o.kind, { state: 'resolved', n: o.pick.n, m: o.pick.m, failing: o.pick.failing, failingMore: o.pick.failingMore }) : null;
    return {
        tone: 'plain', title: '', text: 'Inside ' + o.asset.name + "'s asset folder - saved for every " + kind + ' as', path: o.pick.path,
        resolve: counted ? { text: counted.text, warning: counted.warning } : null, save: o.pick.path
    };
}

/** How long the Path field waits after the last keystroke before a typed path is asked of the Gateway (Enter asks at once). */
export const TYPED_PAUSE_MS = 400;

// ---- The panel's side ----

/**
 * The id of a path's tag button: the path's field for a stored value, a new row by its own id. From entry 13c also the style
 * rule's path, a popup param by its name (a new one by its row id), and on one item an override's row and the item's own rule.
 */
export const TagFor = {
    comms: 'comms.path',
    alarms: 'alarms.path',
    kpi: (key: string): string => 'kpis.' + key + '.path',
    newRow: (rowId: string): string => 'kpis.new:' + rowId,
    rule: 'styleRule.path',
    param: (name: string): string => 'param:' + name,
    newParam: (rowId: string): string => 'param.new:' + rowId,
    override: (row: string): string => 'override:' + row,
    ownRule: 'own.styleRule.path'
} as const;

/** What a tag button's id names. */
export type TagForRead =
    | { part: 'comms' } | { part: 'alarms' } | { part: 'kpi'; key: string } | { part: 'new'; rowId: string }
    | { part: 'rule' } | { part: 'param'; name: string } | { part: 'newParam'; rowId: string }
    | { part: 'override'; row: string } | { part: 'ownRule' };

/**
 * What a tag button's id names: the comms or alarms path, a stored key value by its key, a new row by its id, the style rule's
 * path, a stored param by its name, a new param by its row id, an item's override by its Live now row, or the item's own rule.
 */
export function readTagFor(tagFor: string): TagForRead | null {
    if (tagFor === TagFor.comms) {
        return { part: 'comms' };
    }
    if (tagFor === TagFor.alarms) {
        return { part: 'alarms' };
    }
    if (tagFor === TagFor.rule) {
        return { part: 'rule' };
    }
    if (tagFor === TagFor.ownRule) {
        return { part: 'ownRule' };
    }
    if (tagFor.indexOf('kpis.new:') === 0) {
        return { part: 'new', rowId: tagFor.slice('kpis.new:'.length) };
    }
    if (tagFor.indexOf('param.new:') === 0) {
        return { part: 'newParam', rowId: tagFor.slice('param.new:'.length) };
    }
    if (tagFor.indexOf('param:') === 0) {
        return { part: 'param', name: tagFor.slice('param:'.length) };
    }
    if (tagFor.indexOf('override:') === 0) {
        return { part: 'override', row: tagFor.slice('override:'.length) };
    }
    const m = /^kpis\.(.+)\.path$/.exec(tagFor);
    return m ? { part: 'kpi', key: m[1] } : null;
}
