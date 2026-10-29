import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {
    AbstractUIElementStore,
    Component,
    ComponentMeta,
    ComponentProps,
    ComponentStoreDelegate,
    JsObject,
    PageStore,
    PComponent,
    PropertyTree,
    Size2d
} from '@inductiveautomation/perspective-client';
import {
    ErrorEvent, GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, MapMouseEvent, Popup, setWorkerUrl
} from 'maplibre-gl';
import type { ExpressionSpecification } from 'maplibre-gl';
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
import { MapChanges, MapChangedBody } from './changes';
import { EditLevel, MapItemRecord } from './contract';
import { AdapterStatus, HostLists, NO_HOST_LISTS } from './adapters';
import { MESSAGE_EVENT, Reply, basemapSource, mapLoad, pointClick, popupClose, popupOpen, readReply, replyText } from './messages';
import {
    BasemapId, OSM_SOURCE, RasterSource, fallbackBasemap, initialBasemap, offeredBasemaps, refusedText, rememberBasemap,
    rememberedBasemap, tilesFailedText
} from './basemaps';
import { LegendControl } from './LegendControl';
import { LegendToggle, legendKey, readToggle, sessionStore, writeToggle } from './legend';
import { NeedsYouControl } from './NeedsYouControl';
import { NeedsYouRow, needsYou } from './needsyou';
import { FIT_PADDING_PX, StartingArea, readStartingArea, startingAreaKey } from './startingArea';
import { LIVE_INITIAL, LiveState, ValuesBatchBody, applyBatch, itemPreset, itemState } from './live';
import {
    AREA_FILL_OPACITY, AREA_LINE_OPACITY, AREA_LINE_WIDTH, ARROW_IMAGE, CHIP_IMAGE, CHIP_PADDING, CHIP_SIZE, DIMMED_OPACITY, DISC_CENTER,
    FONT_CHIP, FONT_NAME, HALO_WIDTH, KPI_SIZE, KPI_TOP_PX, LINE_CHIP_OFFSET_BADGE_EM, LINE_CHIP_OFFSET_EM, LINE_DASH, LINE_DOT,
    MARKER_IMAGE, MARKER_TOKENS, MarkerColors, NAME_SIZE, NAME_TOP_PX, SpriteSymbol, TEXT_PADDING, ZOOM_DOT, ZOOM_KPI, ZOOM_NAME,
    imageFor, markerProperties, parseSprite, stateWord, textWidthPx
} from './markers';
import { PresetPalette, StylePreview, TintPalette } from './StylePreview';
import { MapFeatures, Selection, buildFeatures } from './features';
import { ZoomControl } from './ZoomControl';
import { SearchControl } from './SearchControl';
import { CHOSEN_POINT_ZOOM, SearchResult, buildEntries } from './search';
import { PickList, PickRow } from './PickList';
import { DefaultPopup } from './DefaultPopup';
import {
    STORE_UNKNOWN, StoreState, storeStateAttribute, storeStateFromError, storeStateFromLoad, storeStateFromSaveError,
    storeStatusText
} from './storeState';
import { PointPopup } from './PointPopup';
import { SAVE_IDLE, SaveState, itemsToGeoJson, lineCreateBatch, newId, refusedSave, saveStatusText } from './save';
import {
    KeyValueStore, REPLAY_INTERVAL_MS, STORAGE_WARNING, UnsavedEntry, UnsavedQueue, UnsavedReason, entryText, isBusy,
    reasonFromError, savedRecords, storageKey, summaryText, unsavedItems
} from './unsaved';
import { UnsavedSender } from './unsavedSender';
import { AuthorParams, PopupPoint, popupMaxWidth, popupMountPath } from './popupParams';
import { registerTestHook, registerTestView, takeTestReply } from './testHook';
import { drawColor, themeColor } from './theme';
import { Kind } from './adapters';

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
     * Spike-only (story 4): the project view opened as a popup on a point
     * click, with the author's params. A later version names it in the kind
     * setup (AD-7).
     */
    popupView: {
        path: string;
        params: AuthorParams;
    };
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

/** The popup that is open: the clicked point with its map coordinates. */
interface OpenPopup {
    point: PopupPoint;
    lngLat: [number, number];
}

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

/** The basemap the map draws (epic 3 entry 6, basemaps.ts): what the setup offers, the choice, its source. */
export interface BasemapState {
    /** The basemaps the setup offers that this version draws, in the setup's order. */
    offered: BasemapId[];
    /** The chosen basemap, or null before map.load answered (or when nothing is offered). */
    selected: BasemapId | null;
    /** The raster source drawn under the items: null for None, or while the satellite source is awaited. */
    source: RasterSource | null;
    /** A refusal in plain words (the Gateway's message after the basemap's name), or ''. */
    status: string;
    /** Bumped on every change, so the component knows to redraw the basemap. */
    revision: number;
}

export const BASEMAP_INITIAL: BasemapState = { offered: [], selected: null, source: null, status: '', revision: 0 };

/** The delegate state the component renders. */
export interface MapStudioDelegateState {
    /** The basemap: what the setup offers, the viewer's choice and its tile source (epic 3 entry 6). */
    basemap: BasemapState;
    /** The last point-click reply from the Gateway as one line of text, or '' before the first. */
    lastReply: string;
    /** Id of the point.click message whose reply is awaited, or null. */
    pendingId: string | null;
    /** The map store's items: map.load's, then every map.changed and this session's saves. */
    items: MapItemRecord[];
    /** The last change sequence number applied (map.load.reply or map.changed), or null before the first. */
    seq: number | null;
    /** How many times a gap in map.changed made this map reload with map.load. */
    reloads: number;
    /** Bumped whenever items change, so the component knows to redraw them. */
    itemsRevision: number;
    /** The level map.load reported, or null before it answered. */
    level: EditLevel | null;
    /** The project setup's refresh interval map.load reported, or null (not loaded, failed, or not sent). */
    refreshIntervalSeconds: number | null;
    /** 'loading', 'loaded', or the store-unreachable (or other) reason map.load answered. */
    load: { state: 'loading' | 'loaded' | 'failed'; message: string };
    /** The last save of a drawn line. */
    save: SaveState;
    /** The project's kind list, asset list (editors only) and their statuses, from map.load. */
    lists: HostLists;
    /** The map store's state: ready, read only (with the reason) or unavailable (epic 2 story 5). */
    store: StoreState;
    /** Every queued batch of this project and user, oldest first (epic 2 story 8, unsaved.ts). */
    unsaved: UnsavedEntry[];
    /** Bumped whenever the queue changes, so the component knows to redraw the unsaved items. */
    unsavedRevision: number;
    /** The queued batches this tab waits on a reply for: their Discard is off meanwhile. */
    sending: string[];
    /**
     * 'off' while map.load says the map store is unreachable (not the busy answer): the draw
     * tool is disabled and no store item is drawn; map.load is re-sent every 15 s meanwhile.
     */
    editing: 'on' | 'off';
    /** The one warning when this browser cannot keep unsaved edits, or ''. */
    storageWarning: string;
    /** The live values and kind display of the last batches (epic 3 entry 5, live.ts). */
    live: LiveState;
    /** Bumped whenever a batch is applied, so the component knows to redraw the markers. */
    liveRevision: number;
}

/** `localStorage`, or null when the browser refuses it (a private window, blocked site data). */
function browserStorage(): KeyValueStore | null {
    try {
        return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
    } catch (err) {
        return null;
    }
}

/** What the delegate reads of the Perspective client: the project name and the connection [unverified live]. */
interface ClientView {
    projectName?: unknown;
    connection?: { connected?: unknown };
}

function clientOf(component: AbstractUIElementStore): ClientView | null {
    try {
        return component.view.page.parent as unknown as ClientView;
    } catch (err) {
        return null;
    }
}

