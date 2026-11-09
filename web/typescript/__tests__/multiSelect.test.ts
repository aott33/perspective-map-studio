// Selecting several on the map (epic 4 entry 8): the box's and the lasso's geometry in the map's container pixels, pure. A box or a
// lasso takes every point inside it and every line or area any part of which crosses it (the owner's pick of 2026-11-08).

import {
    DRAG_START_PX, LASSO_STEP_PX, ShapeItem, areaCrosses, boxPolygon, extendPath, itemsInShape, lineCrosses, pointInPolygon, segmentsCross
} from '../multiSelect';

describe('the shapes', () => {
    test('a box from two corners in any order, clockwise from the top left', () => {
        expect(boxPolygon([10, 20], [50, 5])).toEqual([[10, 5], [50, 5], [50, 20], [10, 20]]);
        expect(boxPolygon([50, 20], [10, 5])).toEqual([[10, 5], [50, 5], [50, 20], [10, 20]]);
    });

    test('a point in a polygon, a concave lasso included', () => {
        const box = boxPolygon([0, 0], [10, 10]);
        expect(pointInPolygon([5, 5], box)).toBe(true);
        expect(pointInPolygon([15, 5], box)).toBe(false);
        // A C shape: its mouth is outside.
        const c: Array<[number, number]> = [[0, 0], [10, 0], [10, 3], [3, 3], [3, 7], [10, 7], [10, 10], [0, 10]];
        expect(pointInPolygon([1, 5], c)).toBe(true);
        expect(pointInPolygon([6, 5], c)).toBe(false);
    });

    test('segments that cross, touch or miss', () => {
        expect(segmentsCross([0, 0], [10, 10], [0, 10], [10, 0])).toBe(true);
        expect(segmentsCross([0, 0], [5, 5], [5, 5], [10, 0])).toBe(true);
        expect(segmentsCross([0, 0], [4, 4], [6, 6], [10, 10])).toBe(false);
        expect(segmentsCross([0, 0], [10, 0], [0, 1], [10, 1])).toBe(false);
    });

    test('a line crossing the box with no vertex inside it takes it; one beside it does not', () => {
        const box = boxPolygon([10, 10], [20, 20]);
        expect(lineCrosses([[0, 15], [30, 15]], box)).toBe(true);
        expect(lineCrosses([[0, 0], [12, 12]], box)).toBe(true);
        expect(lineCrosses([[0, 0], [30, 0]], box)).toBe(false);
        expect(lineCrosses([], box)).toBe(false);
    });

    test('an area crossing the box, holding it whole, or inside it takes it; one apart does not', () => {
        const box = boxPolygon([10, 10], [20, 20]);
        expect(areaCrosses([[0, 0], [15, 0], [15, 15], [0, 15]], box)).toBe(true);
        expect(areaCrosses([[0, 0], [40, 0], [40, 40], [0, 40]], box)).toBe(true);
        expect(areaCrosses([[12, 12], [18, 12], [18, 18]], box)).toBe(true);
        expect(areaCrosses([[30, 30], [40, 30], [40, 40]], box)).toBe(false);
    });
});

describe('what a box or a lasso takes', () => {
    const items: ShapeItem[] = [
        { id: 'ctb1', type: 'point', at: [100, 100] },
        { id: 'swd1', type: 'point', at: [200, 120] },
        { id: 'p14', type: 'point', at: [400, 400] },
        { id: 'lswd', type: 'line', path: [[100, 100], [150, 300], [200, 120]] },
        { id: 'lfar', type: 'line', path: [[500, 0], [600, 50]] },
        { id: 'fence', type: 'area', ring: [[300, 90], [320, 90], [320, 110], [300, 110]] }
    ];

    test('a box over CTB1 and SWD1 takes both, and L-SWD as it crosses; nothing else', () => {
        expect(itemsInShape(items, boxPolygon([90, 90], [210, 130]))).toEqual(['ctb1', 'swd1', 'lswd']);
    });

    test('a lasso round the far pad takes it alone; one too small takes nothing', () => {
        expect(itemsInShape(items, [[380, 380], [420, 380], [420, 420], [380, 420]])).toEqual(['p14']);
        expect(itemsInShape(items, [[0, 0], [1, 1]])).toEqual([]);
    });

    test('a box crossing an area\'s edge takes the area', () => {
        expect(itemsInShape(items, boxPolygon([310, 0], [330, 95]))).toEqual(['fence']);
    });

    test('the lasso keeps a point once the pointer is far enough from the last; a press is a drag once it moved far enough', () => {
        expect(extendPath([[0, 0]], [1, 1])).toEqual([[0, 0]]);
        expect(extendPath([[0, 0]], [LASSO_STEP_PX, 0])).toEqual([[0, 0], [LASSO_STEP_PX, 0]]);
        expect(extendPath([], [5, 5])).toEqual([[5, 5]]);
        expect(DRAG_START_PX).toBeGreaterThan(3);
    });
});
