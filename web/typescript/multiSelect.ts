/**
 * Selecting several on the map (epic 4 entry 8; EXPERIENCE.md Multi-select, the owner's decisions of 2026-11-06 and 2026-11-08):
 * with the Select tool (no tool in hand) in Edit mode, Shift-drag draws a box and Shift+Alt-drag a lasso, each drawn with a dashed
 * edge in the `selection` token over the `selection-tint` fill (DESIGN.md colors: "box and lasso edge"), and on release every point
 * inside it and every line or area any part of which crosses it joins the selection (the set's `addMany`). Esc during the drag
 * cancels it. MapLibre's own Shift-drag box zoom is off in Edit mode (MapStudio.tsx `applyBoxZoom`), so the drag is the box's.
 *
 * The geometry is pure and works in the map's container pixels (what `map.project` gives), unit tested in node
 * (multiSelect.test.ts): a point in a polygon, segments crossing, and the items a shape takes. The `BoxSelect` controller is
 * DOM-bound: it listens on the map's element in the capture phase, so a Shift press never reaches Terra Draw (whose pointer events
 * are on the canvas container) and MapLibre's drag pan is held off for the gesture; a Shift press that does not move is left to
 * MapLibre as a click, which the selection's map click takes as Shift-click (selection.tsx `onMapClick`).
 */

import { Map as MapLibreMap } from 'maplibre-gl';

export type Pixel = [number, number];

/** The shape a drag draws: a box (two corners) or a lasso (the path the pointer took, closed on release). */
export type DragShape = 'box' | 'lasso';

/** How far (px) the pointer moves before a Shift press is a drag, not a click (MapLibre's click tolerance is 3 px). */
export const DRAG_START_PX = 4;
/** The lasso keeps a point of the path once the pointer is this far (px) from the last one kept. */
export const LASSO_STEP_PX = 3;

/** The box's polygon from its two corners, clockwise from the top left. */
export function boxPolygon(a: Pixel, b: Pixel): Pixel[] {
    const x0 = Math.min(a[0], b[0]);
    const x1 = Math.max(a[0], b[0]);
    const y0 = Math.min(a[1], b[1]);
    const y1 = Math.max(a[1], b[1]);
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

/** Whether a pixel is inside a polygon (even-odd rule; the polygon closed implicitly). */
export function pointInPolygon(p: Pixel, polygon: readonly Pixel[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];
        if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) {
            inside = !inside;
        }
    }
    return inside;
}

function cross(o: Pixel, a: Pixel, b: Pixel): number {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function onSegment(p: Pixel, a: Pixel, b: Pixel): boolean {
    return Math.min(a[0], b[0]) <= p[0] && p[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= p[1] && p[1] <= Math.max(a[1], b[1]);
}

/** Whether two segments touch or cross. */
export function segmentsCross(a: Pixel, b: Pixel, c: Pixel, d: Pixel): boolean {
    const d1 = cross(c, d, a);
    const d2 = cross(c, d, b);
    const d3 = cross(a, b, c);
    const d4 = cross(a, b, d);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
        return true;
    }
    return (d1 === 0 && onSegment(a, c, d)) || (d2 === 0 && onSegment(b, c, d)) || (d3 === 0 && onSegment(c, a, b)) || (d4 === 0 && onSegment(d, a, b));
}

/** The closed edges of a polygon. */
function edges(polygon: readonly Pixel[]): Array<[Pixel, Pixel]> {
    return polygon.map((p, i) => [p, polygon[(i + 1) % polygon.length]] as [Pixel, Pixel]);
}

/** Whether any part of a line (its vertices in order) lies inside or crosses the polygon. */
export function lineCrosses(line: readonly Pixel[], polygon: readonly Pixel[]): boolean {
    if (polygon.length < 3 || line.length === 0) {
        return false;
    }
    if (line.some((p) => pointInPolygon(p, polygon))) {
        return true;
    }
    const sides = edges(polygon);
    for (let i = 0; i + 1 < line.length; i++) {
        if (sides.some(([c, d]) => segmentsCross(line[i], line[i + 1], c, d))) {
            return true;
        }
    }
    return false;
}

/** Whether any part of an area (its ring) meets the polygon: a vertex inside, an edge crossing, or the polygon inside the area. */
export function areaCrosses(ring: readonly Pixel[], polygon: readonly Pixel[]): boolean {
    if (ring.length < 3) {
        return lineCrosses(ring, polygon);
    }
    const closed = ring.concat([ring[0]]);
    return lineCrosses(closed, polygon) || polygon.some((p) => pointInPolygon(p, ring));
}

/** One map item as the shape test reads it: its place in container pixels. */
export type ShapeItem =
    | { id: string; type: 'point'; at: Pixel }
    | { id: string; type: 'line'; path: Pixel[] }
    | { id: string; type: 'area'; ring: Pixel[] };

/**
 * The items a box or a lasso takes (entry 8, the owner's pick: "with any part crossing"): every point inside it and every line or
 * area any part of which crosses it, in the order given (the items' order). A polygon of fewer than three points takes nothing.
 */
export function itemsInShape(items: readonly ShapeItem[], polygon: readonly Pixel[]): string[] {
    if (polygon.length < 3) {
        return [];
    }
    return items.filter((item) => item.type === 'point' ? pointInPolygon(item.at, polygon)
        : item.type === 'line' ? lineCrosses(item.path, polygon) : areaCrosses(item.ring, polygon)).map((item) => item.id);
}

/** The lasso's path with a new pointer place: kept once it is LASSO_STEP_PX from the last point kept. */
export function extendPath(path: readonly Pixel[], p: Pixel): Pixel[] {
    const last = path[path.length - 1];
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < LASSO_STEP_PX) {
        return path as Pixel[];
    }
    return path.concat([p]);
}

