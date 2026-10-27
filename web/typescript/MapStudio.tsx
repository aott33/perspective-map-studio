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
import { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, MapMouseEvent, NavigationControl, Popup, setWorkerUrl } from 'maplibre-gl';
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
import { MESSAGE_EVENT, Reply, editsApply, mapLoad, pointClick, readReply, replyText } from './messages';
import {
    STORE_UNKNOWN, StoreState, storeStateAttribute, storeStateFromError, storeStateFromLoad, storeStateFromSaveError,
    storeStatusText
} from './storeState';
import { PointPopup } from './PointPopup';
import { SAVE_IDLE, SaveState, itemsToGeoJson, lineCreateBatch, newId, refusedSave, saveStatusText } from './save';
import {
    KeyValueStore, LocalReasons, REPLAY_INTERVAL_MS, REPLY_TIMEOUT_MS, STORAGE_WARNING, UnsavedEntry, UnsavedQueue,
    UnsavedReason, entryText, isTransient, reasonFromError, savedRecords, storageKey, summaryText, unsavedItems
} from './unsaved';
import { AuthorParams, PopupPoint, popupMountPath } from './popupParams';
import { TestData, selectTestData } from './testSet';
import { registerTestHook, takeTestReply } from './testHook';
import { drawColor, themeColor } from './theme';

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
     * Spike-only (story 4): the project view opened as a popup on a point
     * click, with the author's params. A later version names it in the kind
     * setup (AD-7).
     */
    popupView: {
        path: string;
        params: AuthorParams;
    };
    /**
     * Spike-only (story 7): which fixed test data the map draws, 'tracer' (three
     * points and a line) or 'scale30' (a seeded 30-pad stand-in for the
     * template's scale set). Removed when the map store supplies the data
     * (epic-map-store-and-data).
     */
    testSet: string;
}

/** The popup that is open: the clicked point with its map coordinates. */
interface OpenPopup {
    point: PopupPoint;
    lngLat: [number, number];
}

interface MapStudioState extends DrawState {
    popup: OpenPopup | null;
}

/** The delegate state the component renders. */
export interface MapStudioDelegateState {
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
    /** 'off' while map.load says the map store is unreachable: the draw tool is disabled. */
    editing: 'on' | 'off';
    /** The one warning when this browser cannot keep unsaved edits, or ''. */
    storageWarning: string;
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
    private unsavedRevision = 0;
    private storageWarning = '';
    /** batchId -> the edits.apply message this tab is waiting on for it, and its reply timer. */
    private inFlight = new Map<string, { messageId: string; timer: ReturnType<typeof setTimeout> }>();
    /** edits.apply message id -> its batchId, kept after a timeout so a late reply still counts. */
    private sentMessages = new Map<string, string>();
    private replayTimer: ReturnType<typeof setTimeout> | null = null;
    /** The batch whose save the save status shows (the last line drawn here), or null. */
    private saveBatchId: string | null = null;

