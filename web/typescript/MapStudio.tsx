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
import { TerraDraw, TerraDrawLineStringMode, TerraDrawPolygonMode, TerraDrawSelectMode } from 'terra-draw';
import { Drawing, GeometryPick, inField } from './drawing';
import { SnapTarget, instrumentsOn, lengthM } from './geometry';
import { EditLevel, MapItemRecord } from './contract';
import { AdapterStatus, HostLists, NO_HOST_LISTS } from './adapters';
import { BasemapId, RasterSource } from './basemaps';
import { EditSwitch } from './EditSwitch';
import { DockPart, LegendControl } from './LegendControl';
import { LegendToggle, readToggle, sessionStore, writeToggle } from './legend';
import { NeedsYouControl } from './NeedsYouControl';
import { NeedsYouRow } from './needsyou';
import { readStartingArea, startingAreaKey } from './startingArea';
import { Place } from './place';
import { LiveState, itemPreset, itemState } from './live';
import { CONNECTED } from './connection';
import { ThemeWatch } from './themeWatch';
import { MarkerColors, SpriteSymbol, markerProperties, stateWord } from './markers';
import { PresetPalette, StylePreview, TintPalette } from './StylePreview';
import { MapFeatures, SegmentRef, Selection } from './features';
import { ZoomControl } from './ZoomControl';
import { SearchControl } from './SearchControl';
import { CHOSEN_POINT_ZOOM, SearchResult } from './search';
import { PLACES } from './placeCheck';
import { STORE_UNKNOWN, storeStateAttribute } from './storeState';
import { SAVE_IDLE } from './save';
import { saveCardFor, unsavedItems } from './unsaved';
import { browserLocale } from './linePopup';
import { ProblemFacts, chipProblem, editProblems, headerSaveWords } from './problems';
import { PopupPoint, isSheetWidth, sheetBasisWidth } from './popupParams';
import { CameraPadding, PopupAnchor, Rect } from './popupPlacement';
import { SHARED_M } from './shared';
import { TEST_VIEW_TIMEOUT_MS, registerTestView } from './testHook';
import { MapboxLogoControl } from './mapboxLogo';
import {
    SPRITE_URL, THEME_TOKENS, addItemLayers, addPointerCursor, addTextLayers, addUnsavedLayers, addYouAreHereLayers, applyLayerToggles,
    applyThemePaint, blankColors, createMap, markerColors, publishLabels, publishYouAreHere, setYouAreHere
} from './mapLayers';
import { LOCATE_ZOOM, NO_LOCATION, UserLocation, readUserLocation, userLocationKey } from './userLocation';
import { addViewControls } from './viewControls';
import { Kind } from './adapters';
import { MapStudioDelegateState, MapStudioStoreDelegate, browserStorage, clientOf } from './MapStudioStoreDelegate';
import * as camera from './camera';
import { Bounds } from './camera';
import * as items from './itemsLayer';
import * as selection from './selection';
import type { OpenPick, OpenPopup, PageSelection } from './selection';
import { EchoGuard, echoGuard, pageId } from './pageEvents';
import * as editing from './editing';
import * as basemap from './basemapLayer';
import { TilesState } from './basemapLayer';
import {
    StudioState, StudioSurface, StudioTool, addMany, clearSelection, enterEdit, fromProps, instrumentKinds, isEditing, isMultiple, keepArmed, kindsFor,
    leaveEdit, pickTool, select, selectMany, showSurface, toggleSelect, toolKind
} from './studio';
import { BoxSelect, DragShape, ShapeItem } from './multiSelect';
import { SelectionCount } from './studio/SelectionCount';
import { listRows } from './itemList';
import { FieldValue, assetListKnown } from './itemForm';
import { Rail } from './studio/Rail';
import { ItemList, ListView, newListView } from './studio/ItemList';
import { PropertiesPanel } from './studio/PropertiesPanel';
import { DrawToolbar } from './studio/DrawToolbar';
import { DrawingBar, InstrumentBar } from './studio/DrawingBar';
import { GeometryBar } from './studio/GeometryBar';
import { ChromeGlyph } from './studio/ChromeGlyph';
import { ProblemStatus } from './studio/SaveStatus';
import { SaveCard } from './studio/SaveCard';
import { HistoryPanel } from './studio/HistoryPanel';
import { expandOps, historyRows } from './history';
import { HistoryEntry } from './contract';
import { busyText, undoLabel } from './undoStack';
import { FirstRunChecklist, ViewerNote } from './studio/FirstRunChecklist';
import { FIRST_RUN_NONE, FirstRunKept, VIEWER_NOTE, checklistShows, firstRunKey, keepFlag, readKept, stepsDone, viewerNoteShows } from './firstRun';

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
     * Edit mode, both ways (epic 3 entry 14, epic 4 entry 2): the studio at level `full`, entered at mount and
     * when the page writes true after it, left when the page writes false; the Edit switch writes it back.
     */
    editMode: boolean;
    /**
     * The selected map item's id, both ways (epic 4 entries 2 and 14): the component writes it on every selection change, and a
     * value the page writes selects that item as a click on it does (selection.tsx `readPageSelection`, `applyPageSelection`),
     * the component's own write coming back left out. The read-only `viewport` prop is written (camera.ts) and never read.
     */
    selectedItem: string | null;
    /**
     * The device's position (epic 4 entry 15): the page binds it to `{session.props.geolocation}` and it takes that shape,
     * read by userLocation.ts into the you-are-here marker, the legend's row and Locate me; the raw object (or null when
     * unbound), so a malformed value is read by the same rules. The component reads nothing of the session itself.
     */
    userLocation: unknown;
    /**
     * Directions in a point's popup and sheet (epic 4 entry 16; directions.ts): `{enabled, urlTemplate}`, null or `enabled` not
     * true meaning off; the raw object (or null), read by `readDirections` where the popup is built.
     */
    directions: unknown;
}

/** The rail's Layers surface's tabs (epic 4 entry 22, the owner's "2, the tabs"): Layers (Show, Basemap) first, then Legend (the key). */
export type LayersTab = 'layers' | 'legend';
const LAYERS_TABS: Array<[LayersTab, string]> = [['layers', 'Layers'], ['legend', 'Legend']];

export interface MapStudioState {
    /** The line or area being drawn vertex by vertex (epic 4 entry 4, drawing.ts), or null. */
    drawing: Drawing | null;
    /** The Snap toggle (EXPERIENCE.md Snap): off by default. */
    snap: boolean;
    /** The name of the snap target within reach of the pointer while the toggle is on, or ''. */
    snapHint: string;
    popup: OpenPopup | null;
    /** Bumped every few seconds while the popup is open, so its data ages move. */
    clock: number;
    /** The shared marker's pick list, shown in the popup instead of a map item's content. */
    pick: OpenPick | null;
    /** The selected map item (epic 3 entry 7): the clicked point or line; a tap on the ground clears it. */
    selected: Selection | null;
    /**
     * The item whose Details panel is docked beside the map (epic 4 entry 2): opened by the studio's own actions, a
     * list row, the Point tool's placement and, since entry 26, every click that would open a popup in View mode (a
     * marker, a line, a pick list's row, a restored popup; selection.tsx `selectWithDetails`) and a click on an area,
     * since Edit mode opens no popup, the clicked item keeping its place on the page as the panel docks; null when none.
     */
    panel: string | null;
    /**
     * The studio's mode, tool, surface and selection (epic 4 entries 1, 2 and 4, studio.ts), which the studio's surfaces read;
     * kept in lock-step with `drawing` and `selected` through drawingState, toolState and selectionState (functional setState).
     */
    studio: StudioState;
    /** The Layers surface's open tab (entry 22): it stays while Edit mode stays, and every entry to Edit mode opens on Layers. */
    layersTab: LayersTab;
    /**
     * The geometry change in hand with Select (entry 5, drawing.ts): a chosen point of the selected line or area, or Move waiting
     * for a click; kept only for the selected item (selectionState) and dropped when a tool is picked (toolState).
     */
    geometry: GeometryPick | null;
    /**
     * Below 1280 px (entry 7c, the owner's Direction A, 2026-10-27; DESIGN.md Layout): the item list is not docked, and the rail's
     * Items opens it over the map's left edge (`listOpen`). From a `matchMedia('(max-width: 1279px)')` listener, never the
     * stylesheet, so the box the map had before the line was crossed can still be read (selection.tsx `dockChange`).
     */
    listCollapsed: boolean;
    /** The collapsed list open over the map (entry 7c): the rail's Items toggles it; a row choice, Esc and a map click close it. */
    listOpen: boolean;
    /**
     * The conflict and busy cards closed with Esc (entry 10, R10), by the batch and its refusal (unsaved.ts `dismissKey`): their
     * entries stay on the save status row; Try again forgets a batch's, so a newer answer shows a fresh card.
     */
    cardsClosed: string[];
    /** Bumped by the unreachable card's "Show my 2 edits" (entry 10, R5) to open the row's list; 0 once a row took it. */
    showEdits: number;
}

/** The map inset the toolbar keeps from the map's left edge and the Editing switch on the top row (DESIGN.md spacing map-inset). */
const TOOLBAR_INSET_PX = 12;

/** Whether a key's target is inside the item list open over the map (entry 7c). */
function inListOverlay(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    return !!el && typeof el.closest === 'function' && el.closest('.mapstudio-list-overlay') !== null;
}

/** The width under which the item list leaves the dock (entry 7c; DESIGN.md Layout & Spacing: "below about 1280 px"). */
export const LIST_COLLAPSE_QUERY = '(max-width: 1279px)';

/** Whether the window is under the list's collapse width now; false where the browser cannot say (tests, old engines). */
function listCollapsedNow(): boolean {
    try {
        return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(LIST_COLLAPSE_QUERY).matches;
    } catch (err) {
        return false;
    }
}

export type Props = ComponentProps<MapStudioProps, MapStudioDelegateState>;

/**
 * The Map Studio component: a MapLibre map on a blank style that draws the
 * project's map items from the map store. Clicking a point item sends
 * `point.click` through the delegate; the reply is kept on the map as `data-last-reply`, shown nowhere (epic 4 entry 24).
 * In Edit mode at level `full` (epic 4 entry 2) the studio's surfaces dock beside the map:
 * the rail, the item list, the properties panel and the floating draw toolbar; there a click on an item selects it and
 * opens Details, and no popup opens (entry 26).
 */
export class MapStudio extends Component<Props, MapStudioState> {
    state: MapStudioState = {
        drawing: null, snap: false, snapHint: '', popup: null, clock: Date.now(), pick: null, selected: null, panel: null,
        studio: fromProps(this.props.props.editMode), layersTab: 'layers', geometry: null, listCollapsed: listCollapsedNow(), listOpen: false,
        cardsClosed: [], showEdits: 0
    };

