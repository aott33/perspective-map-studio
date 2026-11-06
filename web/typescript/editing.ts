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
 *
 * Changing geometry (entry 5; EXPERIENCE.md Change geometry, the owner's four mocks of 2026-11-06): with Select in hand the
 * selected map item goes into Terra Draw as a copy in its select mode (an area as a closed ring) while it is selected, and
 * leaves when the selection changes or its saved record draws (`applyHandles`). A line or an area shows a handle at each
 * point and a smaller dashed one at each midpoint; dragging a point moves it, dragging a midpoint adds a point there, and a
 * point item's marker is dragged as well; never a whole line or area by its body. A click on a handle chooses that point
 * (the bar's Move, Split here and Delete point are the component's); Move, from that bar or beside a point item's Location in
 * Details, takes the next click on the map as the new place (`onGeometryClick`); Esc puts down Move or the chosen point
 * (`escapeGeometry`). Each change is one batch through the delegate when the drag or the action ends, never per pointer
 * move. A line's end point dragged or moved with Snap on lands on and names a target, with Snap off it floats.
 */

import type { Position } from 'geojson';
import { Map as MapLibreMap } from 'maplibre-gl';
import type { FilterSpecification, MapMouseEvent } from 'maplibre-gl';
import {
    GeoJSONStoreFeatures, HexColor, SnappableContext, TerraDraw, TerraDrawLineStringMode, TerraDrawMouseEvent, TerraDrawPointMode, TerraDrawPolygonMode,
    TerraDrawSelectMode, ValidateNotSelfIntersecting
} from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import type { MapStudioState, Props } from './MapStudio';
import { MapStudioStoreDelegate } from './MapStudioStoreDelegate';
import { MapItemRecord } from './contract';
import {
    Drawing, DrawingTool, GeometryPick, REASON_SELF_INTERSECTS, drawingEnds, inField, isDrawingTool, minVertices, startDrawing, withVertices
} from './drawing';
import { Selection } from './features';
import { EDGES_CROSS, SnapTarget, endSideOf, nearestSnap, ringCrosses, snapDistanceM, snapTargets, snapTargetsForLine } from './geometry';
import { StudioTool, isDrawing, isPlacing, toolKind } from './studio';
import { drawColor } from './theme';

/** Terra Draw's mode names: idle, and the three tools'. */
export const DRAW_MODE_OFF = 'static';
export const DRAW_MODE_POINT = 'point';
export const DRAW_MODE_LINE = 'linestring';
export const DRAW_MODE_AREA = 'polygon';
/** Entry 5: the select mode the selected item's copy is edited in, and the modes its copy belongs to (never picked as tools). */
export const DRAW_MODE_SELECT = 'select';
const EDIT_MODE_POINT = 'edit-point';
const EDIT_MODE_LINE = 'edit-line';
const EDIT_MODE_AREA = 'edit-area';

/** How near the pointer must be to a handle, in screen pixels, to drag it or, with a click, to choose it (entry 5). */
export const HANDLE_PX = 12;

/** The map's own layers over Terra Draw's for the handles (entry 5): the dashed midpoints and the chosen point. */
export const LAYER_HANDLE_MIDPOINTS = 'mapstudio-handle-midpoints';
export const LAYER_HANDLE_CHOSEN = 'mapstudio-handle-chosen';
const MIDPOINT_IMAGE = 'mapstudio-handle-midpoint';
/** Terra Draw's point source on the MapLibre adapter (its `td` prefix): the handles' features with their properties. */
const TERRA_DRAW_POINTS = 'td-point';

/**
 * The selected item's copy in Terra Draw while Select is in hand (entry 5): which item, its shape, the stored coordinates it
 * was made from and the record it was made from as a key; a new key makes the copy again.
 */
export interface Handles {
    featureId: string | number;
    itemId: string;
    shape: 'point' | 'line' | 'area';
    /** The stored coordinates the copy was made from: a point's place, a line's points, an area's ring unclosed. */
    coords: Array<[number, number]>;
    /** What the copy shows now (after drags, Move then a click and Delete point not yet drawn from the record): what a drag is told from. */
    shown: Array<[number, number]>;
    /** The record's id, version and coordinates as text. */
    key: string;
    /** A change was made on the copy: it is made again from the record once nothing is in flight. */
    awaiting: boolean;
    /** The delegate's geometry refusal last read: a newer one of this item makes the copy again from the stored shape. */
    refusalSeen: number;
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
    /** Entry 5: Terra Draw's select mode, the selected item's copy in it (null with none), and the target a dragged end snapped to. */
    selectMode: TerraDrawSelectMode | null;
    handles: Handles | null;
    dragSnap: SnapTarget | null;
    /** A drag in Terra Draw's select mode is under way (its pointer events say so): the copy is never made again from under it. */
    handleDrag: boolean;
    /** The chosen point the handle layer draws (its index, -1 for none), so the layer's filter is set only when it changes. */
    chosenDrawn: number;
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
    toolState(prev: Readonly<MapStudioState>, tool: StudioTool | null, kindId: string | null): Pick<MapStudioState, 'drawing' | 'snapHint' | 'studio' | 'geometry'>;
    /** A selection with the studio model that goes with it (studio.ts), from the pending state. */
    selectionState(prev: Readonly<MapStudioState>, selected: Selection | null): Pick<MapStudioState, 'selected' | 'studio' | 'panel' | 'geometry'>;
    /** Close the open popup, card or sheet (selection.tsx): an added item takes the selection. */
    closePopup: () => void;
    /** A finished line is queued and drawn from the unsaved layer: remove Terra Draw's copy of it (itemsLayer.ts). */
    dropQueuedFeatures(): void;
    /** Whether the studio shows (Edit mode at level full, 768 px and wider), the live map item with an id, and the one this page saves (entry 5). */
    studioOn(): boolean;
    liveItem(id: string): MapItemRecord | undefined;
    itemFor(id: string): MapItemRecord | undefined;
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
    const fill = drawColor(root, ['--containerRoot', '--container', '--neutral-10']);
    const midpoint = fill && selection ? midpointImage(fill, selection) : null;
    host.selectMode = makeSelectMode(host, { line, fill, selection, dashedMidpoints: midpoint !== null });
    const draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map }),
        modes: [host.lineMode, host.areaMode, new TerraDrawPointMode({ editable: true, styles: pointStyles }), host.selectMode,
            new TerraDrawPointMode({ modeName: EDIT_MODE_POINT }), new TerraDrawLineStringMode({ modeName: EDIT_MODE_LINE }),
            new TerraDrawPolygonMode({ modeName: EDIT_MODE_AREA })]
    });
    draw.on('finish', host.onDrawFinish);
    draw.on('change', host.onDrawChange);
    draw.start();
    host.draw = draw;
    addHandleLayers(map, midpoint, fill, selection);
    if (host.mapContainer) {
        // Capture phase, so Escape and Backspace reach the tool before Terra Draw's own key handling on the canvas.
        host.mapContainer.addEventListener('keydown', host.onKeyDown, true);
    }
}

