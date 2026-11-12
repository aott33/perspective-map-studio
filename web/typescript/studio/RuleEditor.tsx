import * as React from 'react';
import { Kind } from '../adapters';
import {
    BandRow, CaseType, Fields, KeyValue, RULE_TYPE_WORDS, RuleDraft, RuleSource, RuleType, StateRow, checkRule, draftSource, expressionPresets,
    foldRule, inStepVersion, ownRuleTypes, presetWord, presetsFor, ruleDraft, ruleTypes, sameRule, sourceName, unsavedText, withSource
} from '../kindSetup';
import { Preset } from '../live';
import { MarkerColors, PRESET_WORDS, SpriteSymbol } from '../markers';
import { Sample, presetSampleSvg } from '../StylePreview';
import { ChromeGlyph } from './ChromeGlyph';

/**
 * The style rule editor (epic 4 entries 12b1 and 12c2; DESIGN.md Kind setup, key screen 6 kinds-style), shared by a kind's
 * section 6 (studio/KindSetupPanel.tsx) and an item's own rule in the Style tab (studio/PropertiesPanel.tsx). It owns the draft
 * and the rows, and is handed how to save (`onSend`): a kind's rule goes as one part of the kind's setup at the version the draft
 * is in step with the store at, an item's as its whole `overrides` through the item's ordinary save.
 *
 * The type is a segmented choice in the panel tabs' look; then the value the rule reads (a key value of the kind, switched-off
 * ones too, or a typed tag path), one row per case with its preset select and a 64 px tile, or the expression. A rule is one
 * part, sent whole: the editor holds one draft and sends it as soon as it is whole in shape (a select or a button at once, a
 * typed field when it is finished); until then it says "Not saved yet" and what is missing, and nothing is sent. Each type's
 * value and cases are remembered while the editor stays (until the kind, or the item, is left).
 *
 * **An item's own rule** (`own`): no None type (Reset removes the rule), a typed path must be a full path, said beside its field
 * in 12c1's words (itemOverrides.ts `pathProblem`) with nothing sent, and no resolve note.
 *
 * The frame around the editor is the caller's (`frame`): a kind's section with its heading, tints and Live now note, an item's
 * rule with its "shows now" line; it is told the type chosen and whether the draft says "Not saved yet".
 *
 * For tests (unchanged from entry 12b1): the box `.mapstudio-rule[data-field="styleRule"]`, the type buttons
 * `.mapstudio-rule-type[data-type]` (`aria-pressed`), the value `[data-field="styleRule.source"]`, a case
 * `.mapstudio-rule-case[data-index]`, its tile `.mapstudio-rule-tile[data-preset]`, the expression
 * `[data-field="styleRule.expression"]`, what is missing `.mapstudio-rule-unsaved`.
 *
 * From entry 12c3 (the Style tab reordered; the editor is shared, so Kinds changes with it): a preset select shows the tiles'
 * words ("Out of service", "Attention"; kindSetup.ts `presetWord`), its values the stored names as before; the case and band
 * rows have no card border and are parted by a divider, "When <value> is" said once above the States rows
 * (`.mapstudio-rule-when-label`); the type choice keeps only its active underline. Enter in a typed field sends the rule when it
 * is complete and keeps the focus in the field; removing a row moves the focus to the row before it (its Remove), or to Add;
 * a stored rule changed by this session's Undo or Redo of this item (`undoing`), and the stored rule after a save of the draft
 * was given up (never while its conflict still waits for the card's choice), shows in the editor wherever the focus is, unless a save is on its way, the draft is still being built or a field holds
 * keystrokes not yet finished (another editor's save still waits for the cursor to leave, as built in 12b1). The "Not saved yet" note is one node that stays
 * mounted (`.mapstudio-rule-unsaved`, `role="status"`), empty and not shown while nothing is missing, in the warning tint with
 * its warning edge; `unsavedTail` is what it ends with after the reason. A half-built own rule is handed back (`keep()`) and
 * taken again (`kept`) so the Style tab finds it as it was left.
 */

/** A refusal as the editor places it: the field it stands beside (kindSetup.ts `Fields`) and the Gateway's words. */
export interface RuleRefusal {
    at: string;
    words: string;
}