/** What the controller reads on the component. */
export interface BoxSelectHost {
    map: MapLibreMap | null;
    mapContainer: HTMLDivElement | null;
    /** Whether a Shift-drag selects now: the studio on, no tool in hand (the Select tool). */
    boxSelectOn(): boolean;
    /** The live items as the shape test reads them, in container pixels now. */
    shapeItems(): ShapeItem[];
    /** The ids a released box or lasso took, added to the selection (studio.ts `addMany`). */
    addToSelection(ids: string[], shape: DragShape): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * The Shift-drag box and Shift+Alt-drag lasso (entry 8). Started on a Shift press of the primary button on the map with the Select
 * tool: the press is kept from Terra Draw and MapLibre's drag pan is held off (and put back as it was on release); once the
 * pointer has moved DRAG_START_PX the shape draws in an SVG over the map (`.mapstudio-box-select`, the edge dashed in the selection
 * token over its tint; `data-box-select` on the map names the shape while it draws, for the suite); on release the items it takes
 * join the selection; Esc cancels it with nothing changed. A press that never moved is MapLibre's click.
 */
export class BoxSelect {
    private host: BoxSelectHost;
    private start: Pixel | null = null;
    private shape: DragShape = 'box';
    private path: Pixel[] = [];
    private current: Pixel | null = null;
    private dragging = false;
    private panWasOn = false;
    private pointerId = -1;
    private svg: SVGSVGElement | null = null;
    private attached: HTMLElement | null = null;

    constructor(host: BoxSelectHost) {
        this.host = host;
    }

    /** Listen on the map's element (capture phase), once it exists. */
    attach(el: HTMLElement): void {
        if (this.attached === el) {
            return;
        }
        this.detach();
        this.attached = el;
        el.addEventListener('pointerdown', this.onDown, true);
        el.addEventListener('pointermove', this.onElementMove, true);
        el.addEventListener('pointerup', this.onElementUp, true);
    }

    detach(): void {
        this.cancel();
        if (this.attached) {
            this.attached.removeEventListener('pointerdown', this.onDown, true);
            this.attached.removeEventListener('pointermove', this.onElementMove, true);
            this.attached.removeEventListener('pointerup', this.onElementUp, true);
            this.attached = null;
        }
    }

    /** Whether a gesture is under way (pressed, before its release or Esc). */
    active(): boolean {
        return this.start !== null;
    }

    private pixel(ev: PointerEvent): Pixel | null {
        const map = this.host.map;
        if (!map) {
            return null;
        }
        const r = map.getCanvasContainer().getBoundingClientRect();
        return [ev.clientX - r.left, ev.clientY - r.top];
    }

    private onDown = (ev: PointerEvent): void => {
        if (!ev.shiftKey || ev.button !== 0 || this.start !== null || !this.host.map || !this.host.boxSelectOn()) {
            return;
        }
        const target = ev.target as HTMLElement | null;
        // Only a press on the map itself: a control floating over it (the toolbar, the zoom card) keeps its own.
        if (!target || typeof target.closest !== 'function' || target.closest('.maplibregl-canvas-container') === null) {
            return;
        }
        const at = this.pixel(ev);
        if (!at) {
            return;
        }
        // Terra Draw never sees the press (no handle drag starts), and MapLibre's drag pan sits out the gesture; MapLibre still
        // gets its mouse events, so a press that does not move is its click (a Shift-click).
        ev.stopPropagation();
        const map = this.host.map;
        this.panWasOn = map.dragPan.isEnabled();
        if (this.panWasOn) {
            map.dragPan.disable();
        }
        this.start = at;
        this.current = at;
        this.path = [at];
        this.shape = ev.altKey ? 'lasso' : 'box';
        this.dragging = false;
        this.pointerId = ev.pointerId;
        window.addEventListener('pointermove', this.onMove, true);
        window.addEventListener('pointerup', this.onUp, true);
        window.addEventListener('keydown', this.onKey, true);
        // A cancelled pointer, the window losing focus or the pointer's capture lost ends the drag with nothing selected, so
        // MapLibre's drag pan never stays off.
        window.addEventListener('pointercancel', this.onLost, true);
        window.addEventListener('lostpointercapture', this.onLost, true);
        window.addEventListener('blur', this.onBlur);
    };