/**
 * Terra Draw's select mode for the selected item's copy (entry 5). Its clicks and keys are off (the component chooses a point
 * on a click and owns Esc and Delete; nothing is selected or deselected by Terra Draw itself) and only its drags act: a line's
 * or an area's points and midpoints (a midpoint dragged adds a point there), never the body; a point item's whole feature. A
 * line may cross itself, an area may not. A line's end point snaps while the Snap toggle is on (`snapEdit`). A drag made while
 * the last change is being saved goes after it (the delegate's turn). Its drag start and end mark `handleDrag`, so the copy is
 * never made again from under a drag. The vertex handles take the mocks' look: a disc in the surface token ringed in the
 * selection token; the midpoints are drawn dashed by the map's own layer when the image could be made; the copy itself shows
 * only while its shape differs from the stored record (during a drag and until the save draws), the map drawing the item.
 */
function makeSelectMode(host: EditingHost, colors: { line: HexColor | null; fill: HexColor | null; selection: HexColor | null;
    dashedMidpoints: boolean }): TerraDrawSelectMode {
    const shown = (feature: GeoJSONStoreFeatures): number => (copyChanged(host, feature) ? 1 : 0);
    const styles: { [key: string]: HexColor | number | ((feature: GeoJSONStoreFeatures) => number) } = {
        selectionPointWidth: 6, selectionPointOutlineWidth: 2.5,
        midPointWidth: 4, midPointOutlineWidth: 1.5, midPointOpacity: colors.dashedMidpoints ? 0 : 1, midPointOutlineOpacity: colors.dashedMidpoints ? 0 : 1,
        selectedLineStringWidth: 3, selectedLineStringOpacity: shown,
        selectedPolygonFillOpacity: 0, selectedPolygonOutlineWidth: 3, selectedPolygonOutlineOpacity: shown,
        selectedPointWidth: 7, selectedPointOutlineWidth: 2, selectedPointOpacity: shown, selectedPointOutlineOpacity: shown
    };
    if (colors.fill) {
        styles.selectionPointColor = colors.fill;
        styles.midPointColor = colors.fill;
        styles.selectedPointOutlineColor = colors.fill;
    }
    if (colors.selection) {
        styles.selectionPointOutlineColor = colors.selection;
        styles.midPointOutlineColor = colors.selection;
        styles.selectedPointColor = colors.selection;
    }
    if (colors.line) {
        styles.selectedLineStringColor = colors.line;
        styles.selectedPolygonOutlineColor = colors.line;
    }
    const points = { draggable: true, midpoints: { draggable: true }, deletable: false };
    return new TerraDrawSelectMode({
        pointerDistance: HANDLE_PX,
        keyEvents: null,
        allowManualSelection: false,
        allowManualDeselection: false,
        pointerEvents: {
            leftClick: false, rightClick: false, contextMenu: false,
            onDragStart: () => {
                host.handleDrag = true;
                return true;
            },
            onDrag: true,
            onDragEnd: () => {
                host.handleDrag = false;
                // A record that changed during the drag is drawn once it ends (after Terra Draw's own drag end and finish).
                setTimeout(() => applyHandles(host), 0);
                return true;
            }
        },
        flags: {
            [EDIT_MODE_POINT]: { feature: { draggable: true } },
            [EDIT_MODE_LINE]: { feature: { draggable: false, selfIntersectable: true, coordinates: {
                ...points, snappable: { toCustom: (event: TerraDrawMouseEvent, context: SnappableContext) => snapEdit(host, event, context) } } } },
            [EDIT_MODE_AREA]: { feature: { draggable: false, selfIntersectable: false, coordinates: points } }
        },
        styles: styles as SelectStyles
    });
}