/** What the frame is told of the draft. */
export interface RuleFrameInfo {
    type: RuleType;
    /** The draft was touched and is not whole: the editor says "Not saved yet" and nothing of it was sent. */
    unsaved: boolean;
}

export interface RuleEditorProps {
    kind: Kind;
    /** The kind's key values: what the value select offers. */
    kpis: KeyValue[];
    /** The stored rule the editor shows and saves over: the kind's, or the item's own; null for none. */
    stored: Record<string, unknown> | null;
    /** The version of what holds the stored rule (the kind's setup, the item). */
    version: number;
    /** The controls take no input. */
    off: boolean;
    /** The prefix of the controls' element ids. */
    idBase: string;
    /** The refusals that stand, each beside the field it names. */
    refusals: ReadonlyArray<RuleRefusal>;
    /**
     * A save of the rule stands refused, or waits in the queue with its conflict card (entry 12c3): the draft is left as typed,
     * not sent again unchanged, and the stored rule is not taken until the refusal is cleared or the card's choice is made.
     */
    refused: boolean;
    /** A save of the rule is in flight or waiting its turn. */
    saving: boolean;
    /** A token that changes when a save of the rule settles (saved, refused or dropped). */
    done: number | string;
    /** The whole rule sent (null removes it), at the version the draft is in step with the store at. False when it was not taken. */
    onSend: (rule: Record<string, unknown> | null, base: number | null) => boolean;
    /** The words of the rule's last refusal no longer stand (the rows moved, or the stored rule was typed back). */
    onClearRefusal: () => void;
    /** The resolve note under a stored tag path; none for an item's own rule. */
    pathNote?: (path: string) => React.ReactNode;
    /** The sprite's symbols, for the kind glyph in a preset tile (none yet: the disc alone). */
    symbols?: Record<string, SpriteSymbol>;
    /** The theme's token values the tiles draw with; null before the map has read them (no tile is drawn). */
    colors?: MarkerColors | null;
    /** An item's own rule (entry 12c2): no None type, a typed path is a full path, no resolve note. */
    own?: boolean;
    /** The draft the editor opens with, not yet stored (an own rule started empty); the stored rule shows when absent. */
    initial?: RuleDraft | null;
    /**
     * An Undo or a Redo of this very item is on its way (entry 12c3; known by its batch, never by the clock): the stored rule
     * it changes shows in the editor wherever the focus is. Never for a kind's rule, which has no Undo.
     */
    undoing?: boolean;
    /** What the "Not saved yet" note ends with, after the reason (the Style tab's "The map keeps the saved rule until then."). */
    unsavedTail?: string;
    /** A draft left not saved when the editor last went (entry 12c3): it opens as it was left, in step with the store as it was. */
    kept?: RuleKeep | null;
    /**
     * The tag button beside the rule's tag path (entry 13c): pressed, the tag browser opens for the path. Absent, no button is
     * drawn (anyone but a full editor in the studio).
     */
    onBrowse?: () => void;
    /** The tag button's id (tagBrowser.ts `TagFor`), for the card's way back to it. */
    browseFor?: string;
    /** The tag browser is open for this rule's path: the button reads as expanded and the value takes the selection tint. */
    browsing?: boolean;
    /** The rule no longer shows a tag path field while its card is open (the value or the type changed): the card closes, nothing saved. */
    onBrowseGone?: () => void;
    /** The element around the editor's box; the box alone when absent. */
    frame?: (body: React.ReactElement, info: RuleFrameInfo) => React.ReactElement;
}

/**
 * A draft that was not saved when its editor went (entry 12c3: the item left for another, for Kinds), as the editor takes it
 * again: the draft with each type's cases, the version and the stored rule it was last in step with, and the typed paths.
 */
export interface RuleKeep {
    draft: RuleDraft;
    base: number | null;
    stepStored: string | null;
    paths: Partial<Record<CaseType, string>>;
}

/** What the note says of a complete rule that was not saved when its item was left (entry 12c3). */
export const KEPT_WHOLE_TEXT = 'Change the rule to try again.';

interface EditorState {
    /** The style rule as it is being built, each type's cases with it; null shows the stored rule. */
    rule: RuleDraft | null;
}

