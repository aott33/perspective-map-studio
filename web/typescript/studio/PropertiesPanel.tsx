import * as React from 'react';
import { AdapterStatus, Asset, AssetName, FormField, Kind } from '../adapters';
import { MapItemRecord } from '../contract';
import {
    FieldValue, REQUIRED_TEXT, UNKNOWN_KIND, assetListNote, assetVanished, fieldText, isUnset, kindListKnown, kindListNote, missingRequired,
    missingText, nameTwins, readField, twinText, unknownKindText, vanishedText
} from '../itemForm';
import { PLACE_CREDIT, PlaceSource, placeLine } from '../placeCheck';
import { instrumentLocationText, metresText, readDistance } from '../drawing';
import { round1 } from '../geometry';
import { distanceText } from '../linePopup';
import { Glyph } from '../popupParts';
import { roundCoordinate } from '../save';
import { FROM_KIND, LiveNowBlock, LiveNowRow, OVERRIDE, RULE_ROW, openSetupText, pathProblem } from '../itemOverrides';
import {
    Fields, KeyValue, RuleDraft, UNSAVED_KEEPS, checkRule, overrideLineText, ownLineText, ownRuleStart, presetWord, ruleWords, showsNowText, storedRuleOf
} from '../kindSetup';
import { ItemState } from '../live';
import { MarkerColors, SpriteSymbol } from '../markers';
import { ItemView } from '../placeholders';
import { ChromeGlyph } from './ChromeGlyph';
import { RuleEditor, RuleKeep, RuleTile } from './RuleEditor';
import { PAUSED_TEXT } from './UndoGroup';

/** The footer's delete icon on hover (entry 25): what it does and its key; no question is asked and Undo restores the item. */
export const DELETE_TITLE = 'Delete (Del)';

/** Why the footer's delete is off for an item never saved (entry 25's review: no delete at version 0; Discard drops a refused one). */
export const NOT_SAVED_TEXT = 'Not saved yet';

/** Why the footer's delete is off while the Point, Line or Area tool is in hand (entry 25's review): Esc puts the tool down. */
export const TOOL_IN_HAND_TEXT = 'Off while a tool is in hand - Esc puts it down';

/** Zoom to location beside Move (entry 27): its words and its hover text. */
export const ZOOM_TO_TEXT = 'Zoom to location';
export const ZOOM_TO_TITLE = 'Zoom to location: the map moves to the saved point';

/** The properties panel's tabs (entry 12c2; DESIGN.md Properties panel and tabs), in order. */
export type PanelTab = 'details' | 'style';
export const PANEL_TABS: ReadonlyArray<[PanelTab, string]> = [['details', 'Details'], ['style', 'Style']];

/** The tab an arrow key, Home or End moves to from `tab` (the tabs wrap), or null for any other key. */
export function tabForKey(tab: PanelTab, key: string): PanelTab | null {
    const at = PANEL_TABS.findIndex(([t]) => t === tab);
    const last = PANEL_TABS.length - 1;
    const to = key === 'ArrowRight' ? (at >= last ? 0 : at + 1) : key === 'ArrowLeft' ? (at <= 0 ? last : at - 1)
        : key === 'Home' ? 0 : key === 'End' ? last : -1;
    return to < 0 ? null : PANEL_TABS[to][0];
}

/** What sets an item's size, in a few words for the Style tab's "From kind" line (entries 12c2 and 12c3): read only. */
export function sizeText(kind: Kind): string {
    return kind.geometry === 'point' ? 'One size' : kind.area ? 'One outline' : 'Width by diameter';
}

/** The one hint under the Style tab's "From kind" line (entry 12c3): where the icon and the size come from, and that they are not changed here. */
export const STYLE_FROM_KIND_HINT = 'The icon and the size come from the project\'s kind list and are not changed here.';

/** The Style tab's words that are not a rule's (entry 12c3). */
export const LIVE_NOW = 'Live now';
export const EDIT_KIND_RULE = 'Edit the kind\'s rule';
export const OPEN_KIND_RULE = 'Open the kind\'s rule';

/** What the Style tab is drawn from (entry 12c2). */
export interface StyleFacts {
    /** The kind's key values: the value an own rule may read. */
    kpis: KeyValue[];
    /** The kind's stored style rule, or null. */
    kindRule: Record<string, unknown> | null;
    /** The item's own style rule when the Gateway applies it (from its newest overrides, those in flight included), else null. */
    ownRule: Record<string, unknown> | null;
    /** What a path under `{asset.path}` fills from when the kind's rule is copied for this item. */
    view: ItemView;
    /** The item's live state as the map draws it, or null before its first values. */
    state: ItemState | null;
    /** The sprite's symbols and the theme's token values, for the case tiles. */
    symbols?: Record<string, SpriteSymbol>;
    colors?: MarkerColors | null;
}

/** Whether a typed latitude or longitude reads as a number (in range or not): the place line follows a typed pair once both do. */
export function readsAsNumber(text: string): number | null {
    const t = text.trim();
    const n = Number(t);
    return t !== '' && Number.isFinite(n) ? n : null;
}

/** The footer's delete icon as it shows: why it is off ('' when on), its hover words, and whether it names the Delete key. */
export interface DeleteButton {
    off: string;
    title: string;
    key: boolean;
}

/**
 * The footer's delete icon (entry 25 and its review): off, saying why, while the store is unreachable, for an item never saved, and
 * while a tool is in hand (no delete then by the icon or the key); on, it names Del ("Delete (Del)", `aria-keyshortcuts`) only when
 * Del deletes this item (`delKey`), and is plain "Delete" while Del is a chosen point's Delete point or Move waits for its click.
 */
export function deleteButton(paused: boolean, pending: boolean, toolInHand: boolean, delKey: boolean): DeleteButton {
    const off = paused ? PAUSED_TEXT : pending ? NOT_SAVED_TEXT : toolInHand ? TOOL_IN_HAND_TEXT : '';
    const key = off === '' && delKey;
    return { off, title: off !== '' ? off : key ? DELETE_TITLE : 'Delete', key };
}

