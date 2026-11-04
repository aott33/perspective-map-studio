import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {
    AbstractUIElementStore,
    Component,
    ComponentMeta,
    ComponentProps,
    ComponentStoreDelegate,
    PageStore,
    PComponent,
    PropertyTree,
    Size2d
} from '@inductiveautomation/perspective-client';
import { ErrorEvent, GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, MapMouseEvent, Popup, setWorkerUrl } from 'maplibre-gl';
import { TerraDraw, TerraDrawLineStringMode } from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import { DrawControl } from './DrawControl';
import {
    DRAW_IDLE,
    DRAW_MODE_LINE,
    DRAW_MODE_OFF,
    DrawState,
    cancelDrawing,
    drawStatusText,
    finishLine,
    startDrawing
} from './draw';
import { EditLevel, MapItemRecord } from './contract';
import { AdapterStatus, HostLists, NO_HOST_LISTS } from './adapters';
import { BasemapId, RasterSource, tilesFailedText } from './basemaps';
import { LegendControl } from './LegendControl';
import { LegendToggle, legendKey, readToggle, sessionStore, writeToggle } from './legend';
import { NeedsYouControl } from './NeedsYouControl';
import { NeedsYouRow, needsYou } from './needsyou';
import { FIT_PADDING_PX, StartingArea, readStartingArea, startingAreaKey } from './startingArea';
import { Place, placeKey, readPlace, writePlace } from './place';
import { LiveState, displayShows, iconKpiOf, itemPreset, itemState } from './live';
import { CONNECTED, connectionChipText, connectionDetailText } from './connection';
import { ThemeWatch } from './themeWatch';
import { MarkerColors, SpriteSymbol, imageFor, markerProperties, parseSprite, stateWord } from './markers';
import { PresetPalette, StylePreview, TintPalette } from './StylePreview';
import { MapFeatures, SegmentRef, Selection, buildFeatures } from './features';
import { LinePopup } from './LinePopup';
import { popupInstruments, popupNodes } from './linePopup';
import { instrumentsOn, lengthM } from './geometry';
import { ZoomControl } from './ZoomControl';
import { SearchControl } from './SearchControl';
import { CHOSEN_POINT_ZOOM, SearchResult, buildEntries } from './search';
import { PickList, PickRow } from './PickList';
import { DefaultPopup } from './DefaultPopup';
import { STORE_UNKNOWN, storeStateAttribute, storeStatusText } from './storeState';
import { PointPopup } from './PointPopup';
import { SAVE_IDLE, itemsToGeoJson, saveStatusText } from './save';
import { UnsavedEntry, entryText, summaryText, unsavedItems } from './unsaved';
import {
    LINE_POPUP_PX, POPUP_WIDTH_PX, PopupPoint, fillLink, fillParams, isSheetWidth, popupItemView, popupMaxHeight,
    popupMountPath, popupViewParams
} from './popupParams';
import { CameraPadding, PopupAnchor, Rect, cameraPadding, placePopup, placedMaxWidth } from './popupPlacement';
import { SHARED_M, sharedWithinM } from './shared';
import { registerTestView } from './testHook';
import { drawColor } from './theme';
import { IMPROVE_MAP_CLASS, feedbackHref, providerLogo, rasterPaint } from './basemaps';
import { MapboxLogoControl } from './mapboxLogo';
import {
    LAYER_ITEM_LINES, LAYER_ITEM_LINES_DASHED, LAYER_ITEM_LINES_DOTTED, LAYER_ITEM_MARKERS, SOURCE_ARROW, SOURCE_BASEMAP, SOURCE_ITEM_AREAS,
    SOURCE_ITEM_LINES, SOURCE_ITEM_POINTS, SOURCE_LINE_MARKS, SOURCE_UNSAVED_LINES, SOURCE_UNSAVED_POINTS, SPRITE_URL, THEME_TOKENS, addItemLayers,
    addPointerCursor, addTextLayers, addUnsavedLayers, applyLayerToggles, applyThemePaint, blankColors, createMap, markerColors, publishLabels,
    setBasemapLayer
} from './mapLayers';
import { addViewControls, applyProviderLogo } from './viewControls';
import { Kind } from './adapters';
import { MapStudioDelegateState, MapStudioStoreDelegate, clientOf } from './MapStudioStoreDelegate';

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

/**
 * The popup that is open: the clicked point (or line, entry 2) with its map coordinates, as a card or
 * a bottom sheet (a point's below 768 px, entry 8), and for a line the clicked segment.
 */
interface OpenPopup {
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

/** How long a remembered selection waits for its item and the first full batch (owner re-test R4 (a)). */
const RESTORE_WAIT_MS = 30_000;
/** How long a custom popup view waits for the popup detail (the base path) before it opens without it. */
const POPUP_DETAIL_WAIT_MS = 2000;
/** The sheet keeps the selected marker at least this far above its top edge. */
const SHEET_CLEARANCE_PX = 48;

/** The pick list a shared marker opened (epic 3 entry 7): its rows at the marker's place. */
interface OpenPick {
    rows: PickRow[];
    lngLat: [number, number];
}

interface MapStudioState extends DrawState {
    popup: OpenPopup | null;
    /** Bumped every few seconds while the popup is open, so its data ages move. */
    clock: number;
    /** The shared marker's pick list, shown in the popup instead of a map item's content. */
    pick: OpenPick | null;
    /** The selected map item (epic 3 entry 7): the clicked point or line; a tap on the ground clears it. */
    selected: Selection | null;
}

type Props = ComponentProps<MapStudioProps, MapStudioDelegateState>;

/** Fit's padding round every item (px). */
const FIT_ITEMS_PADDING_PX = 48;
/** The popup's offset from the point: the disc radius and the ring, so the tip touches the disc. */
const POPUP_OFFSET_PX = 22;
/** How often an open popup's data ages are redrawn. */
const POPUP_CLOCK_MS = 5000;

/**
 * The Map Studio component: a MapLibre map on a blank style that draws the
 * project's map items from the map store. Clicking a point item sends
 * `point.click` through the delegate; the reply is shown as text over the map.
 */
export class MapStudio extends Component<Props, MapStudioState> {
    state: MapStudioState = { ...DRAW_IDLE, popup: null, clock: Date.now(), pick: null, selected: null };

