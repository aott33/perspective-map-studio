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
 * From entry 10 the save problems' card: a save answered store-unreachable (not busy) pauses the tools and Undo (`savePaused`)
 * until a save or a load succeeds, with the items and live values kept; the conflict card's `useTheirs` and `applyOnTop` (a new
 * batch at the stored versions, one undo step), and the unreachable card's `retryStore`.
 * From entry 11b Recent changes (history.ts): `setHistoryOpen` asks `edits.history` for the first page when the History surface
 * opens and again on each `map.changed` while it is open (merged by `seq`, older pages kept), `historyOlder` asks the next page,
 * `historyRetry` asks again after a failed read, and `revert` sends a row's reverse through `sendBatch` as one undo step.
 * From entry 12a the Kinds screen's saves (kindSetup.ts): `saveKindSetup` saves one edited part of a kind's setup as the whole setup,
 * built from the newest stored one when it is sent, one save per kind in flight and the later edits after it at the version its
 * reply gave, never an undo step; an `invalid` reply's words are kept per kind for the field they name (`kindSaves`), a conflict,
 * the store unreachable and busy stay in the queue as entry 10's; and `askResolve` sends `tags.resolve` for the resolve notes.
 */

import { AbstractUIElementStore, ComponentStoreDelegate, JsObject } from '@inductiveautomation/perspective-client';
import { MapChanges, MapChangedBody } from './changes';
import { EditBatch, EditLevel, ErrorCodes, KindSetupRecord, LastChange, MapItemData, MapItemRecord } from './contract';
import { KindRefusal, KindSaveState, ResolveState, SetupEdit, applyEdit, refusalPlace, resolveKey, sameSetup, setupBatch } from './kindSetup';
import {
    Position, instrumentCreateBatch, instrumentMoveBatch, itemDeleteBatch, itemsDeleteBatch, lineGeometryBatch, pointMoveBatch, splitAtBatch, vertexDeleteBatch,
    vertexMoveBatch
} from './geometry';
import { HostLists, NO_HOST_LISTS } from './adapters';
import {
    ErrorBody, MESSAGE_EVENT, Reply, basemapSource, editsHistory, mapLoad, pointClick, popupClose, popupOpen, readReply, replyText, tagsResolve
} from './messages';
import {
    HISTORY_EMPTY, HISTORY_PAGE, HistoryState, failRead, mergeFirstPage, mergeOlderPage, readFailedText, revertBatch, revertLabel, rowSentence
} from './history';
import { browserLocale } from './linePopup';
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
    UNDO_EMPTY, UndoRun, UndoStack, failPending, finishPending, pushStep, runAfterSave, startRedo, startRun, severalLabel, startUndo, stepLabel
} from './undoStack';
import {
    KeyValueStore, REPLAY_INTERVAL_MS, STORAGE_WARNING, UnsavedEntry, UnsavedQueue, UnsavedReason, editLabel, isBusy, isTransient, onTopBatch,
    reasonFromError, savedRecords, storageKey, unsavedItems
} from './unsaved';
import { UnsavedSender } from './unsavedSender';
import { registerTestHook, takeTestReply } from './testHook';
import { NO_SHAPE_REFUSAL, ShapeRefusal, droppedText } from './problems';
import { applyRowEdit, kpiLabelsOf, overrideLabel, refusalWords, rowWords, sameOverrides } from './itemOverrides';
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
    /** The items a create held behind another save would store (entry 9), version 0: selectable with Details meanwhile. */
    heldCreates: MapItemRecord[];
    /** Bumped whenever the queue changes, so the component knows to redraw the unsaved items. */
    unsavedRevision: number;
    /** The queued batches this tab waits on a reply for: their Discard is off meanwhile. */
    sending: string[];
    /**
     * 'off' while map.load says the map store is unreachable (not the busy answer): the draw
     * tool is disabled and no store item is drawn; map.load is re-sent every 15 s meanwhile.
     * From epic 4 entry 10 also while `savePaused`: the tools and Undo are off, the items stay drawn.
     */
    editing: 'on' | 'off';
    /**
     * A save was answered store-unreachable, not the busy answer (entry 10, R4): the tools and Undo pause, the items and the
     * live values stay, the queue replays every 15 s, and a save or a map.load that succeeds ends it. The unreachable card's.
     */
    savePaused: boolean;
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
     * Entry 12c1: the newest `overrides` of every map item whose batch in flight or waiting its turn carries any (an item none
     * carries any for is left out): Details' Live now block draws them, so a row is marked Override as soon as it is sent.
     */
    inFlightOverrides: Record<string, Record<string, unknown>>;
    /**
     * Entry 12c1: the last override of an item the Gateway refused for good (`invalid`, `role`), by item id: the row, the words
     * as they stand beside its field, the path that was typed and the batch. It stands until the item's next override is sent
     * or the panel clears it.
     */
    overrideRefusals: Record<string, OverrideRefusal>;
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
    /**
     * Recent changes (entry 11b, history.ts): the edit record's pages read while the History surface is open, newest first, with
     * the state of the reads; kept (not cleared) when the surface closes, and read again when it opens.
     */
    history: HistoryState;
    /**
     * The Kinds screen's saves (entry 12a), by kind id: the fields being saved or waiting their turn, the refusals that stand, and
     * a count of the saves settled. A kind with nothing to say is left out.
     */
    kindSaves: Record<string, KindSaveState>;
    /** What `tags.resolve` said of each tag path asked (entry 12a), by kindSetup.ts `resolveKey` (kind, asset, path). */
    resolves: Record<string, ResolveState>;
}

/** An item's override the Gateway refused for good (entry 12c1): its words stand beside the row's field, the stored overrides stand. */
export interface OverrideRefusal {
    row: string;
    words: string;
    /** The path that was typed, so the field can show it again. */
    path: string;
    code: string;
    batchId: string;
}

/** One override edit on its way: the item, the row and the path typed ('' for a Reset). */
interface OverrideEdit {
    itemId: string;
    row: string;
    path: string;
}

/** One edit of a kind's setup on its way: the field it was typed in, the edit, and the setup version it was typed on. */
interface KindEdit {
    field: string;
    edit: SetupEdit;
    seen: number;
}

