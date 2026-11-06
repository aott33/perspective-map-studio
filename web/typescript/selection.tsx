/**
 * The selection and the popups (epic 4 entry 1, the component split): a click on the map (a marker's
 * popup or a shared marker's pick list, a line's popup at the clicked segment, the ground clearing
 * the selection), the MapLibre popup made once and moved between points with its content a React
 * portal (a card, or below 768 px a point's bottom sheet in the component, epic 3 entry 8), its
 * placement inside the map (item 18, popupPlacement.ts), the content a popup shows (the kind setup's
 * custom view, the default popup or the line popup, AD-7), the Esc that closes it (item 14), the
 * popup.open and popup.close the Gateway is told, the selection attributes the e2e suite reads, and
 * (epic 4 entry 2, contract 0.4.0) the page's window on the selection: `selectedItem` written to the
 * component's props and `onItemSelected` fired with the AD-7 map item object on every selection
 * change, in `publishSelection`, which every selection path reaches. In Edit mode (epic 4 entry 26, the owner's choice A;
 * EXPERIENCE.md Select) no popup, line popup or sheet opens: every way into one (a marker, a line, a pick list's row, the
 * restore of a remembered place, a choice), and a click on an area, selects the item and opens Details instead
 * (`selectWithDetails`), the item keeping its place on the page as Details docks; entering Edit mode closes an open one
 * and keeps the selection (`dismissPopup`).
 * DOM-bound (the popup's element is measured, the sheet is focused); every function takes the
 * component as its host (SelectionHost names the fields and callbacks it reads), and the component
 * keeps the state: `popup`, `pick` and `selected` are its React state, written here through its
 * `setState`, and the stable callbacks the popup components and MapLibre take (`closePopup`,
 * `navigate`, `onPick`, `onPopupClosed`) are its own fields, which call back in here.
 */

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { PageStore } from '@inductiveautomation/perspective-client';
import { Map as MapLibreMap, MapLayerMouseEvent, MapMouseEvent, Popup } from 'maplibre-gl';
import type { MapStudioState, Props } from './MapStudio';
import { MapStudioStoreDelegate } from './MapStudioStoreDelegate';
import { MapItemRecord } from './contract';
import { DefaultPopup } from './DefaultPopup';
import { SegmentRef, Selection } from './features';
import { lengthM } from './geometry';
import { instrumentsOn } from './geometry';
import { LegendControl } from './LegendControl';
import { LinePopup } from './LinePopup';
import { popupInstruments, popupNodes } from './linePopup';
import { displayShows, iconKpiOf, itemState } from './live';
import { unsavedItems } from './unsaved';
import {
    LAYER_AREA_FILL, LAYER_AREA_LINE, LAYER_AREA_LINE_DASHED, LAYER_ITEM_LINES, LAYER_ITEM_LINES_DASHED, LAYER_ITEM_LINES_DOTTED, LAYER_ITEM_MARKERS
} from './mapLayers';
import { NeedsYouControl } from './NeedsYouControl';
import { PickList, PickRow } from './PickList';
import { PointPopup } from './PointPopup';
import {
    LINE_POPUP_PX, MAP_ITEM_PARAM, POPUP_WIDTH_PX, PopupPoint, fillLink, fillParams, isSheetWidth, popupItemView, popupMaxHeight, popupMountPath,
    popupViewParams, sheetBasisWidth
} from './popupParams';
import { CameraPadding, PagePlace, PopupAnchor, Rect, insideMap, intoView, pageShift, placePopup, placedMaxWidth } from './popupPlacement';
import { SearchControl } from './SearchControl';
import { ZoomControl } from './ZoomControl';

/**
 * The popup that is open: the clicked point (or line, entry 2) with its map coordinates, as a card or
 * a bottom sheet (a point's below 768 px, entry 8), and for a line the clicked segment.
 */
export interface OpenPopup {
    point: PopupPoint;
    lngLat: [number, number];
    /** A line's popup (entry 2): the line popup at the clicked segment, always a card. */
    line: boolean;
    segment: SegmentRef | null;
    /** Below 768 px a point's popup is a bottom sheet in the component, not a MapLibre popup (epic 3 entry 8). */
    sheet: boolean;
    /** When it opened (the clock), so a custom view waits briefly for the popup detail before it fills its params. */
    openedAt: number;
}

/** The pick list a shared marker opened (epic 3 entry 7): its rows at the marker's place. */
export interface OpenPick {
    rows: PickRow[];
    lngLat: [number, number];
}

/** How long a custom popup view waits for the popup detail (the base path) before it opens without it. */
const POPUP_DETAIL_WAIT_MS = 2000;
/** The sheet keeps the selected marker at least this far above its top edge. */
const SHEET_CLEARANCE_PX = 48;
/** The popup's offset from the point: the disc radius and the ring, so the tip touches the disc. */
const POPUP_OFFSET_PX = 22;
/** How often an open popup's data ages are redrawn. */
const POPUP_CLOCK_MS = 5000;
/**
 * The margin round an item the docked Details panel covered, once it is brought into view inside the camera padding (epic 4
 * entry 26): Fit's margin round every item (camera.ts FIT_ITEMS_PADDING_PX), so its disc and name show whole.
 */
const IN_VIEW_MARGIN_PX = 48;

