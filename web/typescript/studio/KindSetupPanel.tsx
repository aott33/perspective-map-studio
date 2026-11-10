import * as React from 'react';
import { Asset, Kind } from '../adapters';
import { KindSetupRecord, MapItemRecord } from '../contract';
import {
    BandRow, CaseType, Fields, KeyValue, KindRefusal, KindSaveState, MAX_KEY_VALUES, NewRowTexts, forgetSeen, Param, PreviewOption, RULE_TYPE_WORDS, ResolveState, RuleDraft,
    RuleSource, RuleType, SetupEdit, SetupView, StateRow, TINT_NAMES, TintRow, TintsDraft, checkRule, checkTints, draftSource, expressionPresets, fixedCategories, foldRule,
    headerSubline, inStepVersion, insertAt, keyFromLabel, liveNowText, noPreviewText, paramMissing, pathsToResolve, placeholderList, popupPathEdit, presetsFor, previewLine,
    previewOf, previewOptions, readSetup, removeBlocked, resolveKey, resolveNote, rowMissing, ruleDraft, ruleTypes, sameRule, sameTints, showOnMapOff, sourceName,
    storedRuleOf, tintRows, tintsDraft, unsavedText, withSource
} from '../kindSetup';
import { ItemState, Preset, Tint } from '../live';
import { MarkerColors, PRESET_WORDS, SpriteSymbol, tintSampleSvg } from '../markers';
import { Glyph } from '../popupParts';
import { Sample, presetSampleSvg } from '../StylePreview';
import { ChromeGlyph } from './ChromeGlyph';

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
    /** The style rule as it is being built, each type's cases with it; null shows the stored rule. */
    rule: RuleDraft | null;
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
    state: PanelState = { drafts: {}, problems: {}, newRows: [], newParams: [], picker: null, rule: null, tints: null };

    private readonly idBase = 'mapstudio-kindsetup-' + (++panelCount);
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
     * The setup version the rule draft (the tints draft) is in step with the store at (kindSetup.ts `inStepVersion`): the version
     * it was made from the stored part on, folded from the store on, or its own save settled on; null with no draft. Every send
     * of the draft goes at it, so another editor's save since meets the conflict.
     */
    private ruleBase: number | null = null;
    private tintsBase: number | null = null;
    /** A save of the draft was not taken: the draft is kept as typed, not replaced by the stored part, until it is changed. */
    private ruleKept = false;
    private tintsKept = false;
    /** The tag path typed for a type's value, kept while the value select is on something else, until the kind is left. */
    private pathMemory: Partial<Record<CaseType, string>> = {};
    /** The rule (the tints) last sent, so one refused is not sent again unchanged. */
    private ruleSent = '';
    private tintsSent = '';
    /** The rule's and the tints' controls: while the cursor is in one, its draft is left as typed. */
    private readonly ruleBox = React.createRef<HTMLDivElement>();
    private readonly tintsBox = React.createRef<HTMLDivElement>();
    /** A change of the rule (the tints) is about to be sent: the stored part is not taken into the draft before it has been. */
    private ruleCommitting = false;
    private tintsCommitting = false;
    /** The rows typed for a tints property left for another, by property, until the kind is left. */
    private tintMemory: Record<string, TintRow[]> = {};

    componentDidMount(): void {
        this.askResolve();
    }

    componentWillUnmount(): void {
        this.props.onClearRefusal();
    }

    componentDidUpdate(): void {
        this.askResolve();
        this.settle();
        this.foldStored();
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
        this.setState((prev) => {
            const drafts = { ...prev.drafts };
            drop.forEach((field) => delete drafts[field]);
            return {
                drafts,
                newRows: forgetSeen(prev.newRows.filter((r) => r.key === null || keys.indexOf(r.key) < 0), rowField, settled),
                newParams: forgetSeen(prev.newParams.filter((p) => p.sentName === null || names.indexOf(p.sentName) < 0), paramField, settled)
            };
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
            <div key={'new:' + row.id} className="mapstudio-kv-row mapstudio-kv-row--new" role="group" aria-label={'New key value ' + (index + 1)}
                 data-key={row.key || ''} data-new="true" data-field={field}
                 onBlur={(ev) => {
                     const to = ev.relatedTarget as Node | null;
                     if (!to || !ev.currentTarget.contains(to)) {
                         this.commitRow(row.id);
                     }
                 }}>
                <div className="mapstudio-kv-line">
                    <div className="mapstudio-kv-label">{input('label', 'Label', 'Label', false)}</div>
                    <div className="mapstudio-kv-unit">{input('unit', 'Unit', 'Unit', false)}</div>
                </div>
                <div className="mapstudio-kv-path">{input('path', 'Tag path', '{asset.path}/Pressure', true)}</div>
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
        const name = kpi.label !== '' ? kpi.label : key;
        const label = this.messages(Fields.kpi(key, 'label'));
        const unit = this.messages(Fields.kpi(key, 'unit'));
        const path = this.messages(Fields.kpi(key, 'path'));
        const row = this.messages(Fields.kpi(key));
        const icon = this.messages(Fields.kpi(key, 'icon'));
        const blocked = removeBlocked(view, key);
        const starred = this.flag(Fields.kpi(key, 'icon'), kpi.icon);
        return (
            <div key={key} className="mapstudio-kv-row" role="group" aria-label={name} data-key={key} data-new="false">
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
                    {this.text({ field: Fields.kpi(key, 'path'), stored: kpi.path, label: 'Tag path of ' + name, mono: true, placeholder: '{asset.path}/Pressure',
                        invalid: path.invalid, describedBy: path.ids,
                        edit: (text) => (text === '' ? { problem: 'Type a tag path. This change is not saved.' } : { part: 'kpi', key, patch: { path: text } }) })}
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
            <div key={'new:' + param.id} className="mapstudio-param-row mapstudio-param-row--new" role="group" aria-label={'New param ' + (index + 1)}
                 data-name={param.name.trim()} data-new="true" data-field={named}
                 onBlur={(ev) => {
                     const to = ev.relatedTarget as Node | null;
                     if (this.picking === null && (!to || !ev.currentTarget.contains(to))) {
                         this.commitParam(param.id);
                     }
                 }}>
                <div className="mapstudio-param-line">
                    {input('name', 'Param name', 'Name')}
                    {input('value', 'Param value', 'Value')}
                    {this.pickerButton(own + '.value', (p) => this.setParam(param.id, { value: p }, () => this.focusInput(own + '.value')))}
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
            <div key={name} className="mapstudio-param-row" role="group" aria-label={'Param ' + name} data-name={name} data-new="false"
                 data-field={Fields.param(name)}>
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
     * The stored rule and tints taken into their drafts once nothing holds them (no save on its way or refused, the cursor
     * elsewhere, the draft whole): another editor's rule shows, and a save that was given up leaves the store's. A draft still
     * being built ("Not saved yet") is never overwritten; the other types' cases stay as typed (owner decision 3).
     */
    private foldStored(): void {
        const kind = this.props.kind;
        const view = this.view();
        const rule = this.state.rule;
        if (rule !== null && !this.ruleCommitting) {
            const held = this.held(Fields.styleRule);
            const whole = checkRule(rule, kind).rule;
            const same = sameRule(rule, view.styleRule, kind);
            const stored = checkRule(ruleDraft(view.styleRule), kind).rule;
            const settled = this.ruleSent !== '' && stored !== undefined && JSON.stringify(stored) === this.ruleSent;
            this.ruleBase = inStepVersion(this.ruleBase !== null ? this.ruleBase : this.version(), this.version(), { held, same, settled });
            if (!held && !same && whole !== undefined && !this.ruleKept && !this.focusIn(this.ruleBox)) {
                this.ruleBase = this.version();
                this.setState({ rule: foldRule(rule, ruleDraft(view.styleRule)) });
            }
        }
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

    private ruleNow(view: SetupView): RuleDraft {
        return this.state.rule || ruleDraft(view.styleRule);
    }

    /** One change of the rule's draft; `commit` sends it at once when it is whole (a select, a button), else its field's blur does. */
    private editRule(change: (draft: RuleDraft) => RuleDraft, commit: boolean, structure = false): void {
        if (this.off()) {
            return;
        }
        if (this.ruleBase === null) {
            // The draft is made from the stored rule now: the version it is in step with the store at.
            this.ruleBase = this.version();
        }
        this.ruleKept = false;
        if (structure && this.hasRefusal(Fields.styleRule)) {
            // The rows moved: the words of the last refusal no longer stand beside the row they named.
            this.props.onClearRefusal(Fields.styleRule);
        }
        // The commit runs once the draft is in the state, after this update's componentDidUpdate: a pressed button need not hold
        // the focus (some browsers give it none), so the flag, not the cursor, keeps the draft until it has been sent.
        this.ruleCommitting = this.ruleCommitting || commit;
        this.setState((prev) => ({ rule: change(prev.rule || ruleDraft(this.view().styleRule)) }), commit ? () => {
            this.ruleCommitting = false;
            this.commitRule();
        } : undefined);
    }

    /**
     * The rule sent when it is whole in shape and not what is stored (owner decision 2): one `styleRule` edit, the whole rule,
     * at the version the draft was first changed on. A draft that is not whole sends nothing; the section says what is missing.
     */
    private commitRule(): void {
        const draft = this.state.rule;
        if (draft === null || this.off()) {
            return;
        }
        const field = Fields.styleRule;
        const check = checkRule(draft, this.props.kind);
        if (check.rule === undefined) {
            return;
        }
        const json = JSON.stringify(check.rule);
        if (!this.awaiting.has(field) && sameRule(draft, this.view().styleRule, this.props.kind)) {
            if (this.hasRefusal(field)) {
                this.props.onClearRefusal(field);
            }
            return;
        }
        if (this.ruleSent === json && this.held(field)) {
            // On its way, or refused as it is: nothing new to send until it is changed.
            return;
        }
        const before = this.ruleSent;
        this.ruleSent = json;
        if (!this.send(field, { part: 'styleRule', rule: check.rule }, this.ruleBase)) {
            // Not taken (as 12a's fields): the marker is undone and the draft stays as typed.
            this.ruleSent = before;
            this.ruleKept = true;
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

    /** The 64 px tile of a case: the kind's icon (or its line sample) in the preset, with the preset's state word. */
    private tile(preset: string): React.ReactElement {
        const { kind, colors } = this.props;
        const known = preset !== '' && presetsFor(kind).indexOf(preset) >= 0;
        const word = known ? PRESET_WORDS[preset as Preset] : '';
        return (
            <span className="mapstudio-rule-tile" data-preset={preset} title={known ? 'The ' + preset + ' preset' : 'No preset picked'}>
                {known && colors ? (
                    <Sample svg={presetSampleSvg({ id: kind.id, name: kind.name, geometry: kind.geometry, icon: kind.icon, area: kind.area },
                                preset as Preset, this.props.symbols || {}, colors)}
                            className={'mapstudio-rule-sample mapstudio-rule-sample--' + kind.geometry} />
                ) : null}
                {word !== '' ? <span className="mapstudio-style-word mapstudio-rule-word">{word}</span> : null}
            </span>
        );
    }

    private presetSelect(value: string, label: string, describedBy: string[], invalid: boolean, onPick: (preset: string) => void): React.ReactElement {
        const presets = presetsFor(this.props.kind);
        return (
            <select className="mapstudio-input mapstudio-rule-preset" value={value} aria-label={label} aria-invalid={invalid}
                    aria-describedby={describedBy.length > 0 ? describedBy.join(' ') : undefined} disabled={this.off()}
                    onChange={(ev) => onPick(ev.target.value)}>
                <option value="">Pick a preset</option>
                {value !== '' && presets.indexOf(value) < 0 ? <option value={value}>{value}</option> : null}
                {presets.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
        );
    }

    private removeButton(label: string, onRemove: () => void): React.ReactElement {
        return (
            <button type="button" className="mapstudio-dock-button mapstudio-rule-remove" disabled={this.off()} title={label} aria-label={label}
                    onClick={onRemove}>
                <ChromeGlyph name="trash" size={16} />
            </button>
        );
    }

    /** The value the rule reads: a key value (switched-off ones too) or a typed tag path with its resolve note. */
    private renderSource(draft: RuleDraft, view: SetupView, optional: boolean): React.ReactElement {
        const source = draftSource(draft);
        const m = this.messages(Fields.ruleSource);
        const id = this.dom(Fields.ruleSource, 'select');
        const chosen = source.from === 'kpi' ? 'kpi:' + source.key : source.from;
        const type = draft.type as CaseType;
        const pick = (value: string): RuleSource => (value === 'path' ? { from: 'path', path: this.pathMemory[type] || '' }
            : value.indexOf('kpi:') === 0 ? { from: 'kpi', key: value.slice(4) } : { from: '' });
        const stored = view.styleRule ? draftSource(ruleDraft(view.styleRule)) : null;
        return (
            <div className="mapstudio-kindsetup-field mapstudio-rule-source" data-field={Fields.ruleSource} data-source={chosen}>
                <label className="mapstudio-field-label" htmlFor={id}>Value</label>
                <select id={id} className="mapstudio-input mapstudio-rule-source-select" value={chosen} disabled={this.off()}
                        aria-invalid={m.invalid} aria-describedby={m.ids.length > 0 ? m.ids.join(' ') : undefined}
                        onChange={(ev) => {
                            if (source.from === 'path') {
                                // The typed path comes back when "A tag path" is chosen again, as a type's cases do.
                                this.pathMemory[type] = source.path;
                            }
                            const next = pick(ev.target.value);
                            this.editRule((d) => withSource(d, next), true);
                        }}>
                    <option value="">{optional ? 'No value' : 'Pick a value'}</option>
                    {source.from === 'kpi' && !view.kpis.some((k) => k.key === source.key) ? <option value={chosen}>{source.key}</option> : null}
                    {view.kpis.map((k) => (
                        <option key={k.key} value={'kpi:' + k.key}>{(k.label !== '' ? k.label : k.key) + (k.on ? '' : ' (off in the popup)')}</option>
                    ))}
                    <option value="path">A tag path</option>
                </select>
                {source.from === 'path' ? (
                    <input type="text" className="mapstudio-input mapstudio-kindsetup-input mapstudio-mono mapstudio-rule-path" value={source.path}
                           placeholder="{asset.path}/Status" aria-label="Tag path the rule reads" aria-invalid={m.invalid} disabled={this.off()}
                           autoComplete="off" spellCheck={false}
                           onChange={(ev) => {
                               const path = ev.target.value;
                               this.editRule((d) => withSource(d, { from: 'path', path }), false);
                           }}
                           onBlur={() => this.commitRule()} onKeyDown={this.onDraftKey} />
                ) : null}
                {m.nodes}
                {source.from === 'path' && stored && stored.from === 'path' && stored.path === source.path.trim() ? this.note(stored.path) : null}
            </div>
        );
    }

    private renderStates(draft: RuleDraft, view: SetupView, marked: number[], noteId: string): React.ReactNode {
        const name = sourceName(draftSource(draft), view.kpis);
        const set = (i: number, patch: Partial<StateRow>, commit: boolean): void =>
            this.editRule((d) => ({ ...d, states: d.states.map((r, at) => (at === i ? { ...r, ...patch } : r)) }), commit);
        return (
            <React.Fragment>
                {draft.states.map((row, i) => {
                    const m = this.messages(Fields.ruleCase(i));
                    const bad = m.invalid || marked.indexOf(i) >= 0;
                    // A row the note names is tied to the note's words.
                    const ids = marked.indexOf(i) >= 0 ? m.ids.concat([noteId]) : m.ids;
                    return (
                        <div key={i} className="mapstudio-rule-case" role="group" aria-label={'Case ' + (i + 1)} data-index={i} data-rule="states"
                             data-field={Fields.ruleCase(i)}>
                            <label className="mapstudio-rule-when">
                                <span className="mapstudio-field-label">When {name} is</span>
                                <input type="text" className="mapstudio-input mapstudio-kindsetup-input mapstudio-rule-value" value={row.value}
                                       aria-invalid={bad} aria-describedby={ids.length > 0 ? ids.join(' ') : undefined} disabled={this.off()}
                                       autoComplete="off" spellCheck={false}
                                       onChange={(ev) => set(i, { value: ev.target.value }, false)}
                                       onBlur={() => this.commitRule()} onKeyDown={this.onDraftKey} />
                            </label>
                            <div className="mapstudio-rule-look">
                                {this.presetSelect(row.preset, 'Preset of case ' + (i + 1), ids, bad, (preset) => set(i, { preset }, true))}
                                {this.tile(row.preset)}
                                {this.removeButton('Remove case ' + (i + 1),
                                    () => this.editRule((d) => ({ ...d, states: d.states.filter((_, at) => at !== i) }), true, true))}
                            </div>
                            {m.nodes}
                        </div>
                    );
                })}
                <span className="mapstudio-field-hint">A number, true or false is read as typed; text in double quotes stays text ("1").</span>
                <button type="button" className="mapstudio-button mapstudio-rule-add" disabled={this.off()}
                        onClick={() => this.editRule((d) => ({ ...d, states: d.states.concat([{ value: '', preset: '' }]) }), false)}>Add a case</button>
            </React.Fragment>
        );
    }

    private renderBands(draft: RuleDraft, marked: number[], noteId: string): React.ReactNode {
        const set = (i: number, patch: Partial<BandRow>, commit: boolean): void =>
            this.editRule((d) => ({ ...d, bands: d.bands.map((r, at) => (at === i ? { ...r, ...patch } : r)) }), commit);
        const last = draft.bands.length - 1;
        const end = (i: number, part: 'from' | 'to', row: BandRow, bad: boolean, ids: string[]): React.ReactElement => {
            const open = part === 'from' ? i === 0 : i === last;
            return (
                <label className="mapstudio-rule-end">
                    <span className="mapstudio-field-label">{part === 'from' ? 'From' : 'To'}</span>
                    <input type="text" inputMode="decimal" className={'mapstudio-input mapstudio-kindsetup-input mapstudio-rule-' + part} value={row[part]}
                           placeholder={open ? (part === 'from' ? 'Open below' : 'Open above') : undefined}
                           aria-label={(part === 'from' ? 'From' : 'To') + ' of band ' + (i + 1) + (open ? ', empty for an open end' : '')}
                           aria-invalid={bad} aria-describedby={ids.length > 0 ? ids.join(' ') : undefined} disabled={this.off()}
                           autoComplete="off" spellCheck={false}
                           onChange={(ev) => set(i, { [part]: ev.target.value }, false)}
                           onBlur={() => this.commitRule()} onKeyDown={this.onDraftKey} />
                </label>
            );
        };
        return (
            <React.Fragment>
                {draft.bands.map((row, i) => {
                    const m = this.messages(Fields.ruleCase(i));
                    const bad = m.invalid || marked.indexOf(i) >= 0;
                    const ids = marked.indexOf(i) >= 0 ? m.ids.concat([noteId]) : m.ids;
                    return (
                        <div key={i} className="mapstudio-rule-case" role="group" aria-label={'Band ' + (i + 1)} data-index={i} data-rule="bands"
                             data-field={Fields.ruleCase(i)}>
                            <div className="mapstudio-rule-ends">
                                {end(i, 'from', row, bad, ids)}
                                {end(i, 'to', row, bad, ids)}
                            </div>
                            <div className="mapstudio-rule-look">
                                {this.presetSelect(row.preset, 'Preset of band ' + (i + 1), ids, bad, (preset) => set(i, { preset }, true))}
                                {this.tile(row.preset)}
                                {this.removeButton('Remove band ' + (i + 1),
                                    () => this.editRule((d) => ({ ...d, bands: d.bands.filter((_, at) => at !== i) }), true, true))}
                            </div>
                            {m.nodes}
                        </div>
                    );
                })}
                <span className="mapstudio-field-hint">
                    A band holds a value from its from up to, not including, its to. Leave the first from or the last to empty for an open end.
                </span>
                <button type="button" className="mapstudio-button mapstudio-rule-add" disabled={this.off()}
                        onClick={() => this.editRule((d) => ({ ...d, bands: d.bands.concat([{ from: '', to: '', preset: '' }]) }), false)}>Add a band</button>
            </React.Fragment>
        );
    }

    private renderExpression(draft: RuleDraft): React.ReactNode {
        const m = this.messages(Fields.ruleExpression);
        const id = this.dom(Fields.ruleExpression, 'text');
        const hintId = this.dom(Fields.ruleExpression, 'hint');
        const named = expressionPresets(draft.expression, this.props.kind);
        return (
            <div className="mapstudio-kindsetup-field" data-field={Fields.ruleExpression}>
                <label className="mapstudio-field-label" htmlFor={id}>Expression</label>
                <textarea id={id} className="mapstudio-input mapstudio-mono mapstudio-rule-expression" rows={4} value={draft.expression}
                          placeholder={'if({value} > 600, \'warning\', \'normal\')'} aria-invalid={m.invalid}
                          aria-describedby={m.ids.concat([hintId]).join(' ')} disabled={this.off()} autoComplete="off" spellCheck={false}
                          onChange={(ev) => {
                              const expression = ev.target.value;
                              this.editRule((d) => ({ ...d, expression }), false);
                          }}
                          onBlur={() => this.commitRule()} />
                {m.nodes}
                <span id={hintId} className="mapstudio-field-hint">
                    <span className="mapstudio-mono">{'{value}'}</span> is the one reference: the value picked above. The result is a preset name,
                    as text: {presetsFor(this.props.kind).join(', ')}. Saved when you leave the field.
                </span>
                {named.length > 0 ? (
                    <div className="mapstudio-rule-named" role="group" aria-label="The presets the expression names">
                        {named.map((p) => (
                            <span key={p} className="mapstudio-rule-named-tile">
                                {this.tile(p)}
                                <span className="mapstudio-mono">{p}</span>
                            </span>
                        ))}
                    </div>
                ) : null}
            </div>
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
     * Section 6 (key screen 6, kinds-style): the type, the value, the type's rows with their tiles, what is missing while the
     * rule is not whole, the Gateway's words when it refused the rule, and for an area kind the tints.
     */
    private renderStyleRule(view: SetupView, headingId: string): React.ReactElement {
        const kind = this.props.kind;
        const draft = this.ruleNow(view);
        const check = checkRule(draft, kind);
        // What is missing shows once the rule has been touched: a stored rule is whole, and a kind with none says nothing.
        const touched = this.state.rule !== null;
        const missing = touched ? unsavedText(check.missing) : '';
        const marked = touched ? check.rows : [];
        const section = this.messages(Fields.styleRule);
        const noteId = this.dom(Fields.styleRule, 'unsaved');
        return (
            <section className="mapstudio-kindsetup-section" data-section="styleRule" data-rule={draft.type} data-unsaved={missing !== '' ? 'true' : 'false'}
                     aria-labelledby={headingId}>
                {this.heading(6, 'Style rule', headingId, 'Builds on key values')}
                <div ref={this.ruleBox} className="mapstudio-rule" data-field={Fields.styleRule}>
                    <div className="mapstudio-rule-types" role="group" aria-label="Rule type">
                        {ruleTypes(kind).map((type: RuleType) => (
                            <button key={type} type="button" data-type={type} aria-pressed={draft.type === type} disabled={this.off()}
                                    className={'mapstudio-panel-tab mapstudio-rule-type' + (draft.type === type ? ' mapstudio-panel-tab--active' : '')}
                                    onClick={() => {
                                        // The type already chosen changes nothing.
                                        if (type !== draft.type) {
                                            this.editRule((d) => ({ ...d, type }), true, true);
                                        }
                                    }}>{RULE_TYPE_WORDS[type]}</button>
                        ))}
                    </div>
                    {draft.type === 'none' ? <span className="mapstudio-field-text mapstudio-kindsetup-none mapstudio-rule-none">No style rule</span> : null}
                    {draft.type === 'instruments' ? (
                        <span className="mapstudio-field-text mapstudio-rule-instruments">Each segment takes the worst of the instruments at its ends.</span>
                    ) : null}
                    {draft.type === 'states' || draft.type === 'bands' || draft.type === 'expression'
                        ? this.renderSource(draft, view, draft.type === 'expression') : null}
                    {draft.type === 'states' ? this.renderStates(draft, view, marked, noteId) : null}
                    {draft.type === 'bands' ? this.renderBands(draft, marked, noteId) : null}
                    {draft.type === 'expression' ? this.renderExpression(draft) : null}
                    {missing !== '' ? <span id={noteId} className="mapstudio-rule-unsaved" role="status">{missing}</span> : null}
                    {section.nodes}
                </div>
                {this.renderTints(view)}
                {this.renderLiveNow(view, missing !== '')}
            </section>
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
        note?: boolean; picker?: boolean; disabled?: string }): React.ReactElement {
        const m = this.messages(o.field);
        const labelId = this.dom(o.field, 'label');
        const hintId = this.dom(o.field, 'hint');
        const input = this.text({ field: o.field, stored: o.stored, label: o.label, labelledBy: labelId, mono: true, placeholder: o.placeholder,
            invalid: m.invalid, describedBy: m.ids.concat(o.hint ? [hintId] : []), edit: o.edit, picker: o.picker, disabled: !!o.disabled });
        return (
            <div className="mapstudio-kindsetup-field" data-field={o.field} title={o.disabled || undefined}>
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
                        note: true, hint: 'The clock for data age, Stale and Comms lost.', edit: (text) => ({ part: 'comms.path', path: text }) })}
                    {this.toggle({ field: Fields.commsOn, stored: view.comms ? view.comms.on : false, label: 'Show comms in the popup', kind: 'switch',
                        off: noComms, edit: (on) => ({ part: 'comms.on', on }) })}
                </section>
                <section className="mapstudio-kindsetup-section" data-section="alarms" aria-labelledby={head('alarms')}>
                    {this.heading(4, 'Alarms', head('alarms'))}
                    {this.field({ field: Fields.alarmsPath, label: 'Alarm source', stored: view.alarms ? view.alarms.path : '', placeholder: '{asset.path}',
                        note: true, hint: 'The alarms below this path are the item\'s.', edit: (text) => ({ part: 'alarms.path', path: text }) })}
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
            <section className="mapstudio-panel mapstudio-kindsetup" aria-label={kind.name + ' setup'} data-kind={kind.id}
                     data-version={String(this.version())} data-paused={paused} data-saving={this.props.saves.saving.join(' ')}
                     data-preview={preview ? preview.itemId : ''}>
                <header className="mapstudio-panel-header mapstudio-kindsetup-header">
                    <span className="mapstudio-popup-disc">
                        {kind.icon !== '' ? <Glyph id={kind.icon} className="mapstudio-popup-glyph" size={18} /> : null}
                    </span>
                    <div className="mapstudio-popup-title">
                        <h2 className="mapstudio-popup-name mapstudio-panel-name mapstudio-kindsetup-name">{kind.name}</h2>
                        <div className="mapstudio-popup-subline mapstudio-panel-subline mapstudio-kindsetup-subline">{headerSubline(kind, this.props.items)}</div>
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
