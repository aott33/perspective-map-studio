/**
 * The drawing tools (epic 4 entries 2 and 4; epic 1 story 1): Terra Draw on the MapLibre adapter with three
 * modes. The Point tool (entry 2) is Terra Draw's point mode with `editable`: one click places a point, saved
 * at once as its kind, and a drag of the placed pin saves one update per drag end. The Line and Area tools
 * (entry 4) are Terra Draw's line and polygon modes: vertex by vertex with no drag, finished by a double-click,
 * Enter or the drawing bar's Finish (the mode's finish key on the map's canvas), Backspace removing the last
 * vertex (the mode's own `undo`), Esc cancelling to Select; the library's `validation` hook refuses a finish
 * with too few vertices (two for a line, three for an area) or an area whose edges cross (Terra Draw's
 * self-intersection check; a line may cross itself, as the library allows) and the bar says why; its
 * `snapping.toCustom` callback, while the Snap toggle is on, lands a vertex on the nearest map item or line
 * vertex within reach (geometry.ts) and the target is remembered per vertex, so the saved line's `ends`
 * come from the snaps and never from the coordinates (AD-19). A finished line or area is saved at once
 * through the delegate's one batch (the kind's name as its placeholder, an area's ring unclosed), selected,
 * and Details opens with Name focused, as the Point tool does; the tool stays in hand until Esc or Select.
 * Every tool is off while map.load says the map store is unreachable. DOM-bound (Terra Draw, the map
 * container's keydown); every function takes the component as its host (EditingHost names the fields and
 * callbacks it reads), and the state is the component's: the drawing in progress (drawing.ts) and the
 * studio model (studio.ts) are written through its `drawingState`, `toolState` and `selectionState`, in a
 * functional setState.
 */

import type { Position } from 'geojson';
import { Map as MapLibreMap } from 'maplibre-gl';
import {
    GeoJSONStoreFeatures, SnappableContext, TerraDraw, TerraDrawLineStringMode, TerraDrawMouseEvent, TerraDrawPointMode, TerraDrawPolygonMode,
    ValidateNotSelfIntersecting
} from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import type { MapStudioState, Props } from './MapStudio';
import { MapStudioStoreDelegate } from './MapStudioStoreDelegate';
import {
    Drawing, DrawingTool, REASON_SELF_INTERSECTS, addedText, drawingEnds, inField, isDrawingTool, minVertices, startDrawing, withVertices
} from './drawing';
import { Selection } from './features';
import { SnapTarget, nearestSnap, snapDistanceM, snapTargets } from './geometry';
import { StudioTool, isDrawing, isPlacing, toolKind } from './studio';
import { drawColor } from './theme';

/** Terra Draw's mode names: idle, and the three tools'. */
export const DRAW_MODE_OFF = 'static';
export const DRAW_MODE_POINT = 'point';
export const DRAW_MODE_LINE = 'linestring';
export const DRAW_MODE_AREA = 'polygon';

/** An add whose save the toast waits on (MapStudio.tsx applyToast): the item and the toast's words. */
export interface PendingToast {
    itemId: string;
    message: string;
}