/** The fields of a rule's draft the editor draws: a refusal that names none of them stands elsewhere (a kind's, at its panel's top). */
export function ruleFields(draft: RuleDraft): string[] {
    const out = [Fields.styleRule];
    if (draft.type === 'states' || draft.type === 'bands' || draft.type === 'expression') {
        out.push(Fields.ruleSource);
    }
    if (draft.type === 'states') {
        draft.states.forEach((_row, i) => out.push(Fields.ruleCase(i)));
    } else if (draft.type === 'bands') {
        draft.bands.forEach((_row, i) => out.push(Fields.ruleCase(i)));
    } else if (draft.type === 'expression') {
        out.push(Fields.ruleExpression);
    }
    return out;
}

/** The 64 px tile of a case: the kind's icon (or its line sample) in the preset, with the preset's state word. */
export function RuleTile(props: { kind: Kind; preset: string; symbols?: Record<string, SpriteSymbol>; colors?: MarkerColors | null;
    /** False leaves the word out of the tile: the caller says it beside the tile (the Style tab's read-only cases). */
    word?: boolean }): React.ReactElement {
    const { kind, colors, preset } = props;
    const known = preset !== '' && presetsFor(kind).indexOf(preset) >= 0;
    const word = known ? PRESET_WORDS[preset as Preset] : '';
    return (
        <span className="mapstudio-rule-tile" data-preset={preset} title={known ? presetWord(preset) : 'No preset picked'}>
            {known && colors ? (
                <Sample svg={presetSampleSvg({ id: kind.id, name: kind.name, geometry: kind.geometry, icon: kind.icon, area: kind.area },
                            preset as Preset, props.symbols || {}, colors)}
                        className={'mapstudio-rule-sample mapstudio-rule-sample--' + kind.geometry} />
            ) : null}
            {word !== '' && props.word !== false ? <span className="mapstudio-style-word mapstudio-rule-word">{word}</span> : null}
        </span>
    );
}

export class RuleEditor extends React.Component<RuleEditorProps, EditorState> {
    state: EditorState = { rule: this.props.kept ? this.props.kept.draft : this.props.initial || null };

    /** The rule's save sent and not yet settled: the token when it was sent, and whether its save was seen on its way. */
    private awaiting: { done: number | string; seenSaving: boolean } | null = null;
    /**
     * The version the draft is in step with the store at (kindSetup.ts `inStepVersion`): the version it was made from the stored
     * rule on, folded from the store on, or its own save settled on; null with no draft. Every send of the draft goes at it, so
     * another editor's save of a kind's rule since meets the conflict.
     */
    private ruleBase: number | null = this.props.kept
        // A kept draft is still in step when the stored rule is the one it was left with (an item's version moves with any edit).
        ? (this.props.kept.stepStored === JSON.stringify(this.props.stored) ? this.props.version : this.props.kept.base)
        : this.props.initial ? this.props.version : null;
    /**
     * An own rule (entry 12c2): the stored rule the draft was last in step with. An item's version moves with every edit of the
     * item, so the base follows it while the stored rule is still that one; once another editor's rule is stored, the base stays
     * and the draft's save meets the conflict.
     */
    private stepStored: string | null = this.props.kept ? this.props.kept.stepStored : this.props.initial ? JSON.stringify(this.props.stored) : null;
    /** A save of the draft was not taken: the draft is kept as typed, not replaced by the stored rule, until it is changed. */
    private ruleKept = false;
    /** The tag path typed for a type's value, kept while the value select is on something else, while the editor stays. */
    private pathMemory: Partial<Record<CaseType, string>> = this.props.kept ? { ...this.props.kept.paths } : {};
    /** The rule last sent, so one refused is not sent again unchanged. */
    private ruleSent = '';
    /** The rule's controls: while the cursor is in one, the draft is left as typed. */
    private readonly ruleBox = React.createRef<HTMLDivElement>();
    /** A change of the rule is about to be sent: the stored rule is not taken into the draft before it has been. */
    private ruleCommitting = false;
    /**
     * Entry 12c3: the stored rule as last seen; whether it changed while an Undo or Redo of this item was on its way and is not
     * yet shown in the editor; and whether a save of the draft settled, and was given up (not saved, nothing refused or
     * waiting). Either shows the stored rule wherever the focus is.
     */
    private lastStored = JSON.stringify(this.props.stored);
    private byUndo = false;
    /** A kept draft that was complete and not saved (refused, or not taken) is back: the note says so until it is changed. */
    private keptWhole = !!this.props.kept && checkRule(this.props.kept.draft, this.props.kind, this.props.own ? { own: true } : {}).rule !== undefined;
    private settledNow = false;
    private dropped = false;
    /** Entry 12c3: a field of the rule was typed in and not finished yet (Enter or blur): its keystrokes are never replaced under it. */
    private typed = false;
    /** Entry 12c3: where the focus goes once a row is gone: the row before it by its place, or Add (-1); null for nowhere. */
    private focusRow: number | null = null;

