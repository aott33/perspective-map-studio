/**
 * How the map sends the unsaved queue (epic 2 story 8; docs/contract.md "Unsaved edits in
 * the browser"): the 15 s reply timer, late replies, the replay chain and its level gate,
 * and a `storage` event from another tab. Pulled out of MapStudioStoreDelegate so Jest can
 * drive it with fake timers; the host fires the message and says the level and the
 * connection, and the delegate keeps the save status, the store state and the items.
 */

import { EditBatch, EditLevel } from './contract';
import { Envelope, editsApply } from './messages';
import {
    LocalReasons, REPLAY_INTERVAL_MS, REPLY_TIMEOUT_MS, UnsavedEntry, UnsavedQueue, UnsavedReason, isTransient
} from './unsaved';

export interface SenderHost {
    /** The level map.load reported, or null before it answered (or after a failed load). */
    level(): EditLevel | null;
    /** Whether the client is connected to the Gateway; true when it cannot be read. */
    connected(): boolean;
    /** Fire one edits.apply envelope; a throw means it was not sent. */
    fire(message: Envelope<EditBatch>): void;
    /** The queue, or which batch is in flight, changed: redraw. */
    changed(): void;
    /** A batch got no answer or could not be sent; it stays unsent with this reason. */
    unsent(batchId: string, reason: UnsavedReason): void;
}

/** What an answer to edits.apply did to the queue. */
export type ReplyOutcome =
    /** Not this tab's send, an earlier send's refusal while a newer one waits, or a discarded batch. */
    | { kind: 'ignored' }
    /** Saved: `entry` is the queued entry it removed, or undefined when none was left (another tab). */
    | { kind: 'saved'; batchId: string; entry: UnsavedEntry | undefined }
    /** Refused: the entry, now unsent (transient code) or refused (final code), with the reason. */
    | { kind: 'failed'; batchId: string; entry: UnsavedEntry; reason: UnsavedReason };

export class UnsavedSender {
    /** batchId -> the edits.apply message this tab is waiting on for it, and its reply timer. */
    private inFlight = new Map<string, { messageId: string; timer: ReturnType<typeof setTimeout> }>();
    /** edits.apply message id -> its batchId, kept after a timeout so a late reply still counts. */
    private sentMessages = new Map<string, string>();
    private replayTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(readonly queue: UnsavedQueue, private readonly host: SenderHost) {
    }

    /** Queue a new batch and send it at once, at any level (the Gateway decides the role). */
    enqueueAndSend(batch: EditBatch, now: Date): void {
        this.queue.enqueue(batch, now);
        this.host.changed();
        this.send(batch.batchId);
    }

    /** Whether this tab waits on a reply for the batch (Discard is off meanwhile). */
    isSending(batchId: string): boolean {
        return this.inFlight.has(batchId);
    }

    /** The batches this tab waits on, for the component. */
    sending(): string[] {
        return Array.from(this.inFlight.keys());
    }

    /** Whether an error reply with this id answers one of this tab's sends. */
    owns(messageId: string): boolean {
        return this.sentMessages.has(messageId);
    }

    /** Try again: a refused entry becomes unsent and the queue replays now. */
    retry(batchId: string): void {
        this.queue.retry(batchId);
        this.host.changed();
        this.replayNext();
        this.scheduleReplay();
    }

    /**
     * Discard: the entry leaves storage and the map and is never sent again. Refused (false)
     * while the batch is in flight here, since the Gateway may still commit it; a later
     * answer to an earlier send of it is ignored.
     */
    discard(batchId: string): boolean {
        if (this.inFlight.has(batchId)) {
            return false;
        }
        this.forget(batchId);
        this.queue.discard(batchId);
        this.host.changed();
        this.replayNext();
        return true;
    }

    /** A `storage` event for `key` (null: storage cleared): another tab may have changed the queue. */
    storage(key: string | null): void {
        if (key !== null && key !== this.queue.storageKey) {
            return;
        }
        if (this.queue.refresh()) {
            for (const [batchId, flight] of Array.from(this.inFlight.entries())) {
                if (!this.queue.get(batchId)) {
                    clearTimeout(flight.timer);
                    this.inFlight.delete(batchId);
                }
            }
            this.host.changed();
        }
    }

    /** map.load answered or map.changed arrived: replay the next entry and keep the timer going. */
    replay(): void {
        this.replayNext();
        this.scheduleReplay();
    }

    /** Stop every timer (the component unmounted). */
    stop(): void {
        if (this.replayTimer !== null) {
            clearTimeout(this.replayTimer);
            this.replayTimer = null;
        }
        for (const flight of Array.from(this.inFlight.values())) {
            clearTimeout(flight.timer);
        }
        this.inFlight.clear();
    }