/** What the selection and the popups read and write on the component. */
export interface SelectionHost {
    readonly props: Readonly<Props>;
    readonly state: Readonly<MapStudioState>;
    setState<K extends keyof MapStudioState>(
        state: Pick<MapStudioState, K> | ((prev: Readonly<MapStudioState>) => Pick<MapStudioState, K>), callback?: () => void): void;
    map: MapLibreMap | null;
    mapContainer: HTMLDivElement | null;
    /** The MapLibre popup, created once and moved between points; the DOM node React renders its content into. */
    popup: Popup | null;
    popupContent: HTMLDivElement | null;
    /** The interval that moves an open popup's data ages, or null. */
    popupClock: ReturnType<typeof setInterval> | null;
    /** The side the open card's tip is on (item 18), for the camera padding; null while no card is open. */
    popupAnchor: PopupAnchor | null;
    /** What opened the popup (item 14): Esc returns the focus there; null for a click on the map. */
    openedBy: 'search' | 'needsyou' | null;
    /** The selection last written to the page (the item's id, '' for none), so a redraw with the same selection writes nothing. */
    publishedSelection: string;
    zoomControl: ZoomControl | null;
    searchControl: SearchControl | null;
    needsYouControl: NeedsYouControl | null;
    legendControl: LegendControl | null;
    liveItem(id: string): MapItemRecord | undefined;
    anchorFor(id: string, lngLat: [number, number]): [number, number];
    /** A selection with the studio model that goes with it (studio.ts), built from the pending state, for a functional setState. */
    selectionState(prev: Readonly<MapStudioState>, selected: Selection | null): Pick<MapStudioState, 'selected' | 'studio' | 'panel' | 'geometry'>;
    /**
     * Whether the studio's surfaces show (epic 4 entry 2): Edit mode at level `full`, 768 px and wider. A click then selects and opens
     * Details, with no popup (entry 26).
     */
    studioOn(): boolean;
    /** Watches the card's content size, and the size it was last placed at. */
    popupSizeObserver: ResizeObserver | null;
    placedCardSize: string;
    /** A control's rectangle in map pixels (camera.ts), for the card's placement. */
    controlRect(selector: string): Rect | null;
    /** The camera padding of the moment (camera.ts): what an item brought into view as Details docks keeps clear of (entry 26). */
    cameraPadding(): CameraPadding;
    /** The component's stable callbacks: the popups' close and page link, the pick list's row, MapLibre's close event. */
    closePopup: () => void;
    navigate: (path: string) => void;
    onPick: (id: string) => void;
    onPopupClosed: () => void;
}

/**
 * Esc anywhere in the component closes the open popup, card, sheet or pick list (owner review notes
 * item 14) and returns the focus to the map, or to the search field or the Needs you bar that opened
 * it; with none open it closes Details. The controls that handle Esc themselves (the search list, the
 * Needs you list, the legend) stop the event before it gets here, and the draw tool's own Esc runs on the
 * map container and marks the event handled once it has put the tool down (editing.ts `onKeyDown`, epic 4
 * entry 26), so the same press closes nothing here: one press, one step, and a second Esc closes Details.
 */
export function onRootKeyDown(host: SelectionHost, ev: React.KeyboardEvent<HTMLDivElement>): void {
    if (ev.key !== 'Escape' || ev.defaultPrevented || host.state.studio.tool !== null) {
        // A tool in hand takes Esc on the map container (editing.ts), which marks it handled; a field's own Esc stops before here.
        return;
    }
    if (host.state.popup === null && host.state.pick === null) {
        if (host.state.panel !== null) {
            // The Details panel closes with close or Esc (EXPERIENCE.md Properties panel, epic 4 entry 2): the selection goes.
            ev.preventDefault();
            clearSelection(host);
            if (host.map) {
                host.map.getCanvas().focus({ preventScroll: true });
            }
        }
        return;
    }
    ev.preventDefault();
    const openedBy = host.openedBy;
    closePopup(host);
    if (openedBy === 'search' && host.searchControl) {
        host.searchControl.focusInput();
    } else if (openedBy === 'needsyou' && host.needsYouControl) {
        host.needsYouControl.focusBar();
    } else if (host.map) {
        host.map.getCanvas().focus({ preventScroll: true });
    }
}

/**
 * A marker clicked: its popup opens (in Edit mode its Details instead, entry 26, through `openPopup`) and the point
 * click round trip goes to the Gateway either way.
 */
export function onPointClick(host: SelectionHost, ev: MapLayerMouseEvent): void {
    if (host.state.studio.tool !== null) {
        // The click belongs to the tool in hand (the Point, Line or Area tool).
        return;
    }
    const feature = ev.features && ev.features[0];
    const pointId = feature && feature.properties ? feature.properties.id : undefined;
    if (typeof pointId !== 'string') {
        return;
    }
    const kindId = feature && feature.properties && typeof feature.properties.kind === 'string' ? feature.properties.kind : '';
    const name = feature && feature.properties && typeof feature.properties.name === 'string'
        ? feature.properties.name : '';
    const geometry = feature ? feature.geometry : undefined;
    const lngLat: [number, number] = geometry && geometry.type === 'Point'
        ? [geometry.coordinates[0], geometry.coordinates[1]]
        : [ev.lngLat.lng, ev.lngLat.lat];
    host.openedBy = null;
    openPopup(host, popupPoint(host, pointId, name, kindId), lngLat);

    const delegate = host.props.store.delegate as MapStudioStoreDelegate | undefined;
    if (!delegate) {
        console.warn('[MapStudio] No delegate; the click on ' + pointId + ' was not sent.');
        return;
    }
    delegate.sendPointClick(pointId);
}

/**
 * A click on the map: a marker opens its popup (a shared marker its pick list) and selects the
 * item; a line selects it (its casing and flow arrow) and opens its popup; the ground clears the
 * selection and closes the popup (the template's docs/map.md section 5 item 9). In Edit mode a
 * marker or a line opens Details instead of a popup (entry 26), a shared marker still its pick
 * list, an area (after the markers and the lines, as it is drawn under them) is selected with
 * Details as a list row selects one, and the ground closes Details as it clears the selection;
 * View mode's area click stays a click on the ground. MapLibre's own closeOnClick is not used:
 * it runs after the layer click handler and would close the popup that a click on another point
 * has just moved.
 */