/**
 * The docked properties panel's Details tab (epic 4 entries 2 and 4; DESIGN.md Properties panel and tabs,
 * EXPERIENCE.md Properties panel, Place a point, Draw): the header with the kind glyph, the name and the
 * subline, the Details tab, then Name, Kind (a select of the kinds with the item's geometry, so a line or
 * area drawn with a generic tool takes its kind here; the Gateway accepts a kind of the same geometry),
 * Location (latitude and longitude, typed, the non-drag way to place a point; from entry 5 Move beside the label for a
 * point item that is not an instrument, then a click on the map, the owner's mock 4) and the asset link (the kind's
 * assets, Unlink). Every field saves when it is finished (blur, Enter or a choice) through the component's
 * callbacks, one batch each; a field finished while the item's create is still being saved (the item just
 * added with the cursor already in Name) goes to the delegate like any other, which sends it right after the
 * create's reply at the right version. The Style tab, the page
 * link and the Live now block are later entries (the place check is entry 27's, below). The panel is keyed by the item's id, so its drafts
 * start from the record; a new version of the record (a save, an undo, another editor's change) resets
 * the fields the user has not touched and keeps a draft being typed. While map.load says the store is
 * unreachable the fields are paused, as the toolbar is. From entry 25 (DESIGN.md Properties panel: "Footer: a delete icon",
 * key screen 4's bottom right of the panel, which docks left of the map, so the App Bar's corner stays clear) the footer holds
 * the delete icon: no question asked, the item deleted in one batch and one undo step, "Delete (Del)" on hover and as its
 * description while Del deletes this item (`deleteButton`; off for an item never saved and while a tool is in hand); the close
 * names Esc, and Move names Esc while it waits. Each control with a key names it in its hover text and to assistive technology.
 *
 * From entry 6 (R3, R12; itemForm.ts holds the rules) the kind's fields follow Location, in the kind list's order and as its
 * types (DESIGN.md Properties panel: location, kind fields, then the asset link): text and number inputs saved on blur or
 * Enter (Esc puts the record's value back), a number or a whole number that is not one refused in words beside the field
 * and not saved; a boolean a checkbox and a choice a select with "Not set" first, both saved on change. Each save is one
 * update of the whole `properties` (the delegate's `editProperty`), "edit <name>". A required field shows "Required" by its
 * label and, while it is not set, the line at the top names every missing one ("Missing: Status"); nothing stops a save.
 * Name is underlined in the `error` token while another live item with the same name (case and outer spaces aside) is
 * linked to a different asset, its tooltip and description naming it by its folder; the name still saves. An item whose kind
 * left the kind list shows "Unknown kind" with its stored values read only, Kind alone editable (while the kind list cannot be
 * checked against, the list's status message instead, the fields off as well); one whose asset left the asset list says so
 * under Asset and keeps its stored link; the asset list's status message shows under Asset while it is empty, incomplete,
 * failing, slow or not configured. A finished field is compared with the newest value sent for it (`newest`), and once the
 * item's saves settle (`saving` goes false) a field sent and not held by the record (a refused or dropped save) shows the
 * record's value again.
 *
 * From entry 27 (R13; placeCheck.ts holds the rules, docs/place-check.md the data) a point item's Location carries the place line
 * under the hint, in the secondary text colour, its tooltip naming the sources: the place of the typed pair once both fields read
 * as numbers, else of the saved point ("Lea County, New Mexico, US", "Near Grande Prairie, Alberta, CA", "Gulf of Mexico, off
 * Louisiana, US"); "Latitude and longitude look swapped" for a latitude past 90 whose swap is in range (nothing saved, as any pair
 * out of range), "Latitude and longitude may be swapped" for a pair in no area whose swap lands in one; "Looking up the place..."
 * while the data loads and "The place check is not available" if it failed, never stopping a save. The data is asked for when the
 * panel first shows a point (`places`, one fetch per page); a line or an area never asks. Zoom to location, beside Move, moves the
 * map to the saved point at zoom 15 or more, the selection and Details kept (`onZoomTo`).
 *
 * From entry 12c1 (R5; itemOverrides.ts holds the rules, docs/kind-setup.md "Overridden from Details") the Live now block stands
 * at the foot of Details, after Asset (DESIGN.md Properties panel, Override tag): the section label "LIVE NOW" with the "From
 * kind" tag, then Comms, one row per key value of the kind's setup in its order and Alarms, each its name (the icon value bold
 * and starred), its live value right-aligned in the popup's words, and its tag path in monospace under it: the kind's path
 * filled for this item, tagged "From kind", or the item's own full path, tagged Override with a Reset link. Override on a row
 * makes its path a text field starting from the path shown: Enter or blur saves it through `onOverride` (one update of the
 * item's whole `overrides`, an Undo step and a row of Recent changes), Esc puts it back. Only a full path is taken: anything
 * else says so under the field in the Gateway's words and nothing is sent; a path the Gateway refuses shows its words there too
 * (`overrideRefusal`) and the stored overrides stand. A kind with no comms, key values or alarms shows one line and "Open
 * <kind>'s setup"; an unlinked item shows the kind's paths as written and a note. No block for an item whose kind is unknown.
 * Test hooks: `.mapstudio-livenow` (`data-rows`, `data-unlinked`, `data-asset-missing`), a row `.mapstudio-livenow-row[data-row]` (`comms`,
 * `kpi:<key>`, `alarms`; `data-override` true or false, `data-off`), its value `.mapstudio-livenow-value`, its path
 * `.mapstudio-livenow-path`, its tag `.mapstudio-override-tag` or `.mapstudio-fromkind-tag`, the buttons
 * `.mapstudio-override-edit` and `.mapstudio-override-reset`, the field `.mapstudio-override-input` and its words
 * `.mapstudio-override-problem`, and `.mapstudio-livenow-setup` for the button of a kind with no setup.
 *
 * From entry 12c2 (R5, R15; docs/kind-setup.md "An item's own style rule from the Style tab") the panel has its two tabs, Details
 * and Style, a real tab list: one tab stop, the arrow keys (Home, End) move between them and choose, each names its panel
 * (`aria-controls`), the active one underlined. The tab chosen is the component's (`tab`, `onTab`), so it is kept while another
 * item is selected and across a visit to Kinds (an item just placed, which opens with the cursor in Name, shows Details until a
 * tab is chosen; the remembered tab is not changed by it). Both panels stay mounted, the one not chosen hidden.
 *
 * **Style**, in the order of entry 12c3 (the owner's layout after three reviews), top to bottom: (1) the **Style rule** heading
 * with its tag, "From kind", or Override with Reset; the section is described by the tag. (2) **Live now**, one line: what the
 * item shows now, by its kind's rule or its own (kindSetup.ts `showsNowText`). (3) The rule: from the kind, its sentence (a
 * path under `{asset.path}` filled for this item) and one line per case, the tile and its words; or the item's own rule in the
 * shared editor (studio/RuleEditor.tsx, no None type, a typed path a full path). (4) The actions: Override, the one bordered
 * button, and "Edit the kind's rule" as a text link (Kinds at that kind with section 6 in view, the selection kept, and "Back
 * to <name>" there), with one visible line saying what each does; while overridden, "For <name> only. Changes save as you make
 * them." and a link to the kind's rule. (5) Behind a divider, **From kind**: the icon and the size in one line with one hint
 * (no Label row until backlog 38).
 *
 * Override saves a copy of the kind's rule at once as the item's own (a path under `{asset.path}` filled for this item); a
 * kind with no rule and a path that cannot be filled start empty, saved once built. The rule saves through `onStyleRule` (one
 * update of the item's whole `overrides`, only `styleRule` changed: an Undo step and a row of Recent changes); a refusal's
 * words stand beside the part of the rule they name. A rule not saved yet says so in the editor's one note, the reason first,
 * then "The map keeps the saved rule until then."; it is kept per item for the session (`ruleKeep`, `onRuleKeep`), so another
 * item, Kinds or the other tab and back finds it as it was left. Esc inside the rule never closes the panel while a rule is
 * not saved (and never from a typed field of it); after Override the focus is on the rule's chosen type, never on Reset.
 * Test hooks: the tabs `.mapstudio-panel-tab[data-tab]` (`aria-selected`), the Style panel `.mapstudio-style`, the rule
 * `.mapstudio-style-rule[data-own]` (`data-editing` while an own rule not yet stored is being built), its tag
 * `.mapstudio-style-tag`, the line `.mapstudio-style-shows`, `.mapstudio-style-override`, `.mapstudio-style-reset`,
 * `.mapstudio-style-kind` (the link to the kind's rule), the visible line `.mapstudio-style-line`, the kind's rule in words
 * `.mapstudio-style-kindrule[data-rule]` with a case `.mapstudio-style-kindcase[data-preset]`, "Keep the kind's rule"
 * `.mapstudio-style-keep`, a refusal `.mapstudio-style-refusal`, and the foot `.mapstudio-style-fromkind` with
 * `[data-row="icon"]` and `[data-row="size"]`.
 */
export interface PropertiesPanelProps {
    item: MapItemRecord;
    kind: Kind | undefined;
    /** The kinds with the item's geometry (a line kind, areas included, for a LineString), for the Kind select. */
    kinds: Kind[];
    /** The kind's assets from the asset list (level `phone` or `full`), for the picker. */
    assets: Asset[];
    /** Every asset's id and name (map.load's `assetNames`): the linked asset's name, and whether it left the list (entry 6). */
    assetNames: AssetName[];
    /** The asset list's status (map.load's `adapters.assets`), or null when the Gateway sent none. */
    assetStatus: AdapterStatus | null;
    /** The map's items, for the duplicate name check (entry 6). */
    items: MapItemRecord[];
    /** Every asset of the asset list (level `full`), for the duplicate's words, which name the other asset's folder. */
    assetRows: Asset[];
    /** The kind list's status (map.load's `adapters.kinds`), or null: an item's kind reads unknown only while the list is in use. */
    kindStatus: AdapterStatus | null;
    /** A batch of the item is in flight or waiting its turn (the delegate's `inFlight`). */
    saving: boolean;
    /** The item's newest properties: those of its batch in flight or waiting, else the record's. */
    newest: Record<string, unknown>;
    /** The item's create is still being saved (no stored version yet): a finished field goes right after it. */
    pending: boolean;
    /** The map store is unreachable (map.load): the fields take no input, as the toolbar does. */
    paused: boolean;
    /** Open with the cursor in Name (the pad just placed; owner decision, 2026-11-04). */
    autoFocusName: boolean;
    onNameFocused: () => void;
    onClose: () => void;
    onRename: (name: string) => void;
    onMove: (lngLat: [number, number]) => void;
    /**
     * Entry 5: whether Move beside Location shows (a point item; an instrument moves along its line, entry 9), whether it waits
     * for the click, and Move pressed (pressed again while it waits, Move is put down). A move made while the item's create is
     * saved goes right after it, as a field does.
     */
    canMoveByClick: boolean;
    moving: boolean;
    onMoveStart: () => void;
    onLink: (assetId: string | null) => void;
    onKind: (kindId: string) => void;
    /** A finished field of the kind (entry 6): its key and its value as its type (null: not set). */
    onProperty: (key: string, value: FieldValue) => void;
    /** The footer's delete icon (entry 25): the item deleted with no question asked; Undo restores it. */
    onDelete: () => void;
    /** The Point, Line or Area tool is in hand, or a drawing is in progress: the footer's delete is off (entry 25's review). */
    toolInHand: boolean;
    /** The Delete key deletes this item now (no point chosen, no Move waiting): the footer names it. */
    delKey: boolean;
    /** The page's place data (entry 27): loaded when the panel first shows a point, its status read for the place line. */
    places: PlaceSource;
    /** Zoom to location (entry 27): the map moves to the saved point at zoom 15 or more; the selection and Details stay. */
    onZoomTo: () => void;
    /**
     * Entry 9, a line that is not an area: its instruments in order along it (the line popup's order, `instrumentsOn`), each with its
     * distance; undefined for a point or an area (no Instruments row).
     */
    instruments?: Array<{ id: string; name: string; distanceM: number }>;
    /** The instrument kinds Add an instrument offers (entry 9): one arms it at once, several open a short list to pick from. */
    instrumentKinds?: Kind[];
    /** The kind being placed on this line (the drawing bar says it), or null. */
    armedKind?: string | null;
    onAddInstrument?: (kindId: string) => void;
    /** A row of the Instruments list clicked: that instrument selected with its Details, as a list row does. */
    onSelectInstrument?: (id: string) => void;
    /**
     * Entry 9, an instrument on a line: the line's name and length, for "On L-SWD at 1.1 km" and the distance field; undefined
     * otherwise (a free point keeps its latitude and longitude).
     */
    onLine?: { name: string; lengthM: number };
    /** The distance along the line typed (Enter or blur): the instrument moves there along it, one change. */
    onMoveAlong?: (distanceM: number) => void;
    /** Entry 12c1: the Live now block (itemOverrides.ts `liveNowBlock`, from the item's newest overrides); undefined for none. */
    liveNow?: LiveNowBlock;
    /** The item's last override the Gateway refused: the row, its words and the path that was typed ('' for a Reset). */
    overrideRefusal?: { row: string; words: string; path: string; batchId: string; at?: string } | null;
    /** One row's path overridden for this item (a full path), or reset (null); `rowName` is the row's name as shown. */
    onOverride?: (row: string, path: string | null, rowName: string) => void;
    /** The refusal's words of this item cleared (the field put back or typed in again, or the panel left). */
    onClearOverrideRefusal?: (itemId: string) => void;
    /** "Open <kind>'s setup": Kinds at this item's kind, the selection kept. */
    onOpenKindSetup?: () => void;
    /** Entry 12c2: the tab chosen (Details when absent) and a tab chosen; the component keeps it across items and Kinds. */
    tab?: PanelTab;
    onTab?: (tab: PanelTab) => void;
    /** What the Style tab is drawn from; undefined for an item whose kind is not in the kind list. */
    style?: StyleFacts;
    /**
     * The item's own style rule saved (a whole rule) or removed (null, Reset); `base` is the item version the rule's draft was
     * last in step with the stored rule at (the newest when absent), so another editor's rule since meets the conflict.
     * False when the save was not taken.
     */
    onStyleRule?: (rule: Record<string, unknown> | null, base?: number) => boolean;
    /** "Edit the kind's rule": Kinds at this item's kind with section 6 in view, the selection kept. */
    onEditKindRule?: () => void;
    /** Entry 12c3: the own rule left not saved when this item's panel last went, or null; the editor opens on it as it was left. */
    ruleKeep?: RuleKeep | null;
    /** Entry 12c3: an Undo or a Redo of this item is on its way: the stored rule it changes shows in the editor wherever the focus is. */
    undoing?: boolean;
    /** Entry 12c3: a save of this item waits in the queue with a reason (its conflict card stands): the rule's draft is left alone until the card's choice. */
    waiting?: boolean;
    /** The panel is going: the own rule not saved yet (null for none) is kept for this item until its panel is back. */
    onRuleKeep?: (itemId: string, keep: RuleKeep | null) => void;
}

