/**
 * The studio's mode, tool, surface and selection model (epic 4 entries 1, 2 and 4): View or Edit, the
 * tool in hand, the rail's surface and the selected map items, as one pure state the component holds
 * and the studio's surfaces (the rail, the item list, the properties panel, the draw toolbar; later the
 * Kinds screen and the Recent changes dock) read. Pure functions only, unit tested in node. The
 * component keeps it in lock-step with what it draws from: the mode is read from the `editMode` prop
 * at mount (`fromProps`) and from entry 2 follows the Edit switch and the prop both ways at level
 * `full` (MapStudio.tsx `applyEditMode`); the tool is the Point, Line or Area tool while Terra Draw's
 * point, line or polygon mode is on (editing.ts), with the kind a kind button fixed (`toolKind`) or
 * null for a generic tool, whose kind is the first of its geometry in the kind list (entry 4); the
 * selection holds the id of the selected point or line (`selected` in features.ts keeps its kind and
 * segment). The mode pill and its words left Edit mode with entry 23 (owner, 2026-11-05): the tool in hand is named
 * by its tinted button and by the drawing bar (drawing.ts `barTitle`).
 */

import { Kind } from './adapters';

export type StudioMode = 'view' | 'edit';

/** The tools the studio knows (entry 4): a point placed by a click, a line or an area drawn vertex by vertex. */
export type StudioTool = 'point' | 'line' | 'area';

/** The rail's surfaces (EXPERIENCE.md rail order: View, Items, Kinds, Layers, History; Import is epic 5's). History is entry 11b's. */
export type StudioSurface = 'items' | 'kinds' | 'layers' | 'history';

/**
 * An instrument being placed (epic 4 entry 9; EXPERIENCE.md Instruments): Add an instrument pressed in a line's Details with the
 * kind picked; the next click on that line, or a typed distance along it, places it. Esc or Cancel puts it down. `problem` is why
 * the last click or typed distance was refused, in words, nothing saved ('' when none).
 */
export interface ArmedInstrument {
    lineId: string;
    kindId: string;
    problem: string;
}

export interface StudioState {
    /** View mode shows the map and its controls; Edit mode adds the studio's surfaces and tools. */
    mode: StudioMode;
    /** The tool in hand, or null; never set in View mode, which has no tool. */
    tool: StudioTool | null;
    /** The kind a kind button fixed for the tool in hand (its id), or null for a generic tool (the kind picked in the form after). */
    toolKind: string | null;
    /** The rail's surface; Items when Edit mode is entered (EXPERIENCE.md Editing switch: on opens Items). */
    surface: StudioSurface;
    /** The selected map items' ids, in the order each joined (entry 8: a set in Edit mode); the last to join is the current item. */
    selected: string[];
    /** An instrument being placed on the selected line (entry 9), or null; never with a tool in hand, never in View mode. */
    armed: ArmedInstrument | null;
    /**
     * The kind the Kinds surface shows (entry 12a), or null for the kind list's first; it stays while the page stays, so Kinds
     * opens again on the kind last chosen.
     */
    kind: string | null;
    /**
     * The preview item chosen per kind (entry 12a, owner decision 5), by kind id: remembered for the browser session by the
     * component, never stored on the map. A kind left out takes its first linked item by name.
     */
    previews: Record<string, string>;
}

/** The model at mount: the mode the `editMode` prop names, no tool, Items, nothing selected. */
export function fromProps(editMode: boolean): StudioState {
    return { mode: editMode ? 'edit' : 'view', tool: null, toolKind: null, surface: 'items', selected: [], armed: null, kind: null, previews: {} };
}

/** Edit mode entered: the selection stays, no tool is in hand yet, Items opens. */
export function enterEdit(state: StudioState): StudioState {
    if (state.mode === 'edit') {
        return state;
    }
    return { ...state, mode: 'edit', surface: 'items' };
}

/** View mode: the tool is put down (View mode has none), the selection stays. */
export function leaveEdit(state: StudioState): StudioState {
    if (state.mode === 'view' && state.tool === null && state.armed === null) {
        return state;
    }
    return { ...state, mode: 'view', tool: null, toolKind: null, armed: null };
}

/**
 * A tool picked up with the kind a kind button fixed (null for a generic tool), or put down with null; an instrument being placed
 * is put down either way (entry 9); nothing changes in View mode, which has no tool.
 */