/**
 * Browser side of the component delegate: sends envelopes to the Gateway
 * delegate and keeps what the replies say. Point-click replies set the reply
 * line; map.load and edits.apply replies are routed by message id and never
 * change it, and they log to the console at info only. map.changed (sent to
 * every open map of the project after each committed batch) goes to changes.ts
 * first and never touches the reply line or the pending point click; a gap in
 * its seq sends map.load once.
 */
export class MapStudioStoreDelegate extends ComponentStoreDelegate {
    private lastReply = '';
    private pendingId: string | null = null;
    /** map.load.reply, map.changed and own saves, by the rule of changes.ts; sends map.load on a gap. */
    private changes = new MapChanges(() => this.sendMapLoadMessage(), (afterSeq) => {
        console.info('[MapStudio] Reloading the map after seq ' + afterSeq + ' (a missed change, or a failed load).');
    });
    private itemsRevision = 0;
    private level: EditLevel | null = null;
    private refreshIntervalSeconds: number | null = null;
    private load: MapStudioDelegateState['load'] = { state: 'loading', message: '' };
    private save: SaveState = SAVE_IDLE;
    private lists: HostLists = NO_HOST_LISTS;
    private store: StoreState = STORE_UNKNOWN;
    private mapLoadId: string | null = null;
    /** The queue of unsent and refused batches (unsaved.ts), in localStorage per project and user. */
    private unsaved: UnsavedQueue;
    /** Sends the queue: reply timer, replay chain and level gate (unsavedSender.ts). */
    private sender: UnsavedSender;
    private unsavedRevision = 0;
    private storageWarning = '';
    /** Re-sends map.load every 15 s while the last one failed (store unreachable, busy). */
    private loadRetryTimer: ReturnType<typeof setTimeout> | null = null;
    /** The batch whose save the save status shows (the last line drawn here), or null. */
    private saveBatchId: string | null = null;
    private live: LiveState = LIVE_INITIAL;
    private liveRevision = 0;
    private basemap: BasemapState = BASEMAP_INITIAL;
    /** The id of the basemap.source message whose reply is awaited, or null. */
    private basemapPendingId: string | null = null;
    /** The satellite source once the Gateway answered it (its tile URL holds the token): memory only. */
    private satelliteSource: RasterSource | null = null;
    private storage: KeyValueStore | null;

    constructor(componentStore: AbstractUIElementStore) {
        super(componentStore);
        registerTestHook((message) => this.fireEvent(MESSAGE_EVENT, message as unknown as JsObject));
        const storage = browserStorage();
        this.storage = storage;
        this.unsaved = new UnsavedQueue(storage, () => this.warnStorage());
        this.sender = new UnsavedSender(this.unsaved, {
            level: () => this.level,
            connected: () => this.connected(),
            fire: (message) => this.fireEvent(MESSAGE_EVENT, message as unknown as JsObject),
            changed: () => {
                this.unsavedRevision++;
                this.notify();
            },
            unsent: (batchId, reason) => this.onUnsent(batchId, reason)
        });
        if (!storage) {
            this.warnStorage();
        }
    }

    private warnStorage(): void {
        if (this.storageWarning === '') {
            this.storageWarning = STORAGE_WARNING;
            console.info('[MapStudio] ' + STORAGE_WARNING);
        }
    }

    mapStateToProps(): MapStudioDelegateState {
        return {
            basemap: this.basemap,
            lastReply: this.lastReply,
            pendingId: this.pendingId,
            items: this.changes.state.items,
            seq: this.changes.seq,
            reloads: this.changes.reloads,
            itemsRevision: this.itemsRevision,
            level: this.level,
            refreshIntervalSeconds: this.refreshIntervalSeconds,
            load: this.load,
            save: this.save,
            lists: this.lists,
            store: this.store,
            unsaved: this.unsaved.list(),
            unsavedRevision: this.unsavedRevision,
            sending: this.sender.sending(),
            editing: this.store.status === 'unavailable' ? 'off' : 'on',
            storageWarning: this.storageWarning,
            live: this.live,
            liveRevision: this.liveRevision
        };
    }

    /**
     * Choose a basemap (epic 3 entry 6): None and OpenStreetMap draw at once; Satellite asks the Gateway for
     * its tile source (basemap.source) unless it was answered before, and draws when the reply comes. A
     * choice the user made is remembered in this browser (the id only). A basemap the setup does not
     * offer is ignored.
     */
    selectBasemap(id: BasemapId, options: { remember?: boolean; keepStatus?: boolean } = {}): void {
        if (this.basemap.offered.indexOf(id) < 0) {
            return;
        }
        if (options.remember !== false) {
            rememberBasemap(this.storage, id);
        }
        const status = options.keepStatus ? this.basemap.status : '';
        if (id === 'satellite' && !this.satelliteSource) {
            const message = basemapSource('satellite');
            this.basemapPendingId = message.id;
            this.setBasemap({ ...this.basemap, status });
            this.fireEvent(MESSAGE_EVENT, message as unknown as JsObject);
            return;
        }
        this.basemapPendingId = null;
        this.setBasemap({
            ...this.basemap,
            selected: id,
            source: id === 'none' ? null : id === 'osm' ? OSM_SOURCE : this.satelliteSource,
            status
        });
    }

    private setBasemap(next: Omit<BasemapState, 'revision'>): void {
        this.basemap = { ...next, revision: this.basemap.revision + 1 };
        this.notify();
    }

    /** map.load answered: the setup's basemaps are offered, and the first choice is made when none is drawn yet. */
    private offerBasemaps(setupList: string[] | undefined): void {
        const { offered, dropped } = offeredBasemaps(setupList === undefined ? ['none', 'osm'] : setupList);
        if (dropped.length > 0 && dropped.join(',') !== this.basemap.offered.join(',')) {
            console.info('[MapStudio] The setup lists basemaps this version does not draw: ' + dropped.join(', ')
                + ' (the Mapbox vector style is deferred).');
        }
        const same = offered.join(',') === this.basemap.offered.join(',');
        if (!same) {
            this.setBasemap({ ...this.basemap, offered });
        }
        const selected = this.basemap.selected;
        if (selected === null || offered.indexOf(selected) < 0) {
            const initial = initialBasemap(offered, rememberedBasemap(this.storage));
            if (initial !== null) {
                this.selectBasemap(initial, { remember: false });
            } else if (selected !== null) {
                this.setBasemap({ ...this.basemap, selected: null, source: null, status: '' });
            }
        }
    }

    /** The satellite source arrived: kept in memory, drawn when it is the pending choice. */
    private onBasemapSource(reply: Reply & { kind: 'basemap.source.reply' }): void {
        if (reply.id !== this.basemapPendingId) {
            console.info('[MapStudio] A basemap.source.reply that nothing waits for was ignored.');
            return;
        }
        this.basemapPendingId = null;
        if (!reply.body) {
            this.refuseBasemap('satellite', 'the Gateway\'s reply could not be read.');
            return;
        }
        this.satelliteSource = reply.body.source;
        console.info('[MapStudio] ' + replyText(reply));
        this.setBasemap({ ...this.basemap, selected: 'satellite', source: this.satelliteSource, status: '' });
    }

    /** The Gateway refused the basemap's source: the status says why, and a map with nothing drawn falls back. */
    private refuseBasemap(id: BasemapId, message: string): void {
        this.basemapPendingId = null;
        const status = refusedText(id, message);
        console.info('[MapStudio] ' + status);
        this.setBasemap({ ...this.basemap, status });
        if (this.basemap.selected === null) {
            const fallback = fallbackBasemap(this.basemap.offered, id);
            if (fallback !== null) {
                this.selectBasemap(fallback, { remember: false, keepStatus: true });
            }
        }
    }