/** The select mode's styling keys (Terra Draw does not export the type). */
type SelectStyles = NonNullable<NonNullable<ConstructorParameters<typeof TerraDrawSelectMode>[0]>['styles']>;

/** Whether the copy's shape differs from the stored coordinates it was made from (a drag, Move then a click or Delete point moved it). */
function copyChanged(host: EditingHost, feature: GeoJSONStoreFeatures): boolean {
    const handles = host.handles;
    if (!handles || feature.id !== handles.featureId) {
        return false;
    }
    const coords = coordsOf(feature.geometry);
    return coords.length !== handles.coords.length || coords.some((c, i) => !samePlace(c, handles.coords[i]));
}

/** A copy's coordinates as stored: a point's place, a line's points, a polygon's ring unclosed. */
function coordsOf(geometry: GeoJSONStoreFeatures['geometry']): Array<[number, number]> {
    if (geometry.type === 'Point') {
        return [[geometry.coordinates[0], geometry.coordinates[1]]];
    }
    if (geometry.type === 'LineString') {
        return geometry.coordinates.map((c) => [c[0], c[1]] as [number, number]);
    }
    if (geometry.type === 'Polygon') {
        return (geometry.coordinates[0] || []).slice(0, -1).map((c) => [c[0], c[1]] as [number, number]);
    }
    return [];
}

/** The dashed midpoint of the mocks (a 4 px disc in the surface token with a dashed ring in the selection token), or null without a canvas. */
function midpointImage(fill: string, stroke: string): ImageData | null {
    if (typeof document === 'undefined') {
        return null;
    }
    const ratio = 2;
    const size = 12 * ratio;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof ctx.setLineDash !== 'function') {
        return null;
    }
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 4 * ratio, 0, 2 * Math.PI);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 1.5 * ratio;
    ctx.setLineDash([2 * ratio, 2 * ratio]);
    ctx.strokeStyle = stroke;
    ctx.stroke();
    return ctx.getImageData(0, 0, size, size);
}

