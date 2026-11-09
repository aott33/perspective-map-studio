import { Kind } from '../adapters';
import {
    CHOSEN_HINT, Drawing, MOVE_HINT, PLACE_HINT, REASON_SELF_INTERSECTS, barTitle, canFinish, deleteOffText, drawingEnds, drawnLengthM, endSnap,
    finishHint, geometryHint, geometryTitle, inField, isDrawingTool, minVertices, newItemText, noKindText, problemText, progressText, reasonText,
    snapIndicatorText, snapTitle, splitOffText, startDrawing, startSnap, withVertices, INSTRUMENT_CLICK_PX, INSTRUMENT_HINT, distanceRangeText,
    instrumentLocationText, instrumentTitle, metresText, offLineText, readDistance
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
        // Snap is the magnet glyph alone (entry 23): on or off is said in its hover title, no longer in words on the toolbar or the bar.
        expect(snapTitle(false)).toBe('Snap off');
        expect(snapTitle(true)).toBe('Snap on: a vertex lands on the nearest item or vertex within reach');
        expect(finishHint('line')).toBe('Double-click or Enter to finish');
        expect(finishHint('area')).toBe('Double-click or Enter to close');
        expect(newItemText('Gathering line')).toBe('New gathering line');
        expect(isDrawingTool('line')).toBe(true);
        expect(isDrawingTool('area')).toBe(true);
        expect(isDrawingTool('point')).toBe(false);
        expect(isDrawingTool(null)).toBe(false);
    });
});

describe('the bar names the tool in hand in words, for every tool (entry 23: the mode pill\'s words move here)', () => {
    const PAD: Kind = { id: 'pad', name: 'Well pad', geometry: 'point', icon: 'well-pad', labelRank: 10, fields: [] };
    const INLET: Kind = { id: 'inlet', name: 'Inlet', geometry: 'point', icon: 'inlet', labelRank: 1, fields: [] };
    const PIPE: Kind = { id: 'pipeline', name: 'Pipeline', geometry: 'line', icon: 'pipeline', labelRank: 5, fields: [] };
    const FENCE: Kind = { id: 'geofence', name: 'Geofence', geometry: 'line', icon: 'geofence', labelRank: 0, fields: [], area: true };

    test('the kind it adds after New, or the tool when the kind list has none for it, and that as the problem', () => {
        expect(barTitle('point', PAD)).toBe('New well pad');
        expect(barTitle('point', INLET)).toBe('New inlet');
        expect(barTitle('line', PIPE)).toBe('New pipeline');
        expect(barTitle('area', FENCE)).toBe('New geofence');
        expect(barTitle('point', null)).toBe('New point');
        expect(barTitle('line', null)).toBe('New line');
        expect(barTitle('area', null)).toBe('New area');
        expect(noKindText('point')).toBe('The kind list has no point kind');
        expect(noKindText('line')).toBe('The kind list has no line kind');
        expect(noKindText('area')).toBe('The kind list has no area kind');
    });

    test('the Point tool\'s hint, as UJ-1 step 2 reads it', () => {
        expect(PLACE_HINT).toBe('Click the map, then drag to fine-tune');
    });
});

describe('a key typed in a field stays the field\'s (inField)', () => {
    /** A key's target as the browser gives it: an element's tag name and whether it is editable. */
    const target = (tagName: string, isContentEditable = false): EventTarget => ({ tagName, isContentEditable }) as unknown as EventTarget;

    test('an input, a textarea, a select and an editable element are fields, whatever the tag\'s case', () => {
        expect(inField(target('INPUT'))).toBe(true);
        expect(inField(target('input'))).toBe(true);
        expect(inField(target('TEXTAREA'))).toBe(true);
        expect(inField(target('SELECT'))).toBe(true);
        expect(inField(target('DIV', true))).toBe(true);
    });

    test('a checkbox or a button input is not a field (a ticked list row, entry 8); a text input is', () => {
        const input = (type: string): EventTarget => ({ tagName: 'INPUT', type }) as unknown as EventTarget;
        expect(inField(input('checkbox'))).toBe(false);
        expect(inField(input('button'))).toBe(false);
        expect(inField(input('text'))).toBe(true);
        expect(inField(input('number'))).toBe(true);
    });

    test('the canvas, a div and no target are not', () => {
        expect(inField(target('CANVAS'))).toBe(false);
        expect(inField(target('DIV'))).toBe(false);
        expect(inField(null)).toBe(false);
        // A target with no tag name (the window, the document) is not a field either.
        expect(inField({} as EventTarget)).toBe(false);
    });
});

