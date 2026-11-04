import * as React from 'react';
import {
    AbstractUIElementStore,
    Component,
    ComponentMeta,
    ComponentProps,
    ComponentStoreDelegate,
    PComponent,
    PropertyTree,
    Size2d
} from '@inductiveautomation/perspective-client';
import { ErrorEvent, Map as MapLibreMap, MapMouseEvent, Popup, setWorkerUrl } from 'maplibre-gl';
import { TerraDraw } from 'terra-draw';
import { DrawControl } from './DrawControl';
import { DRAW_IDLE, DrawState, drawStatusText } from './draw';
import { EditLevel, MapItemRecord } from './contract';
import { AdapterStatus, HostLists, NO_HOST_LISTS } from './adapters';
import { BasemapId, RasterSource } from './basemaps';
import { LegendControl } from './LegendControl';
import { LegendToggle, readToggle, sessionStore, writeToggle } from './legend';
import { NeedsYouControl } from './NeedsYouControl';
import { NeedsYouRow } from './needsyou';
import { readStartingArea, startingAreaKey } from './startingArea';
import { Place } from './place';
import { LiveState, itemPreset, itemState } from './live';
import { CONNECTED, connectionChipText, connectionDetailText } from './connection';
import { ThemeWatch } from './themeWatch';
import { MarkerColors, SpriteSymbol, markerProperties, stateWord } from './markers';
import { PresetPalette, StylePreview, TintPalette } from './StylePreview';
import { MapFeatures, SegmentRef, Selection } from './features';
import { ZoomControl } from './ZoomControl';
import { SearchControl } from './SearchControl';
import { SearchResult } from './search';
import { STORE_UNKNOWN, storeStateAttribute, storeStatusText } from './storeState';
import { SAVE_IDLE, saveStatusText } from './save';
import { UnsavedEntry, entryText, summaryText } from './unsaved';
import { PopupPoint } from './popupParams';
import { PopupAnchor, Rect } from './popupPlacement';
import { SHARED_M } from './shared';
import { registerTestView } from './testHook';
import { MapboxLogoControl } from './mapboxLogo';
import {
    SPRITE_URL, THEME_TOKENS, addItemLayers, addPointerCursor, addTextLayers, addUnsavedLayers, applyLayerToggles, applyThemePaint, blankColors,
    createMap, markerColors, publishLabels
} from './mapLayers';
import { addViewControls } from './viewControls';
import { Kind } from './adapters';
import { MapStudioDelegateState, MapStudioStoreDelegate, clientOf } from './MapStudioStoreDelegate';
import * as camera from './camera';
import { Bounds } from './camera';
import * as items from './itemsLayer';
import * as selection from './selection';
import type { OpenPick, OpenPopup } from './selection';
import * as editing from './editing';
import * as basemap from './basemapLayer';
import { TilesState } from './basemapLayer';
import { StudioState, clearSelection, fromProps, isEditing, pickTool, select } from './studio';

/** Must match MapStudioComponent.COMPONENT_ID on the Java side. */
export const COMPONENT_TYPE = 'ao.mapstudio';

/**
 * MapLibre's worker, served by the gateway hook beside the bundle under the
 * module's mount alias (MapStudioModule.URL_ALIAS); copied there by webpack
 * with a .js name so the gateway serves it with a JavaScript content type.
 */
export const WORKER_URL = '/res/mapstudio/maplibre-gl-worker.js';
setWorkerUrl(WORKER_URL);

/** Component props read from the property tree (mapstudio.props.json). */
export interface MapStudioProps {
    /**
     * Where this component opens the map (epic 3 entry 6): `{center: {lng, lat}, zoom, bounds: {west, south,
     * east, north}}`, read by startingArea.ts; the raw object, so an invalid value is reported in words.
     */
    startingArea: unknown;
    /**
     * Draw the style preview panel (epic 3 entry 1): every kind's style rule and area tints, each
     * case in its preset, and the preset and tint palettes; the kind setup screen's preview, for review.
     */
    previewStyles: boolean;
    /**
     * Open the component in Edit mode (epic 3 entry 14): today the spike's Draw a line tool alone, which
     * View mode never shows; epic-editing builds the studio behind it. The dev page /edit sets it.
     */
    editMode: boolean;
}

export interface MapStudioState extends DrawState {
    popup: OpenPopup | null;
    /** Bumped every few seconds while the popup is open, so its data ages move. */
    clock: number;
    /** The shared marker's pick list, shown in the popup instead of a map item's content. */
    pick: OpenPick | null;
    /** The selected map item (epic 3 entry 7): the clicked point or line; a tap on the ground clears it. */
    selected: Selection | null;
    /**
     * The studio's mode, tool and selection (epic 4 entry 1, studio.ts), which the studio's surfaces read; kept in
     * lock-step with `drawing` and `selected` through drawingState and selectionState (functional setState), and read for the mode.
     */
    studio: StudioState;
}