/** The filter of the chosen point's layer: the selection point with this index (-1 for none). */
function chosenFilter(index: number): FilterSpecification {
    return ['all', ['==', ['get', 'selectionPoint'], true], ['==', ['get', 'index'], index]] as FilterSpecification;
}

/**
 * The map's own layers over Terra Draw's, reading Terra Draw's point source (entry 5): the dashed midpoints, and the chosen
 * point drawn filled in the selection token, larger, ringed in the surface token (the owner's mock 2).
 */
function addHandleLayers(map: MapLibreMap, midpoint: ImageData | null, fill: HexColor | null, selection: HexColor | null): void {
    if (!map.getSource(TERRA_DRAW_POINTS)) {
        console.info('[MapStudio] Terra Draw\'s point source is not there; the handles keep the library\'s look.');
        return;
    }
    if (midpoint) {
        map.addImage(MIDPOINT_IMAGE, midpoint, { pixelRatio: 2 });
        map.addLayer({
            id: LAYER_HANDLE_MIDPOINTS, type: 'symbol', source: TERRA_DRAW_POINTS,
            filter: ['==', ['get', 'midPoint'], true] as FilterSpecification,
            layout: { 'icon-image': MIDPOINT_IMAGE, 'icon-allow-overlap': true, 'icon-ignore-placement': true }
        });
    }
    if (!fill || !selection) {
        // No colour of Map Studio's own (AD-11): without the tokens the chosen point is said by the bar alone.
        return;
    }
    map.addLayer({
        id: LAYER_HANDLE_CHOSEN, type: 'circle', source: TERRA_DRAW_POINTS, filter: chosenFilter(-1),
        paint: { 'circle-radius': 8, 'circle-color': selection, 'circle-stroke-width': 2.5, 'circle-stroke-color': fill }
    });
}

/**
 * Terra Draw stopped (the component unmounts): the map's own handle layers leave first, since they read Terra Draw's point
 * source, which its adapter removes as it stops (MapLibre refuses to remove a source a layer still uses).
 */
export function stopTerraDraw(host: EditingHost): void {
    const map = host.map;
    if (map) {
        for (const id of [LAYER_HANDLE_CHOSEN, LAYER_HANDLE_MIDPOINTS]) {
            if (map.getLayer(id)) {
                map.removeLayer(id);
            }
        }
        if (map.hasImage(MIDPOINT_IMAGE)) {
            map.removeImage(MIDPOINT_IMAGE);
        }
    }
    host.handles = null;
    host.dragSnap = null;
    host.handleDrag = false;
    host.chosenDrawn = -1;
    if (host.draw) {
        host.draw.stop();
        host.draw = null;
    }
}

/**
 * The selected item's copy in Terra Draw (entry 5), after every update of the component: wanted while Select is in hand in the
 * studio, the store reachable, and a stored map item is selected that may be reshaped (a point that is not an instrument, which
 * moves along its line with entry 9; a line; an area). The copy of the same item stays while a drag is under way, and while a
 * change made on it is being saved or waits its turn (it shows what the editor did); once nothing is in flight it is made
 * again from the record when the record changed (its save drew, an undo, another editor) or a change made on it settled (a
 * refusal leaves the record as it was). Then the chosen point and Move are kept only while they still name what the studio
 * shows, and the handles' attributes are published for the e2e suite.
 */
export function applyHandles(host: EditingHost): void {
    const draw = host.draw;
    if (!draw) {
        return;
    }
    const want = wantedHandles(host);
    const have = host.handles;
    const delegate = host.props.delegate;
    const busy = !!delegate && delegate.editInFlight;
    let keep = false;
    if (want && have && have.itemId === want.itemId && have.shape === want.shape) {
        // A geometry save of this item refused for good: the changes made on it went with it, so the stored shape shows again.
        const refusal = delegate ? delegate.shapeRefused : null;
        let refused = false;
        if (!host.handleDrag && refusal && refusal.revision !== have.refusalSeen) {
            refused = refusal.ids.indexOf(have.itemId) >= 0;
            have.refusalSeen = refusal.revision;
        }
        keep = host.handleDrag || (!refused && (have.awaiting ? busy : have.key === want.key));
    }
    if (!keep) {
        if (have) {
            dropHandles(host, want !== null);
        }
        if (want) {
            addHandles(host, want);
        }
    }
    keepPick(host);
    publishHandles(host);
}