    mapContainer: HTMLDivElement | null = null;
    map: MapLibreMap | null = null;
    private resizeObserver: ResizeObserver | null = null;
    /** The list's collapse width watched (entry 7c), or null where the browser has no matchMedia. */
    private collapseQuery: MediaQueryList | null = null;
    /** The item list's view (search, Sort by, Filter), held for every mount of the list, docked or over the map (entry 7c). */
    listView: ListView = newListView();
    draw: TerraDraw | null = null;
    /** Terra Draw's line and polygon modes (entry 4), kept for Backspace (the mode's undo). */
    lineMode: TerraDrawLineStringMode | null = null;
    areaMode: TerraDrawPolygonMode | null = null;
    /** The snap targets as last read from the items, the snapping callback's last offer and the validation's last reason (editing.ts). */
    snapCache: { revision: number; targets: SnapTarget[] } | null = null;
    lastSnap: SnapTarget | null = null;
    drawingReason = '';
    /** Entry 9 (editing.ts): the selected instrument dragged along its line, or null. */
    instrumentDrag: editing.InstrumentDrag | null = null;
    /** Entry 5 (editing.ts): Terra Draw's select mode, the selected item's copy in it, a dragged end's snap, the chosen point drawn. */
    selectMode: TerraDrawSelectMode | null = null;
    handles: editing.Handles | null = null;
    dragSnap: SnapTarget | null = null;
    handleDrag = false;
    chosenDrawn = -1;
    /** The Edit switch top-right (entry 2), added once map.load says the level is full; null otherwise. */
    editSwitch: EditSwitch | null = null;
    /** The MapLibre popup, created once and moved between points; its content is a React portal. */
    popup: Popup | null = null;
    /** The DOM node the popup shows; React renders PointPopup into it through a portal. */
    popupContent: HTMLDivElement | null = null;
    /** Watches the card's content size (entry 2): a custom view that grows after the card was placed is placed again. */
    popupSizeObserver: ResizeObserver | null = null;
    /** The card's size when it was last placed, so the watch re-places it only on a real change. */
    placedCardSize = '';
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
    /** The Point tool's placed pins (entry 2): Terra Draw's feature id to the map item's id, while the tool is in hand. */
    placedPoints = new Map<string | number, string>();
    /** The item whose Details opens with the cursor in Name (the pad just placed), or null. */
    focusNameId: string | null = null;
    /** The selection last written to the page (selection.tsx publishSelection): the item's id, '' for none. */
    publishedSelection = '';
    /** The set last written to the page's `selectedItems` (entry 8, selection.tsx publishSelection): the ids joined, '' for none. */
    publishedSet = '';
    /** The Shift-drag box and Shift+Alt-drag lasso with the Select tool in Edit mode (entry 8, multiSelect.ts). */
    boxSelect: BoxSelect = new BoxSelect(this);
    /** The echo guard of selectedItem (entry 14, pageEvents.ts): the component's own writes still to come back, the value last written. */
    selectedEcho: EchoGuard = echoGuard(pageId(this.props.props.selectedItem));
    /** The page's choice of an item waiting to be applied (entry 14, selection.tsx applyPageSelection), or null. */
    pageSelection: PageSelection | null = null;
    /** The viewport last written to the page (entry 14, camera.ts publishViewport), '' before the map first settled. */
    publishedViewport = '';
    /** The wait for the moves to settle before the viewport is written (entry 14, camera.ts publishViewport), or null. */
    viewportTimer: ReturnType<typeof setTimeout> | null = null;
    /** The theme colours the marker images are drawn with, read at mount and again on a theme change (item 29). */
    markerColors: MarkerColors | null = null;
    /** The page's userLocation as last read (entry 15, userLocation.ts) and the key it was last drawn with ('' before). */
    userLocation: UserLocation = NO_LOCATION;
    private drawnLocation = '';
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
    /** The rail's Layers surface's open tab panel, the docked legend's host (epic 4 entry 22), while it is mounted, else null. */
    private layersHost: HTMLDivElement | null = null;
    /** The Layers surface's tab and tab panel ids, unique to this component (two maps may share a page). */
    private readonly layersTabsId = 'mapstudio-layers-' + Math.random().toString(36).slice(2, 8);
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
    /**
     * The level map.load last reported (entry 4): a failed load (the store unreachable) leaves the delegate's level
     * unknown, and the studio of a session known to be full then stays, paused, as EXPERIENCE.md's Store unreachable
     * state draws it (the toolbar fades), instead of vanishing until the store is back.
     */
    lastLevel: EditLevel | null = null;
    /** Whether the studio showed at the last update (entry 21): the View-mode lists close as it comes on. */
    studioWasOn = false;

