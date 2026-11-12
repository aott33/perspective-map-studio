import * as React from 'react';
import { Kind } from '../adapters';
import { GlyphName } from '../controls';
import { TagChild, TagChildType } from '../messages';
import {
    BrowseAnswers, PickTarget, TYPED_PAUSE_MS, TreeRow, TreeState, assetFolderOf, assetProblem, browseKey, canPick, canRetry, cardNote, chooseProvider,
    closeFolder, focusRow, foldersToAsk, forLine, isItemTarget, keyAction, needsProviders, openFolder, outsideAsset, providerOptions, rootProblem, rowsInView,
    shownProvider, startState, toAssetFolder, typeWord, useText
} from '../tagBrowser';
import { ChromeGlyph } from './ChromeGlyph';

/**
 * The tag browser (epic 4 entries 13b and 13c; DESIGN.md Tag browser, EXPERIENCE.md Tag browser and its states): Map Studio's own
 * card for picking a tag, floating over the map's left edge beside the panel it was opened from, one at a time, for a full
 * editor only. It serves a kind's setup (key values, comms, alarms, the style rule's path, popup params) and one item (an
 * override row of Live now, the item's own style rule).
 *
 * - **Header**: "Pick a tag" with a close, and the For line naming the value ("For: Key value 2 of the Well pad kind",
 *   "For: Casing pressure on P14 only - an override").
 * - **Provider**: a select of the Gateway's tag providers, the default first and tagged "Default"; a change shows that
 *   provider's top level. Away from the asset folder a ghost "<name> folder" button returns to it.
 * - **The tree** of that one provider, loaded a level at a time (one `tags.browse` per folder opened, the answers kept while the
 *   card is open): rows of a chevron on what opens, a glyph for the type, the name, the type in words and a tag's data type as
 *   the Gateway sends it. It opens at the preview item's asset folder, opened and tagged "Asset folder", its rows guided. It is
 *   a `role="tree"` with one row in the tab order: Up and Down move, Right opens or steps in, Left closes or goes to the
 *   parent, Home and End, Enter or Space picks; a click picks and a click on the chevron opens.
 * - **States**: "Loading..." with the spinner under a folder being opened, the rest usable; "No tags in this folder"; a folder
 *   that failed shows the Gateway's words under it with Try again; a provider that does not answer replaces the tree with
 *   "Can't browse <provider>", the sentence and Try again; a refused role or an invalid ask shows the Gateway's words in place.
 * - **Path**: the picked row's full path, or a path typed (entry 13c). Typing drops the tree's pick and the tree does not move;
 *   a typed path is asked of the Gateway after a short pause or on Enter (`tags.resolve` with the text as typed), and the note
 *   and the button follow that answer as for a pick; a click on a row replaces the typed text. The field works whatever the
 *   tree shows (loading, empty, a provider it cannot browse, a refusal).
 * - **One item's pick** (an override, the own rule): the card opens at that item's own asset folder, every pick is its full
 *   path, nothing is asked of the Gateway (the override's own full-path check answers a typed path), the note reads "Saved
 *   for P14 only, as the full path" and the button "Use for P14".
 * - **The note**: where the card opened; "Pick a tag, not a folder."; and for a pick the Gateway's answer (`tags.resolve` with
 *   the preview item's asset): inside the asset folder `{asset.path}/...` and "Resolves for 4 of 5 well pads. Not for Point 3.",
 *   outside it the shared-tag note on the warning tint. "Use this tag" ("Use this folder" for a folder picked for Alarms) is
 *   inert until that answer has come.
 *
 * Cancel, the close and Esc change nothing. The focus goes into the tree when the card opens; the map component gives it back
 * to the tag button when the card goes. The tree's logic is tagBrowser.ts (unit tested); the asks are the store delegate's.
 *
 * For tests: `.mapstudio-tagbrowser` (`data-for` the tag button's id, `data-part`, `data-provider`, `data-rows`), the For line
 * `.mapstudio-tagbrowser-for`, the select `.mapstudio-tagbrowser-select`, `.mapstudio-tagbrowser-default`, the folder button
 * `.mapstudio-tagbrowser-home`, the tree `.mapstudio-tagbrowser-tree`, a row `.mapstudio-tag-row` (`data-kind` `node`, `loading`,
 * `empty`, `failed` or `truncated`, `data-path`, `data-type`, `data-open`, `data-picked`, `data-asset`, `data-guided`) with
 * `.mapstudio-tag-chevron`, `.mapstudio-tag-type`, `.mapstudio-tag-datatype` and `.mapstudio-tag-retry`, the spinner
 * `.mapstudio-spinner`, the provider's failure `.mapstudio-tagbrowser-problem` (`data-code`) with `.mapstudio-tagbrowser-retry`,
 * the Path field `.mapstudio-tagbrowser-path input`, the note `.mapstudio-tagbrowser-note` (`data-tone`, `data-save` the path
 * to be saved), a pick that was not saved `.mapstudio-tagbrowser-refused`, and the buttons `.mapstudio-tagbrowser-cancel`, `.mapstudio-tagbrowser-use`, `.mapstudio-tagbrowser-close`.
 */