    /** The popup of a map item opened: the Gateway pushes its values on change until popup.close (AD-7). */
    sendPopupOpen(itemId: string): void {
        this.fireEvent(MESSAGE_EVENT, popupOpen(itemId) as unknown as JsObject);
    }

    sendPopupClose(itemId: string): void {
        this.fireEvent(MESSAGE_EVENT, popupClose(itemId) as unknown as JsObject);
    }

    /** A values.batch: merged into the live state (a full one replaces it); an unreadable one is ignored. */
    private onValuesBatch(body: ValuesBatchBody | null): void {
        if (!body) {
            console.warn('[MapStudio] An unreadable values.batch was ignored; the next full batch replaces the values.');
            return;
        }
        this.live = applyBatch(this.live, body);
        this.liveRevision++;
        console.debug('[MapStudio] Live values: ' + (body.full ? 'full, ' : '') + body.items.length + ' item(s) at seq ' + body.seq);
        this.notify();
    }

    /** Send `point.click` for one point; the reply arrives in handleEvent. */
    sendPointClick(pointId: string): void {
        const message = pointClick(pointId);
        this.pendingId = message.id;
        this.notify();
        this.fireEvent(MESSAGE_EVENT, message as unknown as JsObject);
    }

    /** Ask the Gateway for the map (map.load); the items and the level arrive in handleEvent. */
    sendMapLoad(): void {
        this.changes.load();
    }

    private sendMapLoadMessage(): void {
        const message = mapLoad();
        this.mapLoadId = message.id;
        this.load = { state: 'loading', message: '' };
        this.notify();
        this.fireEvent(MESSAGE_EVENT, message as unknown as JsObject);
    }

    /**
     * Save a finished line as one new map item (edits.apply with one create op). The batch is
     * queued (localStorage) before it is sent, and stays queued until its reply or a Discard.
     */
    sendLineCreate(coordinates: Array<[number, number]>): string {
        const itemId = newId();
        const now = new Date();
        const batch = lineCreateBatch(itemId, newId(), coordinates, now);
        this.save = { state: 'saving', itemId };
        this.saveBatchId = batch.batchId;
        this.sender.enqueueAndSend(batch, now);
        return itemId;
    }

    /** Try again: a refused entry becomes unsent and the queue replays now. */
    retryUnsaved(batchId: string): void {
        this.sender.retry(batchId);
    }

    /** Discard: the entry leaves storage and the map, and is never sent again (not while in flight). */
    discardUnsaved(batchId: string): void {
        if (!this.sender.discard(batchId)) {
            console.info('[MapStudio] Batch ' + batchId + ' is being sent; Discard waits for its answer.');
        }
    }

    /** A `storage` event: another tab may have changed this queue. */
    onStorage(key: string | null): void {
        this.sender.storage(key);
    }

    /** Stop the replay and load retry timers (the component unmounted). */
    stopReplay(): void {
        this.sender.stop();
        if (this.loadRetryTimer !== null) {
            clearTimeout(this.loadRetryTimer);
            this.loadRetryTimer = null;
        }
    }

    /** The client's connection state; true when it cannot be read [unverified live]. */
    private connected(): boolean {
        const client = clientOf(this.component);
        const connection = client ? client.connection : undefined;
        return !connection || connection.connected !== false;
    }

    /** The project for the storage key, or null when the client does not say [unverified live]. */
    private projectName(): string | null {
        const client = clientOf(this.component);
        return client && typeof client.projectName === 'string' && client.projectName !== '' ? client.projectName : null;
    }

    /** No answer, or not connected: the save status says unsent; the sender replays it. */
    private onUnsent(batchId: string, reason: UnsavedReason): void {
        if (this.save.state !== 'idle' && batchId === this.saveBatchId) {
            this.save = { state: 'unsent', itemId: this.save.itemId, code: reason.code };
        }
        console.info('[MapStudio] Batch ' + batchId + ' not saved yet (' + reason.code + '); kept to replay.');
    }

    /** While the last map.load failed, send it again in 15 s (MapChanges.retryFailedLoad). */
    private scheduleLoadRetry(): void {
        if (this.loadRetryTimer !== null) {
            return;
        }
        this.loadRetryTimer = setTimeout(() => {
            this.loadRetryTimer = null;
            if (this.changes.retryFailedLoad()) {
                console.info('[MapStudio] Sending map.load again after a failed load.');
            }
        }, REPLAY_INTERVAL_MS);
    }

    handleEvent(eventName: string, eventObject: JsObject): void {
        if (eventName !== MESSAGE_EVENT) {
            console.warn('[MapStudio] Ignoring unknown model event ' + eventName);
            return;
        }
        if (takeTestReply(eventObject)) {
            return;
        }
        const reply = readReply(eventObject);
        if (reply.kind === 'map.changed') {
            this.onMapChanged(reply.body);
            return;
        }
        if (reply.kind === 'values.batch') {
            this.onValuesBatch(reply.body);
            return;
        }
        if (reply.kind === 'basemap.source.reply') {
            this.onBasemapSource(reply);
            return;
        }
        if (reply.kind === 'error' && this.basemapPendingId !== null && reply.id === this.basemapPendingId) {
            this.refuseBasemap('satellite', reply.body.message);
            return;
        }
        if (reply.kind === 'map.load.reply' || (reply.kind === 'error' && reply.id === this.mapLoadId)) {
            this.onMapLoad(reply);
            return;
        }
        if (reply.kind === 'edits.apply.reply' || (reply.kind === 'error' && this.sender.owns(reply.id))) {
            this.onSave(reply);
            return;
        }
        if (reply.kind !== 'invalid' && this.pendingId !== null && reply.id !== this.pendingId) {
            console.warn('[MapStudio] Reply ' + reply.id + ' does not match the pending message ' + this.pendingId);
        }
        this.lastReply = replyText(reply);
        this.pendingId = null;
        console.info('[MapStudio] ' + this.lastReply);
        this.notify();
    }

    private onMapLoad(reply: Reply): void {
        this.mapLoadId = null;
        console.info('[MapStudio] ' + replyText(reply));
        if (reply.kind === 'map.load.reply') {
            this.level = reply.body.level;
            this.lists = reply.body.lists;
            this.refreshIntervalSeconds = reply.body.setup ? reply.body.setup.refreshIntervalSeconds : null;
            this.load = { state: 'loaded', message: '' };
            this.itemsRevision++;
            this.store = storeStateFromLoad(reply.body);
            // May send one more map.load (a gap among the changes held during the load).
            this.changes.loaded(reply.body);
            // The queue of this project and user (owner decision, 2026-10-27); '' when map.load names none.
            const project = this.projectName();
            if (project !== null) {
                this.unsaved.setKey(storageKey(project, reply.body.user || ''));
            } else {
                console.info('[MapStudio] The project name is unknown; unsaved edits are kept in this page only.');
                this.warnStorage();
            }
            this.unsavedRevision++;
            this.offerBasemaps(reply.body.setup ? reply.body.setup.basemaps : undefined);
        } else if (reply.kind === 'error') {
            this.load = { state: 'failed', message: reply.body.code + ': ' + reply.body.message };
            this.changes.loadFailed();
            this.scheduleLoadRetry();
            if (!isBusy(reply.body)) {
                this.level = null;
                this.refreshIntervalSeconds = null;
                this.store = storeStateFromError(this.store, reply.body);
                // No store item is drawn as current while the store is unreachable.
                this.itemsRevision++;
            }
            // The busy answer of the bounded pool is a short spell: the level, the store
            // state and the items drawn stay, editing stays on, and the retry loads again.
        }
        this.notify();
        this.sender.replay();
    }

