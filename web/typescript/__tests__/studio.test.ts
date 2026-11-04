import {
    StudioState, clearSelection, enterEdit, fromProps, isDrawing, isEditing, leaveEdit, pickTool, select, selectedId, toggleSelect
} from '../studio';

describe('fromProps', () => {
    it('reads the editMode prop once into the mode, with no tool and nothing selected', () => {
        expect(fromProps(false)).toEqual({ mode: 'view', tool: null, selected: [] });
        expect(fromProps(true)).toEqual({ mode: 'edit', tool: null, selected: [] });
    });

    it('derives today\'s editing, drawing and selection from the model at mount', () => {
        expect(isEditing(fromProps(false))).toBe(false);
        expect(isEditing(fromProps(true))).toBe(true);
        expect(isDrawing(fromProps(true))).toBe(false);
        expect(selectedId(fromProps(true))).toBeNull();
    });
});

describe('enterEdit and leaveEdit', () => {
    it('enters Edit mode keeping the selection and no tool', () => {
        const view = select(fromProps(false), 'a');
        const edit = enterEdit(view);
        expect(edit).toEqual({ mode: 'edit', tool: null, selected: ['a'] });
        expect(isEditing(edit)).toBe(true);
    });

    it('leaves Edit mode putting the tool down and keeping the selection', () => {
        const drawing = pickTool(select(fromProps(true), 'a'), 'line');
        const view = leaveEdit(drawing);
        expect(view).toEqual({ mode: 'view', tool: null, selected: ['a'] });
        expect(isDrawing(view)).toBe(false);
    });

    it('returns the same state when nothing changes', () => {
        const edit = fromProps(true);
        expect(enterEdit(edit)).toBe(edit);
        const view = fromProps(false);
        expect(leaveEdit(view)).toBe(view);
    });
});

describe('pickTool', () => {
    it('picks the line tool up and puts it down in Edit mode, as the Draw a line toggle does', () => {
        const edit = fromProps(true);
        const on = pickTool(edit, 'line');
        expect(on.tool).toBe('line');
        expect(isDrawing(on)).toBe(true);
        const off = pickTool(on, null);
        expect(off.tool).toBeNull();
        expect(isDrawing(off)).toBe(false);
    });

    it('never holds a tool in View mode, which shows none', () => {
        const view = fromProps(false);
        expect(pickTool(view, 'line')).toBe(view);
        expect(isDrawing(pickTool(view, 'line'))).toBe(false);
    });

    it('returns the same state for the tool already in hand', () => {
        const on = pickTool(fromProps(true), 'line');
        expect(pickTool(on, 'line')).toBe(on);
    });

    it('keeps the selection while a tool is picked', () => {
        const state = pickTool(select(fromProps(true), 'a'), 'line');
        expect(state.selected).toEqual(['a']);
    });
});

describe('select, toggleSelect and clearSelection', () => {
    it('select replaces the selection with the one item, as a click on the map does', () => {
        let state: StudioState = fromProps(false);
        state = select(state, 'a');
        expect(state.selected).toEqual(['a']);
        expect(selectedId(state)).toBe('a');
        state = select(state, 'b');
        expect(state.selected).toEqual(['b']);
        expect(selectedId(state)).toBe('b');
    });

    it('select returns the same state for the item already selected alone', () => {
        const one = select(fromProps(false), 'a');
        expect(select(one, 'a')).toBe(one);
    });

    it('toggleSelect adds an item and removes one that is in the selection', () => {
        let state = select(fromProps(true), 'a');
        state = toggleSelect(state, 'b');
        expect(state.selected).toEqual(['a', 'b']);
        state = toggleSelect(state, 'a');
        expect(state.selected).toEqual(['b']);
        state = toggleSelect(state, 'b');
        expect(state.selected).toEqual([]);
        expect(selectedId(state)).toBeNull();
    });

    it('clearSelection empties the selection, as a tap on the ground does, and keeps the mode and tool', () => {
        const state = clearSelection(pickTool(select(fromProps(true), 'a'), 'line'));
        expect(state).toEqual({ mode: 'edit', tool: 'line', selected: [] });
        const empty = fromProps(false);
        expect(clearSelection(empty)).toBe(empty);
    });

    it('works the same in View mode (the selection is not a tool)', () => {
        const state = toggleSelect(select(fromProps(false), 'a'), 'b');
        expect(state).toEqual({ mode: 'view', tool: null, selected: ['a', 'b'] });
    });

    it('never mutates the state it is given', () => {
        const before = select(fromProps(true), 'a');
        const copy = { ...before, selected: before.selected.slice() };
        toggleSelect(before, 'b');
        clearSelection(before);
        pickTool(before, 'line');
        leaveEdit(before);
        expect(before).toEqual(copy);
    });
});