export function pickTool(state: StudioState, tool: StudioTool | null, kindId: string | null = null): StudioState {
    const toolKind = tool === null ? null : kindId;
    if (state.mode !== 'edit' || (state.tool === tool && state.toolKind === toolKind && state.armed === null)) {
        return state;
    }
    return { ...state, tool, toolKind, armed: null };
}

/**
 * Add an instrument pressed in a line's Details with its kind (entry 9): the instrument is placed by the next click on the line or a
 * typed distance; the tool in hand is put down (Select's). Only in Edit mode, with the line the one item selected.
 */
export function armInstrument(state: StudioState, lineId: string, kindId: string): StudioState {
    if (state.mode !== 'edit' || state.selected.length !== 1 || state.selected[0] !== lineId) {
        return state;
    }
    return { ...state, tool: null, toolKind: null, armed: { lineId, kindId, problem: '' } };
}

/** The instrument being placed put down (Esc, Cancel, placed): nothing changes when none is. */
export function disarm(state: StudioState): StudioState {
    return state.armed === null ? state : { ...state, armed: null };
}

/** Why the last click or typed distance was refused (entry 9), said in the drawing bar; nothing changes when none is armed. */
export function armedProblem(state: StudioState, problem: string): StudioState {
    if (state.armed === null || state.armed.problem === problem) {
        return state;
    }
    return { ...state, armed: { ...state.armed, problem } };
}

/** An instrument being placed stays only while its line is the one item selected (entry 9): a new selection puts it down. */
export function keepArmed(state: StudioState): StudioState {
    const armed = state.armed;
    if (armed === null || (state.selected.length === 1 && state.selected[0] === armed.lineId)) {
        return state;
    }
    return { ...state, armed: null };
}

/** The rail's surface switched (the map and the selection stay); nothing changes in View mode. */
export function showSurface(state: StudioState, surface: StudioSurface): StudioState {
    if (state.mode !== 'edit' || state.surface === surface) {
        return state;
    }
    return { ...state, surface };
}

/** A kind chosen in the Kinds list (entry 12a): its setup shows in the properties panel's place. */
export function chooseKind(state: StudioState, kindId: string): StudioState {
    return state.kind === kindId ? state : { ...state, kind: kindId };
}

/** A kind's preview item chosen in its setup's header (entry 12a). */
export function choosePreview(state: StudioState, kindId: string, itemId: string): StudioState {
    return state.previews[kindId] === itemId ? state : { ...state, previews: { ...state.previews, [kindId]: itemId } };
}

/** One map item selected: it replaces the selection, as a click on the map does today. */
export function select(state: StudioState, id: string): StudioState {
    if (state.selected.length === 1 && state.selected[0] === id) {
        return state;
    }
    return { ...state, selected: [id] };
}

/** A map item added to the selection, or removed when it is in it (the studio's multi-select, epic-editing). */
export function toggleSelect(state: StudioState, id: string): StudioState {
    const selected = state.selected.indexOf(id) >= 0
        ? state.selected.filter((s) => s !== id)
        : state.selected.concat([id]);
    return { ...state, selected };
}

/**
 * The selection replaced by a set (epic 4 entry 8: a range, Select all in a field, a group or the filter): the ids in the order
 * given, each once; the last is the current item. The same state when the set is already that, in that order.
 */
export function selectMany(state: StudioState, ids: readonly string[]): StudioState {
    const selected = uniqueIds(ids);
    if (sameIds(selected, state.selected)) {
        return state;
    }
    return { ...state, selected };
}

/**
 * Items added to the selection (entry 8: a box or a lasso drawn on the map with the Select tool): each id not in it yet joins at
 * the end, in the order given, so the last to join is the current item; ids already in it keep their place.
 */
export function addMany(state: StudioState, ids: readonly string[]): StudioState {
    const add = uniqueIds(ids).filter((id) => state.selected.indexOf(id) < 0);
    if (add.length === 0) {
        return state;
    }
    return { ...state, selected: state.selected.concat(add) };
}

/** Whether two or more items are selected (entry 8): the properties panel shows the count, Clear and Delete, no fields. */
export function isMultiple(state: StudioState): boolean {
    return state.selected.length >= 2;
}