    mapContainer: HTMLDivElement | null = null;
    private map: MapLibreMap | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private draw: TerraDraw | null = null;
    private drawControl: DrawControl | null = null;
    /** The MapLibre popup, created once and moved between points; its content is a React portal. */
    private popup: Popup | null = null;
    /** The DOM node the popup shows; React renders PointPopup into it through a portal. */
    private popupContent: HTMLDivElement | null = null;
    /** Whether the items sources exist (after the map's load). */
    private itemsReady = false;
    /** The items revision last drawn. */
    private drawnRevision = -1;
    /** Whether the e2e item counts were asked for (after the first loaded items are drawn). */
    private itemCountsAsked = false;
    /** The unsaved and items revisions last drawn into the unsaved sources. */
    private drawnUnsaved = '';
    /** Terra Draw features of finished lines: removed once queued, as the unsaved layer draws them. */
    private queuedFeatures: Array<string | number> = [];
    /** The theme colours the marker images are drawn with, read at mount and again on a theme change (item 29). */
    private markerColors: MarkerColors | null = null;
    /** Re-reads the tokens when the theme changes and redraws (item 29). */
    private themeWatch: ThemeWatch | null = null;
    /** How many times the theme was re-read, for tests. */
    private themeRevision = 0;
    /** A theme change came before the layers were ready (item 29): applied once they are, not lost. */
    private themePending = false;
    /** The sprite's symbols once fetched (empty when the fetch failed); null before. */
    private symbols: Record<string, SpriteSymbol> | null = null;
    /** The sprite's fetch, shared by every image asked for before it arrived. */
    private sprite: Promise<Record<string, SpriteSymbol>> | null = null;
    /** The images made or being made, by id, so an id is drawn once. */
    private madeImages = new Map<string, Promise<void>>();
    /** The live revision last drawn into the markers. */
    private drawnLive = -1;
    /** The full batches applied when the legend's key was last built (the kind display changes only on a full batch). */
    private drawnFulls = -1;
    /** The selection last drawn (its id and kind), so a changed selection redraws the sources once. */
    private drawnSelection = '';
    /** The zoom card with Fit and Return (epic 3 entries 7 and 14). */
    private zoomControl: ZoomControl | null = null;
    /** The search field top-left, the View-mode top bar (epic 3 entry 9). */
    private searchControl: SearchControl | null = null;
    /** The Needs you bar in the top bar's row and its ranked list (epic 3 entry 3). */
    private needsYouControl: NeedsYouControl | null = null;
    /** The legend's Lines and Names toggles (entry 3), remembered per browser session. */
    private toggles: Record<LegendToggle, boolean> = { lines: readToggle(sessionStore(), 'lines'), names: readToggle(sessionStore(), 'names') };
    /** The items' bounds key Fit keeps by, or null while Fit is not in force. */
    private fitKey: string | null = null;
    /** The items' bounds last drawn, for Fit. */
    private itemBounds: MapFeatures['bounds'] = null;
    private itemBoundsKey = '';
    private popupClock: ReturnType<typeof setInterval> | null = null;
    /** Where each member of a shared marker is drawn, by item id (owner review notes item 20): a popup anchors there. */
    private anchors: Record<string, [number, number]> = {};
    /** The sharing distance at the map's zoom (item 20) and the one the features were last built with. */
    private withinM = SHARED_M;
    private drawnWithinM = SHARED_M;
    /** What opened the popup (item 14): Esc returns the focus there; null for a click on the map. */
    private openedBy: 'search' | 'needsyou' | null = null;
    /** The side the open card's tip is on (item 18), for the camera padding; null while no card is open. */
    private popupAnchor: PopupAnchor | null = null;
    /** The legend bottom-left, which holds the basemap choice (epic 3 entries 6 and 14), and the basemap revision last drawn. */
    private legendControl: LegendControl | null = null;
    /** The Mapbox logo control, bottom-right, while Satellite is drawn. */
    private logoControl: MapboxLogoControl | null = null;
    private drawnBasemap = -1;
    /** The raster source the map holds now (by identity), or null for none. */
    private drawnSource: RasterSource | null = null;
    /** The drawn basemap's tiles: none (no source), loading, loaded (the map went idle) or failed (a tile error). */
    private tiles: 'none' | 'loading' | 'loaded' | 'failed' = 'none';
    /** The starting area last applied (startingAreaKey), so a changed prop moves the map once. */
    private appliedArea = '';
    /** This map's key in sessionStorage for its place (owner re-test R4 (a), place.ts), set at mount. */
    private placeKey = '';
    /** A remembered selection and popup still to put back once its item and its kind's display have arrived. */
    private restore: Place | null = null;
    /** When the restore was asked for, so a selection whose item never comes is dropped. */
    private restoreSince = 0;
    /** The selection and popup last remembered, so a redraw that changed neither writes nothing. */
    private savedSelection = '';
    /** Set as the component unmounts: closing the popup and removing the map then must not overwrite the place. */
    private unmounting = false;

    /** The starting area the prop names; an invalid one is said once, in the console. */
    private startingArea(): StartingArea {
        const read = readStartingArea(this.props.props.startingArea);
        const key = startingAreaKey(read.area) + (read.problem || '');
        if (read.problem && key !== this.appliedArea) {
            console.warn('[MapStudio] ' + read.problem);
        }
        return read.area;
    }

    componentDidMount(): void {
        if (!this.mapContainer) {
            return;
        }
        const area = this.startingArea();
        this.appliedArea = startingAreaKey(area) + (readStartingArea(this.props.props.startingArea).problem || '');
        // The place this page's map had earlier in the browser session (owner re-test R4 (a)): its camera instead of
        // the starting area, and its selection and open popup put back once the items have come (applyRestore).
        this.placeKey = placeKey(this.projectName(), typeof window !== 'undefined' ? window.location.pathname : '',
            String(this.props.store.addressPathString || ''));
        const place = readPlace(sessionStore(), this.placeKey);
        if (place) {
            this.restore = place.selected ? place : null;
            this.restoreSince = Date.now();
            this.savedSelection = place.selected ? this.selectionKeyOf(place) : '';
        }
        const root = this.props.store.element as HTMLElement | undefined;
        // The blank map and the halos are the blank-map token (DESIGN.md basemap-blank, `--neutral-20`).
        const colors = blankColors(root);
        const mc = markerColors(root);
        this.markerColors = mc;
        // The colours this map was built with, for the e2e suite (item 29); applyTheme updates them.
        this.mapContainer.setAttribute('data-theme-revision', '0');
        this.mapContainer.setAttribute('data-blank', colors.background);
        this.makePopup();
        const map = createMap(this.mapContainer, colors.background, place
            ? { center: place.center, zoom: place.zoom }
            : area.kind === 'bounds'
                ? { bounds: area.bounds, fitBoundsOptions: { padding: FIT_PADDING_PX } }
                : { center: area.center, zoom: area.zoom });
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
            this.publishView(map);
            this.savePlace();
        });
        map.on('movestart', this.onMoveStart);
        map.on('zoomend', () => this.onZoomEnd(map));
        map.on('load', () => {
            // The sources and layers (mapLayers.ts): the items, then the unsaved and text layers over them.
            addItemLayers(map, mc);
            // MapLibre awaits the resolver's promise before it treats an image as missing, so the
            // images drawn from the sprite are in place when the symbols are laid out.
            map.setMissingStyleImageResolver((id) => this.makeImage(id));
            this.loadSprite();
            addUnsavedLayers(map, colors);
            addTextLayers(map, mc);
            this.itemsReady = true;
            this.applyLayerToggles();
            this.applyBasemap();
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
            this.startTerraDraw(map, root);
            // Readiness for the e2e suite: set once the map has gone idle with
            // its sources and layers added.
            map.once('idle', () => this.publishReadiness(map));
        });
        // The spike's line tool belongs to Edit mode alone (entry 14): the dev page /edit sets the prop.
        if (this.props.props.editMode) {
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
        this.applyEditing();
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
        for (const id of Array.from(this.madeImages.keys())) {
            if (map.hasImage(id)) {
                map.removeImage(id);
            }
        }
        this.madeImages.clear();
        this.drawnRevision = -1;
        this.drawItems();
        if (this.mapContainer) {
            this.mapContainer.setAttribute('data-theme-revision', String(this.themeRevision));
            this.mapContainer.setAttribute('data-blank', blank);
        }
        console.info('[MapStudio] The theme changed: the map colours were read again.');
    }

    componentDidUpdate(): void {
        this.applyBasemap();
        this.drawItems();
        this.dropQueuedFeatures();
        this.applyEditing();
        this.applyStartingArea();
        this.applyRestore();
        this.saveSelection();
    }

    /** The project for the place's key, or null when the client does not say. */
    private projectName(): string | null {
        const client = clientOf(this.props.store);
        return client && typeof client.projectName === 'string' && client.projectName !== '' ? client.projectName : null;
    }

    /** The selection and the open popup as the place keeps them, as one string. */
    private selectionKeyOf(place: Pick<Place, 'selected' | 'popup' | 'popupAt'>): string {
        return JSON.stringify([place.selected, place.popup, place.popupAt]);
    }

