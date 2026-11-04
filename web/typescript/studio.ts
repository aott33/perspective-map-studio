/**
 * The studio's mode and selection model (epic 4 entry 1): View or Edit, the tool in hand and the
 * selected map items, as one pure state the component holds and the studio's surfaces (the rail,
 * the item list, the properties panel, the Kinds screen, the Recent changes dock; epic-editing) will
 * read. Pure functions only, unit tested in node. The component keeps it in lock-step with what it
 * draws from today: the mode is read from the `editMode` prop once at mount (`fromProps`; entry 14
 * makes it bidirectional later) and decides the echo line and the Draw a line control; the tool is
 * the line tool while Terra Draw's line mode is on (`drawing` in draw.ts); the selection holds the
 * id of the selected point or line (`selected` in features.ts keeps its kind and segment).
 */

export type StudioMode = 'view' | 'edit';

/** The tools the studio knows: the spike's line tool today; epic-editing adds the rest. */
export type StudioTool = 'line';

export interface StudioState {
    /** View mode shows the map and its controls; Edit mode adds the studio's surfaces and tools. */
    mode: StudioMode;
    /** The tool in hand, or null; never set in View mode, which has no tool. */
    tool: StudioTool | null;
    /** The selected map items' ids, in the order selected; one at most today. */
    selected: string[];
}

/** The model at mount: the mode the `editMode` prop names, no tool, nothing selected. */
export function fromProps(editMode: boolean): StudioState {
    return { mode: editMode ? 'edit' : 'view', tool: null, selected: [] };
}

/** Edit mode entered: the selection stays, no tool is in hand yet. */
export function enterEdit(state: StudioState): StudioState {
    if (state.mode === 'edit') {
        return state;
    }
    return { ...state, mode: 'edit' };
}

/** View mode: the tool is put down (View mode has none), the selection stays. */
export function leaveEdit(state: StudioState): StudioState {
    if (state.mode === 'view' && state.tool === null) {
        return state;
    }
    return { ...state, mode: 'view', tool: null };
}

/** A tool picked up (or put down with null); nothing changes in View mode, which has no tool. */
export function pickTool(state: StudioState, tool: StudioTool | null): StudioState {
    if (state.mode !== 'edit' || state.tool === tool) {
        return state;
    }
    return { ...state, tool };
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

/** Today's `editing`: whether the component is in Edit mode (the echo line, the Draw a line control). */
export function isEditing(state: StudioState): boolean {
    return state.mode === 'edit';
}

/** Today's `drawing`: whether the line tool is on. */
export function isDrawing(state: StudioState): boolean {
    return state.tool === 'line';
}

/** Today's selection: the one selected item's id, or null (the component keeps its kind and segment). */
export function selectedId(state: StudioState): string | null {
    return state.selected.length > 0 ? state.selected[state.selected.length - 1] : null;
}