/** The copy shows `coords` now (Move then a click, Delete point): its handles follow at once, until the record draws it. */
function setCopy(host: EditingHost, coords: Array<[number, number]>): void {
    const draw = host.draw;
    const handles = host.handles;
    if (!draw || !handles) {
        return;
    }
    const geometry = handles.shape === 'point' ? { type: 'Point' as const, coordinates: coords[0] }
        : handles.shape === 'area' ? { type: 'Polygon' as const, coordinates: [coords.concat([coords[0]])] }
            : { type: 'LineString' as const, coordinates: coords };
    try {
        draw.updateFeatureGeometry(handles.featureId, geometry);
        handles.shown = coords;
    } catch (err) {
        console.info('[MapStudio] The handles did not follow the change: ' + (err instanceof Error ? err.message : String(err)));
    }
}

function wantedHandles(host: EditingHost): Omit<Handles, 'featureId' | 'awaiting' | 'shown' | 'refusalSeen'> | null {
    const delegate = host.props.delegate;
    const selected = host.state.selected;
    if (!delegate || delegate.editing === 'off' || !selected || host.state.studio.tool !== null || !host.studioOn()) {
        return null;
    }
    const item = host.liveItem(selected.id);
    if (!item || item.version < 1) {
        return null;
    }
    const kind = delegate.lists.kinds.find((k) => k.id === item.kind);
    const key = item.id + ':' + item.version + ':' + JSON.stringify(item.geometry.coordinates);
    if (item.geometry.type === 'Point') {
        if (item.attachment !== null || (kind && kind.instrument)) {
            return null;
        }
        return { itemId: item.id, shape: 'point', coords: [[item.geometry.coordinates[0], item.geometry.coordinates[1]]], key };
    }
    const coords = item.geometry.coordinates.map((c) => [c[0], c[1]] as [number, number]);
    return { itemId: item.id, shape: kind && kind.area ? 'area' : 'line', coords, key };
}

function addHandles(host: EditingHost, want: Omit<Handles, 'featureId' | 'awaiting' | 'shown' | 'refusalSeen'>): void {
    const draw = host.draw;
    if (!draw) {
        return;
    }
    const featureId = draw.getFeatureId();
    const geometry = want.shape === 'point' ? { type: 'Point' as const, coordinates: want.coords[0] }
        : want.shape === 'area' ? { type: 'Polygon' as const, coordinates: [want.coords.concat([want.coords[0]])] }
            : { type: 'LineString' as const, coordinates: want.coords };
    const mode = want.shape === 'point' ? EDIT_MODE_POINT : want.shape === 'area' ? EDIT_MODE_AREA : EDIT_MODE_LINE;
    if (draw.getMode() !== DRAW_MODE_SELECT) {
        draw.setMode(DRAW_MODE_SELECT);
    }
    const [result] = draw.addFeatures([{ type: 'Feature', id: featureId, geometry, properties: { mode } } as GeoJSONStoreFeatures]);
    if (!result || !result.valid) {
        console.info('[MapStudio] No handles for ' + want.itemId + ': ' + (result && result.reason ? result.reason : 'Terra Draw refused its shape') + '.');
        draw.setMode(DRAW_MODE_OFF);
        return;
    }
    draw.selectFeature(featureId);
    const delegate = host.props.delegate;
    host.handles = { ...want, featureId, shown: want.coords, awaiting: false, refusalSeen: delegate ? delegate.shapeRefused.revision : 0 };
}