/** A kind's saves (entry 12a): the one in flight with the setup it carries, the edits waiting their turn, the refusals that stand. */
interface KindWork {
    flight: (KindEdit & { batchId: string; setup: Record<string, unknown>; restored: boolean }) | null;
    waiting: KindEdit[];
    refusals: KindRefusal[];
    done: number;
}

/** How long a read of the edit record may take before the surface says it did not answer. */
export const HISTORY_TIMEOUT_MS = 15_000;

/** How long a `tags.resolve` may take before its note says the check did not answer (the Gateway gives the tag system 5 s). */
export const RESOLVE_TIMEOUT_MS = 15_000;

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
    /** A save answered store-unreachable (not busy) paused the tools until a save or a load succeeds (entry 10). */
    private savePaused = false;
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
    /** The batches that are a Revert of a row of Recent changes, until each is queued with its marker (entry 12b1). */
    private revertBatches = new Set<string>();
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
    private heldShapes: Array<{ itemId: string; label: string; build: () => EditBatch | null; ids: string[]; waits: (batch: EditBatch) => boolean;
        /** The items a held create would store (entry 9: an instrument added while its line is saved), drawn in Details meanwhile. */
        creates: MapItemRecord[] }> = [];
    /**
     * The batches this page sent and awaits a reply for (replaying after a transient refusal included), by id: what a delete
     * waits on when one of them names an item it deletes in its `ends` (entry 25), until it saves or is given up.
     */
    private batchesInFlight = new Map<string, EditBatch>();
    /** The geometry batches sent and not yet saved, with the items they touch and the item's name: a refusal drops what waits on them. */
    private shapesSent = new Map<string, { ids: string[]; name: string }>();
    private shapeRefused: ShapeRefusal = NO_SHAPE_REFUSAL;
    /** Recent changes (entry 11b): the pages read, whether the surface is open, and the reads in flight by message id. */
    private history: HistoryState = HISTORY_EMPTY;
    private historyOpen = false;
    private historyFirstId: string | null = null;
    private historyOlderId: string | null = null;
    /** A map.changed came while the first page was being read: it is asked again once that read answers. */
    private historyAgain = false;
    /** One timer per read in flight: a read with no answer in 15 s is said to have failed, with Try again. */
    private historyTimers: { first: ReturnType<typeof setTimeout> | null; older: ReturnType<typeof setTimeout> | null } = { first: null, older: null };
    /** The Kinds screen's saves by kind (entry 12a): one in flight per kind, the later edits behind it. */
    private kindWork = new Map<string, KindWork>();
    /** The kind setup batches this page sent, by id: their map.changed is this page's own, not another editor's. */
    private kindBatches = new Map<string, string>();
    /** Entry 12c1: each override edit by the `overrides` object its update carries, and the refusals that stand, by item id. */
    private overrideEdits = new WeakMap<object, OverrideEdit>();
    private overrideRefusals: Record<string, OverrideRefusal> = {};
    /** The newest version of each kind's setup that another editor's change gave: a field typed on an older one meets the conflict. */
    private kindForeign = new Map<string, number>();
    /** A deleted setup's version, from the conflict a create at 0 met: the create is sent again there, which restores it. */
    private kindTombstones = new Map<string, number>();
    /** The resolve notes (entry 12a): what `tags.resolve` said per kind, asset and path, and the asks in flight by message id. */
    private resolves: Record<string, ResolveState> = {};
    private resolveAsks = new Map<string, { key: string; timer: ReturnType<typeof setTimeout> }>();

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
            heldCreates: this.heldShapes.reduce((all, h) => all.concat(h.creates), [] as MapItemRecord[]),
            unsavedRevision: this.unsavedRevision,
            sending: this.sender.sending(),
            editing: this.store.status === 'unavailable' || this.savePaused ? 'off' : 'on',
            savePaused: this.savePaused,
            storageWarning: this.storageWarning,
            live: this.live,
            liveRevision: this.liveRevision,
            connection: this.connection,
            undo: this.undoStack,
            editInFlight: this.editInFlight(),
            shapeRefused: this.shapeRefused,
            inFlight: this.inFlightItems(),
            inFlightOverrides: this.inFlightOverrides(),
            overrideRefusals: this.overrideRefusals,
            changed: this.changed,
            justAdded: this.justAdded,
            kindSetups: this.changes.state.kindSetups,
            user: this.user,
            history: this.history,
            kindSaves: this.kindSaveStates(),
            resolves: this.resolves
        };
    }

    /** The state's `kindSaves`: every kind with a save on its way, a refusal standing or a save settled. */
    private kindSaveStates(): Record<string, KindSaveState> {
        const out: Record<string, KindSaveState> = {};
        this.kindWork.forEach((work, kindId) => {
            out[kindId] = {
                saving: (work.flight ? [work.flight.field] : []).concat(work.waiting.map((w) => w.field)),
                refusals: work.refusals,
                done: work.done
            };
        });
        return out;
    }

    private kindWorkOf(kindId: string): KindWork {
        let work = this.kindWork.get(kindId);
        if (!work) {
            work = { flight: null, waiting: [], refusals: [], done: 0 };
            this.kindWork.set(kindId, work);
        }
        return work;
    }

    /**
     * One finished field of a kind's setup (epic 4 entry 12a; kindSetup.ts): the edit of that one part, saved as the kind's whole
     * setup through `edits.apply`. The setup is built when the save is sent, from the newest stored one (after the reply of the
     * save in flight), never from the panel's copy, so the parts nobody touched pass through as stored. One save per kind is in
     * flight; a later edit waits and goes at the version that reply gave. It is no undo step. `seen` is the setup version the
     * field was typed on: when another editor has saved the kind since, the save goes at `seen` and the Gateway answers the
     * conflict. False, with one console line, when it is not taken (editing paused, a kind not in the kind list).
     */
    saveKindSetup(kindId: string, field: string, edit: SetupEdit, seen: number): boolean {
        if (this.pausedFor('A kind setup save')) {
            return false;
        }
        if (!this.lists.kinds.some((k) => k.id === kindId)) {
            console.info('[MapStudio] The kind setup change was dropped: ' + kindId + ' is not in the kind list.');
            return false;
        }
        const work = this.kindWorkOf(kindId);
        // The field is saved again: what its last save was refused for no longer stands.
        work.refusals = work.refusals.filter((r) => r.field !== field);
        work.waiting.push({ field, edit, seen });
        this.pumpKind(kindId);
        this.notify();
        return true;
    }

    /** A refusal's words cleared (the field put back, or the panel left): every one of the kind that left the queue, or one field's. */
    clearKindRefusals(kindId: string, field?: string): void {
        const work = this.kindWork.get(kindId);
        if (!work) {
            return;
        }
        const kept = work.refusals.filter((r) => r.code === ErrorCodes.CONFLICT || (field !== undefined && r.field !== field));
        if (kept.length !== work.refusals.length) {
            work.refusals = kept;
            this.notify();
        }
    }

    /**
     * The kind's next waiting edit sent, when none is in flight: applied to the stored setup as it is now. An edit that changes
     * nothing sends nothing and is settled at once.
     */
    private pumpKind(kindId: string): void {
        const work = this.kindWorkOf(kindId);
        while (work.flight === null && work.waiting.length > 0) {
            const next = work.waiting.shift() as KindEdit;
            const stored = this.changes.state.kindSetups.find((k) => k.kindId === kindId);
            const base = stored ? stored.setup : {};
            const setup = applyEdit(base, next.edit);
            if (sameSetup(setup, base)) {
                work.done++;
                continue;
            }
            // Another editor saved this kind after the field was typed on `seen`: the save goes at `seen`, and is a conflict.
            const foreign = this.kindForeign.get(kindId) || 0;
            const tombstone = stored ? undefined : this.kindTombstones.get(kindId);
            this.kindTombstones.delete(kindId);
            const batch = setupBatch(kindId, newId(), stored, setup, stored && foreign > next.seen ? next.seen : undefined, tombstone);
            work.flight = { ...next, batchId: batch.batchId, setup, restored: tombstone !== undefined };
            this.kindBatches.set(batch.batchId, kindId);
            // No label: a kind setup save is not an Undo step (owner, 2026-11-09).
            this.dispatch(batch, kindId, null, new Date());
        }
    }

    /** The kind and its work whose save in flight is `batchId`, or null. */
    private kindFlight(batchId: string): { kindId: string; work: KindWork; flight: NonNullable<KindWork['flight']> } | null {
        const kindId = this.kindBatches.get(batchId);
        const work = kindId !== undefined ? this.kindWork.get(kindId) : undefined;
        return kindId !== undefined && work && work.flight && work.flight.batchId === batchId ? { kindId, work, flight: work.flight } : null;
    }

    /** A kind setup save saved: the stored setup is the one sent at the reply's version, and the next edit goes on top of it. */
    private kindSaved(batchId: string, results: Array<{ entity: string; id: string; version: number }>): void {
        const found = this.kindFlight(batchId);
        if (!found) {
            return;
        }
        const result = results.find((r) => r.entity === 'kindSetup' && r.id === found.kindId);
        if (result) {
            this.changes.savedKindSetup({ kindId: found.kindId, setup: found.flight.setup, version: result.version, deleted: false });
        }
        this.settleKind(found.kindId, found.work, batchId);
    }

    /** A kind's save in flight is done (saved, refused for good, discarded): its turn moves on to the next waiting edit. */
    private settleKind(kindId: string, work: KindWork, batchId: string): void {
        work.flight = null;
        work.refusals = work.refusals.filter((r) => r.batchId !== batchId);
        work.done++;
        this.pumpKind(kindId);
    }

    /**
     * A kind setup save answered with an error. A transient one (the store unreachable, busy, read only, no answer) stays queued
     * and replays, as entry 10's. A conflict stays in the queue with its card, the kind's later edits waiting behind it; one
     * exception: a create at version 0 that met a setup deleted before anyone here typed is sent again at the tombstone's version,
     * which restores it. Anything else (`invalid`, `role`) leaves the queue: its words stand beside the field they name, by the
     * order the rows were sent in, the field keeps what was typed and the stored setup stands.
     */
    private kindRefused(batchId: string, error: ErrorBody, transient: boolean): void {
        const found = this.kindFlight(batchId);
        if (!found || transient) {
            return;
        }
        const { kindId, work, flight } = found;
        if (error.code === ErrorCodes.CONFLICT) {
            const conflict = (error.conflicts || []).find((c) => c.entity === 'kindSetup' && c.id === kindId);
            const stored = this.changes.state.kindSetups.some((k) => k.kindId === kindId);
            if (conflict && conflict.current && conflict.current.deleted && !stored && !flight.restored
                && (this.kindForeign.get(kindId) || 0) <= flight.seen && this.sender.discard(batchId)) {
                this.kindTombstones.set(kindId, conflict.current.version);
                work.flight = null;
                work.waiting.unshift({ field: flight.field, edit: flight.edit, seen: flight.seen });
                console.info('[MapStudio] The ' + kindId + ' kind setup was deleted before: saving it again restores it.');
                this.pumpKind(kindId);
                return;
            }
            work.refusals = work.refusals.filter((r) => r.batchId !== batchId)
                .concat([{ field: flight.field, at: '', words: '', code: error.code, batchId }]);
            return;
        }
        const place = refusalPlace(error.message, flight.setup);
        this.sender.discard(batchId);
        work.flight = null;
        work.refusals = work.refusals.filter((r) => r.field !== flight.field && r.batchId !== batchId)
            .concat([{ field: flight.field, at: place.at, words: place.words, code: error.code, batchId }]);
        work.done++;
        this.pumpKind(kindId);
    }

    /** A queued kind setup save left the queue by a choice (Discard, Use their version): nothing of it stands, the next edit goes. */
    private kindDropped(batchId: string): void {
        const found = this.kindFlight(batchId);
        if (found) {
            this.settleKind(found.kindId, found.work, batchId);
        }
    }

    /**
     * The resolve notes (entry 12a; EXPERIENCE.md Kind setup: "Each path reports how many items it resolves for"): `tags.resolve`
     * for each path with the preview item's asset, asked when a path is saved or the preview item changes. A path already being
     * asked is not asked twice; an earlier answer shows until the new one comes.
     */
    askResolve(kindId: string, assetId: string, paths: readonly string[]): void {
        let asked = false;
        for (const path of paths) {
            const key = resolveKey(kindId, assetId, path);
            if (path === '' || Array.from(this.resolveAsks.values()).some((a) => a.key === key)) {
                continue;
            }
            const message = tagsResolve({ kindId, assetId, path });
            const timer = setTimeout(() => {
                this.resolveAsks.delete(message.id);
                this.resolves = { ...this.resolves, [key]: { state: 'failed', message: 'the Gateway did not answer in time.' } };
                console.info('[MapStudio] A tags.resolve did not answer.');
                this.notify();
            }, RESOLVE_TIMEOUT_MS);
            this.resolveAsks.set(message.id, { key, timer });
            if (!this.resolves[key]) {
                this.resolves = { ...this.resolves, [key]: { state: 'asking' } };
            }
            asked = true;
            this.fireEvent(MESSAGE_EVENT, message as unknown as JsObject);
        }
        if (asked) {
            this.notify();
        }
    }

    /** A reply to one of the resolve asks: the count, a full path, or the Gateway's refusal in words. */
    private onResolveReply(reply: Reply): void {
        if (reply.kind !== 'tags.resolve.reply' && reply.kind !== 'error') {
            return;
        }
        const ask = this.resolveAsks.get(reply.id);
        if (!ask) {
            console.info('[MapStudio] A tags.resolve.reply that nothing waits for was ignored.');
            return;
        }
        clearTimeout(ask.timer);
        this.resolveAsks.delete(reply.id);
        const state: ResolveState = reply.kind === 'error' ? { state: 'failed', message: reply.body.message }
            : reply.body.relative && reply.body.n !== undefined && reply.body.m !== undefined
                ? { state: 'resolved', n: reply.body.n, m: reply.body.m } : { state: 'shared' };
        this.resolves = { ...this.resolves, [ask.key]: state };
        console.debug('[MapStudio] ' + replyText(reply));
        this.notify();
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
        // With the records its ops start from (entry 10): a conflict card names what the other editor changed since.
        // And whether it is a Revert (entry 12b1): the marker is kept with the entry, so the card has one choice after a reload too.
        this.sender.enqueueAndSend(batch, now, this.recordsFor(batch), this.revertBatches.delete(batch.batchId));
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
        return this.storedRecord(id) || unsavedItems(this.unsaved.list()).find((i) => i.id === id) || this.heldCreate(id);
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

    /**
     * Add an instrument from a line's Details (epic 4 entry 9; EXPERIENCE.md Instruments): one create of `kind` on the stored line
     * `lineId` at `distanceM` metres along it (a click's projection or a typed distance), its point and attachment in the one op
     * (geometry.ts `instrumentCreateBatch`), named after the kind with its prefill, one undo step "add <kind>". Built when it goes,
     * from the line's record then: it waits while a save of the line is in flight or waiting, so its place is measured on the shape
     * the Gateway checks it against. Returns the new item's id, or null (one console line) when the line is not stored on the map.
     */
    createInstrument(lineId: string, kind: Kind, distanceM: number): string | null {
        const line = this.storedRecord(lineId);
        if (!line || line.geometry.type !== 'LineString') {
            console.info('[MapStudio] The new ' + kind.name + ' was dropped: line ' + lineId + ' is not on the map.');
            return null;
        }
        const itemId = newId();
        const prefill = this.prefillOf(kind);
        this.sendShapeChange(itemId, stepLabel('add', kind.name), () => {
            const now = this.storedRecord(lineId);
            if (!now || now.geometry.type !== 'LineString') {
                console.info('[MapStudio] The new ' + kind.name + ' was let go: line ' + line.name + ' left the map before its turn.');
                return null;
            }
            return instrumentCreateBatch(newId(), itemId, kind.id, kind.name, now, distanceM, prefill);
        }, () => this.itemBusy(lineId));
        this.noteAdded(itemId);
        return itemId;
    }

    /**
     * An instrument moved along its line (epic 4 entry 9: its drag released, or its distance typed in Details; never off the line,
     * WCAG 2.5.7): one update with its point and attachment at `distanceM` on the line it is attached to (geometry.ts
     * `instrumentMoveBatch`), one undo step "move <name>". Built when it goes, from the records then; it waits for a save of the
     * instrument or of its line. False, with one console line, when the item is not an instrument on a stored line.
     */
    moveInstrument(id: string, distanceM: number): boolean {
        const item = this.knownRecord(id);
        if (!item || item.geometry.type !== 'Point' || item.attachment === null || !this.storedRecord(item.attachment.lineId)) {
            console.info('[MapStudio] The move of ' + id + ' was dropped: it is not an instrument on a line on the map.');
            return false;
        }
        this.sendShapeChange(id, stepLabel('move', item.name), () => {
            const now = this.knownRecord(id);
            const line = now && now.attachment ? this.storedRecord(now.attachment.lineId) : undefined;
            if (!now || !line || line.geometry.type !== 'LineString') {
                console.info('[MapStudio] The move of ' + item.name + ' was let go: it or its line left the map before its turn.');
                return null;
            }
            return instrumentMoveBatch(newId(), now, line, distanceM);
        }, () => this.itemBusy(item.attachment!.lineId));
        return true;
    }

    /** Whether a save of the map item is in flight, or waiting its turn behind one (entry 9: an instrument's line). */
    private itemBusy(id: string): boolean {
        return this.inFlightByItem.has(id)
            || Array.from(this.heldByItem.values()).some((list) => list.some((h) => h.batch.ops.some((op) => op.id === id)));
    }

    /**
     * Whether the batch changes or deletes a stored line while a save attaching an instrument to it is in flight or waiting
     * (`attachInFlightTo`): the one wait every geometry change and delete takes through `sendShapeChange` (entry 9). A save still
     * held in `heldShapes` is covered by their order: a change made after it waits behind it and is built once it has gone.
     */
    private attachWaits(batch: EditBatch): boolean {
        return batch.ops.some((op) => {
            const record = op.entity === 'item' ? this.storedRecord(op.id) : undefined;
            return !!record && record.geometry.type === 'LineString' && this.attachInFlightTo(op.id);
        });
    }

    /** The record of a create held behind another save (entry 9), version 0, or undefined. */
    private heldCreate(id: string): MapItemRecord | undefined {
        for (const h of this.heldShapes) {
            const found = h.creates.find((r) => r.id === id);
            if (found) {
                return found;
            }
        }
        return undefined;
    }

    /**
     * Whether a save this page sent and awaits, or one waiting its turn, writes an attachment to the line `lineId` (entry 9: an
     * instrument just added or moved): a change of the line's shape, or its delete, waits for it, since the batch must carry that
     * instrument, which the records it is built from hold only once that save's reply comes.
     */
    private attachInFlightTo(lineId: string): boolean {
        const held = Array.from(this.heldByItem.values()).reduce((all, list) => all.concat(list.map((h) => h.batch)), [] as EditBatch[]);
        return Array.from(this.batchesInFlight.values()).concat(held).some((b) => b.ops.some((op) => op.entity === 'item' && op.op !== 'delete'
            && !!op.data && !!op.data.attachment && (op.data.attachment as { lineId?: string }).lineId === lineId));
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
        return this.sentField(id, 'properties');
    }

    /** `properties` or `overrides` as an item's latest batch in flight or waiting its turn carries it, or null when none does. */
    private sentField(id: string, field: 'properties' | 'overrides'): Record<string, unknown> | null {
        const batches: EditBatch[] = [];
        const flight = this.inFlightByItem.get(id);
        const inFlight = flight !== undefined ? this.batchesInFlight.get(flight) : undefined;
        if (inFlight) {
            batches.push(inFlight);
        }
        const own = this.heldByItem.get(id) || [];
        own.forEach((h) => batches.push(h.batch));
        let sent: Record<string, unknown> | null = null;
        for (const batch of batches) {
            for (const op of batch.ops) {
                const value = op.entity === 'item' && op.id === id && op.op !== 'delete' && op.data ? op.data[field] : undefined;
                if (value) {
                    sent = value;
                }
            }
        }
        return sent;
    }

    /**
     * The newest `overrides` this page knows for an item (entry 12c1): those of its latest batch still in flight or waiting its
     * turn, else the record's, so a second row's update never carries the first row's old overrides (as `propertiesFor`).
     */
    private overridesFor(item: MapItemRecord): Record<string, unknown> {
        const sent = this.sentField(item.id, 'overrides');
        return sent !== null ? sent : item.overrides || {};
    }

    /** The state's `inFlightOverrides`: the newest overrides of each item whose batch in flight or waiting carries any. */
    private inFlightOverrides(): Record<string, Record<string, unknown>> {
        const ids = new Set<string>(Array.from(this.inFlightByItem.keys()));
        this.heldByItem.forEach((_held, id) => ids.add(id));
        const out: Record<string, Record<string, unknown>> = {};
        ids.forEach((id) => {
            const sent = this.sentField(id, 'overrides');
            if (sent !== null) {
                out[id] = sent;
            }
        });
        return out;
    }

    /**
     * One row of Details' Live now block overridden or reset for this one item (entry 12c1, R5; itemOverrides.ts): one update of
     * the item's whole `overrides`, built from the newest this page knows (those in flight included) with only that row changed
     * (`path` a full path, or null for Reset), so every other stored part passes through untouched. It is an ordinary item edit:
     * an Undo step named by its part ("change Point 2's Pressure path", "reset Point 2's comms path") and a row of Recent changes.
     * `rowName` is the row's name as the block shows it. False when nothing was sent (the item gone, or nothing changed).
     */
    editOverride(id: string, row: string, path: string | null, rowName: string): boolean {
        const item = this.knownRecord(id);
        if (!item) {
            console.info('[MapStudio] The override of ' + id + ' was dropped: the item is not on the map.');
            return false;
        }
        const stored = this.changes.state.kindSetups.find((k) => k.kindId === item.kind);
        const newest = this.overridesFor(item);
        const overrides = applyRowEdit(newest, stored ? stored.setup : null, row, path);
        this.clearOverrideRefusal(id);
        if (sameOverrides(overrides, newest)) {
            return false;
        }
        // The overrides object is this edit's mark: a batch that carries it (sent now, held, or rebased) is this row's.
        this.overrideEdits.set(overrides, { itemId: id, row, path: path === null ? '' : path });
        this.sendUpdate(id, { overrides }, overrideLabel(path === null, item.name, rowWords(row, rowName)));
        return true;
    }

    /** An override's refusal cleared (its field put back or typed in again, or the panel left). */
    clearOverrideRefusal(id: string): void {
        if (id in this.overrideRefusals) {
            const next = { ...this.overrideRefusals };
            delete next[id];
            this.overrideRefusals = next;
            this.notify();
        }
    }

    /**
     * An override's save answered with an error (entry 12c1). A transient one stays queued and replays, and a conflict stays in
     * the queue with its card, as any item edit's. Anything else (`invalid`, `role`) leaves the queue: the Gateway's words stand
     * beside the row's field and the stored overrides stand.
     */
    private overrideRefused(batchId: string, found: OverrideEdit | null, error: ErrorBody, transient: boolean): void {
        if (!found || transient || error.code === ErrorCodes.CONFLICT) {
            return;
        }
        this.sender.discard(batchId);
        this.overrideRefusals = {
            ...this.overrideRefusals,
            [found.itemId]: { row: found.row, words: refusalWords(error.message), path: found.path, code: error.code, batchId }
        };
    }

    /** The override edit a batch in flight carries (its one item op's `overrides` object is the edit's mark), or null. */
    private overrideEditOf(batchId: string): OverrideEdit | null {
        const batch = this.batchesInFlight.get(batchId);
        if (!batch) {
            return null;
        }
        for (const op of batch.ops) {
            const held = op.entity === 'item' && op.data && op.data.overrides ? this.overrideEdits.get(op.data.overrides) : undefined;
            if (held && held.itemId === op.id) {
                return held;
            }
        }
        return null;
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
        if (item.attachment !== null) {
            // An instrument on a line moves along it only (entry 9, `moveInstrument`): a free place would leave its line.
            console.info('[MapStudio] The move of ' + item.name + ' was dropped: an instrument moves along its line.');
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
        own: (batch: EditBatch) => boolean = () => false): void {
        // Every change that re-places or deletes a line's instruments (a reshape, a split, a pad's move with the lines its ends
        // name, a delete of one or several) waits for a save that attaches an instrument to such a line (entry 9).
        const waits = (b: EditBatch): boolean => own(b) || this.attachWaits(b);
        const batch = build();
        if (batch === null) {
            return;
        }
        if (this.heldShapes.length === 0 && !this.touchesBusy(batch) && !waits(batch)) {
            this.sendShapeBatch(batch, itemId, label);
            return;
        }
        // The items it touches as built now: a refusal of a save of any of them drops it (it was made on top of that save).
        this.heldShapes.push({ itemId, label, build, ids: [itemId].concat(batch.ops.map((op) => op.id)), waits,
            creates: unsavedItems([{ batch } as UnsavedEntry]) });
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

    /**
     * Delete of several (epic 4 entry 8; EXPERIENCE.md Delete): one batch with every stored item of `ids` (a line with every
     * instrument on it, an instrument also chosen counted once, the `ends` naming a deleted item cleared once per line; geometry.ts
     * `itemsDeleteBatch`) and one undo step, "delete N items", N the stored items chosen. Held and built from the records as a single
     * delete is (`deleteItem`). One id is `deleteItem`'s "delete <name>". False when none of them is stored on the map.
     */
    deleteItems(ids: readonly string[]): boolean {
        const stored = ids.filter((id, i) => ids.indexOf(id) === i && !!this.storedRecord(id));
        if (stored.length === 0) {
            console.info('[MapStudio] The delete of ' + ids.length + ' items was dropped: none of them is saved on the map.');
            return false;
        }
        if (stored.length === 1) {
            return this.deleteItem(stored[0]);
        }
        this.sendShapeChange(stored[0], severalLabel(stored.length), () => {
            const now = stored.map((id) => this.storedRecord(id)).filter((r): r is MapItemRecord => !!r);
            if (now.length === 0) {
                console.info('[MapStudio] The delete of ' + stored.length + ' items was let go: they left the map before its turn.');
                return null;
            }
            return itemsDeleteBatch(newId(), now, this.changes.state.items);
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
        // Entry 12c1 (owner decision 2): the item's overrides were written for the kind it leaves, so they go in the same save;
        // the step's undo carries them back with the kind. An item with none sends none.
        if (item && Object.keys(this.overridesFor(item)).length > 0) {
            data.overrides = {};
        }
        this.sendUpdate(id, data, stepLabel('edit', item ? item.name : id));
    }

    private sendUpdate(id: string, data: MapItemData, label: string): void {
        const item = this.knownRecord(id);
        if (!item) {
            console.info('[MapStudio] The change to ' + id + ' was dropped: the item is not on the map.');
            return;
        }
        if (item.version === 0 && this.heldCreate(id)) {
            // Its create waits its turn (entry 9): the field goes after it, at the version its reply gives.
            this.sendShapeChange(id, label, () => {
                const now = this.knownRecord(id);
                return now ? updateBatch(id, newId(), now.version, data) : null;
            });
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

    /** True, with one console line, while editing is paused (the store unreachable): Undo, Redo and the history are off too (entry 10). */
    private pausedFor(what: string): boolean {
        if (this.store.status !== 'unavailable' && !this.savePaused) {
            return false;
        }
        console.info('[MapStudio] ' + what + ' is off: the map store is unreachable.');
        return true;
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
        if (this.pausedFor('Undo') || this.waitForEdit('Undo')) {
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
        if (this.pausedFor('Undo to here') || this.waitForEdit('Undo to here')) {
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
        if (this.pausedFor('Redo') || this.waitForEdit('Redo')) {
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
        this.kindDropped(batchId);
        this.checkStoreAfterDiscard();
        this.notify();
    }

    /**
     * The conflict card's "Use <name>'s version" (epic 4 entry 10, R2): my entry is discarded (never sent again) and the items
     * it was refused for are drawn as stored, from the conflict's records. Nothing while the batch is being sent.
     */
    useTheirs(batchId: string): void {
        const entry = this.unsaved.get(batchId);
        if (!entry) {
            return;
        }
        if (!this.sender.discard(batchId)) {
            console.info('[MapStudio] Batch ' + batchId + ' is being sent; Use their version waits for its answer.');
            return;
        }
        this.takeStored(entry);
        this.giveUp(batchId);
        this.kindDropped(batchId);
        this.checkStoreAfterDiscard();
        this.notify();
    }

    /**
     * The conflict card's "Apply mine on top" (entry 10, R3, decision 1): a new batch with a new batchId, my ops at the
     * conflict's stored versions (unsaved.ts `onTopBatch`), saved and undone as an ordinary edit, one undo step named as the
     * edit was ("Undo: edit P14" restores theirs: the step's records are the stored ones, taken from the conflict first). The
     * refused entry is discarded, so a replay still sends a stored batch unchanged. Nothing when it is not offered (they
     * deleted the item, or my add met one that exists) or while the batch is being sent.
     */
    applyOnTop(batchId: string): void {
        const entry = this.unsaved.get(batchId);
        const batch = entry ? onTopBatch(entry, newId()) : null;
        if (!entry || !batch) {
            console.info('[MapStudio] Apply mine on top is not offered for batch ' + batchId + '.');
            return;
        }
        if (this.touchesBusy(entry.batch)) {
            // Another batch of its items is in flight or waiting (as Discard waits): the new batch would be held behind it and
            // dropped with it if it were refused, and the entry is already gone. The card stays; press it again after.
            console.info('[MapStudio] Apply mine on top waits: another save of ' + batchId + "'s items is in flight.");
            return;
        }
        if (!this.sender.discard(batchId)) {
            console.info('[MapStudio] Batch ' + batchId + ' is being sent; Apply mine on top waits for its answer.');
            return;
        }
        this.takeStored(entry);
        this.giveUp(batchId);
        const first = batch.ops.find((op) => op.entity === 'item') || batch.ops[0];
        this.sendBatch(batch, first.id, editLabel(entry.batch, this.changes.state.items));
    }

    /**
     * The unreachable card's Try again (entry 10, R4): the queue replays now; with nothing to replay, map.load is sent, whose
     * success ends the pause (a store-unreachable answer makes the store unavailable and retries every 15 s).
     */
    retryStore(): void {
        if (this.unsaved.hasUnsent()) {
            this.sender.replay();
        } else {
            this.changes.load();
        }
    }

    /** A discard while saves are paused leaving nothing to replay: map.load checks the store, so the pause cannot outlive the edits. */
    private checkStoreAfterDiscard(): void {
        if (this.savePaused && !this.unsaved.hasUnsent()) {
            this.changes.load();
        }
    }

    /** The conflict's stored map item records drawn (entry 10): the item shows the other editor's version, a later one kept. */
    private takeStored(entry: UnsavedEntry): void {
        for (const c of entry.conflict || []) {
            if (c.entity === 'item' && c.current && this.changes.saved(c.current as MapItemRecord)) {
                this.itemsRevision++;
            } else if (c.entity === 'kindSetup' && c.current) {
                // A kind setup's stored record (entry 12a): the Kinds panel shows the other editor's version, a later one kept.
                this.changes.savedKindSetup(c.current as KindSetupRecord);
            }
        }
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
        // Another tab saved or discarded this tab's entries while saves were paused (entry 10): map.load checks the store.
        this.checkStoreAfterDiscard();
    }

    /** Stop the replay, load retry and connection timers (the component unmounted). */
    stopReplay(): void {
        this.sender.stop();
        this.connectionWatch.stop();
        this.clearHistoryTimer('first');
        this.clearHistoryTimer('older');
        this.resolveAsks.forEach((ask) => clearTimeout(ask.timer));
        this.resolveAsks.clear();
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

    /**
     * The History surface opened or closed (entry 11b): on open the first page of the edit record is asked (`edits.history`, a page
     * of 50); while it is open each `map.changed` asks the first page again. Closed, nothing is asked; the rows read stay.
     */
    setHistoryOpen(open: boolean): void {
        if (open === this.historyOpen) {
            return;
        }
        this.historyOpen = open;
        if (open) {
            this.askHistoryFirst();
            return;
        }
        // Closed (the surface left, or the component unmounted): the reads in flight are let go, so a reopen asks afresh.
        this.historyFirstId = null;
        this.historyOlderId = null;
        this.historyAgain = false;
        this.clearHistoryTimer('first');
        this.clearHistoryTimer('older');
        if (this.history.loading !== null) {
            this.history = { ...this.history, loading: null };
            this.notify();
        }
    }

    /** Try again after a failed read: the read that failed is asked again. */
    historyRetry(): void {
        if (this.history.errorOn === 'older') {
            this.historyOlder();
        } else {
            this.askHistoryFirst();
        }
    }

    /** Show older: the next page, before the reader's `nextBefore`; nothing while one is read or none remains. */
    historyOlder(): void {
        const before = this.history.nextBefore;
        if (!this.history.more || before === null || this.historyOlderId !== null) {
            return;
        }
        const message = editsHistory({ before, limit: HISTORY_PAGE });
        this.historyOlderId = message.id;
        this.history = { ...this.history, loading: 'older' };
        this.armHistoryTimer('older');
        this.notify();
        this.fireEvent(MESSAGE_EVENT, message as unknown as JsObject);
    }

    private askHistoryFirst(): void {
        if (this.historyFirstId !== null) {
            // A read is in flight: one more once it answers, so a burst of changes asks twice at most.
            this.historyAgain = true;
            return;
        }
        const message = editsHistory({ limit: HISTORY_PAGE });
        this.historyFirstId = message.id;
        this.historyAgain = false;
        this.history = { ...this.history, loading: this.history.loading === 'older' ? 'older' : 'first' };
        this.armHistoryTimer('first');
        this.notify();
        this.fireEvent(MESSAGE_EVENT, message as unknown as JsObject);
    }

    /** No answer within 15 s: that read is said to have failed, with Try again; a read of the other page is left as it is. */
    private armHistoryTimer(which: 'first' | 'older'): void {
        this.clearHistoryTimer(which);
        this.historyTimers[which] = setTimeout(() => {
            this.historyTimers[which] = null;
            if (which === 'first') {
                this.historyFirstId = null;
                this.historyAgain = false;
            } else {
                this.historyOlderId = null;
            }
            this.history = failRead(this.history, which, readFailedText(which, 'the Gateway did not answer in time'));
            this.history = { ...this.history, loading: this.historyLoading() };
            console.info('[MapStudio] Recent changes: a read of the edit record did not answer.');
            this.notify();
        }, HISTORY_TIMEOUT_MS);
    }

    private clearHistoryTimer(which: 'first' | 'older'): void {
        const timer = this.historyTimers[which];
        if (timer !== null) {
            clearTimeout(timer);
            this.historyTimers[which] = null;
        }
    }

    private historyLoading(): 'first' | 'older' | null {
        return this.historyOlderId !== null ? 'older' : this.historyFirstId !== null ? 'first' : null;
    }

    /** A reply to one of the surface's reads: its page merged, or its refusal said in words. */
    private onHistoryReply(reply: Reply): void {
        const first = reply.kind !== 'invalid' && reply.id === this.historyFirstId;
        if (first) {
            this.historyFirstId = null;
        } else {
            this.historyOlderId = null;
        }
        this.clearHistoryTimer(first ? 'first' : 'older');
        if (reply.kind === 'edits.history.reply') {
            this.history = first ? mergeFirstPage(this.history, reply.body) : mergeOlderPage(this.history, reply.body);
            console.debug('[MapStudio] ' + replyText(reply));
        } else if (reply.kind === 'error') {
            const which = first ? 'first' : 'older';
            this.history = failRead(this.history, which, readFailedText(which, reply.body.message));
            console.info('[MapStudio] Recent changes: the read was refused (' + reply.body.code + ').');
        }
        this.history = { ...this.history, loading: this.historyLoading() };
        if (first && this.historyAgain && this.historyOpen) {
            this.historyAgain = false;
            this.askHistoryFirst();
            return;
        }
        this.notify();
    }

    /**
     * Revert a row of Recent changes (entry 11b): its batch's reverse, each op at the row's own version (history.ts `revertBatch`),
     * sent through `sendBatch` as an ordinary edit and one undo step "revert "<sentence>"", so it is refused as any edit is (a change
     * saved since is a `conflict` naming who made it, on the conflict card, which offers only "Use <name>'s version": the batch is
     * queued marked as a Revert, entry 12b1). Nothing for a row Revert is not offered for, or while editing is paused.
     */
    revert(seq: number): boolean {
        const entry = this.history.entries.find((e) => e.seq === seq);
        if (!entry) {
            console.info('[MapStudio] Revert: change ' + seq + ' is not among the rows read.');
            return false;
        }
        // It waits as Undo does: never held behind another save of its items, whose reply would rebase it past the change made
        // since and save over it with no conflict; a second press while the first is saved sends nothing.
        if (this.pausedFor('Revert') || this.waitForEdit('Revert')) {
            return false;
        }
        const batch = revertBatch(entry, newId());
        if (!batch || batch.ops.length === 0) {
            console.info('[MapStudio] Revert is not offered for change ' + seq + '.');
            return false;
        }
        if (this.undoStack.pending !== null || this.touchesBusy(batch)) {
            console.info('[MapStudio] Revert waits: a save of its items is in flight.');
            return false;
        }
        // The undo step names the row as it reads ("Reverted ..." included).
        const sentence = rowSentence(entry, this.history.entries, this.lists.kinds, browserLocale(), kpiLabelsOf(this.changes.state.kindSetups));
        this.revertBatches.add(batch.batchId);
        this.sendBatch(batch, batch.ops[0].id, revertLabel(sentence));
        return true;
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
        if (reply.kind === 'edits.history.reply' || (reply.kind === 'error'
            && (reply.id === this.historyFirstId || reply.id === this.historyOlderId))) {
            if (reply.id === this.historyFirstId || reply.id === this.historyOlderId) {
                this.onHistoryReply(reply);
            } else {
                console.info('[MapStudio] An edits.history.reply that nothing waits for was ignored.');
            }
            return;
        }
        if (reply.kind === 'tags.resolve.reply' || (reply.kind === 'error' && this.resolveAsks.has(reply.id))) {
            this.onResolveReply(reply);
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
            // The store answered: a pause from a save answered store-unreachable ends (entry 10).
            this.savePaused = false;
            this.itemsRevision++;
            this.store = storeStateFromLoad(reply.body);
            // A kind setup that moved on across a reload (a gap) is another editor's as far as this page can tell (entry 12a).
            const heldSetups = this.changes.loadedOnce ? this.changes.state.kindSetups : null;
            // May send one more map.load (a gap among the changes held during the load).
            this.changes.loaded(reply.body);
            if (heldSetups !== null) {
                for (const now of this.changes.state.kindSetups) {
                    const held = heldSetups.find((k) => k.kindId === now.kindId);
                    if (now.version > (held ? held.version : 0)) {
                        this.kindForeign.set(now.kindId, Math.max(this.kindForeign.get(now.kindId) || 0, now.version));
                    }
                }
            }
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
        if (this.historyOpen) {
            // Recent changes live while History is open (entry 11b): the first page again, merged by seq.
            this.askHistoryFirst();
        }
        if (body && !this.kindBatches.has(body.batchId)) {
            // A kind setup another editor (or a script, or another tab) saved (entry 12a): a field typed before it meets the conflict.
            for (const op of body.ops) {
                if (op.entity !== 'kindSetup') {
                    continue;
                }
                if (op.op === 'delete' || (op.record as { deleted?: unknown }).deleted === true) {
                    // A setup deleted while the page is open: its version is the tombstone the next save from the screen restores
                    // at (a create there), not a version that blocks it.
                    this.kindTombstones.set(op.id, Math.max(this.kindTombstones.get(op.id) || 0, op.version));
                } else {
                    this.kindTombstones.delete(op.id);
                    this.kindForeign.set(op.id, Math.max(this.kindForeign.get(op.id) || 0, op.version));
                }
            }
        }
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
            : this.sender.onError(reply.id, reasonFromError(reply.body), reply.body.conflicts || []);
        console.info('[MapStudio] ' + replyText(reply));
        if (outcome.kind === 'ignored') {
            console.info('[MapStudio] The save reply ' + reply.id + ' changes nothing (an earlier send, or discarded).');
            return;
        }
        const shown = outcome.batchId === this.saveBatchId && this.save.state !== 'idle';
        if (reply.kind === 'edits.apply.reply' && outcome.kind === 'saved') {
            // A save reached the store: a pause from a save answered store-unreachable ends (entry 10).
            this.savePaused = false;
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
            // A kind setup save (entry 12a): the stored setup takes the reply's version, and the kind's next edit goes on top of it.
            this.kindSaved(reply.body.batchId, reply.body.results);
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
            // An item's override (entry 12c1), read before its batch is let go.
            const overrideEdit = outcome.kind === 'failed' ? this.overrideEditOf(outcome.batchId) : null;
            if (outcome.kind === 'failed' && !isTransient(outcome.reason.code)) {
                // After the refusal is on the save status: a geometry change waiting on it goes now (entry 5) and says Saving...
                this.giveUp(outcome.batchId);
            }
            if (outcome.kind === 'failed') {
                // A kind setup save (entry 12a): an invalid one leaves the queue, its words beside the field; the rest is entry 10's.
                this.kindRefused(outcome.batchId, reply.body, isTransient(outcome.reason.code));
                // An item's override (entry 12c1): an invalid one leaves the queue too, its words beside the row's field.
                this.overrideRefused(outcome.batchId, overrideEdit, reply.body, isTransient(outcome.reason.code));
            }
            this.store = storeStateFromSaveError(this.store, reply.body);
            if (outcome.kind === 'failed' && !(reply.body.code === ErrorCodes.STORE_UNREACHABLE && !isBusy(reply.body)) && this.savePaused) {
                // Any other answer (a conflict, invalid, role, read-only, busy) came from the store's side: the pause ends, so the
                // conflict card is not hidden under the unreachable one (entry 10).
                this.savePaused = false;
            }
            if (outcome.kind === 'failed' && reply.body.code === ErrorCodes.STORE_UNREACHABLE && !isBusy(reply.body)) {
                // The store is out of reach for saves (entry 10, R4, decision 4: a lost connection is not this): the tools and
                // Undo pause, the items and the live values stay, the queue replays every 15 s until a save or a load succeeds.
                if (!this.savePaused) {
                    console.info('[MapStudio] A save was answered store-unreachable: editing is paused until the store answers.');
                }
                this.savePaused = true;
            }
        }
        this.notify();
    }
}