    /** A map.changed from the Gateway; `body` is null when it could not be read (a gap). */
    private onMapChanged(body: MapChangedBody | null): void {
        if (this.changes.changed(body)) {
            this.itemsRevision++;
            console.debug('[MapStudio] Map changed: seq ' + this.changes.seq);
            this.notify();
        }
        this.sender.replay();
    }

    private onSave(reply: Reply): void {
        if (reply.kind !== 'edits.apply.reply' && reply.kind !== 'error') {
            return;
        }
        const outcome = reply.kind === 'edits.apply.reply'
            ? this.sender.onSaved(reply.id, reply.body.batchId)
            : this.sender.onError(reply.id, reasonFromError(reply.body));
        console.info('[MapStudio] ' + replyText(reply));
        if (outcome.kind === 'ignored') {
            console.info('[MapStudio] The save reply ' + reply.id + ' changes nothing (an earlier send, or discarded).');
            return;
        }
        const shown = outcome.batchId === this.saveBatchId && this.save.state !== 'idle';
        if (reply.kind === 'edits.apply.reply' && outcome.kind === 'saved') {
            if (outcome.entry) {
                for (const record of savedRecords(outcome.entry.batch, reply.body.results)) {
                    if (this.changes.saved(record)) {
                        this.itemsRevision++;
                    }
                }
            }
            if (shown && this.save.state !== 'idle') {
                const itemId = this.save.itemId;
                const result = reply.body.results.find((r) => r.id === itemId);
                this.save = { state: 'saved', itemId, version: result ? result.version : 1 };
            }
        } else if (reply.kind === 'error') {
            if (shown && this.save.state !== 'idle') {
                this.save = refusedSave(this.save.itemId, reply.body);
            }
            this.store = storeStateFromSaveError(this.store, reply.body);
        }
        this.notify();
    }
}

type Props = ComponentProps<MapStudioProps, MapStudioDelegateState>;

/** The basemap's raster source and layer (epic 3 entry 6), drawn under the item layers. */
const SOURCE_BASEMAP = 'mapstudio-basemap';
const LAYER_BASEMAP = 'mapstudio-basemap';
/** The map store's items (map.load and this session's saves). */
const SOURCE_ITEM_LINES = 'mapstudio-items-line';
const SOURCE_ITEM_POINTS = 'mapstudio-items-point';
/** The areas (a line kind with `area: true`, epic 3 entry 1): a closed fill in the category tint and its outline, under the lines. */
const SOURCE_ITEM_AREAS = 'mapstudio-items-area';
const LAYER_AREA_FILL = 'mapstudio-items-area-fill';
const LAYER_AREA_LINE = 'mapstudio-items-area-line';
/** The `dotted` preset's lines (entry 1): round dots, a layer of their own since the dash pattern is not data-driven. */
const LAYER_ITEM_LINES_DOTTED = 'mapstudio-items-line-dotted';
/** Each line's midpoint mark (its name chip and alarm badge) and the selected line's flow arrow (features.ts). */
const SOURCE_LINE_MARKS = 'mapstudio-line-marks';
const SOURCE_ARROW = 'mapstudio-arrow';
/** The lines: the selection casing under them, dashed (comms lost, stale, no data) and solid, weight and hue per feature. */
const LAYER_LINE_CASING = 'mapstudio-items-line-casing';
const LAYER_ITEM_LINES_DASHED = 'mapstudio-items-line-dashed';
const LAYER_ITEM_LINES = 'mapstudio-items-line';
/**
 * The point text, lowest first (epic 3 entry 7): the icon KPI, the state chip, the name; then the
 * line chips and badges; then the markers (icons placed first, so no text covers a disc); the arrow on top.
 */
const LAYER_ITEM_KPI = 'mapstudio-items-kpi';
const LAYER_ITEM_CHIPS = 'mapstudio-items-chip';
const LAYER_ITEM_NAMES = 'mapstudio-items-name';
const LAYER_LINE_CHIPS = 'mapstudio-line-chip';
const LAYER_LINE_BADGES = 'mapstudio-line-badge';
const LAYER_ITEM_MARKERS = 'mapstudio-items-marker';
const LAYER_ARROW = 'mapstudio-arrow';
/** The served sprite the marker images are drawn from (docs/icons.md). */
const SPRITE_URL = '/res/mapstudio/icons/mapstudio-icons.svg';
/** The served glyphs the text layers are set in (web/scripts/glyphs.mjs, docs/icons.md). */
const GLYPHS_URL = '/res/mapstudio/glyphs/{fontstack}/{range}.pbf';
/** Fit's padding round every item (px). */
const FIT_ITEMS_PADDING_PX = 48;
/** The popup's offset from the point: the disc radius and the ring, so the tip touches the disc. */
const POPUP_OFFSET_PX = 22;
/** The chip's text offset, quantised to steps of this many ems for the data-driven text-offset. */
const CHIP_OFFSET_STEP_EM = 0.25;
const CHIP_OFFSET_MAX_EM = 16;
/** How often an open popup's data ages are redrawn. */
const POPUP_CLOCK_MS = 5000;
/** The queued (unsaved) map items, drawn dashed (epic 2 story 8). */
const SOURCE_UNSAVED_LINES = 'mapstudio-unsaved-line';
const SOURCE_UNSAVED_POINTS = 'mapstudio-unsaved-point';
const LAYER_UNSAVED_LINES = 'mapstudio-unsaved-line';
const LAYER_UNSAVED_POINTS = 'mapstudio-unsaved-point';

/** The first token of each list that resolves on the root (theme.ts), for the marker images. */
function markerColors(root: HTMLElement | undefined): MarkerColors {
    const first = (tokens: readonly string[]): string => {
        for (const token of tokens) {
            const value = themeColor(root, token);
            if (value !== 'transparent') {
                return value;
            }
        }
        return 'transparent';
    };
    let font = 'sans-serif';
    if (root && typeof getComputedStyle === 'function') {
        const family = getComputedStyle(root).fontFamily;
        if (family) {
            font = family;
        }
    }
    return {
        disc: first(MARKER_TOKENS.disc),
        glyph: first(MARKER_TOKENS.glyph),
        halo: first(MARKER_TOKENS.halo),
        textSecondary: first(MARKER_TOKENS.textSecondary),
        line: first(MARKER_TOKENS.line),
        chipEdge: first(MARKER_TOKENS.chipEdge),
        selection: first(MARKER_TOKENS.selection),
        commsLost: first(MARKER_TOKENS.commsLost),
        alarm: [first(MARKER_TOKENS.alarm1), first(MARKER_TOKENS.alarm2), first(MARKER_TOKENS.alarm3)],
        font,
        attention: first(MARKER_TOKENS.attention),
        warning: first(MARKER_TOKENS.warning),
        fault: first(MARKER_TOKENS.fault),
        tints: [first(MARKER_TOKENS.tint1), first(MARKER_TOKENS.tint2), first(MARKER_TOKENS.tint3), first(MARKER_TOKENS.tint4),
            first(MARKER_TOKENS.tint5), first(MARKER_TOKENS.tint6)]
    };
}

/** A style expression as the layer definitions take it (the spec's own type is too narrow for the ones built here). */
type Expression = ExpressionSpecification;

/**
 * The chip text's offset as a data-driven `text-offset`: MapLibre builds no array from a feature
 * value, so the per-feature `chipOffset` (ems) is stepped to literal pairs every CHIP_OFFSET_STEP_EM.
 */
function chipOffsetExpression(): Expression {
    const y = NAME_TOP_PX / CHIP_SIZE;
    const expr: unknown[] = ['step', ['get', 'chipOffset'], ['literal', [0, y]]];
    for (let em = CHIP_OFFSET_STEP_EM; em <= CHIP_OFFSET_MAX_EM; em += CHIP_OFFSET_STEP_EM) {
        expr.push(em, ['literal', [em, y]]);
    }
    return expr as unknown as Expression;
}

