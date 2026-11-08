package com.aoindustrial.perspective.mapstudio.gateway.setuplookup;

import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.Semaphore;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/**
 * Threads for the setup lookups and the limit on them: a {@link Semaphore} with one permit per
 * thread. A call takes a permit before it is handed to the executor and gives it back as the
 * call ends, so a list is unavailable only when every permit is held by a running call. The
 * executor queues, so a call never fails for a thread that is still on its way back to the pool
 * (the race behind the flaky {@code SetupLookupsTest}, 2026-11-08); the permits keep that queue
 * no longer than the pool.
 */
public final class LookupPool {

    private final ThreadPoolExecutor executor;
    private final Semaphore permits;
    private final int size;

    /** {@code threads} daemon threads named {@code name}, idle ones let go after 30 s. */
    public LookupPool(int threads, String name) {
        this(daemonExecutor(threads, name), threads);
    }

    /** Over a given executor (tests): it must queue rather than reject while it has fewer than {@code threads} tasks. */
    LookupPool(ThreadPoolExecutor executor, int threads) {
        this.executor = executor;
        this.permits = new Semaphore(threads);
        this.size = threads;
    }

    private static ThreadPoolExecutor daemonExecutor(int threads, String name) {
        ThreadPoolExecutor ex = new ThreadPoolExecutor(threads, threads, 30, TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(), r -> {
                Thread t = new Thread(r, name);
                t.setDaemon(true);
                return t;
            });
        ex.allowCoreThreadTimeOut(true);
        return ex;
    }

    /** A permit if one is free now; false when every permit is held by a running call. */
    boolean tryAcquire() {
        return permits.tryAcquire();
    }

    void release() {
        permits.release();
    }

    ThreadPoolExecutor executor() {
        return executor;
    }

    /** Calls holding a permit now (tests). */
    int inUse() {
        return size - permits.availablePermits();
    }

    public void shutdownNow() {
        executor.shutdownNow();
    }
}
