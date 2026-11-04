/**
 * Browser side of the component delegate (epic 4 entry 1, the component split): sends envelopes to the
 * Gateway delegate and keeps what the replies say, and hands the component one state through
 * `mapStateToProps` (`MapStudioDelegateState`, with the revisions the component redraws by). It owns the
 * messages, the items and their changes (changes.ts), the unsaved queue and its sender (unsaved.ts,
 * unsavedSender.ts), the live values (live.ts), the connection watch (connection.ts) and the basemap
 * choice (basemaps.ts). `notify()` is the only flow to the component; the component calls the public
 * `send*`, `selectBasemap`, `retryUnsaved`, `discardUnsaved`, `onStorage` and `stopReplay`.
 */

import { AbstractUIElementStore, ComponentStoreDelegate, JsObject } from '@inductiveautomation/perspective-client';
import { MapChanges, MapChangedBody } from './changes';
import { EditLevel, MapItemRecord } from './contract';
import { HostLists, NO_HOST_LISTS } from './adapters';
import { MESSAGE_EVENT, Reply, basemapSource, mapLoad, pointClick, popupClose, popupOpen, readReply, replyText } from './messages';
import {
    BasemapId, OSM_SOURCE, RasterSource, fallbackBasemap, initialBasemap, offeredBasemaps, refusedText, rememberBasemap,
    rememberedBasemap
} from './basemaps';
import { LIVE_INITIAL, LiveState, ValuesBatchBody, applyBatch, freezeLive } from './live';
import { CONNECTED, ConnectionState, ConnectionWatch } from './connection';
import { SegmentRef } from './features';
import { STORE_UNKNOWN, StoreState, storeStateFromError, storeStateFromLoad, storeStateFromSaveError } from './storeState';
import { SAVE_IDLE, SaveState, lineCreateBatch, newId, refusedSave } from './save';
import {
    KeyValueStore, REPLAY_INTERVAL_MS, STORAGE_WARNING, UnsavedEntry, UnsavedQueue, UnsavedReason, isBusy, reasonFromError,
    savedRecords, storageKey
} from './unsaved';
import { UnsavedSender } from './unsavedSender';
import { registerTestHook, takeTestReply } from './testHook';

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
    /** The project setup's alarm page template (epic 3 entry 8), '' when none or not sent. */
    alarmPage: string;
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
    /** The Gateway connection (owner review notes item 32): lost, and whether the values shown are frozen. */
    connection: ConnectionState;
}

/** `localStorage`, or null when the browser refuses it (a private window, blocked site data). */
export function browserStorage(): KeyValueStore | null {
    try {
        return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
    } catch (err) {
        return null;
    }
}

/** What the delegate reads of the Perspective client: the project name and the connection [unverified live]. */
export interface ClientView {
    projectName?: unknown;
    connection?: { connected?: unknown };
}

export function clientOf(component: AbstractUIElementStore): ClientView | null {
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
    private alarmPage = '';
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
    private connection: ConnectionState = CONNECTED;
    /** Polls the client's connection flag (item 32): the values freeze while it is lost, the map reloads when it is back. */
    private connectionWatch: ConnectionWatch;
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
        this.connectionWatch = new ConnectionWatch(() => this.connected(), () => this.onConnectionLost(), () => this.onConnectionBack());
        this.connectionWatch.start();
    }

    /**
     * The client lost the Gateway (item 32, AD-6): every value shown freezes as stale with the reason
     * "no connection" (the markers, the popup and the lists draw it so), the Needs you summary says the
     * state is unknown and the chip names the time the values are from. Nothing reads as live.
     */
    private onConnectionLost(): void {
        this.connection = { ...this.connection, lost: true, frozen: true };
        this.live = freezeLive(this.live);
        this.liveRevision++;
        console.info('[MapStudio] No connection to the Gateway: the values shown are frozen as stale.');
        this.notify();
    }

    /** The client is back: the map reloads (map.load, then the Gateway's full batch replaces the frozen values). */
    private onConnectionBack(): void {
        this.connection = { ...this.connection, lost: false };
        console.info('[MapStudio] The Gateway connection is back: reloading the map.');
        this.notify();
        this.changes.load();
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
            alarmPage: this.alarmPage,
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
            liveRevision: this.liveRevision,
            connection: this.connection
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

    /**
     * The popup of a map item opened: the Gateway pushes its values on change until popup.close
     * (AD-7); for a line (entry 2) the segment it opened at, and every instrument on it is pushed too.
     */
    sendPopupOpen(itemId: string, segment: SegmentRef | null = null): void {
        this.fireEvent(MESSAGE_EVENT, popupOpen(itemId, segment) as unknown as JsObject);
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
        // A full batch after a reconnect replaces the frozen values (item 32); the time is the chip's.
        this.connection = { ...this.connection, valuesAt: Date.now(), frozen: this.connection.frozen && !body.full };
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

    /** Stop the replay, load retry and connection timers (the component unmounted). */
    stopReplay(): void {
        this.sender.stop();
        this.connectionWatch.stop();
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
            this.alarmPage = reply.body.setup ? reply.body.setup.alarmPage : '';
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