/** What the tools read and write on the component. */
export interface EditingHost {
    readonly props: Readonly<Props>;
    readonly state: Readonly<MapStudioState>;
    setState<K extends keyof MapStudioState>(
        state: Pick<MapStudioState, K> | null | ((prev: Readonly<MapStudioState>) => Pick<MapStudioState, K> | null), callback?: () => void): void;
    map: MapLibreMap | null;
    mapContainer: HTMLDivElement | null;
    /** Terra Draw, its line and polygon modes (kept for Backspace, the mode's undo) and the drawn features queued for the unsaved layer. */
    draw: TerraDraw | null;
    lineMode: TerraDrawLineStringMode | null;
    areaMode: TerraDrawPolygonMode | null;
    queuedFeatures: Array<string | number>;
    /** The Point tool's placed pins, Terra Draw's feature id to the map item's id, kept while the tool is in hand for the drag. */
    placedPoints: Map<string | number, string>;
    /** The item whose Details opens with the cursor in Name (the item just added), or null. */
    focusNameId: string | null;
    /** The add whose save the toast waits on, or null. */
    toastFor: PendingToast | null;
    /** The snap targets of the items as last read, keyed by the items revision they were read at. */
    snapCache: { revision: number; targets: SnapTarget[] } | null;
    /** The target the snapping callback last offered (what the next placed vertex snaps to), or null. */
    lastSnap: SnapTarget | null;
    /** The validation hook's latest reason on a committed vertex ('' when valid), which the change handler puts in the state. */
    drawingReason: string;
    /** The component's stable callbacks Terra Draw's finish and change events and the container's keydown take. */
    onDrawFinish: (id: string | number, context: { mode: string; action: string }) => void;
    onDrawChange: (ids: Array<string | number>, type: string) => void;
    onKeyDown: (ev: KeyboardEvent) => void;
    /** The drawing in progress (or null) from the pending state, for a functional setState. */
    drawingState(prev: Readonly<MapStudioState>, drawing: Drawing | null): Pick<MapStudioState, 'drawing'>;
    /** A tool picked up (with the kind a kind button fixed) or put down with null, with the studio model, from the pending state. */
    toolState(prev: Readonly<MapStudioState>, tool: StudioTool | null, kindId: string | null): Pick<MapStudioState, 'drawing' | 'snapHint' | 'studio'>;
    /** A selection with the studio model that goes with it (studio.ts), from the pending state. */
    selectionState(prev: Readonly<MapStudioState>, selected: Selection | null): Pick<MapStudioState, 'selected' | 'studio' | 'panel'>;
    /** Close the open popup, card or sheet (selection.tsx): an added item takes the selection. */
    closePopup: () => void;
    /** A finished line is queued and drawn from the unsaved layer: remove Terra Draw's copy of it (itemsLayer.ts). */
    dropQueuedFeatures(): void;
}

/** Terra Draw's mode for a tool. */
function modeFor(tool: StudioTool): string {
    return tool === 'point' ? DRAW_MODE_POINT : tool === 'area' ? DRAW_MODE_AREA : DRAW_MODE_LINE;
}

/** The mode instance drawing a line or an area, for its undo. */
function drawingMode(host: EditingHost, tool: DrawingTool): TerraDrawLineStringMode | TerraDrawPolygonMode | null {
    return tool === 'area' ? host.areaMode : host.lineMode;
}

/**
 * Terra Draw on the MapLibre adapter, started after the map's own layers so its `td-*` layers draw
 * above them. It idles in the `static` mode and only a tool enters `point`, `linestring` or `polygon`,
 * so the point click round trip keeps the map's clicks while no tool is on. Styles come from theme
 * tokens converted to hex (AD-11); a token that does not resolve leaves that key to the library
 * default, with one warning from drawColor. The line and polygon modes take the validation hook and
 * the snapping callback bound to the host.
 */
export function startTerraDraw(host: EditingHost, map: MapLibreMap, root: HTMLElement | undefined): void {
    const line = drawColor(root, ['--label', '--neutral-70']);
    const outline = drawColor(root, ['--neutral-20', '--containerRoot', '--container']);
    const selection = drawColor(root, ['--callToAction']);
    // The snapped vertex under the pointer (Terra Draw's snapping point) in the selection token, as the snap indicator.
    const snapPoint: { [key: string]: string | number } = { snappingPointWidth: 7, snappingPointOutlineWidth: 2 };
    if (selection) {
        snapPoint.snappingPointColor = selection;
    }
    if (outline) {
        snapPoint.snappingPointOutlineColor = outline;
    }
    const lineStyles: { [key: string]: string | number } = { lineStringWidth: 4, closingPointWidth: 6, closingPointOutlineWidth: 2, ...snapPoint };
    if (line) {
        lineStyles.lineStringColor = line;
        lineStyles.closingPointColor = line;
    }
    if (outline) {
        lineStyles.closingPointOutlineColor = outline;
    }
    // An area drawn as a closed fill in the selection token at low opacity with its outline in the text colour.
    const areaStyles: { [key: string]: string | number } = { fillOpacity: 0.12, outlineWidth: 3, closingPointWidth: 6, closingPointOutlineWidth: 2, ...snapPoint };
    if (selection) {
        areaStyles.fillColor = selection;
    }
    if (line) {
        areaStyles.outlineColor = line;
        areaStyles.closingPointColor = line;
    }
    if (outline) {
        areaStyles.closingPointOutlineColor = outline;
    }
    // The placed pin (entry 2): a dot in the text colour with the blank-map halo, the selection token while it is dragged.
    const pointStyles: { [key: string]: string | number } = { pointWidth: 7, pointOutlineWidth: 2, editedPointWidth: 8, editedPointOutlineWidth: 2 };
    if (line) {
        pointStyles.pointColor = line;
    }
    if (outline) {
        pointStyles.pointOutlineColor = outline;
        pointStyles.editedPointOutlineColor = outline;
    }
    if (selection) {
        pointStyles.editedPointColor = selection;
    }
    const validation = (feature: GeoJSONStoreFeatures, context: { updateType: string }): { valid: boolean; reason?: string } =>
        validateDrawing(host, feature, context.updateType);
    const snapping = { toCustom: (event: TerraDrawMouseEvent, context: SnappableContext): Position | undefined => snapCustom(host, event, context) };
    host.lineMode = new TerraDrawLineStringMode({ styles: lineStyles, validation, snapping });
    host.areaMode = new TerraDrawPolygonMode({ styles: areaStyles, validation, snapping });
    const draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map }),
        modes: [host.lineMode, host.areaMode, new TerraDrawPointMode({ editable: true, styles: pointStyles })]
    });
    draw.on('finish', host.onDrawFinish);
    draw.on('change', host.onDrawChange);
    draw.start();
    host.draw = draw;
    if (host.mapContainer) {
        // Capture phase, so Escape and Backspace reach the tool before Terra Draw's own key handling on the canvas.
        host.mapContainer.addEventListener('keydown', host.onKeyDown, true);
    }
}

