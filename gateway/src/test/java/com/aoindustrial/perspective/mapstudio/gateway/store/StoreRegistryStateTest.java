package com.aoindustrial.perspective.mapstudio.gateway.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/**
 * The store states of epic 2 story 5: read only on a newer schema, the lazy
 * retry of an unavailable store, and a standby that only reads. Scheduled steps
 * run by hand and the clock is moved by hand.
 */
class StoreRegistryStateTest {

    final Deque<Runnable> steps = new ArrayDeque<>();
    final AtomicLong clock = new AtomicLong();
    final ScheduledExecutorService real = Executors.newSingleThreadScheduledExecutor();
    final AtomicBoolean mayMigrate = new AtomicBoolean(true);
    final FakeJdbc db = new FakeJdbc();
    int opens;

    @AfterEach
    void tearDown() {
        real.shutdownNow();
    }

    ScheduledExecutorService manual() {
        return (ScheduledExecutorService) java.lang.reflect.Proxy.newProxyInstance(getClass().getClassLoader(),
            new Class<?>[] {ScheduledExecutorService.class}, (proxy, method, args) -> {
                switch (method.getName()) {
                    case "execute" -> steps.add((Runnable) args[0]);
                    case "schedule" -> {
                        steps.add((Runnable) args[0]);
                        return real.schedule(() -> { }, 0, TimeUnit.MILLISECONDS);
                    }
                    default -> throw new UnsupportedOperationException(method.getName());
                }
                return null;
            });
    }

    StoreRegistry registry() {
        ConnectionSource source = new ConnectionSource() {
            public boolean exists(String name) {
                return true;
            }

            public Connection open(String name) {
                opens++;
                return db.connection();
            }
        };
        return new StoreRegistry(source, new Migrator(Migrations.all(), "test"), manual(), clock::get,
            ConnectionWait.INTERVAL, ConnectionWait.MAX, mayMigrate::get, StoreRegistry.RETRY);
    }

    void runAll() {
        while (!steps.isEmpty()) {
            steps.poll().run();
        }
    }

    @Test
    void aNewerSchemaIsReadOnlyAndNothingIsMigrated() {
        db.version = 999;
        StoreRegistry stores = registry();
        stores.ensure("C");
        runAll();
        StoreState state = stores.state("C");
        assertEquals(StoreState.Status.READ_ONLY, state.status());
        assertTrue(state.isReadable());
        assertEquals(FailureLine.newerReason(999, 1), state.reason());
        assertFalse(db.executed.contains(Migrator.LOCK));
        assertFalse(db.executed.stream().anyMatch(s -> s.startsWith("CREATE")), "a newer schema is never altered");
    }

    @Test
    void anUnavailableStoreIsTriedAgainAtMostOncePerMinuteAndHeals() {
        db.failOn = Migrator.CREATE_VERSION_TABLE;
        StoreRegistry stores = registry();
        stores.ensure("C");
        runAll();
        assertEquals(StoreState.Status.UNAVAILABLE, stores.state("C").status());
        int afterFirst = opens;

        clock.addAndGet(Duration.ofSeconds(59).toNanos());
        stores.state("C");
        assertTrue(steps.isEmpty(), "no retry within 60 s");

        db.failOn = null; // the grant is fixed
        clock.addAndGet(Duration.ofSeconds(1).toNanos());
        assertEquals(StoreState.Status.UNAVAILABLE, stores.state("C").status(), "this call still answers unavailable");
        stores.state("C");
        assertEquals(1, steps.size(), "one retry queued, not two");
        runAll();
        assertEquals(afterFirst + 1, opens);
        assertEquals(StoreState.Status.READY, stores.state("C").status());
        assertTrue(steps.isEmpty(), "a ready store is not retried");
    }

    @Test
    void aStandbyReadsTheVersionOnlyAndMigratesWhenActive() {
        mayMigrate.set(false);
        StoreRegistry stores = registry();
        stores.ensure("C");
        runAll();
        StoreState state = stores.state("C");
        assertEquals(StoreState.Status.UNAVAILABLE, state.status());
        assertTrue(state.reason().contains("standby"), state.reason());
        assertEquals(java.util.List.of("SELECT 1", Migrator.VERSION_TABLE_EXISTS), db.executed,
            "the probe, then the version read; no lock, no DDL on a standby");

        mayMigrate.set(true);
        stores.retryNow();
        runAll();
        assertEquals(StoreState.Status.READY, stores.state("C").status());
        assertTrue(db.executed.containsAll(Migrations.all().get(0).statements()));
    }

    @Test
    void aStandbyOnACurrentSchemaIsReady() {
        mayMigrate.set(false);
        db.version = 1;
        StoreRegistry stores = registry();
        stores.ensure("C");
        runAll();
        assertEquals(StoreState.Status.READY, stores.state("C").status(), "reads go ahead; the gate refuses saves");
        assertFalse(db.executed.contains(Migrator.LOCK));
    }
}
