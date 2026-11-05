/**
 * Browser side of the component delegate (epic 4 entry 1, the component split): sends envelopes to the
 * Gateway delegate and keeps what the replies say, and hands the component one state through
 * `mapStateToProps` (`MapStudioDelegateState`, with the revisions the component redraws by). It owns the
 * messages, the items and their changes (changes.ts), the unsaved queue and its sender (unsaved.ts,
 * unsavedSender.ts), the live values (live.ts), the connection watch (connection.ts) and the basemap
 * choice (basemaps.ts), and from epic 4 entry 2 the studio's saves (`sendBatch`, which every tool, every
 * finished field and the undo stack share) and the undo stack itself (undoStack.ts: one step per saved
 * edit, the reverse batch sent through the same queue). `notify()` is the only flow to the component;
 * the component calls the public `send*`, `createPoint`, `createLine`, `renameItem`, `moveItem`, `linkItem`,
 * `setKind`, `undo`, `redo`, `undoTo`, `selectBasemap`, `retryUnsaved`, `discardUnsaved`, `onStorage` and `stopReplay`.
 * From entry 23 `undoTo` runs the history's undo-to-here as single undos, each sent after the last reverse saved.
 */

import { AbstractUIElementStore, ComponentStoreDelegate, JsObject } from '@inductiveautomation/perspective-client';
import { MapChanges, MapChangedBody } from './changes';
import { EditBatch, EditLevel, MapItemData, MapItemRecord } from './contract';
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
import { SAVE_IDLE, SaveState, lineCreateBatch, newId, pointCreateBatch, refusedSave, roundCoordinate, updateBatch } from './save';
import { Kind } from './adapters';
import {
    UNDO_EMPTY, UndoRun, UndoStack, failPending, finishPending, pushStep, runAfterSave, startRedo, startRun, startUndo, stepLabel
} from './undoStack';
import {
    KeyValueStore, REPLAY_INTERVAL_MS, STORAGE_WARNING, UnsavedEntry, UnsavedQueue, UnsavedReason, isBusy, isTransient, reasonFromError,
    savedRecords, storageKey, unsavedItems
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
    /** The undo stack of this session's saved edits (epic 4 entry 2, undoStack.ts). */
    undo: UndoStack;
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
    /** The undo stack (entry 2): one step per saved edit of this session, the reverse sent through the same queue. */
    private undoStack: UndoStack = UNDO_EMPTY;
    /**
     * The history's undo-to-here in progress (entry 23, owner 2026-11-05), or null: the single undos still to send, the
     * next one only after the last reverse saved; a refusal of its reverse or another edit ends it.
     */
    private undoRun: UndoRun | null = null;
    /** The label and the records before each batch sent by a tool or a field, until its reply makes it a step. */
    private pendingSteps = new Map<string, { label: string; before: MapItemRecord[] }>();
    /**
     * One send at a time per map item (entry 2): the batch in flight for an item (its create included), and behind it
     * the batches waiting their turn, each sent right after the reply with its baseVersion set from the reply's
     * version, so consecutive edits of one item inside one reply window never carry a stale baseVersion.
     */
    private inFlightByItem = new Map<string, string>();
    private heldByItem = new Map<string, Array<{ batch: EditBatch; label: string | null }>>();

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
            connection: this.connection,
            undo: this.undoStack
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
     * A finished line or area (epic 4 entry 4): one create of `kind` at the drawn vertices (an area's ring
     * unclosed), named after the kind (the placeholder the editor renames), with the `ends` its first and
     * last vertex snapped to, saved at once through the queue. Returns the new item's id.
     */
    createLine(coordinates: Array<[number, number]>, kind: Kind, ends: MapItemRecord['ends']): string {
        const itemId = newId();
        this.sendBatch(lineCreateBatch(itemId, newId(), kind.id, kind.name, coordinates, ends), itemId, stepLabel('add', kind.name));
        return itemId;
    }

    /**
     * One save for every tool, every finished field and the undo stack (epic 4 entry 2, AD-2, AD-10):
     * the batch is queued (localStorage) before it is sent, the save status says Saving... for `itemId`,
     * and when the reply says saved the batch joins the undo stack as one step named `label` with the
     * records as they were before it (the stack's `before`, what the reverse is built from). The Gateway
     * is called when an edit is finished, never per click or drag frame.
     */
    sendBatch(batch: EditBatch, itemId: string, label: string, now: Date = new Date()): void {
        if (this.undoRun !== null) {
            // Another edit ends an undo-to-here run (entry 23): the reverse in flight settles, no next one is sent.
            this.undoRun = null;
            console.info('[MapStudio] Undo to here stopped: another edit was made.');
        }
        this.dispatch(batch, itemId, label, now);
    }

    /**
     * Send a batch for an item now, or hold it while another batch of the item is in flight (the one send at a
     * time per item): a held batch goes right after that reply, rebased to the reply's version (releaseFlight). A
     * `label` makes the saved batch an undo step; null is a reverse, which the stack settles itself.
     */
    private dispatch(batch: EditBatch, itemId: string, label: string | null, now: Date): void {
        if (this.inFlightByItem.has(itemId)) {
            const held = this.heldByItem.get(itemId) || [];
            held.push({ batch, label });
            this.heldByItem.set(itemId, held);
            this.save = { state: 'saving', itemId };
            this.notify();
            console.info('[MapStudio] Batch ' + batch.batchId + ' waits its turn on ' + itemId + ' (' + held.length + ' waiting).');
            return;
        }
        if (label !== null) {
            this.pendingSteps.set(batch.batchId, { label, before: this.recordsFor(batch) });
        }
        this.inFlightByItem.set(itemId, batch.batchId);
        this.save = { state: 'saving', itemId };
        this.saveBatchId = batch.batchId;
        this.sender.enqueueAndSend(batch, now);
        this.notify();
    }

    /**
     * The batch in flight for an item is done: saved (`results`), with the next held batch sent at the reply's
     * version; or given up (a final refusal, a discard: `results` null), with the held batches dropped, since each
     * would be refused the same way (one console line names them).
     */
    private releaseFlight(batchId: string, results: Array<{ entity: string; id: string; version: number }> | null): void {
        for (const [itemId, flight] of Array.from(this.inFlightByItem.entries())) {
            if (flight !== batchId) {
                continue;
            }
            this.inFlightByItem.delete(itemId);
            const held = this.heldByItem.get(itemId) || [];
            this.heldByItem.delete(itemId);
            if (held.length === 0) {
                continue;
            }
            if (results === null) {
                console.info('[MapStudio] ' + held.length + ' edit(s) waiting on ' + itemId + ' dropped: its save was refused or discarded.');
                continue;
            }
            const [next, ...rest] = held;
            if (rest.length > 0) {
                this.heldByItem.set(itemId, rest);
            }
            const rebased: EditBatch = {
                batchId: next.batch.batchId,
                ops: next.batch.ops.map((op) => {
                    const result = results.find((r) => r.entity === op.entity && r.id === op.id);
                    return result ? { ...op, baseVersion: result.version } : op;
                })
            };
            if (next.label === null) {
                // A reverse: the stack holds the batch by its id; the rebased ops go to the Gateway.
                this.undoStack = this.undoStack.pending && this.undoStack.pending.batch.batchId === rebased.batchId
                    ? { ...this.undoStack, pending: { ...this.undoStack.pending, batch: rebased } } : this.undoStack;
            }
            this.dispatch(rebased, itemId, next.label, new Date());
        }
    }

    /** The stored records of the batch's map items as they are now (a create's id is absent). */
    private recordsFor(batch: EditBatch): MapItemRecord[] {
        return this.changes.state.items.filter((r) => batch.ops.some((op) => op.entity === 'item' && op.id === r.id));
    }

    /** The stored record of a live map item, or undefined (not loaded, deleted, or the create still in flight). */
    private storedRecord(id: string): MapItemRecord | undefined {
        return this.changes.state.items.find((i) => i.id === id && !i.deleted && i.version > 0);
    }

    /**
     * The record an edit is built on: the stored one, else the one this page has queued and not yet saved (the
     * Point tool's create in flight, version 0): its update is held and rebased when the create's reply comes.
     */
    private knownRecord(id: string): MapItemRecord | undefined {
        return this.storedRecord(id) || unsavedItems(this.unsaved.list()).find((i) => i.id === id);
    }

    /**
     * The Point tool's click (entries 2 and 4): one create of `kind` (the kind a kind button fixed, else the kind
     * list's first point kind; the tool resolves it, editing.ts) at the clicked place, named after the kind (the
     * placeholder the editor renames), saved at once. Returns the new item's id.
     */
    createPoint(lngLat: [number, number], kind: Kind): string {
        const itemId = newId();
        this.sendBatch(pointCreateBatch(itemId, newId(), kind.id, kind.name, lngLat), itemId, stepLabel('add', kind.name));
        return itemId;
    }

    /** A finished Name field (entry 2): one update at the stored version, the step "rename <new name>". */
    renameItem(id: string, name: string): void {
        this.sendUpdate(id, { name }, stepLabel('rename', name));
    }

    /** A moved point (the pin's drag end, or typed latitude and longitude): one update of its geometry, "move <name>". */
    moveItem(id: string, lngLat: [number, number]): void {
        const item = this.knownRecord(id);
        if (!item) {
            console.info('[MapStudio] The move of ' + id + ' was dropped: the item is not on the map.');
            return;
        }
        // The map store keeps 6 decimals (docs/contract.md): the batch carries the pin's or the field's place rounded.
        const geometry: MapItemData['geometry'] = { type: 'Point', coordinates: [roundCoordinate(lngLat[0]), roundCoordinate(lngLat[1])] };
        this.sendBatch(updateBatch(id, newId(), item.version, { geometry }), id, stepLabel('move', item.name));
    }

    /** The asset picker (entry 2): one update of `assetId` (null to unlink), "link <name>" or "unlink <name>". */
    linkItem(id: string, assetId: string | null): void {
        const item = this.knownRecord(id);
        this.sendUpdate(id, { assetId }, stepLabel(assetId === null ? 'unlink' : 'link', item ? item.name : id));
    }

    /** The Kind select in Details (entry 4): one update of `kind` to another kind of the item's geometry, "edit <name>". */
    setKind(id: string, kind: string): void {
        const item = this.knownRecord(id);
        if (item && item.kind === kind) {
            return;
        }
        this.sendUpdate(id, { kind }, stepLabel('edit', item ? item.name : id));
    }

    private sendUpdate(id: string, data: MapItemData, label: string): void {
        const item = this.knownRecord(id);
        if (!item) {
            console.info('[MapStudio] The change to ' + id + ' was dropped: the item is not on the map.');
            return;
        }
        this.sendBatch(updateBatch(id, newId(), item.version, data), id, label);
    }

    /** Undo the last saved edit of this session (entry 2): its reverse batch, at this session's own version of the record, through the queue. */
    undo(): void {
        if (!this.undoNext()) {
            console.info('[MapStudio] Nothing to undo, or a reverse is still being saved.');
        }
    }

    /**
     * Undo to here (entry 23, the history's row chosen; owner 2026-11-05): the chosen step and every later one, `count` in
     * all, as a run of single undos in order, newest first. Each is one reverse batch through the queue, as `undo` sends
     * it, and the next goes only once the last saved (`continueRun`); the run stops at the first refusal (its reason on
     * the save status row, as for any undo), at a step whose reverse cannot be built, or when another edit is made.
     */
    undoTo(count: number): void {
        const run = startRun(this.undoStack, count);
        if (!run) {
            console.info('[MapStudio] Nothing to undo back to, or a reverse is still being saved.');
            return;
        }
        this.undoRun = run;
        console.info('[MapStudio] Undoing ' + run.left + ' step(s), one at a time.');
        if (!this.undoNext()) {
            this.undoRun = null;
        }
    }

    /** The next single undo: its reverse built and sent; false with nothing to undo, one in flight, or a reverse that cannot be built. */
    private undoNext(): boolean {
        const started = startUndo(this.undoStack, newId(), this.changes.state.items);
        if (!started) {
            return false;
        }
        this.sendReverse(started);
        return true;
    }

    /** A reverse of the run saved: one fewer to go, and the next sent now, after the save (entry 23). */
    private continueRun(): void {
        const run = this.undoRun ? runAfterSave(this.undoRun) : null;
        this.undoRun = run;
        if (run === null) {
            return;
        }
        if (!this.undoNext()) {
            this.undoRun = null;
            console.info('[MapStudio] Undo to here stopped: the next step cannot be undone.');
        }
    }

    /** Redo the last undone edit: the reverse of its undo, through the queue. */
    redo(): void {
        const started = startRedo(this.undoStack, newId(), this.changes.state.items);
        if (!started) {
            console.info('[MapStudio] Nothing to redo, or a reverse is still being saved.');
            return;
        }
        this.sendReverse(started);
    }

    private sendReverse(started: { stack: UndoStack; batch: EditBatch }): void {
        this.undoStack = started.stack;
        const itemId = started.batch.ops.length > 0 ? started.batch.ops[0].id : '';
        this.dispatch(started.batch, itemId, null, new Date());
    }

    /** A batch saved: a tool's or a field's becomes a step; the pending reverse settles its step and moves the cursor. */
    private settleUndo(batchId: string, results: Array<{ entity: string; id: string; version: number }>, batch: EditBatch | null): void {
        const pending = this.pendingSteps.get(batchId);
        if (pending) {
            this.pendingSteps.delete(batchId);
            if (batch) {
                this.undoStack = pushStep(this.undoStack, { label: pending.label, batch, before: pending.before, results, at: Date.now() });
            }
            return;
        }
        this.undoStack = finishPending(this.undoStack, batchId, results, Date.now());
    }

    /** Try again: a refused entry becomes unsent and the queue replays now. */
    retryUnsaved(batchId: string): void {
        this.sender.retry(batchId);
    }

    /** Discard: the entry leaves storage and the map, and is never sent again (not while in flight); the queue gave it up. */
    discardUnsaved(batchId: string): void {
        if (!this.sender.discard(batchId)) {
            console.info('[MapStudio] Batch ' + batchId + ' is being sent; Discard waits for its answer.');
            return;
        }
        this.giveUp(batchId);
        this.notify();
    }

    /**
     * The queue gave a batch up (a final refusal, a discard): no step comes of it, a pending reverse is let go (and an
     * undo-to-here run with it, entry 23: the refusal stops it, its reason on the save status row), its item's turn moves on.
     */
    private giveUp(batchId: string): void {
        this.pendingSteps.delete(batchId);
        if (this.undoRun !== null && this.isPendingUndo(batchId)) {
            this.undoRun = null;
            console.info('[MapStudio] Undo to here stopped: the undo of batch ' + batchId + ' was refused or discarded.');
        }
        this.undoStack = failPending(this.undoStack, batchId);
        this.releaseFlight(batchId, null);
    }

    /** Whether `batchId` is the undo in flight (the reverse the stack waits on). */
    private isPendingUndo(batchId: string): boolean {
        const pending = this.undoStack.pending;
        return pending !== null && pending.direction === 'undo' && pending.batch.batchId === batchId;
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
            // The undo a run waits on (entry 23): read before the stack settles it.
            const runStep = this.undoRun !== null && this.isPendingUndo(reply.body.batchId);
            if (outcome.entry) {
                for (const record of savedRecords(outcome.entry.batch, reply.body.results)) {
                    if (this.changes.saved(record)) {
                        this.itemsRevision++;
                    }
                }
                // An update's new version (a rename, a move, a link, a reverse) reaches the drawn record here,
                // ahead of the Gateway's map.changed, so the next field saves at the right version.
                for (const op of outcome.entry.batch.ops) {
                    const result = reply.body.results.find((r) => r.entity === 'item' && r.id === op.id);
                    const drawn = this.changes.state.items.find((i) => i.id === op.id);
                    if (op.op === 'update' && op.entity === 'item' && result && drawn && drawn.version < result.version) {
                        if (this.changes.saved({ ...drawn, ...(op.data || {}), version: result.version } as MapItemRecord)) {
                            this.itemsRevision++;
                        }
                    } else if (op.op === 'delete' && op.entity === 'item' && result && drawn && !drawn.deleted) {
                        if (this.changes.saved({ ...drawn, version: result.version, deleted: true })) {
                            this.itemsRevision++;
                        }
                    }
                }
            }
            this.settleUndo(reply.body.batchId, reply.body.results, outcome.entry ? outcome.entry.batch : null);
            if (shown && this.save.state !== 'idle') {
                const itemId = this.save.itemId;
                const result = reply.body.results.find((r) => r.id === itemId);
                this.save = { state: 'saved', itemId, version: result ? result.version : 1 };
            }
            this.releaseFlight(reply.body.batchId, reply.body.results);
            if (runStep) {
                // After the save status and the item's turn moved on, so the next reverse starts its own Saving...
                this.continueRun();
            }
        } else if (reply.kind === 'error') {
            // A transient refusal (store unreachable, busy, read-only, no answer) keeps the batch queued and replaying,
            // so its step and its item's turn stay pending until the replay saves or the user discards it; a final
            // one (conflict, role, invalid) is the queue giving the batch up.
            if (outcome.kind === 'failed' && !isTransient(outcome.reason.code)) {
                this.giveUp(outcome.batchId);
            }
            if (shown && this.save.state !== 'idle') {
                this.save = refusedSave(this.save.itemId, reply.body);
            }
            this.store = storeStateFromSaveError(this.store, reply.body);
        }
        this.notify();
    }
}