/** The copy leaves Terra Draw; Terra Draw idles again unless another copy follows (`keepSelect`). */
function dropHandles(host: EditingHost, keepSelect: boolean): void {
    const draw = host.draw;
    const handles = host.handles;
    host.handles = null;
    host.dragSnap = null;
    if (!draw || !handles) {
        return;
    }
    if (!keepSelect && draw.getMode() === DRAW_MODE_SELECT) {
        draw.setMode(DRAW_MODE_OFF);
    }
    try {
        if (draw.hasFeature(handles.featureId)) {
            draw.removeFeatures([handles.featureId]);
        }
    } catch (err) {
        console.info('[MapStudio] The handles\' copy was already gone.');
    }
}

/**
 * The chosen point and Move stay only while they still name what the studio shows (entry 5): a point of the copy's line or
 * area, or Move of the selected point item with Select in hand and the store reachable; else they go (nothing is sent).
 */
function keepPick(host: EditingHost): void {
    const pick = host.state.geometry;
    if (!pick) {
        return;
    }
    const handles = host.handles;
    const delegate = host.props.delegate;
    const selected = host.state.selected;
    const usable = !!delegate && delegate.editing !== 'off' && host.state.studio.tool === null && host.studioOn()
        && !!selected && selected.id === pick.itemId;
    const kept = usable && (pick.index === null
        ? !!host.itemFor(pick.itemId)
        : !!handles && handles.itemId === pick.itemId && handles.shape !== 'point' && pick.index < handles.shown.length);
    if (!kept) {
        host.setState((prev) => (prev.geometry === pick ? { geometry: null } : null));
    }
}

/**
 * For the e2e suite: the item whose handles show and the handles Terra Draw holds for it (its selection points and midpoints:
 * a point item has none, its marker is dragged); and the chosen point drawn by the handle layer.
 */
function publishHandles(host: EditingHost): void {
    const handles = host.handles;
    const el = host.mapContainer;
    if (el) {
        let points = 0;
        let midpoints = 0;
        if (handles && host.draw) {
            for (const feature of host.draw.getSnapshot()) {
                if (feature.properties.selectionPoint) {
                    points++;
                } else if (feature.properties.midPoint) {
                    midpoints++;
                }
            }
        }
        const copy = handles && host.draw ? host.draw.getSnapshotFeature(handles.featureId) : undefined;
        el.setAttribute('data-handles', handles ? handles.itemId : '');
        el.setAttribute('data-handle-points', handles ? String(points) : '');
        el.setAttribute('data-handle-midpoints', handles ? String(midpoints) : '');
        // Whether the handles show a change not yet drawn from the record (being saved, or waiting its turn).
        el.setAttribute('data-handles-changed', handles && copy ? String(copyChanged(host, copy)) : '');
    }
    const pick = host.state.geometry;
    const chosen = pick && pick.index !== null && handles && handles.itemId === pick.itemId ? pick.index : -1;
    const map = host.map;
    if (map && chosen !== host.chosenDrawn && map.getLayer(LAYER_HANDLE_CHOSEN)) {
        map.setFilter(LAYER_HANDLE_CHOSEN, chosenFilter(chosen));
        host.chosenDrawn = chosen;
    }
}

/** The targets a line's end may snap to while it is edited: never its own points or its own instruments (geometry.ts). */
function lineSnapTargets(host: EditingHost, lineId: string): SnapTarget[] {
    const delegate = host.props.delegate;
    return snapTargetsForLine(snapTargetsOf(host), delegate ? delegate.items : [], lineId);
}

/**
 * A line's end point dragged (Terra Draw's custom snapping in the select mode, entry 5): with Snap on, the nearest point item or
 * vertex of another item within reach takes it and is remembered for the drag's save, so `ends` names it; an inner point, an
 * area's point or Snap off never snaps, and the end floats.
 */
function snapEdit(host: EditingHost, event: TerraDrawMouseEvent, context: SnappableContext): Position | undefined {
    host.dragSnap = null;
    const handles = host.handles;
    const map = host.map;
    if (!host.state.snap || !map || !handles || handles.shape !== 'line' || context.currentCoordinate === undefined) {
        return undefined;
    }
    const geometry = context.getCurrentGeometrySnapshot();
    const count = geometry && geometry.type === 'LineString' ? geometry.coordinates.length : handles.shown.length;
    if (endSideOf(count, context.currentCoordinate, false) === null) {
        return undefined;
    }
    const hit = nearestSnap(lineSnapTargets(host, handles.itemId), [event.lng, event.lat], snapDistanceM(map.getZoom(), event.lat));
    host.dragSnap = hit;
    return hit ? [hit.position[0], hit.position[1]] : undefined;
}

