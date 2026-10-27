package com.aoindustrial.perspective.mapstudio.gateway.change;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import java.util.function.LongSupplier;

import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.util.LoggerEx;

import com.aoindustrial.perspective.mapstudio.gateway.write.ChangeHook;

/**
 * The in-process change bus (AD-17): the change hook of the write service. Each
 * committed batch, from a browser or {@code system.mapstudio.applyEdits}, becomes
 * one {@link ChangeEvent} delivered to every subscriber of that project (the open
 * Map Studio delegates), in {@code seq} order.
 *
 * <p>Threads: {@link #onCommitted} only builds the body and hands it to the bus's
 * own single thread, so it never blocks the saver and never runs inside the write
 * transaction. All ordering state is touched only on that thread.
 *
 * <p>Order: commits of one project are serialised by the {@code mapstudio_project}
 * row lock, but the hook runs after commit on the caller's thread, so seq 7's hook
 * can run before seq 6's. The bus holds an event that arrives ahead of a missing
 * seq for up to {@link #HOLD_MILLIS}; a seq that never arrives (a crash between
 * commit and hook) is then skipped and browsers reload on the gap. The next
 * expected seq of a project is taken from its first event after start.
 *
 * <p>One failing subscriber never stops delivery to the others: its exception is
 * logged at debug and the next subscriber is served.
 */
public final class ChangeBus implements ChangeHook, AutoCloseable {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.changes");

    /** How long an event ahead of a missing seq waits for it. */
    public static final long HOLD_MILLIS = 2000;

    /** Runs a task once after a delay, on the bus's thread. */
    @FunctionalInterface
    public interface Timer {
        void schedule(Runnable task, long delayMillis);
    }

    /** A subscription: run it to unsubscribe. Safe to run more than once. */
    @FunctionalInterface
    public interface Subscription {
        void cancel();
    }

    private static final class Order {
        Long next;
        final TreeMap<Long, ChangeEvent> pending = new TreeMap<>();
        /** Clock time the current gap at {@code next} started being held, or -1. */
        long holdSince = -1;
    }

    private final Executor executor;
    private final Timer timer;
    private final LongSupplier clockMillis;
    private final Runnable onClose;
    private final Map<String, Set<Consumer<JsonObject>>> subscribers = new ConcurrentHashMap<>();
    /** Per project ordering state; only on the bus thread. */
    private final Map<String, Order> orders = new HashMap<>();

    /**
     * A bus over an explicit executor, timer and clock (tests pass direct ones).
     * The executor must run tasks one at a time, in submission order, and the
     * timer must run its tasks on that same executor.
     */
    public ChangeBus(Executor executor, Timer timer, LongSupplier clockMillis, Runnable onClose) {
        this.executor = executor;
        this.timer = timer;
        this.clockMillis = clockMillis;
        this.onClose = onClose;
    }

    /** The bus the module runs: one daemon thread, which also runs the hold timer. */
    public static ChangeBus start(ScheduledExecutorService thread) {
        return new ChangeBus(thread, (task, delay) -> thread.schedule(task, delay, TimeUnit.MILLISECONDS),
            () -> System.nanoTime() / 1_000_000L, thread::shutdownNow);
    }

    /** Deliver every committed batch of {@code project} to {@code subscriber} until cancelled. */
    public Subscription subscribe(String project, Consumer<JsonObject> subscriber) {
        subscribers.computeIfAbsent(project, p -> new CopyOnWriteArraySet<>()).add(subscriber);
        return () -> {
            Set<Consumer<JsonObject>> set = subscribers.get(project);
            if (set != null) {
                set.remove(subscriber);
            }
        };
    }

    /** How many subscribers {@code project} has now. */
    public int subscriberCount(String project) {
        Set<Consumer<JsonObject>> set = subscribers.get(project);
        return set == null ? 0 : set.size();
    }

    @Override
    public void onCommitted(CommittedBatch batch) {
        ChangeEvent event = ChangeEvent.of(batch);
        try {
            executor.execute(() -> accept(event));
        } catch (RejectedExecutionException ex) {
            log.debugf("Change of project %s seq %d not delivered: the change bus is stopped.", event.project(),
                event.seq());
        }
    }

    private void accept(ChangeEvent event) {
        Order o = orders.computeIfAbsent(event.project(), p -> new Order());
        if (o.next == null) {
            o.next = event.seq();
        }
        if (event.seq() < o.next) {
            // Late (after its gap was skipped) or repeated: browsers ignore seqs they have.
            deliver(event);
            return;
        }
        o.pending.put(event.seq(), event);
        boolean moved = flush(o);
        hold(event.project(), o, moved);
    }

    /** Deliver the pending events from {@code next} on while they are consecutive; true when any went. */
    private boolean flush(Order o) {
        boolean moved = false;
        ChangeEvent e;
        while ((e = o.pending.remove(o.next)) != null) {
            deliver(e);
            o.next = o.next + 1;
            moved = true;
        }
        return moved;
    }

    /** Start (or restart, after progress) the hold of the gap at {@code next} when events wait behind it. */
    private void hold(String project, Order o, boolean moved) {
        if (o.pending.isEmpty()) {
            o.holdSince = -1;
            return;
        }
        if (o.holdSince < 0 || moved) {
            o.holdSince = clockMillis.getAsLong();
            log.debugf("Project %s: holding seq %d onward for seq %d (up to %d ms).", project, o.pending.firstKey(),
                o.next, HOLD_MILLIS);
            timer.schedule(() -> expire(project), HOLD_MILLIS);
        }
    }

    private void expire(String project) {
        Order o = orders.get(project);
        if (o == null || o.pending.isEmpty() || o.holdSince < 0) {
            return;
        }
        long waited = clockMillis.getAsLong() - o.holdSince;
        if (waited < HOLD_MILLIS) {
            // A timer from an earlier hold, or one that fired early: check again when this hold ends.
            timer.schedule(() -> expire(project), HOLD_MILLIS - waited);
            return;
        }
        long first = o.pending.firstKey();
        log.debugf("Project %s: seq %d to %d never reached the change bus; sending seq %d, browsers reload on the gap.",
            project, o.next, first - 1, first);
        o.next = first;
        o.holdSince = -1;
        boolean moved = flush(o);
        hold(project, o, moved);
    }

    private void deliver(ChangeEvent event) {
        Set<Consumer<JsonObject>> set = subscribers.get(event.project());
        if (set == null || set.isEmpty()) {
            return;
        }
        for (Consumer<JsonObject> subscriber : set) {
            try {
                subscriber.accept(event.body());
            } catch (RuntimeException ex) {
                log.debugf("Project %s seq %d: one open map could not be sent the change (%s).", event.project(),
                    event.seq(), ex.getClass().getSimpleName());
            }
        }
    }

    @Override
    public void close() {
        subscribers.clear();
        onClose.run();
    }
}