/** Every tool is off while map.load says the store is unreachable: a drawing in progress is cancelled, a placed pin dropped. */
export function applyEditing(host: EditingHost): void {
    const off = !!host.props.delegate && host.props.delegate.editing === 'off';
    if (off && host.state.studio.tool !== null) {
        putToolDown(host);
    }
}

/**
 * A tool picked up (the toolbar's Point, Line or Area, or a kind button, which fixes the kind): Terra Draw's mode
 * for it; the tool before it is put down (its drawing in progress goes with it, its placed pins too, their items
 * being saved already). Nothing happens while the store is unreachable.
 */
export function pickTool(host: EditingHost, tool: StudioTool, kindId: string | null = null): void {
    if (!host.draw || (host.props.delegate && host.props.delegate.editing === 'off')) {
        return;
    }
    if (tool !== 'point') {
        clearPlacedPoints(host);
    }
    host.lastSnap = null;
    host.drawingReason = '';
    host.draw.setMode(modeFor(tool));
    host.setState((prev) => host.toolState(prev, tool, kindId));
}

/** The Point tool picked up (entry 2): one click places a point and saves it; a drag of the pin moves it; the tool stays until Esc or Select. */
export function pickPointTool(host: EditingHost): void {
    pickTool(host, 'point');
}

/** Select: every tool put down, Terra Draw idle (a drawing in progress dropped), the placed pins gone (their items are saved). */
export function putToolDown(host: EditingHost): void {
    if (host.draw) {
        host.draw.setMode(DRAW_MODE_OFF);
    }
    clearPlacedPoints(host);
    host.lastSnap = null;
    host.drawingReason = '';
    host.setState((prev) => host.toolState(prev, null, null));
}

/** The Snap toggle (EXPERIENCE.md Snap): off by default; on, the next vertex lands on a target within reach. */
export function toggleSnap(host: EditingHost): void {
    host.lastSnap = null;
    host.setState((prev) => ({ snap: !prev.snap, snapHint: '' }));
}

/** The Point tool's pins leave Terra Draw (the tool put down, Edit mode left, an undo or redo moved their items). */
export function clearPlacedPoints(host: EditingHost): void {
    if (host.placedPoints.size === 0) {
        return;
    }
    const ids = Array.from(host.placedPoints.keys());
    host.placedPoints.clear();
    if (host.draw) {
        try {
            host.draw.removeFeatures(ids);
        } catch (err) {
            console.info('[MapStudio] A placed pin was already gone.');
        }
    }
}

/** The drawing bar's Finish: the mode's finish key (Enter) on the map's canvas, where Terra Draw listens, as Enter itself. */
export function finishDrawing(host: EditingHost): void {
    if (!host.map || !host.state.drawing) {
        return;
    }
    host.map.getCanvas().dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
}

/** The drawing bar's Cancel, as Esc: the drawing goes and the tool is put down. */
export function cancelDrawing(host: EditingHost): void {
    putToolDown(host);
}

/** The snap targets of the items on the map, read again when the items changed. */
function snapTargetsOf(host: EditingHost): SnapTarget[] {
    const delegate = host.props.delegate;
    if (!delegate) {
        return [];
    }
    if (!host.snapCache || host.snapCache.revision !== delegate.itemsRevision) {
        host.snapCache = { revision: delegate.itemsRevision, targets: snapTargets(delegate.items) };
    }
    return host.snapCache.targets;
}