    constructor(componentStore: AbstractUIElementStore) {
        super(componentStore);
        registerTestHook((message) => this.fireEvent(MESSAGE_EVENT, message as unknown as JsObject));
        const storage = browserStorage();
        this.unsaved = new UnsavedQueue(storage, () => this.warnStorage());
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
            editing: this.store.status === 'unavailable' ? 'off' : 'on',
            storageWarning: this.storageWarning
        };
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
        this.unsaved.enqueue(batch, now);
        this.unsavedRevision++;
        this.save = { state: 'saving', itemId };
        this.saveBatchId = batch.batchId;
        this.sendBatch(batch.batchId);
        return itemId;
    }

    /** Try again: a refused entry becomes unsent and the queue replays now. */
    retryUnsaved(batchId: string): void {
        this.unsaved.retry(batchId);
        this.unsavedRevision++;
        this.notify();
        this.replayNext();
        this.scheduleReplay();
    }

    /** Discard: the entry leaves storage and the map, and is never sent again. */
    discardUnsaved(batchId: string): void {
        const flight = this.inFlight.get(batchId);
        if (flight) {
            clearTimeout(flight.timer);
            this.inFlight.delete(batchId);
        }
        this.unsaved.discard(batchId);
        this.unsavedRevision++;
        this.notify();
        this.replayNext();
    }

    /** A `storage` event: another tab may have changed this queue. */
    onStorage(key: string | null): void {
        if (key !== null && key !== this.unsaved.storageKey) {
            return;
        }
        if (this.unsaved.refresh()) {
            for (const [batchId, flight] of Array.from(this.inFlight.entries())) {
                if (!this.unsaved.get(batchId)) {
                    clearTimeout(flight.timer);
                    this.inFlight.delete(batchId);
                }
            }
            this.unsavedRevision++;
            this.notify();
        }
    }

    /** Stop the replay timer (the component unmounted). */
    stopReplay(): void {
        if (this.replayTimer !== null) {
            clearTimeout(this.replayTimer);
            this.replayTimer = null;
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

    /** Send one queued batch exactly as stored (same batchId, ops and baseVersions). */
    private sendBatch(batchId: string): void {
        const entry = this.unsaved.get(batchId);
        if (!entry) {
            this.notify();
            return;
        }
        if (!this.connected()) {
            this.onUnsent(entry, { code: LocalReasons.DISCONNECTED, message: 'The browser is not connected to the Gateway.' });
            return;
        }
        const message = editsApply(entry.batch);
        const timer = setTimeout(() => this.onReplyTimeout(batchId, message.id), REPLY_TIMEOUT_MS);
        this.inFlight.set(batchId, { messageId: message.id, timer });
        this.sentMessages.set(message.id, batchId);
        this.notify();
        try {
            this.fireEvent(MESSAGE_EVENT, message as unknown as JsObject);
        } catch (err) {
            clearTimeout(timer);
            this.inFlight.delete(batchId);
            this.sentMessages.delete(message.id);
            this.onUnsent(entry, { code: LocalReasons.DISCONNECTED, message: 'The message could not be sent.' });
        }
    }

    private onReplyTimeout(batchId: string, messageId: string): void {
        const flight = this.inFlight.get(batchId);
        if (!flight || flight.messageId !== messageId) {
            return;
        }
        this.inFlight.delete(batchId);
        const entry = this.unsaved.get(batchId);
        if (entry) {
            this.onUnsent(entry, {
                code: LocalReasons.TIMEOUT,
                message: 'No answer from the Gateway within ' + REPLY_TIMEOUT_MS / 1000 + ' s.'
            });
        }
    }

    /** No answer, or not connected: the entry stays unsent and the timer replays it. */
    private onUnsent(entry: UnsavedEntry, reason: UnsavedReason): void {
        this.unsaved.failed(entry.batchId, reason);
        this.unsavedRevision++;
        if (this.save.state !== 'idle' && entry.batchId === this.saveBatchId) {
            this.save = { state: 'unsent', itemId: this.save.itemId, code: reason.code };
        }
        console.info('[MapStudio] Batch ' + entry.batchId + ' not saved yet (' + reason.code + '); kept to replay.');
        this.notify();
        this.scheduleReplay();
    }

    /** Replays run only at level phone or full, after map.load answered (docs/contract.md). */
    private canReplay(): boolean {
        return (this.level === 'phone' || this.level === 'full') && this.unsaved.storageKey !== null;
    }

    /** Replay the oldest unsent entry, one batch at a time. */
    private replayNext(): void {
        if (!this.canReplay() || this.inFlight.size > 0) {
            return;
        }
        const next = this.unsaved.nextToReplay(new Set(this.inFlight.keys()));
        if (next) {
            console.info('[MapStudio] Replaying unsaved batch ' + next.batchId + '.');
            this.sendBatch(next.batchId);
        }
    }

    /** Re-arm the 15 s replay timer while unsent entries remain. */
    private scheduleReplay(): void {
        if (this.replayTimer !== null || !this.unsaved.hasUnsent()) {
            return;
        }
        this.replayTimer = setTimeout(() => {
            this.replayTimer = null;
            this.unsaved.refresh();
            this.replayNext();
            this.scheduleReplay();
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
        if (reply.kind === 'map.load.reply' || (reply.kind === 'error' && reply.id === this.mapLoadId)) {
            this.onMapLoad(reply);
            return;
        }
        if (reply.kind === 'edits.apply.reply' || (reply.kind === 'error' && this.sentMessages.has(reply.id))) {
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
        } else if (reply.kind === 'error') {
            this.level = null;
            this.refreshIntervalSeconds = null;
            this.load = { state: 'failed', message: reply.body.code + ': ' + reply.body.message };
            this.store = storeStateFromError(this.store, reply.body);
            this.changes.loadFailed();
            // No store item is drawn as current while the store is unreachable.
            this.itemsRevision++;
        }
        this.notify();
        this.replayNext();
        this.scheduleReplay();
    }

    /** A map.changed from the Gateway; `body` is null when it could not be read (a gap). */
    private onMapChanged(body: MapChangedBody | null): void {
        if (this.changes.changed(body)) {
            this.itemsRevision++;
            console.debug('[MapStudio] Map changed: seq ' + this.changes.seq);
            this.notify();
        }
        this.replayNext();
    }

    private onSave(reply: Reply): void {
        if (reply.kind !== 'edits.apply.reply' && reply.kind !== 'error') {
            return;
        }
        const batchId = reply.kind === 'edits.apply.reply' ? reply.body.batchId : this.sentMessages.get(reply.id);
        this.sentMessages.delete(reply.id);
        if (batchId === undefined) {
            console.info('[MapStudio] A save reply ' + reply.id + ' matches no pending save.');
            return;
        }
        const flight = this.inFlight.get(batchId);
        if (reply.kind === 'error' && flight && flight.messageId !== reply.id) {
            // A late refusal of an earlier send; the newer send of the same batch decides.
            return;
        }
        if (flight) {
            clearTimeout(flight.timer);
            this.inFlight.delete(batchId);
        }
        this.unsaved.refresh();
        const entry = this.unsaved.get(batchId);
        const shown = batchId === this.saveBatchId;
        if (reply.kind === 'edits.apply.reply') {
            if (entry) {
                for (const record of savedRecords(entry.batch, reply.body.results)) {
                    if (this.changes.saved(record)) {
                        this.itemsRevision++;
                    }
                }
            }
            this.unsaved.saved(batchId);
            if (shown && this.save.state !== 'idle') {
                const itemId = this.save.itemId;
                const result = reply.body.results.find((r) => r.id === itemId);
                this.save = { state: 'saved', itemId, version: result ? result.version : 1 };
            }
        } else {
            const reason = reasonFromError(reply.body);
            this.unsaved.failed(batchId, reason);
            if (shown && this.save.state !== 'idle') {
                this.save = refusedSave(this.save.itemId, reply.body);
            }
            this.store = storeStateFromSaveError(this.store, reply.body);
        }
        this.unsavedRevision++;
        console.info('[MapStudio] ' + replyText(reply));
        this.notify();
        if (reply.kind === 'error' && isTransient(reply.body.code)) {
            this.scheduleReplay();
        } else {
            this.replayNext();
        }
    }
}

type Props = ComponentProps<MapStudioProps, MapStudioDelegateState>;

const SOURCE_POINTS = 'mapstudio-points';
const SOURCE_LINE = 'mapstudio-line';
const LAYER_LINE = 'mapstudio-line';
const LAYER_POINTS = 'mapstudio-points';
/** The map store's items (map.load and this session's saves); separate from the test data's sources. */
const SOURCE_ITEM_LINES = 'mapstudio-items-line';
const SOURCE_ITEM_POINTS = 'mapstudio-items-point';
const LAYER_ITEM_LINES = 'mapstudio-items-line';
const LAYER_ITEM_POINTS = 'mapstudio-items-point';
/** The queued (unsaved) map items, drawn dashed (epic 2 story 8). */
const SOURCE_UNSAVED_LINES = 'mapstudio-unsaved-line';
const SOURCE_UNSAVED_POINTS = 'mapstudio-unsaved-point';
const LAYER_UNSAVED_LINES = 'mapstudio-unsaved-line';
const LAYER_UNSAVED_POINTS = 'mapstudio-unsaved-point';

/**
 * The Map Studio component: a MapLibre map on a blank style with fixed test
 * data (three points and one line). Clicking a point sends `point.click`
 * through the delegate; the reply is shown as text over the map.
 */
export class MapStudio extends Component<Props, MapStudioState> {
    state: MapStudioState = { ...DRAW_IDLE, popup: null };

    /** Chosen once from the testSet prop; the map is built from it at mount. */
    private testData: TestData = selectTestData(this.props.props.testSet);
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
    /** The unsaved and items revisions last drawn into the unsaved sources. */
    private drawnUnsaved = '';
    /** Terra Draw features of finished lines: removed once queued, as the unsaved layer draws them. */
    private queuedFeatures: Array<string | number> = [];

    componentDidMount(): void {
        if (!this.mapContainer) {
            return;
        }
        const root = this.props.store.element as HTMLElement | undefined;
        const colors = {
            background: themeColor(root, '--containerRoot'),
            line: themeColor(root, '--neutral-70'),
            point: themeColor(root, '--label'),
            pointStroke: themeColor(root, '--containerRoot')
        };
        const data = this.testData;
        const map = new MapLibreMap({
            container: this.mapContainer,
            style: {
                version: 8,
                sources: {},
                layers: [{
                    id: 'background',
                    type: 'background',
                    paint: { 'background-color': colors.background }
                }]
            },
            center: data.center,
            zoom: data.zoom,
            attributionControl: false
        });
        map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
        map.on('load', () => {
            map.addSource(SOURCE_LINE, { type: 'geojson', data: data.lines });
            map.addSource(SOURCE_POINTS, { type: 'geojson', data: data.points });
            map.addLayer({
                id: LAYER_LINE,
                type: 'line',
                source: SOURCE_LINE,
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: { 'line-color': colors.line, 'line-width': 3 }
            });
            map.addLayer({
                id: LAYER_POINTS,
                type: 'circle',
                source: SOURCE_POINTS,
                paint: {
                    'circle-radius': 9,
                    'circle-color': colors.point,
                    'circle-stroke-color': colors.pointStroke,
                    'circle-stroke-width': 2
                }
            });
            const empty = itemsToGeoJson([]);
            map.addSource(SOURCE_ITEM_LINES, { type: 'geojson', data: empty.lines });
            map.addSource(SOURCE_ITEM_POINTS, { type: 'geojson', data: empty.points });
            map.addLayer({
                id: LAYER_ITEM_LINES,
                type: 'line',
                source: SOURCE_ITEM_LINES,
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: { 'line-color': colors.point, 'line-width': 3 }
            });
            map.addLayer({
                id: LAYER_ITEM_POINTS,
                type: 'circle',
                source: SOURCE_ITEM_POINTS,
                paint: {
                    'circle-radius': 7,
                    'circle-color': colors.line,
                    'circle-stroke-color': colors.pointStroke,
                    'circle-stroke-width': 2
                }
            });
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
            this.itemsReady = true;
            this.drawItems();
            const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
            if (delegate) {
                delegate.sendMapLoad();
            }
            map.on('click', LAYER_POINTS, this.onPointClick);
            map.on('click', this.onMapClick);
            map.on('mouseenter', LAYER_POINTS, () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', LAYER_POINTS, () => { map.getCanvas().style.cursor = ''; });
            this.startTerraDraw(map, root);
            // Readiness for the e2e suite: set once the map has gone idle with
            // both sources and layers added, counted from MapLibre itself.
            map.once('idle', () => this.publishReadiness(map));
        });
        this.drawControl = new DrawControl(this.toggleDrawing);
        map.addControl(this.drawControl, 'top-right');
        this.map = map;
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
        this.drawItems();
        this.dropQueuedFeatures();
        this.applyEditing();
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
        if (!this.map || !this.itemsReady || !delegate || delegate.itemsRevision === this.drawnRevision) {
            return;
        }
        const data = itemsToGeoJson(delegate.editing === 'off' ? [] : delegate.items);
        const lines = this.map.getSource(SOURCE_ITEM_LINES) as GeoJSONSource | undefined;
        const points = this.map.getSource(SOURCE_ITEM_POINTS) as GeoJSONSource | undefined;
        if (lines && points) {
            lines.setData(data.lines);
            points.setData(data.points);
            this.drawnRevision = delegate.itemsRevision;
            if (this.mapContainer) {
                this.mapContainer.setAttribute('data-items-loaded',
                    String(data.lines.features.length + data.points.features.length));
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

    componentWillUnmount(): void {
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
        this.drawControl = null;
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

    /**
     * Spike and e2e only: tell a test the map is drawn. The counts are read
     * back from MapLibre's own sources (querySourceFeatures, unique by the
     * feature's id property), so they prove the data reached the map, not only
     * that the component was constructed with it.
     */
    private publishReadiness(map: MapLibreMap): void {
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
        el.setAttribute('data-points-loaded', String(count(SOURCE_POINTS)));
        el.setAttribute('data-lines-loaded', String(count(SOURCE_LINE)));
        el.setAttribute('data-map-ready', 'true');
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
        const name = feature && feature.properties && typeof feature.properties.name === 'string'
            ? feature.properties.name : '';
        const geometry = feature ? feature.geometry : undefined;
        const lngLat: [number, number] = geometry && geometry.type === 'Point'
            ? [geometry.coordinates[0], geometry.coordinates[1]]
            : [ev.lngLat.lng, ev.lngLat.lat];
        this.openPopup({ id: pointId, name }, lngLat);

        const delegate = this.props.store.delegate as MapStudioStoreDelegate | undefined;
        if (!delegate) {
            console.warn('[MapStudio] No delegate; the click on ' + pointId + ' was not sent.');
            return;
        }
        delegate.sendPointClick(pointId);
    };

    /**
     * A click on the map away from any point closes the popup. MapLibre's own
     * closeOnClick is not used: it runs after the layer click handler and
     * would close the popup that a click on another point has just moved.
     */
    private onMapClick = (ev: MapMouseEvent): void => {
        if (this.state.drawing || !this.map || !this.popup || !this.popup.isOpen()) {
            return;
        }
        const onPoint = this.map.queryRenderedFeatures(ev.point, { layers: [LAYER_POINTS] });
        if (onPoint.length === 0) {
            this.popup.remove();
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
        if (!this.popup) {
            this.popupContent = document.createElement('div');
            this.popupContent.className = 'mapstudio-popup-root';
            this.popup = new Popup({
                closeButton: true,
                closeOnClick: false,
                closeOnMove: false,
                // MapLibre writes maxWidth as an inline style on the popup, so the
                // phone cap lives here, not in the stylesheet.
                maxWidth: 'calc(100vw - 32px)',
                offset: 12
            });
            this.popup.setDOMContent(this.popupContent);
            this.popup.on('close', this.onPopupClosed);
        }
        this.setState({ popup: { point, lngLat } }, () => {
            if (this.popup && this.map) {
                this.popup.setLngLat(lngLat);
                if (!this.popup.isOpen()) {
                    this.popup.addTo(this.map);
                }
            }
        });
    }

    /** MapLibre closed the popup (close button, map click): unmount the view. */
    private onPopupClosed = (): void => {
        if (this.state.popup !== null) {
            this.setState({ popup: null });
        }
    };

    private renderPopup(): React.ReactNode {
        const open = this.state.popup;
        if (!open || !this.popupContent) {
            return null;
        }
        const store = this.props.store;
        const { path, params } = this.props.props.popupView;
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

    /** The queued edits, each with its reason, Try again and Discard (epic 2 story 8). */
    private renderUnsaved(unsaved: UnsavedEntry[], level: EditLevel | null, warning: string): React.ReactNode {
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
                                onClick={() => delegate && delegate.discardUnsaved(entry.batchId)}>Discard</button>
                    </div>
                ))}
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
                     data-test-set={this.testData.name}
                     data-edit-level={delegate && delegate.level ? delegate.level : ''}
                     data-load-state={load.state}
                     data-store-seq={delegate && delegate.seq !== null ? String(delegate.seq) : ''}
                     data-map-reloads={delegate ? String(delegate.reloads) : '0'}
                     data-store-state={storeStateAttribute(store)}
                     data-refresh-interval={delegate && delegate.refreshIntervalSeconds !== null
                         ? String(delegate.refreshIntervalSeconds) : ''}
                     data-unsaved-count={String(unsaved.length)}
                     data-editing={editing} />
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
                        delegate ? delegate.storageWarning : '')}
                </div>
                {this.renderAdapterStatus(delegate ? delegate.lists : NO_HOST_LISTS)}
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
            testSet: tree.readString('testSet', 'tracer'),
            popupView: {
                path: tree.readString('popupView.path', ''),
                params: tree.readObject<AuthorParams>('popupView.params', {})
            }
        };
    }
}