export type Props = ComponentProps<MapStudioProps, MapStudioDelegateState>;

/**
 * The Map Studio component: a MapLibre map on a blank style that draws the
 * project's map items from the map store. Clicking a point item sends
 * `point.click` through the delegate; the reply is shown as text over the map.
 */
export class MapStudio extends Component<Props, MapStudioState> {
    state: MapStudioState = {
        ...DRAW_IDLE, popup: null, clock: Date.now(), pick: null, selected: null, studio: fromProps(this.props.props.editMode)
    };

    mapContainer: HTMLDivElement | null = null;
    map: MapLibreMap | null = null;
    private resizeObserver: ResizeObserver | null = null;
    draw: TerraDraw | null = null;
    drawControl: DrawControl | null = null;
    /** The MapLibre popup, created once and moved between points; its content is a React portal. */
    popup: Popup | null = null;
    /** The DOM node the popup shows; React renders PointPopup into it through a portal. */
    popupContent: HTMLDivElement | null = null;
    /** Whether the items sources exist (after the map's load). */
    itemsReady = false;
    /** The items revision last drawn. */
    drawnRevision = -1;
    /** Whether the e2e item counts were asked for (after the first loaded items are drawn). */
    itemCountsAsked = false;
    /** The unsaved and items revisions last drawn into the unsaved sources. */
    drawnUnsaved = '';
    /** Terra Draw features of finished lines: removed once queued, as the unsaved layer draws them. */
    queuedFeatures: Array<string | number> = [];
    /** The theme colours the marker images are drawn with, read at mount and again on a theme change (item 29). */
    markerColors: MarkerColors | null = null;
    /** Re-reads the tokens when the theme changes and redraws (item 29). */
    private themeWatch: ThemeWatch | null = null;
    /** How many times the theme was re-read, for tests. */
    private themeRevision = 0;
    /** A theme change came before the layers were ready (item 29): applied once they are, not lost. */
    private themePending = false;
    /** The sprite's symbols once fetched (empty when the fetch failed); null before. */
    symbols: Record<string, SpriteSymbol> | null = null;
    /** The sprite's fetch, shared by every image asked for before it arrived. */
    sprite: Promise<Record<string, SpriteSymbol>> | null = null;
    /** The images made or being made, by id, so an id is drawn once. */
    madeImages = new Map<string, Promise<void>>();
    /** The live revision last drawn into the markers. */
    drawnLive = -1;
    /** The full batches applied when the legend's key was last built (the kind display changes only on a full batch). */
    drawnFulls = -1;
    /** The selection last drawn (its id and kind), so a changed selection redraws the sources once. */
    drawnSelection = '';
    /** The zoom card with Fit and Return (epic 3 entries 7 and 14). */
    zoomControl: ZoomControl | null = null;
    /** The search field top-left, the View-mode top bar (epic 3 entry 9). */
    searchControl: SearchControl | null = null;
    /** The Needs you bar in the top bar's row and its ranked list (epic 3 entry 3). */
    needsYouControl: NeedsYouControl | null = null;
    /** The legend's Lines and Names toggles (entry 3), remembered per browser session. */
    private toggles: Record<LegendToggle, boolean> = { lines: readToggle(sessionStore(), 'lines'), names: readToggle(sessionStore(), 'names') };
    /** The items' bounds key Fit keeps by, or null while Fit is not in force. */
    fitKey: string | null = null;
    /** The items' bounds last drawn, for Fit. */
    itemBounds: MapFeatures['bounds'] = null;
    itemBoundsKey = '';
    popupClock: ReturnType<typeof setInterval> | null = null;
    /** Where each member of a shared marker is drawn, by item id (owner review notes item 20): a popup anchors there. */
    anchors: Record<string, [number, number]> = {};
    /** The sharing distance at the map's zoom (item 20) and the one the features were last built with. */
    withinM = SHARED_M;
    drawnWithinM = SHARED_M;
    /** What opened the popup (item 14): Esc returns the focus there; null for a click on the map. */
    openedBy: 'search' | 'needsyou' | null = null;
    /** The side the open card's tip is on (item 18), for the camera padding; null while no card is open. */
    popupAnchor: PopupAnchor | null = null;
    /** The legend bottom-left, which holds the basemap choice (epic 3 entries 6 and 14), and the basemap revision last drawn. */
    legendControl: LegendControl | null = null;
    /** The Mapbox logo control, bottom-right, while Satellite is drawn. */
    logoControl: MapboxLogoControl | null = null;
    drawnBasemap = -1;
    /** The raster source the map holds now (by identity), or null for none. */
    drawnSource: RasterSource | null = null;
    /** The drawn basemap's tiles: none (no source), loading, loaded (the map went idle) or failed (a tile error). */
    tiles: TilesState = 'none';
    /** The starting area last applied (startingAreaKey), so a changed prop moves the map once. */
    appliedArea = '';
    /** This map's key in sessionStorage for its place (owner re-test R4 (a), place.ts), set at mount. */
    placeKey = '';
    /** A remembered selection and popup still to put back once its item and its kind's display have arrived. */
    restore: Place | null = null;
    /** When the restore was asked for, so a selection whose item never comes is dropped. */
    restoreSince = 0;
    /** The selection and popup last remembered, so a redraw that changed neither writes nothing. */
    savedSelection = '';
    /** Set as the component unmounts: closing the popup and removing the map then must not overwrite the place. */
    unmounting = false;

