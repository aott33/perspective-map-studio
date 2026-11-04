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
 * segment). The words the toolbar's pill and the tools show are here too, so they are tested with the model.
 */

import { Kind } from './adapters';

export type StudioMode = 'view' | 'edit';

/** The tools the studio knows (entry 4): a point placed by a click, a line or an area drawn vertex by vertex. */
export type StudioTool = 'point' | 'line' | 'area';

/** The rail's surfaces (EXPERIENCE.md rail order: View, Items, Kinds, Layers; Import is epic 5's). */
export type StudioSurface = 'items' | 'kinds' | 'layers';

export interface StudioState {
    /** View mode shows the map and its controls; Edit mode adds the studio's surfaces and tools. */
    mode: StudioMode;
    /** The tool in hand, or null; never set in View mode, which has no tool. */
    tool: StudioTool | null;
    /** The kind a kind button fixed for the tool in hand (its id), or null for a generic tool (the kind picked in the form after). */
    toolKind: string | null;
    /** The rail's surface; Items when Edit mode is entered (EXPERIENCE.md Editing switch: on opens Items). */
    surface: StudioSurface;
    /** The selected map items' ids, in the order selected; one at most today. */
    selected: string[];
}

/** The model at mount: the mode the `editMode` prop names, no tool, Items, nothing selected. */
export function fromProps(editMode: boolean): StudioState {
    return { mode: editMode ? 'edit' : 'view', tool: null, toolKind: null, surface: 'items', selected: [] };
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
    if (state.mode === 'view' && state.tool === null) {
        return state;
    }
    return { ...state, mode: 'view', tool: null, toolKind: null };
}

/**
 * A tool picked up with the kind a kind button fixed (null for a generic tool), or put down with null;
 * nothing changes in View mode, which has no tool.
 */
export function pickTool(state: StudioState, tool: StudioTool | null, kindId: string | null = null): StudioState {
    const toolKind = tool === null ? null : kindId;
    if (state.mode !== 'edit' || (state.tool === tool && state.toolKind === toolKind)) {
        return state;
    }
    return { ...state, tool, toolKind };
}

/** The rail's surface switched (the map and the selection stay); nothing changes in View mode. */
export function showSurface(state: StudioState, surface: StudioSurface): StudioState {
    if (state.mode !== 'edit' || state.surface === surface) {
        return state;
    }
    return { ...state, surface };
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

/** The kinds a tool may save as, in the kind list's order: point kinds, line kinds without `area`, or area kinds. */
export function kindsFor(kinds: Kind[], tool: StudioTool): Kind[] {
    return kinds.filter((k) => toolOf(k) === tool);
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
    const fixed = kindId === null ? undefined : kinds.find((k) => k.id === kindId && toolOf(k) === tool);
    return fixed || kindsFor(kinds, tool)[0] || null;
}

/** How many kind buttons the toolbar holds (DESIGN.md Floating draw toolbar: Well pad, Tank battery, Pipeline). */
export const KIND_BUTTONS = 3;

/** The toolbar's kind buttons (entry 4): the kind list's first kinds, up to three, in the list's order and nothing else. */
export function kindButtons(kinds: Kind[]): Kind[] {
    return kinds.slice(0, KIND_BUTTONS);
}

/** A kind's name after "a" or "an", lower-cased as the pill reads it: "a well pad", "an inlet". */
export function withArticle(name: string): string {
    const lower = name.length > 0 ? name.charAt(0).toLowerCase() + name.slice(1) : name;
    const article = /^[aeiou]/i.test(lower) ? 'an' : 'a';
    return article + ' ' + lower;
}

/**
 * The mode pill's words (FR-8, EXPERIENCE.md Mode pill, UJ-1 step 2): the tool in hand named in plain
 * words with the kind it adds ("Add a well pad - click the map, then drag to fine-tune", "Draw a pipeline
 * - click to add points, Enter to finish", "Draw a geofence - click to add points, double-click to
 * close"), Select with none.
 */
export function pillText(tool: StudioTool | null, kind: Kind | null): string {
    if (tool === 'point') {
        return kind ? 'Add ' + withArticle(kind.name) + ' - click the map, then drag to fine-tune' : 'Add a point - the kind list has no point kind';
    }
    if (tool === 'line') {
        return kind ? 'Draw ' + withArticle(kind.name) + ' - click to add points, Enter to finish' : 'Draw a line - the kind list has no line kind';
    }
    if (tool === 'area') {
        return kind ? 'Draw ' + withArticle(kind.name) + ' - click to add points, double-click to close' : 'Draw an area - the kind list has no area kind';
    }
    return 'Select';
}
