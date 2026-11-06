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
import { SnapTarget } from './geometry';
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
import { SearchResult } from './search';
import { STORE_UNKNOWN, storeStateAttribute } from './storeState';
import { SAVE_IDLE } from './save';
import { unsavedItems } from './unsaved';
import { ProblemFacts, chipProblem, editProblems, headerSaveWords } from './problems';
import { PopupPoint, isSheetWidth, sheetBasisWidth } from './popupParams';
import { CameraPadding, PopupAnchor, Rect } from './popupPlacement';
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
import {
    StudioState, StudioSurface, StudioTool, clearSelection, enterEdit, fromProps, isEditing, leaveEdit, pickTool, select, showSurface, toolKind
} from './studio';
import { listRows } from './itemList';
import { Rail } from './studio/Rail';
import { ItemList } from './studio/ItemList';
import { PropertiesPanel } from './studio/PropertiesPanel';
import { DrawToolbar } from './studio/DrawToolbar';
import { DrawingBar } from './studio/DrawingBar';
import { GeometryBar } from './studio/GeometryBar';
import { ChromeGlyph } from './studio/ChromeGlyph';
import { ProblemStatus } from './studio/SaveStatus';

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
    /** The selected map item's id, which the component writes (epic 4 entry 2); never read back into the model (entry 14's). */
    selectedItem: string | null;
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
}

export type Props = ComponentProps<MapStudioProps, MapStudioDelegateState>;