    /** The place now: the camera, the selection and whether its popup is open (a pick list is not kept). */
    private currentPlace(): Place | null {
        const map = this.map;
        if (!map) {
            return null;
        }
        const c = map.getCenter();
        const sel = this.state.selected;
        const open = this.state.popup;
        const selected = sel ? { id: sel.id, kind: sel.kind, segment: sel.kind === 'line' && sel.segment ? sel.segment : null } : null;
        const popup = !!(sel && open && open.point.id === sel.id);
        return { center: [c.lng, c.lat], zoom: map.getZoom(), selected, popup, popupAt: popup && open && open.line ? open.lngLat : null };
    }

    /** Remember the place for the browser session (owner re-test R4 (a)); not while a restore is pending or unmounting. */
    private savePlace(): void {
        if (this.unmounting || this.restore || !this.placeKey) {
            return;
        }
        const place = this.currentPlace();
        if (place) {
            this.savedSelection = this.selectionKeyOf(place);
            writePlace(sessionStore(), this.placeKey, place);
        }
    }

    /** The selection or the popup changed: remember the place (a redraw that changed neither writes nothing). */
    private saveSelection(): void {
        if (this.unmounting || this.restore || !this.map) {
            return;
        }
        const place = this.currentPlace();
        if (place && this.selectionKeyOf(place) !== this.savedSelection) {
            this.savePlace();
        }
    }

    /**
     * Put the remembered selection and popup back (owner re-test R4 (a)) once the item is on the map and the first
     * full batch has brought its kind's display: a point's card or sheet opens as a click opens it, a line's popup at
     * the remembered place on the line, or the item is only selected. The camera came back at mount, so nothing here
     * moves it but the popup's own placement. An item that is gone, or that has not come within RESTORE_WAIT_MS, is
     * dropped.
     */
    private applyRestore(): void {
        const restore = this.restore;
        const delegate = this.props.delegate;
        if (!restore || !restore.selected || !this.map || !this.itemsReady || !delegate) {
            return;
        }
        const sel = restore.selected;
        const item = this.liveItem(sel.id);
        const waited = Date.now() - this.restoreSince > RESTORE_WAIT_MS;
        if (!item || delegate.live.fulls === 0) {
            if (waited || (delegate.itemsRevision > 0 && delegate.live.fulls > 0 && !item)) {
                this.restore = null;
                console.info('[MapStudio] The remembered selection ' + sel.id + ' is no longer on the map.');
            }
            return;
        }
        this.restore = null;
        if (sel.kind === 'point' && item.geometry.type === 'Point') {
            const at = this.anchorFor(item.id, [item.geometry.coordinates[0], item.geometry.coordinates[1]]);
            if (restore.popup) {
                this.openPopup(this.popupPoint(item.id, item.name, item.kind), at);
            } else {
                this.setState({ selected: { id: item.id, kind: 'point' }, pick: null });
            }
        } else if (sel.kind === 'line' && item.geometry.type === 'LineString') {
            if (restore.popup && restore.popupAt) {
                this.openLinePopup(item.id, sel.segment, restore.popupAt);
            } else {
                this.selectLine(item.id, sel.segment);
            }
        }
        console.info('[MapStudio] The map\'s place came back: ' + item.name + (restore.popup ? ' with its popup.' : ' selected.'));
    }

    /** A changed startingArea prop moves the map there (once per value). */
    private applyStartingArea(): void {
        const read = readStartingArea(this.props.props.startingArea);
        const key = startingAreaKey(read.area) + (read.problem || '');
        if (!this.map || key === this.appliedArea) {
            return;
        }
        const area = this.startingArea();
        this.appliedArea = key;
        if (area.kind === 'bounds') {
            this.map.fitBounds(area.bounds, { padding: FIT_PADDING_PX, animate: false });
        } else {
            this.map.jumpTo({ center: area.center, zoom: area.zoom });
        }
    }

    /**
     * Put the delegate's basemap under the items (epic 3 entry 6): the raster source and layer of the
     * chosen basemap, none for None; the control's buttons and status; the attributes tests read.
     */
    private applyBasemap(): void {
        const delegate = this.props.delegate;
        const map = this.map;
        if (!map || !this.itemsReady || !delegate || delegate.basemap.revision === this.drawnBasemap) {
            return;
        }
        const b = delegate.basemap;
        this.drawnBasemap = b.revision;
        if (this.legendControl) {
            this.legendControl.setOffered(b.offered);
            this.legendControl.setSelected(b.selected);
        }
        if (b.source !== this.drawnSource) {
            // Only a changed source touches the map: a status-only change (a refusal) keeps the tiles.
            this.drawnSource = b.source;
            setBasemapLayer(map, b.source, b.selected);
            this.tiles = b.source ? 'loading' : 'none';
        }
        // The Mapbox logo while Satellite is drawn, and only then (viewControls.ts applyProviderLogo).
        const logo = providerLogo(b.selected, b.source);
        this.logoControl = applyProviderLogo(map, this.logoControl, logo);
        if (this.mapContainer) {
            this.mapContainer.setAttribute('data-provider-logo', logo || '');
        }
        this.updateFeedbackLinks();
        this.publishBasemap();
    }

    /** The attribution's "Improve this map" links with the map's centre and zoom (basemaps.ts feedbackHref). */
    private updateFeedbackLinks = (): void => {
        const map = this.map;
        const el = this.mapContainer;
        if (!map || !el) {
            return;
        }
        const links = el.querySelectorAll<HTMLAnchorElement>('.maplibregl-ctrl-attrib a.' + IMPROVE_MAP_CLASS);
        if (links.length === 0) {
            return;
        }
        const center = map.getCenter();
        const zoom = map.getZoom();
        links.forEach((a) => {
            const href = feedbackHref(a.getAttribute('href') || '', center, zoom);
            if (a.getAttribute('href') !== href) {
                a.setAttribute('href', href);
            }
        });
    };

    /** The basemap's state for the control's status line and the e2e suite. */
    private publishBasemap(): void {
        const delegate = this.props.delegate;
        const el = this.mapContainer;
        if (!delegate || !el) {
            return;
        }
        const b = delegate.basemap;
        const status = b.status !== '' ? b.status : this.tiles === 'failed' && b.selected ? tilesFailedText(b.selected) : '';
        if (this.legendControl) {
            this.legendControl.setStatus(status);
        }
        el.setAttribute('data-basemap', b.selected || '');
        el.setAttribute('data-basemap-offered', b.offered.join(','));
        el.setAttribute('data-basemap-status', status);
        el.setAttribute('data-basemap-tiles', this.tiles);
        el.setAttribute('data-basemap-paint', JSON.stringify(rasterPaint(b.selected)));
        // What OpenStreetMap is drawn with whatever the choice (item 25), for the contrast check's quiet raster sample.
        el.setAttribute('data-quiet-paint', JSON.stringify(rasterPaint('osm')));
    }

    /**
     * A MapLibre error: a basemap tile that did not load (a blocked network, a site without internet)
     * is said once in words and at info, never as a browser error; anything else is an error as before
     * (with no listener MapLibre would write it to console.error itself).
     */
    private onMapError = (ev: ErrorEvent & { sourceId?: string }): void => {
        if (ev.sourceId === SOURCE_BASEMAP) {
            if (this.tiles !== 'failed') {
                this.tiles = 'failed';
                const selected = this.props.delegate ? this.props.delegate.basemap.selected : null;
                console.info('[MapStudio] ' + (selected ? tilesFailedText(selected) : 'Basemap tiles are not loading.'));
                this.publishBasemap();
            }
            return;
        }
        console.error(ev.error);
    };

    /** The map went idle with the basemap's tiles in: loaded, unless one failed. The labels drawn are published. */
    private onMapIdle = (): void => {
        if (this.tiles === 'loading') {
            this.tiles = 'loaded';
            this.publishBasemap();
        }
        this.publishLabels();
    };

    /** A move the user began (a drag, a wheel, a zoom button) ends a kept Fit; a programmatic one does not. */
    private onMoveStart = (ev: { originalEvent?: unknown }): void => {
        if (ev && ev.originalEvent && this.fitKey !== null) {
            this.fitKey = null;
            this.publishFit();
        }
    };