    componentDidMount(): void {
        if (!this.mapContainer) {
            return;
        }
        const area = camera.startingArea(this);
        this.appliedArea = startingAreaKey(area) + (readStartingArea(this.props.props.startingArea).problem || '');
        // The place this page's map had earlier in the browser session (owner re-test R4 (a)): its camera instead of
        // the starting area, and its selection and open popup put back once the items have come (applyRestore).
        const place = camera.rememberedPlace(this, this.projectName());
        // A selectedItem the page set before the component mounted wins over the remembered selection (entry 14).
        selection.readMountSelection(this);
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
        if (this.layersHost) {
            // The Layers surface mounted before the control existed (entry 22): the docked legend is drawn into it now.
            this.legendControl.dock(this.layersHost, this.dockPart());
        }
        // Locate me and the legend's row from the page's userLocation now; the marker once the layers exist (entry 15).
        this.applyUserLocation();
        // Mapbox's "Improve this map" carries the map's position (its attribution guide): after the control
        // rebuilds its links (its listeners run first) and after every move.
        map.on('sourcedata', this.updateFeedbackLinks);
        map.on('styledata', this.updateFeedbackLinks);
        map.on('moveend', this.updateFeedbackLinks);
        map.on('error', this.onMapError);
        map.on('idle', this.onMapIdle);
        map.on('moveend', () => {
            camera.publishView(this, map);
            // The page's viewport and onViewportChanged once the moves settle, never during a move or per frame (entry 14).
            camera.publishViewport(this, map);
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
            // The you-are-here marker above the areas and lines, below the point text and markers (entry 15).
            addYouAreHereLayers(map, root);
            addTextLayers(map, mc);
            this.itemsReady = true;
            this.applyUserLocation();
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
            this.applyBoxZoom();
            editing.startTerraDraw(this, map, root);
            // A selection made before the map loaded (a restored place, a list row) takes its handles now (entry 5).
            editing.applyHandles(this);
            // Readiness for the e2e suite: set once the map has gone idle with
            // its sources and layers added.
            map.once('idle', () => {
                camera.publishReadiness(this, map);
                // The map first settled: the page's first viewport (entry 14).
                camera.publishViewport(this, map, true);
            });
        });
        this.map = map;
        // The box and the lasso listen on the map's element, before Terra Draw and MapLibre (entry 8).
        this.boxSelect.attach(this.mapContainer);
        // The Edit switch and the studio wait for map.load's level (applyStudioControls, componentDidUpdate).
        this.themeWatch = new ThemeWatch(root, THEME_TOKENS, () => this.applyTheme());
        this.themeWatch.start();
        registerTestView((view) => new Promise<void>((resolve, reject) => {
            if (this.map !== map) {
                resolve();
                return;
            }
            const before = [map.getCenter().lng, map.getCenter().lat, map.getZoom(), JSON.stringify(map.getPadding())];
            // Resolved when the map has drawn the moved view, so a spec's next click hits the new frame;
            // rejected, naming the view, if the map never goes idle (replaced, or repainting without end).
            const onIdle = () => {
                window.clearTimeout(timer);
                resolve();
            };
            const timer = window.setTimeout(() => {
                map.off('idle', onIdle);
                reject(new Error('The map did not go idle within ' + TEST_VIEW_TIMEOUT_MS + ' ms after the test view to centre '
                    + view.center.join(',') + ' at zoom ' + view.zoom + '.'));
            }, TEST_VIEW_TIMEOUT_MS);
            map.once('idle', onIdle);
            // A test's move centres on the whole map: the camera padding of the last choice (item 27) is cleared.
            map.jumpTo({ center: view.center, zoom: view.zoom, padding: { top: 0, bottom: 0, left: 0, right: 0 } });
            const after = [map.getCenter().lng, map.getCenter().lat, map.getZoom(), JSON.stringify(map.getPadding())];
            if (before.every((v, i) => v === after[i]) && map.loaded() && !map.isMoving()) {
                // Nothing moved and nothing is left to draw: no idle may come, and the frame is already the view's.
                map.off('idle', onIdle);
                window.clearTimeout(timer);
                resolve();
            }
        }));
        editing.applyEditing(this);
        if (typeof window !== 'undefined') {
            window.addEventListener('storage', this.onStorage);
        }

        this.publishHeight();
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => {
                map.resize();
                this.publishHeight();
                this.placeToolbar();
                // The stage grew or shrank (a panel docked or left, entry 2): an open card is placed again in the new room.
                if (this.studioOn()) {
                    selection.replacePopup(this);
                }
            });
            this.resizeObserver.observe(this.mapContainer);
        }
        if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
            this.collapseQuery = window.matchMedia(LIST_COLLAPSE_QUERY);
            if (typeof this.collapseQuery.addEventListener === 'function') {
                this.collapseQuery.addEventListener('change', this.onCollapseChange);
            }
            if (this.collapseQuery.matches !== this.state.listCollapsed) {
                this.onCollapseChange({ matches: this.collapseQuery.matches });
            }
        }
    }

    /**
     * The window crossed the list's collapse width (entry 7c): below it the list leaves the dock (and an open overlay of it closes
     * as it docks again above it), a dock change like any other, so every item keeps its page spot (selection.tsx `dockChange`)
     * and a selected point the docked list would cover is eased into view. The listener runs as the media query changes, before
     * the resize observer, with the map still the size it last drew at, so the spots kept are the ones on screen then.
     */
    private onCollapseChange = (ev: { matches: boolean }): void => {
        const collapsed = ev.matches;
        if (collapsed === this.state.listCollapsed) {
            return;
        }
        console.info('[MapStudio] The window ' + (collapsed ? 'narrowed below' : 'widened past') + ' 1280 px: the item list '
            + (collapsed ? 'leaves the dock (the rail\'s Items opens it).' : 'docks again.'));
        this.dockChange(() => ({ listCollapsed: collapsed, listOpen: false }), this.selectedPlace());
    };

    /**
     * An update that may dock, undock or collapse a studio panel (entry 7c; selection.tsx `dockChange`): the ground keeps its place
     * on the page, and `place` is eased into view if the docked panel covers it.
     */
    dockChange<K extends keyof MapStudioState>(
        update: (prev: Readonly<MapStudioState>) => Pick<MapStudioState, K> | null, place: [number, number] | null = null): void {
        selection.dockChange(this, update, place);
    }

    /** The selected point's place (its drawn marker's), the place a dock change keeps in view; null for none or a line. */
    private selectedPlace(): [number, number] | null {
        const selected = this.state.selected;
        const item = selected ? this.itemFor(selected.id) : undefined;
        if (!item || item.geometry.type !== 'Point') {
            return null;
        }
        return this.anchorFor(item.id, [item.geometry.coordinates[0], item.geometry.coordinates[1]]);
    }

    /**
     * The toolbar's row (entry 7c's review), from the map's measured width, whatever is docked: on the top row, centred over the
     * map, only when it fits there with the map inset (12 px) clear of the map's left edge and of the Editing switch; else on the
     * row under the switch, the chip moving down with it (`data-toolbar-row="under"` on the stage, the stylesheet). Read from
     * the layout (the toolbar's own width, the switch's place), so a change of width, panel or toolbar is followed; written only
     * when it changes.
     */
    private placeToolbar(): void {
        const el = this.mapContainer;
        const stage = el ? el.parentElement : null;
        if (!el || !stage || typeof stage.querySelector !== 'function') {
            return;
        }
        const toolbar = stage.querySelector('.mapstudio-toolbar') as HTMLElement | null;
        const sw = el.querySelector('.mapstudio-edit-switch') as HTMLElement | null;
        let row = 'top';
        if (toolbar && sw && toolbar.offsetWidth > 0) {
            const width = el.clientWidth;
            const left = width / 2 - toolbar.offsetWidth / 2;
            const right = width / 2 + toolbar.offsetWidth / 2;
            const switchLeft = sw.getBoundingClientRect().left - el.getBoundingClientRect().left;
            row = left >= TOOLBAR_INSET_PX && switchLeft - right >= TOOLBAR_INSET_PX ? 'top' : 'under';
        }
        if (stage.getAttribute('data-toolbar-row') !== row) {
            stage.setAttribute('data-toolbar-row', row);
        }
    }

    /** The map's height as a CSS variable, so a floating panel (the legend, entry 3) never grows past the map. */
    private publishHeight(): void {
        if (this.mapContainer) {
            // On the map and on the stage beside it, so what floats over the map in the stage (the drawing bar, entry 4) reads them too.
            for (const el of [this.mapContainer, this.mapContainer.parentElement]) {
                if (el) {
                    el.style.setProperty('--mapstudio-map-height', this.mapContainer.clientHeight + 'px');
                    el.style.setProperty('--mapstudio-map-width', this.mapContainer.clientWidth + 'px');
                }
            }
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

    componentDidUpdate(prevProps: Readonly<Props>): void {
        if (this.props.delegate && this.props.delegate.level !== null) {
            this.lastLevel = this.props.delegate.level;
        }
        const modeChanged = this.applyEditMode(prevProps);
        // The page's selectedItem, beside its editMode (entry 14): a write of its own is read now and applied below, once the mode
        // it was written with is in force (a mode set here takes effect on the next update).
        selection.readPageSelection(this, prevProps.props.selectedItem);
        this.applyUserLocation();
        this.applyStudioControls();
        this.applyHistory();
        this.applyTopBar();
        this.applyBoxZoom();
        this.dropDeadSelection();
        basemap.applyBasemap(this);
        this.drawItems();
        this.dropQueuedFeatures();
        editing.applyEditing(this);
        editing.applyHandles(this);
        this.placeToolbar();
        camera.applyStartingArea(this);
        if (!modeChanged) {
            selection.applyPageSelection(this);
        }
        camera.applyRestore(this);
        camera.saveSelection(this);
    }

    /**
     * Edit mode from the level and the prop (epic 4 entry 2, contract 0.4.0): a session at level `phone` or `none`
     * is in View mode whatever the prop says, which is left as written; at level `full` the prop's change enters
     * or leaves Edit mode when it differs from the model, so the component's own write coming back (the switch,
     * the rail's View), which already matches the model, never re-enters it. `selectedItem` is read beside it (entry 14,
     * componentDidUpdate). True when the mode was set here, so a page's choice of an item written with it waits for it.
     */
    private applyEditMode(prevProps: Readonly<Props>): boolean {
        const delegate = this.props.delegate;
        const level = delegate ? delegate.level : null;
        const editing = isEditing(this.state.studio);
        if ((level !== null && level !== 'full') || this.phoneWidth()) {
            // A phone or viewer session (and phone widths, which keep View mode) stays in View mode, the prop as written.
            if (editing) {
                this.setEditMode(false, false);
                return true;
            }
            return false;
        }
        const wanted = this.props.props.editMode;
        if (prevProps.props.editMode !== wanted && wanted !== editing) {
            this.setEditMode(wanted, false);
            return true;
        }
        return false;
    }

    /**
     * The mode set by the Edit switch, the rail's View (both write the prop back) or the page's prop write (not
     * written back): leaving puts every tool down and keeps the selection; entering opens Items and closes an open
     * popup, line popup, sheet or pick list (entry 26: Edit mode opens none, so no card stays over the studio), the
     * Gateway told with popup.close as when it is closed by hand, and keeps the selection, so the page sees no change
     * of selection and no Details opens for it (selection.tsx `dismissPopup`).
     */
    private setEditMode(on: boolean, writeProp: boolean): void {
        if (on) {
            selection.dismissPopup(this);
            // The list's view starts fresh with each Edit-mode session, and is kept while it lasts (entry 7c).
            this.listView = newListView();
        } else {
            editing.putToolDown(this);
            this.boxSelect.cancel();
        }
        // View mode has no selection of several (entry 8): leaving Edit mode keeps the current item alone, the last to join.
        this.setState((prev) => ({
            studio: on ? enterEdit(prev.studio) : leaveEdit(prev.selected && isMultiple(prev.studio) ? select(prev.studio, prev.selected.id) : prev.studio),
            layersTab: on ? 'layers' : prev.layersTab, listOpen: false
        }));
        if (writeProp) {
            try {
                this.props.store.props.write('editMode', on);
            } catch (err) {
                console.warn('[MapStudio] The editMode prop could not be written: ' + (err instanceof Error ? err.message : String(err)));
            }
        }
        console.info('[MapStudio] ' + (on ? 'Edit' : 'View') + ' mode' + (writeProp ? ' (the editMode prop written)' : '') + '.');
    }

    /**
     * The Edit switch (entry 2): added top-right above the zoom card once map.load says the level is full (never
     * at phone width, which keeps View mode), removed when a later load says otherwise, and set to the mode.
     */
    private applyStudioControls(): void {
        const map = this.map;
        if (!map) {
            return;
        }
        const delegate = this.props.delegate;
        const level = delegate ? delegate.level : null;
        if (level === 'full' && !this.editSwitch && !this.phoneWidth()) {
            this.editSwitch = new EditSwitch(this.onEditSwitch);
            map.addControl(this.editSwitch, 'top-right');
            const el = this.editSwitch.element();
            if (el && el.parentElement && el.parentElement.firstChild !== el) {
                // Above the zoom card: MapLibre appends a top corner's controls in the order they were added.
                el.parentElement.insertBefore(el, el.parentElement.firstChild);
            }
        } else if (level !== null && level !== 'full' && this.editSwitch) {
            map.removeControl(this.editSwitch);
            this.editSwitch = null;
        }
        if (this.editSwitch) {
            this.editSwitch.setOn(isEditing(this.state.studio));
        }
    }

    /**
     * The View-mode top bar and Legend while the studio shows (entries 21 and 22; DESIGN.md Edit mode, Direction A): the
     * stylesheet hides the search field and the Needs you bar under `mapstudio--editing` (the search is the Items list's
     * there) and the toolbar takes the top row, and hides the Legend button (the legend is the rail's Layers surface
     * there; the scale bar stays). As the studio comes on, however it came (the switch, the page's prop, the level
     * arriving), an open search or Needs you list and an open Legend panel close and the focus leaves the bar and the
     * legend, so nothing is open behind a hidden control and nothing comes back open when Edit mode is left; the focus
     * no longer returns to a control that is hidden.
     */
    private applyTopBar(): void {
        const on = this.studioOn();
        if (on && !this.studioWasOn) {
            // A field, the bar or the Legend keeping the focus while hidden (the page's prop turned Edit mode on) would take
            // keys and open its list or panel behind the hidden control: the focus leaves it first.
            const active = typeof document !== 'undefined' ? document.activeElement as HTMLElement | null : null;
            const topbar = this.mapContainer ? this.mapContainer.querySelector('.mapstudio-topbar') : null;
            const legend = this.mapContainer ? this.mapContainer.querySelector('.mapstudio-legend') : null;
            if (active && ((topbar && topbar.contains(active)) || (legend && legend.contains(active))) && typeof active.blur === 'function') {
                active.blur();
            }
            if (this.searchControl) {
                this.searchControl.close();
            }
            if (this.needsYouControl) {
                this.needsYouControl.close(false);
            }
            if (this.legendControl) {
                this.legendControl.close(false);
            }
            this.openedBy = null;
        }
        this.studioWasOn = on;
    }

    /**
     * MapLibre's Shift-drag box zoom (entry 8): off while the studio shows, where Shift-drag draws the selection's box, and on again in
     * View mode, as before. `data-box-zoom` on the map says which, for the suite.
     */
    private applyBoxZoom(): void {
        const on = !this.studioOn();
        const current = this.state.selected;
        if (on && current && isMultiple(this.state.studio)) {
            // The studio stopped showing with Edit mode still on (below 768 px, the level dropped): no selection of several there,
            // so the set is cut to its current item, as leaving Edit mode does.
            console.info('[MapStudio] The studio is not shown: the selection keeps ' + current.id + ' alone.');
            this.setState((prev) => (prev.selected && isMultiple(prev.studio) ? { studio: select(prev.studio, prev.selected.id) } : null));
        }
        const map = this.map;
        if (!map || !map.boxZoom) {
            return;
        }
        if (map.boxZoom.isEnabled() !== on) {
            if (on) {
                map.boxZoom.enable();
            } else {
                map.boxZoom.disable();
                this.boxSelect.cancel();
            }
        }
        if (this.mapContainer && this.mapContainer.getAttribute('data-box-zoom') !== (on ? 'on' : 'off')) {
            this.mapContainer.setAttribute('data-box-zoom', on ? 'on' : 'off');
        }
    }

    /**
     * A selected item that left the map (an undo of its add, another editor's delete) leaves the selection too; in a set of several
     * (entry 8) each item gone leaves it, the others staying.
     */
    private dropDeadSelection(): void {
        const selected = this.state.selected;
        const delegate = this.props.delegate;
        if (!delegate || delegate.load.state !== 'loaded') {
            return;
        }
        const set = this.state.studio.selected;
        if (set.length >= 2) {
            const kept = set.filter((id) => !!this.itemFor(id));
            if (kept.length < set.length) {
                console.info('[MapStudio] ' + (set.length - kept.length) + ' selected item(s) are no longer on the map.');
                this.changeSelection((s) => selectMany(s, kept));
            }
            return;
        }
        if (selected && !this.itemFor(selected.id)) {
            console.info('[MapStudio] The selected item ' + selected.id + ' is no longer on the map.');
            selection.clearSelection(this);
        }
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
        publishYouAreHere(map, el);
    }

    /** Where a point item's popup anchors: the marker drawn for it, which for a member of a shared marker is the group's (item 20). */
    anchorFor(id: string, lngLat: [number, number]): [number, number] {
        return this.anchors[id] || lngLat;
    }

    /** A control's rectangle in map pixels, or null when it is not there (camera.ts). */
    controlRect(selector: string): Rect | null { return camera.controlRect(this, selector); }

    /** The camera padding of the moment (item 27; camera.ts): what a centred item, or one brought into view, keeps clear of. */
    cameraPadding(): CameraPadding { return camera.cameraPadding(this); }

    /** Fit and Return (epic 3 entry 7; camera.ts): the zoom card's buttons. */
    onFit = (): void => camera.onFit(this);
    onReturn = (): void => camera.onReturn(this);

    /** Fit bounds inside the visible area (item 27; camera.ts). */
    fitTo(bounds: Bounds): void { camera.fitTo(this, bounds); }

    /** A search result or a Needs you row chosen (entries 9 and 3; camera.ts goToItem). */
    onSearchChoose = (result: SearchResult): void => camera.onSearchChoose(this, result);
    /** The page's choice in View mode (entry 14, selection.tsx applyPageSelection): as the search's, a line with its popup too. */
    goToPageItem(id: string): void {
        this.openedBy = null;
        camera.goToItem(this, id, 'The page', '(selectedItem)', true);
    }
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

    /** The selection's attributes, the zoom card's Return, and the page's selectedItem and onItemSelected (selection.tsx). */
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
        camera.stopViewport(this);
        if (typeof window !== 'undefined') {
            window.removeEventListener('storage', this.onStorage);
        }
        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        if (delegate) {
            // Recent changes stop reading (entry 11b): a remount with History open asks afresh.
            if (typeof delegate.setHistoryOpen === 'function') {
                delegate.setHistoryOpen(false);
            }
            delegate.stopReplay();
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this.collapseQuery) {
            if (typeof this.collapseQuery.removeEventListener === 'function') {
                this.collapseQuery.removeEventListener('change', this.onCollapseChange);
            }
            this.collapseQuery = null;
        }
        if (this.themeWatch) {
            this.themeWatch.stop();
            this.themeWatch = null;
        }
        if (this.mapContainer) {
            this.mapContainer.removeEventListener('keydown', this.onKeyDown, true);
        }
        this.boxSelect.detach();
        // The handle layers leave before Terra Draw's own source does (entry 5).
        editing.stopTerraDraw(this);
        this.lineMode = null;
        this.areaMode = null;
        this.selectMode = null;
        if (this.popupSizeObserver) {
            this.popupSizeObserver.disconnect();
            this.popupSizeObserver = null;
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
        this.editSwitch = null;
        this.legendControl = null;
        this.logoControl = null;
        this.zoomControl = null;
        this.searchControl = null;
    }

    /** The tools (editing.ts): Terra Draw's finish and change events and the container's Escape and Backspace. */
    onDrawFinish = (id: string | number, context: { mode: string; action: string }): void => editing.onDrawFinish(this, id, context);
    onDrawChange = (ids: Array<string | number>, type: string): void => editing.onDrawChange(this, ids, type);
    onKeyDown = (ev: KeyboardEvent): void => editing.onKeyDown(this, ev);

    /**
     * The drawing in progress (entry 4, drawing.ts), or none. Built from the state being updated (`prev` of a
     * functional setState), so writes batched into one update compose.
     */
    drawingState(_prev: Readonly<MapStudioState>, drawing: Drawing | null): Pick<MapStudioState, 'drawing'> {
        return { drawing };
    }

    /**
     * A tool picked up, with the kind a kind button fixed (null for a generic tool), or put down with null, with the studio
     * model (studio.ts); a drawing in progress goes with the tool before it. From `prev` as above.
     */
    toolState(prev: Readonly<MapStudioState>, tool: StudioTool | null, kindId: string | null):
        Pick<MapStudioState, 'drawing' | 'snapHint' | 'studio' | 'geometry'> {
        // A chosen point and Move are Select's (entry 5): picking a tool, or putting one down, drops them.
        return { drawing: null, snapHint: '', studio: pickTool(prev.studio, tool, kindId), geometry: null };
    }

    /**
     * A selection with the studio model that goes with it: the item's id selected, or nothing (studio.ts); from `prev` as
     * above. The Details panel stays only for the item it is open for; a row click, a placement or a click in Edit mode (entry 26)
     * sets it after this.
     */
    selectionState(prev: Readonly<MapStudioState>, selected: Selection | null): Pick<MapStudioState, 'selected' | 'studio' | 'panel' | 'geometry'> {
        return {
            selected,
            // An instrument being placed stays only while its line is the item selected (entry 9).
            studio: keepArmed(selected ? select(prev.studio, selected.id) : clearSelection(prev.studio)),
            panel: selected !== null && prev.panel === selected.id ? prev.panel : null,
            // A chosen point and Move stay with their item only (entry 5).
            geometry: selected !== null && prev.geometry !== null && prev.geometry.itemId === selected.id ? prev.geometry : null
        };
    }

    /**
     * The selection as a set (entry 8; studio.ts): `change` makes the new set from the studio model, and the rest follows it from
     * `prev`: the current item is the last to join (its kind read from its geometry, a line's open segment kept only while it stays
     * current), and a chosen point or Move stay only while the set is that one item still. Two or more show the count's panel
     * (`renderPanel`); a set of one shows that item's Details, as one item selected does today (no camera move), except right after
     * a checkbox ticked into an empty set (`tick`), which opens no Details (the plan's checkbox rule).
     */
    selectionSetState(prev: Readonly<MapStudioState>, change: (studio: StudioState) => StudioState, tick = false):
        Pick<MapStudioState, 'selected' | 'studio' | 'panel' | 'geometry' | 'pick'> {
        const studio = keepArmed(change(prev.studio));
        const ids = studio.selected;
        const id = ids.length > 0 ? ids[ids.length - 1] : null;
        let selected: Selection | null = null;
        if (id !== null) {
            const item = this.itemFor(id);
            selected = prev.selected && prev.selected.id === id ? prev.selected
                : { id, kind: item && item.geometry.type === 'Point' ? 'point' : 'line', segment: null };
        }
        const single = ids.length === 1;
        return {
            selected,
            studio,
            pick: null,
            panel: single && (prev.panel === id || !(tick && prev.studio.selected.length === 0)) ? id : null,
            geometry: single && prev.geometry !== null && prev.geometry.itemId === id ? prev.geometry : null
        };
    }

    /**
     * A change of the set (entry 8): a box, a lasso, Shift-click, a checkbox, a range, Select all, Clear. The count's panel may dock or
     * leave, so it is a dock change: the ground keeps its place on the page (selection.tsx `dockChange`).
     */
    changeSelection(change: (studio: StudioState) => StudioState, tick = false): void {
        selection.closePopup(this);
        this.dockChange((prev) => this.selectionSetState(prev, change, tick));
    }

    /** Shift-click on the map (entry 8): each id in or out of the set (a shared marker's members together: out if all are in). */
    toggleInSelection = (ids: string[]): void => {
        this.changeSelection((s) => {
            const allIn = ids.every((id) => s.selected.indexOf(id) >= 0);
            return allIn ? selectMany(s, s.selected.filter((id) => ids.indexOf(id) < 0)) : addMany(s, ids);
        });
        console.info('[MapStudio] Shift-click: ' + ids.join(', ') + ' toggled in the selection.');
    };

    /** A released box or lasso (entry 8, multiSelect.ts): what it took joins the set, in the items' order. */
    addToSelection = (ids: string[], shape: DragShape): void => {
        console.info('[MapStudio] The ' + shape + ' took ' + ids.length + ' item(s)' + (ids.length > 0 ? ': ' + ids.join(', ') : '') + '.');
        if (ids.length > 0) {
            this.changeSelection((s) => addMany(s, ids));
        }
    };

    /** Whether a Shift-drag draws the box or the lasso now: the studio shows and no tool is in hand (the Select tool). */
    boxSelectOn(): boolean {
        return this.studioOn() && this.state.studio.tool === null && this.state.drawing === null;
    }

    /**
     * The live items as the box and the lasso test them (entry 8), in the map's container pixels now: a point where its marker is
     * drawn (a shared marker's members at the group's place), a line's vertices, an area's ring. Items not drawn (the store paused)
     * are left out.
     */
    shapeItems(): ShapeItem[] {
        const map = this.map;
        const delegate = this.props.delegate;
        if (!map || !delegate || (delegate.editing === 'off' && !delegate.savePaused)) {
            return [];
        }
        const px = (c: [number, number]): [number, number] => {
            const p = map.project(c);
            return [p.x, p.y];
        };
        const out: ShapeItem[] = [];
        for (const item of delegate.items) {
            if (item.deleted) {
                continue;
            }
            if (item.geometry.type === 'Point') {
                out.push({ id: item.id, type: 'point', at: px(this.anchorFor(item.id, [item.geometry.coordinates[0], item.geometry.coordinates[1]])) });
                continue;
            }
            const kind = delegate.lists.kinds.find((k) => k.id === item.kind);
            const path = item.geometry.coordinates.map((c) => px([c[0], c[1]]));
            out.push(kind && kind.area ? { id: item.id, type: 'area', ring: path } : { id: item.id, type: 'line', path });
        }
        return out;
    }

    /** A row's checkbox (entry 8): the row in or out of the set, the map not moved; ticked into an empty set it opens no Details. */
    onRowToggle = (id: string): void => {
        if (!this.itemFor(id)) {
            return;
        }
        this.changeSelection((s) => toggleSelect(s, id), true);
    };

    /** A Shift-click range or a Select all in the list (entry 8): the set replaced by those rows, in the order shown. */
    onSelectRows = (ids: string[]): void => {
        const live = ids.filter((id) => !!this.itemFor(id));
        this.changeSelection((s) => selectMany(s, live));
        console.info('[MapStudio] ' + live.length + ' row(s) selected in the list.');
    };

    /** The count's Clear (entry 8): the set emptied, the panel closed. */
    onClearSelection = (): void => {
        this.changeSelection((s) => clearSelection(s));
    };

    /**
     * Keys on the component: Ctrl+Z and Ctrl+Shift+Z (or Ctrl+Y) undo and redo in Edit mode outside a field (a
     * field keeps its own undo); Delete outside a field deletes the selected item, or with a point of the selected line or area
     * chosen that point (entry 25, editing.ts `onDeleteKey`; a field keeps its own Delete); Esc closes the open popup, card,
     * sheet or pick list and returns the focus (item 14; selection.tsx), else Details; an Esc the map container's listener took
     * to put a tool down comes here handled and does nothing more (entry 26, editing.ts `onKeyDown`).
     */
    private onRootKeyDown = (ev: React.KeyboardEvent<HTMLDivElement>): void => {
        if (ev.key === 'Delete' && !ev.defaultPrevented && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !inField(ev.target)) {
            if (editing.onDeleteKey(this)) {
                ev.preventDefault();
            }
            return;
        }
        if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && (ev.key === 'z' || ev.key === 'Z' || ev.key === 'y' || ev.key === 'Y')) {
            // A field keeps its own undo; a checkbox (a ticked list row, entry 8) is not one (drawing.ts `inField`).
            if (!inField(ev.target) && this.studioOn()) {
                ev.preventDefault();
                if (ev.shiftKey || ev.key === 'y' || ev.key === 'Y') {
                    this.onRedo();
                } else {
                    this.onUndo();
                }
                return;
            }
        }
        if (ev.key === 'Escape' && !ev.defaultPrevented && (!inField(ev.target) || inListOverlay(ev.target)) && this.state.listOpen
            && this.listOverlayShown()) {
            // A field elsewhere (a Details select) keeps its own Esc; the list's own search field, emptied, lets it close the list.
            // The collapsed list open over the map closes first (entry 7c), one press one step; the focus back on the rail's Items.
            ev.preventDefault();
            this.closeListOverlay(true);
            return;
        }
        if (ev.key === 'Escape' && !ev.defaultPrevented && !inField(ev.target) && editing.disarmInstrument(this)) {
            // Esc puts down the instrument being placed (entry 9) before it closes Details: one press, one step.
            ev.preventDefault();
            return;
        }
        if (ev.key === 'Escape' && !ev.defaultPrevented && !inField(ev.target) && editing.escapeGeometry(this)) {
            // Esc puts down Move, then the chosen point (entry 5), before it closes a popup or Details.
            ev.preventDefault();
            return;
        }
        selection.onRootKeyDown(this, ev);
    };

    /**
     * A click on the map: with Select in hand, Move's new place or a click on a handle first (entry 5, editing.ts); else the
     * selection's (selection.tsx): a marker's popup or pick list, a line's popup (in Edit mode Details instead, and an area's
     * Details too, entry 26), or the ground clearing the selection.
     */
    private onMapClick = (ev: MapMouseEvent): void => {
        if (this.state.listOpen) {
            // A click on the map closes the collapsed list open over it (entry 7c), as it closes the legend, and goes on as a click.
            this.closeListOverlay(false);
        }
        if (editing.onArmedClick(this, ev) || editing.onGeometryClick(this, ev)) {
            // An instrument being placed takes the click first (entry 9), then Move or a handle (entry 5).
            return;
        }
        selection.onMapClick(this, ev);
    };

    /** The selection and the popups (selection.tsx), which the camera's restore and choices open as a click does (in Edit mode Details, entry 26). */
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

    /** The map item on the map, or the one this page placed and has not yet saved (the Point tool's create in flight). */
    itemFor(id: string): MapItemRecord | undefined {
        const live = this.liveItem(id);
        if (live) {
            return live;
        }
        const delegate = this.props.delegate;
        if (!delegate) {
            return undefined;
        }
        // A create held behind another save (entry 9: an instrument added while its line is saved) is an item too, version 0.
        return unsavedItems(delegate.unsaved).find((i) => i.id === id) || (delegate.heldCreates || []).find((i) => i.id === id);
    }

    /**
     * Whether the studio's surfaces show: Edit mode at level full (entry 2), never at phone widths (which keep View
     * mode). While a failed load leaves the level unknown (the store unreachable), the level last reported counts, so
     * the studio of a full session stays and pauses rather than vanishing (entry 4).
     */
    studioOn(): boolean {
        const delegate = this.props.delegate;
        if (!delegate) {
            return false;
        }
        const level = delegate.level !== null ? delegate.level : this.lastLevel;
        return isEditing(this.state.studio) && level === 'full' && !this.phoneWidth();
    }

    /** Below 768 px (the viewport's width, as the stylesheet's phone rules read it): no studio, no switch, View mode kept. */
    private phoneWidth(): boolean {
        if (this.mapContainer) {
            return isSheetWidth(sheetBasisWidth(this.mapContainer));
        }
        return typeof window !== 'undefined' && window.innerWidth > 0 ? isSheetWidth(window.innerWidth) : false;
    }

    /**
     * Recent changes (entry 11b): the delegate reads the edit record while the History surface shows (Edit mode's studio on, the
     * rail's History), asking the first page as it opens and again on each map.changed meanwhile; nothing is read otherwise.
     */
    private applyHistory(): void {
        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        if (delegate && typeof delegate.setHistoryOpen === 'function') {
            delegate.setHistoryOpen(this.studioOn() && this.state.studio.surface === 'history');
        }
    }

    /** The save status's "Saved" pressed (EXPERIENCE.md Save status: a click opens Recent changes): the rail's History. */
    onShowHistory = (): void => this.onRailSurface('history');

    private onHistoryOlder = (): void => {
        const delegate = this.storeDelegate();
        if (delegate) {
            delegate.historyOlder();
        }
    };

    private onHistoryRetry = (): void => {
        const delegate = this.storeDelegate();
        if (delegate) {
            delegate.historyRetry();
        }
    };

    /** A row's Revert (entry 11b): its reverse sent as an ordinary edit, one undo step; a placed pin would be stale, so it goes. */
    onRevert = (seq: number): void => {
        const delegate = this.storeDelegate();
        if (delegate) {
            editing.clearPlacedPoints(this);
            delegate.revert(seq);
        }
    };

    /** The Edit switch (entry 2) and the rail's View: the mode, written back to the editMode prop. */
    onEditSwitch = (on: boolean): void => this.setEditMode(on, true);
    onRailView = (): void => this.setEditMode(false, true);
    /**
     * The rail's surfaces (entry 2). Above 1280 px each docks in the list's place. Below it (entry 7c, the owner's option A) the list
     * is not docked: Items opens it over the map's left edge, and Items again closes it; another surface docks in its place as
     * before. A surface that docks or leaves moves the map's box, so it is a dock change (the ground keeps its place).
     */
    onRailSurface = (surface: StudioSurface): void => {
        const collapsed = this.state.listCollapsed;
        if (collapsed && surface === 'items' && this.state.studio.surface === 'items') {
            if (this.state.listOpen) {
                this.closeListOverlay(false);
            } else {
                this.setState({ listOpen: true });
            }
            return;
        }
        const open = collapsed && surface === 'items';
        this.dockChange((prev) => ({ studio: showSurface(prev.studio, surface), listOpen: open }), this.selectedPlace());
    };

    /** Whether the collapsed list shows over the map: Edit mode's studio on, below 1280 px, on Items, opened from the rail. */
    private listOverlayShown(): boolean {
        return this.state.listCollapsed && this.state.listOpen && this.state.studio.surface === 'items' && this.studioOn();
    }

    /** The collapsed list closed (entry 7c); after Esc the focus goes back to the rail's Items, which opened it. */
    private closeListOverlay(focusRail: boolean): void {
        this.setState({ listOpen: false });
        const root = this.mapContainer && typeof this.mapContainer.closest === 'function' ? this.mapContainer.closest('.mapstudio') : null;
        const items = focusRail && root ? root.querySelector('.mapstudio-rail-item[data-surface="items"]') as HTMLElement | null : null;
        if (items) {
            items.focus();
        }
    }

    /** A list row clicked (EXPERIENCE.md List row): the item selected, properties open, the map panned to it; no popup. */
    onRowSelect = (id: string): void => {
        const item = this.itemFor(id);
        const map = this.map;
        if (!item || !map) {
            return;
        }
        selection.closePopup(this);
        this.fitKey = null;
        if (this.state.listOpen) {
            // A row chosen in the collapsed list closes it (entry 7c); the row's selection, Details and camera are as today. The row
            // goes with the list, so the focus moves to the map first, where Esc, Delete and Ctrl+Z act on the selection.
            this.setState({ listOpen: false });
            const canvas = typeof map.getCanvas === 'function' ? map.getCanvas() : null;
            if (canvas) {
                canvas.focus({ preventScroll: true });
            }
        }
        if (item.geometry.type === 'Point') {
            this.setState((prev) => ({ ...this.selectionState(prev, { id, kind: 'point' }), pick: null, panel: id }));
            const at = this.anchorFor(id, [item.geometry.coordinates[0], item.geometry.coordinates[1]]);
            map.easeTo({ center: at, padding: camera.cameraPadding(this), duration: 300 });
        } else {
            this.selectLine(id);
            this.setState({ panel: id });
            this.fitTo(camera.boundsOf(item.geometry.coordinates));
        }
        this.publishFit();
    };

    /**
     * Details' Zoom to location (entry 27): the map moves to the selected point as saved, at zoom 15 or more (the search's chosen
     * point zoom), centred in what a person sees (the camera padding, as a row's pan); the selection and Details stay. A move of
     * the component's own, so a kept Fit ends here.
     */
    onZoomToLocation = (): void => {
        const selected = this.state.selected;
        const item = selected ? this.itemFor(selected.id) : undefined;
        const map = this.map;
        if (!item || !map || item.geometry.type !== 'Point') {
            return;
        }
        this.fitKey = null;
        map.easeTo({ center: [item.geometry.coordinates[0], item.geometry.coordinates[1]], zoom: Math.max(map.getZoom(), CHOSEN_POINT_ZOOM),
            padding: camera.cameraPadding(this), duration: 300 });
        this.publishFit();
    };

    /**
     * The page's userLocation (entry 15; userLocation.ts): read into one state, which draws the marker (moved with each new
     * position, the camera left where it is), sets Locate me and puts the legend's "You are here" row in or out, all three
     * from the same reading, and from entry 16 the search's Nearest and the Needs you rows' distances. A re-render with the same
     * value does nothing; `data-you-*` on the map are for the suite.
     */
    private applyUserLocation(): void {
        const loc = readUserLocation(this.props.props.userLocation);
        const key = userLocationKey(loc) + (this.itemsReady ? '|drawn' : '');
        if (key === this.drawnLocation) {
            return;
        }
        this.drawnLocation = key;
        this.userLocation = loc;
        if (this.map && this.itemsReady) {
            setYouAreHere(this.map, loc);
        }
        if (this.zoomControl) {
            this.zoomControl.setLocate(loc.state);
        }
        if (this.legendControl) {
            this.legendControl.setYouAreHere(loc.state === 'fix');
        }
        // Nearest in the search and the distances on Needs you rows (entry 16) follow the same reading.
        const position = loc.state === 'fix' && loc.position ? loc.position : null;
        if (this.searchControl) {
            this.searchControl.setPosition(position);
        }
        if (this.needsYouControl) {
            this.needsYouControl.setPosition(position);
        }
        const el = this.mapContainer;
        if (el) {
            el.setAttribute('data-you-are-here', loc.state);
            el.setAttribute('data-you-at', loc.position ? JSON.stringify(loc.position) : '');
            el.setAttribute('data-you-accuracy', loc.accuracy === undefined ? '' : String(loc.accuracy));
            el.setAttribute('data-you-heading', loc.heading === undefined ? '' : String(loc.heading));
        }
    }

    /**
     * Locate me (entry 15, the zoom card's last button): with a position the map eases to it at zoom 15, or the current zoom
     * if closer, centred in what a person sees (the camera padding), as Zoom to location does; a move of the component's own,
     * so a kept Fit ends here. Without a position the button is inert and this does nothing. The map never follows.
     */
    onLocate = (): void => {
        const loc = this.userLocation;
        const map = this.map;
        if (!map || loc.state !== 'fix' || !loc.position) {
            return;
        }
        this.fitKey = null;
        map.easeTo({ center: loc.position, zoom: Math.max(map.getZoom(), LOCATE_ZOOM), padding: camera.cameraPadding(this), duration: 300 });
        this.publishFit();
    };

    /** The properties panel's close (EXPERIENCE.md: closes with close or Esc): the selection goes. */
    onPanelClose = (): void => selection.clearSelection(this);
    onNameFocused = (): void => { this.focusNameId = null; };

    /** The Details fields, each saving when it is finished (one batch each, the delegate's). */
    onRename = (name: string): void => {
        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        const selected = this.state.selected;
        if (delegate && selected) {
            delegate.renameItem(selected.id, name);
        }
    };
    onMove = (lngLat: [number, number]): void => {
        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        const selected = this.state.selected;
        if (delegate && selected) {
            // A typed place moves the pin too, if the Point tool still holds one for the item.
            editing.clearPlacedPoints(this);
            delegate.moveItem(selected.id, lngLat);
        }
    };
    onLink = (assetId: string | null): void => {
        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        const selected = this.state.selected;
        if (delegate && selected) {
            delegate.linkItem(selected.id, assetId);
        }
    };
    /** A finished field of the item's kind (entry 6): one update of its whole `properties`, the value kept for the next of the kind. */
    onProperty = (key: string, value: FieldValue): void => {
        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        const selected = this.state.selected;
        if (delegate && selected) {
            delegate.editProperty(selected.id, key, value);
        }
    };

    /** The toolbar (entries 2 and 4): Select puts every tool down; a tool or kind button picks its tool up; Snap toggles. The bar's Done puts the Point tool down. */
    onSelectTool = (): void => editing.putToolDown(this);
    onTool = (tool: StudioTool, kindId: string | null): void => editing.pickTool(this, tool, kindId);
    onSnap = (): void => editing.toggleSnap(this);
    /** The list footer's Add item (entry 7a): the generic Point tool picked up, as the toolbar's Point does. */
    onAddItem = (): void => editing.pickTool(this, 'point', null);

    /** The drawing bar (entry 4): Finish as Enter, Cancel as Esc. */
    onFinishDrawing = (): void => editing.finishDrawing(this);
    onCancelDrawing = (): void => editing.cancelDrawing(this);

    /**
     * Details' Move beside a point item's Location (entry 5): the tool in hand is put down (Move is Select's) and the next click
     * on the map is the item's new place; pressed again while it waits, Move is put down, as Esc does.
     */
    onMoveByClick = (): void => {
        const selected = this.state.selected;
        if (!selected || (this.props.delegate && this.props.delegate.editing === 'off')) {
            return;
        }
        const pick = this.state.geometry;
        if (pick && pick.itemId === selected.id && pick.moving) {
            editing.escapeGeometry(this);
            return;
        }
        if (this.state.studio.tool !== null) {
            editing.putToolDown(this);
        }
        this.setState((prev) => (prev.selected && prev.selected.id === selected.id ? { geometry: { itemId: selected.id, index: null, moving: true } } : null));
    };

    /** Add an instrument in a line's Details (entry 9), its kind picked: armed on the line; the drawing bar says how to place it. */
    onAddInstrument = (kindId: string): void => {
        const selected = this.state.selected;
        if (selected) {
            editing.armInstrument(this, selected.id, kindId);
        }
    };
    /** The placement bar (entry 9): Place with the typed distance, Cancel as Esc. */
    onPlaceInstrument = (text: string): void => editing.placeTyped(this, text);
    onCancelInstrument = (): void => {
        editing.disarmInstrument(this);
    };
    /** An instrument's distance typed in its Details (entry 9): it moves there along its line, one change. */
    onMoveAlong = (distanceM: number): void => {
        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        const selected = this.state.selected;
        if (delegate && selected) {
            delegate.moveInstrument(selected.id, distanceM);
        }
    };

    /** The geometry bar (entry 5): Move for the chosen point, Cancel (as Esc), Split here and Delete point, each one batch. */
    onGeometryMove = (): void => this.setState((prev) => (prev.geometry
        ? { geometry: { itemId: prev.geometry.itemId, index: prev.geometry.index, moving: true } } : null));
    onGeometryCancel = (): void => {
        editing.escapeGeometry(this);
    };
    onSplitHere = (): void => {
        const pick = this.state.geometry;
        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        if (!pick || pick.index === null || !delegate) {
            return;
        }
        const line = this.itemFor(pick.itemId);
        const at: [number, number] | null = line && line.geometry.type === 'LineString' && line.geometry.coordinates[pick.index]
            ? [line.geometry.coordinates[pick.index][0], line.geometry.coordinates[pick.index][1]] : null;
        const partId = delegate.splitLine(pick.itemId, pick.index);
        if (partId === null) {
            return;
        }
        // The new part opens in Details with Name focused, as an added item does (owner, 2026-11-06); if Details docks for it, the
        // ground keeps its place and the split point is eased into view if the panel covers it (entry 7c).
        this.focusNameId = partId;
        selection.closePopup(this);
        this.dockChange((prev) => ({ ...this.selectionState(prev, { id: partId, kind: 'line', segment: null }), pick: null, panel: partId, geometry: null }), at);
    };
    onDeletePoint = (): void => editing.deletePoint(this);
    /** The properties panel's footer delete (entry 25): the selected item deleted, no question asked, one undo step. */
    onDeleteItem = (): void => {
        editing.deleteSelected(this);
    };

    /** The Kind select in Details (entry 4): one update of `kind` to a kind of the item's geometry. */
    onKind = (kindId: string): void => {
        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        const selected = this.state.selected;
        if (delegate && selected) {
            delegate.setKind(selected.id, kindId);
        }
    };

    /** Undo and Redo (entries 2 and 23, the toolbar's): the delegate sends the reverse batch; a placed pin would be stale, so it goes. */
    onUndo = (): void => {
        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        if (delegate) {
            editing.clearPlacedPoints(this);
            delegate.undo();
        }
    };
    onRedo = (): void => {
        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        if (delegate) {
            editing.clearPlacedPoints(this);
            delegate.redo();
        }
    };
    /** A row of Undo's history chosen (entry 23): that step and every later one undone, one reverse batch at a time (the delegate's run). */
    onUndoTo = (count: number): void => {
        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        if (delegate) {
            editing.clearPlacedPoints(this);
            delegate.undoTo(count);
        }
    };

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
                    // With several selected (entry 8) every item in the set is ringed, as the map draws it.
                    const set = this.state.studio.selected;
                    const selected = set.length >= 2 ? null : this.state.selected;
                    const ringed = (set.length >= 2 && set.indexOf(id) >= 0) || (selected !== null && ((selected.kind === 'point' && selected.id === id)
                        || (selected.segment !== undefined && selected.segment !== null
                            && (selected.segment.fromId === id || selected.segment.toId === id))));
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
                             data-ringed={ringed ? 'true' : 'false'}
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

    /**
     * What the problems are read from (problems.ts, entry 24): the delegate's state, with the level map.load last
     * reported while a failed load leaves it unknown, so an editor's map keeps an editor's problems.
     */
    private problemFacts(delegate: MapStudioDelegateState): ProblemFacts {
        return {
            connection: delegate.connection,
            load: delegate.load,
            store: delegate.store,
            level: delegate.level !== null ? delegate.level : this.lastLevel,
            save: delegate.save,
            unsaved: delegate.unsaved,
            sending: delegate.sending,
            storageWarning: delegate.storageWarning,
            shapeRefused: delegate.shapeRefused
        };
    }

    /** The queued edit's Try again and Discard, on the waiting edits under the save status row (entry 24). */
    private onRetryUnsaved = (batchId: string): void => {
        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        // Try again forgets the batch's closed card (entry 10): its next answer shows a fresh card.
        if (this.state.cardsClosed.some((key) => key.indexOf(batchId + '|') === 0)) {
            this.setState((prev) => ({ cardsClosed: prev.cardsClosed.filter((key) => key.indexOf(batchId + '|') !== 0) }));
        }
        if (delegate) {
            delegate.retryUnsaved(batchId);
        }
    };
    private onDiscardUnsaved = (batchId: string): void => {
        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        if (delegate) {
            delegate.discardUnsaved(batchId);
        }
    };

    /** The save status row and the edits waiting under it, in a dock surface's header (entry 24: every surface says the problems). */
    private renderProblemStatus(delegate: MapStudioDelegateState, facts: ProblemFacts): React.ReactNode {
        return (
            <ProblemStatus save={delegate.save} problems={editProblems(facts)} unsaved={delegate.unsaved} records={delegate.items}
                           level={facts.level} sending={delegate.sending} onRetry={this.onRetryUnsaved} onDiscard={this.onDiscardUnsaved}
                           openRequest={this.state.showEdits} onOpenHandled={this.onShowEditsHandled} />
        );
    }

    /** The store delegate, for the save card's actions. */
    private storeDelegate(): MapStudioStoreDelegate | undefined {
        return this.props.store.delegate as MapStudioStoreDelegate | undefined;
    }

    /** The save card's actions (entry 10): the conflict's two choices, Try again, Discard my change, Show my 2 edits and Esc. */
    private onCardUseTheirs = (batchId: string): void => {
        const delegate = this.storeDelegate();
        if (delegate) {
            delegate.useTheirs(batchId);
        }
    };
    private onCardApplyOnTop = (batchId: string): void => {
        const delegate = this.storeDelegate();
        if (delegate) {
            delegate.applyOnTop(batchId);
        }
    };
    private onCardRetryStore = (): void => {
        const delegate = this.storeDelegate();
        if (delegate) {
            delegate.retryStore();
        }
    };
    private onCardClose = (closeKey: string): void => {
        this.setState((prev) => ({ cardsClosed: prev.cardsClosed.indexOf(closeKey) >= 0 ? prev.cardsClosed : prev.cardsClosed.concat([closeKey]) }));
    };
    /** "Show my 2 edits" (R5): the row's list of them opens in the dock; below 1280 px the Items list opens over the map first. */
    private onCardShowEdits = (): void => {
        const surface = this.state.studio.surface;
        this.setState((prev) => ({
            showEdits: prev.showEdits + 1,
            listOpen: prev.listCollapsed && surface === 'items' ? true : prev.listOpen
        }));
    };
    private onShowEditsHandled = (): void => {
        if (this.state.showEdits !== 0) {
            this.setState({ showEdits: 0 });
        }
    };

    /**
     * The save problems' card on the map under the toolbar (epic 4 entry 10, R26; studio/SaveCard.tsx): Edit mode only (View mode
     * keeps entry 24's chip), one at a time, unreachable then conflict then busy (unsaved.ts `saveCardFor`). Keyed by the card and
     * its entry, so a new card arrives as a new alert.
     */
    private renderSaveCard(delegate: MapStudioDelegateState, belowChip: boolean): React.ReactNode {
        const card = saveCardFor({
            unsaved: delegate.unsaved, paused: !!delegate.savePaused, dismissed: this.state.cardsClosed, records: delegate.items,
            kinds: delegate.lists.kinds, locale: browserLocale()
        });
        if (!card) {
            return null;
        }
        return (
            <SaveCard key={card.kind + ':' + card.batchId} card={card} sending={delegate.sending.indexOf(card.batchId) >= 0} belowChip={belowChip}
                      onUseTheirs={this.onCardUseTheirs} onApplyOnTop={this.onCardApplyOnTop} onRetry={this.onRetryUnsaved}
                      onRetryStore={this.onCardRetryStore} onDiscard={this.onDiscardUnsaved} onShowEdits={this.onCardShowEdits}
                      onClose={this.onCardClose} />
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

    /**
     * The Layers surface's open tab panel, the docked legend's host (entry 22), handed to the legend control as it mounts
     * and taken back (null) as it unmounts; the control draws the tab's part into it and React renders nothing inside it.
     * The panel is keyed by the tab, so choosing the other tab mounts a new one with the other part.
     */
    private setLayersHost = (el: HTMLDivElement | null): void => {
        this.layersHost = el;
        if (this.legendControl) {
            this.legendControl.dock(el, this.dockPart());
        }
    };

    /** The legend's part the open tab shows: the Layers tab the controls (Show, Basemap), the Legend tab the key. */
    private dockPart(): DockPart {
        return this.state.layersTab === 'legend' ? 'key' : 'controls';
    }

    private onLayersTab = (tab: LayersTab): void => this.setState({ layersTab: tab });

    /**
     * The rail's surface (entry 2): the item list with the panel header; Layers, the legend's desktop content docked under
     * two tabs as the properties panel's (entry 22: the Layers tab Show and Basemap, the Legend tab the key, drawn by the
     * legend control from the panel's own state); or the empty Kinds surface until its entry. Each surface is keyed, so
     * switching remounts it and the legend's host comes and goes whole.
     */
    private renderDock(delegate: MapStudioDelegateState): React.ReactNode {
        const surface = this.state.studio.surface;
        const facts = this.problemFacts(delegate);
        if (surface === 'layers') {
            const tab = this.state.layersTab;
            const id = this.layersTabsId;
            return (
                <section key="layers" className="mapstudio-dock mapstudio-dock--layers" aria-label="Layers" data-surface="layers" data-tab={tab}>
                    <header className="mapstudio-dock-header">
                        <div className="mapstudio-dock-title-row"><h2 className="mapstudio-dock-title">Layers</h2></div>
                        {this.renderProblemStatus(delegate, facts)}
                    </header>
                    <div className="mapstudio-panel-tabs" role="tablist" aria-label="Layers">
                        {LAYERS_TABS.map(([key, label]) => (
                            <button key={key} type="button" role="tab" id={id + '-' + key} data-tab={key} aria-selected={tab === key}
                                    aria-controls={id + '-panel'}
                                    className={'mapstudio-panel-tab' + (tab === key ? ' mapstudio-panel-tab--active' : '')}
                                    onClick={() => this.onLayersTab(key)}>{label}</button>
                        ))}
                    </div>
                    <div key={tab} id={id + '-panel'} className="mapstudio-dock-legend" role="tabpanel" aria-labelledby={id + '-' + tab}
                         ref={this.setLayersHost} />
                </section>
            );
        }
        if (surface === 'history') {
            return this.renderHistory(delegate, facts);
        }
        if (surface === 'kinds') {
            return (
                <section key="kinds" className="mapstudio-dock mapstudio-dock--empty" aria-label="Kinds" data-surface="kinds">
                    <header className="mapstudio-dock-header">
                        <div className="mapstudio-dock-title-row"><h2 className="mapstudio-dock-title">Kinds</h2></div>
                        {this.renderProblemStatus(delegate, facts)}
                    </header>
                    <div className="mapstudio-dock-note">Nothing here yet. The kind setup screen comes in a later entry.</div>
                </section>
            );
        }
        if (this.state.listCollapsed) {
            // Below 1280 px the list is not docked (entry 7c): the rail's Items opens it over the map (renderListOverlay).
            return null;
        }
        return this.renderItemList(delegate, facts, false);
    }

    /**
     * Recent changes, the rail's History surface (entry 11b; DESIGN.md Recent changes panel): the dock's header as the other surfaces
     * have it, then the note box with the toolbar's Undo, the rows, Show older and the footer (studio/HistoryPanel.tsx).
     */
    private renderHistory(delegate: MapStudioDelegateState, facts: ProblemFacts): React.ReactNode {
        const kinds = delegate.lists.kinds;
        const locale = browserLocale();
        const stack = delegate.undo;
        const busy = busyText(stack, delegate.editInFlight);
        const names = new Map(delegate.lists.assetNames.map((a) => [a.id, a.name]));
        const expand = (entry: HistoryEntry) => expandOps(entry, {
            kinds,
            locale,
            assetName: (id) => names.get(id) || id,
            itemName: (id) => {
                const item = delegate.items.find((i) => i.id === id);
                return item ? item.name : '';
            }
        });
        return (
            <HistoryPanel key="history"
                          header={(
                              <header className="mapstudio-dock-header">
                                  <div className="mapstudio-dock-title-row"><h2 className="mapstudio-dock-title">Recent changes</h2></div>
                                  {this.renderProblemStatus(delegate, facts)}
                              </header>
                          )}
                          history={delegate.history}
                          rows={historyRows(delegate.history.entries, kinds, locale)}
                          expand={expand}
                          lastStep={stack.done > 0 ? stack.steps[stack.done - 1].label : ''}
                          undoLabel={busy !== '' ? '' : undoLabel(stack)}
                          busy={busy}
                          paused={delegate.editing === 'off'}
                          onUndo={this.onUndo}
                          onRevert={this.onRevert}
                          onOlder={this.onHistoryOlder}
                          onRetry={this.onHistoryRetry} />
        );
    }

    /**
     * The collapsed list (entry 7c, the owner's option A): below 1280 px, opened by the rail's Items, the 7a list whole (header,
     * groups, footer) as a panel over the map's left edge at the list's width, floating (the one soft shadow); it closes on a row
     * choice, Esc, the rail's Items again or a click on the map. Nothing docks, so the map's box does not move.
     */
    private renderListOverlay(delegate: MapStudioDelegateState): React.ReactNode {
        if (!this.listOverlayShown()) {
            return null;
        }
        return (
            <div className="mapstudio-list-overlay" data-list="open">
                {this.renderItemList(delegate, this.problemFacts(delegate), true)}
            </div>
        );
    }

    /** The item list (entry 7a), docked or (below 1280 px) over the map. */
    private renderItemList(delegate: MapStudioDelegateState, facts: ProblemFacts, overlay: boolean): React.ReactNode {
        const selected = this.state.selected;
        return (
            <ItemList title={this.projectName() || 'Map'}
                      overlay={overlay}
                      view={this.listView}
                      rows={listRows(delegate.items, delegate.lists.kinds, delegate.live, delegate.lists.assetNames,
                          assetListKnown(delegate.lists.adapters ? delegate.lists.adapters.assets : null),
                          { assets: delegate.lists.assets, changed: delegate.changed })}
                      justAdded={delegate.justAdded}
                      onAddItem={this.onAddItem}
                      addDisabled={delegate.editing === 'off'}
                      selectedId={selected ? selected.id : null}
                      selectedIds={this.state.studio.selected}
                      onToggle={this.onRowToggle}
                      onSelectRows={this.onSelectRows}
                      save={delegate.save}
                      saveWords={headerSaveWords(facts)}
                      problems={editProblems(facts)}
                      unsaved={delegate.unsaved}
                      records={delegate.items}
                      level={facts.level}
                      sending={delegate.sending}
                      onSelect={this.onRowSelect}
                      onRetry={this.onRetryUnsaved}
                      onDiscard={this.onDiscardUnsaved}
                      openWaiting={this.state.showEdits}
                      onOpenHandled={this.onShowEditsHandled}
                      onHistory={this.onShowHistory} />
        );
    }

    /**
     * The properties panel for the selected item (entry 2): Details, keyed by the item so its drafts start from the record. From
     * entry 6 it takes every asset's name (`assetNames`, every level; `assets` is editors only and the kind's alone), so a link to
     * an asset that left the list is told from one of another kind, the asset list's status and the items for the name check.
     */
    private renderPanel(delegate: MapStudioDelegateState): React.ReactNode {
        const set = this.state.studio.selected;
        if (set.length >= 2) {
            // Several selected (entry 8): the count, Clear and the footer's Delete; no fields and no geometry handles.
            const deletable = set.filter((id) => {
                const item = this.liveItem(id);
                return !!item && item.version >= 1;
            });
            return (
                <SelectionCount key="several" count={set.length} deletable={deletable.length} paused={delegate.editing === 'off'}
                                toolInHand={this.state.studio.tool !== null || this.state.drawing !== null}
                                onClear={this.onClearSelection} onDelete={this.onDeleteItem} />
            );
        }
        const selected = this.state.selected;
        const item = selected && this.state.panel === selected.id ? this.itemFor(selected.id) : undefined;
        if (!item) {
            return null;
        }
        const assets = delegate.lists.assets || [];
        // The item's batch in flight or waiting, with the newest properties it carries (entry 6's review).
        const flight = delegate.inFlight[item.id];
        const geometry = item.geometry.type === 'Point' ? 'point' : 'line';
        const kind = delegate.lists.kinds.find((k) => k.id === item.kind);
        const pick = this.state.geometry;
        // Entry 9: an instrument's Kind select lists instrument kinds only, a point's the others; a line (not an area) lists its
        // instruments in order with Add an instrument; an instrument on a line reads its line's name and length.
        const instrument = geometry === 'point' && (item.attachment !== null || !!(kind && kind.instrument));
        const kindOptions = geometry === 'line' ? delegate.lists.kinds.filter((k) => k.geometry === 'line')
            : instrument ? instrumentKinds(delegate.lists.kinds) : kindsFor(delegate.lists.kinds, 'point');
        const isLine = geometry === 'line' && !(kind && kind.area);
        const attachedTo = item.attachment !== null ? this.liveItem(item.attachment.lineId) : undefined;
        const onLine = attachedTo && attachedTo.geometry.type === 'LineString'
            ? { name: attachedTo.name, lengthM: lengthM(attachedTo.geometry.coordinates) } : undefined;
        const armed = this.state.studio.armed;
        return (
            <PropertiesPanel key={item.id}
                             item={item}
                             kind={kind}
                             kinds={kindOptions}
                             assets={assets.filter((a) => a.kind === item.kind)}
                             assetNames={delegate.lists.assetNames}
                             assetStatus={delegate.lists.adapters ? delegate.lists.adapters.assets : null}
                             items={delegate.items}
                             assetRows={assets}
                             kindStatus={delegate.lists.adapters ? delegate.lists.adapters.kinds : null}
                             saving={flight !== undefined}
                             newest={flight ? flight : item.properties}
                             pending={item.version === 0}
                             paused={delegate.editing === 'off'}
                             autoFocusName={this.focusNameId === item.id}
                             onNameFocused={this.onNameFocused}
                             onClose={this.onPanelClose}
                             onRename={this.onRename}
                             onMove={this.onMove}
                             canMoveByClick={geometry === 'point' && item.attachment === null && !(kind && kind.instrument)}
                             moving={!!pick && pick.itemId === item.id && pick.moving}
                             onMoveStart={this.onMoveByClick}
                             onLink={this.onLink}
                             onKind={this.onKind}
                             onProperty={this.onProperty}
                             onDelete={this.onDeleteItem}
                             toolInHand={this.state.studio.tool !== null || this.state.drawing !== null || armed !== null}
                             delKey={!(pick && pick.itemId === item.id)}
                             places={PLACES}
                             onZoomTo={this.onZoomToLocation}
                             instruments={isLine ? instrumentsOn(delegate.items, item.id)
                                 .map((i) => ({ id: i.id, name: i.name, distanceM: i.attachment ? i.attachment.distanceM : 0 })) : undefined}
                             instrumentKinds={instrumentKinds(delegate.lists.kinds)}
                             armedKind={armed && armed.lineId === item.id ? armed.kindId : null}
                             onAddInstrument={this.onAddInstrument}
                             onSelectInstrument={this.onRowSelect}
                             onLine={onLine}
                             onMoveAlong={this.onMoveAlong} />
        );
    }

    /** The drawing bar while an instrument is placed (entry 9): its kind and line, the line's length, the last refusal's words. */
    private renderInstrumentBar(delegate: MapStudioDelegateState, lineId: string, kindId: string, problem: string): React.ReactNode {
        const line = this.liveItem(lineId);
        const kind = delegate.lists.kinds.find((k) => k.id === kindId);
        if (!line || line.geometry.type !== 'LineString' || !kind) {
            return null;
        }
        return (
            <InstrumentBar kind={kind} lineId={line.id} lineName={line.name} lengthM={lengthM(line.geometry.coordinates)} problem={problem}
                           onPlace={this.onPlaceInstrument} onCancel={this.onCancelInstrument} />
        );
    }

    /** The first-run checklist's kept flags (entry 7b), read once per project and user key; null before a key is known. */
    private firstRunKept: { key: string | null; kept: FirstRunKept } | null = null;

    /** The key of this project's and user's first-run flags, or null while the project is unknown (nothing kept then). */
    private firstRunKey(delegate: MapStudioDelegateState): string | null {
        const project = this.projectName();
        return project !== null ? firstRunKey(project, delegate.user) : null;
    }

    /** The kept flags for this project and user (localStorage, null-safe; firstRun.ts). */
    private keptFirstRun(delegate: MapStudioDelegateState): FirstRunKept {
        const key = this.firstRunKey(delegate);
        if (!this.firstRunKept || this.firstRunKept.key !== key) {
            this.firstRunKept = { key, kept: key !== null ? readKept(browserStorage(), key) : FIRST_RUN_NONE };
        }
        return this.firstRunKept.kept;
    }

    /** Keep one first-run flag (Hide, or step 3's Open view mode) for this project and user, then redraw. */
    private keepFirstRun(flag: keyof FirstRunKept): void {
        const delegate = this.props.delegate;
        if (!delegate) {
            return;
        }
        const key = this.firstRunKey(delegate);
        const kept = key !== null ? keepFlag(browserStorage(), key, flag) : { ...this.keptFirstRun(delegate), [flag]: true };
        this.firstRunKept = { key, kept };
        this.forceUpdate();
    }

    /** The card's Open Kinds: the rail's Kinds surface, as the rail opens it. */
    onFirstRunKinds = (): void => this.onRailSurface('kinds');
    /** The card's Open view mode: step 3 kept as done, then Edit mode left as the rail's View leaves it. */
    onFirstRunView = (): void => {
        this.keepFirstRun('viewed');
        this.setEditMode(false, true);
    };
    /** Hide checklist: kept hidden for this project and user; the focus goes to the map, the card being gone. */
    onFirstRunHide = (): void => {
        this.keepFirstRun('hidden');
        const canvas = this.mapContainer ? this.mapContainer.querySelector('canvas') as HTMLElement | null : null;
        if (canvas && typeof canvas.focus === 'function') {
            canvas.focus();
        }
    };

    /**
     * The first-run checklist in Edit mode and the viewer's note in View mode (entry 7b; firstRun.ts decides): an empty
     * loaded map, its items counted with this page's unsaved creates, so a point just placed ends it before its save returns.
     */
    private renderFirstRun(delegate: MapStudioDelegateState, studioOn: boolean): React.ReactNode {
        const loaded = delegate.load.state === 'loaded';
        const itemCount = loaded ? delegate.items.filter((i) => !i.deleted).length + unsavedItems(delegate.unsaved).length : 0;
        const toolInHand = this.state.studio.tool !== null || this.state.drawing !== null;
        if (viewerNoteShows({ studioOn, loaded, itemCount })) {
            return <ViewerNote text={VIEWER_NOTE} />;
        }
        if (!studioOn) {
            return null;
        }
        const kept = this.keptFirstRun(delegate);
        if (!checklistShows({ studioOn, loaded, itemCount, toolInHand, kept })) {
            return null;
        }
        return (
            <FirstRunChecklist project={this.projectName() || 'Map'}
                               kindCount={delegate.lists.kinds.length}
                               done={stepsDone(delegate.kindSetups.length, itemCount, kept)}
                               addDisabled={delegate.editing === 'off'}
                               onOpenKinds={this.onFirstRunKinds}
                               onAddItem={this.onAddItem}
                               onOpenView={this.onFirstRunView}
                               onHide={this.onFirstRunHide} />
        );
    }

    private setMapContainer = (el: HTMLDivElement | null): void => {
        this.mapContainer = el;
    };

    render(): React.ReactNode {
        const delegate = this.props.delegate;
        const save = delegate ? delegate.save : SAVE_IDLE;
        const load = delegate ? delegate.load : { state: 'loading', message: '' };
        const store = delegate ? delegate.store : STORE_UNKNOWN;
        const unsaved = delegate ? delegate.unsaved : [];
        const editing = delegate ? delegate.editing : 'on';
        // The studio's surfaces dock beside the map in Edit mode at level full (entry 2; the stage is the map's room).
        const studioOn = this.studioOn();
        // No status box (entry 24, owner 2026-11-05: "yes to both"): the click echo and the success words are gone, and a
        // problem is said in words on the save status row in Edit mode (the Items list's header) and on the top-centre chip
        // in View mode, one at a time, the worst first; in Edit mode the chip says no connection only (problems.ts). The save
        // state, the last reply and the load and store states stay readable for the e2e suite as attributes on the map.
        const connection = delegate ? delegate.connection : CONNECTED;
        const chip = delegate ? chipProblem(this.problemFacts(delegate), studioOn) : null;
        const studio = this.state.studio;
        const kinds = delegate ? delegate.lists.kinds : [];
        // The kind the tool in hand adds (entry 4): the kind button's, else the first of the tool's geometry.
        const inHand = studio.tool !== null ? toolKind(kinds, studio.tool, studio.toolKind) : null;
        const drawing = this.state.drawing;
        // The chosen point or Move (entry 5): its item, for the geometry bar's words.
        const pick = studioOn && studio.tool === null ? this.state.geometry : null;
        const picked = pick ? this.itemFor(pick.itemId) : undefined;
        const pickedKind = picked ? kinds.find((k) => k.id === picked.kind) : undefined;
        const rootClasses = studioOn ? ['mapstudio', 'mapstudio--editing'] : ['mapstudio'];
        // The list's place for the suite (entry 7c): docked, collapsed (below 1280 px, closed) or open over the map.
        const listPlace = !studioOn || studio.surface !== 'items' ? '' : !this.state.listCollapsed ? 'docked' : this.state.listOpen ? 'open' : 'collapsed';
        return (
            <div {...this.props.emit({ classes: rootClasses })} onKeyDown={this.onRootKeyDown}>
                {studioOn ? (
                    <Rail surface={studio.surface} onView={this.onRailView} onSurface={this.onRailSurface}
                          collapsed={this.state.listCollapsed} listOpen={this.state.listOpen} />
                ) : null}
                {studioOn && delegate ? this.renderDock(delegate) : null}
                {studioOn && delegate ? this.renderPanel(delegate) : null}
                <div className="mapstudio-stage">
                    <div className="mapstudio-map" ref={this.setMapContainer}
                         data-edit-level={delegate && delegate.level ? delegate.level : ''}
                         data-mode={isEditing(studio) ? 'edit' : 'view'}
                         data-studio={studioOn ? 'on' : 'off'}
                         data-surface={studio.surface}
                         data-list={listPlace}
                         data-tool={studio.tool || ''}
                         data-tool-kind={studio.toolKind || ''}
                         data-snap={this.state.snap ? 'on' : 'off'}
                         data-chosen-point={pick && pick.index !== null ? String(pick.index) : ''}
                         data-moving={pick && pick.moving ? (pick.index === null ? 'item' : 'point') : ''}
                         data-load-state={load.state}
                         data-load-message={load.message}
                         data-store-seq={delegate && delegate.seq !== null ? String(delegate.seq) : ''}
                         data-map-reloads={delegate ? String(delegate.reloads) : '0'}
                         data-store-state={storeStateAttribute(store)}
                         data-store-reason={store.reason}
                         data-save-state={save.state}
                         data-save-item={save.state === 'idle' ? '' : save.itemId}
                         data-save-version={save.state === 'saved' ? String(save.version) : ''}
                         data-save-code={save.state === 'refused' || save.state === 'unsent' ? save.code : ''}
                         data-refresh-interval={delegate && delegate.refreshIntervalSeconds !== null
                             ? String(delegate.refreshIntervalSeconds) : ''}
                         data-unsaved-count={String(unsaved.length)}
                         data-editing={editing}
                         data-save-paused={delegate && delegate.savePaused ? 'true' : 'false'}
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
                    {chip ? (
                        // The top-centre chip (item 32; entry 24): one problem in words, the worst first, on at most two lines with
                        // its full words as the title; the hourglass for no connection, the cloud for the store out of reach, the
                        // warning glyph for every other problem (problems.ts ProblemGlyph).
                        <div className={'mapstudio-chip mapstudio-chip--' + chip.code + (chip.code === 'connection' ? ' mapstudio-connection' : '')}
                             role="status" title={chip.detail} data-problem={chip.code} data-glyph={chip.glyph}
                             data-state={chip.code === 'connection' ? (connection.lost ? 'lost' : 'reloading') : undefined}>
                            {chip.glyph === 'stale' ? (
                                <svg className="mapstudio-chip-glyph" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                                    <use href={SPRITE_URL + '#ms-stale'} />
                                </svg>
                            ) : <ChromeGlyph name={chip.glyph} className="mapstudio-chip-glyph" size={16} />}
                            <span className="mapstudio-chip-text">{chip.text}</span>
                        </div>
                    ) : null}
                    {studioOn && delegate ? (
                        <DrawToolbar tool={studio.tool}
                                     toolKind={studio.toolKind}
                                     kinds={kinds}
                                     snap={this.state.snap}
                                     paused={editing === 'off'}
                                     undo={delegate.undo}
                                     editInFlight={delegate.editInFlight}
                                     onSelect={this.onSelectTool}
                                     onTool={this.onTool}
                                     onSnap={this.onSnap}
                                     onUndo={this.onUndo}
                                     onRedo={this.onRedo}
                                     onUndoTo={this.onUndoTo} />
                    ) : null}
                    {studioOn && delegate ? this.renderSaveCard(delegate, !!chip) : null}
                    {studioOn && delegate && studio.tool !== null ? (
                        // The one place Edit mode talks, while any tool is in hand (entry 23); with no tool nothing talks.
                        <DrawingBar tool={studio.tool}
                                    drawing={drawing}
                                    kind={inHand}
                                    snap={this.state.snap}
                                    snapHint={this.state.snapHint}
                                    onCancel={this.onCancelDrawing}
                                    onFinish={this.onFinishDrawing}
                                    onDone={this.onSelectTool} />
                    ) : null}
                    {studioOn && delegate && studio.armed ? this.renderInstrumentBar(delegate, studio.armed.lineId, studio.armed.kindId, studio.armed.problem) : null}
                    {delegate && pick && picked ? (
                        // With Select in hand, the chosen point's or Move's bar is the one place that talks (entry 5).
                        <GeometryBar pick={pick}
                                     name={picked.name}
                                     vertexCount={this.handles && this.handles.itemId === picked.id && this.handles.shape !== 'point'
                                         ? this.handles.shown.length : picked.geometry.type === 'LineString' ? picked.geometry.coordinates.length : 1}
                                     area={!!(pickedKind && pickedKind.area)}
                                     busy={delegate.editInFlight}
                                     onMove={this.onGeometryMove}
                                     onCancel={this.onGeometryCancel}
                                     onSplit={this.onSplitHere}
                                     onDelete={this.onDeletePoint} />
                    ) : null}
                    {delegate ? this.renderFirstRun(delegate, studioOn) : null}
                    {studioOn && delegate ? this.renderListOverlay(delegate) : null}
                    {this.renderStylePanel()}
                    {selection.renderPopup(this)}
                </div>
                {this.renderAdapterStatus(delegate ? delegate.lists : NO_HOST_LISTS)}
                {delegate ? this.renderLiveState(delegate.live, delegate.lists.kinds) : null}
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
            editMode: tree.readBoolean('editMode', false),
            selectedItem: tree.readStringIfExists('selectedItem'),
            userLocation: tree.isObject('userLocation') ? tree.readObject('userLocation') : null,
            directions: tree.isObject('directions') ? tree.readObject('directions') : null
        };
    }
}
