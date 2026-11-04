/**
 * The camera and the place (epic 4 entry 1, the component split): where the map opens (the starting
 * area prop, startingArea.ts, or the place this page's map had earlier in the browser session,
 * place.ts), the camera padding of the moment (item 27, popupPlacement.ts), Fit and Return (epic 3
 * entry 7), a search or Needs you choice (entries 9 and 3), the place remembered on every move and
 * selection change and put back once the items have come (owner re-test R4 (a)), and the view,
 * fit and readiness attributes the e2e suite reads. DOM-bound (the map, its controls and the
 * popup's element are measured); every function takes the component as its host (CameraHost names
 * the fields and callbacks it reads), and the component keeps the state: `fitKey`, `itemBounds`,
 * `appliedArea`, `placeKey`, `restore` and `savedSelection` live there, as do `setState` and the
 * selection and popup calls (selection.tsx) a restore or a choice makes.
 */

import { Map as MapLibreMap, Popup } from 'maplibre-gl';
import type { MapStudioState, Props } from './MapStudio';
import { MapItemRecord } from './contract';
import { MapFeatures, SegmentRef } from './features';
import { StartCamera } from './mapLayers';
import { MapStudioStoreDelegate } from './MapStudioStoreDelegate';
import { NeedsYouRow } from './needsyou';
import { Place, placeKey, readPlace, writePlace } from './place';
import { PopupPoint } from './popupParams';
import { CameraPadding, PopupAnchor, Rect, cameraPadding as paddingFor } from './popupPlacement';
import { CHOSEN_POINT_ZOOM, SearchResult } from './search';
import { SearchControl } from './SearchControl';
import { sessionStore } from './legend';
import { FIT_PADDING_PX, StartingArea, readStartingArea, startingAreaKey } from './startingArea';
import { ZoomControl } from './ZoomControl';

/** How long a remembered selection waits for its item and the first full batch (owner re-test R4 (a)). */
export const RESTORE_WAIT_MS = 30_000;
/** Fit's padding round every item (px). */
export const FIT_ITEMS_PADDING_PX = 48;

/** The items' bounds as Fit takes them: west, south, east, north. */
export type Bounds = [number, number, number, number];

/** What the camera reads and writes on the component. */
export interface CameraHost {
    readonly props: Readonly<Props>;
    readonly state: Readonly<MapStudioState>;
    setState<K extends keyof MapStudioState>(state: Pick<MapStudioState, K>, callback?: () => void): void;
    map: MapLibreMap | null;
    mapContainer: HTMLDivElement | null;
    /** The MapLibre popup and its content, measured for the camera padding; the side its tip is on. */
    popup: Popup | null;
    popupContent: HTMLDivElement | null;
    popupAnchor: PopupAnchor | null;
    itemsReady: boolean;
    /** The items' bounds key Fit keeps by, or null while Fit is not in force; the bounds last drawn. */
    fitKey: string | null;
    itemBounds: MapFeatures['bounds'];
    itemBoundsKey: string;
    /** The starting area last applied (startingAreaKey), so a changed prop moves the map once. */
    appliedArea: string;
    /** This map's key in sessionStorage for its place, set at mount; the restore pending; when it was asked for. */
    placeKey: string;
    restore: Place | null;
    restoreSince: number;
    /** The selection and popup last remembered, so a redraw that changed neither writes nothing. */
    savedSelection: string;
    /** Set as the component unmounts: closing the popup and removing the map then must not overwrite the place. */
    unmounting: boolean;
    /** What opened the popup (item 14): Esc returns the focus there; null for a click on the map. */
    openedBy: 'search' | 'needsyou' | null;
    zoomControl: ZoomControl | null;
    searchControl: SearchControl | null;
    liveItem(id: string): MapItemRecord | undefined;
    anchorFor(id: string, lngLat: [number, number]): [number, number];
    /** The selection and popups (selection.tsx), which a restore or a choice opens as a click does. */
    openPopup(point: PopupPoint, lngLat: [number, number]): void;
    popupPoint(id: string, name: string, kind: string): PopupPoint;
    openLinePopup(id: string, segment: SegmentRef | null, lngLat: [number, number]): void;
    selectLine(id: string, segment?: SegmentRef | null): void;
}