    /** For the e2e suite: the labels MapLibre drew, with their boxes (mapLayers.ts publishLabels). */
    private publishLabels(): void {
        const map = this.map;
        const el = this.mapContainer;
        if (!map || !el || !this.itemsReady) {
            return;
        }
        publishLabels(map, el);
    }

    /**
     * The zoom settled (owner review notes item 20): the sharing distance follows the zoom, so a group
     * of points splits once its members are a marker apart on screen; the features are rebuilt when it moves.
     */
    private onZoomEnd(map: MapLibreMap): void {
        if (this.map !== map) {
            return;
        }
        const withinM = sharedWithinM(map.getZoom(), map.getCenter().lat);
        if (withinM !== this.withinM) {
            this.withinM = withinM;
            this.drawItems();
        }
    }

    /** Where a point item's popup anchors: the marker drawn for it, which for a member of a shared marker is the group's (item 20). */
    private anchorFor(id: string, lngLat: [number, number]): [number, number] {
        return this.anchors[id] || lngLat;
    }

    /** A control's rectangle in map pixels, or null when it is not there. */
    private controlRect(selector: string): Rect | null {
        if (!this.map) {
            return null;
        }
        const container = this.map.getContainer();
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
    private cameraPadding(): CameraPadding {
        if (!this.map) {
            return { top: 0, bottom: 0, left: 0, right: 0 };
        }
        const container = this.map.getContainer();
        const sheetEl = this.mapContainer && this.mapContainer.parentElement
            ? this.mapContainer.parentElement.querySelector('.mapstudio-sheet') as HTMLElement | null : null;
        let sheet: Rect | null = null;
        if (sheetEl && sheetEl.offsetHeight > 0) {
            const base = container.getBoundingClientRect();
            const r = sheetEl.getBoundingClientRect();
            sheet = { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
        }
        let card: { rect: Rect; anchor: PopupAnchor } | null = null;
        if (this.popup && this.popup.isOpen() && this.popupAnchor && this.popupContent) {
            const base = container.getBoundingClientRect();
            const r = this.popupContent.getBoundingClientRect();
            card = { rect: { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height }, anchor: this.popupAnchor };
        }
        return cameraPadding(container.clientWidth, container.clientHeight, {
            topBar: this.controlRect('.maplibregl-ctrl-top-left'),
            zoomCard: this.controlRect('.maplibregl-ctrl-top-right'),
            bottomRow: this.controlRect('.maplibregl-ctrl-bottom-left')
        }, sheet, card);
    }

    /** Fit (epic 3 entry 7): the view fits every item's bounds and keeps until the bounds change or the user moves the map. */
    onFit = (): void => {
        if (!this.map || !this.itemBounds) {
            return;
        }
        this.fitKey = this.itemBoundsKey;
        this.fitTo(this.itemBounds);
        this.publishFit();
    };

    /** Fit bounds inside the visible area (item 27): the fit's own margin plus the camera padding. */
    private fitTo(bounds: [number, number, number, number]): void {
        if (this.map) {
            const pad = this.cameraPadding();
            this.map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], {
                padding: { top: pad.top + FIT_ITEMS_PADDING_PX, bottom: pad.bottom + FIT_ITEMS_PADDING_PX,
                    left: pad.left + FIT_ITEMS_PADDING_PX, right: pad.right + FIT_ITEMS_PADDING_PX },
                animate: false, maxZoom: 16
            });
        }
    }

    /** Return: the map pans to the selected point at the zoom it has (centred in the visible area, item 27), or fits the selected line. */
    onReturn = (): void => {
        const selected = this.state.selected;
        const delegate = this.props.delegate;
        if (!this.map || !selected || !delegate) {
            return;
        }
        const item = this.liveItem(selected.id);
        if (!item) {
            return;
        }
        if (item.geometry.type === 'Point') {
            const at = this.anchorFor(item.id, [item.geometry.coordinates[0], item.geometry.coordinates[1]]);
            this.map.jumpTo({ center: at, padding: this.cameraPadding() });
        } else {
            let west = Infinity;
            let south = Infinity;
            let east = -Infinity;
            let north = -Infinity;
            for (const [x, y] of item.geometry.coordinates) {
                west = Math.min(west, x);
                east = Math.max(east, x);
                south = Math.min(south, y);
                north = Math.max(north, y);
            }
            this.fitTo([west, south, east, north]);
        }
    };

    /**
     * A search result chosen (entry 9, R4): the map zooms to the item and selects it as a click on it
     * does. A point is shown at zoom 15 at least (its glyph, name and icon KPI all draw there), its
     * popup opened and the point click sent; a line or an area is fitted and selected (no popup: a
     * line's popup is entry 2's). The jump is this component's own move, so a kept Fit is ended here.
     */
    onSearchChoose = (result: SearchResult): void => {
        this.openedBy = 'search';
        this.goToItem(result.id, 'Search', '(' + result.matched + ')');
    };

    /** A Needs you row chosen (entry 3, R15): the same move and selection as a search choice. */
    onNeedsYouChoose = (row: NeedsYouRow): void => {
        this.openedBy = 'needsyou';
        this.goToItem(row.id, 'Needs you', '(' + row.state + ')');
        if (this.searchControl) {
            this.searchControl.announce(row.name + ' selected');
        }
    };

    /** Zoom to a map item and select it as a click on it does (the search's and the Needs you list's choice). */
    private goToItem(id: string, via: string, how: string): void {
        const map = this.map;
        const delegate = this.props.delegate;
        const store = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        if (!map || !delegate) {
            return;
        }
        const item = this.liveItem(id);
        if (!item) {
            console.info('[MapStudio] The ' + via + ' choice ' + id + ' is no longer on the map.');
            return;
        }
        this.fitKey = null;
        if (item.geometry.type === 'Point') {
            const lngLat = this.anchorFor(item.id, [item.geometry.coordinates[0], item.geometry.coordinates[1]]);
            // Centred in the visible area, less the top bar, the zoom card and an open sheet or card (item 27).
            map.jumpTo({ center: lngLat, zoom: Math.max(map.getZoom(), CHOSEN_POINT_ZOOM), padding: this.cameraPadding() });
            // The item with its asset link and properties, so the popup's link and a custom view's params fill (entry 8).
            this.openPopup(this.popupPoint(item.id, item.name, item.kind), lngLat);
            if (store) {
                store.sendPointClick(item.id);
            }
        } else {
            let west = Infinity;
            let south = Infinity;
            let east = -Infinity;
            let north = -Infinity;
            for (const [x, y] of item.geometry.coordinates) {
                west = Math.min(west, x);
                east = Math.max(east, x);
                south = Math.min(south, y);
                north = Math.max(north, y);
            }
            this.fitTo([west, south, east, north]);
            this.selectLine(item.id);
        }
        this.publishFit();
        console.info('[MapStudio] ' + via + ': ' + item.name + ' chosen ' + how + '.');
    }

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

    private publishFit(): void {
        if (this.zoomControl) {
            this.zoomControl.setFit(this.itemBounds !== null, this.fitKey !== null);
        }
        if (this.mapContainer) {
            this.mapContainer.setAttribute('data-fit', this.fitKey !== null ? 'kept' : 'off');
        }
    }

    private publishSelection(): void {
        const selected = this.state.selected;
        if (this.zoomControl) {
            this.zoomControl.setReturn(selected !== null);
        }
        if (this.mapContainer) {
            this.mapContainer.setAttribute('data-selected', selected ? selected.id : '');
            this.mapContainer.setAttribute('data-selected-kind', selected ? selected.kind : '');
            // The open segment of a selected line and the instruments highlighted at its ends (entry 2).
            const segment = selected && selected.kind === 'line' && selected.segment ? selected.segment : null;
            this.mapContainer.setAttribute('data-segment', segment ? segment.fromId + '|' + segment.toId : '');
            this.mapContainer.setAttribute('data-highlighted', segment ? segment.fromId + ',' + segment.toId : '');
        }
    }

