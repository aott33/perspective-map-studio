/**
 * The drawing tools (epic 4 entries 1 and 2; epic 1 story 1, epic 3 entry 14): Terra Draw on the
 * MapLibre adapter with two modes, the spike's line tool (the Draw a line toggle's state, draw.ts, a
 * finished line saved through the write path and its drawn copy dropped once the unsaved layer draws
 * it) and entry 2's Point tool (Terra Draw's point mode with `editable`: one click places a point,
 * saved at once as the kind list's first point kind, and a drag of the placed pin saves one update per
 * drag end; the tool stays in hand until Esc or Select). Escape leaves the tool in hand, and every
 * tool is off while map.load says the map store is unreachable. DOM-bound (Terra Draw, the map
 * container's keydown); every function takes the component as its host (EditingHost names the fields
 * and callbacks it reads), and the state is the component's: the DrawState and the studio model
 * (studio.ts) are written together through its `drawingState` and `pointToolState`, in a functional
 * setState. The spike's toggle stays gated by the `editMode` prop at every level (0.3.0's behaviour,
 * which the suite's viewer and phone refusal tests rely on) until entry 4's toolbar replaces it.
 */

import { Map as MapLibreMap } from 'maplibre-gl';
import { TerraDraw, TerraDrawLineStringMode, TerraDrawPointMode } from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import type { MapStudioState, Props } from './MapStudio';
import { MapStudioStoreDelegate } from './MapStudioStoreDelegate';
import { DrawControl } from './DrawControl';
import { DRAW_MODE_LINE, DRAW_MODE_OFF, DrawState, cancelDrawing, finishLine, startDrawing } from './draw';
import { Selection } from './features';
import { isPlacing } from './studio';
import { drawColor } from './theme';

/** Terra Draw's point mode, the Point tool's (entry 2). */
export const DRAW_MODE_POINT = 'point';

/** What the tools read and write on the component. */
export interface EditingHost {
    readonly props: Readonly<Props>;
    readonly state: Readonly<MapStudioState>;
    setState<K extends keyof MapStudioState>(
        state: Pick<MapStudioState, K> | ((prev: Readonly<MapStudioState>) => Pick<MapStudioState, K>), callback?: () => void): void;
    mapContainer: HTMLDivElement | null;
    /** Terra Draw, the Draw a line toggle (the editMode prop's) and the drawn features queued for the unsaved layer. */
    draw: TerraDraw | null;
    drawControl: DrawControl | null;
    queuedFeatures: Array<string | number>;
    /** The Point tool's placed pins, Terra Draw's feature id to the map item's id, kept while the tool is in hand for the drag. */
    placedPoints: Map<string | number, string>;
    /** The item whose Details opens with the cursor in Name (the pad just placed), or null. */
    focusNameId: string | null;
    /** The component's stable callbacks Terra Draw's finish event and the container's keydown take. */
    onDrawFinish: (id: string | number, context: { mode: string; action: string }) => void;
    onKeyDown: (ev: KeyboardEvent) => void;
    /** A draw state with the studio model that goes with it (studio.ts), built from the pending state, for a functional setState. */
    drawingState(prev: Readonly<MapStudioState>, state: DrawState): Pick<MapStudioState, 'drawing' | 'linePoints' | 'studio'>;
    /** The Point tool picked up or put down (and the line tool cancelled) with the studio model, from the pending state. */
    pointToolState(prev: Readonly<MapStudioState>, on: boolean): Pick<MapStudioState, 'drawing' | 'linePoints' | 'studio'>;
    /** A selection with the studio model that goes with it (studio.ts), from the pending state. */
    selectionState(prev: Readonly<MapStudioState>, selected: Selection | null): Pick<MapStudioState, 'selected' | 'studio'>;
    /** Close the open popup, card or sheet (selection.tsx): a placed point takes the selection. */
    closePopup: () => void;
    /** A finished line is queued and drawn from the unsaved layer: remove Terra Draw's copy of it (itemsLayer.ts). */
    dropQueuedFeatures(): void;
}

/**
 * Terra Draw on the MapLibre adapter, started after the map's own layers so
 * its `td-*` layers draw above them. It idles in the `static` mode and only
 * the toggle enters `linestring` (or the Point tool `point`), so the point click round trip keeps the
 * map's clicks while no tool is on. Styles come from theme tokens
 * converted to hex (AD-11); a token that does not resolve leaves that key
 * to the library default, with one warning from drawColor.
 */
export function startTerraDraw(host: EditingHost, map: MapLibreMap, root: HTMLElement | undefined): void {
    const line = drawColor(root, ['--label', '--neutral-70']);
    const outline = drawColor(root, ['--neutral-20', '--containerRoot', '--container']);
    const selection = drawColor(root, ['--callToAction']);
    const styles: { [key: string]: string | number } = {
        lineStringWidth: 4,
        closingPointWidth: 6,
        closingPointOutlineWidth: 2
    };
    if (line) {
        styles.lineStringColor = line;
        styles.closingPointColor = line;
    }
    if (outline) {
        styles.closingPointOutlineColor = outline;
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
    const draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map }),
        modes: [new TerraDrawLineStringMode({ styles }), new TerraDrawPointMode({ editable: true, styles: pointStyles })]
    });
    draw.on('finish', host.onDrawFinish);
    draw.start();
    host.draw = draw;
    if (host.mapContainer) {
        // Capture phase, so Escape leaves the tool even after Terra Draw has
        // cleaned up its provisional line.
        host.mapContainer.addEventListener('keydown', host.onKeyDown, true);
    }
}