    componentDidMount(): void {
        if (!this.mapContainer) {
            return;
        }
        const area = camera.startingArea(this);
        this.appliedArea = startingAreaKey(area) + (readStartingArea(this.props.props.startingArea).problem || '');
        // The place this page's map had earlier in the browser session (owner re-test R4 (a)): its camera instead of
        // the starting area, and its selection and open popup put back once the items have come (applyRestore).
        const place = camera.rememberedPlace(this, this.projectName());
        const root = this.props.store.element as HTMLElement | undefined;
        // The blank map and the halos are the blank-map token (DESIGN.md basemap-blank, `--neutral-20`).
        const colors = blankColors(root);
        const mc = markerColors(root);
        this.markerColors = mc;
        // The colours this map was built with, for the e2e suite (item 29); applyTheme updates them.
        this.mapContainer.setAttribute('data-theme-revision', '0');
        this.mapContainer.setAttribute('data-blank', colors.background);
        selection.makePopup(this);
        const map = createMap(this.mapContainer, colors.background, camera.startCamera(place, area));
        // The View-mode controls (epic 3 entry 14; viewControls.ts): the zoom card, the search field with the
        // Needs you bar, the legend and the attribution, wired to this component's callbacks.
        const controls = addViewControls(map, this, this.toggles);
        this.zoomControl = controls.zoom;
        this.searchControl = controls.search;
        this.needsYouControl = controls.needsYou;
        this.legendControl = controls.legend;
        // Mapbox's "Improve this map" carries the map's position (its attribution guide): after the control
        // rebuilds its links (its listeners run first) and after every move.
        map.on('sourcedata', this.updateFeedbackLinks);
        map.on('styledata', this.updateFeedbackLinks);
        map.on('moveend', this.updateFeedbackLinks);
        map.on('error', this.onMapError);
        map.on('idle', this.onMapIdle);
        map.on('moveend', () => {
            camera.publishView(this, map);
            camera.savePlace(this);
        });
        map.on('movestart', this.onMoveStart);
        map.on('zoomend', () => items.onZoomEnd(this, map));
        map.on('load', () => {
            // The sources and layers (mapLayers.ts): the items, then the unsaved and text layers over them.
            addItemLayers(map, mc);
            // MapLibre awaits the resolver's promise before it treats an image as missing, so the
            // images drawn from the sprite are in place when the symbols are laid out.
            map.setMissingStyleImageResolver((id) => items.makeImage(this, id));
            items.loadSprite(this);
            addUnsavedLayers(map, colors);
            addTextLayers(map, mc);
            this.itemsReady = true;
            this.applyLayerToggles();
            basemap.applyBasemap(this);
            this.drawItems();
            if (this.themePending) {
                // The theme changed between the mount's colour read and now (item 29): read and draw again.
                this.applyTheme();
            }
            const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
            if (delegate) {
                delegate.sendMapLoad();
            }
            map.on('click', this.onMapClick);
            addPointerCursor(map);
            editing.startTerraDraw(this, map, root);
            // Readiness for the e2e suite: set once the map has gone idle with
            // its sources and layers added.
            map.once('idle', () => camera.publishReadiness(this, map));
        });
        // The spike's line tool belongs to Edit mode alone (entry 14): the dev page /edit sets the prop, read once
        // into the studio model (studio.ts fromProps).
        if (isEditing(this.state.studio)) {
            this.drawControl = new DrawControl(this.toggleDrawing);
            map.addControl(this.drawControl, 'top-right');
        }
        this.map = map;
        this.themeWatch = new ThemeWatch(root, THEME_TOKENS, () => this.applyTheme());
        this.themeWatch.start();
        registerTestView((view) => {
            if (this.map === map) {
                // A test's move centres on the whole map: the camera padding of the last choice (item 27) is cleared.
                map.jumpTo({ center: view.center, zoom: view.zoom, padding: { top: 0, bottom: 0, left: 0, right: 0 } });
            }
        });
        editing.applyEditing(this);
        if (typeof window !== 'undefined') {
            window.addEventListener('storage', this.onStorage);
        }

        this.publishHeight();
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => { map.resize(); this.publishHeight(); });
            this.resizeObserver.observe(this.mapContainer);
        }
    }

    /** The map's height as a CSS variable, so a floating panel (the legend, entry 3) never grows past the map. */
    private publishHeight(): void {
        if (this.mapContainer) {
            this.mapContainer.style.setProperty('--mapstudio-map-height', this.mapContainer.clientHeight + 'px');
            this.mapContainer.style.setProperty('--mapstudio-map-width', this.mapContainer.clientWidth + 'px');
        }
    }

    /**
     * The theme changed after the map mounted (item 29: the `/dark` page's startup script, a session
     * theme switch): the tokens are read again, every paint colour the layers took at mount is set
     * again, the marker images are dropped so the resolver draws them in the new colours, and the
     * features are rebuilt (their line and area colours are resolved token values).
     */
    private applyTheme(): void {
        const map = this.map;
        const root = this.props.store.element as HTMLElement | undefined;
        if (!map || !this.itemsReady) {
            // The watch has taken the new reading already: remember the change for the load handler.
            this.themePending = true;
            return;
        }
        this.themePending = false;
        const mc = markerColors(root);
        this.markerColors = mc;
        this.themeRevision++;
        const blank = applyThemePaint(map, root, mc);
        // The images were drawn in the old colours: dropped, so the missing-image resolver draws them again.
        items.dropImages(this, map);
        this.drawItems();
        if (this.mapContainer) {
            this.mapContainer.setAttribute('data-theme-revision', String(this.themeRevision));
            this.mapContainer.setAttribute('data-blank', blank);
        }
        console.info('[MapStudio] The theme changed: the map colours were read again.');
    }

    componentDidUpdate(): void {
        basemap.applyBasemap(this);
        this.drawItems();
        this.dropQueuedFeatures();
        editing.applyEditing(this);
        camera.applyStartingArea(this);
        camera.applyRestore(this);
        camera.saveSelection(this);
    }

    /** The project for the place's key, or null when the client does not say. */
    private projectName(): string | null {
        const client = clientOf(this.props.store);
        return client && typeof client.projectName === 'string' && client.projectName !== '' ? client.projectName : null;
    }

    /** The attribution's "Improve this map" links with the map's position, and a tile that did not load (basemapLayer.ts). */
    private updateFeedbackLinks = (): void => basemap.updateFeedbackLinks(this);
    private onMapError = (ev: ErrorEvent & { sourceId?: string }): void => basemap.onMapError(this, ev);

    /** The map went idle with the basemap's tiles in: loaded, unless one failed. The labels drawn are published. */
    private onMapIdle = (): void => {
        if (this.tiles === 'loading') {
            this.tiles = 'loaded';
            basemap.publishBasemap(this);
        }
        this.publishLabels();
    };

    /** A move the user began (a drag, a wheel, a zoom button) ends a kept Fit; a programmatic one does not. */
    private onMoveStart = (ev: { originalEvent?: unknown }): void => camera.onMoveStart(this, ev);

    /** For the e2e suite: the labels MapLibre drew, with their boxes (mapLayers.ts publishLabels). */
    private publishLabels(): void {
        const map = this.map;
        const el = this.mapContainer;
        if (!map || !el || !this.itemsReady) {
            return;
        }
        publishLabels(map, el);
    }

    /** Where a point item's popup anchors: the marker drawn for it, which for a member of a shared marker is the group's (item 20). */
    anchorFor(id: string, lngLat: [number, number]): [number, number] {
        return this.anchors[id] || lngLat;
    }

    /** A control's rectangle in map pixels, or null when it is not there (camera.ts). */
    controlRect(selector: string): Rect | null { return camera.controlRect(this, selector); }

    /** Fit and Return (epic 3 entry 7; camera.ts): the zoom card's buttons. */
    onFit = (): void => camera.onFit(this);
    onReturn = (): void => camera.onReturn(this);

    /** Fit bounds inside the visible area (item 27; camera.ts). */
    fitTo(bounds: Bounds): void { camera.fitTo(this, bounds); }

    /** A search result or a Needs you row chosen (entries 9 and 3; camera.ts goToItem). */
    onSearchChoose = (result: SearchResult): void => camera.onSearchChoose(this, result);
    onNeedsYouChoose = (row: NeedsYouRow): void => camera.onNeedsYouChoose(this, row);

    /** The legend's basemap choice (epic 3 entry 6): the delegate selects it and remembers it. */
    onBasemapChoose = (id: BasemapId): void => {
        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        if (delegate) {
            delegate.selectBasemap(id);
        }
    };

    /**
     * The legend's Lines and Names toggles (entry 3, R14): Lines off hides every line layer and the
     * flow arrow (areas stay); Names off hides the item names, the state chips, the icon KPI text and
     * the line name chips, and keeps the markers (an abnormal item's badge and digit stay) and the
     * line badges (mapLayers.ts applyLayerToggles). Remembered per browser session.
     */
    onLegendSwitch = (toggle: LegendToggle, on: boolean): void => {
        this.toggles = { ...this.toggles, [toggle]: on };
        writeToggle(sessionStore(), toggle, on);
        this.applyLayerToggles();
    };

    private applyLayerToggles(): void {
        const map = this.map;
        if (!map || !this.itemsReady) {
            return;
        }
        applyLayerToggles(map, this.toggles);
        if (this.mapContainer) {
            this.mapContainer.setAttribute('data-lines', this.toggles.lines ? 'on' : 'off');
            this.mapContainer.setAttribute('data-names', this.toggles.names ? 'on' : 'off');
        }
    }

    /** Fit's state for the zoom card and the e2e suite (camera.ts). */
    publishFit(): void { camera.publishFit(this); }

    /** The selection's attributes and the zoom card's Return (selection.tsx). */
    publishSelection(): void { selection.publishSelection(this); }

    private onStorage = (ev: StorageEvent): void => {
        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        if (delegate) {
            delegate.onStorage(ev.key);
        }
    };

    /** The delegate's items into the sources when their revisions changed, then the unsaved items (itemsLayer.ts). */
    drawItems(): void { items.drawItems(this); }

    /** A finished line is queued and drawn from the unsaved layer: remove Terra Draw's copy of it (itemsLayer.ts). */
    dropQueuedFeatures(): void { items.dropQueuedFeatures(this); }

    componentWillUnmount(): void {
        this.unmounting = true;
        selection.stopPopupClock(this);
        if (typeof window !== 'undefined') {
            window.removeEventListener('storage', this.onStorage);
        }
        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        if (delegate) {
            delegate.stopReplay();
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this.themeWatch) {
            this.themeWatch.stop();
            this.themeWatch = null;
        }
        if (this.mapContainer) {
            this.mapContainer.removeEventListener('keydown', this.onKeyDown, true);
        }
        if (this.draw) {
            this.draw.stop();
            this.draw = null;
        }
        if (this.popup) {
            this.popup.off('close', this.onPopupClosed);
            this.popup.remove();
            this.popup = null;
        }
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
        if (this.needsYouControl) {
            this.needsYouControl.unmount();
            this.needsYouControl = null;
        }
        this.drawControl = null;
        this.legendControl = null;
        this.logoControl = null;
        this.zoomControl = null;
        this.searchControl = null;
    }

    /** The spike's line tool (editing.ts): the Draw a line toggle, Terra Draw's finish and the container's Escape. */
    private toggleDrawing = (): void => editing.toggleDrawing(this);
    onDrawFinish = (id: string | number, context: { mode: string; action: string }): void => editing.onDrawFinish(this, id, context);
    onKeyDown = (ev: KeyboardEvent): void => editing.onKeyDown(this, ev);

    /**
     * A draw state with the studio model that goes with it: the line tool in hand while drawing (studio.ts). Built
     * from the state being updated (`prev` of a functional setState), so writes batched into one update compose.
     */
    drawingState(prev: Readonly<MapStudioState>, state: DrawState): Pick<MapStudioState, 'drawing' | 'linePoints' | 'studio'> {
        return { ...state, studio: pickTool(prev.studio, state.drawing ? 'line' : null) };
    }

    /** A selection with the studio model that goes with it: the item's id selected, or nothing (studio.ts); from `prev` as above. */
    selectionState(prev: Readonly<MapStudioState>, selected: Selection | null): Pick<MapStudioState, 'selected' | 'studio'> {
        return { selected, studio: selected ? select(prev.studio, selected.id) : clearSelection(prev.studio) };
    }

    /** Esc closes the open popup, card, sheet or pick list and returns the focus (item 14; selection.tsx). */
    private onRootKeyDown = (ev: React.KeyboardEvent<HTMLDivElement>): void => selection.onRootKeyDown(this, ev);

    /** A click on the map (selection.tsx): a marker's popup or pick list, a line's popup, or the ground clearing the selection. */
    private onMapClick = (ev: MapMouseEvent): void => selection.onMapClick(this, ev);

    /** The selection and the popups (selection.tsx), which the camera's restore and choices open as a click does. */
    selectLine(id: string, segment: SegmentRef | null = null): void { selection.selectLine(this, id, segment); }
    openLinePopup(id: string, segment: SegmentRef | null, lngLat: [number, number]): void { selection.openLinePopup(this, id, segment, lngLat); }
    openPopup(point: PopupPoint, lngLat: [number, number]): void { selection.openPopup(this, point, lngLat); }
    popupPoint(id: string, name: string, kind: string): PopupPoint { return selection.popupPoint(this, id, name, kind); }

    /** The stable callbacks the popups, the pick list and MapLibre's close event take (selection.tsx). */
    closePopup = (): void => selection.closePopup(this);
    navigate = (path: string): void => selection.navigate(this, path);
    onPick = (id: string): void => selection.onPick(this, id);
    onPopupClosed = (): void => selection.onPopupClosed(this);

    /** The map item with this id that is on the map (not deleted), or undefined. */
    liveItem(id: string): MapItemRecord | undefined {
        const delegate = this.props.delegate;
        return delegate ? delegate.items.find((i) => i.id === id && !i.deleted) : undefined;
    }

    /**
     * The host lists' statuses as one hidden element, for tests and the dev page;
     * showing them to people is epic-editing's.
     */
    private renderAdapterStatus(lists: HostLists): React.ReactNode {
        const attrs = (name: 'kinds' | 'assets', status: AdapterStatus | null): Record<string, string> => ({
            ['data-' + name + '-status']: status ? status.status : '',
            ['data-' + name + '-count']: status ? String(status.count) : '',
            ['data-' + name + '-message']: status ? status.message : ''
        });
        return (
            <div className="mapstudio-adapter-status" hidden
                 {...attrs('kinds', lists.adapters ? lists.adapters.kinds : null)}
                 {...attrs('assets', lists.adapters ? lists.adapters.assets : null)}
                 data-kinds-rows={String(lists.kinds.length)}
                 data-assets-rows={lists.assets === null ? '' : String(lists.assets.length)} />
        );
    }

    /**
     * The live state of every map item that has values, as one hidden element per item, for tests
     * and the dev pages (the markers are WebGL); a map item the plan does not cover has no row.
     */
    private renderLiveState(live: LiveState, kinds: Kind[]): React.ReactNode {
        const ids = Object.keys(live.items);
        if (ids.length === 0) {
            return null;
        }
        const delegate = this.props.delegate;
        const items = delegate ? delegate.items : [];
        return (
            <div className="mapstudio-live" hidden data-live-seq={String(live.seq)} data-live-batches={String(live.batches)}
                 data-live-full={String(live.fulls)} data-live-items={String(ids.length)}>
                {ids.map((id) => {
                    const values = live.items[id];
                    const item = items.find((i) => i.id === id);
                    const kind = item ? kinds.find((k) => k.id === item.kind) : undefined;
                    const state = itemState(values, item ? live.display[item.kind] : undefined);
                    // The row's marker is the map's own look: the selection ring (the selected point, or the two
                    // instruments at an open segment's ends, entry 2) and the instrument disc included.
                    const selected = this.state.selected;
                    const ringed = selected !== null && ((selected.kind === 'point' && selected.id === id)
                        || (selected.segment !== undefined && selected.segment !== null
                            && (selected.segment.fromId === id || selected.segment.toId === id)));
                    const spec = markerProperties(id, item ? item.name : '', item ? item.kind : '', kind ? kind.icon : '', state,
                        { labelRank: kind ? kind.labelRank : 0, selected: ringed, instrument: !!(kind && kind.instrument) });
                    return (
                        <div key={id} className="mapstudio-live-item" data-item-id={id} data-state={state.badge}
                             data-preset={itemPreset(state)}
                             data-style={values.style ? values.style.preset + (values.style.stale ? ':stale:' + values.style.reason : '') : ''}
                             data-comms={state.commsLost ? 'lost' : values.comms ? (values.comms.stale ? 'stale' : 'ok') : ''}
                             data-stale={state.stale ? 'true' : 'false'}
                             data-alarm={state.alarm ? state.alarm.priority + ':' + (state.alarm.unacked ? 'unacked' : 'acked') + ':' + state.alarm.active : ''}
                             data-kpi={state.iconKpi ? state.iconKpi.text : ''}
                             data-kpi-stale={state.iconKpi && state.iconKpi.stale ? 'true' : 'false'}
                             data-marker={spec.marker}
                             data-word={stateWord(state)}
                             data-rank={String(spec.rank)}
                             data-segments={values.segments ? JSON.stringify(values.segments.map((g) => ({
                                 from: g.from, to: g.to, preset: g.preset, stale: g.stale, reason: g.reason,
                                 alarm: g.alarm ? g.alarm.priority + ':' + (g.alarm.unacked > 0 ? 'unacked' : 'acked') : ''
                             }))) : ''}
                             data-problems={values.problems.map((p) => p.slot + ': ' + p.reason).join('; ')} />
                    );
                })}
            </div>
        );
    }

    /** The queued edits, each with its reason, Try again and Discard (epic 2 story 8). */
    private renderUnsaved(unsaved: UnsavedEntry[], level: EditLevel | null, warning: string, sending: string[]):
        React.ReactNode {
        if (unsaved.length === 0 && warning === '') {
            return null;
        }
        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        const summary = summaryText(unsaved, level);
        return (
            <div className="mapstudio-unsaved" data-unsaved-count={String(unsaved.length)}>
                {warning !== '' ? <div className="mapstudio-unsaved-warning">{warning}</div> : null}
                {summary !== '' ? <div className="mapstudio-unsaved-summary">{summary}</div> : null}
                {unsaved.map((entry) => (
                    <div key={entry.batchId} className={'mapstudio-unsaved-row mapstudio-unsaved-row--' + entry.state}
                         data-batch-id={entry.batchId}
                         data-unsaved-state={entry.state}
                         data-code={entry.reason ? entry.reason.code : ''}>
                        <span className="mapstudio-unsaved-text">{entryText(entry, level)}</span>
                        {entry.reason ? (
                            <button type="button" className="mapstudio-unsaved-retry"
                                    onClick={() => delegate && delegate.retryUnsaved(entry.batchId)}>Try again</button>
                        ) : null}
                        <button type="button" className="mapstudio-unsaved-discard"
                                disabled={sending.indexOf(entry.batchId) >= 0}
                                title={sending.indexOf(entry.batchId) >= 0 ? 'Being sent; wait for the answer.' : undefined}
                                onClick={() => delegate && delegate.discardUnsaved(entry.batchId)}>Discard</button>
                    </div>
                ))}
            </div>
        );
    }

    /**
     * The style preview panel (entry 1, the `previewStyles` prop): every kind's style rule and area
     * tints from the kind display, each case in its preset, then the preset and tint palettes; drawn
     * with the same code as the markers (StylePreview), from the sprite once it is loaded.
     */
    private renderStylePanel(): React.ReactNode {
        const delegate = this.props.delegate;
        const colors = this.markerColors;
        if (!this.props.props.previewStyles || !delegate || !colors) {
            return null;
        }
        const symbols = this.symbols || {};
        if (this.symbols === null) {
            items.loadSprite(this).then(() => this.forceUpdate());
        }
        const kinds = delegate.lists.kinds;
        const previews = kinds
            .map((k) => ({ kind: k, display: delegate.live.display[k.id] }))
            .filter((e) => e.display && (e.display.styleRule || e.display.areaTints));
        return (
            <div className="mapstudio-style-panel" data-previews={String(previews.length)} data-sprite={this.symbols ? 'loaded' : 'loading'}>
                {previews.map((e) => (
                    <StylePreview key={e.kind.id}
                                  kind={{ id: e.kind.id, name: e.kind.name, geometry: e.kind.geometry, icon: e.kind.icon, area: e.kind.area }}
                                  rule={e.display!.styleRule} tints={e.display!.areaTints} symbols={symbols} colors={colors} />
                ))}
                <PresetPalette geometry="point" icon="well-pad" symbols={symbols} colors={colors} />
                <PresetPalette geometry="line" icon="pipeline" symbols={symbols} colors={colors} />
                <TintPalette colors={colors} />
            </div>
        );
    }

    private setMapContainer = (el: HTMLDivElement | null): void => {
        this.mapContainer = el;
    };

    render(): React.ReactNode {
        const delegate = this.props.delegate;
        const pending = !!(delegate && delegate.pendingId);
        const drawText = drawStatusText(this.state);
        const replyLine = delegate && delegate.lastReply ? delegate.lastReply : 'Click a point.';
        const save = delegate ? delegate.save : SAVE_IDLE;
        const saveText = saveStatusText(save);
        const load = delegate ? delegate.load : { state: 'loading', message: '' };
        const store = delegate ? delegate.store : STORE_UNKNOWN;
        const unsaved = delegate ? delegate.unsaved : [];
        const editing = delegate ? delegate.editing : 'on';
        // The status line stays in the DOM for every state it reports (the save status, a failed load, a
        // read-only store, unsaved edits, the line tool), but the spike's click echo is dev-page test
        // output and leaves View mode (owner review notes item 5, after entry 15): it renders in Edit mode
        // alone, and View mode shows the map and its controls only. The last reply stays readable for the
        // tests as `data-last-reply` on the map.
        const echo = isEditing(this.state.studio);
        const quiet = !echo && drawText === '' && saveText === '' && load.state !== 'failed'
            && store.status !== 'read-only' && unsaved.length === 0;
        const connection = delegate ? delegate.connection : CONNECTED;
        const chipText = connectionChipText(connection);
        return (
            <div {...this.props.emit({ classes: ['mapstudio'] })} onKeyDown={this.onRootKeyDown}>
                <div className="mapstudio-map" ref={this.setMapContainer}
                     data-edit-level={delegate && delegate.level ? delegate.level : ''}
                     data-load-state={load.state}
                     data-store-seq={delegate && delegate.seq !== null ? String(delegate.seq) : ''}
                     data-map-reloads={delegate ? String(delegate.reloads) : '0'}
                     data-store-state={storeStateAttribute(store)}
                     data-refresh-interval={delegate && delegate.refreshIntervalSeconds !== null
                         ? String(delegate.refreshIntervalSeconds) : ''}
                     data-unsaved-count={String(unsaved.length)}
                     data-editing={editing}
                     data-live-seq={delegate ? String(delegate.live.seq) : ''}
                     data-live-full={delegate ? String(delegate.live.fulls) : ''}
                     data-last-reply={delegate ? delegate.lastReply : ''}
                     data-connection={connection.lost ? 'lost' : connection.frozen ? 'reloading' : 'ok'}
                     data-pick-open={this.state.pick ? 'true' : 'false'}
                     data-popup-anchor=""
                     data-popup-side=""
                     data-segment=""
                     data-highlighted=""
                     data-popup-mode={this.state.popup ? (this.state.popup.sheet ? 'sheet' : 'card') : ''}
                     data-legend-open="false"
                     data-search-open="false"
                     data-needs-open="false" />
                <div className={'mapstudio-reply' + (pending ? ' mapstudio-reply--pending' : '') + (quiet ? ' mapstudio-reply--quiet' : '')}
                     data-pending={pending ? 'true' : 'false'}
                     data-drawing={this.state.drawing ? 'true' : 'false'}
                     data-line-points={this.state.linePoints === null ? '' : String(this.state.linePoints)}>
                    {echo ? <div>{pending ? 'Waiting for the Gateway ...' : replyLine}</div> : null}
                    {drawText !== '' ? <div className="mapstudio-draw-status">{drawText}</div> : null}
                    {saveText !== '' ? (
                        <div className={'mapstudio-save-status mapstudio-save-status--' + save.state}
                             data-save-state={save.state}
                             data-item-id={save.state === 'idle' ? '' : save.itemId}
                             data-version={save.state === 'saved' ? String(save.version) : ''}
                             data-code={save.state === 'refused' || save.state === 'unsent' ? save.code : ''}>
                            {saveText}
                        </div>
                    ) : null}
                    {load.state === 'failed'
                        ? <div className="mapstudio-load-status">Map store: {load.message}</div> : null}
                    {store.status === 'read-only'
                        ? <div className="mapstudio-store-status" data-store-state="read-only">{storeStatusText(store)}</div>
                        : null}
                    {this.renderUnsaved(unsaved, delegate ? delegate.level : null,
                        delegate ? delegate.storageWarning : '', delegate ? delegate.sending : [])}
                </div>
                {chipText !== '' ? (
                    // The connection chip (item 32): in words, with the hourglass, over the map under the top bar.
                    <div className="mapstudio-connection" role="status" title={connectionDetailText(connection)}
                         data-state={connection.lost ? 'lost' : 'reloading'}>
                        <svg className="mapstudio-connection-glyph" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                            <use href={SPRITE_URL + '#ms-stale'} />
                        </svg>
                        <span>{chipText}</span>
                    </div>
                ) : null}
                {this.renderAdapterStatus(delegate ? delegate.lists : NO_HOST_LISTS)}
                {delegate ? this.renderLiveState(delegate.live, delegate.lists.kinds) : null}
                {this.renderStylePanel()}
                {selection.renderPopup(this)}
            </div>
        );
    }
}

export class MapStudioMeta implements ComponentMeta {
    getComponentType(): string {
        return COMPONENT_TYPE;
    }

    getViewComponent(): PComponent {
        return MapStudio as unknown as PComponent;
    }

    getDefaultSize(): Size2d {
        return { width: 600, height: 400 };
    }

    createDelegate(component: AbstractUIElementStore): ComponentStoreDelegate | undefined {
        return new MapStudioStoreDelegate(component);
    }

    getPropsReducer(tree: PropertyTree): MapStudioProps {
        return {
            startingArea: tree.readObject('startingArea', {}),
            previewStyles: tree.readBoolean('previewStyles', false),
            editMode: tree.readBoolean('editMode', false)
        };
    }
}