/**
 * The rows of a Shift-click range (entry 8; EXPERIENCE.md List row): every id from `anchor` (the last row clicked or ticked) to
 * `target` in the order shown, both ends included, from the anchor's side to the target's, so the target is the current item.
 * Only `target` when the anchor is not shown (null, filtered out, gone); empty when the target is not shown.
 */
export function rangeIds(order: readonly string[], anchor: string | null, target: string): string[] {
    const to = order.indexOf(target);
    if (to < 0) {
        return [];
    }
    const from = anchor === null ? -1 : order.indexOf(anchor);
    if (from < 0) {
        return [target];
    }
    return from <= to ? order.slice(from, to + 1) : order.slice(to, from + 1).reverse();
}

/** The ids each once, in their first order. */
function uniqueIds(ids: readonly string[]): string[] {
    const out: string[] = [];
    for (const id of ids) {
        if (out.indexOf(id) < 0) {
            out.push(id);
        }
    }
    return out;
}

/** Whether two id lists are the same, in the same order. */
export function sameIds(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((id, i) => id === b[i]);
}

/** Nothing selected (a tap on the ground). */
export function clearSelection(state: StudioState): StudioState {
    if (state.selected.length === 0) {
        return state;
    }
    return { ...state, selected: [] };
}

/** Today's `editing`: whether the component is in Edit mode (the studio's surfaces and the switch). */
export function isEditing(state: StudioState): boolean {
    return state.mode === 'edit';
}

/** Whether the Line or the Area tool is in hand (entry 4): Terra Draw's line or polygon mode draws vertex by vertex. */
export function isDrawing(state: StudioState): boolean {
    return state.tool === 'line' || state.tool === 'area';
}

/** Whether the Point tool is in hand (entry 2): a click places a point, a drag fine-tunes it. */
export function isPlacing(state: StudioState): boolean {
    return state.tool === 'point';
}

/** Today's selection: the one selected item's id, or null (the component keeps its kind and segment). */
export function selectedId(state: StudioState): string | null {
    return state.selected.length > 0 ? state.selected[state.selected.length - 1] : null;
}

/** The tool a kind is drawn with: Point for a point kind, Area for a line kind drawn closed (`area`), Line otherwise. */
export function toolOf(kind: Kind): StudioTool {
    return kind.geometry === 'point' ? 'point' : kind.area ? 'area' : 'line';
}

/**
 * The kinds a tool may save as, in the kind list's order: point kinds, line kinds without `area`, or area kinds. Instrument kinds
 * are never a tool's (entry 9): an instrument is only added from its line's Details.
 */
export function kindsFor(kinds: Kind[], tool: StudioTool): Kind[] {
    return kinds.filter((k) => toolOf(k) === tool && !k.instrument);
}

/** The instrument kinds (entry 9), in the kind list's order: what Add an instrument offers, and an instrument's Kind select. */
export function instrumentKinds(kinds: Kind[]): Kind[] {
    return kinds.filter((k) => k.geometry === 'point' && k.instrument === true);
}

/**
 * The kind the Point tool adds (entry 2; the kind buttons and the form's kind pick are entry 4's): the
 * kind list's first point kind, or null when the list has none.
 */
export function pointKind(kinds: Kind[]): Kind | null {
    return kindsFor(kinds, 'point')[0] || null;
}

/**
 * The kind a tool in hand saves as (entry 4): the kind a kind button fixed, when it is still in the list and
 * drawn with that tool, else the first kind of the tool's geometry (the kind picked in the form after); null
 * when the list has none.
 */
export function toolKind(kinds: Kind[], tool: StudioTool, kindId: string | null): Kind | null {
    const usable = kindsFor(kinds, tool);
    const fixed = kindId === null ? undefined : usable.find((k) => k.id === kindId);
    return fixed || usable[0] || null;
}

/** How many kind buttons the toolbar holds (DESIGN.md Floating draw toolbar: Well pad, Tank battery, Pipeline). */
export const KIND_BUTTONS = 3;

/**
 * The toolbar's kind buttons (entry 4): the kind list's first kinds, up to three, in the list's order and nothing else; never an
 * instrument kind (entry 9: an instrument is only added from its line's Details).
 */
export function kindButtons(kinds: Kind[]): Kind[] {
    return kinds.filter((k) => !k.instrument).slice(0, KIND_BUTTONS);
}