    componentDidUpdate(): void {
        if (this.props.browsing && this.props.onBrowseGone && !this.showsPath()) {
            this.props.onBrowseGone();
        }
        this.settle();
        this.foldStored();
        this.refocus();
    }

    /**
     * The draft as the Style tab keeps it when the editor goes (entry 12c3): one that is not saved, which is a draft touched and
     * not complete, and a complete one that is not what is stored with no save of it on its way (the Gateway refused it, its
     * conflict waits, or the save was not taken). Nothing saved or being saved is kept; null otherwise.
     */
    keep(): RuleKeep | null {
        const rule = this.state.rule;
        if (rule === null) {
            return null;
        }
        const o = this.options();
        if (checkRule(rule, this.props.kind, o).rule !== undefined
            && (sameRule(rule, this.props.stored, this.props.kind, o) || (this.held() && !this.props.refused))) {
            return null;
        }
        return { draft: rule, base: this.ruleBase, stepStored: this.stepStored, paths: { ...this.pathMemory } };
    }

    /** Whether the rule is not saved: its draft is not complete, or is complete, not what is stored and not on its way. */
    unsaved(): boolean {
        return this.keep() !== null;
    }

    /**
     * A path from the tag browser (entry 13c): it goes into the draft as the rule's tag path, as when it is typed and finished, so
     * the rule is sent when it is complete and says "Not saved yet" until then. Returns '' when the draft took it, else why not.
     */
    usePath(path: string): string {
        if (this.off()) {
            return 'Not saved. The rule cannot be changed now.';
        }
        if (!this.showsPath()) {
            return 'Not saved. This rule no longer reads a tag path.';
        }
        this.editRule((d) => withSource(d, { from: 'path', path }), true, false, false);
        return '';
    }

    /** Whether the rule shows its tag path field: a type that reads a value, with "A tag path" as that value. */
    private showsPath(): boolean {
        const draft = this.draft();
        return draft.type !== 'none' && draft.type !== 'instruments' && draftSource(draft).from === 'path';
    }

    /** After a row was removed the focus goes to the row before it (its Remove), or to Add: the keyboard keeps its place. */
    private refocus(): void {
        const at = this.focusRow;
        const box = this.ruleBox.current;
        if (at === null || !box) {
            return;
        }
        this.focusRow = null;
        const rows = Array.from(box.querySelectorAll('.mapstudio-rule-case')) as HTMLElement[];
        const row = at >= 0 ? rows.find((r) => r.getAttribute('data-index') === String(at)) : undefined;
        const target = (row ? row.querySelector('.mapstudio-rule-remove') : box.querySelector('.mapstudio-rule-add')) as HTMLElement | null;
        if (target && typeof target.focus === 'function') {
            target.focus();
        }
    }

    /** The draft as it shows: what is being built, else the stored rule. */
    draft(): RuleDraft {
        return this.state.rule || ruleDraft(this.props.stored);
    }

    private options(): { own?: boolean } {
        return this.props.own ? { own: true } : {};
    }

    private off(): boolean {
        return this.props.off;
    }

    private dom(field: string, part: string): string {
        return this.props.idBase + '-' + field.replace(/[^A-Za-z0-9]/g, '_') + '-' + part;
    }

    /** The sent rule's save settled: seen on its way and gone, or the token moved on. */
    private settle(): void {
        const a = this.awaiting;
        if (!a) {
            return;
        }
        if (this.props.saving) {
            a.seenSaving = true;
        } else if (a.seenSaving || this.props.done !== a.done) {
            this.awaiting = null;
            this.settledNow = true;
        }
    }

