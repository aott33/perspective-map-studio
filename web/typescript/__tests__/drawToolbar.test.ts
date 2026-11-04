import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Kind } from '../adapters';
import { startDrawing, withVertices } from '../drawing';
import { DrawToolbar } from '../studio/DrawToolbar';
import { DrawingBar } from '../studio/DrawingBar';
import { Toast } from '../studio/Toast';

const KINDS: Kind[] = [
    { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] },
    { id: 'line', name: 'Gathering line', geometry: 'line', icon: 'pipeline', labelRank: 5, fields: [] },
    { id: 'geofence', name: 'Geofence', geometry: 'line', icon: 'geofence', labelRank: 0, fields: [], area: true },
    { id: 'tap', name: 'Tap', geometry: 'point', icon: 'tap', labelRank: 2, fields: [], instrument: true }
];

const noop = (): void => undefined;

function toolbar(tool: 'point' | 'line' | 'area' | null, toolKind: string | null, snap = false, paused = false): string {
    return renderToStaticMarkup(React.createElement(DrawToolbar, {
        tool, toolKind, kinds: KINDS, snap, pill: 'Select', paused, onSelect: noop, onTool: noop, onSnap: noop
    }));
}

describe('the draw toolbar (epic 4 entry 4)', () => {
    test('Select, the kind list\'s first three kinds as buttons, Point, Line, Area and Snap off', () => {
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
        expect(html).toContain('Snap off');
        expect(html).toContain('data-tool="select"');
    });

    test('the active tool is the kind button that fixed the kind, or the generic tool, in the selection token', () => {
        const fixed = toolbar('line', 'line');
        expect(fixed).toContain('mapstudio-tool mapstudio-tool--kind mapstudio-tool--active" aria-pressed="true" title="Gathering line"');
        expect(fixed).toContain('class="mapstudio-tool mapstudio-tool--line" aria-pressed="false"');
        expect(fixed).toContain('data-tool="line" data-tool-kind="line"');
        const generic = toolbar('area', null, true);
        expect(generic).toContain('class="mapstudio-tool mapstudio-tool--area mapstudio-tool--active" aria-pressed="true"');
        expect(generic).not.toContain('mapstudio-tool--kind mapstudio-tool--active');
        expect(generic).toContain('data-snap="on"');
        expect(generic).toContain('Snap on');
    });

    test('paused, every button is disabled and the pill says so', () => {
        const html = toolbar(null, null, false, true);
        expect(html).toContain('mapstudio-toolbar-float--paused');
        expect((html.match(/disabled=""/g) || []).length).toBe(8);
        expect(html).toContain('Paused - the map store is unreachable');
    });
});

describe('the drawing bar (epic 4 entry 4)', () => {
    const ctb1 = { itemId: 'ctb1', name: 'CTB1', position: [-105.012, 39.7262] as [number, number] };

    test('the tool in hand with no vertex yet: where to click, the snap state and its indicator, Finish inert', () => {
        const idle = renderToStaticMarkup(React.createElement(DrawingBar, { tool: 'line', drawing: null, kind: KINDS[1], snap: false, snapHint: '', onCancel: noop, onFinish: noop }));
        expect(idle).toContain('data-tool="line" data-points="0" data-valid="false" data-reason="" data-snap="off" data-snap-target=""');
        expect(idle).toContain('New gathering line');
        expect(idle).toContain('Click the map to add the first point');
        expect(idle).not.toContain('mapstudio-drawing-hint');
        expect(idle).toContain('mapstudio-drawing-finish" disabled=""');
        const near = renderToStaticMarkup(React.createElement(DrawingBar, { tool: 'line', drawing: null, kind: KINDS[1], snap: true, snapHint: 'CTB1', onCancel: noop, onFinish: noop }));
        expect(near).toContain('data-snap="on" data-snap-target="CTB1"');
        expect(near).toContain('data-state="target">Snap to CTB1 - click to connect');
    });

    test('one vertex: the count, the floating start, what it needs, Finish inert', () => {
        const drawing = startDrawing('line', 'f', [[-104.99, 39.74]], null);
        const html = renderToStaticMarkup(React.createElement(DrawingBar, { tool: 'line', drawing, kind: KINDS[1], snap: false, snapHint: '', onCancel: noop, onFinish: noop }));
        expect(html).toContain('data-tool="line" data-points="1" data-valid="false" data-reason="A line needs two points" data-snap="off" data-snap-target="" data-snap-start="" data-snap-end=""');
        expect(html).toContain('New gathering line');
        expect(html).toContain('1 point - 0 km - start floating');
        expect(html).toContain('Snap off');
        expect(html).toContain('mapstudio-drawing-hint mapstudio-drawing-hint--problem">A line needs two points');
        expect(html).toContain('mapstudio-drawing-finish" disabled=""');
        expect(html).toContain('#ms-pipeline');
    });

    test('snapped ends, the indicator naming the target within reach, and the finish hint once it may finish', () => {
        const drawing = withVertices(startDrawing('line', 'f', [ctb1.position], ctb1), [ctb1.position, [-104.983671, 39.715476]], null, '');
        const html = renderToStaticMarkup(React.createElement(DrawingBar, { tool: 'line', drawing, kind: KINDS[1], snap: true, snapHint: 'SWD1', onCancel: noop, onFinish: noop }));
        expect(html).toContain('data-points="2" data-valid="true" data-reason="" data-snap="on" data-snap-target="SWD1" data-snap-start="CTB1" data-snap-end=""');
        expect(html).toContain('2 points - 2.7 km - start snapped to CTB1 - end floating');
        expect(html).toContain('mapstudio-drawing-snap mapstudio-drawing-snap--target" data-state="target">Snap to SWD1 - click to connect');
        expect(html).toContain('Double-click or Enter to finish');
        expect(html).not.toContain('mapstudio-drawing-finish" disabled');
    });

    test('an area: the close hint and no ends', () => {
        const drawing = withVertices(startDrawing('area', 'g', [[-104.99, 39.74]], null), [[-104.99, 39.74], [-104.98, 39.745], [-104.97, 39.74]], null, '');
        const html = renderToStaticMarkup(React.createElement(DrawingBar, { tool: 'area', drawing, kind: KINDS[2], snap: false, snapHint: '', onCancel: noop, onFinish: noop }));
        expect(html).toContain('data-tool="area" data-points="3" data-valid="true"');
        expect(html).toContain('New geofence');
        expect(html).toContain('Double-click or Enter to close');
        expect(html).not.toContain('start floating');
    });
});

describe('the toast (epic 4 entry 4)', () => {
    test('a check, the message and Undo naming the step', () => {
        const html = renderToStaticMarkup(React.createElement(Toast, { message: 'Gathering line added and saved', undoLabel: 'Undo: add Gathering line', onUndo: noop, onClose: noop }));
        expect(html).toContain('class="mapstudio-toast" role="status" data-message="Gathering line added and saved"');
        expect(html).toContain('mapstudio-toast-glyph');
        expect(html).toContain('Gathering line added and saved');
        expect(html).toContain('title="Undo: add Gathering line" aria-label="Undo: add Gathering line">Undo</button>');
        const bare = renderToStaticMarkup(React.createElement(Toast, { message: 'Well pad added and saved', undoLabel: '', above: true, onUndo: noop, onClose: noop }));
        expect(bare).toContain('mapstudio-toast-undo" disabled=""');
        expect(bare).toContain('class="mapstudio-toast mapstudio-toast--above"');
    });
});