describe('the chosen point\'s bar and Move\'s bar (epic 4 entry 5, the owner\'s four mocks)', () => {
    test('the title names the point, the count and the line; Move names the point or the item', () => {
        expect(geometryTitle({ itemId: 'l', index: 1, moving: false }, 'L-SWD', 3)).toBe('Point 2 of 3 on L-SWD');
        expect(geometryTitle({ itemId: 'l', index: 1, moving: true }, 'L-SWD', 3)).toBe('Moving point 2 of L-SWD');
        expect(geometryTitle({ itemId: 'p', index: null, moving: true }, 'CTB1', 1)).toBe('Moving CTB1');
    });

    test('the hints: the drag and Move while a point is chosen, where to click and Esc while Move waits', () => {
        expect(CHOSEN_HINT).toBe('Drag it to move it, or use Move');
        expect(MOVE_HINT).toBe('Click the new place on the map - Esc to cancel');
        expect(geometryHint({ itemId: 'l', index: 0, moving: false })).toBe(CHOSEN_HINT);
        expect(geometryHint({ itemId: 'l', index: 0, moving: true })).toBe(MOVE_HINT);
        // A refused action says why instead, nothing sent (an area whose edges would cross).
        expect(geometryHint({ itemId: 'a', index: 2, moving: true, problem: 'The edges would cross' })).toBe('The edges would cross');
    });

    test('Split here is off on an end point and on an area; Delete point at the floor, each saying why', () => {
        expect([0, 1, 2].map((i) => splitOffText(3, i, false))).toEqual(['A line splits at an inner point, not an end', '',
            'A line splits at an inner point, not an end']);
        expect(splitOffText(4, 1, true)).toBe('An area has no split');
        expect(deleteOffText(3, false)).toBe('');
        expect(deleteOffText(2, false)).toBe('A line keeps at least two points');
        expect(deleteOffText(3, true)).toBe('An area keeps at least three points');
        expect(deleteOffText(4, true)).toBe('');
    });
});

describe('placing an instrument from its line (entry 9): the bar\'s words and the typed distance', () => {
    it('names the kind and the line, the click and the field; refuses in words', () => {
        expect(INSTRUMENT_CLICK_PX).toBe(12);
        expect(instrumentTitle('Tap', 'L-SWD') + ' - ' + INSTRUMENT_HINT).toBe('New tap on L-SWD - click the line or type its distance');
        expect(offLineText('L-SWD')).toBe('Click on L-SWD: an instrument sits on its line');
        expect(metresText(2936.4)).toBe('2,936 m');
        expect(metresText(12)).toBe('12 m');
        expect(metresText(1234567)).toBe('1,234,567 m');
        expect(metresText(-3)).toBe('0 m');
        expect(distanceRangeText(2936.4)).toBe('Type a distance from 0 to 2,936 m');
        expect(instrumentLocationText('L-SWD', 1143)).toBe('On L-SWD at 1.1 km');
        expect(instrumentLocationText('L-SWD', 2000)).toBe('On L-SWD at 2 km');
    });

    it('reads a distance from 0 to the line\'s length, refusing anything else', () => {
        expect(readDistance('2841', 2936.4)).toEqual({ distanceM: 2841 });
        expect(readDistance(' 2,841 ', 2936.4)).toEqual({ distanceM: 2841 });
        expect(readDistance('1143.5 m', 2936.4)).toEqual({ distanceM: 1143.5 });
        expect(readDistance('0', 2936.4)).toEqual({ distanceM: 0 });
        // The length as the bar shows it places it at the end.
        expect(readDistance('2936', 2935.7)).toEqual({ distanceM: 2935.7 });
        for (const bad of ['99999', '-1', '', 'abc', '2937']) {
            expect(readDistance(bad, 2936.4)).toEqual({ problem: 'Type a distance from 0 to 2,936 m' });
        }
    });
});