/** The starting area the prop names; an invalid one is said once, in the console. */
export function startingArea(host: CameraHost): StartingArea {
    const read = readStartingArea(host.props.props.startingArea);
    const key = startingAreaKey(read.area) + (read.problem || '');
    if (read.problem && key !== host.appliedArea) {
        console.warn('[MapStudio] ' + read.problem);
    }
    return read.area;
}

/**
 * The place this page's map had earlier in the browser session (owner re-test R4 (a)), read at mount:
 * its camera is where the map opens instead of the starting area, and its selection and open popup
 * are put back once the items have come (applyRestore). Sets the place key and the pending restore.
 */
export function rememberedPlace(host: CameraHost, projectName: string | null): Place | null {
    host.placeKey = placeKey(projectName, typeof window !== 'undefined' ? window.location.pathname : '',
        String(host.props.store.addressPathString || ''));
    const place = readPlace(sessionStore(), host.placeKey);
    if (place) {
        host.restore = place.selected ? place : null;
        host.restoreSince = Date.now();
        host.savedSelection = place.selected ? selectionKeyOf(place) : '';
    }
    return place;
}

/** Where the map opens: the remembered place's camera, else the starting area's centre and zoom or its bounds to fit. */
export function startCamera(place: Place | null, area: StartingArea): StartCamera {
    return place
        ? { center: place.center, zoom: place.zoom }
        : area.kind === 'bounds'
            ? { bounds: area.bounds, fitBoundsOptions: { padding: FIT_PADDING_PX } }
            : { center: area.center, zoom: area.zoom };
}

/** A changed startingArea prop moves the map there (once per value). */
export function applyStartingArea(host: CameraHost): void {
    const read = readStartingArea(host.props.props.startingArea);
    const key = startingAreaKey(read.area) + (read.problem || '');
    if (!host.map || key === host.appliedArea) {
        return;
    }
    const area = startingArea(host);
    host.appliedArea = key;
    if (area.kind === 'bounds') {
        host.map.fitBounds(area.bounds, { padding: FIT_PADDING_PX, animate: false });
    } else {
        host.map.jumpTo({ center: area.center, zoom: area.zoom });
    }
}

/** The selection and the open popup as the place keeps them, as one string. */
export function selectionKeyOf(place: Pick<Place, 'selected' | 'popup' | 'popupAt'>): string {
    return JSON.stringify([place.selected, place.popup, place.popupAt]);
}

/** The place now: the camera, the selection and whether its popup is open (a pick list is not kept). */
export function currentPlace(host: CameraHost): Place | null {
    const map = host.map;
    if (!map) {
        return null;
    }
    const c = map.getCenter();
    const sel = host.state.selected;
    const open = host.state.popup;
    const selected = sel ? { id: sel.id, kind: sel.kind, segment: sel.kind === 'line' && sel.segment ? sel.segment : null } : null;
    const popup = !!(sel && open && open.point.id === sel.id);
    return { center: [c.lng, c.lat], zoom: map.getZoom(), selected, popup, popupAt: popup && open && open.line ? open.lngLat : null };
}

/** Remember the place for the browser session (owner re-test R4 (a)); not while a restore is pending or unmounting. */
export function savePlace(host: CameraHost): void {
    if (host.unmounting || host.restore || !host.placeKey) {
        return;
    }
    const place = currentPlace(host);
    if (place) {
        host.savedSelection = selectionKeyOf(place);
        writePlace(sessionStore(), host.placeKey, place);
    }
}

/** The selection or the popup changed: remember the place (a redraw that changed neither writes nothing). */
export function saveSelection(host: CameraHost): void {
    if (host.unmounting || host.restore || !host.map) {
        return;
    }
    const place = currentPlace(host);
    if (place && selectionKeyOf(place) !== host.savedSelection) {
        savePlace(host);
    }
}

/**
 * Put the remembered selection and popup back (owner re-test R4 (a)) once the item is on the map and the first
 * full batch has brought its kind's display: a point's card or sheet opens as a click opens it, a line's popup at
 * the remembered place on the line, or the item is only selected. The camera came back at mount, so nothing here
 * moves it but the popup's own placement. An item that is gone, or that has not come within RESTORE_WAIT_MS, is
 * dropped.
 */
