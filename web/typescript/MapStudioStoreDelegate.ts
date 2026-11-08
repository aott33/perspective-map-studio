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
 * From entry 5 the geometry changes: `moveItem` carries the snapped ends of the item's lines, and `moveVertex`,
 * `reshapeLine`, `deleteVertex` and `splitLine` change a line's or an area's shape, each one batch (geometry.ts) and one step.
 * From entry 25 `deleteItem` deletes an item, a line with its instruments, clearing the `ends` that name them, in one batch and
 * one step, held and built as a geometry change is.
 * From entry 6 `editProperty` saves one of the kind's fields as one update of the whole `properties` (the changed key merged
 * onto the newest the page knows, saves still in flight included), "edit <name>", and keeps the value as the kind's last for
 * the next item of that kind (itemForm.ts, per project and kind in localStorage), which `createPoint` and `createLine` start
 * with; `setKind` carries the values the new kind defines and drops the rest in the same update.
 * From entry 14 `sendPopupOpen` and `sendPopupClose` also fire the page's `onPopupOpen` and `onPopupClose` (pageEvents.ts), so every
 * popup the Gateway is told of the page is told of too.
 */

import { AbstractUIElementStore, ComponentStoreDelegate, JsObject } from '@inductiveautomation/perspective-client';
import { MapChanges, MapChangedBody } from './changes';
import { EditBatch, EditLevel, KindSetupRecord, LastChange, MapItemData, MapItemRecord } from './contract';
import { Position, itemDeleteBatch, lineGeometryBatch, pointMoveBatch, splitAtBatch, vertexDeleteBatch, vertexMoveBatch } from './geometry';
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
import { SAVE_IDLE, SaveState, lineCreateBatch, newId, pointCreateBatch, refusedSave, updateBatch } from './save';
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
import { NO_SHAPE_REFUSAL, ShapeRefusal, droppedText } from './problems';
import { FieldValue, keptProperties, prefillFor, prefillKey, readPrefill, rememberValue, withValue } from './itemForm';
import { EventFirer, POPUP_CLOSE_EVENT, POPUP_OPEN_EVENT, firePageEvent } from './pageEvents';

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
    /**
     * 'loading', 'loaded', or 'failed'; `message` is the last failed map.load's code and sentence (`store-unreachable: ...`),
     * kept while a retry loads and '' once a load succeeds, so the problem it says holds across the 15 s retries (entry 24).
     */
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
    /**
     * A tool's or a field's edit is being saved (entry 23): Undo, Redo and the history wait for its step, so it never lands
     * past the cursor.
     */
    editInFlight: boolean;
    /**
     * The last geometry save refused for good (entry 5): its batch, the items it touched, a revision bumped on each (the handles
     * of those items are made again from the stored shape), and in words the later changes it took with it ('' for none).
     */
    shapeRefused: ShapeRefusal;
    /**
     * Every map item with a batch in flight or waiting its turn (entry 6's review), with the newest `properties` those batches
     * carry (null when none carries any): Details compares a finished field with it, and once the item is left out (its saves
     * settled, saved or given up) puts back a field the record does not hold.
     */
    inFlight: Record<string, Record<string, unknown> | null>;
    /**
     * Who last changed each map item and when (epic 4 entry 7a), by item id: map.load's `changed` (other editors' changes as of
     * the last load), then this session's own saves (the session user, now). Empty for a viewer.
     */
    changed: Record<string, LastChange>;
    /**
     * The items this session added (the Point, Line and Area tools), newest first (entry 7a, the list's Just added): an add
     * undone leaves it; the page's reload clears it.
     */
    justAdded: string[];
    /**
     * The project's live kind setups (entry 7b): map.load.reply's `kindSetups` (editors only), kept live by map.changed's kind
     * setup ops (changes.ts), so a setup saved anywhere, a script's `system.mapstudio.applyEdits` included, shows here. Empty
     * for a viewer. The first-run checklist's step 1 is done while one exists.
     */
    kindSetups: KindSetupRecord[];
    /** The session user map.load named, '' when none (a viewer, an anonymous session): the first-run checklist's kept flags are per project and user. */
    user: string;
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
    /** Who last changed each item and when (entry 7a): map.load's `changed`, then this session's saves. */
    private changed: Record<string, LastChange> = {};
    /** The session user map.load named ('' when none), the actor of this session's own saves in `changed`. */
    private user = '';
    /** The items this session added, newest first (entry 7a, Just added). */
    private justAdded: string[] = [];
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
    /**
     * The geometry changes waiting their turn (entry 5), oldest first. Their batches carry whole shapes built from the stored
     * records, so each waits as a builder while a save of any item it touches is in flight or waiting, and is built again from
     * the records once those saves settle (`releaseShapes`): saved in order, never dropped and never built on a stale record.
     */
    private heldShapes: Array<{ itemId: string; label: string; build: () => EditBatch | null; ids: string[]; waits: (batch: EditBatch) => boolean }> = [];
    /**
     * The batches this page sent and awaits a reply for (replaying after a transient refusal included), by id: what a delete
     * waits on when one of them names an item it deletes in its `ends` (entry 25), until it saves or is given up.
     */
    private batchesInFlight = new Map<string, EditBatch>();
    /** The geometry batches sent and not yet saved, with the items they touch and the item's name: a refusal drops what waits on them. */
    private shapesSent = new Map<string, { ids: string[]; name: string }>();
    private shapeRefused: ShapeRefusal = NO_SHAPE_REFUSAL;

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
            undo: this.undoStack,
            editInFlight: this.editInFlight(),
            shapeRefused: this.shapeRefused,
            inFlight: this.inFlightItems(),
            changed: this.changed,
            justAdded: this.justAdded,
            kindSetups: this.changes.state.kindSetups,
            user: this.user
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
     * The page is told too (epic 4 entry 14, contract 0.4.0): `onPopupOpen {itemId, segment}`, the segment null for a point, beside
     * every popup.open the Gateway is told, so a new segment of the same line is a new open; Edit mode opens no popup and sends none.
     */
    sendPopupOpen(itemId: string, segment: SegmentRef | null = null): void {
        this.fireEvent(MESSAGE_EVENT, popupOpen(itemId, segment) as unknown as JsObject);
        firePageEvent(this.pageEvents(), POPUP_OPEN_EVENT, { itemId, segment: segment ? { fromId: segment.fromId, toId: segment.toId } : null });
    }

    /** The popup closed: the Gateway stops its pushes (AD-7), and the page is told with `onPopupClose {itemId}` (entry 14). */
    sendPopupClose(itemId: string): void {
        this.fireEvent(MESSAGE_EVENT, popupClose(itemId) as unknown as JsObject);
        firePageEvent(this.pageEvents(), POPUP_CLOSE_EVENT, { itemId });
    }

    /**
     * The component store's events (entry 14): the store this delegate was made for (`createDelegate`) is the component's
     * `ComponentStore`, which holds them, though the SDK types it as the element store it extends; null when it does not.
     */
    private pageEvents(): EventFirer | null {
        const events = (this.component as unknown as { componentEvents?: EventFirer } | undefined);
        return events && events.componentEvents ? events.componentEvents : null;
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
        // A retry after a failed load keeps its words until a load succeeds (entry 24: no blink across the retries).
        this.load = { state: 'loading', message: this.load.state === 'loaded' ? '' : this.load.message };
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
        this.sendBatch(lineCreateBatch(itemId, newId(), kind.id, kind.name, coordinates, ends, this.prefillOf(kind)), itemId,
            stepLabel('add', kind.name));
        this.noteAdded(itemId);
        return itemId;
    }

    /**
     * The values a new item of `kind` starts with (entry 6, R12): the last finished value of each of its fields in this project
     * (localStorage), those the kind still defines with their type; never a name, a location or a link.
     */
    private prefillOf(kind: Kind): Record<string, unknown> {
        return prefillFor(kind, readPrefill(this.storage, prefillKey(this.projectName(), kind.id)));
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
        // Every map item the batch touches (entry 5: a geometry change carries a line's instruments, a moved pad its lines).
        const ids = [itemId].concat(batch.ops.filter((op) => op.entity === 'item' && op.id !== itemId).map((op) => op.id));
        const busy = ids.find((id) => this.inFlightByItem.has(id));
        if (busy !== undefined) {
            const held = this.heldByItem.get(busy) || [];
            held.push({ batch, label });
            this.heldByItem.set(busy, held);
            this.save = { state: 'saving', itemId };
            this.notify();
            console.info('[MapStudio] Batch ' + batch.batchId + ' waits its turn on ' + busy + ' (' + held.length + ' waiting).');
            return;
        }
        if (label !== null) {
            this.pendingSteps.set(batch.batchId, { label, before: this.recordsFor(batch) });
        }
        for (const id of ids) {
            this.inFlightByItem.set(id, batch.batchId);
        }
        this.batchesInFlight.set(batch.batchId, batch);
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
        this.batchesInFlight.delete(batchId);
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
        this.releaseShapes();
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
        this.sendBatch(pointCreateBatch(itemId, newId(), kind.id, kind.name, lngLat, this.prefillOf(kind)), itemId,
            stepLabel('add', kind.name));
        this.noteAdded(itemId);
        return itemId;
    }

    /** A tool's add (entry 7a): the item heads the list's Just added, newest first, until the add is undone or the page reloads. */
    private noteAdded(itemId: string): void {
        this.justAdded = [itemId].concat(this.justAdded.filter((id) => id !== itemId));
    }

    /**
     * A batch of this session saved (entry 7a): each map item it touched was last changed by the session user, now (to the
     * second, as the Gateway's `at`); an item it created joins Just added (a Redo of an undone add too), and an item it
     * deleted leaves it (an add undone, or the new item deleted).
     */
    private noteSaved(batch: EditBatch, now: Date): void {
        const at = new Date(Math.floor(now.getTime() / 1000) * 1000).toISOString().replace('.000Z', 'Z');
        const changed = { ...this.changed };
        const deleted = new Set<string>();
        for (const op of batch.ops) {
            if (op.entity !== 'item') {
                continue;
            }
            changed[op.id] = { actor: this.user, at };
            if (op.op === 'delete') {
                deleted.add(op.id);
            } else if (op.op === 'create' && this.justAdded.indexOf(op.id) < 0) {
                // A create this session saved (a Redo of an undone add among them) is added (entry 7a's review).
                this.justAdded = [op.id].concat(this.justAdded);
            }
        }
        this.changed = changed;
        if (deleted.size > 0 && this.justAdded.some((id) => deleted.has(id))) {
            this.justAdded = this.justAdded.filter((id) => !deleted.has(id));
        }
    }

    /** A finished Name field (entry 2): one update at the stored version, the step "rename <new name>". */
    renameItem(id: string, name: string): void {
        this.sendUpdate(id, { name }, stepLabel('rename', name));
    }

    /**
     * A finished field of the item's kind (entry 6, R12): one update of the whole `properties` object with `key` set to
     * `value` (null leaves it out: not set), merged onto the newest properties this page knows, "edit <name>"; the value is
     * kept as the kind's last for the next item of that kind. Typed as the field's type by the form (itemForm.ts `readField`).
     */
    editProperty(id: string, key: string, value: FieldValue): void {
        const item = this.knownRecord(id);
        if (!item) {
            console.info('[MapStudio] The change to ' + id + ' was dropped: the item is not on the map.');
            return;
        }
        // A key the kind no longer defines, or a value it no longer takes (a choice dropped from its list), goes in the same
        // update, as a kind change drops them: ItemCheck refuses them, so every field save of the item would be refused.
        const kind = this.lists.kinds.find((k) => k.id === item.kind);
        const merged = withValue(this.propertiesFor(item), key, value);
        this.sendUpdate(id, { properties: kind ? keptProperties(merged, kind) : merged }, stepLabel('edit', item.name));
        rememberValue(this.storage, prefillKey(this.projectName(), item.kind), key, value);
    }

    /**
     * The newest `properties` this page knows for an item: those of its latest batch still in flight or waiting its turn (a
     * field finished while the last one is saved), else the record's, so a second field's update never carries the first
     * field's old value. A batch given up drops what waited on it, so the record's are the newest again.
     */
    private propertiesFor(item: MapItemRecord): Record<string, unknown> {
        const sent = this.sentProperties(item.id);
        return sent !== null ? sent : item.properties;
    }

    /** The `properties` of an item's latest batch in flight or waiting its turn, or null when none carries any. */
    private sentProperties(id: string): Record<string, unknown> | null {
        const batches: EditBatch[] = [];
        const flight = this.inFlightByItem.get(id);
        const inFlight = flight !== undefined ? this.batchesInFlight.get(flight) : undefined;
        if (inFlight) {
            batches.push(inFlight);
        }
        const own = this.heldByItem.get(id) || [];
        own.forEach((h) => batches.push(h.batch));
        let properties: Record<string, unknown> | null = null;
        for (const batch of batches) {
            for (const op of batch.ops) {
                if (op.entity === 'item' && op.id === id && op.op !== 'delete' && op.data && op.data.properties) {
                    properties = op.data.properties;
                }
            }
        }
        return properties;
    }

    /** The state's `inFlight`: every item a batch in flight or waiting its turn touches, with its newest properties sent. */
    private inFlightItems(): Record<string, Record<string, unknown> | null> {
        const ids = new Set<string>(Array.from(this.inFlightByItem.keys()));
        this.heldByItem.forEach((held) => held.forEach((h) => h.batch.ops.forEach((op) => {
            if (op.entity === 'item') {
                ids.add(op.id);
            }
        })));
        const out: Record<string, Record<string, unknown> | null> = {};
        ids.forEach((id) => {
            out[id] = this.sentProperties(id);
        });
        return out;
    }

    /**
     * A moved point (the pin's drag end, its handle's drag, Move then a click, or typed latitude and longitude): one batch with
     * its geometry and, from entry 5, the first or last vertex of every line whose stored `ends` name it (geometry.ts
     * pointMoveBatch, the lines' instruments re-placed), "move <name>". The map store keeps 6 decimals (docs/contract.md).
     */
    moveItem(id: string, lngLat: [number, number]): boolean {
        const item = this.knownRecord(id);
        if (!item || item.geometry.type !== 'Point') {
            console.info('[MapStudio] The move of ' + id + ' was dropped: the item is not a point on the map.');
            return false;
        }
        // Built when it goes, from the records then: a pin dragged while its create is saved waits for the create's reply.
        this.sendShapeChange(id, stepLabel('move', item.name), () => {
            const now = this.knownRecord(id);
            if (!now || now.geometry.type !== 'Point') {
                console.info('[MapStudio] The move of ' + item.name + ' was let go: the item left the map before its turn.');
                return null;
            }
            return pointMoveBatch(newId(), now, lngLat, this.changes.state.items);
        });
        return true;
    }

    /**
     * A geometry change (entry 5): sent now when no save of any item its batch touches is in flight or waiting and no earlier
     * geometry change waits; else it waits as a builder (one console line) and goes when those saves settle (`releaseShapes`).
     */
    private sendShapeChange(itemId: string, label: string, build: () => EditBatch | null,
        waits: (batch: EditBatch) => boolean = () => false): void {
        const batch = build();
        if (batch === null) {
            return;
        }
        if (this.heldShapes.length === 0 && !this.touchesBusy(batch) && !waits(batch)) {
            this.sendShapeBatch(batch, itemId, label);
            return;
        }
        // The items it touches as built now: a refusal of a save of any of them drops it (it was made on top of that save).
        this.heldShapes.push({ itemId, label, build, ids: [itemId].concat(batch.ops.map((op) => op.id)), waits });
        console.info('[MapStudio] ' + label + ' waits its turn: a save of an item it changes is still in flight.');
        this.notify();
    }

    /**
     * Whether a save this page sent and awaits (replaying after a transient refusal included), or one waiting its turn behind
     * another, writes `ends` naming one of `ids` (entry 25): a delete of those items waits for it, since the records it is built
     * from take those `ends` only when that save's reply comes, and would leave the line naming a deleted item.
     */
    private endsInFlightName(ids: string[]): boolean {
        const names = (ends: unknown): boolean => {
            const e = ends as MapItemRecord['ends'] | undefined;
            return !!e && ((!!e.start && ids.indexOf(e.start.itemId) >= 0) || (!!e.end && ids.indexOf(e.end.itemId) >= 0));
        };
        const held = Array.from(this.heldByItem.values()).reduce((all, list) => all.concat(list.map((h) => h.batch)), [] as EditBatch[]);
        return Array.from(this.batchesInFlight.values()).concat(held)
            .some((b) => b.ops.some((op) => op.entity === 'item' && !!op.data && names(op.data.ends)));
    }

    /** Whether a save of a map item the batch touches is in flight, or waiting its turn behind one. */
    private touchesBusy(batch: EditBatch): boolean {
        const ids = batch.ops.map((op) => op.id);
        return ids.some((id) => this.inFlightByItem.has(id))
            || Array.from(this.heldByItem.values()).some((list) => list.some((h) => h.batch.ops.some((op) => ids.indexOf(op.id) >= 0)));
    }

    /**
     * A save settled (saved, refused or discarded): the geometry changes waiting go, oldest first, each built now from the
     * records, until one still touches a save in flight. One that can no longer be built (its item left the map, a point gone)
     * is let go with one console line; that is the only way a change does not save.
     */
    private releaseShapes(): void {
        while (this.heldShapes.length > 0) {
            const next = this.heldShapes[0];
            const batch = next.build();
            if (batch !== null && (this.touchesBusy(batch) || next.waits(batch))) {
                return;
            }
            this.heldShapes.shift();
            if (batch !== null) {
                this.sendShapeBatch(batch, next.itemId, next.label);
            }
        }
    }

    /** A geometry change's batch sent, remembered with the items it touches until it saves or is refused. */
    private sendShapeBatch(batch: EditBatch, itemId: string, label: string): void {
        const record = this.knownRecord(itemId);
        this.shapesSent.set(batch.batchId, { ids: batch.ops.map((op) => op.id), name: record ? record.name : itemId });
        this.sendBatch(batch, itemId, label);
    }

    /**
     * A geometry save refused for good (entry 5): the changes waiting that touch its items were made on top of it (a midpoint
     * dragged in carries the shape the handles showed), so they go with it, said with the refusal on the save status row ("and 1
     * later change to L-SWD was not saved"); the handles of those items are made again from the stored shape. Changes to other
     * items keep waiting and save.
     */
    private dropOnRefusal(batchId: string): void {
        const sent = this.shapesSent.get(batchId);
        if (!sent) {
            return;
        }
        this.shapesSent.delete(batchId);
        const dropped = this.heldShapes.filter((h) => h.ids.some((id) => sent.ids.indexOf(id) >= 0));
        this.heldShapes = this.heldShapes.filter((h) => dropped.indexOf(h) < 0);
        this.shapeRefused = {
            revision: this.shapeRefused.revision + 1,
            batchId,
            ids: sent.ids,
            dropped: dropped.length > 0 ? droppedText(dropped.length, sent.name) : ''
        };
        if (dropped.length > 0) {
            console.info('[MapStudio] ' + droppedText(dropped.length, sent.name) + ': made on top of a change that was refused.');
        }
    }

    /** Whether a map item is drawn as an area (its kind's `area`): an unclosed ring with no ends and no split (AD-20). */
    private isArea(item: MapItemRecord): boolean {
        const kind = this.lists.kinds.find((k) => k.id === item.kind);
        return !!(kind && kind.area);
    }

    /**
     * A change to a stored line's or area's shape (entry 5), one step named `action` and the line's name: the batch `build` makes
     * from the stored record when the change goes (now, or once the saves it waits on settle, `sendShapeChange`). False, with one
     * console line, when the line is not stored; a change that can no longer be built when its turn comes is let go likewise.
     */
    private sendShape(id: string, action: 'reshape' | 'split', build: (line: MapItemRecord, area: boolean) => EditBatch): boolean {
        const line = this.storedRecord(id);
        if (!line || line.geometry.type !== 'LineString') {
            console.info('[MapStudio] The ' + action + ' of ' + id + ' was dropped: the line is not on the map.');
            return false;
        }
        this.sendShapeChange(id, stepLabel(action, line.name), () => {
            const now = this.storedRecord(id);
            try {
                if (!now || now.geometry.type !== 'LineString') {
                    throw new Error('the line left the map');
                }
                return build(now, this.isArea(now));
            } catch (err) {
                console.info('[MapStudio] The ' + action + ' of ' + line.name + ' was not sent: ' + (err instanceof Error ? err.message : String(err)));
                return null;
            }
        });
        return true;
    }

    /**
     * One point of a line or an area moved (its handle dragged, or Move then a click; entry 5): one batch, "reshape <name>". A
     * line's first or last point names `snapTo`, the item it now snaps to, in `ends`, or floats with null (geometry.ts).
     */
    moveVertex(id: string, index: number, to: Position, snapTo: string | null): boolean {
        return this.sendShape(id, 'reshape', (line, area) => vertexMoveBatch(newId(), line, index, to, snapTo, this.changes.state.items, area));
    }

    /** A line's or an area's new points (a midpoint dragged in: one more point there; entry 5): one batch, "reshape <name>". */
    reshapeLine(id: string, coordinates: Position[]): boolean {
        return this.sendShape(id, 'reshape', (line) => lineGeometryBatch(newId(), line, coordinates, this.changes.state.items));
    }

    /** The chosen point's Delete point (entry 5): one batch without it, an end point's side of `ends` gone, "reshape <name>". */
    deleteVertex(id: string, index: number): boolean {
        return this.sendShape(id, 'reshape', (line, area) => vertexDeleteBatch(newId(), line, index, this.changes.state.items, area));
    }

    /**
     * The chosen point's Split here (entry 5): one batch in which the line keeps its start and the new line its end
     * (geometry.ts splitAtBatch), "split <name>". Returns the new line's id (sent now or once its turn comes), or null when the
     * line is not on the map.
     */
    splitLine(id: string, index: number): string | null {
        const partId = newId();
        return this.sendShape(id, 'split', (line, area) => {
            if (area) {
                throw new Error('an area has no split');
            }
            return splitAtBatch(newId(), line, index, partId, this.changes.state.items);
        }) ? partId : null;
    }

    /**
     * Delete (entry 25; EXPERIENCE.md Delete: no confirmation, one undo restores it): one batch with the item, a line with every
     * instrument on it, and the `ends` of the lines that name a deleted item cleared (geometry.ts itemDeleteBatch), "delete <name>".
     * It carries whole `ends` and the records' versions, so it is held and built from the records as a geometry change is: sent now,
     * or once the saves of the items it touches settle (a line's reshape, a pad's move), and the saves that would write `ends`
     * naming an item it deletes (a line's end snapped to the pad, still being saved or replaying), never built on a stale record.
     * Its undo restores every item at its tombstone with its link, properties, kind and geometry and puts the `ends` back
     * (undo.ts); Redo deletes them again. False, with one console line, when the item is not stored on the map (never saved: no
     * delete at version 0).
     */
    deleteItem(id: string): boolean {
        const item = this.storedRecord(id);
        if (!item) {
            // Never a delete at version 0 (review, entry 25): an item only this page's waiting edits know (its create still being
            // saved, or refused for good) has nothing stored to delete; Discard under the save status row drops a refused one.
            console.info('[MapStudio] The delete of ' + id + ' was dropped: the item is not saved on the map.');
            return false;
        }
        this.sendShapeChange(id, stepLabel('delete', item.name), () => {
            const now = this.storedRecord(id);
            if (!now) {
                console.info('[MapStudio] The delete of ' + item.name + ' was let go: the item left the map before its turn.');
                return null;
            }
            return itemDeleteBatch(newId(), now, this.changes.state.items);
        }, (batch) => this.endsInFlightName(batch.ops.filter((op) => op.op === 'delete').map((op) => op.id)));
        return true;
    }

    /** The asset picker (entry 2): one update of `assetId` (null to unlink), "link <name>" or "unlink <name>". */
    linkItem(id: string, assetId: string | null): void {
        const item = this.knownRecord(id);
        this.sendUpdate(id, { assetId }, stepLabel(assetId === null ? 'unlink' : 'link', item ? item.name : id));
    }

    /**
     * The Kind select in Details (entry 4): one update of `kind` to another kind of the item's geometry, "edit <name>". From
     * entry 6 the same update carries the item's values the new kind defines (with their type) and drops the rest, since the
     * Gateway refuses a key the kind does not define; its undo puts the kind and every value back.
     */
    setKind(id: string, kind: string): void {
        const item = this.knownRecord(id);
        if (item && item.kind === kind) {
            return;
        }
        const target = this.lists.kinds.find((k) => k.id === kind);
        const data: MapItemData = item && target ? { kind, properties: keptProperties(this.propertiesFor(item), target) } : { kind };
        this.sendUpdate(id, data, stepLabel('edit', item ? item.name : id));
    }

    private sendUpdate(id: string, data: MapItemData, label: string): void {
        const item = this.knownRecord(id);
        if (!item) {
            console.info('[MapStudio] The change to ' + id + ' was dropped: the item is not on the map.');
            return;
        }
        this.sendBatch(updateBatch(id, newId(), item.version, data), id, label);
    }

    /**
     * Whether a tool's or a field's edit is still being saved (entry 23): sent and awaiting its step, or held behind another
     * batch of its item. Undo, Redo and the history wait meanwhile: its reply pushes the step after the cursor, and a reverse
     * started before it would leave that step past the cursor, out of Undo's reach and reversed by a later Redo.
     */
    private editInFlight(): boolean {
        return this.pendingSteps.size > 0 || this.heldShapes.length > 0
            || Array.from(this.heldByItem.values()).some((held) => held.some((h) => h.label !== null));
    }

    /** True, with one console line, when an edit being saved makes Undo, Redo or the history wait. */
    private waitForEdit(what: string): boolean {
        if (!this.editInFlight()) {
            return false;
        }
        console.info('[MapStudio] ' + what + ' waits: an edit is still being saved.');
        return true;
    }

    /** Undo the last saved edit of this session (entry 2): its reverse batch, at this session's own version of the record, through the queue. */
    undo(): void {
        if (this.waitForEdit('Undo')) {
            return;
        }
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
        if (this.waitForEdit('Undo to here')) {
            return;
        }
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

    /**
     * The run's reverse was refused or not sent (entry 23): the run stops at the first refusal, a temporary one included (busy,
     * the store unreachable, no answer), so a later replay that saves it sends nothing more.
     */
    private stopRun(batchId: string, why: string): void {
        if (this.undoRun !== null && this.isPendingUndo(batchId)) {
            this.undoRun = null;
            console.info('[MapStudio] Undo to here stopped: the undo of batch ' + batchId + ' ' + why + '.');
        }
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
        if (this.waitForEdit('Redo')) {
            return;
        }
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
        this.dropOnRefusal(batchId);
        this.pendingSteps.delete(batchId);
        this.stopRun(batchId, 'was refused or discarded');
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
        this.stopRun(batchId, 'was not sent (' + reason.code + ')');
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
            // Other editors' changes as of this load (entry 7a); this session's saves since then are set as they save.
            this.changed = reply.body.changed || {};
            this.user = reply.body.user || '';
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
                this.noteSaved(outcome.entry.batch, new Date());
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
            this.shapesSent.delete(reply.body.batchId);
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
            // one (conflict, role, invalid) is the queue giving the batch up. Either ends an undo-to-here run (entry 23).
            if (outcome.kind === 'failed') {
                this.stopRun(outcome.batchId, 'was refused (' + outcome.reason.code + ')');
            }
            if (shown && this.save.state !== 'idle') {
                this.save = refusedSave(this.save.itemId, reply.body);
            }
            if (outcome.kind === 'failed' && !isTransient(outcome.reason.code)) {
                // After the refusal is on the save status: a geometry change waiting on it goes now (entry 5) and says Saving...
                this.giveUp(outcome.batchId);
            }
            this.store = storeStateFromSaveError(this.store, reply.body);
        }
        this.notify();
    }
}