interface Drafts {
    name: string;
    lat: string;
    lng: string;
    /** Entry 9: an instrument's distance along its line, in metres, as typed; '' for an item not on a line. */
    distance: string;
    /** Why the typed distance was not saved ("Type a distance from 0 to 2,936 m"), '' when none. */
    distanceProblem: string;
    /** The short list of instrument kinds under Add an instrument is open (entry 9: several kinds to pick from). */
    kindMenu: boolean;
    /** The kind's fields being typed or just chosen, by key (entry 6); a key left out shows the record's value. */
    fields: Record<string, string>;
    /** A typed field's problem in words, by key ("Wells takes a whole number"); nothing of it was saved. */
    problems: Record<string, string>;
    /** Entry 12c1: the Live now row whose path is being typed (null for none), its text and why it was not sent ('' for none). */
    overrideRow: string | null;
    overrideText: string;
    overrideProblem: string;
    /** Entry 12c2: an own style rule being built that is not stored yet (Override on an item that starts empty), or null. */
    ruleStart: RuleDraft | null;
    /** Entry 12c2: this item was just placed, so its panel shows Details (the cursor in Name) until a tab is chosen; the remembered tab stays. */
    placed: boolean;
}

type FixedField = 'name' | 'lat' | 'lng' | 'distance';

/** The record's values as the fields show them. */
function draftsOf(item: MapItemRecord): Drafts {
    const point = item.geometry.type === 'Point';
    return {
        name: item.name,
        lat: point ? String(item.geometry.coordinates[1]) : '',
        lng: point ? String(item.geometry.coordinates[0]) : '',
        distance: item.attachment ? String(item.attachment.distanceM) : '',
        distanceProblem: '',
        kindMenu: false,
        fields: {},
        problems: {},
        overrideRow: null,
        overrideText: '',
        overrideProblem: '',
        ruleStart: null,
        placed: false
    };
}