/**
 * A drag of the copy ended (Terra Draw's select-mode finish, entry 5): one change through the delegate, read from the copy
 * against what it showed before the drag (`shown`; a change still being saved is part of it). A point item: its move with the
 * snapped ends of its lines. A line or an area: one more point (a midpoint dragged in) saves the new points; one point moved
 * saves that point, a line's end naming the target it snapped to or floating. The midpoint's insert at the drag's start sends
 * nothing: the drag's end does. A drag puts Move down; the dragged point stays chosen, any other chosen point goes.
 */
function onHandleFinish(host: EditingHost, id: string | number, action: string): void {
    const draw = host.draw;
    const handles = host.handles;
    const delegate = host.props.store.delegate as MapStudioStoreDelegate | undefined;
    if (!draw || !handles || handles.featureId !== id || (action !== 'dragCoordinate' && action !== 'dragFeature')) {
        return;
    }
    const snap = host.dragSnap;
    host.dragSnap = null;
    const feature = draw.getSnapshotFeature(id);
    const coords = feature ? coordsOf(feature.geometry) : [];
    const before = handles.shown;
    let sent = false;
    let moved = -1;
    if (delegate && coords.length > 0) {
        if (handles.shape === 'point') {
            sent = !samePlace(coords[0], before[0]) && delegate.moveItem(handles.itemId, coords[0]);
        } else if (coords.length === before.length + 1) {
            sent = delegate.reshapeLine(handles.itemId, coords);
        } else if (coords.length === before.length) {
            moved = coords.findIndex((c, i) => !samePlace(c, before[i]));
            const side = moved >= 0 ? endSideOf(coords.length, moved, handles.shape === 'area') : null;
            sent = moved >= 0 && delegate.moveVertex(handles.itemId, moved, coords[moved], side !== null && snap ? snap.itemId : null);
        }
    }
    if (coords.length > 0) {
        handles.shown = coords;
    }
    // Saved or not, the copy is made again from the record once nothing is in flight; a drag that sent nothing at once,
    // after Terra Draw's drag end has returned.
    handles.awaiting = true;
    if (!sent) {
        setTimeout(() => applyHandles(host), 0);
    }
    console.info('[MapStudio] Handle drag on ' + handles.itemId + (sent ? ' saved as one change' : ' sent nothing') + '.');
    host.setState((prev) => {
        const pick = prev.geometry;
        if (!pick || pick.itemId !== handles.itemId) {
            return null;
        }
        return { geometry: pick.index !== null && pick.index === moved ? { itemId: pick.itemId, index: pick.index, moving: false } : null };
    });
}

/**
 * A click on the map with Select in hand (entry 5), before the selection's own click: while Move waits, the click is the new
 * place, saved as one change, and Move goes (a chosen point stays chosen); else a click on a handle of the selected line or
 * area chooses that point. True when the click was taken.
 */
export function onGeometryClick(host: EditingHost, ev: MapMouseEvent): boolean {
    const map = host.map;
    if (!map || host.state.studio.tool !== null || !host.studioOn()) {
        return false;
    }
    const pick = host.state.geometry;
    if (pick && pick.moving) {
        placeMove(host, pick, [ev.lngLat.lng, ev.lngLat.lat]);
        return true;
    }
    const handles = host.handles;
    if (!handles || handles.shape === 'point') {
        return false;
    }
    let index = -1;
    let best = HANDLE_PX;
    handles.shown.forEach((c, i) => {
        const p = map.project(c);
        const d = Math.hypot(p.x - ev.point.x, p.y - ev.point.y);
        if (d <= best) {
            best = d;
            index = i;
        }
    });
    if (index < 0) {
        return false;
    }
    const itemId = handles.itemId;
    host.setState({ geometry: { itemId, index, moving: false } });
    console.info('[MapStudio] Point ' + (index + 1) + ' of ' + itemId + ' chosen.');
    return true;
}