export function onMapClick(host: SelectionHost, ev: MapMouseEvent): void {
    if (host.state.studio.tool !== null || !host.map) {
        // A tool in hand (the Point, Line or Area tool; entries 2 and 4) owns the click.
        return;
    }
    // A click on the map closes the legend panel (entry 14) and the Needs you list (entry 3); the legend docked in the
    // rail's Layers surface is never open (epic 4 entry 22), so it stays.
    if (host.legendControl && host.legendControl.isOpen()) {
        host.legendControl.close(false);
    }
    if (host.needsYouControl && host.needsYouControl.isOpen()) {
        host.needsYouControl.close(false);
    }
    const map = host.map;
    const onPoint = map.queryRenderedFeatures(ev.point, { layers: [LAYER_ITEM_MARKERS] });
    if (onPoint.length > 0) {
        // A click on a marker: the point click round trip and the popup, once. A marker image is
        // wider than its disc, so when two markers overlap the click goes to the point whose
        // position is nearest to it, not to whichever MapLibre lists first.
        let nearest = onPoint[0];
        let best = Number.POSITIVE_INFINITY;
        for (const f of onPoint) {
            const g = f.geometry;
            if (!g || g.type !== 'Point') {
                continue;
            }
            const p = map.project([g.coordinates[0], g.coordinates[1]]);
            const d = (p.x - ev.point.x) * (p.x - ev.point.x) + (p.y - ev.point.y) * (p.y - ev.point.y);
            if (d < best) {
                best = d;
                nearest = f;
            }
        }
        const props = (nearest.properties || {}) as Record<string, unknown>;
        if (Number(props.members) > 1 && nearest.geometry.type === 'Point') {
            openPick(host, String(props.memberIds || ''), [nearest.geometry.coordinates[0], nearest.geometry.coordinates[1]]);
            return;
        }
        onPointClick(host, { ...ev, features: [nearest] } as MapLayerMouseEvent);
        return;
    }
    const pad = 4;
    const onLine = map.queryRenderedFeatures(
        [[ev.point.x - pad, ev.point.y - pad], [ev.point.x + pad, ev.point.y + pad]],
        { layers: [LAYER_ITEM_LINES, LAYER_ITEM_LINES_DASHED, LAYER_ITEM_LINES_DOTTED] });
    const lineProps = onLine.length > 0 && onLine[0].properties ? onLine[0].properties : null;
    const lineId = lineProps ? lineProps.id : undefined;
    if (typeof lineId === 'string') {
        // The clicked feature is one segment of the line (features.ts): its from and to name the popup's segment.
        const segment: SegmentRef | null = lineProps && typeof lineProps.from === 'string' && typeof lineProps.to === 'string'
            ? { fromId: lineProps.from, toId: lineProps.to } : null;
        openLinePopup(host, lineId, segment, [ev.lngLat.lng, ev.lngLat.lat]);
        return;
    }
    if (host.studioOn()) {
        // An area (a line kind with `area: true`, features.ts `areas`): its fill, or its outline for one with no tint, whose fill
        // is drawn at no opacity and still takes the click. Selected as a line is, for a non-point (features.ts Selection).
        const onArea = map.queryRenderedFeatures(
            [[ev.point.x - pad, ev.point.y - pad], [ev.point.x + pad, ev.point.y + pad]],
            { layers: [LAYER_AREA_FILL, LAYER_AREA_LINE, LAYER_AREA_LINE_DASHED] });
        const areaId = onArea.length > 0 && onArea[0].properties ? onArea[0].properties.id : undefined;
        if (typeof areaId === 'string') {
            selectWithDetails(host, { id: areaId, kind: 'line', segment: null }, [ev.lngLat.lng, ev.lngLat.lat]);
            return;
        }
    }
    clearSelection(host);
}

/** A line clicked: selected (casing, flow arrow, Return), the popup closed. */
export function selectLine(host: SelectionHost, id: string, segment: SegmentRef | null = null): void {
    closePopup(host);
    host.setState((prev) => ({ ...host.selectionState(prev, { id, kind: 'line', segment }), pick: null }));
    console.info('[MapStudio] Line ' + id + ' selected.');
}

/**
 * In Edit mode (the studio on: level `full`, 768 px and wider; epic 4 entry 26, the owner's choice A, EXPERIENCE.md Select) a
 * click selects the item and opens Details, as a list row does (`MapStudio.onRowSelect`), and no popup, line popup or sheet
 * opens: one still open (a pick list whose row was chosen) closes, the Gateway told with popup.close as when it is closed by
 * hand, and no popup.open is sent. Nothing covers the item, so a point drags at once and a line or an area shows its handles
 * (entry 5, editing.ts). `lngLat` is the clicked place (a marker's, or the spot on a line or an area), which keeps its place on
 * the page as Details docks (`keepPlace`). A line is selected with no segment, the segment being its popup's.
 */
export function selectWithDetails(host: SelectionHost, selected: Selection, lngLat: [number, number]): void {
    host.openedBy = null;
    closePopup(host);
    const id = selected.id;
    // Where the clicked place is on the page before Details docks: once the stage has narrowed, the map is panned to put it back.
    const before = pagePlace(host, lngLat);
    host.setState((prev) => ({ ...host.selectionState(prev, selected), pick: null, panel: id }), () => {
        if (before) {
            keepPlace(host, before, lngLat);
        }
    });
    console.info('[MapStudio] ' + (selected.kind === 'line' ? 'Line ' : 'Point ') + id + ' selected in Edit mode, Details open.');
}

/** The map's box on the page and a place's pixel in the map, now; null before the map is made. */
function pagePlace(host: SelectionHost, lngLat: [number, number]): PagePlace | null {
    if (!host.map || !host.mapContainer) {
        return null;
    }
    const r = host.mapContainer.getBoundingClientRect();
    const at = host.map.project(lngLat);
    return { box: { x: r.left, y: r.top, w: r.width, h: r.height }, at: { x: at.x, y: at.y } };
}

/**
 * The camera as an Edit-mode click docks Details (entry 26, the plan's Design Notes): the panel docks left of the stage, which
 * narrows, and MapLibre keeps its centre, so every item would slide about half the panel's width (some 160 px at 1366) away
 * from the pointer and a press where the item was clicked would land on the ground. Once the stage has narrowed (this runs
 * after the render that docked it), the map takes its new size at once and is panned with no animation by the clicked place's
 * shift on the page, so it, and every other item, keeps its page position and stays under the pointer: it drags at once.
 * If it then lies outside the stage (the docked panel covers it, or it was outside already, as a popup restored in Edit mode
 * from a centre saved for a wider map can be), the map pans just enough, inside the camera padding, to bring it into view
 * (EXPERIENCE.md Responsive, 1366: opening properties keeps the selection in view). A click while Details is already open
 * docks nothing, and nothing moves.
 */
