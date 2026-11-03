import {
    ANCHOR_ORDER, PLACEMENT_MARGIN_PX, PLACEMENT_MIN_HEIGHT_PX, Rect, cameraPadding, cardRect, intersects, placePopup, placedMaxWidth
} from '../popupPlacement';

/** A 1440 by 900 map with the desktop's controls: the top bar (search and Needs you) and the zoom card. */
const W = 1440;
const H = 900;
const TOP_BAR: Rect = { x: 12, y: 12, w: 520, h: 40 };
const ZOOM: Rect = { x: 1384, y: 12, w: 44, h: 212 };
const OBSTACLES = [TOP_BAR, ZOOM];
const OFFSET = 22;
const CARD = { w: 320, h: 300 };
const CAP = 480;

const place = (x: number, y: number, h = CARD.h, obstacles = OBSTACLES) => placePopup({ x, y }, CARD.w, h, CAP, W, H, obstacles, OFFSET);
const rectOf = (x: number, y: number, p: ReturnType<typeof place>) => cardRect(p.anchor, { x, y }, CARD.w, Math.min(CARD.h, p.maxHeight), OFFSET);
const free: Rect = { x: PLACEMENT_MARGIN_PX, y: PLACEMENT_MARGIN_PX, w: W - 2 * PLACEMENT_MARGIN_PX, h: H - 2 * PLACEMENT_MARGIN_PX };
const insideFree = (r: Rect) => r.x >= free.x && r.y >= free.y && r.x + r.w <= free.x + free.w && r.y + r.h <= free.y + free.h;

describe('the popup card\'s placement (owner review notes item 18)', () => {
    test('MapLibre\'s geometry per anchor: the tip on a side or a corner, the offset applied the same way', () => {
        expect(ANCHOR_ORDER[0]).toBe('bottom');
        expect(cardRect('bottom', { x: 700, y: 500 }, 320, 300, 22)).toEqual({ x: 540, y: 178, w: 320, h: 300 });
        expect(cardRect('top', { x: 700, y: 500 }, 320, 300, 22)).toEqual({ x: 540, y: 522, w: 320, h: 300 });
        expect(cardRect('left', { x: 700, y: 500 }, 320, 300, 22)).toEqual({ x: 722, y: 350, w: 320, h: 300 });
        expect(cardRect('right', { x: 700, y: 500 }, 320, 300, 22)).toEqual({ x: 358, y: 350, w: 320, h: 300 });
        // A corner: 22 / sqrt(2) rounds to 16 each way.
        expect(cardRect('top-left', { x: 700, y: 500 }, 320, 300, 22)).toEqual({ x: 716, y: 516, w: 320, h: 300 });
        expect(cardRect('bottom-right', { x: 700, y: 500 }, 320, 300, 22)).toEqual({ x: 364, y: 184, w: 320, h: 300 });
        expect(intersects({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 10, w: 5, h: 5 })).toBe(false);
        expect(intersects({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 5, h: 5 })).toBe(true);
    });

    test('a point in the middle of the map takes the card above it, whole', () => {
        const p = place(700, 500);
        expect(p).toEqual({ anchor: 'bottom', maxHeight: CAP, shift: [0, 0] });
    });

    test('a point under the top bar: the card never covers the bar, it goes beside or below the point', () => {
        // Just under the bar, where a card above would cover it: beside it (left anchor, the card to the right) fits.
        const p = place(300, 120);
        const r = rectOf(300, 120, p);
        expect(p.shift).toEqual([0, 0]);
        expect(intersects(r, TOP_BAR)).toBe(false);
        expect(insideFree(r)).toBe(true);
        // Under the bar at the map's left edge: a card beside it on the right, or below it, never over the bar.
        const left = place(30, 120);
        const lr = rectOf(30, 120, left);
        expect(left.shift).toEqual([0, 0]);
        expect(intersects(lr, TOP_BAR)).toBe(false);
        expect(insideFree(lr)).toBe(true);
    });

    test('a point under the zoom card or at the map\'s right and bottom edges keeps the card inside the map and off the zoom card', () => {
        for (const [x, y] of [[1400, 300], [1420, 500], [700, 880], [1420, 880], [20, 880]]) {
            const p = place(x, y);
            const r = rectOf(x, y, p);
            expect(p.shift).toEqual([0, 0]);
            expect(insideFree(r)).toBe(true);
            expect(intersects(r, ZOOM)).toBe(false);
            expect(intersects(r, TOP_BAR)).toBe(false);
        }
    });

    test('a short map clamps the card to the room on the taller side, its body scrolling, never under the minimum', () => {
        // A 400 px tall map (a phone's /live page) with a point 250 px down: no whole card fits, the room above is larger.
        const p = placePopup({ x: 180, y: 250 }, 320, 420, 480, 390, 400, [], 22);
        expect(p.anchor).toBe('bottom');
        expect(p.maxHeight).toBe(250 - 22 - PLACEMENT_MARGIN_PX);
        expect(p.shift).toEqual([0, 0]);
        // A point right under the top edge of a short map: the card goes below, clamped to the room there.
        const below = placePopup({ x: 180, y: 60 }, 320, 420, 480, 390, 400, [], 22);
        expect(below.anchor).toBe('top');
        expect(below.maxHeight).toBe(400 - 60 - 22 - PLACEMENT_MARGIN_PX);
        expect(PLACEMENT_MIN_HEIGHT_PX).toBe(120);
    });

    test('when even the clamped card has no room the point is shifted so the card fits', () => {
        // A point 40 px from the top of a 300 px tall map, a 420 px card: below has 300 - 40 - 22 - 16 = 222 px, above less.
        const p = placePopup({ x: 180, y: 40 }, 320, 420, 480, 390, 300, [], 22);
        expect(p.anchor).toBe('top');
        expect(p.maxHeight).toBe(222);
        expect(p.shift).toEqual([0, 0]);
        // A point 20 px from the top of a 150 px tall map: 92 px below is under the 120 px minimum, so the point moves up by 28.
        const tiny = placePopup({ x: 180, y: 20 }, 320, 420, 480, 390, 150, [], 22);
        expect(tiny.anchor).toBe('top');
        expect(tiny.maxHeight).toBe(PLACEMENT_MIN_HEIGHT_PX);
        expect(tiny.shift).toEqual([0, -28]);
        // A point past the map's left edge with the card wider than the room: shifted right.
        const edge = placePopup({ x: 5, y: 20 }, 320, 420, 480, 300, 150, [], 22);
        expect(edge.shift[0]).toBeGreaterThan(0);
    });
});