/**
 * Terra Draw's custom snapping (its `snapping.toCustom`, called on every pointer move and click while a line or
 * area is drawn): with the toggle on, the nearest point item or line vertex within SNAP_PX of the pointer takes
 * the vertex, the bar's indicator names it, and the target is remembered for the vertex a click places; with the
 * toggle off nothing snaps. The remembered target, not the coordinate, is what the saved `ends` come from (AD-19).
 */
function snapCustom(host: EditingHost, event: TerraDrawMouseEvent, _context: SnappableContext): Position | undefined {
    const map = host.map;
    if (!host.state.snap || !map) {
        host.lastSnap = null;
        return undefined;
    }
    const hit = nearestSnap(snapTargetsOf(host), [event.lng, event.lat], snapDistanceM(map.getZoom(), event.lat));
    host.lastSnap = hit;
    const hint = hit ? hit.name : '';
    if (host.state.snapHint !== hint) {
        host.setState({ snapHint: hint });
    }
    return hit ? [hit.position[0], hit.position[1]] : undefined;
}

/**
 * The vertices placed so far. Terra Draw keeps the provisional vertex under the pointer last (a line of n placed
 * vertices has n + 1 coordinates); an area's ring is closed and holds the provisional vertex before the closing one
 * (n + 2), except right after the first click, when the ring is four copies of that vertex, so a ring's trailing
 * copies of its last placed vertex count once.
 */
function committedVertices(geometry: GeoJSONStoreFeatures['geometry'], finished: boolean): Array<[number, number]> {
    let coords: Position[] = [];
    if (geometry.type === 'LineString') {
        coords = finished ? geometry.coordinates : geometry.coordinates.slice(0, -1);
    } else if (geometry.type === 'Polygon') {
        const ring = geometry.coordinates[0] || [];
        coords = finished ? ring.slice(0, -1) : ring.slice(0, Math.max(0, ring.length - 2));
        while (!finished && coords.length >= 2 && coords[coords.length - 1][0] === coords[coords.length - 2][0]
            && coords[coords.length - 1][1] === coords[coords.length - 2][1]) {
            coords = coords.slice(0, -1);
        }
    }
    return coords.map((c) => [c[0], c[1]] as [number, number]);
}

function samePlace(a: [number, number], b: [number, number]): boolean {
    return a[0] === b[0] && a[1] === b[1];
}

/**
 * Terra Draw's self-intersection check on an area's ring as placed so far (closed): its reason, or ''. An area only
 * (R11, the plan's matrix): a line's rule is the two-vertex floor, and a line whose edges cross (a looping flowline)
 * is the editor's to draw, as Terra Draw's line mode allows.
 */
function crossingReason(tool: DrawingTool, vertices: Array<[number, number]>): string {
    if (tool !== 'area' || vertices.length < minVertices(tool)) {
        return '';
    }
    const geometry = { type: 'Polygon' as const, coordinates: [vertices.concat([vertices[0]])] };
    const result = ValidateNotSelfIntersecting({ id: 'drawing', type: 'Feature', geometry, properties: {} } as GeoJSONStoreFeatures);
    return result.valid ? '' : result.reason || REASON_SELF_INTERSECTS;
}

/**
 * Terra Draw's validation hook for the line and polygon modes. A provisional update (the pointer moving) is
 * always valid. A committed vertex is always accepted, so the editor sees the drawing as placed, but an area's
 * ring so far is checked for crossing edges (ValidateNotSelfIntersecting) and the reason is kept for the bar. A
 * finish is refused with too few vertices (two for a line, three for an area) or, for an area, crossing edges
 * (the finish then does nothing until Backspace or another vertex fixes it), with the reason in Terra Draw's words.
 */
