import { METRIC_UNITS } from '../geometry';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Kind } from '../adapters';
import { EditBatch } from '../contract';
import { startDrawing, withVertices } from '../drawing';
import { DrawToolbar } from '../studio/DrawToolbar';
import { DrawingBar } from '../studio/DrawingBar';
import { HistoryList } from '../studio/UndoGroup';
import { UNDO_EMPTY, UndoStack, pushStep, startUndo, undoHistory } from '../undoStack';

const KINDS: Kind[] = [
    { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] },
    { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 5, fields: [] },
    { id: 'geofence', name: 'Geofence', geometry: 'line', icon: 'geofence', labelRank: 0, fields: [], area: true },
    { id: 'tap', name: 'Tap', geometry: 'point', icon: 'tap', labelRank: 2, fields: [], instrument: true }
];

const noop = (): void => undefined;

/** When the edits below were saved, and the clock the history reads them at. */
const T0 = Date.UTC(2026, 10, 5, 14, 0, 0);
const MIN = 60_000;
const NOW = (): number => T0 + 25 * MIN;

/** Three saved edits on three items: two lines and a pad added (entry 23's matrix: "three saved edits"). */
function threeEdits(): UndoStack {
    let stack = UNDO_EMPTY;
    const adds: Array<[string, string, number]> = [['p', 'add Well pad', T0], ['l1', 'add Gathering line', T0 + 23 * MIN], ['l2', 'add Gathering line', T0 + 25 * MIN]];
    for (const [id, label, at] of adds) {
        const batch: EditBatch = { batchId: 'b-' + id, ops: [{ op: 'create', entity: 'item', id, baseVersion: 0,
            data: { kind: 'line', name: 'Gathering line', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } } }] };
        stack = pushStep(stack, { label, batch, before: [], results: [{ entity: 'item', id, version: 1 }], at });
    }
    return stack;
}

function toolbar(tool: 'point' | 'line' | 'area' | null, toolKind: string | null, snap = false, paused = false, undo: UndoStack = UNDO_EMPTY,
                 editInFlight = false): string {
    return renderToStaticMarkup(React.createElement(DrawToolbar, {
        tool, toolKind, kinds: KINDS, snap, paused, undo, editInFlight, onSelect: noop, onTool: noop, onSnap: noop, onUndo: noop, onRedo: noop,
        onUndoTo: noop, now: NOW
    }));
}

describe('the draw toolbar (epic 4 entry 4)', () => {
    test('Select, the kind list\'s first three kinds as buttons, Point, Line, Area, Snap off, then Undo, its history and Redo', () => {
        const html = toolbar(null, null);
        expect(html).toContain('class="mapstudio-tool mapstudio-tool--select mapstudio-tool--active"');
        expect(html.match(/mapstudio-tool--kind/g)).toHaveLength(3);
        expect(html).toContain('data-kind="pad" data-tool="point"');
        expect(html).toContain('data-kind="line" data-tool="line"');
        expect(html).toContain('data-kind="geofence" data-tool="area"');
        expect(html).not.toContain('data-kind="tap"');
        expect(html).toContain('aria-label="Gathering line: draw a line, click to add points"');
        expect(html).toContain('#ms-pipeline');
        expect(html).toContain('mapstudio-tool--point');
        expect(html).toContain('mapstudio-tool--line');
        expect(html).toContain('mapstudio-tool--area');
        expect(html).toContain('data-snap="off"');
        // Snap is the magnet glyph alone (entry 23): named "Snap", on or off in its title, no word on the toolbar.
        expect(html).toContain('aria-pressed="false" title="Snap off" aria-label="Snap"');
        expect(html).not.toContain('mapstudio-tool-word');
        expect(html).not.toContain('>Snap off<');
        expect(html).toContain('data-tool="select"');
        // The last group: Undo, the chevron, Redo, after a rule; no mode pill under the toolbar.
        expect(html).toMatch(/mapstudio-tool--snap[^]*mapstudio-toolbar-divider[^]*mapstudio-undo"[^]*mapstudio-undo-history-button[^]*mapstudio-redo"/);
        expect(html).not.toContain('mapstudio-pill');
    });

    test('the active tool is the kind button that fixed the kind, or the generic tool, in the selection token', () => {
        const fixed = toolbar('line', 'line');
        expect(fixed).toContain('mapstudio-tool mapstudio-tool--kind mapstudio-tool--active" aria-pressed="true" title="Gathering line"');
        expect(fixed).toContain('class="mapstudio-tool mapstudio-tool--line" aria-pressed="false"');
        expect(fixed).toContain('data-tool="line" data-tool-kind="line"');
        const generic = toolbar('area', null, true);
        expect(generic).toContain('class="mapstudio-tool mapstudio-tool--area mapstudio-tool--active" aria-pressed="true"');
        expect(generic).not.toContain('mapstudio-tool--kind mapstudio-tool--active');
        expect(generic).toContain('class="mapstudio-tool mapstudio-tool--snap mapstudio-tool--active" aria-pressed="true" '
            + 'title="Snap on: a vertex lands on the nearest item or vertex within reach" aria-label="Snap"');
        expect(generic).toContain('data-snap="on"');
    });

    test('paused, every button is disabled and the toolbar says so to assistive technology, Undo, the history and Redo on hover', () => {
        const html = toolbar(null, null, false, true, threeEdits());
        expect(html).toContain('mapstudio-toolbar-float--paused');
        expect((html.match(/disabled=""/g) || []).length).toBe(11);
        expect(html).toContain('aria-label="Drawing tools - Paused - the map store is unreachable" data-paused="true"');
        expect(html).toContain('class="mapstudio-tool mapstudio-undo" disabled="" title="Paused - the map store is unreachable" aria-label="Undo: add Gathering line"');
        expect(html).toContain('title="Paused - the map store is unreachable" aria-label="Undo history"');
        // Every button says it on hover (the faded toolbar takes the pointer for its titles), keeping its name for assistive technology.
        expect((html.match(/title="Paused - the map store is unreachable"/g) || []).length).toBe(11);
        expect(html).toContain('title="Paused - the map store is unreachable" aria-label="Point: add a point by clicking the map"');
        expect(html).toContain('title="Paused - the map store is unreachable" aria-label="Snap"');
    });
});