/** Every tool is off while map.load says the store is unreachable; a drawing in progress is cancelled, a placed pin dropped. */
export function applyEditing(host: EditingHost): void {
    const off = !!host.props.delegate && host.props.delegate.editing === 'off';
    if (host.drawControl) {
        host.drawControl.setDisabled(off);
    }
    if (off && host.state.drawing && host.draw) {
        host.draw.setMode(DRAW_MODE_OFF);
        setDrawState(host, cancelDrawing());
    }
    if (off && isPlacing(host.state.studio)) {
        putToolDown(host);
    }
}

export function toggleDrawing(host: EditingHost): void {
    if (!host.draw || (host.props.delegate && host.props.delegate.editing === 'off')) {
        return;
    }
    if (host.state.drawing) {
        host.draw.setMode(DRAW_MODE_OFF);
        setDrawState(host, cancelDrawing());
    } else {
        // The line tool takes the hand from the Point tool: its pins go (their items are saved already).
        clearPlacedPoints(host);
        host.draw.setMode(DRAW_MODE_LINE);
        setDrawState(host, startDrawing());
    }
}

/**
 * The Point tool picked up (entry 2): Terra Draw's point mode, the line tool cancelled. One click
 * places a point and saves it; a drag of the pin moves it; the tool stays until Esc or Select.
 */
export function pickPointTool(host: EditingHost): void {
    if (!host.draw || (host.props.delegate && host.props.delegate.editing === 'off')) {
        return;
    }
    host.draw.setMode(DRAW_MODE_POINT);
    host.setState((prev) => host.pointToolState(prev, true));
    if (host.drawControl) {
        host.drawControl.setPressed(false);
    }
}

/** Select: every tool put down, Terra Draw idle, the placed pins gone (their items are saved). */
export function putToolDown(host: EditingHost): void {
    if (host.draw) {
        host.draw.setMode(DRAW_MODE_OFF);
    }
    clearPlacedPoints(host);
    host.setState((prev) => host.pointToolState(prev, false));
    if (host.drawControl) {
        host.drawControl.setPressed(false);
    }
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

export function onDrawFinish(host: EditingHost, id: string | number, context: { mode: string; action: string }): void {
    if (!host.draw) {
        return;
    }
    if (context.mode === DRAW_MODE_POINT) {
        onPointFinish(host, id, context.action);
        return;
    }
    if (context.mode !== DRAW_MODE_LINE) {
        return;
    }
    const feature = host.draw.getSnapshotFeature(id);
    const geometry = feature ? feature.geometry : undefined;
    const points = geometry && geometry.type === 'LineString' ? geometry.coordinates.length : 0;
    host.draw.setMode(DRAW_MODE_OFF);
    setDrawState(host, finishLine(points));
    console.info('[MapStudio] Line drawn with Terra Draw: ' + points + ' points, id ' + id);
    // Save the finished line through the write path (edits.apply); the Gateway checks the role.
    const delegate = host.props.store.delegate as MapStudioStoreDelegate | undefined;
    if (delegate && geometry && geometry.type === 'LineString') {
        const coordinates = geometry.coordinates.map((c) => [c[0], c[1]] as [number, number]);
        delegate.sendLineCreate(coordinates);
        host.queuedFeatures.push(id);
        // After Terra Draw's finish handler has returned; componentDidUpdate may do it first.
        setTimeout(() => host.dropQueuedFeatures(), 0);
    }
}

/**
 * The Point tool's finish (entry 2): a click placed a pin (`draw`), saved at once as the kind list's
 * first point kind with the kind's name as its placeholder, selected, and Details opens with Name
 * focused; a drag end (any other action) moved a placed pin, saved as one update of its item's
 * geometry. The pin stays on the map for more fine-tuning while the tool is in hand.
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
    if (action === 'draw') {
        const itemId = delegate.createPoint(lngLat);
        if (itemId === null) {
            try {
                draw.removeFeatures([id]);
            } catch (err) {
                // Already gone.
            }
            return;
        }
        host.placedPoints.set(id, itemId);
        host.focusNameId = itemId;
        // The new item takes the selection (an open popup goes); its Details open beside the map.
        host.closePopup();
        host.setState((prev) => ({ ...host.selectionState(prev, { id: itemId, kind: 'point' }), pick: null }));
        console.info('[MapStudio] Point placed with the Point tool: ' + itemId + ' at ' + lngLat[0].toFixed(6) + ', ' + lngLat[1].toFixed(6));
        return;
    }
    const itemId = host.placedPoints.get(id);
    if (!itemId) {
        return;
    }
    delegate.moveItem(itemId, lngLat);
}

/** Escape on the map container leaves the tool in hand (the popup's Esc is selection.tsx's). */
export function onKeyDown(host: EditingHost, ev: KeyboardEvent): void {
    if (ev.key !== 'Escape') {
        return;
    }
    if (host.state.drawing && host.draw) {
        host.draw.setMode(DRAW_MODE_OFF);
        setDrawState(host, cancelDrawing());
    } else if (isPlacing(host.state.studio)) {
        putToolDown(host);
    }
}

export function setDrawState(host: EditingHost, state: DrawState): void {
    host.setState((prev) => host.drawingState(prev, state));
    if (host.drawControl) {
        host.drawControl.setPressed(state.drawing);
    }
}