function validateDrawing(host: EditingHost, feature: GeoJSONStoreFeatures, updateType: string): { valid: boolean; reason?: string } {
    const geometry = feature.geometry;
    if ((geometry.type !== 'LineString' && geometry.type !== 'Polygon') || updateType === 'provisional') {
        return { valid: true };
    }
    const tool: DrawingTool = geometry.type === 'Polygon' ? 'area' : 'line';
    const finished = updateType === 'finish';
    const vertices = committedVertices(geometry, finished);
    if (finished && vertices.length < minVertices(tool)) {
        return { valid: false, reason: tool === 'area' ? 'An area needs three points' : 'A line needs two points' };
    }
    if (!finished && tool === 'line' && vertices.length >= 2 && samePlace(vertices[vertices.length - 1], vertices[vertices.length - 2])) {
        // A click on the vertex just placed adds nothing (a second click there is how a line is finished by a double-click);
        // the polygon mode refuses an identical click itself.
        return { valid: false, reason: 'A point is already there' };
    }
    const reason = crossingReason(tool, vertices);
    host.drawingReason = reason;
    if (finished && reason !== '') {
        host.setState((prev) => (prev.drawing && prev.drawing.reason !== reason ? { drawing: { ...prev.drawing, reason } } : null));
        return { valid: false, reason };
    }
    return { valid: true };
}

/**
 * Terra Draw's change event: the feature being drawn gained or lost a vertex (a click, Backspace), or was
 * deleted (Backspace on the first vertex, Esc). The drawing in progress follows it: the vertices placed so
 * far, the target the new one snapped to (the callback's last offer), and the validation's reason. A pointer
 * move changes none of these, so it redraws nothing.
 */
export function onDrawChange(host: EditingHost, ids: Array<string | number>, type: string): void {
    const draw = host.draw;
    if (!draw) {
        return;
    }
    for (const id of ids) {
        if (type === 'delete') {
            host.setState((prev) => (prev.drawing && prev.drawing.featureId === id ? host.drawingState(prev, null) : null));
            continue;
        }
        const feature = draw.getSnapshotFeature(id);
        if (!feature || !feature.properties || !feature.properties.currentlyDrawing) {
            continue;
        }
        const geometry = feature.geometry;
        if (geometry.type !== 'LineString' && geometry.type !== 'Polygon') {
            continue;
        }
        const tool: DrawingTool = geometry.type === 'Polygon' ? 'area' : 'line';
        const vertices = committedVertices(geometry, false);
        if (vertices.length === 0) {
            continue;
        }
        const snap = host.lastSnap;
        const reason = host.drawingReason;
        host.setState((prev) => {
            if (!isDrawingTool(prev.studio.tool)) {
                return null;
            }
            const next = prev.drawing && prev.drawing.featureId === id
                ? withVertices(prev.drawing, vertices, snap, reason)
                : startDrawing(tool, id, vertices, snap);
            return next === prev.drawing ? null : host.drawingState(prev, next);
        });
    }
}

export function onDrawFinish(host: EditingHost, id: string | number, context: { mode: string; action: string }): void {
    if (!host.draw) {
        return;
    }
    if (context.mode === DRAW_MODE_POINT) {
        onPointFinish(host, id, context.action);
    } else if (context.mode === DRAW_MODE_LINE) {
        onLineFinish(host, id, 'line');
    } else if (context.mode === DRAW_MODE_AREA) {
        onLineFinish(host, id, 'area');
    }
}

/**
 * A line or an area finished (entry 4): saved at once through the delegate's one batch as the tool's kind (the
 * kind a kind button fixed, else the first of its geometry) with the kind's name as its placeholder, an area's
 * ring unclosed (AD-20), and for a line the `ends` its first and last vertex snapped to; the new item takes the
 * selection and Details opens with Name focused, the toast follows the reply, and Terra Draw's copy goes once
 * the unsaved layer draws it. The tool stays in hand for the next one.
 */
function onLineFinish(host: EditingHost, id: string | number, tool: DrawingTool): void {
    const draw = host.draw;
    const delegate = host.props.store.delegate as MapStudioStoreDelegate | undefined;
    if (!draw) {
        return;
    }
    const feature = draw.getSnapshotFeature(id);
    const vertices = feature ? committedVertices(feature.geometry, true) : [];
    if (vertices.length < minVertices(tool)) {
        return;
    }
    const coordinates = vertices.map((c) => [c[0], c[1]] as [number, number]);
    const kinds = host.props.delegate ? host.props.delegate.lists.kinds : [];
    const kind = toolKind(kinds, tool, host.state.studio.toolKind);
    const drawing = host.state.drawing && host.state.drawing.featureId === id ? host.state.drawing : null;
    if (!delegate || !kind) {
        console.warn('[MapStudio] The ' + tool + ' was not saved: ' + (kind ? 'no delegate' : 'the kind list has no ' + tool + ' kind') + '.');
        host.queuedFeatures.push(id);
        setTimeout(() => host.dropQueuedFeatures(), 0);
        host.setState((prev) => host.drawingState(prev, null));
        return;
    }
    const ends = drawing ? drawingEnds(drawing) : null;
    const itemId = delegate.createLine(coordinates, kind, ends);
    host.queuedFeatures.push(id);
    // After Terra Draw's finish handler has returned; componentDidUpdate may do it first.
    setTimeout(() => host.dropQueuedFeatures(), 0);
    host.focusNameId = itemId;
    host.toastFor = { itemId, message: addedText(kind.name) };
    host.closePopup();
    host.setState((prev) => ({
        ...host.selectionState(prev, { id: itemId, kind: 'line', segment: null }), pick: null, panel: itemId, ...host.drawingState(prev, null)
    }));
    console.info('[MapStudio] ' + (tool === 'area' ? 'Area' : 'Line') + ' drawn with ' + coordinates.length + ' points as ' + kind.id + ': ' + itemId
        + (ends ? ' (ends ' + JSON.stringify(ends) + ')' : ' (ends floating)'));
}

