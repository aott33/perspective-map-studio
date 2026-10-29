package com.aoindustrial.perspective.mapstudio.gateway.live;

import java.util.Set;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.util.LoggerEx;

/**
 * One open map's share of the live values (AD-6, AD-7, epic 3 entry 5): after each
 * {@code map.load.reply} a full {@code values.batch} at once, then one changes-only batch per
 * refresh interval while something changed (full again after a plan rebuild); and, while the
 * map's popup is open ({@code popup.open} to {@code popup.close}), that item's values pushed within
 * {@link #PUSH_DELAY_MS} of a change. Every batch body goes to {@code send}, which the delegate
 * queues on the session (as it does for {@code map.changed}). All timers run on the cache's live
 * thread; the state here is touched only there and on the delegate's event thread.
 */
public final class LiveSession {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.live");

    /** A popup's pushes are at most this far apart. */
    public static final long PUSH_DELAY_MS = 250;

    private final LiveValueCache cache;
    private final ScheduledExecutorService live;
    private final String project;
    private final Consumer<JsonObject> send;
    private volatile long lastSeq = -1;
    private volatile ScheduledFuture<?> timer;
    private volatile String popupItem;
    /** The items the open popup follows: the item and, for a line, its instruments (entry 2). */
    private volatile Set<String> popupItems = Set.of();
    private volatile LiveValueCache.Subscription popup;
    private volatile ScheduledFuture<?> push;

    public LiveSession(LiveValueCache cache, ScheduledExecutorService live, String project, Consumer<JsonObject> send) {
        this.cache = cache;
        this.live = live;
        this.project = project;
        this.send = send;
    }

    /** The map loaded (or reloaded): a full batch now, then every {@code intervalSeconds}. */
    public void loaded(int intervalSeconds) {
        stopTimer();
        lastSeq = -1;
        cache.ensure(project);
        try {
            timer = live.scheduleWithFixedDelay(this::tick, 0, Math.max(1, intervalSeconds), TimeUnit.SECONDS);
        } catch (RejectedExecutionException ex) {
            log.debugf("Project %s: no live batches, the module is stopping.", project);
        }
    }

    private void tick() {
        try {
            cache.checkAssets(project);
            LiveValueCache.Batch batch = cache.batch(project, lastSeq);
            if (batch == null) {
                return;
            }
            lastSeq = batch.seq();
            send.accept(batch.body());
        } catch (RuntimeException ex) {
            log.warn("A live batch could not be sent: " + ex.getClass().getSimpleName(), ex);
        }
    }

    /**
     * The browser opened the popup of {@code itemId}: push its values now, with the popup detail
     * (the base path, the alarms path and the alarm summary; epic 3 entry 8), then on every change;
     * for a line, the values of every instrument attached to it too (AD-7, entry 2).
     */
    public void popupOpen(String itemId) {
        popupClose();
        popupItem = itemId;
        popupItems = cache.popupItems(project, itemId);
        popup = cache.onItemsChange(project, popupItems, this::schedulePush);
        schedulePush(0);
    }

    /** The browser closed the popup. */
    public void popupClose() {
        LiveValueCache.Subscription s = popup;
        popup = null;
        popupItem = null;
        popupItems = Set.of();
        if (s != null) {
            s.cancel();
        }
        ScheduledFuture<?> p = push;
        push = null;
        if (p != null) {
            p.cancel(false);
        }
    }

    private void schedulePush() {
        schedulePush(PUSH_DELAY_MS);
    }

    private void schedulePush(long delayMs) {
        if (push != null && !push.isDone()) {
            return;
        }
        try {
            push = live.schedule(this::pushPopup, delayMs, TimeUnit.MILLISECONDS);
        } catch (RejectedExecutionException ex) {
            log.debugf("Project %s: no popup push, the module is stopping.", project);
        }
    }

    private void pushPopup() {
        String item = popupItem;
        Set<String> items = popupItems;
        if (item == null || items.isEmpty()) {
            return;
        }
        try {
            LiveValueCache.Batch batch = cache.itemsBatch(project, items, item);
            if (batch != null) {
                send.accept(batch.body());
            }
        } catch (RuntimeException ex) {
            log.warn("A popup's values could not be sent: " + ex.getClass().getSimpleName(), ex);
        }
    }

    /** The map closed: no more batches. */
    public void stop() {
        stopTimer();
        popupClose();
    }

    private void stopTimer() {
        ScheduledFuture<?> t = timer;
        timer = null;
        if (t != null) {
            t.cancel(false);
        }
    }

    /** The item whose popup is open, or null (tests). */
    public String popupItem() {
        return popupItem;
    }

    /** The sequence of the last batch sent, -1 before the first (tests). */
    public long lastSeq() {
        return lastSeq;
    }
}