    /** Whether the cursor is in the rule's controls. */
    private focusIn(): boolean {
        const el = this.ruleBox.current;
        return typeof document !== 'undefined' && !!el && el.contains(document.activeElement);
    }

    /** Whether a save of the rule is on its way or stands refused: the draft is then left alone. */
    private held(): boolean {
        return this.awaiting !== null || this.props.refused || this.props.saving;
    }

    /**
     * The stored rule taken into the draft once nothing holds it (no save on its way or refused, the cursor elsewhere, the draft
     * whole): another editor's rule shows, and a save that was given up leaves the store's. A draft still being built ("Not
     * saved yet") is never overwritten; the other types' cases stay as typed (owner decision 3). From entry 12c3 a stored rule
     * changed by this session's Undo or Redo, and the stored rule once a save of the draft was given up (the conflict card's
     * "Use their version", a discard), is taken with the cursor in the rule too, so Ctrl+Z from a rule button shows what is now
     * stored; only keystrokes not yet finished (`typed`) keep the draft under the cursor. Another editor's save still waits
     * for the cursor to leave the rule (12b1: the rows do not move under it, and the next change meets the conflict).
     */
    private foldStored(): void {
        const kind = this.props.kind;
        const rule = this.state.rule;
        const seen = JSON.stringify(this.props.stored);
        if (seen !== this.lastStored) {
            this.lastStored = seen;
            // The reverse batch of this item's Undo shows as its newest overrides at once, so the change comes while it is on its way.
            if (rule !== null && this.props.undoing === true) {
                this.byUndo = true;
            }
        }
        if (rule !== null && !this.ruleCommitting) {
            const o = this.options();
            const stored = this.props.stored;
            const version = this.props.version;
            const held = this.held();
            const whole = checkRule(rule, kind, o).rule;
            const same = sameRule(rule, stored, kind, o);
            const storedRule = checkRule(ruleDraft(stored), kind, o).rule;
            const settled = this.ruleSent !== '' && storedRule !== undefined && JSON.stringify(storedRule) === this.ruleSent;
            this.ruleBase = inStepVersion(this.ruleBase !== null ? this.ruleBase : version, version, { held, same, settled });
            if (this.props.own) {
                const now = JSON.stringify(stored);
                if (this.ruleBase === version) {
                    this.stepStored = now;
                } else if (this.stepStored === now) {
                    this.ruleBase = version;
                }
            }
            // An own rule with nothing stored yet (started empty, or its first save refused) has no stored rule to take.
            const nothing = this.props.own === true && stored === null;
            // Read once nothing holds the draft: while a refusal stands or the conflict waits for its card, nothing is given up yet
            // ("Apply mine on top" saves the draft; "Use their version" drops it, and only then does their rule show).
            if (this.settledNow && !held) {
                this.settledNow = false;
                this.dropped = !settled && !same;
            }
            if (same) {
                this.byUndo = false;
                this.dropped = false;
            }
            const free = !this.focusIn() || ((this.byUndo || this.dropped) && !this.typed);
            if (!held && !same && whole !== undefined && !this.ruleKept && !nothing && free) {
                this.byUndo = false;
                this.dropped = false;
                this.ruleBase = version;
                this.stepStored = JSON.stringify(stored);
                this.setState({ rule: foldRule(rule, ruleDraft(stored)) });
            }
        }
    }

    /**
     * One change of the rule's draft; `commit` sends it at once when it is whole (a select, a button), else its field's blur or
     * Enter does; `typing` marks keystrokes in a field, which are not replaced under the cursor until the field is finished.
     */
    private editRule(change: (draft: RuleDraft) => RuleDraft, commit: boolean, structure = false, typing = !commit): void {
        if (this.off()) {
            return;
        }
        if (this.ruleBase === null) {
            // The draft is made from the stored rule now: the version it is in step with the store at.
            this.ruleBase = this.props.version;
            this.stepStored = JSON.stringify(this.props.stored);
        }
        this.ruleKept = false;
        // The draft is the user's again: nothing of an Undo or a save given up is taken over what is changed from here.
        this.byUndo = false;
        this.dropped = false;
        this.settledNow = false;
        this.keptWhole = false;
        if (typing) {
            this.typed = true;
        }
        if (structure && this.props.refused) {
            // The rows moved: the words of the last refusal no longer stand beside the row they named.
            this.props.onClearRefusal();
        }
        // The commit runs once the draft is in the state, after this update's componentDidUpdate: a pressed button need not hold
        // the focus (some browsers give it none), so the flag, not the cursor, keeps the draft until it has been sent.
        this.ruleCommitting = this.ruleCommitting || commit;
        this.setState((prev) => ({ rule: change(prev.rule || ruleDraft(this.props.stored)) }), commit ? () => {
            this.ruleCommitting = false;
            this.commitRule();
        } : undefined);
    }

