import { Kind } from '../adapters';
import {
    StudioState, clearSelection, enterEdit, fromProps, isDrawing, isEditing, isPlacing, leaveEdit, pickTool, pillText, pointKind, select,
    selectedId, showSurface, toggleSelect, withArticle
} from '../studio';

describe('fromProps', () => {
    it('reads the editMode prop once into the mode, with no tool and nothing selected', () => {
        expect(fromProps(false)).toEqual({ mode: 'view', tool: null, surface: 'items', selected: [] });
        expect(fromProps(true)).toEqual({ mode: 'edit', tool: null, surface: 'items', selected: [] });
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
        expect(edit).toEqual({ mode: 'edit', tool: null, surface: 'items', selected: ['a'] });
        expect(isEditing(edit)).toBe(true);
    });

    it('leaves Edit mode putting the tool down and keeping the selection', () => {
        const drawing = pickTool(select(fromProps(true), 'a'), 'line');
        const view = leaveEdit(drawing);
        expect(view).toEqual({ mode: 'view', tool: null, surface: 'items', selected: ['a'] });
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
        expect(state).toEqual({ mode: 'edit', tool: 'line', surface: 'items', selected: [] });
        const empty = fromProps(false);
        expect(clearSelection(empty)).toBe(empty);
    });

    it('works the same in View mode (the selection is not a tool)', () => {
        const state = toggleSelect(select(fromProps(false), 'a'), 'b');
        expect(state).toEqual({ mode: 'view', tool: null, surface: 'items', selected: ['a', 'b'] });
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

const PAD: Kind = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] };
const LINE: Kind = { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 5, fields: [] };
const INLET: Kind = { id: 'inlet', name: 'Inlet', geometry: 'point', icon: 'tap', labelRank: 1, fields: [] };

describe('the point tool and the surfaces (entry 2)', () => {
    it('picks the point tool up in Edit mode and puts it down; the line tool and it are one hand', () => {
        const edit = fromProps(true);
        const placing = pickTool(edit, 'point');
        expect(isPlacing(placing)).toBe(true);
        expect(isDrawing(placing)).toBe(false);
        const drawing = pickTool(placing, 'line');
        expect(isPlacing(drawing)).toBe(false);
        expect(isDrawing(drawing)).toBe(true);
        expect(isPlacing(pickTool(drawing, null))).toBe(false);
        expect(isPlacing(leaveEdit(placing))).toBe(false);
        expect(isPlacing(pickTool(fromProps(false), 'point'))).toBe(false);
    });

    it('entering Edit mode opens Items; the rail switches the surface and keeps the selection and the tool', () => {
        const kinds = showSurface(pickTool(select(fromProps(true), 'a'), 'point'), 'kinds');
        expect(kinds).toEqual({ mode: 'edit', tool: 'point', surface: 'kinds', selected: ['a'] });
        expect(showSurface(kinds, 'kinds')).toBe(kinds);
        expect(enterEdit(leaveEdit(kinds)).surface).toBe('items');
        const view = fromProps(false);
        expect(showSurface(view, 'layers')).toBe(view);
    });

    it('the Point tool adds the kind list\'s first point kind', () => {
        expect(pointKind([LINE, PAD, INLET])).toBe(PAD);
        expect(pointKind([LINE])).toBeNull();
        expect(pointKind([])).toBeNull();
    });

    it('the pill names the mode in words, the kind after an article', () => {
        expect(withArticle('Well pad')).toBe('a well pad');
        expect(withArticle('Inlet')).toBe('an inlet');
        expect(pillText('point', PAD)).toBe('Add a well pad - click the map, then drag to fine-tune');
        expect(pillText('point', INLET)).toBe('Add an inlet - click the map, then drag to fine-tune');
        expect(pillText('point', null)).toBe('Add a point - the kind list has no point kind');
        expect(pillText('line', PAD)).toBe('Draw a line - click to add points, Enter to finish');
        expect(pillText(null, PAD)).toBe('Select');
    });
});