/** A typed latitude or longitude, or null when it is not a number in range. */
export function readCoordinate(text: string, limit: number): number | null {
    const n = Number(text.trim());
    return text.trim() !== '' && Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

/** A dictionary without one key (a copy). */
function without(map: Record<string, string>, key: string): Record<string, string> {
    const out = { ...map };
    delete out[key];
    return out;
}

/** Whether a field's new value is what the record holds already (nothing to save). */
function sameValue(value: FieldValue, stored: unknown): boolean {
    return value === null ? isUnset(stored) : value === stored;
}

export class PropertiesPanel extends React.Component<PropertiesPanelProps, Drafts> {
    private nameInput: HTMLInputElement | null = null;
    /**
     * The field whose Esc is blurring it: its blur must not save. React batches the Esc's own state change, so the blur
     * that follows in the same handler still reads the typed draft.
     */
    private escaped: string | null = null;
    /** The kind fields sent and not yet settled, with the text each showed when sent (entry 6's review). */
    private sent = new Map<string, string>();
    /** False once unmounted: the place data's load may settle after the panel has gone. */
    private mounted = false;
    /** Entry 12c1: the Live now block's element, and the row whose Override button takes the focus back once its field closed. */
    private liveNowEl: HTMLElement | null = null;
    private refocusRow: string | null = null;
    /** True while Enter blurs the override's field: a field that closes then gives the focus back to its row's button. */
    private enterCommit = false;
    /** Entry 12c2: the Style panel's element, and where the focus goes once the rule's buttons changed (Override, Reset). */
    private styleEl: HTMLElement | null = null;
    private styleFocus: 'editor' | 'override' | null = null;
    /** The focus is moved only while the press is fresh: a save not taken changes no button, and nothing is focused later. */
    private styleFocusUntil = 0;
    private readonly tabEls: Partial<Record<PanelTab, HTMLButtonElement | null>> = {};
    /** Entry 12c3: the rule's editor, asked for its draft when the panel goes and whether it says "Not saved yet". */
    private readonly ruleEditor = React.createRef<RuleEditor>();
    /** The draft kept for this item, handed to the editor the panel first draws; none once the panel is mounted. */
    private kept: RuleKeep | null;

    constructor(props: PropertiesPanelProps) {
        super(props);
        this.kept = props.ruleKeep || null;
        const own = !!props.style && props.style.ownRule !== null;
        this.state = {
            ...draftsOf(props.item),
            // A kept draft of a rule not stored yet opens its editor again, still "Not saved yet".
            ruleStart: this.kept !== null && !!props.style && !own ? this.kept.draft : null,
            placed: props.autoFocusName && props.tab === 'style'
        };
    }

    componentDidMount(): void {
        this.mounted = true;
        // Entry 12c1: a refusal an earlier visit to this item left (one that came after its panel was left) is not shown again.
        if (this.props.overrideRefusal && this.props.onClearOverrideRefusal) {
            this.props.onClearOverrideRefusal(this.props.item.id);
        }
        this.focusName();
        this.watchPlaces();
        // The editor first drawn took the kept draft; one drawn later (after a Reset, say) starts from what is stored.
        this.kept = null;
    }

    componentWillUnmount(): void {
        this.mounted = false;
        // Entry 12c3: a rule not saved yet is kept for this item (another item, Kinds); nothing is sent meanwhile.
        if (this.props.onRuleKeep) {
            const editor = this.ruleEditor.current;
            this.props.onRuleKeep(this.props.item.id, editor ? editor.keep() : null);
        }
        // Entry 12c1: a refused override's words do not wait for the item to be selected again.
        if (this.props.overrideRefusal && this.props.onClearOverrideRefusal) {
            this.props.onClearOverrideRefusal(this.props.item.id);
        }
    }

    /** A point's Location asks for the place data (once per page; a later panel waits on the same load) and draws again when it settles. */
    private watchPlaces(): void {
        const places = this.props.places;
        if (this.props.item.geometry.type !== 'Point' || places.status().state === 'ready' || places.status().state === 'failed') {
            return;
        }
        places.load().then(() => {
            if (this.mounted) {
                this.forceUpdate();
            }
        });
    }

    componentDidUpdate(prev: PropertiesPanelProps): void {
        if (prev.item.id !== this.props.item.id) {
            this.sent.clear();
            this.setState(draftsOf(this.props.item));
        } else if (prev.item.version !== this.props.item.version) {
            // The record moved on (this field's save, a drag's move, an undo, another editor): a field the user has not
            // touched (its draft is the previous record's value) follows it; a draft being typed keeps its keystrokes.
            const before = draftsOf(prev.item);
            const after = draftsOf(this.props.item);
            const next: Partial<Drafts> = {};
            for (const field of ['name', 'lat', 'lng', 'distance'] as const) {
                if (this.state[field] === before[field]) {
                    next[field] = after[field];
                }
            }
            if (next.distance !== undefined) {
                next.distanceProblem = '';
            }
            // A kind field's draft goes once the record holds it (saved) or still holds what it had (not touched since).
            const fields: Record<string, string> = {};
            const problems: Record<string, string> = {};
            for (const key of Object.keys(this.state.fields)) {
                const text = this.state.fields[key];
                if (text !== fieldText(prev.item.properties[key]) && text !== fieldText(this.props.item.properties[key])) {
                    fields[key] = text;
                    if (this.state.problems[key]) {
                        problems[key] = this.state.problems[key];
                    }
                }
            }
            next.fields = fields;
            next.problems = problems;
            this.setState(next as Pick<Drafts, keyof Drafts>);
        }
        if (prev.item.id === this.props.item.id && prev.saving && !this.props.saving && this.sent.size > 0) {
            // The item's saves settled: a field sent and not held by the record (refused, or dropped behind a refusal) shows the
            // record's value again; one typed since it was sent keeps its keystrokes.
            const sent = new Map(this.sent);
            this.sent.clear();
            const properties = this.props.item.properties;
            this.setState((state) => {
                const fields = { ...state.fields };
                const problems = { ...state.problems };
                sent.forEach((text, key) => {
                    if (fields[key] === text && text !== fieldText(properties[key])) {
                        delete fields[key];
                        delete problems[key];
                    }
                });
                return { fields, problems };
            });
        }
        if (!prev.autoFocusName && this.props.autoFocusName) {
            if (this.tabNow() !== 'details') {
                this.setState({ placed: true }, () => this.focusName());
            } else {
                this.focusName();
            }
        }
        // Entry 12c1: a set path the Gateway refused opens its field again with what was typed and the Gateway's words.
        const refusal = this.props.overrideRefusal;
        const before = prev.item.id === this.props.item.id ? prev.overrideRefusal : null;
        if (refusal && refusal.path !== '' && (!before || before.batchId !== refusal.batchId) && this.state.overrideRow === null) {
            this.setState({ overrideRow: refusal.row, overrideText: refusal.path, overrideProblem: refusal.words });
        }
        // Entry 12c2: an own rule that went with nothing refused (Reset, an Undo, another editor) closes the editor it was built in.
        const owned = !!this.props.style && this.props.style.ownRule !== null;
        const wasOwned = prev.item.id === this.props.item.id && !!prev.style && prev.style.ownRule !== null;
        if (wasOwned && !owned && this.state.ruleStart !== null && !this.ruleRefusal()) {
            this.setState({ ruleStart: null });
        }
        if (this.styleFocus !== null && Date.now() > this.styleFocusUntil) {
            this.styleFocus = null;
        }
        if (this.styleFocus !== null && this.styleEl) {
            // After Override the focus is on the rule's chosen type, never on Reset: a second Enter changes nothing (entry 12c3).
            const target = this.styleFocus === 'override' ? this.styleEl.querySelector('.mapstudio-style-override')
                : this.styleEl.querySelector('.mapstudio-rule-type[aria-pressed="true"]');
            if (target) {
                this.styleFocus = null;
                (target as HTMLElement).focus();
            }
        }
        if (this.refocusRow !== null && this.state.overrideRow === null) {
            const row = this.refocusRow;
            this.refocusRow = null;
            const rows = this.liveNowEl ? Array.from(this.liveNowEl.querySelectorAll('.mapstudio-livenow-row')) as HTMLElement[] : [];
            const el = rows.find((r) => r.getAttribute('data-row') === row);
            const button = el ? el.querySelector('.mapstudio-override-edit') as HTMLButtonElement | null : null;
            if (button) {
                button.focus();
            }
        }
    }

    private focusName(): void {
        if (this.props.autoFocusName && this.nameInput) {
            this.nameInput.focus();
            this.nameInput.select();
            this.props.onNameFocused();
        }
    }

    private setNameInput = (el: HTMLInputElement | null): void => {
        this.nameInput = el;
    };

    /** True, once, when the blur is the Esc's (nothing to save). */
    private wasEscaped(field: string): boolean {
        if (this.escaped === field) {
            this.escaped = null;
            return true;
        }
        return false;
    }

    private commitName = (): void => {
        if (this.wasEscaped('name')) {
            return;
        }
        const name = this.state.name.trim();
        if (name === '' || name === this.props.item.name || this.props.paused) {
            this.setState({ name: this.props.item.name });
            return;
        }
        // The field shows the name as it is saved, outer spaces aside.
        this.setState({ name });
        this.props.onRename(name);
    };

    private commitLocation = (field: 'lat' | 'lng') => (): void => {
        if (this.wasEscaped(field)) {
            return;
        }
        const item = this.props.item;
        if (item.geometry.type !== 'Point' || item.attachment !== null) {
            // An instrument on a line moves along it only (entry 9): its latitude and longitude are read only.
            return;
        }
        const lat = readCoordinate(this.state.lat, 90);
        const lng = readCoordinate(this.state.lng, 180);
        if (lat === null || lng === null) {
            return;
        }
        const [oldLng, oldLat] = item.geometry.coordinates;
        if (roundCoordinate(lat) === roundCoordinate(oldLat) && roundCoordinate(lng) === roundCoordinate(oldLng) || this.props.paused) {
            return;
        }
        this.props.onMove([lng, lat]);
    };

    /**
     * An instrument's distance along its line finished (entry 9, Enter or blur; the non-drag way to move it, WCAG 2.5.7): read in
     * metres from 0 to the line's length, else the words beside the field and nothing saved; the stored distance saves nothing;
     * else one move along the line.
     */
    private commitDistance = (): void => {
        if (this.wasEscaped('distance')) {
            return;
        }
        const { item, onLine, paused } = this.props;
        if (!onLine || !item.attachment || paused || !this.props.onMoveAlong) {
            return;
        }
        const read = readDistance(this.state.distance, onLine.lengthM);
        if ('problem' in read) {
            this.setState({ distanceProblem: read.problem });
            return;
        }
        const d = round1(read.distanceM);
        this.setState({ distance: String(d), distanceProblem: '' });
        if (d !== item.attachment.distanceM) {
            this.props.onMoveAlong(d);
        }
    };

    /** Add an instrument (entry 9): one instrument kind arms it at once; several open the short list (pressed again, it closes). */
    private onAddInstrument = (): void => {
        const kinds = this.props.instrumentKinds || [];
        if (kinds.length === 1 && this.props.onAddInstrument) {
            this.setState({ kindMenu: false });
            this.props.onAddInstrument(kinds[0].id);
        } else if (kinds.length > 1) {
            this.setState((prev) => ({ kindMenu: !prev.kindMenu }));
        }
    };

    /** A kind picked in the short list (entry 9): it closes and the kind is armed. */
    private pickInstrumentKind(kindId: string): void {
        this.setState({ kindMenu: false });
        if (this.props.onAddInstrument) {
            this.props.onAddInstrument(kindId);
        }
    }

    /** Esc in the short list closes it, the focus back on Add an instrument, and goes no further (Details stays open). */
    private onKindMenuKey = (ev: React.KeyboardEvent<HTMLDivElement>): void => {
        if (ev.key !== 'Escape') {
            return;
        }
        ev.preventDefault();
        ev.stopPropagation();
        this.setState({ kindMenu: false });
        const root = ev.currentTarget.closest('.mapstudio-field--instruments');
        const button = root ? root.querySelector('.mapstudio-field-add-instrument') as HTMLButtonElement | null : null;
        if (button) {
            button.focus();
        }
    };

    /**
     * The Instruments row of a line's Details (entry 9; EXPERIENCE.md Properties panel), after Location: Add an instrument, then the
     * instruments on the line by name in order along it, each with its distance and a click selecting it; "None yet" when empty.
     */
    private renderInstruments(frozen: boolean): React.ReactNode {
        const instruments = this.props.instruments;
        if (!instruments) {
            return null;
        }
        const kinds = this.props.instrumentKinds || [];
        const armed = this.props.armedKind || null;
        const off = frozen ? (this.props.paused ? PAUSED_TEXT : 'Off while the kind is not in the kind list')
            : this.props.pending ? NOT_SAVED_TEXT : kinds.length === 0 ? 'The kind list has no instrument kind' : '';
        const title = off !== '' ? off : kinds.length === 1 ? 'Add a ' + kinds[0].name.toLowerCase() + ': click the line or type its distance'
            : 'Add an instrument: pick its kind, then click the line or type its distance';
        return (
            <div className="mapstudio-field mapstudio-field--instruments" data-count={String(instruments.length)} data-armed={armed || ''}>
                <div className="mapstudio-field-label-row">
                    <span className="mapstudio-field-label" id={'mapstudio-instruments-' + this.props.item.id}>Instruments</span>
                    <span className="mapstudio-field-actions">
                        <button type="button" className="mapstudio-button mapstudio-field-add-instrument" disabled={off !== ''} title={title}
                                aria-pressed={armed !== null} aria-haspopup={kinds.length > 1 ? 'menu' : undefined}
                                aria-expanded={kinds.length > 1 ? this.state.kindMenu : undefined} onClick={this.onAddInstrument}>Add an instrument</button>
                    </span>
                </div>
                {this.state.kindMenu && off === '' && kinds.length > 1 ? (
                    <div className="mapstudio-instrument-kinds" role="menu" aria-label="Instrument kinds" onKeyDown={this.onKindMenuKey}>
                        {kinds.map((k, i) => (
                            <button type="button" role="menuitem" key={k.id} className="mapstudio-instrument-kind" data-kind={k.id}
                                    autoFocus={i === 0} onClick={() => this.pickInstrumentKind(k.id)}>
                                {k.icon !== '' ? <Glyph id={k.icon} className="mapstudio-instrument-kind-glyph" size={16} /> : null}
                                <span>{k.name}</span>
                            </button>
                        ))}
                    </div>
                ) : null}
                {instruments.length === 0 ? (
                    <span className="mapstudio-field-text mapstudio-instruments-none">None yet</span>
                ) : (
                    <ul className="mapstudio-instrument-list" aria-labelledby={'mapstudio-instruments-' + this.props.item.id}>
                        {instruments.map((i) => (
                            <li key={i.id}>
                                <button type="button" className="mapstudio-instrument-row" data-item-id={i.id} title={'Select ' + i.name}
                                        onClick={() => this.props.onSelectInstrument && this.props.onSelectInstrument(i.id)}>
                                    <span className="mapstudio-instrument-name">{i.name}</span>
                                    <span className="mapstudio-instrument-at">{distanceText(i.distanceM)}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        );
    }

    /** Enter finishes a field (its blur saves it); Esc puts the record's value back. */
    private onKey = (field: FixedField) => (ev: React.KeyboardEvent<HTMLInputElement>): void => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            ev.currentTarget.blur();
        } else if (ev.key === 'Escape') {
            ev.preventDefault();
            ev.stopPropagation();
            this.escaped = field;
            this.setState({ [field]: draftsOf(this.props.item)[field] } as Pick<Drafts, FixedField>);
            if (field === 'distance') {
                this.setState({ distanceProblem: '' });
            }
            ev.currentTarget.blur();
            this.escaped = null;
        }
    };

    /** A kind field's text typed (entry 6): kept as the draft until it is finished. */
    private onFieldText = (key: string) => (ev: React.ChangeEvent<HTMLInputElement>): void => {
        const text = ev.target.value;
        this.setState((prev) => ({ fields: { ...prev.fields, [key]: text } }));
    };

    /**
     * A text or number field finished (entry 6): read as its type; a value that is not one says so beside the field and is not
     * saved; one the record already holds saves nothing; else one update of `properties`, the draft showing the value as stored.
     */
    private commitField = (field: FormField) => (): void => {
        if (this.wasEscaped('field:' + field.key)) {
            return;
        }
        const text = this.state.fields[field.key];
        if (text === undefined) {
            return;
        }
        if (this.props.paused || !this.props.kind) {
            this.setState((prev) => ({ fields: without(prev.fields, field.key), problems: without(prev.problems, field.key) }));
            return;
        }
        const read = readField(field, text);
        if ('problem' in read) {
            const problem = read.problem;
            this.setState((prev) => ({ problems: { ...prev.problems, [field.key]: problem } }));
            return;
        }
        if (sameValue(read.value, this.props.newest[field.key])) {
            // The value sent last (or stored): nothing to send; the draft shows it until the record holds it.
            const shown = fieldText(read.value);
            this.setState((prev) => ({
                fields: this.sent.has(field.key) ? { ...prev.fields, [field.key]: shown } : without(prev.fields, field.key),
                problems: without(prev.problems, field.key)
            }));
            if (this.sent.has(field.key)) {
                this.sent.set(field.key, shown);
            }
            return;
        }
        const shown = fieldText(read.value);
        this.setState((prev) => ({ fields: { ...prev.fields, [field.key]: shown }, problems: without(prev.problems, field.key) }));
        this.sent.set(field.key, shown);
        this.props.onProperty(field.key, read.value);
    };

    /** Enter finishes a kind field; Esc puts the record's value back and saves nothing. */
    private onFieldKey = (field: FormField) => (ev: React.KeyboardEvent<HTMLInputElement>): void => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            ev.currentTarget.blur();
        } else if (ev.key === 'Escape') {
            ev.preventDefault();
            ev.stopPropagation();
            this.escaped = 'field:' + field.key;
            this.setState((prev) => ({ fields: without(prev.fields, field.key), problems: without(prev.problems, field.key) }));
            ev.currentTarget.blur();
            this.escaped = null;
        }
    };

    /** A choice or a checkbox (entry 6): saved at once, the draft showing it until the record holds it. */
    private chooseField(field: FormField, value: FieldValue): void {
        if (this.props.paused || !this.props.kind || sameValue(value, this.props.newest[field.key])) {
            return;
        }
        const shown = fieldText(value);
        this.setState((prev) => ({ fields: { ...prev.fields, [field.key]: shown } }));
        this.sent.set(field.key, shown);
        this.props.onProperty(field.key, value);
    }

    private onAssetChange = (ev: React.ChangeEvent<HTMLSelectElement>): void => {
        const value = ev.target.value;
        this.props.onLink(value === '' ? null : value);
    };

    private onKindChange = (ev: React.ChangeEvent<HTMLSelectElement>): void => {
        const value = ev.target.value;
        if (value !== '' && value !== this.props.item.kind && !this.props.paused) {
            this.props.onKind(value);
        }
    };

    private onUnlink = (): void => {
        this.props.onLink(null);
    };

    /** Override (or Change) on a Live now row (entry 12c1): its path becomes a text field starting from the path shown. */
    private startOverride(row: LiveNowRow): void {
        if (this.props.overrideRefusal && this.props.onClearOverrideRefusal) {
            this.props.onClearOverrideRefusal(this.props.item.id);
        }
        this.setState({ overrideRow: row.id, overrideText: row.path, overrideProblem: '' });
    }

    /**
     * The override's field finished (Enter or blur): the path shown already sends nothing; anything but a full path says so in
     * the Gateway's words and sends nothing, the field kept open; a full path is sent and the field closes.
     */
    private commitOverride(row: LiveNowRow): void {
        if (!row || this.state.overrideRow !== row.id) {
            return;
        }
        const text = this.state.overrideText.trim();
        const refusal = this.props.overrideRefusal;
        if (refusal && refusal.row === row.id && refusal.path === text) {
            // The path the Gateway just refused: its words stand and it is not sent again as it is.
            this.setState({ overrideText: text, overrideProblem: refusal.words });
            return;
        }
        if (this.props.paused || !this.props.onOverride || text === row.path) {
            this.closeOverride(row.id);
            return;
        }
        const problem = pathProblem(text);
        if (problem !== '') {
            this.setState({ overrideText: text, overrideProblem: problem });
            return;
        }
        this.closeOverride(row.id);
        this.props.onOverride(row.id, text, row.name);
    }

    /** The override's field closed; after Enter the focus goes back to the row's button. */
    private closeOverride(row: string): void {
        if (this.enterCommit) {
            this.refocusRow = row;
        }
        // A closed field takes its refusal's words with it (the shown path typed back, or a pause).
        const refusal = this.props.overrideRefusal;
        if (refusal && refusal.row === row && this.props.onClearOverrideRefusal) {
            this.props.onClearOverrideRefusal(this.props.item.id);
        }
        this.setState({ overrideRow: null, overrideProblem: '' });
    }

    /** Enter finishes the override's field, as leaving it does; Esc puts the path back, sends nothing and goes no further. */
    private onOverrideKey = (ev: React.KeyboardEvent<HTMLInputElement>): void => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            this.enterCommit = true;
            this.commitOverride(this.rowOf(this.state.overrideRow));
            this.enterCommit = false;
        } else if (ev.key === 'Escape') {
            ev.preventDefault();
            ev.stopPropagation();
            this.refocusRow = this.state.overrideRow;
            if (this.props.overrideRefusal && this.props.onClearOverrideRefusal) {
                this.props.onClearOverrideRefusal(this.props.item.id);
            }
            this.setState({ overrideRow: null, overrideProblem: '' });
        }
    };

    /** The Live now row with this id (the one being typed in). */
    private rowOf(id: string | null): LiveNowRow {
        const rows = this.props.liveNow ? this.props.liveNow.rows : [];
        return rows.find((r) => r.id === id) as LiveNowRow;
    }

    /** Reset on an overridden row: the item's own path goes and the kind's shows again. */
    private resetOverride(row: LiveNowRow): void {
        if (this.props.onOverride && !this.props.paused) {
            this.refocusRow = row.id;
            this.setState({ overrideRow: null, overrideProblem: '' });
            this.props.onOverride(row.id, null, row.name);
        }
    }

    /** One row of the Live now block (entry 12c1): the name, its tag and the live value, then the path with its buttons, or its field. */
    private renderLiveRow(row: LiveNowRow, frozen: boolean): React.ReactElement {
        const overridden = row.override !== null;
        const editing = this.state.overrideRow === row.id;
        const refusal = this.props.overrideRefusal && this.props.overrideRefusal.row === row.id ? this.props.overrideRefusal : null;
        const problem = editing ? this.state.overrideProblem : refusal ? refusal.words : '';
        const id = 'mapstudio-livenow-' + this.props.item.id + '-' + row.id;
        return (
            <div key={row.id} className={'mapstudio-livenow-row' + (overridden ? ' mapstudio-livenow-row--override' : '')} data-row={row.id}
                 data-override={overridden ? 'true' : 'false'} data-off={row.off ? 'true' : 'false'} data-problem={problem}>
                <div className="mapstudio-livenow-line">
                    <span className={'mapstudio-livenow-name' + (row.icon ? ' mapstudio-livenow-name--icon' : '')}>{row.name}</span>
                    {row.icon ? (
                        <span className="mapstudio-livenow-star" role="img" aria-label="Icon value" title="Icon value">
                            <svg viewBox="0 0 24 24" width={12} height={12} aria-hidden="true" focusable="false">
                                <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" fill="currentColor"
                                      stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
                            </svg>
                        </span>
                    ) : null}
                    {overridden
                        ? <span className="mapstudio-override-tag">{OVERRIDE}</span>
                        : <span className="mapstudio-kindsetup-tag mapstudio-fromkind-tag">{FROM_KIND}</span>}
                    {overridden ? (
                        <button type="button" className="mapstudio-override-reset" disabled={frozen} title="Reset to the kind's path"
                                aria-label={'Reset ' + row.name + ' to the kind\'s path'} onClick={() => this.resetOverride(row)}>Reset</button>
                    ) : null}
                    <span className={'mapstudio-livenow-value' + (row.icon ? ' mapstudio-livenow-value--icon' : '') + (row.off ? ' mapstudio-livenow-value--off' : '')}
                          title={row.note !== '' ? row.note : undefined} data-stale={row.stale ? 'true' : 'false'}>
                        {row.lost ? <Glyph id="comms-lost" className="mapstudio-popup-state-glyph" size={14} />
                            : row.stale ? <Glyph id="stale" className="mapstudio-popup-state-glyph" size={14} /> : null}
                        {row.stale ? <span className="mapstudio-visually-hidden">Stale - </span> : null}
                        {row.value}
                    </span>
                </div>
                {editing ? (
                    <input className="mapstudio-input mapstudio-mono mapstudio-override-input" type="text" value={this.state.overrideText} autoFocus
                           spellCheck={false} aria-label={row.name + ' path for ' + this.props.item.name + ' only'}
                           aria-invalid={problem !== ''} aria-describedby={problem !== '' ? id + '-problem' : undefined}
                           onFocus={(ev) => ev.currentTarget.select()}
                           onChange={(ev) => this.setState({ overrideText: ev.target.value })}
                           onBlur={() => this.commitOverride(row)} onKeyDown={this.onOverrideKey} />
                ) : (
                    <div className="mapstudio-livenow-pathline">
                        <span className="mapstudio-mono mapstudio-livenow-path">{row.path}</span>
                        <span className="mapstudio-livenow-actions">
                            <button type="button" className="mapstudio-button mapstudio-override-edit" disabled={frozen}
                                    title={overridden ? 'Change this path for ' + this.props.item.name + ' only' : 'Use another tag for ' + this.props.item.name + ' only'}
                                    aria-label={(overridden ? 'Change the ' : 'Override the ') + row.name + ' path'}
                                    onClick={() => this.startOverride(row)}>{overridden ? 'Change' : 'Override'}</button>
                        </span>
                    </div>
                )}
                {problem !== '' ? (
                    <span id={id + '-problem'} className="mapstudio-field-hint mapstudio-field-problem mapstudio-override-problem" role="alert">{problem}</span>
                ) : null}
            </div>
        );
    }

    /** The Live now block at the foot of Details (entry 12c1): the label with "From kind", the rows, or the one line of a kind with none. */
    private renderLiveNow(frozen: boolean): React.ReactNode {
        const block = this.props.liveNow;
        const kind = this.props.kind;
        if (!block || !kind) {
            return null;
        }
        return (
            <section className="mapstudio-livenow" aria-labelledby={'mapstudio-livenow-' + this.props.item.id} ref={(el) => { this.liveNowEl = el; }}
                     data-rows={String(block.rows.length)} data-unlinked={block.unlinked ? 'true' : 'false'}
                     data-asset-missing={block.assetMissing ? 'true' : 'false'}>
                {/* The tag stands beside the label, outside the heading that names the block. */}
                <div className="mapstudio-kindsetup-heading mapstudio-livenow-head">
                    <h3 className="mapstudio-livenow-heading" id={'mapstudio-livenow-' + this.props.item.id}>Live now</h3>
                    <span className="mapstudio-kindsetup-tag mapstudio-fromkind-tag">{FROM_KIND}</span>
                </div>
                {block.rows.length === 0 ? (
                    <div className="mapstudio-livenow-empty">
                        <span className="mapstudio-field-hint">{block.empty}</span>
                        <button type="button" className="mapstudio-button mapstudio-livenow-setup" onClick={this.props.onOpenKindSetup}>{openSetupText(kind.name)}</button>
                    </div>
                ) : block.rows.map((row) => this.renderLiveRow(row, frozen))}
                {block.rows.length > 0 && block.note !== '' ? <span className="mapstudio-field-hint mapstudio-livenow-unlinked">{block.note}</span> : null}
            </section>
        );
    }

    // ---- The tabs and the Style tab (entry 12c2) ----

    private tabNow(): PanelTab {
        return this.props.tab === 'style' && !this.state.placed ? 'style' : 'details';
    }

    /** A tab chosen: the component remembers it, and a just-placed item's hold on Details ends. */
    private chooseTab(tab: PanelTab): void {
        if (this.state.placed) {
            this.setState({ placed: false });
        }
        if (this.props.onTab) {
            this.props.onTab(tab);
        }
    }

    private tabId(tab: PanelTab, part: 'tab' | 'panel'): string {
        return 'mapstudio-panel-' + this.props.item.id + '-' + tab + '-' + part;
    }

    /** The arrow keys, Home and End move between the tabs and choose (one tab stop; the focus follows the choice). */
    private onTabKey = (ev: React.KeyboardEvent<HTMLButtonElement>): void => {
        const to = tabForKey(this.tabNow(), ev.key);
        if (to === null) {
            return;
        }
        ev.preventDefault();
        this.chooseTab(to);
        const el = this.tabEls[to];
        if (el) {
            el.focus();
        }
    };

    private renderTabs(): React.ReactElement {
        const now = this.tabNow();
        return (
            <div className="mapstudio-panel-tabs" role="tablist" aria-label={this.props.item.name}>
                {PANEL_TABS.map(([tab, label]) => (
                    <button key={tab} ref={(el) => { this.tabEls[tab] = el; }} type="button" role="tab" id={this.tabId(tab, 'tab')} data-tab={tab}
                            aria-selected={now === tab} aria-controls={this.tabId(tab, 'panel')} tabIndex={now === tab ? 0 : -1}
                            className={'mapstudio-panel-tab' + (now === tab ? ' mapstudio-panel-tab--active' : '')}
                            onClick={() => this.chooseTab(tab)} onKeyDown={this.onTabKey}>{label}</button>
                ))}
            </div>
        );
    }

    /** The refusal of the item's own style rule that stands, or null. */
    private ruleRefusal(): { at: string; words: string } | null {
        const refusal = this.props.overrideRefusal;
        return refusal && refusal.row === RULE_ROW ? { at: refusal.at || Fields.styleRule, words: refusal.words } : null;
    }

    /**
     * Override on the rule (owner decision 1): the copy of the kind's rule is saved at once as the item's own, so it is marked
     * Override straight away and Undo takes it back; a copy that is not a whole rule (an item with no asset, a kind with no rule)
     * opens the editor on it, saved once it is built.
     */
    private onOverrideRule = (): void => {
        const { kind, style } = this.props;
        if (!kind || !style || this.props.paused || !this.props.onStyleRule) {
            return;
        }
        const start = ownRuleStart(style.kindRule, style.view);
        const rule = checkRule(start, kind, { own: true }).rule;
        this.focusStyle('editor');
        if (rule) {
            this.props.onStyleRule(rule);
        } else {
            this.setState({ ruleStart: start });
        }
    };

    /** Once the rule's buttons have changed, the focus goes to the one that took the pressed one's place. */
    private focusStyle(to: 'editor' | 'override'): void {
        this.styleFocus = to;
        this.styleFocusUntil = Date.now() + 3000;
    }

    /** Reset: the item's own rule goes and the kind's draws it again. */
    private onResetRule = (): void => {
        if (this.props.paused || !this.props.onStyleRule) {
            return;
        }
        this.focusStyle('override');
        this.setState({ ruleStart: null });
        this.props.onStyleRule(null);
    };

    /** An own rule not stored yet given up: the kind's rule shows again, and nothing was sent. */
    private onKeepKindRule = (): void => {
        const refusal = this.ruleRefusal();
        if (refusal && this.props.onClearOverrideRefusal) {
            this.props.onClearOverrideRefusal(this.props.item.id);
        }
        this.focusStyle('override');
        this.setState({ ruleStart: null });
    };

    /**
     * Esc in a typed field of the rule stays there: the draft is kept, and the panel is not closed under it. From entry 12c3 Esc
     * anywhere in the rule (a type button, a Remove, Reset, a link) never closes the panel while a rule is not saved.
     */
    private onStyleKey = (ev: React.KeyboardEvent<HTMLDivElement>): void => {
        if (ev.key !== 'Escape') {
            return;
        }
        const target = ev.target as HTMLElement;
        const tag = target && typeof target.tagName === 'string' ? target.tagName.toUpperCase() : '';
        const field = (tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && (target as HTMLInputElement).type === 'text'))
            && !!target.closest('.mapstudio-rule');
        const editor = this.ruleEditor.current;
        if (field || (editor !== null && editor.unsaved() && !!target.closest('.mapstudio-style-rule'))) {
            ev.stopPropagation();
        }
    };

    /** The kind's rule in words, read only: its sentence, then one line per case, the tile and its words (no code name). */
    private renderKindRule(kind: Kind, style: StyleFacts): React.ReactElement {
        const words = ruleWords(style.kindRule, style.kpis, kind, style.view);
        return (
            <div className="mapstudio-style-kindrule" data-rule={words.type}>
                <span className={'mapstudio-field-text mapstudio-style-summary' + (words.type === 'none' ? ' mapstudio-kindsetup-none' : '')}>{words.summary}</span>
                {words.expression !== '' ? <span className="mapstudio-mono mapstudio-style-expression">{words.expression}</span> : null}
                {words.cases.length > 0 ? (
                    <ul className="mapstudio-style-kindcases" aria-label={'The cases of the ' + kind.name + ' rule'}>
                        {words.cases.map((c, i) => (
                            <li key={i} className="mapstudio-style-kindcase" data-preset={c.preset}>
                                <RuleTile kind={kind} preset={c.preset} symbols={style.symbols} colors={style.colors} word={false} />
                                <span className="mapstudio-style-kindcase-text">
                                    <span>{c.label}</span>
                                    {words.type !== 'expression' ? <span className="mapstudio-style-kindcase-preset">{presetWord(c.preset)}</span> : null}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>
        );
    }

    /**
     * The Style tab (entries 12c2 and 12c3), top to bottom: the Style rule heading with its tag, Live now, the rule (the kind's
     * in words, or the item's own in the editor), the actions with their one visible line, then "From kind": icon and size.
     */
    private renderStyle(frozen: boolean): React.ReactNode {
        const { item, kind, style } = this.props;
        if (!kind || !style) {
            return <span className="mapstudio-field-hint mapstudio-style-unknown">The style comes from the item's kind, which is not in the kind list.</span>;
        }
        const own = style.ownRule !== null;
        const editing = !own && this.state.ruleStart !== null;
        const refusal = this.ruleRefusal();
        const headingId = 'mapstudio-style-rule-' + item.id;
        const tagId = headingId + '-tag';
        const lineId = headingId + '-line';
        const footId = headingId + '-fromkind';
        // Whether Override would save its copy at once: by what the kind's rule needs of this item (owner's ruling on 12c2).
        const atOnce = !own && !editing && checkRule(ownRuleStart(style.kindRule, style.view), kind, { own: true }).rule !== undefined;
        return (
            <React.Fragment>
                <section className="mapstudio-style-rule" aria-labelledby={headingId} aria-describedby={tagId} data-own={own ? 'true' : 'false'}
                         data-editing={editing ? 'true' : 'false'}>
                    {/* The tag stands beside the label, outside the heading that names the rule, and describes the section. One node
                        in every state, only its words and look changing; an own rule not stored yet still draws from the kind. */}
                    <div className="mapstudio-kindsetup-heading mapstudio-style-rule-head">
                        <h3 className="mapstudio-livenow-heading" id={headingId}>Style rule</h3>
                        <span id={tagId} className={'mapstudio-style-tag ' + (own ? 'mapstudio-override-tag' : 'mapstudio-kindsetup-tag mapstudio-fromkind-tag')}>
                            {own ? OVERRIDE : FROM_KIND}
                        </span>
                        {own ? (
                            <button type="button" className="mapstudio-override-reset mapstudio-style-reset" disabled={frozen}
                                    title="Reset to the kind's rule" aria-label={'Reset ' + item.name + ' to the kind\'s style rule'}
                                    onClick={this.onResetRule}>Reset</button>
                        ) : null}
                    </div>
                    {/* One line, one node that stays mounted in every state: only its words change, so each change is heard once. */}
                    <div className="mapstudio-style-live">
                        <span className="mapstudio-field-label mapstudio-style-live-label">{LIVE_NOW}</span>
                        <span className="mapstudio-style-shows" role="status" aria-live="polite">
                            {showsNowText({ kind, name: item.name, state: style.state, own, rule: storedRuleOf(own ? style.ownRule : style.kindRule) })}
                        </span>
                    </div>
                    {own || editing ? (
                        <RuleEditor ref={this.ruleEditor} kind={kind} kpis={style.kpis} stored={style.ownRule} version={item.version} off={frozen}
                                    idBase={'mapstudio-style-' + item.id} refusals={refusal ? [refusal] : []} refused={refusal !== null || this.props.waiting === true}
                                    saving={this.props.saving} done={item.version + ':' + (refusal && this.props.overrideRefusal ? this.props.overrideRefusal.batchId : '')}
                                    onSend={(rule, base) => rule !== null && !!this.props.onStyleRule
                                        && this.props.onStyleRule(rule, base !== null ? base : undefined)}
                                    onClearRefusal={() => this.props.onClearOverrideRefusal && this.props.onClearOverrideRefusal(item.id)}
                                    symbols={style.symbols} colors={style.colors} own initial={this.state.ruleStart} kept={this.kept}
                                    unsavedTail={UNSAVED_KEEPS} undoing={this.props.undoing === true} />
                    ) : this.renderKindRule(kind, style)}
                    {own || editing ? (
                        <React.Fragment>
                            <span id={lineId} className="mapstudio-field-hint mapstudio-style-line mapstudio-style-own-note">{ownLineText(item.name)}</span>
                            <div className="mapstudio-style-actions">
                                {editing ? (
                                    <button type="button" className="mapstudio-button mapstudio-style-keep" disabled={frozen}
                                            onClick={this.onKeepKindRule}>Keep the kind's rule</button>
                                ) : null}
                                <button type="button" className="mapstudio-style-link mapstudio-style-kind" onClick={this.props.onEditKindRule}>{OPEN_KIND_RULE}</button>
                            </div>
                        </React.Fragment>
                    ) : (
                        <React.Fragment>
                            {/* Override is the one bordered button; the kind's rule is a text link. What each does is said in view. */}
                            <div className="mapstudio-style-actions">
                                <button type="button" className="mapstudio-button mapstudio-style-override" disabled={frozen} aria-describedby={lineId}
                                        onClick={this.onOverrideRule}>Override</button>
                                <button type="button" className="mapstudio-style-link mapstudio-style-kind" aria-describedby={lineId}
                                        onClick={this.props.onEditKindRule}>{EDIT_KIND_RULE}</button>
                            </div>
                            <span id={lineId} className="mapstudio-field-hint mapstudio-style-line">{overrideLineText(item.name, kind, atOnce)}</span>
                            {refusal ? (
                                <span className="mapstudio-field-refusal mapstudio-style-refusal" role="alert">
                                    <ChromeGlyph name="warning" className="mapstudio-field-refusal-glyph" size={14} />
                                    <span className="mapstudio-field-refusal-text">{refusal.words}</span>
                                </span>
                            ) : null}
                        </React.Fragment>
                    )}
                </section>
                {/* Behind the divider, what the kind alone sets (entry 12c3): the icon and the size in one line, with one hint. */}
                <div className="mapstudio-style-fromkind" role="group" aria-labelledby={footId}>
                    <span id={footId} className="mapstudio-kindsetup-heading mapstudio-style-fromkind-head">{FROM_KIND}</span>
                    <div className="mapstudio-style-fromkind-line">
                        <span className="mapstudio-style-fromkind-part" data-row="icon">
                            <span className="mapstudio-field-label">Icon</span>
                            <span className="mapstudio-kindsetup-icon mapstudio-style-value" data-icon={kind.icon}>
                                <span className="mapstudio-popup-disc">
                                    {kind.icon !== '' ? <Glyph id={kind.icon} className="mapstudio-popup-glyph" size={18} /> : null}
                                </span>
                                <span className="mapstudio-mono">{kind.icon !== '' ? kind.icon : 'No icon'}</span>
                            </span>
                        </span>
                        <span className="mapstudio-style-fromkind-part" data-row="size">
                            <span className="mapstudio-field-label">Size</span>
                            <span className="mapstudio-style-value">{sizeText(kind)}</span>
                        </span>
                    </div>
                    <span className="mapstudio-field-hint">{STYLE_FROM_KIND_HINT}</span>
                </div>
            </React.Fragment>
        );
    }

    /** One of the kind's fields (entry 6) as its type, its draft or else the record's value. */
    private renderField(field: FormField, index: number): React.ReactElement {
        const { item, paused } = this.props;
        const id = 'mapstudio-prop-' + item.id + '-' + index;
        const draft = this.state.fields[field.key];
        const text = draft !== undefined ? draft : fieldText(item.properties[field.key]);
        const problem = this.state.problems[field.key] || '';
        const required = field.required ? <span className="mapstudio-field-required">{REQUIRED_TEXT}</span> : null;
        const rowProps = {
            className: 'mapstudio-field mapstudio-field--prop mapstudio-field--' + field.type,
            'data-field': field.key,
            'data-type': field.type,
            'data-required': field.required ? 'true' : 'false',
            'data-problem': problem
        };
        if (field.type === 'boolean') {
            return (
                <div key={field.key} {...rowProps}>
                    <div className="mapstudio-field-check-row">
                        <input id={id} type="checkbox" className="mapstudio-field-prop mapstudio-field-check" checked={text === 'true'}
                               disabled={paused} aria-required={field.required}
                               onChange={(ev) => this.chooseField(field, ev.target.checked)} />
                        <label className="mapstudio-field-check-label" htmlFor={id}>{field.label}</label>
                        {required}
                    </div>
                </div>
            );
        }
        const label = (
            <div className="mapstudio-field-label-row mapstudio-field-label-row--start">
                <label className="mapstudio-field-label" htmlFor={id}>{field.label}</label>
                {required}
            </div>
        );
        if (field.type === 'choice') {
            const odd = text !== '' && field.choices.indexOf(text) < 0;
            return (
                <div key={field.key} {...rowProps}>
                    {label}
                    <select id={id} className="mapstudio-input mapstudio-field-prop" value={text} disabled={paused} aria-required={field.required}
                            onChange={(ev) => this.chooseField(field, ev.target.value === '' ? null : ev.target.value)}>
                        <option value="">Not set</option>
                        {odd ? <option value={text}>{text} (not one of the choices)</option> : null}
                        {field.choices.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            );
        }
        const hintId = id + '-problem';
        return (
            <div key={field.key} {...rowProps}>
                {label}
                <input id={id} className="mapstudio-input mapstudio-field-prop" type="text" value={text} disabled={paused}
                       inputMode={field.type === 'integer' ? 'numeric' : field.type === 'number' ? 'decimal' : undefined}
                       aria-required={field.required} aria-invalid={problem !== ''} aria-describedby={problem !== '' ? hintId : undefined}
                       onChange={this.onFieldText(field.key)} onBlur={this.commitField(field)} onKeyDown={this.onFieldKey(field)} />
                {problem !== '' ? <span id={hintId} className="mapstudio-field-hint mapstudio-field-problem" aria-live="polite">{problem}</span> : null}
            </div>
        );
    }

    /** An unknown kind's stored values, read only (entry 6): kept as they are until the kind is changed. */
    private renderStored(): React.ReactNode {
        const properties = this.props.item.properties;
        return Object.keys(properties).filter((key) => !isUnset(properties[key])).map((key) => (
            <div key={key} className="mapstudio-field mapstudio-field--stored" data-field={key}>
                <span className="mapstudio-field-label">{key}</span>
                <span className="mapstudio-field-text mapstudio-field-stored">{fieldText(properties[key])}</span>
            </div>
        ));
    }

    render(): React.ReactElement {
        const { item, kind, kinds, assets, assetNames, assetStatus, pending, paused } = this.props;
        const point = item.geometry.type === 'Point';
        const known = kind !== undefined;
        // "Unknown kind" only while the kind list is in use; while it loads, is not configured or failed with none kept, its
        // status message says why the kind is not found (entry 6's review).
        const listKnown = kindListKnown(this.props.kindStatus);
        const kindHint = known ? '' : listKnown ? unknownKindText(item.kind) : kindListNote(this.props.kindStatus);
        const kindLabel = kind ? kind.name : listKnown ? UNKNOWN_KIND : item.kind;
        // Only Kind takes input while the kind is not in the kind list: the Gateway refuses any other change to the item.
        const frozen = paused || !known;
        const assetId = item.assetId;
        const vanished = assetVanished(assetId, assetNames, assetStatus);
        const listed = assetId !== null ? assetNames.find((a) => a.id === assetId) : undefined;
        const linkWords = assetId === null || vanished ? 'not linked' : 'linked to ' + (listed ? listed.name : assetId);
        const subline = kindLabel + ' - ' + linkWords;
        const remove = deleteButton(paused, pending, this.props.toolInHand, this.props.delKey);
        const latProblem = this.state.lat !== '' && readCoordinate(this.state.lat, 90) === null;
        const lngProblem = this.state.lng !== '' && readCoordinate(this.state.lng, 180) === null;
        // The place line (entry 27): the typed pair once both read as numbers, else the saved point. A pair that looks swapped says so
        // there and the hint keeps its instruction; any other pair out of range is flagged by the hint, as before, with no place line.
        const typedLat = readsAsNumber(this.state.lat);
        const typedLng = readsAsNumber(this.state.lng);
        const geometry = item.geometry;
        const place = geometry.type === 'Point'
            ? typedLat !== null && typedLng !== null
                ? placeLine(this.props.places.status(), typedLat, typedLng)
                : placeLine(this.props.places.status(), geometry.coordinates[1], geometry.coordinates[0])
            : null;
        const swapped = place !== null && place.state === 'swapped';
        const placeId = 'mapstudio-place-' + item.id;
        const missing = missingText(missingRequired(kind, item.properties));
        const twin = twinText(nameTwins(this.state.name, item, this.props.items, this.props.assetRows));
        const twinId = 'mapstudio-twin-' + item.id;
        const assetNote = assetListNote(assetStatus);
        const kindWords = kind ? kind.name.toLowerCase() : item.kind;
        // Entry 9: an instrument on a line moves along it only (its distance typed, or dragged); its latitude and longitude read only.
        const onLine = point && item.attachment !== null ? this.props.onLine : undefined;
        const distanceId = 'mapstudio-distance-' + item.id;
        return (
            <section className="mapstudio-panel" aria-label={item.name} data-item-id={item.id} data-pending={pending ? 'true' : 'false'}
                     data-paused={paused ? 'true' : 'false'} data-kind-known={known ? 'true' : 'false'}
                     data-kind-list={listKnown ? 'known' : 'unknown'} data-missing={missing}>
                <header className="mapstudio-panel-header">
                    <span className="mapstudio-popup-disc">
                        {kind && kind.icon !== '' ? <Glyph id={kind.icon} className="mapstudio-popup-glyph" size={18} /> : null}
                    </span>
                    <div className="mapstudio-popup-title">
                        <div className="mapstudio-popup-name mapstudio-panel-name">{item.name}</div>
                        <div className="mapstudio-popup-subline mapstudio-panel-subline">{subline}</div>
                    </div>
                    <button type="button" className="mapstudio-popup-icon mapstudio-panel-close" aria-label="Close" title="Close (Esc)"
                            aria-keyshortcuts="Escape" onClick={this.props.onClose}>
                        <ChromeGlyph name="close" className="mapstudio-popup-chrome" />
                    </button>
                </header>
                {this.renderTabs()}
                <div className="mapstudio-panel-body" role="tabpanel" id={this.tabId('details', 'panel')} aria-labelledby={this.tabId('details', 'tab')}
                     hidden={this.tabNow() !== 'details'}>
                    {paused ? <div className="mapstudio-panel-note" role="status">Paused - the map store is unreachable</div>
                        : pending ? <div className="mapstudio-panel-note" role="status">Saving the new item... a field you finish now saves right after it.</div> : null}
                    {missing !== '' ? <div className="mapstudio-panel-note mapstudio-panel-missing" role="status">{missing}</div> : null}
                    <label className="mapstudio-field">
                        <span className="mapstudio-field-label">Name</span>
                        <input ref={this.setNameInput} className={'mapstudio-input mapstudio-field-name' + (twin !== '' ? ' mapstudio-field-name--twin' : '')}
                               type="text" value={this.state.name} disabled={frozen} title={twin !== '' ? twin : undefined}
                               aria-describedby={twin !== '' ? twinId : undefined} data-twin={twin}
                               onChange={(ev) => this.setState({ name: ev.target.value })} onBlur={this.commitName} onKeyDown={this.onKey('name')} />
                    </label>
                    {/* Outside the label, so the words describe Name and are not part of its name. */}
                    {twin !== '' ? <span id={twinId} className="mapstudio-visually-hidden">{twin}</span> : null}
                    <div className="mapstudio-field mapstudio-field--kind">
                        <label className="mapstudio-field-label" htmlFor={'mapstudio-kind-' + item.id}>Kind</label>
                        <select id={'mapstudio-kind-' + item.id} className="mapstudio-input mapstudio-field-kind" value={item.kind} disabled={paused}
                                aria-describedby={kindHint !== '' ? 'mapstudio-kind-hint-' + item.id : undefined} onChange={this.onKindChange}>
                            {!known || !kinds.some((k) => k.id === item.kind) ? <option value={item.kind}>{kindLabel}</option> : null}
                            {kinds.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                        </select>
                        {kindHint !== '' ? (
                            <span id={'mapstudio-kind-hint-' + item.id} className="mapstudio-field-hint mapstudio-field-kind-hint">{kindHint}</span>
                        ) : null}
                    </div>
                    <div className="mapstudio-field mapstudio-field--location" data-place={place ? place.state : ''}>
                        <div className="mapstudio-field-label-row">
                            <span className="mapstudio-field-label">Location</span>
                            {point ? (
                                <span className="mapstudio-field-actions">
                                    {/* Zoom to location moves the map only, so it stays on while the fields are paused or frozen. */}
                                    <button type="button" className="mapstudio-button mapstudio-field-zoom" title={ZOOM_TO_TITLE}
                                            onClick={this.props.onZoomTo}>{ZOOM_TO_TEXT}</button>
                                    {this.props.canMoveByClick ? (
                                        <button type="button" className="mapstudio-button mapstudio-field-move" aria-pressed={this.props.moving} disabled={frozen}
                                                title={this.props.moving ? 'Move waits for a click on the map; press again or Esc to cancel'
                                                    : 'Move: click the new place on the map'} aria-keyshortcuts={this.props.moving ? 'Escape' : undefined}
                                                onClick={this.props.onMoveStart}>Move</button>
                                    ) : null}
                                </span>
                            ) : null}
                        </div>
                        {onLine && item.attachment ? (
                            <>
                                <span className="mapstudio-field-text mapstudio-field-on-line">{instrumentLocationText(onLine.name, item.attachment.distanceM)}</span>
                                <label className="mapstudio-field-distance-row" htmlFor={distanceId}>
                                    <span className="mapstudio-field-sublabel">Distance along the line (m)</span>
                                </label>
                                <div className="mapstudio-field-pair mapstudio-field-pair--distance">
                                    <input id={distanceId} className="mapstudio-input mapstudio-field-distance" type="text" inputMode="decimal"
                                           value={this.state.distance} disabled={frozen} aria-invalid={this.state.distanceProblem !== ''}
                                           aria-describedby={this.state.distanceProblem !== '' ? distanceId + '-problem' : undefined}
                                           onChange={(ev) => this.setState({ distance: ev.target.value })}
                                           onBlur={this.commitDistance} onKeyDown={this.onKey('distance')} />
                                    <span className="mapstudio-field-text mapstudio-field-length">of {metresText(onLine.lengthM)}</span>
                                </div>
                                {this.state.distanceProblem !== '' ? (
                                    <span id={distanceId + '-problem'} className="mapstudio-field-hint mapstudio-field-problem mapstudio-field-distance-problem"
                                          aria-live="polite">{this.state.distanceProblem}</span>
                                ) : null}
                            </>
                        ) : null}
                        {point ? (
                            <div className="mapstudio-field-pair">
                                <label className="mapstudio-field-half">
                                    <span className="mapstudio-field-sublabel">Latitude</span>
                                    <input className="mapstudio-input mapstudio-field-lat" type="number" step="any" inputMode="decimal" value={this.state.lat}
                                           disabled={frozen} readOnly={item.attachment !== null} aria-invalid={latProblem} aria-describedby={place && place.text !== '' ? placeId : undefined}
                                           onChange={(ev) => this.setState({ lat: ev.target.value })}
                                           onBlur={this.commitLocation('lat')} onKeyDown={this.onKey('lat')} />
                                </label>
                                <label className="mapstudio-field-half">
                                    <span className="mapstudio-field-sublabel">Longitude</span>
                                    <input className="mapstudio-input mapstudio-field-lng" type="number" step="any" inputMode="decimal" value={this.state.lng}
                                           disabled={frozen} readOnly={item.attachment !== null} aria-invalid={lngProblem} aria-describedby={place && place.text !== '' ? placeId : undefined}
                                           onChange={(ev) => this.setState({ lng: ev.target.value })}
                                           onBlur={this.commitLocation('lng')} onKeyDown={this.onKey('lng')} />
                                </label>
                            </div>
                        ) : (
                            <span className="mapstudio-field-text">A line of {item.geometry.coordinates.length} points</span>
                        )}
                        <span className="mapstudio-field-hint">
                            {(latProblem || lngProblem) && !swapped
                                ? 'Latitude is -90 to 90 and longitude -180 to 180.'
                                : onLine ? 'Drag it along the line, or type its distance.'
                                    : point && item.attachment !== null ? 'It moves along its line, which is not on the map.'
                                    : point ? 'Drag the pin to fine-tune, or type latitude and longitude.' : ''}
                        </span>
                        {place && place.text !== '' ? (
                            <span id={placeId} className="mapstudio-field-place" data-place={place.state} title={PLACE_CREDIT}>{place.text}</span>
                        ) : null}
                    </div>
                    {this.renderInstruments(frozen)}
                    {kind ? kind.fields.map((field, i) => this.renderField(field, i)) : this.renderStored()}
                    <div className="mapstudio-field mapstudio-field--asset" data-vanished={vanished ? 'true' : 'false'}>
                        <label className="mapstudio-field-label" htmlFor={'mapstudio-asset-' + item.id}>Asset</label>
                        <div className="mapstudio-field-pair">
                            <select id={'mapstudio-asset-' + item.id} className="mapstudio-input mapstudio-field-asset" value={assetId === null ? '' : assetId}
                                    disabled={frozen} onChange={this.onAssetChange}>
                                <option value="">Not linked</option>
                                {assetId !== null && !assets.some((a) => a.id === assetId)
                                    ? <option value={assetId}>{listed && !vanished ? listed.name : assetId + ' (not in the asset list)'}</option> : null}
                                {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                            {assetId !== null ? (
                                <button type="button" className="mapstudio-button mapstudio-field-unlink" disabled={frozen} onClick={this.onUnlink}>Unlink</button>
                            ) : null}
                        </div>
                        <span className="mapstudio-field-hint mapstudio-field-asset-hint">
                            {vanished && assetId !== null
                                ? vanishedText(assetId)
                                : assetId === null
                                    ? (assets.length === 0 ? 'No ' + kindWords + ' assets in the asset list.' : 'Not linked. Pick an asset to show live values.')
                                    : 'Live values come from the linked asset\'s tags.'}
                        </span>
                        {assetNote !== '' ? (
                            <span className="mapstudio-field-asset-status" role="status" data-status={assetStatus ? assetStatus.status : ''}>{assetNote}</span>
                        ) : null}
                    </div>
                    {this.renderLiveNow(frozen)}
                </div>
                {/* Mounted while the item's panel is, hidden while Details is chosen: a rule being built is kept until the item is left. */}
                <div className="mapstudio-style" role="tabpanel" id={this.tabId('style', 'panel')} aria-labelledby={this.tabId('style', 'tab')}
                     hidden={this.tabNow() !== 'style'} ref={(el) => { this.styleEl = el; }} onKeyDown={this.onStyleKey}
                     data-own={this.props.style && this.props.style.ownRule !== null ? 'true' : 'false'}>
                    {paused ? <div className="mapstudio-panel-note" role="status">Paused - the map store is unreachable</div> : null}
                    {this.renderStyle(frozen)}
                </div>
                <footer className="mapstudio-panel-footer">
                    <button type="button" className="mapstudio-dock-button mapstudio-panel-delete" disabled={remove.off !== ''} title={remove.title}
                            aria-label={'Delete ' + item.name} aria-keyshortcuts={remove.key ? 'Delete' : undefined}
                            data-off={remove.off} onClick={this.props.onDelete}>
                        <ChromeGlyph name="trash" />
                    </button>
                </footer>
            </section>
        );
    }
}