/** What the third SDK check of epic 4 entry 2 reads of the client store: the session's geolocation store, if a component reaches it. */
function clientLocationWords(store: AbstractUIElementStore): string {
    const client = clientOf(store) as (ReturnType<typeof clientOf> & { location?: { geolocationEnabled?: unknown } }) | null;
    if (!client) {
        return 'no client';
    }
    if (!client.location || typeof client.location !== 'object') {
        return 'absent';
    }
    return 'reachable: geolocationEnabled=' + String(client.location.geolocationEnabled);
}

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
        studio: fromProps(this.props.props.editMode), layersTab: 'layers', geometry: null
    };

    mapContainer: HTMLDivElement | null = null;
    map: MapLibreMap | null = null;
    private resizeObserver: ResizeObserver | null = null;
    draw: TerraDraw | null = null;
    /** Terra Draw's line and polygon modes (entry 4), kept for Backspace (the mode's undo). */
    lineMode: TerraDrawLineStringMode | null = null;
    areaMode: TerraDrawPolygonMode | null = null;
    /** The snap targets as last read from the items, the snapping callback's last offer and the validation's last reason (editing.ts). */
    snapCache: { revision: number; targets: SnapTarget[] } | null = null;
    lastSnap: SnapTarget | null = null;
    drawingReason = '';
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
        const root = this.props.store.element as HTMLElement | undefined;
        // The blank map and the halos are the blank-map token (DESIGN.md basemap-blank, `--neutral-20`).
        const colors = blankColors(root);
        const mc = markerColors(root);
        this.markerColors = mc;
        // The colours this map was built with, for the e2e suite (item 29); applyTheme updates them.
        this.mapContainer.setAttribute('data-theme-revision', '0');
        this.mapContainer.setAttribute('data-blank', colors.background);
        // The third SDK check of entry 2 (docs/platform-checks.md): what of the client store a component reaches.
        this.mapContainer.setAttribute('data-client-location', clientLocationWords(this.props.store));
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
            // A selection made before the map loaded (a restored place, a list row) takes its handles now (entry 5).
            editing.applyHandles(this);
            // Readiness for the e2e suite: set once the map has gone idle with
            // its sources and layers added.
            map.once('idle', () => camera.publishReadiness(this, map));
        });
        this.map = map;
        // The Edit switch and the studio wait for map.load's level (applyStudioControls, componentDidUpdate).
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
            this.resizeObserver = new ResizeObserver(() => {
                map.resize();
                this.publishHeight();
                // The stage grew or shrank (a panel docked or left, entry 2): an open card is placed again in the new room.
                if (this.studioOn()) {
                    selection.replacePopup(this);
                }
            });
            this.resizeObserver.observe(this.mapContainer);
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
        this.applyEditMode(prevProps);
        this.applyStudioControls();
        this.applyTopBar();
        this.dropDeadSelection();
        basemap.applyBasemap(this);
        this.drawItems();
        this.dropQueuedFeatures();
        editing.applyEditing(this);
        editing.applyHandles(this);
        camera.applyStartingArea(this);
        camera.applyRestore(this);
        camera.saveSelection(this);
    }

    /**
     * Edit mode from the level and the prop (epic 4 entry 2, contract 0.4.0): a session at level `phone` or `none`
     * is in View mode whatever the prop says, which is left as written; at level `full` the prop's change enters
     * or leaves Edit mode when it differs from the model, so the component's own write coming back (the switch,
     * the rail's View), which already matches the model, never re-enters it. `selectedItem` is read here too and
     * does nothing: the page-to-component direction is entry 14's.
     */
    private applyEditMode(prevProps: Readonly<Props>): void {
        const delegate = this.props.delegate;
        const level = delegate ? delegate.level : null;
        const editing = isEditing(this.state.studio);
        if ((level !== null && level !== 'full') || this.phoneWidth()) {
            // A phone or viewer session (and phone widths, which keep View mode) stays in View mode, the prop as written.
            if (editing) {
                this.setEditMode(false, false);
            }
            return;
        }
        const wanted = this.props.props.editMode;
        if (prevProps.props.editMode !== wanted && wanted !== editing) {
            this.setEditMode(wanted, false);
        }
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
        } else {
            editing.putToolDown(this);
        }
        this.setState((prev) => ({ studio: on ? enterEdit(prev.studio) : leaveEdit(prev.studio), layersTab: on ? 'layers' : prev.layersTab }));
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

    /** A selected item that left the map (an undo of its add, another editor's delete) leaves the selection too. */
    private dropDeadSelection(): void {
        const selected = this.state.selected;
        const delegate = this.props.delegate;
        if (selected && delegate && delegate.load.state === 'loaded' && !this.itemFor(selected.id)) {
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
            studio: selected ? select(prev.studio, selected.id) : clearSelection(prev.studio),
            panel: selected !== null && prev.panel === selected.id ? prev.panel : null,
            // A chosen point and Move stay with their item only (entry 5).
            geometry: selected !== null && prev.geometry !== null && prev.geometry.itemId === selected.id ? prev.geometry : null
        };
    }

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
            const target = ev.target as HTMLElement | null;
            const tag = target && target.tagName ? target.tagName.toUpperCase() : '';
            if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && this.studioOn()) {
                ev.preventDefault();
                if (ev.shiftKey || ev.key === 'y' || ev.key === 'Y') {
                    this.onRedo();
                } else {
                    this.onUndo();
                }
                return;
            }
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
        if (editing.onGeometryClick(this, ev)) {
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
        return delegate ? unsavedItems(delegate.unsaved).find((i) => i.id === id) : undefined;
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

    /** The Edit switch (entry 2) and the rail's View: the mode, written back to the editMode prop. */
    onEditSwitch = (on: boolean): void => this.setEditMode(on, true);
    onRailView = (): void => this.setEditMode(false, true);
    onRailSurface = (surface: StudioSurface): void => this.setState((prev) => ({ studio: showSurface(prev.studio, surface) }));

    /** A list row clicked (EXPERIENCE.md List row): the item selected, properties open, the map panned to it; no popup. */
    onRowSelect = (id: string): void => {
        const item = this.itemFor(id);
        const map = this.map;
        if (!item || !map) {
            return;
        }
        selection.closePopup(this);
        this.fitKey = null;
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

    /** The toolbar (entries 2 and 4): Select puts every tool down; a tool or kind button picks its tool up; Snap toggles. The bar's Done puts the Point tool down. */
    onSelectTool = (): void => editing.putToolDown(this);
    onTool = (tool: StudioTool, kindId: string | null): void => editing.pickTool(this, tool, kindId);
    onSnap = (): void => editing.toggleSnap(this);

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
        const partId = delegate.splitLine(pick.itemId, pick.index);
        if (partId === null) {
            return;
        }
        // The new part opens in Details with Name focused, as an added item does (owner, 2026-11-06).
        this.focusNameId = partId;
        selection.closePopup(this);
        this.setState((prev) => ({ ...this.selectionState(prev, { id: partId, kind: 'line', segment: null }), pick: null, panel: partId, geometry: null }));
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
                           level={facts.level} sending={delegate.sending} onRetry={this.onRetryUnsaved} onDiscard={this.onDiscardUnsaved} />
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
        const selected = this.state.selected;
        return (
            <ItemList title={this.projectName() || 'Map'}
                      rows={listRows(delegate.items, delegate.lists.kinds, delegate.live, delegate.lists.assetNames)}
                      selectedId={selected ? selected.id : null}
                      save={delegate.save}
                      saveWords={headerSaveWords(facts)}
                      problems={editProblems(facts)}
                      unsaved={delegate.unsaved}
                      records={delegate.items}
                      level={facts.level}
                      sending={delegate.sending}
                      onSelect={this.onRowSelect}
                      onRetry={this.onRetryUnsaved}
                      onDiscard={this.onDiscardUnsaved} />
        );
    }

    /** The properties panel for the selected item (entry 2): Details, keyed by the item so its drafts start from the record. */
    private renderPanel(delegate: MapStudioDelegateState): React.ReactNode {
        const selected = this.state.selected;
        const item = selected && this.state.panel === selected.id ? this.itemFor(selected.id) : undefined;
        if (!item) {
            return null;
        }
        const assets = delegate.lists.assets || [];
        const linked = item.assetId !== null ? assets.find((a) => a.id === item.assetId) : undefined;
        const geometry = item.geometry.type === 'Point' ? 'point' : 'line';
        const kind = delegate.lists.kinds.find((k) => k.id === item.kind);
        const pick = this.state.geometry;
        return (
            <PropertiesPanel key={item.id}
                             item={item}
                             kind={kind}
                             kinds={delegate.lists.kinds.filter((k) => k.geometry === geometry)}
                             assets={assets.filter((a) => a.kind === item.kind)}
                             assetName={linked ? linked.name : null}
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
                             onDelete={this.onDeleteItem}
                             toolInHand={this.state.studio.tool !== null || this.state.drawing !== null}
                             delKey={!(pick && pick.itemId === item.id)} />
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
        return (
            <div {...this.props.emit({ classes: studioOn ? ['mapstudio', 'mapstudio--editing'] : ['mapstudio'] })} onKeyDown={this.onRootKeyDown}>
                {studioOn ? <Rail surface={studio.surface} onView={this.onRailView} onSurface={this.onRailSurface} /> : null}
                {studioOn && delegate ? this.renderDock(delegate) : null}
                {studioOn && delegate ? this.renderPanel(delegate) : null}
                <div className="mapstudio-stage">
                    <div className="mapstudio-map" ref={this.setMapContainer}
                         data-edit-level={delegate && delegate.level ? delegate.level : ''}
                         data-mode={isEditing(studio) ? 'edit' : 'view'}
                         data-studio={studioOn ? 'on' : 'off'}
                         data-surface={studio.surface}
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
            selectedItem: tree.readStringIfExists('selectedItem')
        };
    }
}