/**
 * The Point tool's finish (entry 2): a click placed a pin, saved at once as the kind list's first
 * point kind with the kind's name as its placeholder, selected, and Details opens with Name focused;
 * a drag end moved a placed pin, saved as one update of its item's geometry. The two are told apart
 * by the feature's id, not the finish's action: Terra Draw 1.38.0's point mode reports a drag end as
 * `draw` too (seen live, docs/platform-checks.md "Epic 4 entry 2"). The pin stays on the map for more
 * fine-tuning while the tool is in hand.
 */
function onPointFinish(host: EditingHost, id: string | number, action: string): void {
    const draw = host.draw;
    const delegate = host.props.store.delegate as MapStudioStoreDelegate | undefined;
    if (!draw) {
        return;
    }
    const feature = draw.getSnapshotFeature(id);
    const geometry = feature ? feature.geometry : undefined;
    if (!geometry || geometry.type !== 'Point') {
        return;
    }
    const lngLat: [number, number] = [geometry.coordinates[0], geometry.coordinates[1]];
    if (!delegate) {
        console.warn('[MapStudio] No delegate; the placed point was not saved.');
        return;
    }
    const moved = host.placedPoints.get(id);
    if (moved) {
        console.info('[MapStudio] Pin dragged (' + action + '): ' + moved + ' to ' + lngLat[0].toFixed(6) + ', ' + lngLat[1].toFixed(6));
        delegate.moveItem(moved, lngLat);
        return;
    }
    if (action === 'draw') {
        // The kind as the Line tool resolves it: the kind button's, else the kind list's first point kind.
        const kinds = host.props.delegate ? host.props.delegate.lists.kinds : [];
        const kind = toolKind(kinds, 'point', host.state.studio.toolKind);
        if (!kind) {
            console.warn('[MapStudio] The Point tool has no kind to add: the kind list has no point kind.');
            try {
                draw.removeFeatures([id]);
            } catch (err) {
                // Already gone.
            }
            return;
        }
        const itemId = delegate.createPoint(lngLat, kind);
        host.placedPoints.set(id, itemId);
        host.focusNameId = itemId;
        host.toastFor = { itemId, message: addedText(kind.name) };
        // The new item takes the selection (an open popup goes); its Details open beside the map.
        host.closePopup();
        host.setState((prev) => ({ ...host.selectionState(prev, { id: itemId, kind: 'point' }), pick: null, panel: itemId }));
        console.info('[MapStudio] Point placed with the Point tool: ' + itemId + ' at ' + lngLat[0].toFixed(6) + ', ' + lngLat[1].toFixed(6));
    }
}

/**
 * Keys on the map container (capture phase): Escape puts the tool in hand down, cancelling a drawing in progress
 * (the popup's Esc is selection.tsx's); Backspace while drawing removes the last vertex (the mode's undo). A key
 * typed in a field inside the container (a field of a custom popup view, which MapLibre puts in the container)
 * stays the field's (drawing.ts `inField`).
 */
export function onKeyDown(host: EditingHost, ev: KeyboardEvent): void {
    if (inField(ev.target)) {
        return;
    }
    if (ev.key === 'Escape') {
        if (isDrawing(host.state.studio) || isPlacing(host.state.studio)) {
            putToolDown(host);
        }
        return;
    }
    if (ev.key === 'Backspace' && host.state.drawing) {
        const mode = drawingMode(host, host.state.drawing.tool);
        if (mode) {
            ev.preventDefault();
            ev.stopPropagation();
            host.lastSnap = null;
            mode.undo();
        }
    }
}
