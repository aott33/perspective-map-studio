/**
 * Where a popup card goes (owner review notes items 18 and 27): inside the map less the controls that
 * float over it (the top bar of search and Needs you, the zoom card, the legend row), and the camera
 * padding those controls and an open card or sheet leave, so a chosen or returned-to item is centred
 * in the area a person can see; and (epic 4 entry 26) the pans that keep an Edit-mode click's item
 * where it was on the page as Details docks, and bring it into view when the panel covers it. Pure:
 * pixels in, an anchor and a pan out; MapStudio.tsx and selection.tsx measure the DOM and move the
 * map. Unit tested in node.
 */

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** MapLibre's popup anchors: the side of the card the tip is on. */
export type PopupAnchor = 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** The anchors tried in order: above the point (the name label under the marker stays clear), beside it, below, then the corners. */
export const ANCHOR_ORDER: PopupAnchor[] = ['bottom', 'left', 'right', 'top', 'bottom-left', 'bottom-right', 'top-left', 'top-right'];

export interface PopupPlacement {
    anchor: PopupAnchor;
    /** The card's max-height in px: the cap, or the room on the chosen side when the card had to be clamped. */
    maxHeight: number;
    /** How far the point must move on screen for the card to fit, in px; [0, 0] when it fits where it is. */
    shift: [number, number];
}

/** Margin kept between a card and the map's edge or a control, in px. */
export const PLACEMENT_MARGIN_PX = 16;
/** A clamped card is never shorter than this: the header and a few rows. */
export const PLACEMENT_MIN_HEIGHT_PX = 120;

/**
 * The card's max-width for a map `width` px wide (item 18): the card's own width (`maxPx`, 320 for a
 * point, 350 for a line) when the map has room for it less a margin each side. The card is no longer
 * narrowed to stay centred on a point near an edge: `placePopup` puts it beside the point or on a corner.
 */
export function placedMaxWidth(width: number, maxPx: number): number {
    return Math.max(0, Math.min(maxPx, width - 2 * PLACEMENT_MARGIN_PX));
}

/**
 * The card's rectangle for an anchor, as MapLibre lays it out for a numeric offset: the tip `offset`
 * px from the point on a side, or `offset / sqrt(2)` each way on a corner.
 */
export function cardRect(anchor: PopupAnchor, point: { x: number; y: number }, w: number, h: number, offset: number): Rect {
    const corner = Math.round(Math.abs(offset) / Math.SQRT2);
    switch (anchor) {
        case 'bottom': return { x: point.x - w / 2, y: point.y - offset - h, w, h };
        case 'top': return { x: point.x - w / 2, y: point.y + offset, w, h };
        case 'left': return { x: point.x + offset, y: point.y - h / 2, w, h };
        case 'right': return { x: point.x - offset - w, y: point.y - h / 2, w, h };
        case 'top-left': return { x: point.x + corner, y: point.y + corner, w, h };
        case 'top-right': return { x: point.x - corner - w, y: point.y + corner, w, h };
        case 'bottom-left': return { x: point.x + corner, y: point.y - corner - h, w, h };
        default: return { x: point.x - corner - w, y: point.y - corner - h, w, h };
    }
}