export interface TagBrowserProps {
    kind: Kind;
    /** The tag button the card was opened from (tagBrowser.ts `TagFor`). */
    tagFor: string;
    target: PickTarget;
    /**
     * The kind's preview item: its name and its asset's base path; null with none (the default provider's top level). For one
     * item's target it is that item and its own asset's base path; null for an item with no asset.
     */
    preview: { name: string; folder: string } | null;
    /** What the Gateway answered while the card is open. */
    answers: BrowseAnswers;
    /** Ask `tags.browse` for one folder of one provider (null: the default one); `again` asks one already answered. */
    onBrowse: (provider: string | null, folder: string, again?: boolean) => void;
    /** Ask `tags.resolve` how a picked full path, or a path as typed, is saved and what it resolves for. */
    onAskPick: (path: string) => void;
    /**
     * "Use this tag": the path to save, as the Gateway gave it. '' when the pick was taken (the card is closed by its owner);
     * else why it was not saved, in words, which the card shows by the button and stays open.
     */
    onUse: (path: string) => string;
    /** Cancel, the close or Esc: nothing changes. */
    onClose: () => void;
    /** The card left the page: its answers are dropped. */
    onGone: () => void;
}

const TYPE_GLYPHS: Record<TagChildType, GlyphName> = { tag: 'tag', folder: 'folder', 'udt-instance': 'udt', 'udt-type': 'udt', other: 'tag' };

/** The small spinner of a row being loaded (owner decision 6): it turns, and stands still under reduced motion. */
export function Spinner(): React.ReactElement {
    return <span className="mapstudio-spinner" aria-hidden="true" />;
}

let cardCount = 0;

export class TagBrowser extends React.Component<TagBrowserProps, { tree: TreeState; refused?: string; typed?: string | null }> {
    private readonly idBase = 'mapstudio-tagbrowser-' + (++cardCount);
    private readonly root = React.createRef<HTMLElement>();
    private readonly holder = React.createRef<HTMLDivElement>();
    /** The focus is to go to the keyboard's row: when the card opens (until the row it opens at shows), and after each key. */
    private focusWanted: 'opening' | 'row' | null = 'opening';
    /** The asset folder was found missing and the tree taken to the top (once). */
    private fellBack = false;
    /** The pause after the last keystroke in the Path field, before the typed path is asked. */
    private typedTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(props: TagBrowserProps) {
        super(props);
        this.state = { tree: startState(assetFolderOf(props.preview)) };
    }

    componentDidMount(): void {
        this.sync();
    }

    /** Whether the focus is in the card before a draw: a draw that takes the focused row or button away must not lose it. */
    getSnapshotBeforeUpdate(): boolean {
        const root = this.root.current;
        return typeof document !== 'undefined' && !!root && root.contains(document.activeElement);
    }