    /** An edits.apply.reply: the batch is saved, whichever send it answers. */
    onSaved(messageId: string, batchId: string): ReplyOutcome {
        this.sentMessages.delete(messageId);
        this.clearFlight(batchId);
        this.queue.refresh();
        const entry = this.queue.get(batchId);
        this.queue.saved(batchId);
        this.forget(batchId);
        this.host.changed();
        this.replayNext();
        return { kind: 'saved', batchId, entry };
    }

    /** An error reply to one of this tab's sends. */
    onError(messageId: string, reason: UnsavedReason): ReplyOutcome {
        const batchId = this.sentMessages.get(messageId);
        if (batchId === undefined) {
            return { kind: 'ignored' };
        }
        this.sentMessages.delete(messageId);
        const flight = this.inFlight.get(batchId);
        if (flight && flight.messageId !== messageId) {
            // A late refusal of an earlier send; the newer send of the same batch decides.
            return { kind: 'ignored' };
        }
        this.clearFlight(batchId);
        this.queue.refresh();
        if (!this.queue.get(batchId)) {
            // Discarded (here or in another tab) or saved meanwhile: nothing left to mark.
            this.host.changed();
            return { kind: 'ignored' };
        }
        this.queue.failed(batchId, reason);
        this.host.changed();
        if (isTransient(reason.code)) {
            this.scheduleReplay();
        } else {
            this.replayNext();
        }
        return { kind: 'failed', batchId, entry: this.queue.get(batchId) as UnsavedEntry, reason };
    }

    /**
     * Replays run only at level phone or full, after map.load answered (docs/contract.md);
     * with no storage key (no project name) the entries in memory are replayed all the same.
     */
    private canReplay(): boolean {
        const level = this.host.level();
        return level === 'phone' || level === 'full';
    }

    /** Replay the oldest unsent entry, one batch at a time. */
    private replayNext(): void {
        if (!this.canReplay() || this.inFlight.size > 0) {
            return;
        }
        const next = this.queue.nextToReplay(new Set(this.inFlight.keys()));
        if (next) {
            this.send(next.batchId);
        }
    }

    /** Re-arm the 15 s replay timer while unsent entries remain. */
    private scheduleReplay(): void {
        if (this.replayTimer !== null || !this.queue.hasUnsent()) {
            return;
        }
        this.replayTimer = setTimeout(() => {
            this.replayTimer = null;
            if (this.queue.refresh()) {
                this.host.changed();
            }
            this.replayNext();
            this.scheduleReplay();
        }, REPLAY_INTERVAL_MS);
    }

    /** Send one queued batch exactly as stored (same batchId, ops and baseVersions). */
    private send(batchId: string): void {
        const entry = this.queue.get(batchId);
        if (!entry) {
            this.host.changed();
            return;
        }
        if (!this.host.connected()) {
            this.unsent(batchId, { code: LocalReasons.DISCONNECTED, message: 'The browser is not connected to the Gateway.' });
            return;
        }
        const message = editsApply(entry.batch);
        const timer = setTimeout(() => this.onReplyTimeout(batchId, message.id), REPLY_TIMEOUT_MS);
        this.inFlight.set(batchId, { messageId: message.id, timer });
        this.sentMessages.set(message.id, batchId);
        this.host.changed();
        try {
            this.host.fire(message);
        } catch (err) {
            clearTimeout(timer);
            this.inFlight.delete(batchId);
            this.sentMessages.delete(message.id);
            this.unsent(batchId, { code: LocalReasons.DISCONNECTED, message: 'The message could not be sent.' });
        }
    }

    private onReplyTimeout(batchId: string, messageId: string): void {
        const flight = this.inFlight.get(batchId);
        if (!flight || flight.messageId !== messageId) {
            return;
        }
        this.inFlight.delete(batchId);
        if (this.queue.get(batchId)) {
            this.unsent(batchId, {
                code: LocalReasons.TIMEOUT,
                message: 'No answer from the Gateway within ' + REPLY_TIMEOUT_MS / 1000 + ' s.'
            });
        } else {
            this.host.changed();
        }
    }

    /** No answer, or not connected: the entry stays unsent and the timer replays it. */
    private unsent(batchId: string, reason: UnsavedReason): void {
        this.queue.failed(batchId, reason);
        this.host.unsent(batchId, reason);
        this.host.changed();
        this.scheduleReplay();
    }

    private clearFlight(batchId: string): void {
        const flight = this.inFlight.get(batchId);
        if (flight) {
            clearTimeout(flight.timer);
            this.inFlight.delete(batchId);
        }
    }

    /** Drop every message id of the batch, so no later answer to it counts. */
    private forget(batchId: string): void {
        for (const [messageId, id] of Array.from(this.sentMessages.entries())) {
            if (id === batchId) {
                this.sentMessages.delete(messageId);
            }
        }
    }
}