function keepPlace(host: SelectionHost, before: PagePlace, lngLat: [number, number]): void {
    const map = host.map;
    const el = host.mapContainer;
    if (!map || !el) {
        return;
    }
    const r = el.getBoundingClientRect();
    const box: Rect = { x: r.left, y: r.top, w: r.width, h: r.height };
    if (box.x === before.box.x && box.y === before.box.y && box.w === before.box.w && box.h === before.box.h) {
        return;
    }
    // Now, not on the resize observers' later turn (theirs then finds the size already taken, and the centre stays).
    map.resize();
    const shift = pageShift(before, { box, at: map.project(lngLat) });
    if (shift[0] !== 0 || shift[1] !== 0) {
        map.panBy(shift, { animate: false });
    }
    const container = map.getContainer();
    const at = map.project(lngLat);
    // The marker's disc (its radius and ring) inside the stage counts as in view.
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!insideMap(at, width, height, POPUP_OFFSET_PX)) {
        const pan = intoView(at, width, height, host.cameraPadding(), IN_VIEW_MARGIN_PX);
        if (pan[0] !== 0 || pan[1] !== 0) {
            map.panBy(pan, { duration: 200 });
        }
    }
}

/**
 * A line clicked (entry 2, AD-7): its default popup at the clicked segment, the line selected with
 * that segment (the instruments at its ends highlighted), the Gateway told with popup.open
 * {itemId, segment}. A line whose kind shows nothing and that carries no instrument is only
 * selected, as before. In Edit mode the line is selected with Details open and no popup (entry 26).
 */
export function openLinePopup(host: SelectionHost, id: string, segment: SegmentRef | null, lngLat: [number, number]): void {
    if (host.studioOn()) {
        selectWithDetails(host, { id, kind: 'line', segment: null }, lngLat);
        return;
    }
    const delegate = host.props.delegate;
    const item = host.liveItem(id);
    if (!host.map || !delegate || !item || item.geometry.type !== 'LineString') {
        selectLine(host, id, segment);
        return;
    }
    const display = delegate.live.display[item.kind];
    const instruments = instrumentsOn(delegate.items, id);
    const shows = (display && (!!display.popupView || displayShows(display))) || instruments.length > 0;
    if (!shows) {
        selectLine(host, id, segment);
        return;
    }
    if (!instruments.some((i) => iconKpiOf(delegate.live.display[i.kind]) !== null)) {
        // A line with no measuring instrument has no segment to show or to highlight (owner review notes item 17).
        segment = null;
    }
    host.openedBy = null;
    const store = host.props.store.delegate as MapStudioStoreDelegate | undefined;
    const before = host.state.popup;
    if (before && before.point.id !== id && store) {
        store.sendPopupClose(before.point.id);
    }
    if (store) {
        // A new segment of the same line is a new popup.open too: the Gateway keeps the latest.
        store.sendPopupOpen(id, segment);
    }
    startPopupClock(host);
    // The line popup is a card at every width (entry 2's placement; the bottom sheet is a point's,
    // entry 8), so a point's open sheet simply gives way to it.
    const now = Date.now();
    host.setState((prev) => ({
        popup: { point: { ...popupPoint(host, id, item.name, item.kind) }, lngLat, line: true, segment, sheet: false, openedAt: now },
        pick: null, ...host.selectionState(prev, { id, kind: 'line', segment }), clock: now
    }), () => showPopupAt(host, lngLat, LINE_POPUP_PX));
    console.info('[MapStudio] Line ' + id + ' selected' + (segment ? ' at ' + segment.fromId + ' to ' + segment.toId : '') + '.');
}

/** The ground tapped: the selection and the popup go. */
export function clearSelection(host: SelectionHost): void {
    closePopup(host);
    if (host.state.selected !== null || host.state.pick !== null) {
        host.setState((prev) => ({ ...host.selectionState(prev, null), pick: null }));
    }
}

/**
 * The map item the popup is opened for: the clicked feature's id, name and kind, with the asset
 * link and the properties from the item record (what the placeholders fill from, entry 8).
 */
export function popupPoint(host: SelectionHost, id: string, name: string, kind: string): PopupPoint {
    const item = host.liveItem(id);
    return {
        id, name: item ? item.name : name, kind: item ? item.kind : kind,
        assetId: item ? item.assetId : null, properties: item ? item.properties : {}
    };
}

/**
 * Close the open popup, card or sheet (every popup's own close button, the default popup's, the
 * line popup's and the custom view's row): the MapLibre popup's close event does the rest for a
 * card (onPopupClosed); a sheet has no MapLibre popup, so its state goes here.
 */
export function closePopup(host: SelectionHost): void {
    if (host.popup && host.popup.isOpen()) {
        host.popup.remove();
        return;
    }
    if (host.state.popup !== null && host.state.popup.sheet) {
        onPopupClosed(host);
    }
}

/**
 * Open a page of the project (the popup's pop-out link, View alarms): the Perspective client's
 * own history, so the session stays and the page's URL params fill from the path (a filled
 * link is checked to be a page path before it gets here, popupParams.ts). A failure is one
 * console warning; nothing else happens.
 */
export function navigate(host: SelectionHost, path: string): void {
    try {
        const client = host.props.store.view.page.parent as unknown as { history?: { push?: (p: string) => void } };
        if (client && client.history && typeof client.history.push === 'function') {
            client.history.push(path);
            return;
        }
        console.warn('[MapStudio] The page ' + path + ' could not be opened: the session has no history.');
    } catch (err) {
        console.warn('[MapStudio] The page ' + path + ' could not be opened: ' + (err instanceof Error ? err.message : String(err)));
    }
}