    componentDidUpdate(_props: TagBrowserProps, _state: unknown, hadFocus: boolean): void {
        this.sync();
        const root = this.root.current;
        const holder = this.holder.current;
        if (hadFocus && root && holder && !root.contains(document.activeElement)) {
            // The focused element left the card with this draw (a folder closed over it, Try again pressed, the tree replaced):
            // the tree's box takes the focus, so the keyboard and Esc still reach the card.
            const on = focusRow(this.rows(), this.state.tree.focus);
            const el = on ? this.rowElement(on) : null;
            (el || holder).focus({ preventScroll: true });
        }
    }

    componentWillUnmount(): void {
        this.clearTypedTimer();
        this.props.onGone();
    }

    private clearTypedTimer(): void {
        if (this.typedTimer !== null) {
            clearTimeout(this.typedTimer);
            this.typedTimer = null;
        }
    }

    /** The text typed in the Path field, trimmed; null while the field shows the tree's pick. */
    private typed(): string | null {
        const typed = this.state.typed;
        return typed === undefined || typed === null ? null : typed.trim();
    }

    /** Whether a path can be asked of the Gateway: a kind's target with a preview item whose asset has a tag folder. */
    private asks(): boolean {
        return !isItemTarget(this.props.target) && this.asset() !== null;
    }

    /**
     * The Path field typed in (entry 13c, owner decisions 2 and 3): the tree's pick is dropped and the tree does not move; the
     * path is asked after a short pause, and the button waits for the answer.
     */
    private onType = (ev: React.ChangeEvent<HTMLInputElement>): void => {
        const text = ev.target.value;
        this.clearTypedTimer();
        this.setState((prev) => ({ typed: text, refused: '', tree: prev.tree.picked ? { ...prev.tree, picked: null } : prev.tree }));
        this.typedTimer = setTimeout(() => {
            this.typedTimer = null;
            this.askTyped();
        }, TYPED_PAUSE_MS);
    };

    /** The typed path asked now (the pause is over, or Enter): as typed, a full path and `{asset.path}/...` alike. */
    private askTyped(): void {
        this.clearTypedTimer();
        const typed = this.typed();
        if (typed !== null && typed !== '' && this.asks()) {
            this.props.onAskPick(typed);
        }
    }