export function intersects(a: Rect, b: Rect): boolean {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function inside(a: Rect, free: Rect): boolean {
    return a.x >= free.x && a.y >= free.y && a.x + a.w <= free.x + free.w && a.y + a.h <= free.y + free.h;
}

function fits(rect: Rect, free: Rect, obstacles: Rect[]): boolean {
    return inside(rect, free) && !obstacles.some((o) => intersects(rect, o));
}

/** The room above and below a point for a card `w` wide centred on it, the obstacles over that column counted. */
function roomAround(point: { x: number; y: number }, w: number, offset: number, free: Rect, obstacles: Rect[]): { above: number; below: number } {
    const column: Rect = { x: point.x - w / 2, y: free.y, w, h: free.h };
    let top = free.y;
    let bottom = free.y + free.h;
    for (const o of obstacles) {
        if (!intersects(column, o)) {
            continue;
        }
        if (o.y + o.h <= point.y) {
            top = Math.max(top, o.y + o.h);
        } else if (o.y >= point.y) {
            bottom = Math.min(bottom, o.y);
        }
    }
    return { above: Math.floor(point.y - offset - top), below: Math.floor(bottom - point.y - offset) };
}

/**
 * The placement of a card `w` by `h` px (its natural height, `cap` the tallest it may be) for a point
 * on a map `width` by `height` px with `obstacles` (the controls' rectangles in map pixels) and
 * MapLibre's tip `offset`: the first anchor in ANCHOR_ORDER whose card sits inside the map less a
 * margin and misses every obstacle; else the card clamped to the room above or below the point
 * (whichever has more), its body scrolling; and when even the clamped card does not fit, the shift
 * the point needs on screen so it does (the caller pans the map by it). Point and line cards alike.
 */
export function placePopup(point: { x: number; y: number }, w: number, h: number, cap: number, width: number, height: number,
                           obstacles: Rect[], offset: number): PopupPlacement {
    const free: Rect = { x: PLACEMENT_MARGIN_PX, y: PLACEMENT_MARGIN_PX, w: Math.max(0, width - 2 * PLACEMENT_MARGIN_PX),
        h: Math.max(0, height - 2 * PLACEMENT_MARGIN_PX) };
    const wanted = Math.min(h, cap);
    for (const anchor of ANCHOR_ORDER) {
        if (fits(cardRect(anchor, point, w, wanted, offset), free, obstacles)) {
            return { anchor, maxHeight: cap, shift: [0, 0] };
        }
    }
    // Nothing fits whole: clamp the card to the side with more room, above or below.
    const room = roomAround(point, w, offset, free, obstacles);
    const anchor: PopupAnchor = room.above >= room.below ? 'bottom' : 'top';
    const side = anchor === 'bottom' ? room.above : room.below;
    const maxHeight = Math.max(PLACEMENT_MIN_HEIGHT_PX, Math.min(cap, side));
    const rect = cardRect(anchor, point, w, Math.min(wanted, maxHeight), offset);
    // The shift the point needs: sideways to the map's free edges, and down or up when the side is too short.
    let dx = 0;
    if (rect.x < free.x) {
        dx = free.x - rect.x;
    } else if (rect.x + rect.w > free.x + free.w) {
        dx = free.x + free.w - rect.x - rect.w;
    }
    let dy = 0;
    if (side < Math.min(wanted, maxHeight)) {
        const short = Math.min(wanted, maxHeight) - side;
        dy = anchor === 'bottom' ? short : -short;
    }
    return { anchor, maxHeight, shift: [dx, dy] };
}

/** MapLibre's camera padding: the pixels on each side of the map that a centred item keeps clear of. */
export interface CameraPadding {
    top: number;
    bottom: number;
    left: number;
    right: number;
}

/**
 * The camera padding for a map `width` by `height` px (item 27): `top` the bottom of the top bar (and
 * of anything else across the top, such as the zoom card on a phone, where it sits under the bar),
 * `right` the zoom card's column on a desktop, `bottom` the open sheet's height and the legend row,
 * and an open card's own side (`card`, with its anchor) so a Return keeps it in view. Each side is
 * capped at 45 % of the map, so the visible area never closes.
 */
export function paddingFor(width: number, height: number, controls: { topBar: Rect | null; zoomCard: Rect | null; bottomRow: Rect | null },
                              sheet: Rect | null, card: { rect: Rect; anchor: PopupAnchor } | null): CameraPadding {
    const gap = PLACEMENT_MARGIN_PX;
    let top = controls.topBar ? controls.topBar.y + controls.topBar.h + gap : 0;
    let right = 0;
    if (controls.zoomCard) {
        if (controls.zoomCard.w > width / 3) {
            // A zoom card across the top (a phone's bar under the top bar): its bottom counts into the top.
            top = Math.max(top, controls.zoomCard.y + controls.zoomCard.h + gap);
        } else {
            // The desktop's column of buttons on the right.
            right = width - controls.zoomCard.x + gap;
        }
    }
    let bottom = controls.bottomRow ? height - controls.bottomRow.y + gap : 0;
    if (sheet) {
        bottom = Math.max(bottom, height - sheet.y + gap);
    }
    let left = 0;
    if (card) {
        const r = card.rect;
        if (card.anchor.startsWith('bottom')) {
            top = Math.max(top, r.h + gap);
        } else if (card.anchor.startsWith('top')) {
            bottom = Math.max(bottom, r.h + gap);
        } else if (card.anchor === 'left') {
            right = Math.max(right, r.w + gap);
        } else {
            left = Math.max(left, r.w + gap);
        }
    }
    const capY = Math.floor(height * 0.45);
    const capX = Math.floor(width * 0.45);
    return { top: Math.min(top, capY), bottom: Math.min(bottom, capY), left: Math.min(left, capX), right: Math.min(right, capX) };
}

/**
 * A place on the page (epic 4 entry 26): the map's box on the page and the place's pixel in the map, read before an Edit-mode
 * click docks Details and again once the stage has narrowed.
 */
export interface PagePlace {
    /** The map's box on the page: its left and top edges and its size, in px. */
    box: Rect;
    /** The place's pixel in the map. */
    at: { x: number; y: number };
}

/**
 * How far a place moved on the page between two readings (entry 26), as MapLibre's `panBy` takes it: the map panned by it puts
 * the place, and every other one with it, back where it was on the page. [0, 0] when it did not move.
 */
export function pageShift(before: PagePlace, after: PagePlace): [number, number] {
    return [after.box.x + after.at.x - (before.box.x + before.at.x), after.box.y + after.at.y - (before.box.y + before.at.y)];
}

/** Whether a pixel is inside a map `width` by `height` px, at least `inset` px from each of its edges. */
export function insideMap(at: { x: number; y: number }, width: number, height: number, inset: number): boolean {
    return at.x >= inset && at.x <= width - inset && at.y >= inset && at.y <= height - inset;
}

/**
 * The pan that brings a pixel into the area a person can see (entry 26; EXPERIENCE.md Responsive, 1366: opening properties
 * keeps the selection in view): the map `width` by `height` px less the camera padding and `margin` round it. [0, 0] when the
 * pixel is there already, else just enough on each axis, as MapLibre's `panBy` takes it (the map's content moves by minus it).
 * An axis with no room left once padded centres the pixel in what there is.
 */
export function intoView(at: { x: number; y: number }, width: number, height: number, padding: CameraPadding, margin: number): [number, number] {
    const axis = (v: number, lo: number, hi: number): number => (hi < lo ? v - (lo + hi) / 2 : v < lo ? v - lo : v > hi ? v - hi : 0);
    return [axis(at.x, padding.left + margin, width - padding.right - margin), axis(at.y, padding.top + margin, height - padding.bottom - margin)];
}