    private onLost = (ev: PointerEvent): void => {
        if (this.start !== null && ev.pointerId === this.pointerId) {
            console.info('[MapStudio] The ' + this.shape + ' was dropped (' + ev.type + '): nothing was selected.');
            this.end();
        }
    };

    private onBlur = (): void => {
        if (this.start !== null) {
            console.info('[MapStudio] The ' + this.shape + ' was dropped (the window lost focus): nothing was selected.');
            this.end();
        }
    };

    /** While a gesture is under way the map's element keeps its moves and its release from Terra Draw. */
    private onElementMove = (ev: PointerEvent): void => {
        if (this.start !== null && ev.pointerId === this.pointerId) {
            ev.stopPropagation();
        }
    };

    private onElementUp = (ev: PointerEvent): void => {
        if (this.start !== null && ev.pointerId === this.pointerId) {
            ev.stopPropagation();
        }
    };

    private onMove = (ev: PointerEvent): void => {
        if (this.start === null || ev.pointerId !== this.pointerId) {
            return;
        }
        const at = this.pixel(ev);
        if (!at) {
            return;
        }
        this.current = at;
        if (!this.dragging && Math.hypot(at[0] - this.start[0], at[1] - this.start[1]) >= DRAG_START_PX) {
            this.dragging = true;
            this.showShape();
        }
        if (this.dragging) {
            if (this.shape === 'lasso') {
                this.path = extendPath(this.path, at);
            }
            this.drawShape();
        }
    };

    private onUp = (ev: PointerEvent): void => {
        if (this.start === null || ev.pointerId !== this.pointerId) {
            return;
        }
        const at = this.pixel(ev);
        if (at) {
            this.current = at;
            if (this.shape === 'lasso' && this.dragging) {
                this.path = extendPath(this.path, at);
            }
        }
        const polygon = this.dragging ? this.polygon() : null;
        const shape = this.shape;
        this.end();
        if (polygon) {
            const ids = itemsInShape(this.host.shapeItems(), polygon);
            this.host.addToSelection(ids, shape);
        }
    };

    private onKey = (ev: KeyboardEvent): void => {
        if (ev.key === 'Escape' && this.start !== null) {
            // Esc during a drag cancels it, and nothing else: the set stays as it was.
            ev.preventDefault();
            ev.stopPropagation();
            console.info('[MapStudio] The ' + this.shape + ' was cancelled (Esc): nothing was selected.');
            this.end();
        }
    };

    /** The gesture dropped with nothing selected (Edit mode left, the component gone). */
    cancel(): void {
        if (this.start !== null) {
            this.end();
        }
    }

    private polygon(): Pixel[] {
        if (this.shape === 'box') {
            return this.start && this.current ? boxPolygon(this.start, this.current) : [];
        }
        return this.path;
    }

    private end(): void {
        window.removeEventListener('pointermove', this.onMove, true);
        window.removeEventListener('pointerup', this.onUp, true);
        window.removeEventListener('keydown', this.onKey, true);
        window.removeEventListener('pointercancel', this.onLost, true);
        window.removeEventListener('lostpointercapture', this.onLost, true);
        window.removeEventListener('blur', this.onBlur);
        const map = this.host.map;
        if (map && this.panWasOn && !map.dragPan.isEnabled()) {
            map.dragPan.enable();
        }
        this.panWasOn = false;
        this.start = null;
        this.current = null;
        this.path = [];
        this.dragging = false;
        this.pointerId = -1;
        if (this.svg && this.svg.parentNode) {
            this.svg.parentNode.removeChild(this.svg);
        }
        this.svg = null;
        if (this.host.mapContainer) {
            this.host.mapContainer.setAttribute('data-box-select', '');
        }
    }

    private showShape(): void {
        const el = this.host.mapContainer;
        if (!el || typeof document === 'undefined') {
            return;
        }
        const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
        svg.setAttribute('class', 'mapstudio-box-select');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('data-shape', this.shape);
        const mark = document.createElementNS(SVG_NS, 'polygon');
        mark.setAttribute('class', 'mapstudio-box-select-shape');
        svg.appendChild(mark);
        el.appendChild(svg);
        this.svg = svg;
        el.setAttribute('data-box-select', this.shape);
    }

    private drawShape(): void {
        const mark = this.svg ? this.svg.firstChild as SVGPolygonElement | null : null;
        if (!mark) {
            return;
        }
        mark.setAttribute('points', this.polygon().map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '));
    }
}