/** An area's change refused here, nothing sent: the bar says why (`problem`) and the pick stays as it was. */
function refuseInBar(host: EditingHost, pick: GeometryPick, problem: string): void {
    host.setState((prev) => (prev.geometry === pick ? { geometry: { ...pick, problem } } : null));
    console.info('[MapStudio] ' + problem + '; nothing was sent.');
}

/**
 * Move then a click (entry 5): a point item moves there with the snapped ends of its lines; a point of a line or an area moves
 * there, a line's end landing on and naming the target within reach while Snap is on (never its own points or instruments),
 * else floating. An area whose edges would cross is refused in the bar and Move keeps waiting. One change; the handles follow.
 */
function placeMove(host: EditingHost, pick: GeometryPick, at: [number, number]): void {
    const delegate = host.props.store.delegate as MapStudioStoreDelegate | undefined;
    const map = host.map;
    if (!delegate || !map) {
        return;
    }
    const handles = host.handles;
    if (pick.index === null) {
        if (delegate.moveItem(pick.itemId, at)) {
            if (handles && handles.itemId === pick.itemId && handles.shape === 'point') {
                setCopy(host, [at]);
                handles.awaiting = true;
            }
            host.setState((prev) => (prev.geometry === pick ? { geometry: null } : null));
        }
        return;
    }
    if (!handles || handles.itemId !== pick.itemId || pick.index >= handles.shown.length) {
        return;
    }
    const area = handles.shape === 'area';
    let to: [number, number] = at;
    let snapTo: string | null = null;
    if (host.state.snap && endSideOf(handles.shown.length, pick.index, area) !== null) {
        const hit = nearestSnap(lineSnapTargets(host, pick.itemId), at, snapDistanceM(map.getZoom(), at[1]));
        if (hit) {
            to = [hit.position[0], hit.position[1]];
            snapTo = hit.itemId;
        }
    }
    const next = handles.shown.map((c, i) => (i === pick.index ? to : [c[0], c[1]] as [number, number]));
    if (area && ringCrosses(next)) {
        refuseInBar(host, pick, EDGES_CROSS);
        return;
    }
    if (delegate.moveVertex(pick.itemId, pick.index, to, snapTo)) {
        setCopy(host, next);
        handles.awaiting = true;
        host.setState((prev) => (prev.geometry === pick ? { geometry: { itemId: pick.itemId, index: pick.index, moving: false } } : null));
    }
}

/**
 * The chosen point's Delete point (entry 5): one change without it; an area whose edges would cross without it is refused in
 * the bar, nothing sent. The handles follow at once and the chosen point goes.
 */
export function deletePoint(host: EditingHost): void {
    const pick = host.state.geometry;
    const handles = host.handles;
    const delegate = host.props.store.delegate as MapStudioStoreDelegate | undefined;
    if (!pick || pick.index === null || !handles || handles.itemId !== pick.itemId || handles.shape === 'point' || !delegate) {
        return;
    }
    const index = pick.index;
    const next = handles.shown.filter((_c, i) => i !== index);
    if (handles.shape === 'area' && ringCrosses(next)) {
        refuseInBar(host, pick, EDGES_CROSS);
        return;
    }
    if (delegate.deleteVertex(pick.itemId, index)) {
        setCopy(host, next);
        handles.awaiting = true;
        host.setState((prev) => (prev.geometry === pick ? { geometry: null } : null));
    }
}

/** Esc with Select in hand (entry 5): Move is put down (back to the chosen point, if any), else the chosen point; true when it acted. */
export function escapeGeometry(host: EditingHost): boolean {
    const pick = host.state.geometry;
    if (!pick || host.state.studio.tool !== null) {
        return false;
    }
    host.setState((prev) => (prev.geometry === null ? null
        : { geometry: prev.geometry.moving && prev.geometry.index !== null
            ? { itemId: prev.geometry.itemId, index: prev.geometry.index, moving: false } : null }));
    return true;
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
    } else if (context.mode === DRAW_MODE_SELECT) {
        onHandleFinish(host, id, context.action);
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
 * selection and Details opens with Name focused (the confirmation: no toast follows, entry 23, owner 2026-11-05; the
 * header says Saved), and Terra Draw's copy goes once the unsaved layer draws it. The tool stays in hand for the next one.
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