describe('the card\'s width (owner review notes item 18)', () => {
    test('a card keeps its own width near an edge (it goes beside the point), and only a map narrower than the card narrows it', () => {
        // Point 1 at 1320 px on a 1440 px map: the old centred rule gave 225 px and the comms words wrapped.
        expect(placedMaxWidth(W, 320)).toBe(320);
        expect(placedMaxWidth(W, 350)).toBe(350);
        expect(placedMaxWidth(300, 320)).toBe(300 - 2 * PLACEMENT_MARGIN_PX);
        const p = place(1320, 418);
        expect(p.shift).toEqual([0, 0]);
        const r = rectOf(1320, 418, p);
        expect(r.w).toBe(320);
        expect(insideFree(r)).toBe(true);
        expect(intersects(r, ZOOM)).toBe(false);
    });
});

describe('the camera padding (owner review notes item 27)', () => {
    test('the top bar, the zoom card\'s column and the legend row, each capped at 45 % of the map', () => {
        const pad = cameraPadding(W, H, { topBar: TOP_BAR, zoomCard: ZOOM, bottomRow: { x: 12, y: 848, w: 200, h: 40 } }, null, null);
        expect(pad).toEqual({ top: 52 + 16, bottom: 52 + 16, left: 0, right: W - 1384 + 16 });
        expect(cameraPadding(W, H, { topBar: null, zoomCard: null, bottomRow: null }, null, null)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
        const huge = cameraPadding(W, H, { topBar: { x: 0, y: 0, w: 1440, h: 800 }, zoomCard: null, bottomRow: null }, null, null);
        expect(huge.top).toBe(405);
    });

    test('a phone: the zoom card across the top counts into the top, the open sheet into the bottom', () => {
        const pad = cameraPadding(390, 844, { topBar: { x: 8, y: 8, w: 374, h: 44 }, zoomCard: { x: 8, y: 60, w: 374, h: 44 }, bottomRow: null },
            { x: 8, y: 500, w: 374, h: 288 }, null);
        expect(pad).toEqual({ top: 104 + 16, bottom: 844 - 500 + 16, left: 0, right: 0 });
    });

    test('an open card on a desktop: its side and height, so a Return keeps it in view', () => {
        const controls = { topBar: TOP_BAR, zoomCard: ZOOM, bottomRow: null };
        expect(cameraPadding(W, H, controls, null, { rect: { x: 500, y: 100, w: 320, h: 300 }, anchor: 'bottom' }).top).toBe(300 + 16);
        expect(cameraPadding(W, H, controls, null, { rect: { x: 500, y: 100, w: 320, h: 300 }, anchor: 'top' }).bottom).toBe(300 + 16);
        expect(cameraPadding(W, H, controls, null, { rect: { x: 500, y: 100, w: 320, h: 300 }, anchor: 'left' }).right).toBe(320 + 16);
        expect(cameraPadding(W, H, controls, null, { rect: { x: 500, y: 100, w: 320, h: 300 }, anchor: 'right' }).left).toBe(320 + 16);
    });
});