export function applyRestore(host: CameraHost): void {
    const restore = host.restore;
    const delegate = host.props.delegate;
    if (!restore || !restore.selected || !host.map || !host.itemsReady || !delegate) {
        return;
    }
    const sel = restore.selected;
    const item = host.liveItem(sel.id);
    const waited = Date.now() - host.restoreSince > RESTORE_WAIT_MS;
    if (!item || delegate.live.fulls === 0) {
        if (waited || (delegate.itemsRevision > 0 && delegate.live.fulls > 0 && !item)) {
            host.restore = null;
            console.info('[MapStudio] The remembered selection ' + sel.id + ' is no longer on the map.');
        }
        return;
    }
    host.restore = null;
    if (sel.kind === 'point' && item.geometry.type === 'Point') {
        const at = host.anchorFor(item.id, [item.geometry.coordinates[0], item.geometry.coordinates[1]]);
        if (restore.popup) {
            host.openPopup(host.popupPoint(item.id, item.name, item.kind), at);
        } else {
            host.setState({ selected: { id: item.id, kind: 'point' }, pick: null });
        }
    } else if (sel.kind === 'line' && item.geometry.type === 'LineString') {
        if (restore.popup && restore.popupAt) {
            host.openLinePopup(item.id, sel.segment, restore.popupAt);
        } else {
            host.selectLine(item.id, sel.segment);
        }
    }
    console.info('[MapStudio] The map\'s place came back: ' + item.name + (restore.popup ? ' with its popup.' : ' selected.'));
}

/** A control's rectangle in map pixels, or null when it is not there. */
export function controlRect(host: CameraHost, selector: string): Rect | null {
    if (!host.map) {
        return null;
    }
    const container = host.map.getContainer();
    const el = container.querySelector(selector) as HTMLElement | null;
    if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) {
        return null;
    }
    const base = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
}

/**
 * The camera padding of the moment (item 27): the top bar, the zoom card, the legend row, an open
 * sheet or card, so a Return, a search choice, a Needs you choice or Fit centres in what a person sees.
 */
export function cameraPadding(host: CameraHost): CameraPadding {
    if (!host.map) {
        return { top: 0, bottom: 0, left: 0, right: 0 };
    }
    const container = host.map.getContainer();
    const sheetEl = host.mapContainer && host.mapContainer.parentElement
        ? host.mapContainer.parentElement.querySelector('.mapstudio-sheet') as HTMLElement | null : null;
    let sheet: Rect | null = null;
    if (sheetEl && sheetEl.offsetHeight > 0) {
        const base = container.getBoundingClientRect();
        const r = sheetEl.getBoundingClientRect();
        sheet = { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
    }
    let card: { rect: Rect; anchor: PopupAnchor } | null = null;
    if (host.popup && host.popup.isOpen() && host.popupAnchor && host.popupContent) {
        const base = container.getBoundingClientRect();
        const r = host.popupContent.getBoundingClientRect();
        card = { rect: { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height }, anchor: host.popupAnchor };
    }
    return paddingFor(container.clientWidth, container.clientHeight, {
        topBar: controlRect(host, '.maplibregl-ctrl-top-left'),
        zoomCard: controlRect(host, '.maplibregl-ctrl-top-right'),
        bottomRow: controlRect(host, '.maplibregl-ctrl-bottom-left')
    }, sheet, card);
}

/** Fit (epic 3 entry 7): the view fits every item's bounds and keeps until the bounds change or the user moves the map. */
export function onFit(host: CameraHost): void {
    if (!host.map || !host.itemBounds) {
        return;
    }
    host.fitKey = host.itemBoundsKey;
    fitTo(host, host.itemBounds);
    publishFit(host);
}

/** Fit bounds inside the visible area (item 27): the fit's own margin plus the camera padding. */
export function fitTo(host: CameraHost, bounds: Bounds): void {
    if (host.map) {
        const pad = cameraPadding(host);
        host.map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], {
            padding: { top: pad.top + FIT_ITEMS_PADDING_PX, bottom: pad.bottom + FIT_ITEMS_PADDING_PX,
                left: pad.left + FIT_ITEMS_PADDING_PX, right: pad.right + FIT_ITEMS_PADDING_PX },
            animate: false, maxZoom: 16
        });
    }
}

/** The bounds of a line's coordinates, for a fit. */
function boundsOf(coordinates: number[][]): Bounds {
    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;
    for (const [x, y] of coordinates) {
        west = Math.min(west, x);
        east = Math.max(east, x);
        south = Math.min(south, y);
        north = Math.max(north, y);
    }
    return [west, south, east, north];
}

