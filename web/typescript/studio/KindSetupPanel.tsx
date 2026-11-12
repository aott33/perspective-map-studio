import * as React from 'react';
import { Asset, Kind } from '../adapters';
import { KindSetupRecord, MapItemRecord } from '../contract';
import {
    Fields, KeyValue, KindRefusal, KindSaveState, MAX_KEY_VALUES, NewRowTexts, forgetSeen, Param, PreviewOption, ResolveState,
    SetupEdit, SetupView, TINT_NAMES, TintRow, TintsDraft, checkTints, fixedCategories,
    headerSubline, inStepVersion, insertAt, keyFromLabel, liveNowText, noPreviewText, paramMissing, pathsToResolve, placeholderList, popupPathEdit, previewLine,
    previewOf, previewOptions, readSetup, removeBlocked, resolveKey, resolveNote, rowMissing, ruleDraft, sameTints, showOnMapOff,
    storedRuleOf, tintRows, tintsDraft, unsavedText
} from '../kindSetup';
import { ItemState, Tint } from '../live';
import { MarkerColors, SpriteSymbol, tintSampleSvg } from '../markers';
import { Glyph } from '../popupParts';
import { Sample } from '../StylePreview';
import { PickTarget, TagFor, readTagFor } from '../tagBrowser';
import { ChromeGlyph } from './ChromeGlyph';
import { RuleEditor, ruleFields } from './RuleEditor';

/**
 * A kind's setup, in the properties panel's place while the rail's Kinds surface is open (epic 4 entry 12a; DESIGN.md Kind setup
 * and key screen 6, EXPERIENCE.md Kind setup). The header holds the kind's glyph and name, the subline ("Point - applies to 5
 * items - 1 override (P2 style rule)") and the **Preview item** select (the kind's linked items by name, each with its asset
 * folder; the folder again in monospace under it). Then the sections, numbered as DESIGN.md has them:
 *
 * - **1 Icon**: the kind's icon, read only; it comes from the kind list.
 * - **2 Key values**: up to four rows of label, unit and tag path, each with a switch for the popup, the Icon value star (one
 *   only) and Remove, a delete icon (off, saying "Used by the style rule", for the one the rule is built on). Add a key value is absent at four.
 *   A new row's `key` is made from its label when the row is first saved and never changes; a row without a label or a path is
 *   not sent and says what is missing.
 * - **3 Comms**: the heartbeat path and its popup switch. **4 Alarms**: the alarm source path, and the project's View alarms
 *   page read only (it is set in the Designer).
 * - **5 Popup**: the checkboxes Comms, Alarm count and Alarm summary, "Order is fixed: comms, values, alarms", the link, the
 *   popup view path and its params (name and value rows), with a placeholder picker on the link and on each param value.
 * - **6 Style rule** (entry 12b1; key screen 6, kinds-style): the type as a segmented choice in the panel tabs' look (None,
 *   States, Bands, Expression and, for a line kind that is not an area, From its instruments); the value the rule reads (a key
 *   value, switched-off ones too, or a typed tag path with its resolve note); one row per case with its preset select and a
 *   64 px tile of the kind's icon (or line sample) in that preset with the state word; for an area kind the category tints
 *   under it (the property, then a row per category with its tint and swatch). A rule is one part, sent whole: the section
 *   holds one draft and sends it as soon as it is whole in shape (a select at once, a typed field when finished); until then
 *   it says "Not saved yet" and what is missing, and nothing is sent. Each type's cases are remembered until the kind is left.
 *   From entry 12c2 the rule's editor is studio/RuleEditor.tsx, shared with an item's own rule in the Style tab; the tints stay here.
 *
 * **Saving.** There is no save button: a text field saves when it is finished (blur or Enter; Esc puts the stored value back),
 * a switch, a checkbox and the star at once. Each save is one edit of one part (`SetupEdit`), which the delegate applies to the
 * newest stored setup when it sends it; the panel never sends its own copy of the other parts. A field shows what was typed
 * until its save settles. **Another editor's change** shows at once in every field but the one being typed in, which keeps its
 * text and is saved at the version it was typed on, so the Gateway answers the conflict (owner decision e). **A refusal**: the
 * Gateway's words stand beside the field they name (`.mapstudio-field-refusal`), else at the panel's top; the field keeps what
 * was typed and the stored setup stands. While a save of this kind waits on a conflict, the store or a busy Gateway, the fields
 * are paused with those words (`paused`), as entry 10's.
 *
 * **Resolve notes.** Under each stored tag path, for the preview item's asset: "Resolves for 3 of 5 well pads" (the warning
 * token when fewer than all), a full path "Same tag for every well pad" (the warning token), a failed check in words; asked
 * when a path is saved or the preview item changes. With no linked item of the kind, one note under the Preview item select
 * says so and no note stands under the paths.
 *
 * **The preview item on the map** (entry 12b2). While this setup is open the preview item carries the word "Preview" on the map
 * (the map's part: features.ts); the line under the select says so, and **Show on map** beside the select takes the map to it,
 * the one thing here that moves the map (off, with its reason, with no preview item). At the foot of section 6 a note box, a
 * polite live region, says what the preview item shows now from its live state and when its alarm wins over the rule
 * (kindSetup.ts `liveNowText`); nothing of the rule is worked out in the browser, so the note follows each live update.
 *
 * For tests: the panel `.mapstudio-kindsetup` (`data-kind`, `data-version`, `data-paused`, `data-saving`, `data-preview`), each
 * section `[data-section]` (`icon`, `keyValues`, `comms`, `alarms`, `popup`, `styleRule`), each field's wrapper `[data-field]`
 * (kindSetup.ts `Fields`: `comms.path`, `kpis.pressure.path`, `link`, `popupView.params.padName`, ...; the Popup's checkboxes
 * `popup.comms`, `popup.alarmCount`, `popup.alarmSummary`; `preview`), a key value row `.mapstudio-kv-row[data-key]`, a param
 * row `.mapstudio-param-row[data-name]`, a refusal `.mapstudio-field-refusal`, a row not sent `.mapstudio-field-problem`, a
 * resolve note `.mapstudio-resolve-note[data-state]`, and the picker `.mapstudio-placeholder-button`, `.mapstudio-placeholder-menu`.
 * Section 6: the type buttons `.mapstudio-rule-type[data-type]` (`aria-pressed`), the value `[data-field="styleRule.source"]`,
 * a case `.mapstudio-rule-case[data-index]`, its tile `.mapstudio-rule-tile[data-preset]`, the expression
 * `[data-field="styleRule.expression"]`, what is missing `.mapstudio-rule-unsaved`, the tints `[data-field="areaTints"]` with
 * `[data-field="areaTints.property"]`, a category `.mapstudio-tint-row[data-category]` and `.mapstudio-tints-unsaved`.
 * Entry 12b2: Show on map `.mapstudio-kindsetup-show` and the Live now note `.mapstudio-rule-live`.
 * Entry 12c3: "Back to <name>" `.mapstudio-kindsetup-back`, shown when the setup was opened from an item's link.
 *
 * **The tag buttons** (entry 13b). Each path of Key values (a new row's too), Comms and Alarms ends in a tag icon button,
 * "Pick a tag" (`.mapstudio-tag-button[data-tag-for]`, tagBrowser.ts `TagFor`), which opens the tag browser for it
 * (studio/TagBrowser.tsx, drawn by the map component over the map); the row the card is open for takes the selection tint with
 * its 3 px edge (`.mapstudio-kv-row--browsing`, `.mapstudio-kindsetup-field--browsing`). A pick comes back through `usePick`
 * and is saved as a typed path is: one edit of that path, at the setup version seen when the card opened.
 * From entry 13c the style rule's tag path (the shared editor's button, `styleRule.path`: the pick goes into the rule's draft,
 * sent when the rule is complete) and each popup param's value (`param:<name>`, a new row's `param.new:<id>`: the value edit,
 * or the new row's commit, a row with no name staying a draft) have the button too; a param row the card is open for is
 * `.mapstudio-param-row--browsing`.
 */
export interface KindSetupPanelProps {
    kind: Kind;
    /** The kind's stored setup, or undefined when it has none yet (the first save creates it). */
    record: KindSetupRecord | undefined;
    /** The map's live items: the kind's own are counted, searched for overrides and offered as the preview item. */
    items: MapItemRecord[];
    /** The asset list (level `full`), for the preview item's asset folder. */
    assets: Asset[];
    /** The preview item remembered for this kind, or null (the first linked item by name). */
    previewId: string | null;
    onPreview: (itemId: string) => void;
    /** The preview item's live state as the map draws it (entry 12b2), or null before its first values or with no preview item. */
    previewState?: ItemState | null;
    /** Whether the preview item has a style rule of its own: the kind's rule does not draw on it. */
    previewOwnRule?: boolean;
    /** Show on map: the map goes to the preview item. */
    onShowPreview?: (itemId: string) => void;
    /** The kind's saves in flight or waiting, the refusals that stand and the count of saves settled. */
    saves: KindSaveState;
    /** Why the fields take no input, in words, or '' (kindSetup.ts `pausedText`). */
    paused: string;
    /** What `tags.resolve` said per kind, asset and path (kindSetup.ts `resolveKey`). */
    resolves: Record<string, ResolveState>;
    /** The project setup's View alarms page, '' for none; set in the Designer. */
    alarmPage: string;
    /** One finished field: its id, the edit of its part, and the setup version it was typed on. False when the save was not taken. */
    onSave: (field: string, edit: SetupEdit, seen: number) => boolean;
    /** A field put back to what is stored (or the panel leaving, with no field): the refusal's words go. */
    onClearRefusal: (field?: string) => void;
    /** Ask `tags.resolve` for these paths with the preview item's asset. */
    onResolve: (assetId: string, paths: string[]) => void;
    /** The sprite's symbols, for the kind glyph in a preset tile (none yet: the disc alone). */
    symbols?: Record<string, SpriteSymbol>;
    /** The theme's token values the tiles and swatches draw with; null before the map has read them (no tile is drawn). */
    colors?: MarkerColors | null;
    /** Entry 12c3: the item whose link opened this setup, by name: "Back to <name>" shows above the header; absent from the rail. */
    backName?: string;
    /** "Back to <name>": Items again with that item and the tab its link was on. */
    onBack?: () => void;
    /** Entry 13b: the tag button whose card is open (tagBrowser.ts `TagFor`), or null; its row takes the selection tint. */
    browsing?: string | null;
    /** A path's tag button pressed: the tag browser opens for it, at the setup version seen now. No tag button without it. */
    onBrowse?: (tagFor: string, target: PickTarget, seen: number) => void;
    /** The open card's place is gone (the rule no longer shows a tag path field): it closes and changes nothing. */
    onBrowseGone?: () => void;
}