/**
 * A shared marker clicked (epic 3 entry 7): the pick list of its members opens in the popup. In View mode the selection goes
 * while it is open; in Edit mode (entry 26) it stays, with Details if it is open, so the stage keeps its width.
 */
export function openPick(host: SelectionHost, memberIds: string, lngLat: [number, number]): void {
    const delegate = host.props.delegate;
    if (!delegate) {
        return;
    }
    const rows: PickRow[] = [];
    for (const id of memberIds.split(',')) {
        const item = host.liveItem(id);
        if (!item) {
            continue;
        }
        const kind = delegate.lists.kinds.find((k) => k.id === item.kind);
        const state = itemState(delegate.live.items[item.id], delegate.live.display[item.kind]);
        rows.push({ id: item.id, name: item.name, kindName: kind ? kind.name : item.kind, state: state.badge });
    }
    if (rows.length === 0) {
        return;
    }
    const before = host.state.popup;
    const store = host.props.store.delegate as MapStudioStoreDelegate | undefined;
    if (before && store) {
        store.sendPopupClose(before.point.id);
    }
    stopPopupClock(host);
    if (host.studioOn()) {
        // In Edit mode (entry 26) the selection and an open Details stay while the list is open, so nothing docks or moves.
        host.setState({ popup: null, pick: { rows, lngLat } }, () => showPopupAt(host, lngLat));
        return;
    }
    host.setState((prev) => ({ popup: null, pick: { rows, lngLat }, ...host.selectionState(prev, null) }), () => showPopupAt(host, lngLat));
}

/** A row of the pick list: what a click on that item's own marker does (in Edit mode its Details, entry 26). */
export function onPick(host: SelectionHost, id: string): void {
    const item = host.liveItem(id);
    if (!item || item.geometry.type !== 'Point') {
        return;
    }
    // The popup anchors to the shared marker drawn, not the member's own place (item 20).
    openPopup(host, popupPoint(host, item.id, item.name, item.kind),
        host.anchorFor(item.id, [item.geometry.coordinates[0], item.geometry.coordinates[1]]));
    const store = host.props.store.delegate as MapStudioStoreDelegate | undefined;
    if (store) {
        store.sendPointClick(item.id);
    }
}

/**
 * Open (or move) the MapLibre popup at a point. The popup's DOM node is
 * filled by React through a portal in render(), so the embedded project
 * view stays in this component's React tree. Every way into a point's popup
 * comes here (a marker, a pick list's row, the camera's restore and choices),
 * so in Edit mode this is where the item opens in Details instead (entry 26).
 */
export function openPopup(host: SelectionHost, point: PopupPoint, lngLat: [number, number]): void {
    if (!host.map) {
        return;
    }
    if (host.studioOn()) {
        selectWithDetails(host, { id: point.id, kind: 'point' }, lngLat);
        return;
    }
    if (!hasPopupContent(host, point)) {
        // No parts and no view: no popup (FR-4); the item is selected all the same.
        closePopup(host);
        host.setState((prev) => ({ pick: null, ...host.selectionState(prev, { id: point.id, kind: 'point' }) }));
        return;
    }
    const delegate = host.props.store.delegate as MapStudioStoreDelegate | undefined;
    const before = host.state.popup;
    if (before && before.point.id !== point.id && delegate) {
        delegate.sendPopupClose(before.point.id);
    }
    if (delegate && (!before || before.point.id !== point.id)) {
        delegate.sendPopupOpen(point.id);
    }
    // Below 768 px (the viewport's width, as the stylesheet's phone rules read it: a map docked beside the studio's
    // panels is narrower than that on a laptop, epic 4 entry 2) the popup is a bottom sheet in the component
    // (DESIGN.md Phone); the MapLibre popup, if a card was open, goes without its close event (the state below replaces it).
    const sheet = isSheetWidth(sheetBasisWidth(host.map.getContainer()));
    if (sheet && host.popup && host.popup.isOpen()) {
        host.popup.off('close', host.onPopupClosed);
        host.popup.remove();
        host.popup.on('close', host.onPopupClosed);
    }
    startPopupClock(host);
    const now = Date.now();
    host.setState((prev) => ({ popup: { point, lngLat, line: false, segment: null, sheet, openedAt: now }, pick: null,
        ...host.selectionState(prev, { id: point.id, kind: 'point' }), clock: now }),
    () => (sheet ? showSheetFor(host, lngLat) : showPopupAt(host, lngLat)));
}

/** The sheet is in the DOM: pan the map so the item stays above it (its selection ring visible). */
export function showSheetFor(host: SelectionHost, lngLat: [number, number]): void {
    if (!host.map || !host.mapContainer) {
        return;
    }
    const sheetEl = host.mapContainer.parentElement
        ? host.mapContainer.parentElement.querySelector('.mapstudio-sheet') as HTMLElement | null : null;
    if (!sheetEl) {
        return;
    }
    const height = host.map.getContainer().clientHeight;
    const sheetTop = height - sheetEl.offsetHeight - (parseFloat(getComputedStyle(sheetEl).bottom) || 0);
    const y = host.map.project(lngLat).y;
    const limit = sheetTop - SHEET_CLEARANCE_PX;
    if (y > limit) {
        host.map.panBy([0, y - limit], { duration: 200 });
    }
    // The sheet takes the focus as the card does, so Esc reaches the component (item 14) and the keyboard is inside it.
    sheetEl.focus({ preventScroll: true });
}

/**
 * The MapLibre popup, made once at mount so render() has its portal target from the first popup
 * state on: MapLibre picks the popup's anchor from its content's size when it is placed, so the
 * content must be in the DOM before showPopupAt runs (a popup placed empty stayed centred on
 * its point and ran off a phone's edge once the content came).
 */