describe('Undo, its history and Redo on the toolbar (epic 4 entry 23)', () => {
    test('with nothing to undo or redo: disabled, saying so on hover; the history\'s chevron opens all the same', () => {
        const html = toolbar(null, null);
        expect(html).toContain('class="mapstudio-tool mapstudio-undo" disabled="" title="Nothing to undo" aria-label="Undo" data-step=""');
        expect(html).toContain('class="mapstudio-tool mapstudio-redo" disabled="" title="Nothing to redo" aria-label="Redo" data-step=""');
        expect(html).toContain('class="mapstudio-tool mapstudio-undo-history-button" title="Undo history" aria-label="Undo history" '
            + 'aria-haspopup="menu" aria-expanded="false"');
        expect(html).toContain('data-history-open="false"');
        // The list renders only once opened.
        expect(html).not.toContain('mapstudio-undo-history"');
    });

    test('three saved edits: Undo names the last step on hover and to assistive technology; Redo has none', () => {
        const html = toolbar(null, null, false, false, threeEdits());
        // Its key on hover too (entry 25: no `?` panel, each control names its shortcut), and to assistive technology.
        expect(html).toContain('class="mapstudio-tool mapstudio-undo" title="Undo: add Gathering line (Ctrl+Z)" aria-label="Undo: add Gathering line" '
            + 'data-step="Undo: add Gathering line" aria-keyshortcuts="Control+Z"');
        expect(html).toContain('class="mapstudio-tool mapstudio-redo" disabled="" title="Nothing to redo"');
    });

    test('a reverse in flight: Undo and Redo wait saying "Undoing..."; the chevron still opens the history, whose rows then take no choice', () => {
        const stack = threeEdits();
        const started = startUndo(stack, 'u1', [])!.stack;
        const html = toolbar(null, null, false, false, started);
        expect(html).toContain('class="mapstudio-tool mapstudio-undo" disabled="" title="Undoing..." aria-label="Undo" data-step=""');
        expect(html).toContain('class="mapstudio-tool mapstudio-redo" disabled="" title="Undoing..."');
        expect(html).toContain('class="mapstudio-tool mapstudio-undo-history-button" title="Undo history"');
        const list = renderToStaticMarkup(React.createElement(HistoryList, {
            id: 'h', rows: undoHistory(started), marked: 0, busy: 'Undoing...', now: NOW(), shift: 0, onChoose: noop, onHover: noop, onFocusRow: noop,
            onRowKey: noop
        }));
        expect(list).toContain('data-busy="true"');
        expect((list.match(/aria-disabled="true"/g) || []).length).toBe(3);
        expect(list).toContain('Undoing...');
    });

    test('a tool\'s or a field\'s edit being saved: Undo and Redo wait saying "Saving...", no step named until its own is on the stack', () => {
        const html = toolbar(null, null, false, false, threeEdits(), true);
        expect(html).toContain('class="mapstudio-tool mapstudio-undo" disabled="" title="Saving..." aria-label="Undo" data-step=""');
        expect(html).toContain('class="mapstudio-tool mapstudio-redo" disabled="" title="Saving..."');
    });

    test('the history: "Undo history", the steps newest first with how long ago, the marked row and every newer one tinted, the footer counting them', () => {
        const rows = undoHistory(threeEdits());
        const list = renderToStaticMarkup(React.createElement(HistoryList, {
            id: 'h', rows, marked: 1, busy: '', now: NOW(), shift: 0, onChoose: noop, onHover: noop, onFocusRow: noop, onRowKey: noop
        }));
        expect(list).toContain('class="mapstudio-undo-history" data-rows="3" data-marked="2" data-busy="false"');
        expect(list).toContain('<div class="mapstudio-undo-history-title" id="h-title">Undo history</div>');
        expect(list).toContain('role="menu" aria-labelledby="h-title"');
        const row = /history-label">([^<]*)<\/span><span class="mapstudio-undo-history-ago">([^<]*)</;
        const words = (list.match(new RegExp(row.source, 'g')) || []).map((m) => {
            const parts = row.exec(m) as RegExpExecArray;
            return parts[1] + ' | ' + parts[2];
        });
        expect(words).toEqual(['add Gathering line | just now', 'add Gathering line | 2 min ago', 'add Well pad | 25 min ago']);
        expect(list.match(/mapstudio-undo-history-row mapstudio-undo-history-row--marked/g)).toHaveLength(2);
        expect(list).toContain('data-count="3"');
        expect(list).toContain('Click to undo back to here: undoes 2 changes');
        // Moved left to stay clear of the zoom card.
        const moved = renderToStaticMarkup(React.createElement(HistoryList, {
            id: 'h', rows, marked: -1, busy: '', now: NOW(), shift: 108, onChoose: noop, onHover: noop, onFocusRow: noop, onRowKey: noop
        }));
        expect(moved).toContain('style="transform:translateX(-108px)"');
        expect(moved).toContain('Click a step to undo back to it');
        expect(moved).not.toContain('row--marked');
    });

    test('empty: "Nothing to undo", no rows and no footer', () => {
        const list = renderToStaticMarkup(React.createElement(HistoryList, {
            id: 'h', rows: [], marked: -1, busy: '', now: NOW(), shift: 0, onChoose: noop, onHover: noop, onFocusRow: noop, onRowKey: noop
        }));
        expect(list).toContain('<div class="mapstudio-undo-history-empty">Nothing to undo</div>');
        expect(list).not.toContain('role="menu"');
        expect(list).not.toContain('mapstudio-undo-history-footer');
    });
});