    private onPathKey = (ev: React.KeyboardEvent<HTMLInputElement>): void => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            ev.stopPropagation();
            this.askTyped();
        }
    };

    private asset() {
        return assetFolderOf(this.props.preview);
    }

    /**
     * After each draw: the default provider takes its name once the Gateway gave it; an asset folder the Gateway does not have
     * takes the tree to the provider's top (owner decision 8); the folders in view that nothing was asked of are asked; and the
     * focus follows the keyboard's row.
     */
    private sync(): void {
        const { answers } = this.props;
        const tree = this.state.tree;
        const asset = this.asset();
        if (tree.provider === null) {
            const named = shownProvider(tree, answers);
            if (named !== null) {
                this.setState({ tree: { ...tree, provider: named } });
                return;
            }
        }
        if (!this.fellBack && assetProblem(answers, asset) !== '') {
            this.fellBack = true;
            this.setState({ tree: { ...tree, open: [], focus: null } });
            return;
        }
        foldersToAsk(tree, answers, asset).forEach((folder) => this.props.onBrowse(tree.provider, folder));
        if (needsProviders(tree, answers)) {
            // The opening ask failed and no provider is known: the default one is asked, so the select has the others to offer.
            this.props.onBrowse(null, '');
        }
        this.placeFocus();
    }

    private rows(): TreeRow[] {
        return rowsInView(this.state.tree, this.props.answers, this.asset());
    }

    private rowElement(row: TreeRow): HTMLElement | null {
        const holder = this.holder.current;
        const all = holder ? Array.from(holder.querySelectorAll<HTMLElement>('.mapstudio-tag-row')) : [];
        return all.filter((el) => el.getAttribute('data-id') === row.id)[0] || null;
    }

    /**
     * The focus goes to the keyboard's row: when the card opens, after a key, a click or Try again. While that row is not in view
     * yet (the tree is loading, or the provider failed) the tree's box holds the focus, so Esc works; once a person has moved
     * the focus elsewhere meanwhile, it is theirs and nothing is taken back.
     */
    private placeFocus(): void {
        const wanted = this.focusWanted;
        const holder = this.holder.current;
        if (wanted === null || !holder || typeof document === 'undefined') {
            return;
        }
        const active = document.activeElement;
        const inside = !!active && holder.contains(active);
        if (this.placed && !inside && active && active !== document.body) {
            this.focusWanted = null;
            return;
        }
        this.placed = true;
        const tree = this.state.tree;
        const on = focusRow(this.rows(), tree.focus);
        const el = on ? this.rowElement(on) : null;
        if (!on || !el) {
            if (!inside) {
                holder.focus({ preventScroll: true });
            }
            return;
        }
        if (active !== el) {
            el.focus({ preventScroll: true });
        }
        if (typeof el.scrollIntoView === 'function') {
            el.scrollIntoView({ block: 'nearest' });
        }
        if (wanted === 'row' || tree.focus === null || on.id === tree.focus) {
            this.focusWanted = null;
        }
    }

    /** Whether the wanted focus was placed once (on the tree's box, at least). */
    private placed = false;

    private wantFocus(): void {
        this.focusWanted = 'row';
        this.placed = false;
    }

    private setTree(change: (tree: TreeState) => TreeState, focus = false): void {
        if (focus) {
            this.wantFocus();
        }
        this.setState((prev) => ({ tree: change(prev.tree) }));
    }

    /**
     * A row picked: it is the Path field's, replacing any typed text, and a row that can be used is asked of `tags.resolve`
     * (with a preview item; never for one item's target, whose pick is its full path).
     */
    private pick(node: TagChild, id: string): void {
        this.clearTypedTimer();
        this.setTree((tree) => ({ ...tree, picked: node, focus: id }), true);
        if (this.state.refused || (this.state.typed !== undefined && this.state.typed !== null)) {
            this.setState({ refused: '', typed: null });
        }
        // With no asset folder (no preview item, or an asset whose base path is no tag path) nothing is asked: a pick is its full path.
        if (this.asks() && canPick(node, this.props.target)) {
            this.props.onAskPick(node.path);
        }
    }

    private toggle(row: TreeRow): void {
        this.setTree((tree) => ({ ...(row.open ? closeFolder(tree, row.id) : openFolder(tree, row.id)), focus: row.id }), true);
    }

    /** Try again under a folder: asked once more, the keyboard on the folder while it loads. */
    private retry(row: TreeRow): void {
        this.props.onBrowse(this.state.tree.provider, row.folder, true);
        if (row.parent !== null) {
            const parent = row.parent;
            this.setTree((tree) => ({ ...tree, focus: parent }), true);
        }
    }

    /** Try again on a provider that did not answer: its top level, and the open folders that failed with it. */
    private retryRoot = (): void => {
        const tree = this.state.tree;
        const { answers } = this.props;
        this.props.onBrowse(tree.provider, '', true);
        tree.open.forEach((id) => {
            const answer = answers.folders[browseKey(tree.provider, id)];
            if (answer && answer.state === 'failed' && canRetry(answer.code)) {
                this.props.onBrowse(tree.provider, id, true);
            }
        });
        this.focusWanted = 'opening';
        this.placed = false;
    };

    private onTreeKey = (ev: React.KeyboardEvent<HTMLDivElement>): void => {
        if (ev.altKey || ev.ctrlKey || ev.metaKey) {
            return;
        }
        if ((ev.target as HTMLElement).closest && (ev.target as HTMLElement).closest('button') && (ev.key === 'Enter' || ev.key === ' ')) {
            // A row's own Try again button, pressed.
            return;
        }
        const action = keyAction(this.rows(), this.state.tree.focus, ev.key);
        if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' ', 'Spacebar'].indexOf(ev.key) >= 0) {
            // The tree's own keys never scroll the page or reach the map.
            ev.preventDefault();
            ev.stopPropagation();
        }
        if (!action) {
            return;
        }
        if (action.type === 'focus') {
            const id = action.id;
            this.setTree((tree) => ({ ...tree, focus: id }), true);
        } else if (action.type === 'open' || action.type === 'close') {
            this.toggle(action.row);
        } else if (action.type === 'pick' && action.row.node) {
            this.pick(action.row.node, action.row.id);
        } else if (action.type === 'retry') {
            this.retry(action.row);
        }
    };

    private onCardKey = (ev: React.KeyboardEvent<HTMLElement>): void => {
        if (ev.key === 'Escape') {
            ev.preventDefault();
            ev.stopPropagation();
            this.props.onClose();
        }
    };

    private renderRow(row: TreeRow, on: TreeRow | null, picked: TagChild | null): React.ReactElement {
        const indent = { paddingLeft: 6 + row.depth * 16 };
        const guided = row.guided ? ' mapstudio-tag-row--guided' : '';
        if (row.kind !== 'node' || !row.node) {
            const failed = row.kind === 'failed';
            return (
                <div key={row.id} role="treeitem" aria-level={row.depth + 1} aria-selected={false} aria-disabled={failed ? undefined : true}
                     tabIndex={failed ? (on === row ? 0 : -1) : undefined}
                     className={'mapstudio-tag-row mapstudio-tag-row--aside mapstudio-tag-row--' + row.kind + guided} style={indent}
                     data-id={row.id} data-kind={row.kind} data-under={row.folder} data-code={row.code} data-guided={row.guided ? 'true' : 'false'}
                     onFocus={failed ? () => this.state.tree.focus !== row.id && this.setTree((tree) => ({ ...tree, focus: row.id })) : undefined}>
                    {row.kind === 'loading' ? <Spinner /> : null}
                    {failed ? <ChromeGlyph name="warning" className="mapstudio-tag-glyph" size={14} /> : null}
                    <span className="mapstudio-tag-words">{row.words}</span>
                    {failed && canRetry(row.code) ? (
                        <button type="button" tabIndex={-1} className="mapstudio-button mapstudio-tag-retry" onClick={() => this.retry(row)}>Try again</button>
                    ) : null}
                </div>
            );
        }
        const node = row.node;
        const isPicked = picked !== null && picked.path === node.path;
        return (
            <div key={row.id} role="treeitem" aria-level={row.depth + 1} aria-expanded={row.opens ? row.open : undefined} aria-selected={isPicked}
                 tabIndex={on === row ? 0 : -1}
                 className={'mapstudio-tag-row' + (isPicked ? ' mapstudio-tag-row--picked' : '') + guided} style={indent}
                 data-id={row.id} data-kind="node" data-path={node.path} data-type={node.type} data-open={row.opens ? String(row.open) : ''}
                 data-picked={isPicked ? 'true' : 'false'} data-asset={row.assetFolder ? 'true' : 'false'} data-guided={row.guided ? 'true' : 'false'}
                 onClick={() => this.pick(node, row.id)}>
                {/* The chevron opens and closes; the row's own click picks. Not a button of its own: Right and Left are its keys. */}
                <span className={'mapstudio-tag-chevron' + (row.open ? ' mapstudio-tag-chevron--open' : '')} aria-hidden="true"
                      onClick={row.opens ? (ev) => { ev.stopPropagation(); this.toggle(row); } : undefined}>
                    {row.opens ? <ChromeGlyph name="chevron" className="mapstudio-tag-chevron-glyph" size={14} /> : null}
                </span>
                <ChromeGlyph name={TYPE_GLYPHS[node.type] || 'tag'} className="mapstudio-tag-glyph" size={14} />
                <span className="mapstudio-tag-name mapstudio-mono">{node.name}</span>
                {row.assetFolder ? <span className="mapstudio-kindsetup-tag mapstudio-tag-asset">Asset folder</span> : null}
                <span className="mapstudio-tag-type">{typeWord(node.type)}</span>
                <span className="mapstudio-tag-datatype">{node.dataType || ''}</span>
            </div>
        );
    }

    render(): React.ReactElement {
        const { kind, target, answers } = this.props;
        const tree = this.state.tree;
        const asset = this.asset();
        const shown = shownProvider(tree, answers);
        const options = providerOptions(answers.providers, shown);
        const isDefault = shown !== null && options.some((p) => p.isDefault && p.name === shown);
        const problem = rootProblem(tree, answers);
        const rows = problem ? [] : this.rows();
        const on = focusRow(rows, tree.focus);
        const picked = tree.picked;
        const missing = assetProblem(answers, asset);
        const typed = this.typed();
        const asked = typed !== null && typed !== '' ? typed : picked ? picked.path : null;
        const note = cardNote({ kind, part: target.part, target, typed, asset, picked, pick: asked !== null ? answers.picks[asked] : undefined,
            assetProblem: missing, noFolder: this.props.preview && !asset ? this.props.preview.name : null });
        const refused = this.state.refused || '';
        const home = asset && missing === '' && outsideAsset(tree, asset) ? asset : null;
        const titleId = this.idBase + '-title';
        const forId = this.idBase + '-for';
        const selectId = this.idBase + '-provider';
        const pathId = this.idBase + '-path';
        const noteId = this.idBase + '-note';
        const warn = note.tone !== 'plain';
        return (
            <section ref={this.root} className="mapstudio-tagbrowser" role="dialog" aria-labelledby={titleId} aria-describedby={forId}
                     data-for={this.props.tagFor} data-part={target.part} data-provider={shown || ''} data-rows={String(rows.filter((r) => r.kind === 'node').length)}
                     aria-keyshortcuts="Escape" onKeyDown={this.onCardKey}>
                <header className="mapstudio-tagbrowser-head">
                    <h3 id={titleId} className="mapstudio-tagbrowser-title">Pick a tag</h3>
                    <button type="button" className="mapstudio-dock-button mapstudio-tagbrowser-close" title="Close (Esc)" aria-label="Close"
                            onClick={this.props.onClose}>
                        <ChromeGlyph className="mapstudio-tagbrowser-glyph" name="close" size={16} />
                    </button>
                </header>
                <p id={forId} className="mapstudio-tagbrowser-for">{forLine(target, kind)}</p>
                <div className="mapstudio-tagbrowser-provider">
                    <label className="mapstudio-field-label" htmlFor={selectId}>Provider</label>
                    <select id={selectId} className="mapstudio-input mapstudio-mono mapstudio-tagbrowser-select" value={shown || ''}
                            disabled={options.length === 0}
                            onChange={(ev) => {
                                const name = ev.target.value;
                                if (name !== '') {
                                    this.setTree((t) => chooseProvider(t, name));
                                }
                            }}>
                        {options.length === 0 ? <option value="">Default provider</option> : null}
                        {options.map((p) => <option key={p.name} value={p.name}>{p.name + (p.isDefault ? ' (Default)' : '')}</option>)}
                    </select>
                    {isDefault ? <span className="mapstudio-kindsetup-tag mapstudio-tagbrowser-default">Default</span> : null}
                    {home ? (
                        <button type="button" className="mapstudio-button mapstudio-tagbrowser-home" title={'Back to ' + home.name + "'s asset folder"}
                                onClick={() => this.setTree((t) => toAssetFolder(t, home), true)}>
                            <ChromeGlyph className="mapstudio-tagbrowser-glyph" name="up" size={14} />
                            <span>{home.name + ' folder'}</span>
                        </button>
                    ) : null}
                </div>
                <div ref={this.holder} className="mapstudio-tagbrowser-holder" tabIndex={-1}>
                    {problem ? (
                        <div className="mapstudio-tagbrowser-problem" role="alert" data-code={problem.code}>
                            {problem.title !== '' ? (
                                <div className="mapstudio-tagbrowser-problem-title">
                                    <ChromeGlyph className="mapstudio-tagbrowser-glyph" name="cloud" size={16} />
                                    <span>{problem.title}</span>
                                </div>
                            ) : null}
                            <p className="mapstudio-tagbrowser-problem-words">{problem.words}</p>
                            {problem.retry ? (
                                <button type="button" className="mapstudio-button mapstudio-button--primary mapstudio-tagbrowser-retry"
                                        onClick={this.retryRoot}>Try again</button>
                            ) : null}
                        </div>
                    ) : (
                        <div className="mapstudio-tagbrowser-tree" role="tree" aria-label={'Tags of ' + (shown || 'the default provider')}
                             onKeyDown={this.onTreeKey}>
                            {rows.map((row) => this.renderRow(row, on, picked))}
                        </div>
                    )}
                </div>
                <div className="mapstudio-tagbrowser-path">
                    <label className="mapstudio-field-label" htmlFor={pathId}>Path</label>
                    <input id={pathId} type="text" className="mapstudio-input mapstudio-mono" autoComplete="off" spellCheck={false}
                           value={this.state.typed !== undefined && this.state.typed !== null ? this.state.typed : picked ? picked.path : ''}
                           placeholder="Pick in the tree or type one" aria-describedby={noteId} data-typed={typed !== null ? 'true' : 'false'}
                           onChange={this.onType} onKeyDown={this.onPathKey} />
                </div>
                <div id={noteId} className={'mapstudio-tagbrowser-note mapstudio-tagbrowser-note--' + note.tone} role="status" aria-live="polite"
                     data-tone={note.tone} data-save={note.save || ''}>
                    {note.title !== '' ? (
                        <div className="mapstudio-tagbrowser-note-title">
                            <ChromeGlyph className="mapstudio-tagbrowser-glyph" name="warning" size={14} />
                            <span>{note.title}</span>
                        </div>
                    ) : null}
                    <div className="mapstudio-tagbrowser-note-text">
                        {warn && note.title === '' ? <ChromeGlyph name="warning" className="mapstudio-tagbrowser-note-glyph" size={14} /> : null}
                        <span>{note.text}</span>
                    </div>
                    {note.path !== '' ? <div className="mapstudio-mono mapstudio-tagbrowser-note-path">{note.path}</div> : null}
                    {note.override ? (
                        <div className="mapstudio-tagbrowser-note-override"><span className="mapstudio-override-tag">Override</span></div>
                    ) : null}
                    {note.resolve ? (
                        <div className={'mapstudio-tagbrowser-note-resolve' + (note.resolve.warning ? ' mapstudio-tagbrowser-note-resolve--warning' : '')}
                             data-warning={note.resolve.warning ? 'true' : 'false'}>
                            <ChromeGlyph className="mapstudio-tagbrowser-glyph" name={note.resolve.warning ? 'warning' : 'check'} size={12} />
                            <span>{note.resolve.text}</span>
                        </div>
                    ) : null}
                </div>
                {refused !== '' ? (
                    <p className="mapstudio-tagbrowser-refused" role="alert">
                        <ChromeGlyph className="mapstudio-tagbrowser-glyph" name="warning" size={14} />
                        <span>{refused}</span>
                    </p>
                ) : null}
                <footer className="mapstudio-tagbrowser-actions">
                    <button type="button" className="mapstudio-button mapstudio-tagbrowser-cancel" onClick={this.props.onClose}>Cancel</button>
                    <button type="button" className="mapstudio-button mapstudio-button--primary mapstudio-tagbrowser-use" disabled={note.save === null}
                            onClick={() => {
                                if (note.save !== null) {
                                    // Not taken: the card stays, with the reason by the button.
                                    this.setState({ refused: this.props.onUse(note.save) });
                                }
                            }}>{useText(picked, target)}</button>
                </footer>
            </section>
        );
    }
}