export function makePopup(host: SelectionHost): void {
    host.popupContent = document.createElement('div');
    host.popupContent.className = 'mapstudio-popup-root';
    // The card takes the focus itself when it opens (showPopupAt), so the keyboard is inside it (Tab
    // reaches the page link and close) and no button wears a focus ring on a click (entry 15).
    host.popupContent.tabIndex = -1;
    host.popup = new Popup({
        // The close button is the popup's own, in its header (entry 8, UX review P1).
        closeButton: false,
        closeOnClick: false,
        closeOnMove: false,
        focusAfterOpen: false,
        // MapLibre writes maxWidth as an inline style on the popup, so the
        // phone cap lives here, not in the stylesheet.
        maxWidth: 'calc(100vw - 32px)',
        offset: POPUP_OFFSET_PX
    });
    host.popup.setDOMContent(host.popupContent);
    host.popup.on('close', host.onPopupClosed);
    if (typeof ResizeObserver !== 'undefined') {
        // A card whose content grows after it was placed (a custom view that loads, entry 2) is placed again in Edit mode,
        // on the next frame: a placement sets the content's max height, and a size change inside the observer's own
        // delivery is the browser's "ResizeObserver loop" error.
        let scheduled = false;
        host.popupSizeObserver = new ResizeObserver(() => {
            if (scheduled) {
                return;
            }
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                onPopupResized(host);
            });
        });
        host.popupSizeObserver.observe(host.popupContent);
    }
}

/** The card's content changed size: placed again when it differs from the size it was placed at (studio on, a card open). */
function onPopupResized(host: SelectionHost): void {
    const open = host.state.popup;
    if (!open || open.sheet || !host.popupContent || !host.popup || !host.popup.isOpen() || !host.studioOn()) {
        return;
    }
    const card = host.popupContent.firstElementChild as HTMLElement | null;
    const size = card ? card.offsetWidth + 'x' + card.offsetHeight : '';
    if (size === '' || size === host.placedCardSize) {
        return;
    }
    showPopupAt(host, open.lngLat, open.line ? LINE_POPUP_PX : POPUP_WIDTH_PX);
}

/** The stage resized (a panel docked or left, epic 4 entry 2): an open card is placed again in the map's new room. */
export function replacePopup(host: SelectionHost): void {
    const open = host.state.popup;
    if (!open || open.sheet || !host.popup || !host.popup.isOpen()) {
        return;
    }
    showPopupAt(host, open.lngLat, open.line ? LINE_POPUP_PX : POPUP_WIDTH_PX);
}

/**
 * Move the popup to the point (after the state that fills its portal has rendered) and open it,
 * placed inside the map less the top bar and the zoom card (owner review notes item 18): the card
 * is measured in the document with the clamp lifted, `placePopup` picks the anchor (above the point
 * first, so its name label stays clear; else beside, below or a corner), clamps the card to the room
 * when nothing fits whole, and pans the map by what is still missing. Point and line cards alike.
 */
export function showPopupAt(host: SelectionHost, lngLat: [number, number], maxPx: number = POPUP_WIDTH_PX): void {
    if (!host.map || !host.popup) {
        return;
    }
    const map = host.map;
    const at = map.project(lngLat);
    const width = map.getContainer().clientWidth;
    const height = map.getContainer().clientHeight;
    // The card keeps its own width; near an edge it goes beside the point or on a corner (item 18).
    host.popup.setMaxWidth(placedMaxWidth(width, maxPx) + 'px');
    if (!host.popup.isOpen()) {
        // The popup joins the map before it is placed: its content rendered already (the portal), but
        // a card measures 0 px tall until the popup's element is in the document (the first line popup
        // of a page opened above its segment and off the map's top with that 0).
        host.popup.setLngLat(lngLat).addTo(map);
        if (host.popupContent) {
            host.popupContent.focus({ preventScroll: true });
        }
    }
    if (host.popupContent) {
        const content = host.popupContent;
        content.style.setProperty('--mapstudio-popup-max-height', 'none');
        const card = content.firstElementChild as HTMLElement | null;
        const natural = card ? card.offsetHeight : 0;
        const cardWidth = card ? card.offsetWidth : Math.min(maxPx, width);
        // The top bar, the zoom card and, in Edit mode, the floating draw toolbar and its pill (epic 4 entry 2).
        const obstacles = [host.controlRect('.maplibregl-ctrl-top-left'), host.controlRect('.maplibregl-ctrl-top-right'),
            host.controlRect('.mapstudio-toolbar-float')]
            .filter((r): r is Rect => r !== null);
        const placement = placePopup(at, cardWidth, natural, popupMaxHeight(height), width, height, obstacles, POPUP_OFFSET_PX);
        content.style.setProperty('--mapstudio-popup-max-height', placement.maxHeight + 'px');
        host.popup.options.anchor = placement.anchor;
        host.popupAnchor = placement.anchor;
        if (host.mapContainer) {
            host.mapContainer.setAttribute('data-popup-anchor', lngLat[0].toFixed(6) + ',' + lngLat[1].toFixed(6));
            host.mapContainer.setAttribute('data-popup-side', placement.anchor);
        }
        if (placement.shift[0] !== 0 || placement.shift[1] !== 0) {
            // The card still does not fit: the map pans so the point moves by the shift (the popup moves with it).
            map.panBy([-placement.shift[0], -placement.shift[1]], { duration: 200 });
        }
    }
    // setLngLat runs MapLibre's placement again with the anchor chosen and the card at its real size.
    host.popup.setLngLat(lngLat);
    if (host.popupContent) {
        const placed = host.popupContent.firstElementChild as HTMLElement | null;
        host.placedCardSize = placed ? placed.offsetWidth + 'x' + placed.offsetHeight : '';
    }
}

export function startPopupClock(host: SelectionHost): void {
    if (host.popupClock === null) {
        host.popupClock = setInterval(() => host.setState({ clock: Date.now() }), POPUP_CLOCK_MS);
    }
}

export function stopPopupClock(host: SelectionHost): void {
    if (host.popupClock !== null) {
        clearInterval(host.popupClock);
        host.popupClock = null;
    }
}

/**
 * MapLibre closed the popup (close button, map click): unmount the view, tell the Gateway, clear the
 * selection (a point's, and from entry 2 a line's, whose popup the selection opened with).
 */