/** Return: the map pans to the selected point at the zoom it has (centred in the visible area, item 27), or fits the selected line. */
export function onReturn(host: CameraHost): void {
    const selected = host.state.selected;
    const delegate = host.props.delegate;
    if (!host.map || !selected || !delegate) {
        return;
    }
    const item = host.liveItem(selected.id);
    if (!item) {
        return;
    }
    if (item.geometry.type === 'Point') {
        const at = host.anchorFor(item.id, [item.geometry.coordinates[0], item.geometry.coordinates[1]]);
        host.map.jumpTo({ center: at, padding: cameraPadding(host) });
    } else {
        fitTo(host, boundsOf(item.geometry.coordinates));
    }
}

/**
 * A search result chosen (entry 9, R4): the map zooms to the item and selects it as a click on it
 * does. A point is shown at zoom 15 at least (its glyph, name and icon KPI all draw there), its
 * popup opened and the point click sent; a line or an area is fitted and selected (no popup: a
 * line's popup is entry 2's). The jump is this component's own move, so a kept Fit is ended here.
 */
export function onSearchChoose(host: CameraHost, result: SearchResult): void {
    host.openedBy = 'search';
    goToItem(host, result.id, 'Search', '(' + result.matched + ')');
}

/** A Needs you row chosen (entry 3, R15): the same move and selection as a search choice. */
export function onNeedsYouChoose(host: CameraHost, row: NeedsYouRow): void {
    host.openedBy = 'needsyou';
    goToItem(host, row.id, 'Needs you', '(' + row.state + ')');
    if (host.searchControl) {
        host.searchControl.announce(row.name + ' selected');
    }
}

/** Zoom to a map item and select it as a click on it does (the search's and the Needs you list's choice). */
export function goToItem(host: CameraHost, id: string, via: string, how: string): void {
    const map = host.map;
    const delegate = host.props.delegate;
    const store = host.props.store.delegate as MapStudioStoreDelegate | undefined;
    if (!map || !delegate) {
        return;
    }
    const item = host.liveItem(id);
    if (!item) {
        console.info('[MapStudio] The ' + via + ' choice ' + id + ' is no longer on the map.');
        return;
    }
    host.fitKey = null;
    if (item.geometry.type === 'Point') {
        const lngLat = host.anchorFor(item.id, [item.geometry.coordinates[0], item.geometry.coordinates[1]]);
        // Centred in the visible area, less the top bar, the zoom card and an open sheet or card (item 27).
        map.jumpTo({ center: lngLat, zoom: Math.max(map.getZoom(), CHOSEN_POINT_ZOOM), padding: cameraPadding(host) });
        // The item with its asset link and properties, so the popup's link and a custom view's params fill (entry 8).
        host.openPopup(host.popupPoint(item.id, item.name, item.kind), lngLat);
        if (store) {
            store.sendPointClick(item.id);
        }
    } else {
        fitTo(host, boundsOf(item.geometry.coordinates));
        host.selectLine(item.id);
    }
    publishFit(host);
    console.info('[MapStudio] ' + via + ': ' + item.name + ' chosen ' + how + '.');
}

/** A move the user began (a drag, a wheel, a zoom button) ends a kept Fit; a programmatic one does not. */
export function onMoveStart(host: CameraHost, ev: { originalEvent?: unknown }): void {
    if (ev && ev.originalEvent && host.fitKey !== null) {
        host.fitKey = null;
        publishFit(host);
    }
}

/** Fit's state for the zoom card and the e2e suite. */
export function publishFit(host: CameraHost): void {
    if (host.zoomControl) {
        host.zoomControl.setFit(host.itemBounds !== null, host.fitKey !== null);
    }
    if (host.mapContainer) {
        host.mapContainer.setAttribute('data-fit', host.fitKey !== null ? 'kept' : 'off');
    }
}

/** The view for the e2e suite: the centre and zoom the map is at. */
export function publishView(host: CameraHost, map: MapLibreMap): void {
    const el = host.mapContainer;
    if (!el || host.map !== map) {
        return;
    }
    const c = map.getCenter();
    el.setAttribute('data-center', c.lng.toFixed(5) + ',' + c.lat.toFixed(5));
    el.setAttribute('data-zoom', map.getZoom().toFixed(2));
}

/** For the e2e suite: tell a test the map is drawn (its first idle, sources and layers added). */
export function publishReadiness(host: CameraHost, map: MapLibreMap): void {
    const el = host.mapContainer;
    if (!el || host.map !== map) {
        return;
    }
    publishView(host, map);
    el.setAttribute('data-map-ready', 'true');
}