/** A key value row not yet stored: typed here until it has a label and a path, then saved with its key. */
interface NewRow extends NewRowTexts {
    id: string;
    /** Made from the label when the row is first sent; never changed after. */
    key: string | null;
    /** The setup version its first keystroke was typed on. */
    seen: number | null;
    /** What was last sent of it, so a refused row is not sent again unchanged. */
    sent: string;
}

/** A param row not yet stored. */
interface NewParam {
    id: string;
    name: string;
    value: string;
    seen: number | null;
    sent: string;
    /** The name it was last sent under (a refusal names it by that), or null before the first send. */
    sentName: string | null;
}

interface PanelState {
    /** What is typed or just chosen, by field; a field left out shows the stored value. */
    drafts: Record<string, string>;
    /** A field's or a row's own problem in words (nothing of it was sent), by field. */
    problems: Record<string, string>;
    newRows: NewRow[];
    newParams: NewParam[];
    /** The field whose placeholder picker is open, or null. */
    picker: string | null;
    /** The area tints as they are being built; null shows the stored ones. */
    tints: TintsDraft | null;
}

type Result = SetupEdit | { problem: string };

function without<T>(map: Record<string, T>, key: string): Record<string, T> {
    if (!(key in map)) {
        return map;
    }
    const out = { ...map };
    delete out[key];
    return out;
}