export function onPopupClosed(host: SelectionHost): void {
    popupGone(host);
    if (host.state.popup !== null) {
        host.setState((prev) => ({ popup: null, pick: null, ...host.selectionState(prev, null) }));
    } else if (host.state.pick !== null) {
        // A pick list alone: the selection is the one it opened over (none in View mode; in Edit mode it stays, entry 26).
        host.setState({ pick: null });
    }
}

/**
 * Edit mode entered (epic 4 entry 26, MapStudio.tsx `setEditMode`: the Edit switch or the page's prop): the open card, line
 * popup, sheet or pick list goes, since Edit mode opens none, and the Gateway is told with popup.close as when it is closed by
 * hand; the selection stays, so the page sees no change of selection (no `selectedItem: null`), and no Details opens for it
 * (`panel` cleared). A line keeps its selection without the segment, whose highlighted instruments were its popup's. Nothing
 * open, nothing happens.
 */
export function dismissPopup(host: SelectionHost): void {
    if (host.state.popup === null && host.state.pick === null) {
        return;
    }
    if (host.popup && host.popup.isOpen()) {
        // The MapLibre popup goes without its close event, whose handler would clear the selection (onPopupClosed).
        host.popup.off('close', host.onPopupClosed);
        host.popup.remove();
        host.popup.on('close', host.onPopupClosed);
    }
    popupGone(host);
    host.setState((prev) => ({
        popup: null, pick: null,
        ...host.selectionState(prev, prev.selected && prev.selected.segment ? { ...prev.selected, segment: null } : prev.selected),
        // No Details for it, even one kept from an earlier Edit-mode session (leaving keeps `panel`, a View-mode click on the
        // same item too).
        panel: null
    }));
    console.info('[MapStudio] Edit mode: the open popup closed, the selection kept.');
}

/** A popup gone (closed, or dismissed as Edit mode is entered): its clock stops, its place is cleared and the Gateway told. */
function popupGone(host: SelectionHost): void {
    stopPopupClock(host);
    host.popupAnchor = null;
    if (host.mapContainer) {
        host.mapContainer.setAttribute('data-popup-anchor', '');
        host.mapContainer.setAttribute('data-popup-side', '');
    }
    const open = host.state.popup;
    if (open !== null) {
        const delegate = host.props.store.delegate as MapStudioStoreDelegate | undefined;
        if (delegate) {
            delegate.sendPopupClose(open.point.id);
        }
    }
}

/**
 * What the open popup shows (AD-7, epic 3 entry 8): the kind setup's custom popup view when it
 * names one, with `mapItem` and its params filled from the item (a missing or failing view
 * falls back to the default popup); else Map Studio's default popup when the kind's display
 * shows something; else nothing (no parts, no popup: FR-4, the item is only selected).
 */
export function popupContentFor(host: SelectionHost, open: OpenPopup): React.ReactNode {
    const store = host.props.store;
    const delegate = host.props.delegate;
    if (!delegate) {
        return null;
    }
    const kindId = open.point.kind || '';
    const display = delegate.live.display[kindId];
    const kind = delegate.lists.kinds.find((k) => k.id === kindId);
    const live = delegate.live.popup && delegate.live.popup.itemId === open.point.id ? delegate.live.popup.detail : null;
    const item = popupItemView(open.point, live ? live.basePath : null);
    const values = delegate.live.items[open.point.id];
    let point = open.point;
    let lineDefault: (() => React.ReactNode) | null = null;
    if (open.line) {
        // A line (entry 2): its default popup with the instruments in order, and for a custom view
        // the map item object carrying them and the open segment (AD-7).
        const line = host.liveItem(open.point.id);
        const nodes = line ? popupNodes(line, delegate.items, delegate.lists.kinds, delegate.live, open.segment) : [];
        point = { ...open.point, instruments: popupInstruments(nodes), segment: open.segment };
        if (line && line.geometry.type === 'LineString') {
            const coords = line.geometry.coordinates;
            lineDefault = (): React.ReactNode => (
                <LinePopup
                    key={'line|' + open.point.id}
                    line={{ id: line.id, name: line.name, kind: line.kind, kindName: kind ? kind.name : line.kind,
                        icon: kind ? kind.icon : 'pipeline', diameter: line.properties ? line.properties.diameter : undefined,
                        lengthM: coords.length >= 2 ? lengthM(coords) : 0 }}
                    display={display}
                    values={values}
                    nodes={nodes}
                    segment={open.segment}
                    now={host.state.clock}
                    onClose={host.closePopup}
                />
            );
        }
        if (!display || !display.popupView) {
            return lineDefault ? lineDefault() : null;
        }
    }
    if (!display) {
        return null;
    }
    const defaultPopup = lineDefault || ((): React.ReactNode => (displayShows(display) ? (
        <DefaultPopup
            key={'default|' + open.point.id}
            item={{ id: open.point.id, name: open.point.name, kind: kindId,
                kindName: kind ? kind.name : kindId, icon: kind ? kind.icon : '' }}
            display={display}
            values={values}
            detail={live}
            now={host.state.clock}
            link={fillLink(display.link, item)}
            alarmPage={fillLink(delegate.alarmPage, item)}
            mode={open.sheet ? 'sheet' : 'card'}
            canEdit={false}
            onClose={host.closePopup}
            onNavigate={host.navigate}
        />
    ) : null));
    if (!display.popupView) {
        return defaultPopup();
    }
    // The custom view: its params may need the base path, which the open's push brings within a
    // moment; the view waits for it (an empty card meanwhile), but not forever.
    if (!live && host.state.clock - open.openedAt < POPUP_DETAIL_WAIT_MS) {
        return <div className="mapstudio-popup mapstudio-popup--waiting" data-point-id={open.point.id} />;
    }
    const mountPath = popupMountPath(store.viewMountPath, store.addressPathString);
    const path = display.popupView.path;
    return (
        <PointPopup
            key={PageStore.instanceKeyFor(path, mountPath) + '|' + open.point.id}
            clientStore={store.view.page.parent}
            parent={store}
            path={path}
            params={popupViewParams(fillParams(display.popupView.params, item), point, live, values)}
            mountPath={mountPath}
            pointId={open.point.id}
            fallback={defaultPopup}
            mode={open.sheet ? 'sheet' : 'card'}
            onClose={host.closePopup}
        />
    );
}