describe('the drawing bar (epic 4 entry 4)', () => {
    const ctb1 = { itemId: 'ctb1', name: 'CTB1', position: [-105.012, 39.7262] as [number, number] };

    test('the tool in hand with no vertex yet: where to click, the snap indicator only with a target in reach, Finish inert', () => {
        const idle = renderToStaticMarkup(React.createElement(DrawingBar, { tool: 'line', drawing: null, kind: KINDS[1], units: METRIC_UNITS, snap: false, snapHint: '', onCancel: noop, onFinish: noop, onDone: noop }));
        expect(idle).toContain('data-tool="line" data-points="0" data-valid="false" data-reason="" data-snap="off" data-snap-target=""');
        expect(idle).toContain('New gathering line');
        expect(idle).toContain('Click the map to add the first point');
        expect(idle).not.toContain('mapstudio-drawing-hint');
        expect(idle).toContain('mapstudio-drawing-finish" disabled=""');
        // No "Snap on" or "Snap off" words on the bar (entry 23): the toolbar's magnet says it.
        expect(idle).not.toContain('mapstudio-drawing-snap');
        const on = renderToStaticMarkup(React.createElement(DrawingBar, { tool: 'line', drawing: null, kind: KINDS[1], units: METRIC_UNITS, snap: true, snapHint: '', onCancel: noop, onFinish: noop, onDone: noop }));
        expect(on).toContain('data-snap="on" data-snap-target=""');
        expect(on).not.toContain('mapstudio-drawing-snap');
        expect(on).not.toContain('Snap on');
        const near = renderToStaticMarkup(React.createElement(DrawingBar, { tool: 'line', drawing: null, kind: KINDS[1], units: METRIC_UNITS, snap: true, snapHint: 'CTB1', onCancel: noop, onFinish: noop, onDone: noop }));
        expect(near).toContain('data-snap="on" data-snap-target="CTB1"');
        expect(near).toContain('data-state="target">Snap to CTB1 - click to connect');
    });

    test('the Point tool in hand (entry 23): the kind\'s glyph, "New well pad", how to place it and Done, no Cancel or Finish', () => {
        const html = renderToStaticMarkup(React.createElement(DrawingBar, { tool: 'point', drawing: null, kind: KINDS[0], units: METRIC_UNITS, snap: false, snapHint: '', onCancel: noop, onFinish: noop, onDone: noop }));
        expect(html).toContain('class="mapstudio-drawing-bar mapstudio-drawing-bar--point" role="group" aria-label="Adding a point" data-tool="point"');
        expect(html).toContain('#ms-well-pad');
        expect(html).toContain('<span class="mapstudio-drawing-title">New well pad</span>');
        expect(html).toContain('<span class="mapstudio-drawing-hint">Click the map, then drag to fine-tune</span>');
        expect(html).toContain('mapstudio-drawing-done" title="Done (Esc)" aria-keyshortcuts="Escape">Done</button>');
        expect(html).not.toContain('mapstudio-drawing-finish');
        expect(html).not.toContain('mapstudio-drawing-cancel');
        // A kind list with no point kind: the bar says so as its problem.
        const none = renderToStaticMarkup(React.createElement(DrawingBar, { tool: 'point', drawing: null, kind: null, units: METRIC_UNITS, snap: false, snapHint: '', onCancel: noop, onFinish: noop, onDone: noop }));
        expect(none).toContain('data-reason="The kind list has no point kind"');
        expect(none).toContain('New point');
        expect(none).toContain('mapstudio-drawing-hint mapstudio-drawing-hint--problem">The kind list has no point kind');
    });

    test('a line tool with no line kind: the problem in the bar and Finish inert even with two points', () => {
        const drawing = withVertices(startDrawing('line', 'f', [[-104.99, 39.74]], null), [[-104.99, 39.74], [-104.98, 39.745]], null, '');
        const html = renderToStaticMarkup(React.createElement(DrawingBar, { tool: 'line', drawing, kind: null, units: METRIC_UNITS, snap: false, snapHint: '', onCancel: noop, onFinish: noop, onDone: noop }));
        expect(html).toContain('data-valid="false" data-reason="The kind list has no line kind"');
        expect(html).toContain('New line');
        expect(html).toContain('mapstudio-drawing-finish" disabled=""');
    });

    test('one vertex: the count, the floating start, what it needs, Finish inert', () => {
        const drawing = startDrawing('line', 'f', [[-104.99, 39.74]], null);
        const html = renderToStaticMarkup(React.createElement(DrawingBar, { tool: 'line', drawing, kind: KINDS[1], units: METRIC_UNITS, snap: false, snapHint: '', onCancel: noop, onFinish: noop, onDone: noop }));
        expect(html).toContain('data-tool="line" data-points="1" data-valid="false" data-reason="A line needs two points" data-snap="off" data-snap-target="" data-snap-start="" data-snap-end=""');
        expect(html).toContain('New gathering line');
        expect(html).toContain('1 point - 0 m - start floating');
        expect(html).not.toContain('Snap off');
        expect(html).toContain('mapstudio-drawing-hint mapstudio-drawing-hint--problem">A line needs two points');
        expect(html).toContain('mapstudio-drawing-finish" disabled=""');
        expect(html).toContain('#ms-pipeline');
    });

    test('snapped ends, the indicator naming the target within reach, and the finish hint once it may finish', () => {
        const drawing = withVertices(startDrawing('line', 'f', [ctb1.position], ctb1), [ctb1.position, [-104.983671, 39.715476]], null, '');
        const html = renderToStaticMarkup(React.createElement(DrawingBar, { tool: 'line', drawing, kind: KINDS[1], units: METRIC_UNITS, snap: true, snapHint: 'SWD1', onCancel: noop, onFinish: noop, onDone: noop }));
        expect(html).toContain('data-points="2" data-valid="true" data-reason="" data-snap="on" data-snap-target="SWD1" data-snap-start="CTB1" data-snap-end=""');
        expect(html).toContain('2 points - 2.7 km - start snapped to CTB1 - end floating');
        expect(html).toContain('mapstudio-drawing-snap mapstudio-drawing-snap--target" data-state="target">Snap to SWD1 - click to connect');
        expect(html).toContain('Double-click or Enter to finish');
        expect(html).not.toContain('mapstudio-drawing-finish" disabled');
    });

    test('an area: the close hint and no ends', () => {
        const drawing = withVertices(startDrawing('area', 'g', [[-104.99, 39.74]], null), [[-104.99, 39.74], [-104.98, 39.745], [-104.97, 39.74]], null, '');
        const html = renderToStaticMarkup(React.createElement(DrawingBar, { tool: 'area', drawing, kind: KINDS[2], units: METRIC_UNITS, snap: false, snapHint: '', onCancel: noop, onFinish: noop, onDone: noop }));
        expect(html).toContain('data-tool="area" data-points="3" data-valid="true"');
        expect(html).toContain('New geofence');
        expect(html).toContain('Double-click or Enter to close');
        expect(html).not.toContain('start floating');
    });
});