/** One rendered label's box on the map, in container pixels, for the e2e overlap check (an estimate from the layout). */
interface LabelBox {
    layer: string;
    id: string;
    text: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

/**
 * The Map Studio component: a MapLibre map on a blank style that draws the
 * project's map items from the map store. Clicking a point item sends
 * `point.click` through the delegate; the reply is shown as text over the map.
 */
export class MapStudio extends Component<Props, MapStudioState> {
    state: MapStudioState = { ...DRAW_IDLE, popup: null, clock: Date.now(), pick: null, selected: null };

    private mapContainer: HTMLDivElement | null = null;
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
    /** The theme colours the marker images are drawn with, read once at mount. */
    private markerColors: MarkerColors | null = null;
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
    /** The legend bottom-left, which holds the basemap choice (epic 3 entries 6 and 14), and the basemap revision last drawn. */
    private legendControl: LegendControl | null = null;
    private drawnBasemap = -1;
    /** The raster source the map holds now (by identity), or null for none. */
    private drawnSource: RasterSource | null = null;
    /** The drawn basemap's tiles: none (no source), loading, loaded (the map went idle) or failed (a tile error). */
    private tiles: 'none' | 'loading' | 'loaded' | 'failed' = 'none';
    /** The starting area last applied (startingAreaKey), so a changed prop moves the map once. */
    private appliedArea = '';

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
        const root = this.props.store.element as HTMLElement | undefined;
        const colors = {
            background: themeColor(root, '--containerRoot'),
            line: themeColor(root, '--neutral-70'),
            point: themeColor(root, '--label'),
            pointStroke: themeColor(root, '--containerRoot')
        };
        const mc = markerColors(root);
        this.markerColors = mc;
        this.makePopup();
        const map = new MapLibreMap({
            container: this.mapContainer,
            style: {
                version: 8,
                // The bundled glyphs, served by the Gateway beside the bundle: the text layers' one font source.
                glyphs: GLYPHS_URL,
                sources: {},
                layers: [{
                    id: 'background',
                    type: 'background',
                    paint: { 'background-color': colors.background }
                }]
            },
            ...(area.kind === 'bounds'
                ? { bounds: area.bounds, fitBoundsOptions: { padding: FIT_PADDING_PX } }
                : { center: area.center, zoom: area.zoom }),
            attributionControl: false
        });
        // The View-mode controls as designed (epic 3 entry 14, DESIGN.md View mode): one zoom card top-right
        // (plus, the level, minus, Fit, Return), and bottom-left the Legend button with the scale bar and the
        // attribution beside it, whose panel holds the basemap choice; the bottom-right corner stays clear
        // for the Perspective App Bar toggle.
        this.zoomControl = new ZoomControl(this.onFit, this.onReturn);
        map.addControl(this.zoomControl, 'top-right');
        // The search field top-left (entry 9, DESIGN.md search-field): the top bar entry 3 shares with Needs you.
        this.searchControl = new SearchControl(this.onSearchChoose, (open) => {
            if (this.mapContainer) {
                this.mapContainer.setAttribute('data-search-open', open ? 'true' : 'false');
            }
        });
        map.addControl(this.searchControl, 'top-left');
        // The Needs you bar after the field and its list under the row (entry 3, DESIGN.md needs-you-bar).
        const slot = this.searchControl.slot();
        const host = this.searchControl.panelHost();
        if (slot && host) {
            this.needsYouControl = new NeedsYouControl(this.onNeedsYouChoose, (open) => {
                if (this.mapContainer) {
                    this.mapContainer.setAttribute('data-needs-open', open ? 'true' : 'false');
                }
                if (open && this.searchControl) {
                    this.searchControl.close();
                }
            });
            this.needsYouControl.mount(slot, host);
        }
        this.legendControl = new LegendControl((id) => {
            const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
            if (delegate) {
                delegate.selectBasemap(id);
            }
        }, (open) => {
            if (this.mapContainer) {
                this.mapContainer.setAttribute('data-legend-open', open ? 'true' : 'false');
            }
        }, this.onLegendSwitch);
        this.legendControl.setToggles(this.toggles.lines, this.toggles.names);
        map.addControl(this.legendControl, 'bottom-left');
        map.on('error', this.onMapError);
        map.on('idle', this.onMapIdle);
        map.on('moveend', () => this.publishView(map));
        map.on('movestart', this.onMoveStart);
        map.on('load', () => {
            const empty = itemsToGeoJson([]);
            map.addSource(SOURCE_ITEM_LINES, { type: 'geojson', data: empty.lines });
            map.addSource(SOURCE_ITEM_AREAS, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
            map.addSource(SOURCE_ITEM_POINTS, { type: 'geojson', data: empty.points });
            map.addSource(SOURCE_LINE_MARKS, { type: 'geojson', data: empty.points });
            map.addSource(SOURCE_ARROW, { type: 'geojson', data: empty.points });
            // The areas (entry 1, AD-11): a low-saturation fill in the category tint and a firmer
            // outline, under every line and point; a tint is never on a point or a line.
            map.addLayer({
                id: LAYER_AREA_FILL,
                type: 'fill',
                source: SOURCE_ITEM_AREAS,
                paint: { 'fill-color': ['get', 'color'], 'fill-opacity': AREA_FILL_OPACITY }
            });
            map.addLayer({
                id: LAYER_AREA_LINE,
                type: 'line',
                source: SOURCE_ITEM_AREAS,
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: { 'line-color': ['get', 'color'], 'line-width': AREA_LINE_WIDTH, 'line-opacity': AREA_LINE_OPACITY }
            });
            // The lines (DESIGN.md map-line): the selection casing under the selected one, then dashed,
            // dotted and solid lines with their weight and hue per feature (features.ts, markers.ts
            // lineLook); the dimmed preset fades the line.
            const dimmed: Expression = ['case', ['==', ['get', 'dimmed'], true], DIMMED_OPACITY, 1];
            map.addLayer({
                id: LAYER_LINE_CASING,
                type: 'line',
                source: SOURCE_ITEM_LINES,
                filter: ['==', ['get', 'selected'], true],
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: { 'line-color': mc.selection, 'line-width': ['+', ['get', 'weight'], 4], 'line-opacity': 0.5 }
            });
            map.addLayer({
                id: LAYER_ITEM_LINES_DASHED,
                type: 'line',
                source: SOURCE_ITEM_LINES,
                filter: ['==', ['get', 'dashed'], true],
                layout: { 'line-cap': 'butt', 'line-join': 'round' },
                paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'weight'], 'line-dasharray': LINE_DASH, 'line-opacity': dimmed }
            });
            map.addLayer({
                id: LAYER_ITEM_LINES_DOTTED,
                type: 'line',
                source: SOURCE_ITEM_LINES,
                filter: ['==', ['get', 'dotted'], true],
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'weight'], 'line-dasharray': LINE_DOT, 'line-opacity': dimmed }
            });
            map.addLayer({
                id: LAYER_ITEM_LINES,
                type: 'line',
                source: SOURCE_ITEM_LINES,
                filter: ['all', ['!=', ['get', 'dashed'], true], ['!=', ['get', 'dotted'], true]],
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'weight'], 'line-opacity': dimmed }
            });
            // MapLibre awaits the resolver's promise before it treats an image as missing, so the
            // images drawn from the sprite are in place when the symbols are laid out.
            map.setMissingStyleImageResolver((id) => this.makeImage(id));
            this.loadSprite();
            map.addSource(SOURCE_UNSAVED_LINES, { type: 'geojson', data: empty.lines });
            map.addSource(SOURCE_UNSAVED_POINTS, { type: 'geojson', data: empty.points });
            map.addLayer({
                id: LAYER_UNSAVED_LINES,
                type: 'line',
                source: SOURCE_UNSAVED_LINES,
                layout: { 'line-cap': 'butt', 'line-join': 'round' },
                paint: { 'line-color': colors.point, 'line-width': 3, 'line-dasharray': [2, 1.5] }
            });
            map.addLayer({
                id: LAYER_UNSAVED_POINTS,
                type: 'circle',
                source: SOURCE_UNSAVED_POINTS,
                paint: {
                    'circle-radius': 7,
                    'circle-color': colors.pointStroke,
                    'circle-stroke-color': colors.point,
                    'circle-stroke-width': 2
                }
            });
            this.addTextLayers(map, mc);
            this.itemsReady = true;
            this.applyLayerToggles();
            this.applyBasemap();
            this.drawItems();
            const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
            if (delegate) {
                delegate.sendMapLoad();
            }
            map.on('click', this.onMapClick);
            for (const layer of [LAYER_ITEM_MARKERS, LAYER_ITEM_LINES, LAYER_ITEM_LINES_DASHED, LAYER_ITEM_LINES_DOTTED]) {
                map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
                map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
            }
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
        registerTestView((view) => {
            if (this.map === map) {
                map.jumpTo({ center: view.center, zoom: view.zoom });
            }
        });
        this.applyEditing();
        if (typeof window !== 'undefined') {
            window.addEventListener('storage', this.onStorage);
        }

        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => { map.resize(); });
            this.resizeObserver.observe(this.mapContainer);
        }
    }

    componentDidUpdate(): void {
        this.applyBasemap();
        this.drawItems();
        this.dropQueuedFeatures();
        this.applyEditing();
        this.applyStartingArea();
    }

    /**
     * The symbol layers (epic 3 entry 7, DESIGN.md map marker, state word chip, map line), lowest first:
     * the icon KPI (from zoom 15, decision D4), the state chip beside the name and the name (from zoom
     * 14), each set in the bundled glyphs with a halo, colliding and giving way by `rank`
     * (symbol-sort-key: alarm, comms lost, stale, then the kind list's label rank); the line name chips
     * and alarm badges at each line's midpoint; the markers, which never drop (a normal item is a dot
     * below zoom 14, a 7 px one below 12, an abnormal item keeps its full marker at every zoom); and
     * the flow arrow of the selected line. Icons are placed before the text of the layers under them,
     * so no label covers a disc.
     */
    private addTextLayers(map: MapLibreMap, mc: MarkerColors): void {
        const normal: Expression = ['==', ['get', 'state'], 'normal'];
        const halo = { 'text-halo-color': mc.halo, 'text-halo-width': HALO_WIDTH, 'text-halo-blur': 0.5 };
        map.addLayer({
            id: LAYER_ITEM_KPI,
            type: 'symbol',
            source: SOURCE_ITEM_POINTS,
            minzoom: ZOOM_KPI,
            filter: ['!=', ['get', 'kpi'], ''],
            layout: {
                'text-field': ['get', 'kpi'],
                'text-font': [FONT_NAME],
                'text-size': KPI_SIZE,
                'text-anchor': 'top',
                'text-offset': [0, KPI_TOP_PX / KPI_SIZE],
                'text-max-width': 14,
                'text-padding': TEXT_PADDING,
                'text-allow-overlap': false,
                'text-ignore-placement': false,
                'symbol-sort-key': ['get', 'rank']
            },
            paint: { 'text-color': ['case', ['==', ['get', 'kpiStale'], true], mc.textSecondary, mc.glyph], ...halo }
        });
        map.addLayer({
            id: LAYER_ITEM_CHIPS,
            type: 'symbol',
            source: SOURCE_ITEM_POINTS,
            minzoom: ZOOM_NAME,
            filter: ['!=', ['get', 'word'], ''],
            layout: {
                'text-field': ['get', 'word'],
                'text-font': [FONT_CHIP],
                'text-size': CHIP_SIZE,
                'text-anchor': 'top-left',
                'text-offset': chipOffsetExpression(),
                'icon-image': CHIP_IMAGE,
                'icon-text-fit': 'both',
                'icon-text-fit-padding': CHIP_PADDING,
                'text-padding': TEXT_PADDING,
                // The chip's box is the stretched image (the text plus CHIP_PADDING); no more padding round it.
                'icon-padding': 0,
                'text-allow-overlap': false,
                'icon-allow-overlap': false,
                'text-optional': false,
                'icon-optional': false,
                'symbol-sort-key': ['get', 'rank']
            },
            paint: { 'text-color': mc.glyph }
        });
        map.addLayer({
            id: LAYER_ITEM_NAMES,
            type: 'symbol',
            source: SOURCE_ITEM_POINTS,
            minzoom: ZOOM_NAME,
            layout: {
                'text-field': ['get', 'name'],
                'text-font': [FONT_NAME],
                'text-size': NAME_SIZE,
                'text-anchor': 'top',
                'text-offset': [0, NAME_TOP_PX / NAME_SIZE],
                'text-max-width': 14,
                'text-padding': TEXT_PADDING,
                'text-allow-overlap': false,
                'text-ignore-placement': false,
                'symbol-sort-key': ['get', 'rank']
            },
            paint: { 'text-color': mc.glyph, ...halo }
        });
        map.addLayer({
            id: LAYER_LINE_CHIPS,
            type: 'symbol',
            source: SOURCE_LINE_MARKS,
            minzoom: ZOOM_NAME,
            layout: {
                'text-field': ['get', 'label'],
                'text-font': [FONT_CHIP],
                'text-size': CHIP_SIZE,
                'text-anchor': 'center',
                // Under the line, and under the badge when the line has one (the arrow sits at the midpoint).
                'text-offset': ['case', ['!=', ['get', 'badge'], ''], ['literal', [0, LINE_CHIP_OFFSET_BADGE_EM]],
                    ['literal', [0, LINE_CHIP_OFFSET_EM]]],
                'icon-image': CHIP_IMAGE,
                'icon-text-fit': 'both',
                'icon-text-fit-padding': CHIP_PADDING,
                'text-padding': TEXT_PADDING,
                'icon-padding': 0,
                'text-allow-overlap': false,
                'icon-allow-overlap': false,
                'text-optional': false,
                'icon-optional': false,
                'symbol-sort-key': ['get', 'rank']
            },
            paint: { 'text-color': mc.glyph }
        });
        map.addLayer({
            id: LAYER_LINE_BADGES,
            type: 'symbol',
            source: SOURCE_LINE_MARKS,
            filter: ['!=', ['get', 'badge'], ''],
            layout: {
                'icon-image': ['get', 'badge'],
                'icon-anchor': 'center',
                // The badge's centre sits 8 px left of the image's centre (markers.ts badgeSvg).
                'icon-offset': [8, 0],
                'icon-allow-overlap': true,
                'icon-ignore-placement': false
            }
        });
        const markerOffset: Expression = ['literal', [MARKER_IMAGE.width / 2 - DISC_CENTER[0], MARKER_IMAGE.height / 2 - DISC_CENTER[1]]];
        const dotOffset: Expression = ['literal', [0, 0]];
        const iconOffset = ['step', ['zoom'], ['case', normal, dotOffset, markerOffset], ZOOM_NAME, markerOffset] as unknown as Expression;
        map.addLayer({
            id: LAYER_ITEM_MARKERS,
            type: 'symbol',
            source: SOURCE_ITEM_POINTS,
            layout: {
                // The zoom bands: the 7 px dot below 12, the 11 px dot to 14, the marker from 14; an abnormal
                // item's dotSmall and dotMid are its marker, so it keeps its size and hit area.
                'icon-image': ['step', ['zoom'], ['get', 'dotSmall'], ZOOM_DOT, ['get', 'dotMid'], ZOOM_NAME, ['get', 'marker']],
                'icon-anchor': 'center',
                'icon-offset': iconOffset,
                'icon-allow-overlap': true,
                'icon-ignore-placement': false,
                // The image's own box is what the text keeps clear of; no padding round it.
                'icon-padding': 0,
                // Drawn in rank order with the abnormal ones on top (lower keys draw first).
                'symbol-sort-key': ['-', 1000, ['get', 'rank']]
            }
        });
        map.addLayer({
            id: LAYER_ARROW,
            type: 'symbol',
            source: SOURCE_ARROW,
            layout: {
                'icon-image': ARROW_IMAGE,
                'icon-rotate': ['get', 'bearing'],
                'icon-rotation-alignment': 'map',
                'icon-allow-overlap': true,
                'icon-ignore-placement': true
            }
        });
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
            if (map.getLayer(LAYER_BASEMAP)) {
                map.removeLayer(LAYER_BASEMAP);
            }
            if (map.getSource(SOURCE_BASEMAP)) {
                map.removeSource(SOURCE_BASEMAP);
            }
            if (b.source) {
                map.addSource(SOURCE_BASEMAP, {
                    type: 'raster',
                    tiles: b.source.tiles,
                    tileSize: b.source.tileSize,
                    maxzoom: b.source.maxzoom,
                    attribution: b.source.attribution
                });
                map.addLayer({ id: LAYER_BASEMAP, type: 'raster', source: SOURCE_BASEMAP },
                    map.getLayer(LAYER_AREA_FILL) ? LAYER_AREA_FILL : undefined);
                this.tiles = 'loading';
            } else {
                this.tiles = 'none';
            }
        }
        this.publishBasemap();
    }

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

    /**
     * For the e2e suite: the labels MapLibre drew (queryRenderedFeatures leaves out the ones hidden by a
     * collision), each with its box in container pixels estimated from the layer's layout and the text
     * width estimate the chip placement uses (textWidthPx); MapLibre's own placement is what keeps the
     * real boxes apart.
     */
    private publishLabels(): void {
        const map = this.map;
        const el = this.mapContainer;
        if (!map || !el || !this.itemsReady) {
            return;
        }
        const boxes: LabelBox[] = [];
        const seen = new Set<string>();
        const add = (layer: string, textOf: (p: Record<string, unknown>) => string,
                     boxOf: (p: Record<string, unknown>, x: number, y: number, w: number) => [number, number]): void => {
            if (!map.getLayer(layer)) {
                return;
            }
            for (const f of map.queryRenderedFeatures({ layers: [layer] })) {
                const p = (f.properties || {}) as Record<string, unknown>;
                const id = typeof p.id === 'string' ? p.id : '';
                const key = layer + '|' + id;
                if (seen.has(key) || !f.geometry || f.geometry.type !== 'Point') {
                    continue;
                }
                seen.add(key);
                const text = textOf(p);
                const at = map.project([f.geometry.coordinates[0], f.geometry.coordinates[1]]);
                const size = layer === LAYER_ITEM_NAMES ? NAME_SIZE : CHIP_SIZE;
                const w = textWidthPx(text, size);
                const [x, y] = boxOf(p, at.x, at.y, w);
                boxes.push({ layer, id, text, x, y, w, h: Math.round(size * 1.25) });
            }
        };
        const str = (v: unknown): string => (typeof v === 'string' ? v : '');
        add(LAYER_ITEM_NAMES, (p) => str(p.name), (_p, x, y, w) => [x - w / 2, y + NAME_TOP_PX]);
        add(LAYER_ITEM_CHIPS, (p) => str(p.word), (p, x, y) => [x + Number(p.chipOffset) * CHIP_SIZE - CHIP_PADDING[3], y + NAME_TOP_PX]);
        add(LAYER_ITEM_KPI, (p) => str(p.kpi), (_p, x, y, w) => [x - w / 2, y + KPI_TOP_PX]);
        add(LAYER_LINE_CHIPS, (p) => str(p.label), (p, x, y, w) => [x - w / 2 - CHIP_PADDING[3],
            y - 8 + (str(p.badge) ? LINE_CHIP_OFFSET_BADGE_EM : LINE_CHIP_OFFSET_EM) * CHIP_SIZE]);
        // The chip's box takes its padding.
        for (const b of boxes) {
            if (b.layer === LAYER_ITEM_CHIPS || b.layer === LAYER_LINE_CHIPS) {
                b.w += CHIP_PADDING[1] + CHIP_PADDING[3];
                b.h += CHIP_PADDING[0] + CHIP_PADDING[2];
            }
        }
        el.setAttribute('data-labels', JSON.stringify(boxes));
        el.setAttribute('data-names-shown', String(boxes.filter((b) => b.layer === LAYER_ITEM_NAMES).length));
        el.setAttribute('data-labels-zoom', map.getZoom().toFixed(2));
    }

    /** Fit (epic 3 entry 7): the view fits every item's bounds and keeps until the bounds change or the user moves the map. */
    private onFit = (): void => {
        if (!this.map || !this.itemBounds) {
            return;
        }
        this.fitKey = this.itemBoundsKey;
        this.fitTo(this.itemBounds);
        this.publishFit();
    };

    private fitTo(bounds: [number, number, number, number]): void {
        if (this.map) {
            this.map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: FIT_ITEMS_PADDING_PX, animate: false, maxZoom: 16 });
        }
    }

    /** Return: the map pans to the selected point at the zoom it has, or fits the selected line. */
    private onReturn = (): void => {
        const selected = this.state.selected;
        const delegate = this.props.delegate;
        if (!this.map || !selected || !delegate) {
            return;
        }
        const item = delegate.items.find((i) => i.id === selected.id && !i.deleted);
        if (!item) {
            return;
        }
        if (item.geometry.type === 'Point') {
            this.map.panTo([item.geometry.coordinates[0], item.geometry.coordinates[1]], { animate: false });
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
    private onSearchChoose = (result: SearchResult): void => {
        this.goToItem(result.id, 'Search', '(' + result.matched + ')');
    };

    /** A Needs you row chosen (entry 3, R15): the same move and selection as a search choice. */
    private onNeedsYouChoose = (row: NeedsYouRow): void => {
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
        const item = delegate.items.find((i) => i.id === id && !i.deleted);
        if (!item) {
            console.info('[MapStudio] The ' + via + ' choice ' + id + ' is no longer on the map.');
            return;
        }
        this.fitKey = null;
        if (item.geometry.type === 'Point') {
            const lngLat: [number, number] = [item.geometry.coordinates[0], item.geometry.coordinates[1]];
            map.jumpTo({ center: lngLat, zoom: Math.max(map.getZoom(), CHOSEN_POINT_ZOOM) });
            this.openPopup({ id: item.id, name: item.name, kind: item.kind }, lngLat);
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

    /**
     * The legend's Lines and Names toggles (entry 3, R14): Lines off hides every line layer and the
     * flow arrow (areas stay); Names off hides the item names, the state chips, the icon KPI text and
     * the line name chips, and keeps the markers (an abnormal item's badge and digit stay) and the
     * line badges. Remembered per browser session.
     */
    private onLegendSwitch = (toggle: LegendToggle, on: boolean): void => {
        this.toggles = { ...this.toggles, [toggle]: on };
        writeToggle(sessionStore(), toggle, on);
        this.applyLayerToggles();
    };

    private applyLayerToggles(): void {
        const map = this.map;
        if (!map || !this.itemsReady) {
            return;
        }
        const lineLayers = [LAYER_LINE_CASING, LAYER_ITEM_LINES_DASHED, LAYER_ITEM_LINES_DOTTED, LAYER_ITEM_LINES, LAYER_LINE_BADGES, LAYER_ARROW];
        const nameLayers = [LAYER_ITEM_NAMES, LAYER_ITEM_CHIPS, LAYER_ITEM_KPI];
        const set = (layer: string, visible: boolean): void => {
            if (map.getLayer(layer)) {
                map.setLayoutProperty(layer, 'visibility', visible ? 'visible' : 'none');
            }
        };
        for (const layer of lineLayers) {
            set(layer, this.toggles.lines);
        }
        for (const layer of nameLayers) {
            set(layer, this.toggles.names);
        }
        set(LAYER_LINE_CHIPS, this.toggles.lines && this.toggles.names);
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
                && selectionKey === this.drawnSelection)) {
            return;
        }
        const items = delegate.editing === 'off' ? [] : delegate.items;
        const data = buildFeatures(items, delegate.lists.kinds, delegate.live, selected, this.markerColors);
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
                this.mapContainer.setAttribute('data-items-loaded', String(data.lines.features.length + data.areas.features.length
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
        const outline = drawColor(root, ['--containerRoot', '--container']);
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
        this.openPopup({ id: pointId, name, kind: kindId }, lngLat);

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
        const lineId = onLine.length > 0 && onLine[0].properties ? onLine[0].properties.id : undefined;
        if (typeof lineId === 'string') {
            this.selectLine(lineId);
            return;
        }
        this.clearSelection();
    };

    /** A line clicked: selected (casing, flow arrow, Return), the popup closed. */
    private selectLine(id: string): void {
        if (this.popup && this.popup.isOpen()) {
            this.popup.remove();
        }
        this.setState({ selected: { id, kind: 'line' }, pick: null });
        console.info('[MapStudio] Line ' + id + ' selected.');
    }

    /** The ground tapped: the selection and the popup go. */
    private clearSelection(): void {
        if (this.popup && this.popup.isOpen()) {
            this.popup.remove();
        }
        if (this.state.selected !== null || this.state.pick !== null) {
            this.setState({ selected: null, pick: null });
        }
    }

    /** A shared marker clicked (epic 3 entry 7): the pick list of its members opens in the popup. */
    private openPick(memberIds: string, lngLat: [number, number]): void {
        const delegate = this.props.delegate;
        if (!delegate) {
            return;
        }
        const rows: PickRow[] = [];
        for (const id of memberIds.split(',')) {
            const item = delegate.items.find((i) => i.id === id && !i.deleted);
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
        const delegate = this.props.delegate;
        const item = delegate ? delegate.items.find((i) => i.id === id && !i.deleted) : undefined;
        if (!item || item.geometry.type !== 'Point') {
            return;
        }
        const kind = delegate!.lists.kinds.find((k) => k.id === item.kind);
        this.openPopup({ id: item.id, name: item.name, kind: kind ? kind.id : item.kind },
            [item.geometry.coordinates[0], item.geometry.coordinates[1]]);
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
        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        const before = this.state.popup;
        if (before && before.point.id !== point.id && delegate) {
            delegate.sendPopupClose(before.point.id);
        }
        if (delegate && (!before || before.point.id !== point.id)) {
            delegate.sendPopupOpen(point.id);
        }
        this.startPopupClock();
        this.setState({ popup: { point, lngLat }, pick: null, selected: { id: point.id, kind: 'point' }, clock: Date.now() },
            () => this.showPopupAt(lngLat));
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
        this.popup = new Popup({
            closeButton: true,
            closeOnClick: false,
            closeOnMove: false,
            // MapLibre writes maxWidth as an inline style on the popup, so the
            // phone cap lives here, not in the stylesheet.
            maxWidth: 'calc(100vw - 32px)',
            offset: POPUP_OFFSET_PX
        });
        this.popup.setDOMContent(this.popupContent);
        this.popup.on('close', this.onPopupClosed);
    }

    /** Move the popup to the point (after the state that fills its portal has rendered) and open it. */
    private showPopupAt(lngLat: [number, number]): void {
        if (!this.map || !this.popup) {
            return;
        }
        this.popup.setMaxWidth(popupMaxWidth(this.map.project(lngLat).x, this.map.getContainer().clientWidth));
        this.popup.setLngLat(lngLat);
        if (!this.popup.isOpen()) {
            this.popup.addTo(this.map);
        }
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

    /** MapLibre closed the popup (close button, map click): unmount the view, tell the Gateway, clear a point's selection. */
    private onPopupClosed = (): void => {
        this.stopPopupClock();
        const open = this.state.popup;
        if (open !== null) {
            const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
            if (delegate) {
                delegate.sendPopupClose(open.point.id);
            }
        }
        if (open !== null || this.state.pick !== null) {
            const selected = this.state.selected;
            this.setState({ popup: null, pick: null, selected: selected && selected.kind === 'point' ? null : selected });
        }
    };

    /**
     * The popup's content: the spike's project view when the popupView prop names one (it keeps
     * precedence until entry 8 retires it, plan decision 4); else Map Studio's default popup when
     * the item's kind has a display that shows something; else the text fallback.
     */
    private renderPopup(): React.ReactNode {
        const pick = this.state.pick;
        if (pick && this.popupContent) {
            return ReactDOM.createPortal(<PickList rows={pick.rows} onPick={this.onPick} />, this.popupContent);
        }
        const open = this.state.popup;
        if (!open || !this.popupContent) {
            return null;
        }
        const store = this.props.store;
        const { path, params } = this.props.props.popupView;
        const delegate = this.props.delegate;
        const kindId = open.point.kind || '';
        if (!path && delegate) {
            const display = delegate.live.display[kindId];
            const kind = delegate.lists.kinds.find((k) => k.id === kindId);
            if (display && (display.comms || display.alarms.on || display.kpis.some((k) => k.on))) {
                return ReactDOM.createPortal(
                    <DefaultPopup
                        key={'default|' + open.point.id}
                        item={{ id: open.point.id, name: open.point.name, kind: kindId,
                            kindName: kind ? kind.name : kindId, icon: kind ? kind.icon : '' }}
                        display={display}
                        values={delegate.live.items[open.point.id]}
                        now={this.state.clock}
                    />,
                    this.popupContent
                );
            }
        }
        const mountPath = popupMountPath(store.viewMountPath, store.addressPathString);
        return ReactDOM.createPortal(
            <PointPopup
                key={PageStore.instanceKeyFor(path, mountPath) + '|' + open.point.id}
                clientStore={store.view.page.parent}
                parent={store}
                path={path}
                params={params}
                mountPath={mountPath}
                point={open.point}
            />,
            this.popupContent
        );
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
                    const spec = markerProperties(id, item ? item.name : '', item ? item.kind : '', kind ? kind.icon : '', state,
                        { labelRank: kind ? kind.labelRank : 0 });
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
        return (
            <div {...this.props.emit({ classes: ['mapstudio'] })}>
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
                     data-pick-open={this.state.pick ? 'true' : 'false'}
                     data-legend-open="false"
                     data-search-open="false"
                     data-needs-open="false" />
                <div className={'mapstudio-reply' + (pending ? ' mapstudio-reply--pending' : '')}
                     data-pending={pending ? 'true' : 'false'}
                     data-drawing={this.state.drawing ? 'true' : 'false'}
                     data-line-points={this.state.linePoints === null ? '' : String(this.state.linePoints)}>
                    <div>{pending ? 'Waiting for the Gateway ...' : replyLine}</div>
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
            popupView: {
                path: tree.readString('popupView.path', ''),
                params: tree.readObject<AuthorParams>('popupView.params', {})
            },
            previewStyles: tree.readBoolean('previewStyles', false),
            editMode: tree.readBoolean('editMode', false)
        };
    }
}