/** True when a popup would show something for the point (its kind's display is known and shows a part or a view). */
export function hasPopupContent(host: SelectionHost, point: PopupPoint): boolean {
    const delegate = host.props.delegate;
    const display = delegate ? delegate.live.display[point.kind || ''] : undefined;
    return !!display && (!!display.popupView || displayShows(display));
}

/**
 * The popup's content in its place: the pick list or the card in the MapLibre popup (a portal
 * into its DOM node), or the bottom sheet in the component below 768 px.
 */
export function renderPopup(host: SelectionHost): React.ReactNode {
    const pick = host.state.pick;
    if (pick && host.popupContent) {
        return ReactDOM.createPortal(<PickList rows={pick.rows} onPick={host.onPick} />, host.popupContent);
    }
    const open = host.state.popup;
    if (!open) {
        return null;
    }
    if (open.sheet) {
        return (
            <div className="mapstudio-sheet" role="dialog" aria-label={open.point.name} data-point-id={open.point.id} tabIndex={-1}>
                {popupContentFor(host, open)}
            </div>
        );
    }
    if (!host.popupContent) {
        return null;
    }
    return ReactDOM.createPortal(popupContentFor(host, open), host.popupContent);
}

/** The event the component fires on every selection change (MapStudioComponent.EVENT_ITEM_SELECTED, contract 0.4.0). */
export const ITEM_SELECTED_EVENT = 'onItemSelected';

/**
 * The selection for the zoom card's Return and the e2e suite: the id and kind, and an open segment's ends (entry 2);
 * and for the page (epic 4 entry 2): `selectedItem` written and `onItemSelected` fired once per change.
 */
export function publishSelection(host: SelectionHost): void {
    const selected = host.state.selected;
    if (host.zoomControl) {
        host.zoomControl.setReturn(selected !== null);
    }
    if (host.mapContainer) {
        host.mapContainer.setAttribute('data-selected', selected ? selected.id : '');
        host.mapContainer.setAttribute('data-selected-kind', selected ? selected.kind : '');
        // The open segment of a selected line and the instruments highlighted at its ends (entry 2).
        const segment = selected && selected.kind === 'line' && selected.segment ? selected.segment : null;
        host.mapContainer.setAttribute('data-segment', segment ? segment.fromId + '|' + segment.toId : '');
        host.mapContainer.setAttribute('data-highlighted', segment ? segment.fromId + ',' + segment.toId : '');
    }
    const key = selected ? selected.id : '';
    if (host.publishedSelection !== key) {
        host.publishedSelection = key;
        publishToPage(host, selected ? selected.id : null);
    }
}

/**
 * The page's window on the selection (epic 4 entry 2, contract 0.4.0, AD-7): the `selectedItem` prop
 * written through the component's property tree (a binding on the page follows it) and the
 * `onItemSelected` component event fired with `{item}`, the AD-7 map item object or null when the
 * selection was cleared. Both at every level: a viewer's page may follow the selection too. The
 * page-to-component direction (the page writing `selectedItem`) is entry 14's: the component never
 * reads the prop back into its model, so its own write coming back changes nothing.
 */
function publishToPage(host: SelectionHost, id: string | null): void {
    const store = host.props.store;
    const item = id !== null ? itemFor(host, id) : undefined;
    const payload = item ? selectedItemObject(host, item) : null;
    try {
        store.props.write('selectedItem', id);
    } catch (err) {
        console.warn('[MapStudio] The selectedItem prop could not be written: ' + (err instanceof Error ? err.message : String(err)));
    }
    try {
        store.componentEvents.fireComponentEvent(ITEM_SELECTED_EVENT, { item: payload });
    } catch (err) {
        console.warn('[MapStudio] The onItemSelected event could not be fired: ' + (err instanceof Error ? err.message : String(err)));
    }
    console.debug('[MapStudio] Selection published to the page: ' + (id === null ? 'none' : id));
}

/** The map item on the map, or the one this page has placed and not yet saved (the Point tool's create in flight). */
function itemFor(host: SelectionHost, id: string): MapItemRecord | undefined {
    const live = host.liveItem(id);
    if (live) {
        return live;
    }
    const delegate = host.props.delegate;
    return delegate ? unsavedItems(delegate.unsaved).find((i) => i.id === id) : undefined;
}

/**
 * The AD-7 map item object for the page (the same a custom popup view gets as `mapItem`, popupParams.ts):
 * the record's id, name, kind, assetId and properties, `basePath` from the popup detail when the item's
 * popup is open, else from the asset list (level `phone` or `full`), `alarmsPath` from the popup detail
 * (null until it was pushed), the last batch's values, and for a line its instruments and open segment.
 */
export function selectedItemObject(host: SelectionHost, item: MapItemRecord): Record<string, unknown> {
    const delegate = host.props.delegate;
    const point: PopupPoint = popupPoint(host, item.id, item.name, item.kind);
    if (item.geometry.type === 'LineString' && delegate) {
        const selected = host.state.selected;
        const segment = selected && selected.id === item.id && selected.segment ? selected.segment : null;
        const nodes = popupNodes(item, delegate.items, delegate.lists.kinds, delegate.live, segment);
        point.instruments = popupInstruments(nodes);
        point.segment = segment;
    }
    const pushed = delegate && delegate.live.popup && delegate.live.popup.itemId === item.id ? delegate.live.popup.detail : null;
    const asset = delegate && delegate.lists.assets && item.assetId !== null ? delegate.lists.assets.find((a) => a.id === item.assetId) : undefined;
    const detail = pushed ? pushed : { basePath: asset ? asset.basePath : null, alarmsPath: null };
    const values = delegate ? delegate.live.items[item.id] : undefined;
    return popupViewParams(null, point, detail, values)[MAP_ITEM_PARAM] as Record<string, unknown>;
}