    /** The view for the e2e suite: the centre and zoom the map is at. */
    private publishView(map: MapLibreMap): void {
        const el = this.mapContainer;
        if (!el || this.map !== map) {
            return;
        }
        const c = map.getCenter();
        el.setAttribute('data-center', c.lng.toFixed(5) + ',' + c.lat.toFixed(5));
        el.setAttribute('data-zoom', map.getZoom().toFixed(2));
    }

    private onStorage = (ev: StorageEvent): void => {
        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        if (delegate) {
            delegate.onStorage(ev.key);
        }
    };

    /** The draw tool is off while map.load says the store is unreachable; a drawing in progress is cancelled. */
    private applyEditing(): void {
        const off = !!this.props.delegate && this.props.delegate.editing === 'off';
        if (this.drawControl) {
            this.drawControl.setDisabled(off);
        }
        if (off && this.state.drawing && this.draw) {
            this.draw.setMode(DRAW_MODE_OFF);
            this.setDrawState(cancelDrawing());
        }
    }

    /**
     * Put the delegate's items into the items sources when they changed; none while map.load
     * says the store is unreachable (nothing stale drawn as current). Then the unsaved items.
     */
    private drawItems(): void {
        this.drawUnsaved();
        const delegate = this.props.delegate;
        const selected = this.state.selected;
        const selectionKey = selected ? selected.kind + ':' + selected.id : '';
        if (!this.map || !this.itemsReady || !delegate || !this.markerColors
            || (delegate.itemsRevision === this.drawnRevision && delegate.liveRevision === this.drawnLive
                && selectionKey === this.drawnSelection && this.withinM === this.drawnWithinM)) {
            return;
        }
        const items = delegate.editing === 'off' ? [] : delegate.items;
        const data = buildFeatures(items, delegate.lists.kinds, delegate.live, selected, this.markerColors, this.withinM);
        this.anchors = data.anchors;
        this.drawnWithinM = this.withinM;
        const source = (id: string): GeoJSONSource | undefined => this.map!.getSource(id) as GeoJSONSource | undefined;
        const lines = source(SOURCE_ITEM_LINES);
        const areas = source(SOURCE_ITEM_AREAS);
        const points = source(SOURCE_ITEM_POINTS);
        const marks = source(SOURCE_LINE_MARKS);
        const arrow = source(SOURCE_ARROW);
        if (lines && areas && points && marks && arrow) {
            lines.setData(data.lines);
            areas.setData(data.areas);
            points.setData(data.points);
            marks.setData(data.marks);
            arrow.setData(data.arrow);
            if (this.searchControl && delegate.itemsRevision !== this.drawnRevision) {
                // The search's entries follow the items (entry 9): names, kinds and the linked assets' names.
                this.searchControl.setEntries(buildEntries(items, delegate.lists.kinds, delegate.lists.assetNames));
            }
            if (this.needsYouControl) {
                // The Needs you summary from the same batch the markers draw from (entry 3, AD-6).
                // While the values are frozen (the connection lost, item 32) the bar shows the state unknown.
                this.needsYouControl.setUnknown(delegate.connection.frozen);
                this.needsYouControl.setSummary(needsYou(items, delegate.lists.kinds, delegate.live, Date.now()));
            }
            if (this.legendControl && (delegate.itemsRevision !== this.drawnRevision || delegate.live.fulls !== this.drawnFulls)) {
                // The legend's key follows the kinds on the map and the kind display of the last full batch (entry 3).
                this.legendControl.setKey(legendKey(items, delegate.lists.kinds, delegate.live.display));
                this.drawnFulls = delegate.live.fulls;
            }
            this.drawnRevision = delegate.itemsRevision;
            this.drawnLive = delegate.liveRevision;
            this.drawnSelection = selectionKey;
            this.itemBounds = data.bounds;
            this.itemBoundsKey = data.boundsKey;
            if (this.mapContainer) {
                // The map items drawn (a shared marker counts its members), as the suite has always read it.
                this.mapContainer.setAttribute('data-items-loaded', String(data.lineItems + data.areas.features.length
                    + data.points.features.reduce((n, f) => n + f.properties.members, 0)));
                this.mapContainer.setAttribute('data-shared-markers', String(data.shared));
                this.mapContainer.setAttribute('data-arrow', String(data.arrow.features.length));
                // The areas and their tints (entry 1), for tests: id, tint name and the resolved colour.
                this.mapContainer.setAttribute('data-areas', JSON.stringify(data.areas.features.map((f) => ({
                    id: f.properties.id, tint: f.properties.tint, color: f.properties.color
                }))));
            }
            this.publishSelection();
            // A kept Fit follows a change of the items' bounds (a new item outside them), nothing else.
            if (this.fitKey !== null && this.fitKey !== data.boundsKey && data.bounds) {
                this.fitKey = data.boundsKey;
                this.fitTo(data.bounds);
            }
            this.publishFit();
            if (!this.itemCountsAsked && delegate.load.state === 'loaded') {
                // The first map.load's items, counted back from MapLibre once it has gone idle with them.
                this.itemCountsAsked = true;
                const map = this.map;
                map.once('idle', () => this.publishItemCounts(map));
            }
        }
    }

    /** The queued items, dashed, leaving out any the store already draws (saved in another tab). */
    private drawUnsaved(): void {
        const delegate = this.props.delegate;
        if (!this.map || !this.itemsReady || !delegate
            || delegate.unsavedRevision + ':' + delegate.itemsRevision === this.drawnUnsaved) {
            return;
        }
        const stored = new Set(delegate.items.filter((i) => i.version > 0).map((i) => i.id));
        const data = itemsToGeoJson(unsavedItems(delegate.unsaved).filter((i) => !stored.has(i.id)));
        const lines = this.map.getSource(SOURCE_UNSAVED_LINES) as GeoJSONSource | undefined;
        const points = this.map.getSource(SOURCE_UNSAVED_POINTS) as GeoJSONSource | undefined;
        if (lines && points) {
            lines.setData(data.lines);
            points.setData(data.points);
            this.drawnUnsaved = delegate.unsavedRevision + ':' + delegate.itemsRevision;
            if (this.mapContainer) {
                // For tests: the features put into the unsaved sources (dashed lines and points).
                this.mapContainer.setAttribute('data-unsaved-drawn',
                    String(data.lines.features.length + data.points.features.length));
            }
        }
    }

    /** A finished line is queued and drawn from the unsaved layer: remove Terra Draw's copy of it. */
    private dropQueuedFeatures(): void {
        if (!this.draw || this.queuedFeatures.length === 0) {
            return;
        }
        const ids = this.queuedFeatures;
        this.queuedFeatures = [];
        for (const id of ids) {
            try {
                this.draw.removeFeatures([id]);
            } catch (err) {
                console.info('[MapStudio] The drawn copy of a queued line was already gone.');
            }
        }
    }

    /** Fetch the sprite once; an image asked for meanwhile waits for it (a failed fetch draws the markers without glyphs). */
    private loadSprite(): Promise<Record<string, SpriteSymbol>> {
        if (this.sprite) {
            return this.sprite;
        }
        if (typeof fetch !== 'function') {
            this.sprite = Promise.resolve({});
            return this.sprite;
        }
        this.sprite = fetch(SPRITE_URL).then((res) => {
            if (!res.ok) {
                throw new Error('HTTP ' + res.status);
            }
            return res.text();
        }).then((text) => {
            this.symbols = parseSprite(text);
            return this.symbols;
        }).catch((err) => {
            console.warn('[MapStudio] The icon sprite could not be loaded (' + String(err && err.message ? err.message : err)
                + '); markers draw without glyphs.');
            this.symbols = {};
            return this.symbols;
        });
        return this.sprite;
    }

