// Every shortcut named on its control (epic 4 entry 25, owner 2026-11-06: no `?` panel): each studio control with a key names it in
// its hover text and to assistive technology ("Undo: add Gathering line (Ctrl+Z)", "Redo: ... (Ctrl+Shift+Z)", "Delete (Del)",
// Cancel (Esc), Finish (Enter), Done (Esc), Delete point (Del)), with `aria-keyshortcuts`; a control that is off says why.
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Kind } from '../adapters';
import { EditBatch, MapItemRecord } from '../contract';
import { startDrawing, withVertices } from '../drawing';
import { DrawToolbar } from '../studio/DrawToolbar';
import { DrawingBar } from '../studio/DrawingBar';
import { GeometryBar } from '../studio/GeometryBar';
import { DELETE_TITLE, PropertiesPanel, PropertiesPanelProps } from '../studio/PropertiesPanel';
import { PAUSED_TEXT, REDO_KEY, UNDO_KEY, withKey } from '../studio/UndoGroup';
import { UNDO_EMPTY, UndoStack, finishPending, pushStep, startUndo } from '../undoStack';

const KINDS: Kind[] = [
    { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] },
    { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 5, fields: [] }
];

const noop = (): void => undefined;

const PAD: MapItemRecord = { id: 'p1', kind: 'pad', name: 'CTB1', geometry: { type: 'Point', coordinates: [-105.012, 39.7262] }, properties: {},
    assetId: 'CTB1', overrides: {}, ends: null, attachment: null, version: 3, deleted: false };

/** Two saved adds, the newer one undone: Undo and Redo each have a step. */
function undoneOne(): UndoStack {
    let stack = UNDO_EMPTY;
    for (const [id, label] of [['a', 'add Well pad'], ['b', 'add Gathering line']]) {
        const batch: EditBatch = { batchId: 'b-' + id, ops: [{ op: 'create', entity: 'item', id, baseVersion: 0,
            data: { kind: 'line', name: 'Gathering line', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } } }] };
        stack = pushStep(stack, { label, batch, before: [], results: [{ entity: 'item', id, version: 1 }], at: 0 });
    }
    const started = startUndo(stack, 'u1', [])!;
    return finishPending(started.stack, 'u1', [{ entity: 'item', id: 'b', version: 2 }], 0);
}

function toolbar(undo: UndoStack, paused = false): string {
    return renderToStaticMarkup(React.createElement(DrawToolbar, {
        tool: null, toolKind: null, kinds: KINDS, snap: false, paused, undo, editInFlight: false, onSelect: noop, onTool: noop, onSnap: noop,
        onUndo: noop, onRedo: noop, onUndoTo: noop, now: () => 0
    }));
}

function panel(overrides: Partial<PropertiesPanelProps> = {}): string {
    return renderToStaticMarkup(React.createElement(PropertiesPanel, {
        item: PAD, kind: KINDS[0], kinds: [KINDS[0]], assets: [], assetName: null, pending: false, paused: false, autoFocusName: false,
        onNameFocused: noop, onClose: noop, onRename: noop, onMove: noop, canMoveByClick: true, moving: false, onMoveStart: noop, onLink: noop,
        onKind: noop, onDelete: noop, ...overrides
    }));
}

describe('Undo and Redo name their keys (entry 25)', () => {
    test('the words with the key: "Undo: add Well pad (Ctrl+Z)", "Redo: add Gathering line (Ctrl+Shift+Z)"; the name stays the step', () => {
        expect(withKey('Undo: add Gathering line', UNDO_KEY)).toBe('Undo: add Gathering line (Ctrl+Z)');
        expect(withKey('Redo: rename P31', REDO_KEY)).toBe('Redo: rename P31 (Ctrl+Shift+Z)');
        const html = toolbar(undoneOne());
        expect(html).toContain('class="mapstudio-tool mapstudio-undo" title="Undo: add Well pad (Ctrl+Z)" aria-label="Undo: add Well pad" '
            + 'data-step="Undo: add Well pad" aria-keyshortcuts="Control+Z"');
        expect(html).toContain('class="mapstudio-tool mapstudio-redo" title="Redo: add Gathering line (Ctrl+Shift+Z)" aria-label="Redo: add Gathering line" '
            + 'data-step="Redo: add Gathering line" aria-keyshortcuts="Control+Shift+Z Control+Y"');
    });

    test('off, they say why and keep the key for assistive technology', () => {
        const html = toolbar(UNDO_EMPTY);
        expect(html).toContain('title="Nothing to undo" aria-label="Undo" data-step="" aria-keyshortcuts="Control+Z"');
        expect(html).toContain('title="Nothing to redo" aria-label="Redo" data-step="" aria-keyshortcuts="Control+Shift+Z Control+Y"');
        expect(toolbar(undoneOne(), true)).toContain('title="' + PAUSED_TEXT + '" aria-label="Undo: add Well pad"');
    });
});

