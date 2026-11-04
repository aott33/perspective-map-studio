import {
    Drawing, REASON_SELF_INTERSECTS, TOAST_MS, addedText, canFinish, drawingEnds, drawnLengthM, endSnap, finishHint, isDrawingTool, minVertices,
    newItemText, problemText, progressText, reasonText, snapIndicatorText, snapToggleText, startDrawing, startSnap, withVertices
} from '../drawing';
import { SnapTarget } from '../geometry';

const CTB1: SnapTarget = { itemId: 'ctb1', name: 'CTB1', position: [-105.012, 39.7262] };
const SWD1: SnapTarget = { itemId: 'swd1', name: 'SWD1', position: [-104.983671, 39.715476] };
const A: [number, number] = [-104.99, 39.74];
const B: [number, number] = [-104.98, 39.745];
const C: [number, number] = [-104.97, 39.74];

describe('the drawing in progress (epic 4 entry 4)', () => {
    test('the first vertex starts it with the target it snapped to; the next follow, one snap per vertex', () => {
        const one = startDrawing('line', 'f1', [CTB1.position], CTB1);
        expect(one).toEqual({ tool: 'line', featureId: 'f1', vertices: [CTB1.position], snaps: [CTB1], reason: '' });
        const two = withVertices(one, [CTB1.position, B], null, '');
        expect(two.vertices).toEqual([CTB1.position, B]);
        expect(two.snaps).toEqual([CTB1, null]);
        const three = withVertices(two, [CTB1.position, B, SWD1.position], SWD1, '');
        expect(three.snaps).toEqual([CTB1, null, SWD1]);
        expect(startSnap(three)).toBe(CTB1);
        expect(endSnap(three)).toBe(SWD1);
        expect(drawingEnds(three)).toEqual({ start: { itemId: 'ctb1' }, end: { itemId: 'swd1' } });
    });

    test('Backspace drops the last vertex and its snap; the first vertex alone has no end', () => {
        const three = withVertices(withVertices(startDrawing('line', 'f', [A], null), [A, B], CTB1, ''), [A, B, C], SWD1, '');
        const two = withVertices(three, [A, B], null, '');
        expect(two.snaps).toEqual([null, CTB1]);
        const one = withVertices(two, [A], null, '');
        expect(one.snaps).toEqual([null]);
        expect(endSnap(one)).toBeNull();
        expect(drawingEnds(one)).toBeNull();
        expect(drawingEnds(withVertices(one, [A, B], null, ''))).toBeNull();
    });

    test('a pointer move changes nothing: the same drawing comes back', () => {
        const two = withVertices(startDrawing('line', 'f', [A], null), [A, B], null, '');
        expect(withVertices(two, [A, B], CTB1, '')).toBe(two);
        expect(withVertices(two, [A, B], null, REASON_SELF_INTERSECTS)).not.toBe(two);
    });

    test('an area needs three vertices, a line two, and neither finishes while the edges cross', () => {
        expect(minVertices('line')).toBe(2);
        expect(minVertices('area')).toBe(3);
        const line1 = startDrawing('line', 'f', [A], null);
        expect(canFinish(line1)).toBe(false);
        expect(problemText(line1)).toBe('A line needs two points');
        const line2 = withVertices(line1, [A, B], null, '');
        expect(canFinish(line2)).toBe(true);
        expect(problemText(line2)).toBe('');
        const area2 = withVertices(startDrawing('area', 'g', [A], null), [A, B], null, '');
        expect(canFinish(area2)).toBe(false);
        expect(problemText(area2)).toBe('An area needs three points');
        const crossing = withVertices(area2, [A, B, C, A], null, REASON_SELF_INTERSECTS);
        expect(canFinish(crossing)).toBe(false);
        expect(problemText(crossing)).toBe('The edges cross - Backspace removes the last point');
        expect(reasonText('')).toBe('');
        expect(reasonText('Something else')).toBe('Something else');
        // An area's ends are never stored: its ring has no start or end to snap.
        expect(drawingEnds(withVertices(startDrawing('area', 'g', [CTB1.position], CTB1), [CTB1.position, B, SWD1.position], SWD1, ''))).toBeNull();
    });

    test('the bar\'s words: the count, the length, the ends, the snapping state and the hints', () => {
        const one = startDrawing('line', 'f', [CTB1.position], CTB1);
        expect(progressText(one)).toBe('1 point - 0 km - start snapped to CTB1');
        const two = withVertices(one, [CTB1.position, SWD1.position], null, '');
        expect(drawnLengthM(two)).toBeGreaterThan(2500);
        expect(drawnLengthM(two)).toBeLessThan(2800);
        expect(progressText(two)).toBe('2 points - 2.7 km - start snapped to CTB1 - end floating');
        const snapped = withVertices(one, [CTB1.position, SWD1.position], SWD1, '');
        expect(progressText(snapped)).toBe('2 points - 2.7 km - start snapped to CTB1 - end snapped to SWD1');
        expect(progressText(startDrawing('line', 'f', [A], null))).toBe('1 point - 0 km - start floating');
        const area: Drawing = withVertices(startDrawing('area', 'g', [A], null), [A, B], null, '');
        expect(progressText(area)).toMatch(/^2 points - [0-9.]+ km$/);
        expect(snapIndicatorText('CTB1')).toBe('Snap to CTB1 - click to connect');
        expect(snapToggleText(false)).toBe('Snap off');
        expect(snapToggleText(true)).toBe('Snap on');
        expect(finishHint('line')).toBe('Double-click or Enter to finish');
        expect(finishHint('area')).toBe('Double-click or Enter to close');
        expect(newItemText('Gathering line')).toBe('New gathering line');
        expect(addedText('Pipeline')).toBe('Pipeline added and saved');
        expect(TOAST_MS).toBe(6000);
        expect(isDrawingTool('line')).toBe(true);
        expect(isDrawingTool('area')).toBe(true);
        expect(isDrawingTool('point')).toBe(false);
        expect(isDrawingTool(null)).toBe(false);
    });
});