    /**
     * MapLibre asked for an image it does not have (the missing image resolver): draw it from the
     * sprite and the theme tokens at the device pixel ratio and add it. The promise settles once the
     * image is in the map (MapLibre waits for it before laying the symbols out); a second ask for the
     * same id shares the first's promise.
     */
    private makeImage(id: string): Promise<void> {
        const map = this.map;
        const colors = this.markerColors;
        if (!map || !colors) {
            return Promise.resolve();
        }
        const made = this.madeImages.get(id);
        if (made) {
            return made;
        }
        const promise = this.loadSprite().then((symbols) => new Promise<void>((resolve) => {
            const spec = imageFor(id, symbols, colors);
            if (!spec || this.map !== map) {
                resolve();
                return;
            }
            const ratio = typeof window !== 'undefined' && window.devicePixelRatio ? Math.min(3, window.devicePixelRatio) : 1;
            const image = new Image();
            image.onload = () => {
                if (this.map === map) {
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(spec.width * ratio);
                    canvas.height = Math.round(spec.height * ratio);
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        if (!map.hasImage(id)) {
                            const scale = (n: number): number => Math.round(n * ratio);
                            map.addImage(id, data, {
                                pixelRatio: ratio,
                                ...(spec.content ? { content: spec.content.map(scale) as [number, number, number, number] } : {}),
                                ...(spec.stretchX ? { stretchX: spec.stretchX.map(([a, b]) => [scale(a), scale(b)] as [number, number]) } : {}),
                                ...(spec.stretchY ? { stretchY: spec.stretchY.map(([a, b]) => [scale(a), scale(b)] as [number, number]) } : {})
                            });
                        }
                    }
                }
                resolve();
            };
            image.onerror = () => {
                console.warn('[MapStudio] A marker image could not be drawn.');
                resolve();
            };
            image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(spec.svg);
        }));
        this.madeImages.set(id, promise);
        return promise;
    }

    componentWillUnmount(): void {
        this.unmounting = true;
        this.stopPopupClock();
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

    /**
     * Terra Draw on the MapLibre adapter, started after the map's own layers so
     * its `td-*` layers draw above them. It idles in the `static` mode and only
     * the toggle enters `linestring`, so the point click round trip keeps the
     * map's clicks while the tool is off. Styles come from theme tokens
     * converted to hex (AD-11); a token that does not resolve leaves that key
     * to the library default, with one warning from drawColor.
     */
    private startTerraDraw(map: MapLibreMap, root: HTMLElement | undefined): void {
        const line = drawColor(root, ['--label', '--neutral-70']);
        const outline = drawColor(root, ['--neutral-20', '--containerRoot', '--container']);
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
        const draw = new TerraDraw({
            adapter: new TerraDrawMapLibreGLAdapter({ map }),
            modes: [new TerraDrawLineStringMode({ styles })]
        });
        draw.on('finish', this.onDrawFinish);
        draw.start();
        this.draw = draw;
        if (this.mapContainer) {
            // Capture phase, so Escape leaves the tool even after Terra Draw has
            // cleaned up its provisional line.
            this.mapContainer.addEventListener('keydown', this.onKeyDown, true);
        }
    }

    /** For the e2e suite: tell a test the map is drawn (its first idle, sources and layers added). */
    private publishReadiness(map: MapLibreMap): void {
        const el = this.mapContainer;
        if (!el || this.map !== map) {
            return;
        }
        this.publishView(map);
        el.setAttribute('data-map-ready', 'true');
    }

    /**
     * For the e2e suite: the point and line items of the first map.load, read back from
     * MapLibre's own item sources (querySourceFeatures, unique by the feature's id
     * property) after the map went idle with them, so they prove the items reached the
     * map. Only features in the loaded tiles count, so on a small viewport some may not.
     */
    private publishItemCounts(map: MapLibreMap): void {
        const el = this.mapContainer;
        if (!el || this.map !== map) {
            return;
        }
        const count = (source: string): number => {
            const ids = new Set<string>();
            for (const f of map.querySourceFeatures(source)) {
                const id = f.properties ? f.properties.id : undefined;
                if (typeof id === 'string') {
                    ids.add(id);
                }
            }
            return ids.size;
        };
        el.setAttribute('data-points-loaded', String(count(SOURCE_ITEM_POINTS)));
        el.setAttribute('data-lines-loaded', String(count(SOURCE_ITEM_LINES)));
    }

    private toggleDrawing = (): void => {
        if (!this.draw || (this.props.delegate && this.props.delegate.editing === 'off')) {
            return;
        }
        if (this.state.drawing) {
            this.draw.setMode(DRAW_MODE_OFF);
            this.setDrawState(cancelDrawing());
        } else {
            this.draw.setMode(DRAW_MODE_LINE);
            this.setDrawState(startDrawing());
        }
    };

    private onDrawFinish = (id: string | number, context: { mode: string; action: string }): void => {
        if (!this.draw || context.mode !== DRAW_MODE_LINE) {
            return;
        }
        const feature = this.draw.getSnapshotFeature(id);
        const geometry = feature ? feature.geometry : undefined;
        const points = geometry && geometry.type === 'LineString' ? geometry.coordinates.length : 0;
        this.draw.setMode(DRAW_MODE_OFF);
        this.setDrawState(finishLine(points));
        console.info('[MapStudio] Line drawn with Terra Draw: ' + points + ' points, id ' + id);
        // Save the finished line through the write path (edits.apply); the Gateway checks the role.
        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        if (delegate && geometry && geometry.type === 'LineString') {
            const coordinates = geometry.coordinates.map((c) => [c[0], c[1]] as [number, number]);
            delegate.sendLineCreate(coordinates);
            this.queuedFeatures.push(id);
            // After Terra Draw's finish handler has returned; componentDidUpdate may do it first.
            setTimeout(() => this.dropQueuedFeatures(), 0);
        }
    };

    private onKeyDown = (ev: KeyboardEvent): void => {
        if (ev.key === 'Escape' && this.state.drawing && this.draw) {
            this.draw.setMode(DRAW_MODE_OFF);
            this.setDrawState(cancelDrawing());
        }
    };

    /**
     * Esc anywhere in the component closes the open popup, card, sheet or pick list (owner review notes
     * item 14) and returns the focus to the map, or to the search field or the Needs you bar that opened
     * it. The controls that handle Esc themselves (the search list, the Needs you list, the legend) stop
     * the event before it gets here, and the draw tool's own Esc runs on the map container.
     */
    private onRootKeyDown = (ev: React.KeyboardEvent<HTMLDivElement>): void => {
        if (ev.key !== 'Escape' || ev.defaultPrevented || this.state.drawing) {
            return;
        }
        if (this.state.popup === null && this.state.pick === null) {
            return;
        }
        ev.preventDefault();
        const openedBy = this.openedBy;
        this.closePopup();
        if (openedBy === 'search' && this.searchControl) {
            this.searchControl.focusInput();
        } else if (openedBy === 'needsyou' && this.needsYouControl) {
            this.needsYouControl.focusBar();
        } else if (this.map) {
            this.map.getCanvas().focus({ preventScroll: true });
        }
    };

    private setDrawState(state: DrawState): void {
        this.setState(state);
        if (this.drawControl) {
            this.drawControl.setPressed(state.drawing);
        }
    }

    private onPointClick = (ev: MapLayerMouseEvent): void => {
        if (this.state.drawing) {
            // The click belongs to the line being drawn.
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
        this.openedBy = null;
        this.openPopup(this.popupPoint(pointId, name, kindId), lngLat);

        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        if (!delegate) {
            console.warn('[MapStudio] No delegate; the click on ' + pointId + ' was not sent.');
            return;
        }
        delegate.sendPointClick(pointId);
    };

    /**
     * A click on the map: a marker opens its popup (a shared marker its pick list) and selects the
     * item; a line selects it (its casing and flow arrow); the ground clears the selection and
     * closes the popup (the template's docs/map.md section 5 item 9). MapLibre's own closeOnClick
     * is not used: it runs after the layer click handler and would close the popup that a click on
     * another point has just moved.
     */
    private onMapClick = (ev: MapMouseEvent): void => {
        if (this.state.drawing || !this.map) {
            return;
        }
        // A click on the map closes the legend panel (entry 14) and the Needs you list (entry 3).
        if (this.legendControl && this.legendControl.isOpen()) {
            this.legendControl.close(false);
        }
        if (this.needsYouControl && this.needsYouControl.isOpen()) {
            this.needsYouControl.close(false);
        }
        const map = this.map;
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
                this.openPick(String(props.memberIds || ''), [nearest.geometry.coordinates[0], nearest.geometry.coordinates[1]]);
                return;
            }
            this.onPointClick({ ...ev, features: [nearest] } as MapLayerMouseEvent);
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
            this.openLinePopup(lineId, segment, [ev.lngLat.lng, ev.lngLat.lat]);
            return;
        }
        this.clearSelection();
    };

    /** A line clicked: selected (casing, flow arrow, Return), the popup closed. */
    private selectLine(id: string, segment: SegmentRef | null = null): void {
        this.closePopup();
        this.setState({ selected: { id, kind: 'line', segment }, pick: null });
        console.info('[MapStudio] Line ' + id + ' selected.');
    }

    /**
     * A line clicked (entry 2, AD-7): its default popup at the clicked segment, the line selected with
     * that segment (the instruments at its ends highlighted), the Gateway told with popup.open
     * {itemId, segment}. A line whose kind shows nothing and that carries no instrument is only
     * selected, as before.
     */
    private openLinePopup(id: string, segment: SegmentRef | null, lngLat: [number, number]): void {
        const delegate = this.props.delegate;
        const item = this.liveItem(id);
        if (!this.map || !delegate || !item || item.geometry.type !== 'LineString') {
            this.selectLine(id, segment);
            return;
        }
        const display = delegate.live.display[item.kind];
        const instruments = instrumentsOn(delegate.items, id);
        const shows = (display && (!!display.popupView || displayShows(display))) || instruments.length > 0;
        if (!shows) {
            this.selectLine(id, segment);
            return;
        }
        if (!instruments.some((i) => iconKpiOf(delegate.live.display[i.kind]) !== null)) {
            // A line with no measuring instrument has no segment to show or to highlight (owner review notes item 17).
            segment = null;
        }
        this.openedBy = null;
        const store = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        const before = this.state.popup;
        if (before && before.point.id !== id && store) {
            store.sendPopupClose(before.point.id);
        }
        if (store) {
            // A new segment of the same line is a new popup.open too: the Gateway keeps the latest.
            store.sendPopupOpen(id, segment);
        }
        this.startPopupClock();
        // The line popup is a card at every width (entry 2's placement; the bottom sheet is a point's,
        // entry 8), so a point's open sheet simply gives way to it.
        const now = Date.now();
        this.setState({
            popup: { point: { ...this.popupPoint(id, item.name, item.kind) }, lngLat, line: true, segment, sheet: false, openedAt: now },
            pick: null, selected: { id, kind: 'line', segment }, clock: now
        }, () => this.showPopupAt(lngLat, LINE_POPUP_PX));
        console.info('[MapStudio] Line ' + id + ' selected' + (segment ? ' at ' + segment.fromId + ' to ' + segment.toId : '') + '.');
    }

    /** The map item with this id that is on the map (not deleted), or undefined. */
    private liveItem(id: string): MapItemRecord | undefined {
        const delegate = this.props.delegate;
        return delegate ? delegate.items.find((i) => i.id === id && !i.deleted) : undefined;
    }

    /** The ground tapped: the selection and the popup go. */
    private clearSelection(): void {
        this.closePopup();
        if (this.state.selected !== null || this.state.pick !== null) {
            this.setState({ selected: null, pick: null });
        }
    }

    /**
     * The map item the popup is opened for: the clicked feature's id, name and kind, with the asset
     * link and the properties from the item record (what the placeholders fill from, entry 8).
     */
    private popupPoint(id: string, name: string, kind: string): PopupPoint {
        const item = this.liveItem(id);
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
    private closePopup = (): void => {
        if (this.popup && this.popup.isOpen()) {
            this.popup.remove();
            return;
        }
        if (this.state.popup !== null && this.state.popup.sheet) {
            this.onPopupClosed();
        }
    };

    /**
     * Open a page of the project (the popup's pop-out link, View alarms): the Perspective client's
     * own history, so the session stays and the page's URL params fill from the path (a filled
     * link is checked to be a page path before it gets here, popupParams.ts). A failure is one
     * console warning; nothing else happens.
     */
    private navigate = (path: string): void => {
        try {
            const client = this.props.store.view.page.parent as unknown as { history?: { push?: (p: string) => void } };
            if (client && client.history && typeof client.history.push === 'function') {
                client.history.push(path);
                return;
            }
            console.warn('[MapStudio] The page ' + path + ' could not be opened: the session has no history.');
        } catch (err) {
            console.warn('[MapStudio] The page ' + path + ' could not be opened: ' + (err instanceof Error ? err.message : String(err)));
        }
    };

    /** A shared marker clicked (epic 3 entry 7): the pick list of its members opens in the popup. */
    private openPick(memberIds: string, lngLat: [number, number]): void {
        const delegate = this.props.delegate;
        if (!delegate) {
            return;
        }
        const rows: PickRow[] = [];
        for (const id of memberIds.split(',')) {
            const item = this.liveItem(id);
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
        const before = this.state.popup;
        const store = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        if (before && store) {
            store.sendPopupClose(before.point.id);
        }
        this.stopPopupClock();
        this.setState({ popup: null, pick: { rows, lngLat }, selected: null }, () => this.showPopupAt(lngLat));
    }

    /** A row of the pick list: what a click on that item's own marker does. */
    private onPick = (id: string): void => {
        const item = this.liveItem(id);
        if (!item || item.geometry.type !== 'Point') {
            return;
        }
        // The popup anchors to the shared marker drawn, not the member's own place (item 20).
        this.openPopup(this.popupPoint(item.id, item.name, item.kind),
            this.anchorFor(item.id, [item.geometry.coordinates[0], item.geometry.coordinates[1]]));
        const store = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        if (store) {
            store.sendPointClick(item.id);
        }
    };

    /**
     * Open (or move) the MapLibre popup at a point. The popup's DOM node is
     * filled by React through a portal in render(), so the embedded project
     * view stays in this component's React tree.
     */
    private openPopup(point: PopupPoint, lngLat: [number, number]): void {
        if (!this.map) {
            return;
        }
        if (!this.hasPopupContent(point)) {
            // No parts and no view: no popup (FR-4); the item is selected all the same.
            this.closePopup();
            this.setState({ pick: null, selected: { id: point.id, kind: 'point' } });
            return;
        }
        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        const before = this.state.popup;
        if (before && before.point.id !== point.id && delegate) {
            delegate.sendPopupClose(before.point.id);
        }
        if (delegate && (!before || before.point.id !== point.id)) {
            delegate.sendPopupOpen(point.id);
        }
        // Below 768 px the popup is a bottom sheet in the component (DESIGN.md Phone); the MapLibre
        // popup, if a card was open, goes without its close event (the state below replaces it).
        const sheet = isSheetWidth(this.map.getContainer().clientWidth);
        if (sheet && this.popup && this.popup.isOpen()) {
            this.popup.off('close', this.onPopupClosed);
            this.popup.remove();
            this.popup.on('close', this.onPopupClosed);
        }
        this.startPopupClock();
        const now = Date.now();
        this.setState({ popup: { point, lngLat, line: false, segment: null, sheet, openedAt: now }, pick: null,
            selected: { id: point.id, kind: 'point' }, clock: now },
        () => (sheet ? this.showSheetFor(lngLat) : this.showPopupAt(lngLat)));
    }

    /** The sheet is in the DOM: pan the map so the item stays above it (its selection ring visible). */
    private showSheetFor(lngLat: [number, number]): void {
        if (!this.map || !this.mapContainer) {
            return;
        }
        const sheetEl = this.mapContainer.parentElement
            ? this.mapContainer.parentElement.querySelector('.mapstudio-sheet') as HTMLElement | null : null;
        if (!sheetEl) {
            return;
        }
        const height = this.map.getContainer().clientHeight;
        const sheetTop = height - sheetEl.offsetHeight - (parseFloat(getComputedStyle(sheetEl).bottom) || 0);
        const y = this.map.project(lngLat).y;
        const limit = sheetTop - SHEET_CLEARANCE_PX;
        if (y > limit) {
            this.map.panBy([0, y - limit], { duration: 200 });
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
    private makePopup(): void {
        this.popupContent = document.createElement('div');
        this.popupContent.className = 'mapstudio-popup-root';
        // The card takes the focus itself when it opens (showPopupAt), so the keyboard is inside it (Tab
        // reaches the page link and close) and no button wears a focus ring on a click (entry 15).
        this.popupContent.tabIndex = -1;
        this.popup = new Popup({
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
        this.popup.setDOMContent(this.popupContent);
        this.popup.on('close', this.onPopupClosed);
    }

    /**
     * Move the popup to the point (after the state that fills its portal has rendered) and open it,
     * placed inside the map less the top bar and the zoom card (owner review notes item 18): the card
     * is measured in the document with the clamp lifted, `placePopup` picks the anchor (above the point
     * first, so its name label stays clear; else beside, below or a corner), clamps the card to the room
     * when nothing fits whole, and pans the map by what is still missing. Point and line cards alike.
     */
    private showPopupAt(lngLat: [number, number], maxPx: number = POPUP_WIDTH_PX): void {
        if (!this.map || !this.popup) {
            return;
        }
        const map = this.map;
        const at = map.project(lngLat);
        const width = map.getContainer().clientWidth;
        const height = map.getContainer().clientHeight;
        // The card keeps its own width; near an edge it goes beside the point or on a corner (item 18).
        this.popup.setMaxWidth(placedMaxWidth(width, maxPx) + 'px');
        if (!this.popup.isOpen()) {
            // The popup joins the map before it is placed: its content rendered already (the portal), but
            // a card measures 0 px tall until the popup's element is in the document (the first line popup
            // of a page opened above its segment and off the map's top with that 0).
            this.popup.setLngLat(lngLat).addTo(map);
            if (this.popupContent) {
                this.popupContent.focus({ preventScroll: true });
            }
        }
        if (this.popupContent) {
            const content = this.popupContent;
            content.style.setProperty('--mapstudio-popup-max-height', 'none');
            const card = content.firstElementChild as HTMLElement | null;
            const natural = card ? card.offsetHeight : 0;
            const cardWidth = card ? card.offsetWidth : Math.min(maxPx, width);
            const obstacles = [this.controlRect('.maplibregl-ctrl-top-left'), this.controlRect('.maplibregl-ctrl-top-right')]
                .filter((r): r is Rect => r !== null);
            const placement = placePopup(at, cardWidth, natural, popupMaxHeight(height), width, height, obstacles, POPUP_OFFSET_PX);
            content.style.setProperty('--mapstudio-popup-max-height', placement.maxHeight + 'px');
            this.popup.options.anchor = placement.anchor;
            this.popupAnchor = placement.anchor;
            if (this.mapContainer) {
                this.mapContainer.setAttribute('data-popup-anchor', lngLat[0].toFixed(6) + ',' + lngLat[1].toFixed(6));
                this.mapContainer.setAttribute('data-popup-side', placement.anchor);
            }
            if (placement.shift[0] !== 0 || placement.shift[1] !== 0) {
                // The card still does not fit: the map pans so the point moves by the shift (the popup moves with it).
                map.panBy([-placement.shift[0], -placement.shift[1]], { duration: 200 });
            }
        }
        // setLngLat runs MapLibre's placement again with the anchor chosen and the card at its real size.
        this.popup.setLngLat(lngLat);
    }

    private startPopupClock(): void {
        if (this.popupClock === null) {
            this.popupClock = setInterval(() => this.setState({ clock: Date.now() }), POPUP_CLOCK_MS);
        }
    }

    private stopPopupClock(): void {
        if (this.popupClock !== null) {
            clearInterval(this.popupClock);
            this.popupClock = null;
        }
    }

    /**
     * MapLibre closed the popup (close button, map click): unmount the view, tell the Gateway, clear the
     * selection (a point's, and from entry 2 a line's, whose popup the selection opened with).
     */
    private onPopupClosed = (): void => {
        this.stopPopupClock();
        this.popupAnchor = null;
        if (this.mapContainer) {
            this.mapContainer.setAttribute('data-popup-anchor', '');
            this.mapContainer.setAttribute('data-popup-side', '');
        }
        const open = this.state.popup;
        if (open !== null) {
            const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
            if (delegate) {
                delegate.sendPopupClose(open.point.id);
            }
        }
        if (open !== null || this.state.pick !== null) {
            this.setState({ popup: null, pick: null, selected: null });
        }
    };

    /**
     * What the open popup shows (AD-7, epic 3 entry 8): the kind setup's custom popup view when it
     * names one, with `mapItem` and its params filled from the item (a missing or failing view
     * falls back to the default popup); else Map Studio's default popup when the kind's display
     * shows something; else nothing (no parts, no popup: FR-4, the item is only selected).
     */
    private popupContentFor(open: OpenPopup): React.ReactNode {
        const store = this.props.store;
        const delegate = this.props.delegate;
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
            const line = this.liveItem(open.point.id);
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
                        now={this.state.clock}
                        onClose={this.closePopup}
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
                now={this.state.clock}
                link={fillLink(display.link, item)}
                alarmPage={fillLink(delegate.alarmPage, item)}
                mode={open.sheet ? 'sheet' : 'card'}
                canEdit={false}
                onClose={this.closePopup}
                onNavigate={this.navigate}
            />
        ) : null));
        if (!display.popupView) {
            return defaultPopup();
        }
        // The custom view: its params may need the base path, which the open's push brings within a
        // moment; the view waits for it (an empty card meanwhile), but not forever.
        if (!live && this.state.clock - open.openedAt < POPUP_DETAIL_WAIT_MS) {
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
                onClose={this.closePopup}
            />
        );
    }

    /** True when a popup would show something for the point (its kind's display is known and shows a part or a view). */
    private hasPopupContent(point: PopupPoint): boolean {
        const delegate = this.props.delegate;
        const display = delegate ? delegate.live.display[point.kind || ''] : undefined;
        return !!display && (!!display.popupView || displayShows(display));
    }

    /**
     * The popup's content in its place: the pick list or the card in the MapLibre popup (a portal
     * into its DOM node), or the bottom sheet in the component below 768 px.
     */
    private renderPopup(): React.ReactNode {
        const pick = this.state.pick;
        if (pick && this.popupContent) {
            return ReactDOM.createPortal(<PickList rows={pick.rows} onPick={this.onPick} />, this.popupContent);
        }
        const open = this.state.popup;
        if (!open) {
            return null;
        }
        if (open.sheet) {
            return (
                <div className="mapstudio-sheet" role="dialog" aria-label={open.point.name} data-point-id={open.point.id} tabIndex={-1}>
                    {this.popupContentFor(open)}
                </div>
            );
        }
        if (!this.popupContent) {
            return null;
        }
        return ReactDOM.createPortal(this.popupContentFor(open), this.popupContent);
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
            this.loadSprite().then(() => this.forceUpdate());
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
        const echo = this.props.props.editMode;
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
                {this.renderPopup()}
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