describe('the bars name their keys (entry 25)', () => {
    test('the drawing bar: Cancel (Esc), Finish (Enter) once it may finish; an off Finish says why', () => {
        const two = withVertices(startDrawing('line', 'f', [[-104.99, 39.74]], null), [[-104.99, 39.74], [-104.98, 39.745]], null, '');
        const html = renderToStaticMarkup(React.createElement(DrawingBar, { tool: 'line', drawing: two, kind: KINDS[1], snap: false, snapHint: '',
            onCancel: noop, onFinish: noop, onDone: noop }));
        expect(html).toContain('mapstudio-drawing-cancel" title="Cancel (Esc)" aria-keyshortcuts="Escape">Cancel</button>');
        expect(html).toContain('mapstudio-drawing-finish" title="Finish (Enter)" aria-keyshortcuts="Enter">Finish</button>');
        const one = renderToStaticMarkup(React.createElement(DrawingBar, { tool: 'line', drawing: startDrawing('line', 'f', [[-104.99, 39.74]], null),
            kind: KINDS[1], snap: false, snapHint: '', onCancel: noop, onFinish: noop, onDone: noop }));
        expect(one).toContain('mapstudio-drawing-finish" disabled="" title="A line needs two points" aria-keyshortcuts="Enter">Finish</button>');
        const point = renderToStaticMarkup(React.createElement(DrawingBar, { tool: 'point', drawing: null, kind: KINDS[0], snap: false, snapHint: '',
            onCancel: noop, onFinish: noop, onDone: noop }));
        expect(point).toContain('title="Done (Esc)" aria-keyshortcuts="Escape">Done</button>');
    });

    test('the geometry bar: Delete point (Del) with a point chosen, off at the floor saying why; Cancel (Esc) while Move waits', () => {
        const bar = (vertexCount: number, moving: boolean): string => renderToStaticMarkup(React.createElement(GeometryBar, {
            pick: { itemId: 'l', index: 1, moving }, name: 'L-SWD', vertexCount, area: false, busy: false, onMove: noop, onCancel: noop,
            onSplit: noop, onDelete: noop
        }));
        expect(bar(3, false)).toContain('mapstudio-geometry-delete" title="Delete point (Del)" aria-keyshortcuts="Delete">Delete point</button>');
        expect(bar(2, false)).toContain('mapstudio-geometry-delete" disabled="" title="A line keeps at least two points" aria-keyshortcuts="Delete">');
        expect(bar(3, true)).toContain('mapstudio-geometry-cancel" title="Cancel (Esc)" aria-keyshortcuts="Escape">Cancel</button>');
    });
});

describe('the properties panel\'s footer: the delete icon (entry 25; DESIGN.md Properties panel)', () => {
    test('"Delete (Del)" on hover, the item named to assistive technology, the Delete key; the close names Esc', () => {
        expect(DELETE_TITLE).toBe('Delete (Del)');
        const html = panel();
        expect(html).toContain('<footer class="mapstudio-panel-footer"><button type="button" class="mapstudio-dock-button mapstudio-panel-delete" '
            + 'title="Delete (Del)" aria-label="Delete CTB1" aria-keyshortcuts="Delete">');
        // The footer comes after the body, at the panel's foot; the trash glyph is the button's only content.
        expect(html.indexOf('mapstudio-panel-footer')).toBeGreaterThan(html.indexOf('mapstudio-panel-body'));
        expect(html).toContain('M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3');
        expect(html).toContain('title="Close (Esc)" aria-keyshortcuts="Escape"');
        // No question asked: nothing in the panel reads "Are you sure".
        expect(html).not.toMatch(/sure/i);
    });

    test('paused (the store unreachable), the delete icon takes no input and says so', () => {
        expect(panel({ paused: true })).toContain('class="mapstudio-dock-button mapstudio-panel-delete" disabled="" title="' + PAUSED_TEXT + '"');
    });
});