    /**
     * The rule sent when it is whole in shape and not what is stored (owner decision 2): the whole rule, at the version the draft
     * was first changed on. A draft that is not whole sends nothing; the editor says what is missing.
     */
    private commitRule(): void {
        this.typed = false;
        const draft = this.state.rule;
        if (draft === null || this.off()) {
            return;
        }
        const o = this.options();
        const check = checkRule(draft, this.props.kind, o);
        if (check.rule === undefined) {
            return;
        }
        const json = JSON.stringify(check.rule);
        if (this.awaiting === null && sameRule(draft, this.props.stored, this.props.kind, o)) {
            if (this.props.refused) {
                this.props.onClearRefusal();
            }
            return;
        }
        if (this.ruleSent === json && this.held()) {
            // On its way, or refused as it is: nothing new to send until it is changed.
            return;
        }
        const before = this.ruleSent;
        this.ruleSent = json;
        if (this.props.onSend(check.rule, this.ruleBase)) {
            this.awaiting = { done: this.props.done, seenSaving: false };
        } else {
            // Not taken (as 12a's fields): the marker is undone and the draft stays as typed.
            this.ruleSent = before;
            this.ruleKept = true;
        }
    }

    /** Enter finishes a typed field of the rule: the rule is sent when it is complete, and the focus stays in the field (entry 12c3). */
    private onDraftKey = (ev: React.KeyboardEvent<HTMLInputElement>): void => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            this.commitRule();
        }
    };

    /** The refusals that name a field, each with the Gateway's words, and (the value of an own rule) its own problem. */
    private messages(field: string, problem = ''): { nodes: React.ReactNode; ids: string[]; invalid: boolean } {
        const nodes: React.ReactNode[] = [];
        const ids: string[] = [];
        if (problem !== '') {
            const id = this.dom(field, 'problem');
            ids.push(id);
            nodes.push(<span key="problem" id={id} className="mapstudio-field-hint mapstudio-field-problem" aria-live="polite">{problem}</span>);
        }
        const refusals = this.props.refusals.filter((r) => r.words !== '' && r.at === field);
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

    private tile(preset: string): React.ReactElement {
        return <RuleTile kind={this.props.kind} preset={preset} symbols={this.props.symbols} colors={this.props.colors} />;
    }

    private presetSelect(value: string, label: string, describedBy: string[], invalid: boolean, onPick: (preset: string) => void): React.ReactElement {
        const presets = presetsFor(this.props.kind);
        return (
            <select className="mapstudio-input mapstudio-rule-preset" value={value} aria-label={label} aria-invalid={invalid}
                    aria-describedby={describedBy.length > 0 ? describedBy.join(' ') : undefined} disabled={this.off()}
                    onChange={(ev) => onPick(ev.target.value)}>
                <option value="">Pick a preset</option>
                {value !== '' && presets.indexOf(value) < 0 ? <option value={value}>{value}</option> : null}
                {presets.map((p) => <option key={p} value={p}>{presetWord(p)}</option>)}
            </select>
        );
    }

    /** A row's Remove; once the row is gone the focus is on the row before it (`index - 1`), or on Add. */
    private removeButton(label: string, index: number, onRemove: () => void): React.ReactElement {
        return (
            <button type="button" className="mapstudio-dock-button mapstudio-rule-remove" disabled={this.off()} title={label} aria-label={label}
                    onClick={() => {
                        this.focusRow = index - 1;
                        onRemove();
                    }}>
                <ChromeGlyph name="trash" size={16} />
            </button>
        );
    }

    /** The value the rule reads: a key value (switched-off ones too) or a typed tag path with its resolve note. */
    private renderSource(draft: RuleDraft, optional: boolean, pathWords: string): React.ReactElement {
        const kpis = this.props.kpis;
        const source = draftSource(draft);
        const m = this.messages(Fields.ruleSource, pathWords);
        const id = this.dom(Fields.ruleSource, 'select');
        const chosen = source.from === 'kpi' ? 'kpi:' + source.key : source.from;
        const type = draft.type as CaseType;
        const pick = (value: string): RuleSource => (value === 'path' ? { from: 'path', path: this.pathMemory[type] || '' }
            : value.indexOf('kpi:') === 0 ? { from: 'kpi', key: value.slice(4) } : { from: '' });
        const stored = this.props.stored ? draftSource(ruleDraft(this.props.stored)) : null;
        const note = this.props.pathNote;
        const onBrowse = this.props.onBrowse;
        const browsing = this.props.browsing === true && source.from === 'path';
        const pathInput = source.from === 'path' ? (
            <input type="text" className="mapstudio-input mapstudio-kindsetup-input mapstudio-mono mapstudio-rule-path" value={source.path}
                   placeholder={this.props.own ? '[default]Mesa/P12/Status' : '{asset.path}/Status'} aria-label="Tag path the rule reads"
                   aria-invalid={m.invalid} disabled={this.off()}
                   autoComplete="off" spellCheck={false}
                   onChange={(ev) => {
                       const path = ev.target.value;
                       this.editRule((d) => withSource(d, { from: 'path', path }), false);
                   }}
                   onBlur={() => this.commitRule()} onKeyDown={this.onDraftKey} />
        ) : null;
        return (
            <div className={'mapstudio-kindsetup-field mapstudio-rule-source' + (browsing ? ' mapstudio-kindsetup-field--browsing' : '')}
                 data-field={Fields.ruleSource} data-source={chosen}>
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
                    {source.from === 'kpi' && !kpis.some((k) => k.key === source.key) ? <option value={chosen}>{source.key}</option> : null}
                    {kpis.map((k) => (
                        <option key={k.key} value={'kpi:' + k.key}>{(k.label !== '' ? k.label : k.key) + (k.on ? '' : ' (off in the popup)')}</option>
                    ))}
                    <option value="path">A tag path</option>
                </select>
                {pathInput && onBrowse ? (
                    <div className="mapstudio-kindsetup-with-picker mapstudio-rule-pathline">
                        {pathInput}
                        <button type="button" className={'mapstudio-dock-button mapstudio-tag-button' + (browsing ? ' mapstudio-tag-button--open' : '')}
                                data-tag-for={this.props.browseFor || ''} disabled={this.off()} title="Pick a tag"
                                aria-label="Pick a tag for the style rule" aria-haspopup="dialog" aria-expanded={browsing} onClick={onBrowse}>
                            <ChromeGlyph name="tag" size={16} />
                        </button>
                    </div>
                ) : pathInput}
                {m.nodes}
                {note && source.from === 'path' && stored && stored.from === 'path' && stored.path === source.path.trim() ? note(stored.path) : null}
            </div>
        );
    }

    private renderStates(draft: RuleDraft, marked: number[], noteId: string): React.ReactNode {
        const name = sourceName(draftSource(draft), this.props.kpis);
        const set = (i: number, patch: Partial<StateRow>, commit: boolean): void =>
            this.editRule((d) => ({ ...d, states: d.states.map((r, at) => (at === i ? { ...r, ...patch } : r)) }), commit);
        const whenId = this.dom(Fields.styleRule, 'when');
        return (
            <React.Fragment>
                {/* Said once above the rows (entry 12c3), not in every row; each row's value is labelled by it and by its row ("Case 2"). */}
                {draft.states.length > 0 ? <span id={whenId} className="mapstudio-field-label mapstudio-rule-when-label">When {name} is</span> : null}
                {draft.states.map((row, i) => {
                    const m = this.messages(Fields.ruleCase(i));
                    const bad = m.invalid || marked.indexOf(i) >= 0;
                    // A row the note names is tied to the note's words.
                    const ids = marked.indexOf(i) >= 0 ? m.ids.concat([noteId]) : m.ids;
                    return (
                        <div key={i} id={whenId + '-' + i} className="mapstudio-rule-case" role="group" aria-label={'Case ' + (i + 1)} data-index={i}
                             data-rule="states" data-field={Fields.ruleCase(i)}>
                            <input type="text" className="mapstudio-input mapstudio-kindsetup-input mapstudio-rule-value" value={row.value}
                                   aria-labelledby={whenId + ' ' + whenId + '-' + i}
                                   aria-invalid={bad} aria-describedby={ids.length > 0 ? ids.join(' ') : undefined} disabled={this.off()}
                                   autoComplete="off" spellCheck={false}
                                   onChange={(ev) => set(i, { value: ev.target.value }, false)}
                                   onBlur={() => this.commitRule()} onKeyDown={this.onDraftKey} />
                            <div className="mapstudio-rule-look">
                                {this.presetSelect(row.preset, 'Preset of case ' + (i + 1), ids, bad, (preset) => set(i, { preset }, true))}
                                {this.tile(row.preset)}
                                {this.removeButton('Remove case ' + (i + 1), i,
                                    () => this.editRule((d) => ({ ...d, states: d.states.filter((_, at) => at !== i) }), true, true))}
                            </div>
                            {m.nodes}
                        </div>
                    );
                })}
                <span className="mapstudio-field-hint">A number, true or false is read as typed; text in double quotes stays text ("1").</span>
                <button type="button" className="mapstudio-button mapstudio-rule-add" disabled={this.off()}
                        onClick={() => this.editRule((d) => ({ ...d, states: d.states.concat([{ value: '', preset: '' }]) }), false, false, false)}>Add a case</button>
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
                                {this.removeButton('Remove band ' + (i + 1), i,
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
                        onClick={() => this.editRule((d) => ({ ...d, bands: d.bands.concat([{ from: '', to: '', preset: '' }]) }), false, false, false)}>Add a band</button>
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

    /** The type, the value, the type's rows with their tiles, what is missing while the rule is not whole, and the Gateway's words when it refused the rule. */
    render(): React.ReactElement {
        const kind = this.props.kind;
        const draft = this.draft();
        const check = checkRule(draft, kind, this.options());
        // What is missing shows once the rule has been touched: a stored rule is whole, and a kind with none says nothing.
        const touched = this.state.rule !== null;
        // A complete rule that came back not saved (refused or not taken before the item was left) says so until it is changed.
        const lost = this.keptWhole && check.rule !== undefined && !this.held() && !sameRule(draft, this.props.stored, kind, this.options());
        const missing = touched ? unsavedText(lost ? [KEPT_WHOLE_TEXT] : check.missing, lost ? '' : this.props.unsavedTail || '') : '';
        const marked = touched ? check.rows : [];
        const pathWords = touched && check.path ? check.path : '';
        const section = this.messages(Fields.styleRule);
        const noteId = this.dom(Fields.styleRule, 'unsaved');
        const types = this.props.own ? ownRuleTypes(kind) : ruleTypes(kind);
        const body = (
            <div ref={this.ruleBox} className="mapstudio-rule" data-field={Fields.styleRule}>
                <div className="mapstudio-rule-types" role="group" aria-label="Rule type">
                    {types.map((type: RuleType) => (
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
                {draft.type === 'none' && !this.props.own ? <span className="mapstudio-field-text mapstudio-kindsetup-none mapstudio-rule-none">No style rule</span> : null}
                {draft.type === 'instruments' ? (
                    <span className="mapstudio-field-text mapstudio-rule-instruments">Each segment takes the worst of the instruments at its ends.</span>
                ) : null}
                {draft.type === 'states' || draft.type === 'bands' || draft.type === 'expression'
                    ? this.renderSource(draft, draft.type === 'expression', pathWords) : null}
                {draft.type === 'states' ? this.renderStates(draft, marked, noteId) : null}
                {draft.type === 'bands' ? this.renderBands(draft, marked, noteId) : null}
                {draft.type === 'expression' ? this.renderExpression(draft) : null}
                {/* One node that stays mounted, only its words changing (entry 12c3): assistive technology hears each change. */}
                <span id={noteId} className="mapstudio-rule-unsaved" role="status" data-unsaved={missing !== '' ? 'true' : 'false'}>{missing}</span>
                {section.nodes}
            </div>
        );
        return this.props.frame ? this.props.frame(body, { type: draft.type, unsaved: missing !== '' }) : body;
    }
}