/** The star of the Icon value toggle: outlined, filled while on (DESIGN.md Icons: a 24 px grid, a 2 px stroke). */
function Star(props: { on: boolean }): React.ReactElement {
    return (
        <svg className="mapstudio-kv-star-glyph" viewBox="0 0 24 24" width={16} height={16} aria-hidden="true" focusable="false">
            <path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill={props.on ? 'currentColor' : 'none'}
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

let panelCount = 0;

export class KindSetupPanel extends React.Component<KindSetupPanelProps, PanelState> {
    state: PanelState = { drafts: {}, problems: {}, newRows: [], newParams: [], picker: null, tints: null };

    private readonly idBase = 'mapstudio-kindsetup-' + (++panelCount);
    private readonly root = React.createRef<HTMLElement>();
    private rowCount = 0;
    /** The setup version each draft's first keystroke was typed on, by field. */
    private seen: Record<string, number> = {};
    /** The fields sent and not yet settled: the saves settled when each was sent, and whether its save was seen on its way. */
    private awaiting = new Map<string, { done: number; seenSaving: boolean }>();
    /** The text last sent for a field, so a refused field is not sent again unchanged on every blur. */
    private lastSent: Record<string, string> = {};
    /** The field the cursor is in, or null. */
    private focused: string | null = null;
    /** The field whose Esc is blurring it: its blur must not save. */
    private escaped: string | null = null;
    /** The text inputs by field, for the picker's caret and focus. */
    private inputs: Record<string, HTMLInputElement | null> = {};
    private carets: Record<string, [number | null, number | null]> = {};
    /** The field whose picker's choice is being put in: the menu's going is not the cursor leaving the field. */
    private picking: string | null = null;
    /** The asset and paths last asked of `tags.resolve`. */
    private asked = '';
    /** The fields drawn in this render: a refusal that names none of them stands at the panel's top. */
    private drawn = new Set<string>();
    /**
     * The setup version the tints draft is in step with the store at (kindSetup.ts `inStepVersion`): the version it was made from
     * the stored part on, folded from the store on, or its own save settled on; null with no draft. Every send of the draft goes
     * at it, so another editor's save since meets the conflict. (The rule's draft is the shared editor's, studio/RuleEditor.tsx.)
     */
    private tintsBase: number | null = null;
    /** A save of the draft was not taken: the draft is kept as typed, not replaced by the stored part, until it is changed. */
    private tintsKept = false;
    /** The tints last sent, so ones refused are not sent again unchanged. */
    private tintsSent = '';
    /** The tints' controls: while the cursor is in one, the draft is left as typed. */
    private readonly tintsBox = React.createRef<HTMLDivElement>();
    /** A change of the tints is about to be sent: the stored part is not taken into the draft before it has been. */
    private tintsCommitting = false;
    /** The style rule's editor (entry 12c2): its draft says which of the rule's fields are drawn. */
    private readonly ruleEditor = React.createRef<RuleEditor>();
    /** The rows typed for a tints property left for another, by property, until the kind is left. */
    private tintMemory: Record<string, TintRow[]> = {};

    componentDidMount(): void {
        this.askResolve();
    }

    componentWillUnmount(): void {
        this.props.onClearRefusal();
    }

    componentDidUpdate(prevProps: KindSetupPanelProps): void {
        this.askResolve();
        this.settle();
        this.foldStored();
        this.leftBrowsing(prevProps.browsing);
    }

    /**
     * A new row's own card closed, or moved to another button (entry 13b; a new param's too, entry 13c): while it was open the row was not finished when the
     * cursor left it for the card. With the focus not back in the row once the card is gone, the row is finished as a blur
     * finishes it.
     */
    private leftBrowsing(before: string | null | undefined): void {
        const was = before ? readTagFor(before) : null;
        if (!was || (was.part !== 'new' && was.part !== 'newParam') || this.props.browsing === before) {
            return;
        }
        const id = was.rowId;
        const param = was.part === 'newParam';
        // After this draw's own focus moves (the card gives the focus back to the tag button).
        setTimeout(() => {
            const button = this.tagButtonOf(param ? TagFor.newParam(id) : TagFor.newRow(id));
            const row = button ? button.closest(param ? '.mapstudio-param-row' : '.mapstudio-kv-row') : null;
            if (row && !row.contains(document.activeElement)) {
                if (param) {
                    this.commitParam(id);
                } else {
                    this.commitRow(id);
                }
            }
        }, 0);
    }

    private tagButtonOf(tagFor: string): HTMLElement | null {
        const root = this.root.current;
        const buttons = root ? Array.from(root.querySelectorAll<HTMLElement>('.mapstudio-tag-button')) : [];
        return buttons.filter((b) => b.getAttribute('data-tag-for') === tagFor)[0] || null;
    }

    private version(): number {
        return this.props.record ? this.props.record.version : 0;
    }

    private view(): SetupView {
        return readSetup(this.props.record ? this.props.record.setup : null);
    }

    private preview(): PreviewOption | null {
        return previewOf(previewOptions(this.props.items, this.props.kind.id, this.props.assets), this.props.previewId);
    }

    /** The stored paths asked again when the preview item's asset or the set of stored paths changes (a path saved). */
    private askResolve(): void {
        const preview = this.preview();
        const paths = pathsToResolve(this.view());
        const asked = preview ? preview.assetId + '\n' + paths.join('\n') : '';
        if (asked === this.asked) {
            return;
        }
        this.asked = asked;
        if (preview && paths.length > 0) {
            this.props.onResolve(preview.assetId, paths);
        }
    }

    /**
     * The sent fields whose saves settled, and the drafts nothing holds any more: a draft goes (the field shows the store again)
     * once its save is neither in flight nor waiting, no refusal stands for it, the cursor is not in it and it has no problem
     * of its own. A new row or param goes once the stored setup holds it.
     */
    private settle(): void {
        const saves = this.props.saves;
        const settled: string[] = [];
        this.awaiting.forEach((a, field) => {
            if (saves.saving.indexOf(field) >= 0) {
                a.seenSaving = true;
            } else if (a.seenSaving || saves.done > a.done) {
                this.awaiting.delete(field);
                settled.push(field);
            }
        });
        // A new row whose save settled (saved, refused, or its conflict answered) is typed on the stored version from here on.
        const rowField = (r: NewRow): string | null => (r.key !== null ? Fields.kpi(r.key) : null);
        const paramField = (p: NewParam): string | null => (p.sentName !== null ? Fields.param(p.sentName) : null);
        const reseen = forgetSeen(this.state.newRows, rowField, settled) !== this.state.newRows
            || forgetSeen(this.state.newParams, paramField, settled) !== this.state.newParams;
        const refused = (field: string): boolean => saves.refusals.some((r) => r.field === field);
        const drop = Object.keys(this.state.drafts).filter((field) => !this.awaiting.has(field) && !refused(field) && this.focused !== field
            && !this.state.problems[field]);
        const view = this.view();
        const keys = view.kpis.map((k) => k.key);
        const names = view.popupView ? view.popupView.params.map((p) => p.name) : [];
        const rowsGone = this.state.newRows.some((r) => r.key !== null && keys.indexOf(r.key) >= 0);
        const paramsGone = this.state.newParams.some((p) => p.sentName !== null && names.indexOf(p.sentName) >= 0);
        if (drop.length === 0 && !rowsGone && !paramsGone && !reseen) {
            return;
        }
        for (const field of drop) {
            delete this.seen[field];
            delete this.lastSent[field];
        }
        // The focus on a new row's tag button (a pick just came back to it) goes with the row as it becomes a stored one: it is
        // put on the stored row's tag button.
        const active = typeof document !== 'undefined' ? document.activeElement : null;
        const onNew = active && active.getAttribute ? readTagFor(active.getAttribute('data-tag-for') || '') : null;
        const settledRow = onNew && onNew.part === 'new' ? this.state.newRows.find((r) => r.id === onNew.rowId && r.key !== null && keys.indexOf(r.key) >= 0) : undefined;
        const refocus = settledRow && settledRow.key !== null ? TagFor.kpi(settledRow.key) : null;
        this.setState((prev) => {
            const drafts = { ...prev.drafts };
            drop.forEach((field) => delete drafts[field]);
            return {
                drafts,
                newRows: forgetSeen(prev.newRows.filter((r) => r.key === null || keys.indexOf(r.key) < 0), rowField, settled),
                newParams: forgetSeen(prev.newParams.filter((p) => p.sentName === null || names.indexOf(p.sentName) < 0), paramField, settled)
            };
        }, () => {
            const button = refocus !== null ? this.tagButtonOf(refocus) : null;
            if (button && (!document.activeElement || document.activeElement === document.body)) {
                button.focus({ preventScroll: true });
            }
        });
    }

    private dom(field: string, part: string): string {
        return this.idBase + '-' + field.replace(/[^A-Za-z0-9]/g, '_') + '-' + part;
    }

    private off(): boolean {
        return this.props.paused !== '';
    }

    // ---- Sending ----

    /** One edit sent for a field: at the version its draft was typed on, else the stored one. False when it was not taken. */
    private send(field: string, edit: SetupEdit, seen?: number | null): boolean {
        const typedOn = seen !== undefined && seen !== null ? seen : this.seen[field] !== undefined ? this.seen[field] : this.version();
        delete this.seen[field];
        const taken = this.props.onSave(field, edit, typedOn);
        if (taken) {
            this.awaiting.set(field, { done: this.props.saves.done, seenSaving: false });
        }
        return taken;
    }

    private dropDraft(field: string): void {
        delete this.seen[field];
        delete this.lastSent[field];
        this.awaiting.delete(field);
        this.setState((prev) => ({ drafts: without(prev.drafts, field), problems: without(prev.problems, field) }));
    }

    private hasRefusal(field: string): boolean {
        return this.props.saves.refusals.some((r) => r.field === field);
    }

    private onText = (field: string) => (ev: React.ChangeEvent<HTMLInputElement>): void => {
        const text = ev.target.value;
        if (this.state.drafts[field] === undefined) {
            // The version the field is typed on: another editor's save after this meets the conflict when the field is finished.
            this.seen[field] = this.version();
        }
        this.setState((prev) => ({ drafts: { ...prev.drafts, [field]: text } }));
    };

    /**
     * A text field finished (blur or Enter): what is stored already saves nothing; a value its part cannot take says so beside
     * the field and is not sent; else the edit is sent and the field shows what was typed until the save settles.
     */
    private commit(field: string, stored: string, edit: (text: string) => Result): void {
        if (this.escaped === field) {
            return;
        }
        const draft = this.state.drafts[field];
        if (draft === undefined || this.off()) {
            return;
        }
        const text = draft.trim();
        if (text === stored) {
            if (this.hasRefusal(field)) {
                this.props.onClearRefusal(field);
            }
            this.dropDraft(field);
            return;
        }
        if (this.hasRefusal(field) && this.lastSent[field] === text) {
            // Refused as it is: nothing new to send until it is changed.
            return;
        }
        const result = edit(text);
        if ('problem' in result) {
            const problem = result.problem;
            this.setState((prev) => ({ problems: { ...prev.problems, [field]: problem } }));
            return;
        }
        this.lastSent[field] = text;
        this.setState((prev) => ({ drafts: { ...prev.drafts, [field]: text }, problems: without(prev.problems, field) }));
        if (!this.send(field, result)) {
            this.dropDraft(field);
        }
    }

    /** Enter finishes a field (its blur saves it); Esc puts the stored value back and saves nothing. */
    private onKey = (field: string) => (ev: React.KeyboardEvent<HTMLInputElement>): void => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            ev.currentTarget.blur();
        } else if (ev.key === 'Escape') {
            ev.preventDefault();
            ev.stopPropagation();
            this.escaped = field;
            if (this.hasRefusal(field)) {
                this.props.onClearRefusal(field);
            }
            this.dropDraft(field);
            ev.currentTarget.blur();
            this.escaped = null;
        }
    };

    /** A switch, a checkbox or the star: saved at once, showing the choice until the save settles. */
    private choose(field: string, edit: SetupEdit, value: boolean): void {
        if (this.off()) {
            return;
        }
        this.setState((prev) => ({ drafts: { ...prev.drafts, [field]: String(value) } }));
        if (!this.send(field, edit, this.version())) {
            this.dropDraft(field);
        }
    }

    private flag(field: string, stored: boolean): boolean {
        const draft = this.state.drafts[field];
        return draft === undefined ? stored : draft === 'true';
    }

    // ---- What stands beside a field ----

    /** A field's own problem and the refusals that name it (`ats`: the field, and for a row its other names). */
    private messages(field: string, ats: string[] = [field]): { nodes: React.ReactNode; ids: string[]; invalid: boolean } {
        ats.forEach((at) => this.drawn.add(at));
        const nodes: React.ReactNode[] = [];
        const ids: string[] = [];
        const problem = this.state.problems[field] || '';
        if (problem !== '') {
            const id = this.dom(field, 'problem');
            ids.push(id);
            nodes.push(<span key="problem" id={id} className="mapstudio-field-hint mapstudio-field-problem" aria-live="polite">{problem}</span>);
        }
        const refusals = this.props.saves.refusals.filter((r) => r.words !== '' && ats.indexOf(r.at) >= 0);
        refusals.forEach((r, i) => {
            const id = this.dom(field, 'refusal' + i);
            ids.push(id);
            // A save problem: the warning token, always with its glyph and the Gateway's words (DESIGN.md Colors).
            nodes.push(
                <span key={'refusal' + i} id={id} className="mapstudio-field-refusal" role="alert" data-at={r.at}>
                    <ChromeGlyph name="warning" className="mapstudio-field-refusal-glyph" size={14} />
                    <span className="mapstudio-field-refusal-text">{r.words}</span>
                </span>
            );
        });
        return { nodes, ids, invalid: nodes.length > 0 };
    }

    /** The refusals that name no field drawn: at the panel's top, each with all its words. */
    private topRefusals(): KindRefusal[] {
        return this.props.saves.refusals.filter((r) => r.words !== '' && (r.at === '' || !this.drawn.has(r.at)));
    }

    /** The resolve note under a stored tag path, for the preview item's asset; none with no preview item. */
    private note(path: string): React.ReactNode {
        const preview = this.preview();
        if (!preview) {
            return null;
        }
        const note = resolveNote(path, this.props.kind, this.props.resolves[resolveKey(this.props.kind.id, preview.assetId, path)]);
        if (!note) {
            return null;
        }
        return (
            <span className={'mapstudio-resolve-note' + (note.warning ? ' mapstudio-resolve-note--warning' : '')} data-state={note.state}
                  data-warning={note.warning ? 'true' : 'false'} data-path={path}>
                {note.warning ? <ChromeGlyph name="warning" className="mapstudio-resolve-note-glyph" size={12} /> : null}
                <span className="mapstudio-resolve-note-text">{note.text}</span>
            </span>
        );
    }

    // ---- The controls ----

    /** A text input bound to a field's draft, saved when finished. */
    private text(o: { field: string; stored: string; label: string; edit: (text: string) => Result; mono?: boolean; placeholder?: string;
        labelledBy?: string; describedBy?: string[]; invalid?: boolean; disabled?: boolean; picker?: boolean }): React.ReactElement {
        const draft = this.state.drafts[o.field];
        return (
            <input ref={(el) => { this.inputs[o.field] = el; }} type="text"
                   className={'mapstudio-input mapstudio-kindsetup-input' + (o.mono ? ' mapstudio-mono' : '')}
                   value={draft !== undefined ? draft : o.stored} placeholder={o.placeholder} disabled={this.off() || o.disabled === true}
                   aria-label={o.labelledBy ? undefined : o.label} aria-labelledby={o.labelledBy}
                   aria-invalid={o.invalid === true} aria-describedby={o.describedBy && o.describedBy.length > 0 ? o.describedBy.join(' ') : undefined}
                   autoComplete="off" spellCheck={false}
                   onFocus={() => { this.focused = o.field; }}
                   onChange={this.onText(o.field)}
                   onBlur={(ev) => {
                       this.carets[o.field] = [ev.currentTarget.selectionStart, ev.currentTarget.selectionEnd];
                       if (o.picker && this.inPicker(ev.relatedTarget, o.field)) {
                           // Into the field's own picker: what it inserts is part of this edit, which is finished when the cursor
                           // leaves the field and its picker both.
                           return;
                       }
                       this.focused = this.focused === o.field ? null : this.focused;
                       this.commit(o.field, o.stored, o.edit);
                   }}
                   onKeyDown={this.onKey(o.field)} />
        );
    }

    /** A switch or a checkbox bound to a boolean of the setup, saved at once. */
    private toggle(o: { field: string; dataField?: string; stored: boolean; label: string; edit: (on: boolean) => SetupEdit; off?: string;
        kind: 'switch' | 'checkbox' }): React.ReactElement {
        const id = this.dom(o.dataField || o.field, 'toggle');
        const m = this.messages(o.field, o.dataField ? [] : [o.field]);
        const disabled = this.off() || (o.off !== undefined && o.off !== '');
        return (
            <div className={'mapstudio-kindsetup-toggle mapstudio-kindsetup-toggle--' + o.kind} data-field={o.dataField || o.field}
                 data-on={this.flag(o.field, o.stored) ? 'true' : 'false'}>
                <span className="mapstudio-field-check-row" title={o.off || undefined}>
                    <input id={id} type="checkbox" role={o.kind === 'switch' ? 'switch' : undefined}
                           className={o.kind === 'switch' ? 'mapstudio-switch' : 'mapstudio-field-check'}
                           checked={this.flag(o.field, o.stored)} disabled={disabled}
                           aria-describedby={m.ids.length > 0 ? m.ids.join(' ') : undefined}
                           onChange={(ev) => this.choose(o.field, o.edit(ev.target.checked), ev.target.checked)} />
                    <label className="mapstudio-field-check-label" htmlFor={id}>{o.label}</label>
                </span>
                {o.dataField ? null : m.nodes}
            </div>
        );
    }

    // ---- The placeholder picker ----

    /** Whether a focus target is in `field`'s own picker (its button or its open menu). */
    private inPicker(target: EventTarget | null, field: string): boolean {
        const el = target as HTMLElement | null;
        const holder = el && typeof el.closest === 'function' ? el.closest('.mapstudio-placeholder') : null;
        const button = holder ? holder.querySelector('[data-picker-for]') : null;
        return !!button && button.getAttribute('data-picker-for') === field;
    }

    /**
     * The placeholder picker beside a field: a button that opens the closed list as a menu. A choice is handed to `insert` and the
     * cursor goes back to the field; Esc closes the menu, the focus back on the button. When the focus leaves the picker for
     * anywhere but its field, the menu closes and the field is finished (`finish`), as when the cursor leaves the field itself.
     */
    private pickerButton(field: string, insert: (placeholder: string) => void, finish?: () => void): React.ReactNode {
        const open = this.state.picker === field;
        const menuId = this.dom(field, 'placeholders');
        return (
            <span className="mapstudio-placeholder"
                  onBlur={(ev) => {
                      const to = ev.relatedTarget as Node | null;
                      if (this.picking === field || (to && (ev.currentTarget.contains(to) || to === this.inputs[field]))) {
                          return;
                      }
                      this.closePicker(field, false);
                      if (finish) {
                          this.focused = this.focused === field ? null : this.focused;
                          finish();
                      }
                  }}>
                <button type="button" className="mapstudio-button mapstudio-placeholder-button" data-picker-for={field} disabled={this.off()}
                        title="Insert a placeholder" aria-label="Insert a placeholder" aria-haspopup="menu" aria-expanded={open}
                        aria-controls={open ? menuId : undefined}
                        onClick={() => this.setState((prev) => ({ picker: prev.picker === field ? null : field }))}>
                    <span aria-hidden="true">{'{ }'}</span>
                </button>
                {open ? (
                    <div id={menuId} className="mapstudio-placeholder-menu" role="menu" aria-label="Placeholders"
                         onKeyDown={(ev) => {
                             if (ev.key === 'Escape') {
                                 ev.preventDefault();
                                 ev.stopPropagation();
                                 this.closePicker(field, true);
                             }
                         }}>
                        {placeholderList(this.props.kind).map((p, i) => (
                            <button key={p} type="button" role="menuitem" className="mapstudio-placeholder-item mapstudio-mono" autoFocus={i === 0}
                                    data-placeholder={p}
                                    // The press keeps the focus where it is (some browsers give a pressed button none), so the menu
                                    // does not close under the click.
                                    onMouseDown={(ev) => ev.preventDefault()}
                                    onClick={() => {
                                        // The menu goes with the focus in it: that is no leaving of the field.
                                        this.picking = field;
                                        this.setState({ picker: null });
                                        insert(p);
                                    }}>{p}</button>
                        ))}
                    </div>
                ) : null}
            </span>
        );
    }

    private closePicker(field: string, focusButton: boolean): void {
        this.setState((prev) => (prev.picker === field ? { picker: null } : null));
        if (focusButton) {
            const root = this.inputs[field] ? this.inputs[field]!.closest('.mapstudio-kindsetup') : null;
            const buttons = root ? Array.from(root.querySelectorAll<HTMLElement>('.mapstudio-placeholder-button')) : [];
            const button = buttons.filter((b) => b.getAttribute('data-picker-for') === field)[0];
            if (button) {
                button.focus();
            }
        }
    }

    /** A field's draft set by the picker, the cursor put back in the field: it saves when finished, as typing does. */
    private setDraft(field: string, text: string): void {
        if (this.state.drafts[field] === undefined) {
            this.seen[field] = this.version();
        }
        this.setState((prev) => ({ drafts: { ...prev.drafts, [field]: text } }), () => this.focusInput(field));
    }

    private focusInput(field: string): void {
        const input = this.inputs[field];
        if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }
        this.picking = null;
    }

    // ---- The tag buttons (entry 13b) ----

    /** The tag icon button at the end of a path: it opens the tag browser for that path. */
    private tagButton(tagFor: string, target: PickTarget, name: string): React.ReactNode {
        const onBrowse = this.props.onBrowse;
        if (!onBrowse) {
            return null;
        }
        const open = this.props.browsing === tagFor;
        return (
            <button type="button" className={'mapstudio-dock-button mapstudio-tag-button' + (open ? ' mapstudio-tag-button--open' : '')}
                    data-tag-for={tagFor} disabled={this.off()} title="Pick a tag" aria-label={'Pick a tag for ' + name}
                    aria-haspopup="dialog" aria-expanded={open} onClick={() => onBrowse(tagFor, target, this.version())}>
                <ChromeGlyph name="tag" size={16} />
            </button>
        );
    }

    /**
     * A pick from the tag browser, saved as a typed path is: one edit of that path, sent at the setup version seen when the card
     * opened (another editor's save since meets the conflict), the field showing the path until the save settles. A new row
     * takes the path and is saved once it has its label, as when its path is typed. Returns '' when the pick was taken (a path
     * that is the stored one saves nothing and is taken too), else why it was not saved, in words for the card.
     */
    usePick(tagFor: string, path: string, seen: number): string {
        const what = readTagFor(tagFor);
        if (!what || path === '') {
            return 'Not saved. This path cannot take a pick.';
        }
        if (this.off()) {
            return 'Not saved. ' + this.props.paused;
        }
        if (what.part === 'new') {
            const id = what.rowId;
            if (!this.state.newRows.some((r) => r.id === id)) {
                return 'Not saved. This key value row is gone.';
            }
            this.setState((prev) => ({
                newRows: prev.newRows.map((r) => (r.id === id ? { ...r, path, seen: r.seen !== null ? r.seen : seen } : r))
            }), () => this.commitRow(id));
            return '';
        }
        if (what.part === 'rule') {
            // The rule's draft takes the path and sends the rule when it is complete, at the version the draft is in step with
            // the store at (the editor's own, not the card's): "Not saved yet" until then.
            const editor = this.ruleEditor.current;
            return editor ? editor.usePath(path) : 'Not saved. The style rule is no longer open.';
        }
        if (what.part === 'newParam') {
            const id = what.rowId;
            if (!this.state.newParams.some((p) => p.id === id)) {
                return 'Not saved. This param row is gone.';
            }
            // The value is filled and the row commits as when typed: a row with no name stays a draft and says so.
            this.setState((prev) => ({
                newParams: prev.newParams.map((p) => (p.id === id ? { ...p, value: path, seen: p.seen !== null ? p.seen : seen } : p))
            }), () => this.commitParam(id));
            return '';
        }
        if (what.part === 'override' || what.part === 'ownRule') {
            return 'Not saved. This path cannot take a pick.';
        }
        const view = this.view();
        let field: string;
        let stored: string;
        let edit: SetupEdit;
        if (what.part === 'param') {
            const name = what.name;
            const param = view.popupView ? view.popupView.params.find((p) => p.name === name) : undefined;
            if (!param) {
                return 'Not saved. This param is gone.';
            }
            field = 'param:' + name + ':value';
            stored = param.value;
            edit = { part: 'param.value', name, value: path };
        } else if (what.part === 'comms') {
            field = Fields.commsPath;
            stored = view.comms ? view.comms.path : '';
            edit = { part: 'comms.path', path };
        } else if (what.part === 'alarms') {
            field = Fields.alarmsPath;
            stored = view.alarms ? view.alarms.path : '';
            edit = { part: 'alarms.path', path };
        } else {
            const kpi = view.kpis.find((k) => k.key === what.key);
            if (!kpi) {
                return 'Not saved. This key value row is gone.';
            }
            field = Fields.kpi(what.key, 'path');
            stored = kpi.path;
            edit = { part: 'kpi', key: what.key, patch: { path } };
        }
        if (this.hasRefusal(field)) {
            this.props.onClearRefusal(field);
        }
        if (path === stored) {
            this.dropDraft(field);
            return '';
        }
        if (!this.send(field, edit, seen)) {
            this.dropDraft(field);
            return 'Not saved. Map Studio could not take the save now. Try again.';
        }
        this.lastSent[field] = path;
        this.setState((prev) => ({ drafts: { ...prev.drafts, [field]: path }, problems: without(prev.problems, field) }));
        return '';
    }

    // ---- Key values ----

    private rowField(row: NewRow): string {
        return row.key !== null ? Fields.kpi(row.key) : 'kpis.new:' + row.id;
    }

    private onAddRow = (): void => {
        const id = 'r' + (++this.rowCount);
        this.setState((prev) => ({ newRows: prev.newRows.concat([{ id, key: null, label: '', path: '', unit: '', seen: null, sent: '' }]) }),
            () => this.focusInput('kpis.new:' + id + '.label'));
    };

    private setRow(id: string, patch: Partial<NewRow>): void {
        const version = this.version();
        this.setState((prev) => ({
            newRows: prev.newRows.map((r) => (r.id === id ? { ...r, ...patch, seen: r.seen !== null ? r.seen : version } : r))
        }));
    }

    /**
     * A new row finished (the cursor left it, or Enter): without a label or a path it is not sent and says what is missing; else
     * its key is made from the label, once, and the row is saved.
     */
    private commitRow(id: string): void {
        const row = this.state.newRows.find((r) => r.id === id);
        if (!row || this.off()) {
            return;
        }
        const field = this.rowField(row);
        const missing = rowMissing(row.label, row.path);
        if (missing !== '') {
            this.setState((prev) => ({ problems: { ...prev.problems, [field]: missing } }));
            return;
        }
        const texts = { label: row.label.trim(), path: row.path.trim(), unit: row.unit.trim() };
        const sent = JSON.stringify(texts);
        if (row.sent === sent && (this.awaiting.has(field) || this.hasRefusal(field))) {
            return;
        }
        const taken = this.view().kpis.map((k) => k.key).concat(this.state.newRows.filter((r) => r.id !== id && r.key !== null).map((r) => r.key as string));
        const key = row.key !== null ? row.key : keyFromLabel(texts.label, taken);
        const keyed = Fields.kpi(key);
        this.setState((prev) => ({
            newRows: prev.newRows.map((r) => (r.id === id ? { ...r, ...texts, key, sent } : r)),
            problems: without(without(prev.problems, field), keyed)
        }));
        this.send(keyed, { part: 'kpi.add', row: { key, ...texts } }, row.seen);
    }

    private removeRow(id: string): void {
        const row = this.state.newRows.find((r) => r.id === id);
        if (row && row.key !== null && this.hasRefusal(Fields.kpi(row.key))) {
            this.props.onClearRefusal(Fields.kpi(row.key));
        }
        this.setState((prev) => ({ newRows: prev.newRows.filter((r) => r.id !== id) }));
    }

    /** A new row: the same three inputs, typed here; its switch and star come once it is saved. */
    private renderNewRow(row: NewRow, index: number): React.ReactElement {
        const field = this.rowField(row);
        const ats = row.key !== null ? [field, Fields.kpi(row.key, 'label'), Fields.kpi(row.key, 'path'), Fields.kpi(row.key, 'unit'),
            Fields.kpi(row.key, 'on'), Fields.kpi(row.key, 'icon')] : [field];
        const m = this.messages(field, ats);
        const tagFor = TagFor.newRow(row.id);
        const browsing = this.props.browsing === tagFor;
        const input = (part: 'label' | 'path' | 'unit', label: string, placeholder: string, mono: boolean): React.ReactElement => (
            <input ref={(el) => { this.inputs['kpis.new:' + row.id + '.' + part] = el; }} type="text"
                   className={'mapstudio-input mapstudio-kindsetup-input' + (mono ? ' mapstudio-mono' : '')} value={row[part]} placeholder={placeholder}
                   aria-label={label} aria-invalid={m.invalid} aria-describedby={m.ids.length > 0 ? m.ids.join(' ') : undefined}
                   disabled={this.off()} autoComplete="off" spellCheck={false}
                   onChange={(ev) => this.setRow(row.id, { [part]: ev.target.value })}
                   onKeyDown={(ev) => {
                       if (ev.key === 'Enter') {
                           ev.preventDefault();
                           this.commitRow(row.id);
                       }
                   }} />
        );
        return (
            <div key={'new:' + row.id} className={'mapstudio-kv-row mapstudio-kv-row--new' + (browsing ? ' mapstudio-kv-row--browsing' : '')}
                 role="group" aria-label={'New key value ' + (index + 1)}
                 data-key={row.key || ''} data-new="true" data-field={field}
                 onBlur={(ev) => {
                     const to = ev.relatedTarget as Node | null;
                     // Into the row's own tag browser: the row is not finished until its path is picked or the card is left.
                     if (this.props.browsing !== tagFor && (!to || !ev.currentTarget.contains(to))) {
                         this.commitRow(row.id);
                     }
                 }}>
                <div className="mapstudio-kv-line">
                    <div className="mapstudio-kv-label">{input('label', 'Label', 'Label', false)}</div>
                    <div className="mapstudio-kv-unit">{input('unit', 'Unit', 'Unit', false)}</div>
                </div>
                <div className="mapstudio-kv-path">
                    <div className="mapstudio-kindsetup-with-picker">
                        {input('path', 'Tag path', '{asset.path}/Pressure', true)}
                        {this.tagButton(tagFor, { part: 'kpi', index: this.view().kpis.length + index + 1 }, 'new key value ' + (index + 1))}
                    </div>
                </div>
                {m.nodes}
                <div className="mapstudio-kv-actions">
                    <span className="mapstudio-field-hint mapstudio-kv-new-hint">Saved once it has a label and a tag path.</span>
                    <button type="button" className="mapstudio-dock-button mapstudio-kv-remove" disabled={this.off()} title="Remove this row"
                            aria-label={'Remove new key value ' + (index + 1)}
                            // The press must not finish the row first (a browser that gives a pressed button no focus blurs the row).
                            onMouseDown={(ev) => ev.preventDefault()} onClick={() => this.removeRow(row.id)}>
                        <ChromeGlyph name="trash" size={16} />
                    </button>
                </div>
            </div>
        );
    }

    /** A stored row: each of its values saved when finished, by its key. */
    private renderRow(kpi: KeyValue, view: SetupView): React.ReactElement {
        const key = kpi.key;
        const tagFor = TagFor.kpi(key);
        const name = kpi.label !== '' ? kpi.label : key;
        const label = this.messages(Fields.kpi(key, 'label'));
        const unit = this.messages(Fields.kpi(key, 'unit'));
        const path = this.messages(Fields.kpi(key, 'path'));
        const row = this.messages(Fields.kpi(key));
        const icon = this.messages(Fields.kpi(key, 'icon'));
        const blocked = removeBlocked(view, key);
        const starred = this.flag(Fields.kpi(key, 'icon'), kpi.icon);
        return (
            <div key={key} className={'mapstudio-kv-row' + (this.props.browsing === tagFor ? ' mapstudio-kv-row--browsing' : '')} role="group"
                 aria-label={name} data-key={key} data-new="false">
                <div className="mapstudio-kv-line">
                    <div className="mapstudio-kv-label" data-field={Fields.kpi(key, 'label')}>
                        {this.text({ field: Fields.kpi(key, 'label'), stored: kpi.label, label: 'Label of ' + name, placeholder: 'Label',
                            invalid: label.invalid, describedBy: label.ids,
                            edit: (text) => (text === '' ? { problem: 'Type a label. This change is not saved.' } : { part: 'kpi', key, patch: { label: text } }) })}
                    </div>
                    <div className="mapstudio-kv-unit" data-field={Fields.kpi(key, 'unit')}>
                        {this.text({ field: Fields.kpi(key, 'unit'), stored: kpi.unit, label: 'Unit of ' + name, placeholder: 'Unit',
                            invalid: unit.invalid, describedBy: unit.ids, edit: (text) => ({ part: 'kpi', key, patch: { unit: text } }) })}
                    </div>
                </div>
                {label.nodes}
                {unit.nodes}
                <div className="mapstudio-kv-path" data-field={Fields.kpi(key, 'path')}>
                    <div className="mapstudio-kindsetup-with-picker">
                        {this.text({ field: Fields.kpi(key, 'path'), stored: kpi.path, label: 'Tag path of ' + name, mono: true, placeholder: '{asset.path}/Pressure',
                            invalid: path.invalid, describedBy: path.ids,
                            edit: (text) => (text === '' ? { problem: 'Type a tag path. This change is not saved.' } : { part: 'kpi', key, patch: { path: text } }) })}
                        {this.tagButton(tagFor, { part: 'kpi', index: view.kpis.indexOf(kpi) + 1 }, name)}
                    </div>
                    {path.nodes}
                    {this.note(kpi.path)}
                </div>
                <div className="mapstudio-kv-actions">
                    {this.toggle({ field: Fields.kpi(key, 'on'), stored: kpi.on, label: 'In popup', kind: 'switch',
                        edit: (on) => ({ part: 'kpi', key, patch: { on } }) })}
                    <span data-field={Fields.kpi(key, 'icon')} data-on={starred ? 'true' : 'false'}>
                        <button type="button" className={'mapstudio-button mapstudio-kv-star' + (starred ? ' mapstudio-kv-star--on' : '')}
                                aria-pressed={starred} disabled={this.off()}
                                title={starred ? 'The icon value: shown on the map icon' : 'Make this the icon value, shown on the map icon'}
                                onClick={() => this.choose(Fields.kpi(key, 'icon'), { part: 'kpi.icon', key, icon: !starred }, !starred)}>
                            <Star on={starred} />
                            <span>Icon value</span>
                        </button>
                    </span>
                    <button type="button" className="mapstudio-dock-button mapstudio-kv-remove" disabled={this.off() || blocked !== ''}
                            title={blocked !== '' ? blocked : 'Remove this key value'} aria-label={'Remove ' + name} data-blocked={blocked}
                            onClick={() => this.send(Fields.kpi(key), { part: 'kpi.remove', key }, this.version())}>
                        <ChromeGlyph name="trash" size={16} />
                    </button>
                </div>
                {blocked !== '' ? <span className="mapstudio-kindsetup-tag mapstudio-kv-used">Used by style rule</span> : null}
                {icon.nodes}
                {row.nodes}
            </div>
        );
    }

    // ---- Popup view params ----

    private onAddParam = (): void => {
        const id = 'p' + (++this.rowCount);
        this.setState((prev) => ({ newParams: prev.newParams.concat([{ id, name: '', value: '', seen: null, sent: '', sentName: null }]) }),
            () => this.focusInput('param.new:' + id + '.name'));
    };

    private setParam(id: string, patch: Partial<NewParam>, then?: () => void): void {
        const version = this.version();
        this.setState((prev) => ({
            newParams: prev.newParams.map((p) => (p.id === id ? { ...p, ...patch, seen: p.seen !== null ? p.seen : version } : p))
        }), then);
    }

    /** A new param finished: without a name of its own it is not sent and says so; else it is saved. */
    private commitParam(id: string): void {
        const param = this.state.newParams.find((p) => p.id === id);
        const view = this.view();
        if (!param || this.off() || !view.popupView) {
            return;
        }
        const own = 'param.new:' + id;
        const name = param.name.trim();
        const others = view.popupView.params.map((p) => p.name)
            .concat(this.state.newParams.filter((p) => p.id !== id && p.sentName !== null).map((p) => p.sentName as string));
        const missing = paramMissing(name, others);
        if (missing !== '') {
            this.setState((prev) => ({ problems: { ...prev.problems, [own]: missing } }));
            return;
        }
        const value = param.value.trim();
        const sent = JSON.stringify([name, value]);
        const field = Fields.param(name);
        if (param.sent === sent && (this.awaiting.has(field) || this.hasRefusal(field))) {
            return;
        }
        if (param.sentName !== null && param.sentName !== name && this.hasRefusal(Fields.param(param.sentName))) {
            // Sent again under another name: what the old name was refused for no longer stands.
            this.props.onClearRefusal(Fields.param(param.sentName));
        }
        this.setState((prev) => ({
            newParams: prev.newParams.map((p) => (p.id === id ? { ...p, name, value, sent, sentName: name } : p)),
            problems: without(prev.problems, own)
        }));
        this.send(field, { part: 'param.add', name, value }, param.seen);
    }

    private removeParam(id: string): void {
        const param = this.state.newParams.find((p) => p.id === id);
        if (param && param.sentName !== null && this.hasRefusal(Fields.param(param.sentName))) {
            this.props.onClearRefusal(Fields.param(param.sentName));
        }
        this.setState((prev) => ({ newParams: prev.newParams.filter((p) => p.id !== id), problems: without(prev.problems, 'param.new:' + id) }));
    }

    private renderNewParam(param: NewParam, index: number): React.ReactElement {
        const own = 'param.new:' + param.id;
        // A refusal names the row by the name it was sent under.
        const named = param.sentName !== null ? Fields.param(param.sentName) : own;
        const m = this.messages(own, param.sentName !== null ? [named] : []);
        const tagFor = TagFor.newParam(param.id);
        const browsing = this.props.browsing === tagFor;
        const input = (part: 'name' | 'value', label: string, placeholder: string): React.ReactElement => (
            <input ref={(el) => { this.inputs[own + '.' + part] = el; }} type="text"
                   className={'mapstudio-input mapstudio-kindsetup-input mapstudio-param-' + part + (part === 'value' ? ' mapstudio-mono' : '')}
                   value={param[part]} placeholder={placeholder} aria-label={label} aria-invalid={m.invalid}
                   aria-describedby={m.ids.length > 0 ? m.ids.join(' ') : undefined} disabled={this.off()} autoComplete="off" spellCheck={false}
                   onChange={(ev) => this.setParam(param.id, { [part]: ev.target.value })}
                   onKeyDown={(ev) => {
                       if (ev.key === 'Enter') {
                           ev.preventDefault();
                           this.commitParam(param.id);
                       }
                   }} />
        );
        return (
            <div key={'new:' + param.id} className={'mapstudio-param-row mapstudio-param-row--new' + (browsing ? ' mapstudio-param-row--browsing' : '')}
                 role="group" aria-label={'New param ' + (index + 1)}
                 data-name={param.name.trim()} data-new="true" data-field={named}
                 onBlur={(ev) => {
                     const to = ev.relatedTarget as Node | null;
                     // Into the row's own tag browser (entry 13c): the row is not finished until its value is picked or the card is left.
                     if (this.picking === null && this.props.browsing !== tagFor && (!to || !ev.currentTarget.contains(to))) {
                         this.commitParam(param.id);
                     }
                 }}>
                <div className="mapstudio-param-line">
                    {input('name', 'Param name', 'Name')}
                    {input('value', 'Param value', 'Value')}
                    {this.pickerButton(own + '.value', (p) => this.setParam(param.id, { value: p }, () => this.focusInput(own + '.value')))}
                    {this.tagButton(tagFor, { part: 'param', name: param.name.trim() }, 'new param ' + (index + 1))}
                    <button type="button" className="mapstudio-dock-button mapstudio-param-remove" disabled={this.off()} title="Remove this param"
                            aria-label={'Remove new param ' + (index + 1)} onMouseDown={(ev) => ev.preventDefault()}
                            onClick={() => this.removeParam(param.id)}>
                        <ChromeGlyph name="trash" size={16} />
                    </button>
                </div>
                {m.nodes}
            </div>
        );
    }

    private renderParam(param: Param, others: string[]): React.ReactElement {
        const name = param.name;
        const nameField = 'param:' + name + ':name';
        const valueField = 'param:' + name + ':value';
        // A rename's refusal names the row by the name typed, so the row answers to that name too.
        const typed = (this.state.drafts[nameField] || '').trim();
        const m = this.messages(valueField, typed !== '' && typed !== name ? [Fields.param(name), Fields.param(typed)] : [Fields.param(name)]);
        const n = this.messages(nameField, []);
        const ids = m.ids.concat(n.ids);
        return (
            <div key={name} className={'mapstudio-param-row' + (this.props.browsing === TagFor.param(name) ? ' mapstudio-param-row--browsing' : '')}
                 role="group" aria-label={'Param ' + name} data-name={name} data-new="false" data-field={Fields.param(name)}>
                <div className="mapstudio-param-line">
                    <span className="mapstudio-param-name">
                        {this.text({ field: nameField, stored: name, label: 'Name of param ' + name, placeholder: 'Name', invalid: m.invalid || n.invalid,
                            describedBy: ids,
                            edit: (text) => {
                                const missing = paramMissing(text, others).replace('This param is not saved yet.', 'This change is not saved.');
                                return missing !== '' ? { problem: missing } : { part: 'param.name', name, to: text };
                            } })}
                    </span>
                    <span className="mapstudio-param-value">
                        {this.text({ field: valueField, stored: param.value, label: 'Value of param ' + name, mono: true, placeholder: 'Value',
                            invalid: m.invalid, describedBy: ids, picker: true, edit: (text) => ({ part: 'param.value', name, value: text }) })}
                    </span>
                    {this.pickerButton(valueField, (p) => this.setDraft(valueField, p),
                        () => this.commit(valueField, param.value, (text) => ({ part: 'param.value', name, value: text })))}
                    {this.tagButton(TagFor.param(name), { part: 'param', name }, 'param ' + name)}
                    <button type="button" className="mapstudio-dock-button mapstudio-param-remove" disabled={this.off()} title="Remove this param"
                            aria-label={'Remove param ' + name} onClick={() => this.send(Fields.param(name), { part: 'param.remove', name }, this.version())}>
                        <ChromeGlyph name="trash" size={16} />
                    </button>
                </div>
                {n.nodes}
                {m.nodes}
            </div>
        );
    }

    // ---- Section 6: the style rule and the area tints (entry 12b1) ----

    /** Whether the cursor is in a box of controls. */
    private focusIn(box: React.RefObject<HTMLDivElement>): boolean {
        const el = box.current;
        return typeof document !== 'undefined' && !!el && el.contains(document.activeElement);
    }

    /** Whether a save of `field` is on its way or stands refused: the draft is then left alone. */
    private held(field: string): boolean {
        return this.awaiting.has(field) || this.hasRefusal(field) || this.props.saves.saving.indexOf(field) >= 0;
    }

    /**
     * The stored tints taken into their draft once nothing holds it (no save on its way or refused, the cursor elsewhere, the
     * draft whole): another editor's tints show, and a save that was given up leaves the store's. A draft still being built
     * ("Not saved yet") is never overwritten. The rule's draft does the same in its own editor.
     */
    private foldStored(): void {
        const kind = this.props.kind;
        const view = this.view();
        const tints = this.state.tints;
        if (tints !== null && !this.tintsCommitting) {
            const held = this.held(Fields.areaTints);
            const whole = checkTints(tints, kind).tints;
            const same = sameTints(tints, view.areaTints, kind);
            const stored = checkTints(tintsDraft(view.areaTints, kind), kind).tints;
            const settled = this.tintsSent !== '' && stored !== undefined && JSON.stringify(stored) === this.tintsSent;
            this.tintsBase = inStepVersion(this.tintsBase !== null ? this.tintsBase : this.version(), this.version(), { held, same, settled });
            if (!held && !same && whole !== undefined && !this.tintsKept && !this.focusIn(this.tintsBox)) {
                this.tintsBase = null;
                this.setState({ tints: null });
            }
        }
    }

    private tintsNow(view: SetupView): TintsDraft {
        return this.state.tints || tintsDraft(view.areaTints, this.props.kind);
    }

    private editTints(change: (draft: TintsDraft) => TintsDraft, commit: boolean, structure = false): void {
        if (this.off()) {
            return;
        }
        if (this.tintsBase === null) {
            this.tintsBase = this.version();
        }
        this.tintsKept = false;
        if (structure && this.hasRefusal(Fields.areaTints)) {
            this.props.onClearRefusal(Fields.areaTints);
        }
        this.tintsCommitting = this.tintsCommitting || commit;
        this.setState((prev) => ({ tints: change(prev.tints || tintsDraft(this.view().areaTints, this.props.kind)) }), commit ? () => {
            this.tintsCommitting = false;
            this.commitTints();
        } : undefined);
    }

    /** The tints sent when they are whole and not what is stored: one `areaTints` edit, the whole part; no property removes it. */
    private commitTints(): void {
        const draft = this.state.tints;
        if (draft === null || this.off()) {
            return;
        }
        const field = Fields.areaTints;
        const check = checkTints(draft, this.props.kind);
        if (check.tints === undefined) {
            return;
        }
        const json = JSON.stringify(check.tints);
        if (!this.awaiting.has(field) && sameTints(draft, this.view().areaTints, this.props.kind)) {
            if (this.hasRefusal(field)) {
                this.props.onClearRefusal(field);
            }
            return;
        }
        if (this.tintsSent === json && this.held(field)) {
            return;
        }
        const before = this.tintsSent;
        this.tintsSent = json;
        if (!this.send(field, { part: 'areaTints', tints: check.tints }, this.tintsBase)) {
            this.tintsSent = before;
            this.tintsKept = true;
        }
    }

    /** Enter finishes a typed field of the rule or the tints (its blur sends the part when it is whole). */
    private onDraftKey = (ev: React.KeyboardEvent<HTMLInputElement>): void => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            ev.currentTarget.blur();
        }
    };

    private removeButton(label: string, onRemove: () => void): React.ReactElement {
        return (
            <button type="button" className="mapstudio-dock-button mapstudio-rule-remove" disabled={this.off()} title={label} aria-label={label}
                    onClick={onRemove}>
                <ChromeGlyph name="trash" size={16} />
            </button>
        );
    }

    /** An area kind's category tints, under the rule: the property, then a row per category with its tint and swatch. */
    private renderTints(view: SetupView): React.ReactNode {
        const kind = this.props.kind;
        if (!kind.area) {
            return null;
        }
        const draft = this.tintsNow(view);
        const check = checkTints(draft, kind);
        const fixed = fixedCategories(kind, draft.property);
        const property = this.messages(Fields.tintsProperty);
        const part = this.messages(Fields.areaTints);
        const id = this.dom(Fields.tintsProperty, 'select');
        const missing = this.state.tints !== null ? unsavedText(check.missing) : '';
        const unsavedId = this.dom(Fields.areaTints, 'unsaved');
        const set = (i: number, patch: Partial<TintRow>, commit: boolean): void =>
            this.editTints((d) => ({ ...d, rows: d.rows.map((r, at) => (at === i ? { ...r, ...patch } : r)) }), commit);
        const colors = this.props.colors;
        return (
            <div ref={this.tintsBox} className="mapstudio-kindsetup-tints" role="group" aria-label="Area tints" data-field={Fields.areaTints}
                 data-property={draft.property} data-unsaved={missing !== '' ? 'true' : 'false'}>
                <div className="mapstudio-kindsetup-field" data-field={Fields.tintsProperty}>
                    <label className="mapstudio-field-label" htmlFor={id}>Area tints by</label>
                    <select id={id} className="mapstudio-input mapstudio-tints-property" value={draft.property} disabled={this.off()}
                            aria-invalid={property.invalid} aria-describedby={property.ids.length > 0 ? property.ids.join(' ') : undefined}
                            onChange={(ev) => {
                                const next = ev.target.value;
                                const stored = view.areaTints && view.areaTints.property === next ? view.areaTints.tints : [];
                                this.editTints((d) => {
                                    if (d.property !== '') {
                                        this.tintMemory[d.property] = d.rows;
                                    }
                                    return { property: next, rows: next === '' ? [] : this.tintMemory[next] || tintRows(kind, next, stored) };
                                }, true, true);
                            }}>
                        <option value="">No tints</option>
                        {draft.property !== '' && !kind.fields.some((f) => f.key === draft.property) ? <option value={draft.property}>{draft.property}</option> : null}
                        {kind.fields.map((f) => <option key={f.key} value={f.key}>{f.label !== '' ? f.label : f.key}</option>)}
                    </select>
                    {property.nodes}
                    <span className="mapstudio-field-hint">
                        {kind.fields.length === 0 ? 'This kind has no form fields to tint by.'
                            : 'An area takes the tint of its category. An area whose category has no tint draws in the neutral look.'}
                    </span>
                </div>
                {draft.rows.map((row, i) => {
                    const m = this.messages(Fields.tint(fixed ? row.category : row.category.trim()));
                    const named = this.state.tints !== null && check.rows.indexOf(i) >= 0;
                    const bad = m.invalid || named;
                    const ids = named ? m.ids.concat([unsavedId]) : m.ids;
                    const name = row.category.trim() !== '' ? row.category.trim() : 'category ' + (i + 1);
                    return (
                        <div key={fixed ? 'c:' + row.category : i} className="mapstudio-tint-row" role="group" aria-label={'Tint of ' + name}
                             data-category={fixed ? row.category : row.category.trim()} data-tint={row.tint}>
                            <div className="mapstudio-tint-line">
                                {fixed ? <span className="mapstudio-tint-category">{row.category}</span> : (
                                    <input type="text" className="mapstudio-input mapstudio-kindsetup-input mapstudio-tint-category" value={row.category}
                                           placeholder="Category" aria-label={'Category ' + (i + 1)} aria-invalid={bad}
                                           aria-describedby={ids.length > 0 ? ids.join(' ') : undefined} disabled={this.off()}
                                           autoComplete="off" spellCheck={false}
                                           onChange={(ev) => set(i, { category: ev.target.value }, false)}
                                           onBlur={() => this.commitTints()} onKeyDown={this.onDraftKey} />
                                )}
                                <select className="mapstudio-input mapstudio-tint-select" value={row.tint} aria-label={'Tint of ' + name} aria-invalid={bad}
                                        aria-describedby={ids.length > 0 ? ids.join(' ') : undefined} disabled={this.off()}
                                        onChange={(ev) => set(i, { tint: ev.target.value }, true)}>
                                    <option value="">No tint</option>
                                    {row.tint !== '' && TINT_NAMES.indexOf(row.tint) < 0 ? <option value={row.tint}>{row.tint}</option> : null}
                                    {TINT_NAMES.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <span className="mapstudio-tint-swatch" data-tint={row.tint}>
                                    {colors ? (
                                        <Sample svg={tintSampleSvg(TINT_NAMES.indexOf(row.tint) >= 0 ? row.tint as Tint : null, colors)}
                                                className="mapstudio-rule-sample mapstudio-rule-sample--area" />
                                    ) : null}
                                </span>
                                {fixed ? null : this.removeButton('Remove ' + name,
                                    () => this.editTints((d) => ({ ...d, rows: d.rows.filter((_, at) => at !== i) }), true, true))}
                            </div>
                            {m.nodes}
                        </div>
                    );
                })}
                {draft.property !== '' && !fixed ? (
                    <button type="button" className="mapstudio-button mapstudio-rule-add mapstudio-tint-add" disabled={this.off()}
                            onClick={() => this.editTints((d) => ({ ...d, rows: d.rows.concat([{ category: '', tint: '' }]) }), false, true)}>Add a category</button>
                ) : null}
                {missing !== '' ? <span id={unsavedId} className="mapstudio-tints-unsaved" role="status">{missing}</span> : null}
                {part.nodes}
            </div>
        );
    }

    /**
     * Section 6 (key screen 6, kinds-style): the rule's editor (studio/RuleEditor.tsx: the type, the value, the type's rows with
     * their tiles, what is missing while the rule is not whole, the Gateway's words when it refused the rule), and for an area kind
     * the tints. The editor owns the rule's draft and tells the section its type and whether it says "Not saved yet".
     */
    private renderStyleRule(view: SetupView, headingId: string): React.ReactElement {
        const kind = this.props.kind;
        const field = Fields.styleRule;
        // The tints are drawn now, in this render, so the fields they draw are known before the refusals at the top are.
        const tints = this.renderTints(view);
        const editor = this.ruleEditor.current;
        ruleFields(editor ? editor.draft() : ruleDraft(view.styleRule)).forEach((at) => this.drawn.add(at));
        return (
            <RuleEditor ref={this.ruleEditor} kind={kind} kpis={view.kpis} stored={view.styleRule} version={this.version()} off={this.off()}
                        idBase={this.idBase} refusals={this.props.saves.refusals} refused={this.hasRefusal(field)}
                        saving={this.props.saves.saving.indexOf(field) >= 0} done={this.props.saves.done}
                        onSend={(rule, base) => this.send(field, { part: 'styleRule', rule }, base)}
                        onClearRefusal={() => this.props.onClearRefusal(field)}
                        pathNote={(path) => this.note(path)} symbols={this.props.symbols} colors={this.props.colors}
                        onBrowse={this.props.onBrowse ? () => (this.props.onBrowse as NonNullable<KindSetupPanelProps['onBrowse']>)(TagFor.rule, { part: 'rule' }, this.version()) : undefined}
                        browseFor={TagFor.rule} browsing={this.props.browsing === TagFor.rule} onBrowseGone={this.props.onBrowseGone}
                        frame={(body, info) => (
                            <section className="mapstudio-kindsetup-section" data-section="styleRule" data-rule={info.type}
                                     data-unsaved={info.unsaved ? 'true' : 'false'} aria-labelledby={headingId}>
                                {this.heading(6, 'Style rule', headingId, 'Builds on key values')}
                                {body}
                                {tints}
                                {this.renderLiveNow(view, info.unsaved)}
                            </section>
                        )} />
        );
    }

    /**
     * The Live now note, last in section 6 (entry 12b2; DESIGN.md's note box): what the preview item shows now and when its
     * alarm wins over the rule, from what the Gateway already sends. A polite live region: it is read again when its words change.
     */
    private renderLiveNow(view: SetupView, unsaved: boolean): React.ReactElement {
        const preview = this.preview();
        const text = liveNowText({
            kind: this.props.kind, name: preview ? preview.name : null, state: preview ? this.props.previewState || null : null,
            ownRule: !!preview && this.props.previewOwnRule === true, stored: storedRuleOf(view.styleRule), unsaved
        });
        return (
            <div className="mapstudio-rule-live" role="status" aria-live="polite" data-preview={preview ? preview.itemId : ''}>{text}</div>
        );
    }

    // ---- The sections ----

    private heading(n: number, title: string, id: string, tag?: string): React.ReactElement {
        return (
            <h3 id={id} className="mapstudio-kindsetup-heading">
                <span className="mapstudio-kindsetup-number">{n}</span> {title}
                {tag ? <span className="mapstudio-kindsetup-tag">{tag}</span> : null}
            </h3>
        );
    }

    /** One labelled text field with its messages and, for a tag path, its resolve note. */
    private field(o: { field: string; label: string; stored: string; edit: (text: string) => Result; placeholder?: string; hint?: string;
        note?: boolean; picker?: boolean; disabled?: string; tag?: { tagFor: string; target: PickTarget } }): React.ReactElement {
        const m = this.messages(o.field);
        const labelId = this.dom(o.field, 'label');
        const hintId = this.dom(o.field, 'hint');
        const input = this.text({ field: o.field, stored: o.stored, label: o.label, labelledBy: labelId, mono: true, placeholder: o.placeholder,
            invalid: m.invalid, describedBy: m.ids.concat(o.hint ? [hintId] : []), edit: o.edit, picker: o.picker, disabled: !!o.disabled });
        return (
            <div className={'mapstudio-kindsetup-field' + (o.tag && this.props.browsing === o.tag.tagFor ? ' mapstudio-kindsetup-field--browsing' : '')}
                 data-field={o.field} title={o.disabled || undefined}>
                <span id={labelId} className="mapstudio-field-label">{o.label}</span>
                {o.picker ? (
                    <div className="mapstudio-kindsetup-with-picker">
                        {input}
                        {this.pickerButton(o.field, (p) => {
                            const now = this.state.drafts[o.field] !== undefined ? this.state.drafts[o.field] : o.stored;
                            const caret = this.carets[o.field] || [null, null];
                            this.setDraft(o.field, insertAt(now, p, caret[0], caret[1]));
                        }, () => this.commit(o.field, o.stored, o.edit))}
                    </div>
                ) : o.tag ? (
                    <div className="mapstudio-kindsetup-with-picker">
                        {input}
                        {this.tagButton(o.tag.tagFor, o.tag.target, o.label.toLowerCase())}
                    </div>
                ) : input}
                {m.nodes}
                {o.note ? this.note(o.stored) : null}
                {o.hint ? <span id={hintId} className="mapstudio-field-hint">{o.hint}</span> : null}
            </div>
        );
    }

    render(): React.ReactElement {
        const { kind, paused } = this.props;
        this.drawn = new Set<string>();
        const view = this.view();
        const options = previewOptions(this.props.items, kind.id, this.props.assets);
        const preview = previewOf(options, this.props.previewId);
        const previewId = this.dom('preview', 'select');
        const showOff = showOnMapOff(kind, preview !== null);
        const rows = view.kpis.length + this.state.newRows.length;
        const noComms = view.comms === null ? 'Set the heartbeat path first' : '';
        const noAlarms = view.alarms === null ? 'Set the alarm source first' : '';
        const noView = view.popupView === null ? 'Set the popup view first' : '';
        const params = view.popupView ? view.popupView.params : [];
        const head = (key: string): string => this.dom(key, 'heading');
        const body = (
            <React.Fragment>
                <section className="mapstudio-kindsetup-section" data-section="icon" aria-labelledby={head('icon')}>
                    {this.heading(1, 'Icon', head('icon'))}
                    <div className="mapstudio-kindsetup-icon" data-field="icon" data-icon={kind.icon}>
                        <span className="mapstudio-popup-disc">
                            {kind.icon !== '' ? <Glyph id={kind.icon} className="mapstudio-popup-glyph" size={18} /> : null}
                        </span>
                        <span className="mapstudio-mono">{kind.icon !== '' ? kind.icon : 'No icon'}</span>
                    </div>
                    <span className="mapstudio-field-hint">The icon comes from the project's kind list and is not changed here.</span>
                </section>
                <section className="mapstudio-kindsetup-section" data-section="keyValues" data-rows={String(rows)} aria-labelledby={head('keyValues')}>
                    {this.heading(2, 'Key values', head('keyValues'))}
                    <span className="mapstudio-field-hint">Up to {MAX_KEY_VALUES}. The switch sets what the popup shows; the star is the value on the map icon.</span>
                    {view.kpis.map((k) => this.renderRow(k, view))}
                    {this.state.newRows.map((r, i) => this.renderNewRow(r, i))}
                    {rows === 0 ? <span className="mapstudio-field-text mapstudio-kindsetup-none">No key values yet</span> : null}
                    {rows < MAX_KEY_VALUES ? (
                        <button type="button" className="mapstudio-button mapstudio-kv-add" disabled={this.off()} onClick={this.onAddRow}>Add a key value</button>
                    ) : null}
                </section>
                <section className="mapstudio-kindsetup-section" data-section="comms" aria-labelledby={head('comms')}>
                    {this.heading(3, 'Comms', head('comms'))}
                    {this.field({ field: Fields.commsPath, label: 'Heartbeat path', stored: view.comms ? view.comms.path : '', placeholder: '{asset.path}/Comms',
                        note: true, hint: 'The clock for data age, Stale and Comms lost.', tag: { tagFor: TagFor.comms, target: { part: 'comms' } },
                        edit: (text) => ({ part: 'comms.path', path: text }) })}
                    {this.toggle({ field: Fields.commsOn, stored: view.comms ? view.comms.on : false, label: 'Show comms in the popup', kind: 'switch',
                        off: noComms, edit: (on) => ({ part: 'comms.on', on }) })}
                </section>
                <section className="mapstudio-kindsetup-section" data-section="alarms" aria-labelledby={head('alarms')}>
                    {this.heading(4, 'Alarms', head('alarms'))}
                    {this.field({ field: Fields.alarmsPath, label: 'Alarm source', stored: view.alarms ? view.alarms.path : '', placeholder: '{asset.path}',
                        note: true, hint: 'The alarms below this path are the item\'s.', tag: { tagFor: TagFor.alarms, target: { part: 'alarms' } },
                        edit: (text) => ({ part: 'alarms.path', path: text }) })}
                    <div className="mapstudio-kindsetup-readonly" data-field="alarmPage">
                        <span className="mapstudio-field-label">View alarms</span>
                        <span className="mapstudio-field-text">
                            {this.props.alarmPage !== '' ? <span className="mapstudio-mono">{this.props.alarmPage}</span> : 'No page'}
                            {' - set in the Designer, in Map Studio Setup'}
                        </span>
                    </div>
                </section>
                <section className="mapstudio-kindsetup-section" data-section="popup" aria-labelledby={head('popup')}>
                    {this.heading(5, 'Popup', head('popup'))}
                    <div className="mapstudio-kindsetup-parts" role="group" aria-label="Popup parts">
                        {this.toggle({ field: Fields.commsOn, dataField: 'popup.comms', stored: view.comms ? view.comms.on : false, label: 'Comms',
                            kind: 'checkbox', off: noComms, edit: (on) => ({ part: 'comms.on', on }) })}
                        {this.toggle({ field: Fields.alarmsCount, dataField: 'popup.alarmCount', stored: view.alarms ? view.alarms.count : false,
                            label: 'Alarm count', kind: 'checkbox', off: noAlarms, edit: (on) => ({ part: 'alarms.count', on }) })}
                        {this.toggle({ field: Fields.alarmsSummary, dataField: 'popup.alarmSummary', stored: view.alarms ? view.alarms.summary : false,
                            label: 'Alarm summary', kind: 'checkbox', off: noAlarms, edit: (on) => ({ part: 'alarms.summary', on }) })}
                    </div>
                    {this.messages(Fields.alarmsCount).nodes}
                    {this.messages(Fields.alarmsSummary).nodes}
                    <span className="mapstudio-field-hint mapstudio-kindsetup-order">Order is fixed: comms, values, alarms</span>
                    {this.field({ field: Fields.link, label: 'Link', stored: view.link, placeholder: '/pad/{item.name}', picker: true,
                        hint: 'The page the popup\'s pop-out icon opens.', edit: (text) => ({ part: 'link', link: text }) })}
                    {this.field({ field: Fields.popupPath, label: 'Popup view', stored: view.popupView ? view.popupView.path : '', placeholder: 'Popups/PadDetails',
                        hint: 'A project view shown in the popup in place of the default popup.', edit: (text) => popupPathEdit(text, params.length) })}
                    <div className="mapstudio-kindsetup-params" data-params={String(params.length + this.state.newParams.length)} title={noView || undefined}>
                        <span className="mapstudio-field-label">Popup view params</span>
                        {params.map((p) => this.renderParam(p, params.filter((x) => x.name !== p.name).map((x) => x.name)))}
                        {this.state.newParams.map((p, i) => this.renderNewParam(p, i))}
                        <button type="button" className="mapstudio-button mapstudio-param-add" disabled={this.off() || noView !== ''}
                                title={noView || undefined} onClick={this.onAddParam}>Add a param</button>
                    </div>
                </section>
                {this.renderStyleRule(view, head('styleRule'))}
            </React.Fragment>
        );
        const top = this.topRefusals();
        return (
            <section ref={this.root} className="mapstudio-panel mapstudio-kindsetup" aria-label={kind.name + ' setup'} data-kind={kind.id}
                     data-version={String(this.version())} data-paused={paused} data-saving={this.props.saves.saving.join(' ')}
                     data-preview={preview ? preview.itemId : ''}>
                {this.props.backName !== undefined && this.props.onBack ? (
                    <button type="button" className="mapstudio-style-link mapstudio-kindsetup-back" onClick={this.props.onBack}>
                        {'Back to ' + this.props.backName}
                    </button>
                ) : null}
                <header className="mapstudio-panel-header mapstudio-kindsetup-header">
                    <span className="mapstudio-popup-disc">
                        {kind.icon !== '' ? <Glyph id={kind.icon} className="mapstudio-popup-glyph" size={18} /> : null}
                    </span>
                    <div className="mapstudio-popup-title">
                        <h2 className="mapstudio-popup-name mapstudio-panel-name mapstudio-kindsetup-name">{kind.name}</h2>
                        <div className="mapstudio-popup-subline mapstudio-panel-subline mapstudio-kindsetup-subline">{headerSubline(kind, this.props.items, this.view().kpis.map((k) => k.key))}</div>
                    </div>
                </header>
                <div className="mapstudio-kindsetup-preview" data-field="preview" data-options={String(options.length)}>
                    <label className="mapstudio-field-label" htmlFor={previewId}>Preview item</label>
                    <div className="mapstudio-kindsetup-preview-row">
                        <select id={previewId} className="mapstudio-input mapstudio-kindsetup-preview-select" value={preview ? preview.itemId : ''}
                                disabled={options.length === 0} aria-describedby={previewId + '-note'}
                                onChange={(ev) => ev.target.value !== '' && this.props.onPreview(ev.target.value)}>
                            {options.length === 0 ? <option value="">No linked item</option> : null}
                            {options.map((o) => <option key={o.itemId} value={o.itemId}>{o.name + ' - ' + o.folder}</option>)}
                        </select>
                        {/* Off with its reason: the words on the button's holder, since an inert button shows no hover text everywhere. */}
                        <span className="mapstudio-kindsetup-show-holder" title={showOff || undefined}>
                            <button type="button" className="mapstudio-button mapstudio-kindsetup-show" disabled={showOff !== ''}
                                    title={showOff !== '' ? showOff : 'Move the map to ' + (preview ? preview.name : 'the preview item')}
                                    aria-describedby={showOff !== '' ? previewId + '-show-off' : undefined} data-off={showOff}
                                    onClick={() => preview && this.props.onShowPreview && this.props.onShowPreview(preview.itemId)}>Show on map</button>
                            {/* The reason as the button's description: a hidden element still describes what points at it. */}
                            {showOff !== '' ? <span id={previewId + '-show-off'} hidden>{showOff}</span> : null}
                        </span>
                    </div>
                    {preview ? (
                        <span id={previewId + '-note'} className="mapstudio-field-hint mapstudio-kindsetup-preview-note">
                            <span className="mapstudio-mono mapstudio-kindsetup-folder">{preview.folder}</span>
                            {previewLine(kind)}
                        </span>
                    ) : (
                        <span id={previewId + '-note'} className="mapstudio-field-hint mapstudio-kindsetup-preview-note mapstudio-kindsetup-preview-none">
                            {noPreviewText(kind)}
                        </span>
                    )}
                </div>
                <div className="mapstudio-panel-body mapstudio-kindsetup-body">
                    {paused !== '' ? <div className="mapstudio-panel-note mapstudio-kindsetup-paused" role="status">{paused}</div> : null}
                    {top.map((r, i) => (
                        <div key={i} className="mapstudio-field-refusal mapstudio-kindsetup-top-refusal" role="alert" data-at="">
                            <ChromeGlyph name="warning" className="mapstudio-field-refusal-glyph" size={14} />
                            <span className="mapstudio-field-refusal-text">{r.words}</span>
                        </div>
                    ))}
                    {body}
                </div>
            </section>
        );
    }
}
