package com.aoindustrial.perspective.mapstudio.gateway.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.SQLException;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** The store registry's states, with the waits run by hand (a queue of scheduled steps and a fake clock). */
class StoreRegistryTest {

    final Deque<Runnable> steps = new ArrayDeque<>();
    final AtomicLong clock = new AtomicLong();
    final ScheduledExecutorService real = Executors.newSingleThreadScheduledExecutor();

    @AfterEach
    void tearDown() {
        real.shutdownNow();
    }

    /** A scheduler whose tasks wait in {@link #steps} until the test runs them. */
    ScheduledExecutorService manual() {
        return (ScheduledExecutorService) java.lang.reflect.Proxy.newProxyInstance(getClass().getClassLoader(),
            new Class<?>[] {ScheduledExecutorService.class}, (proxy, method, args) -> {
                switch (method.getName()) {
                    case "execute" -> steps.add((Runnable) args[0]);
                    case "schedule" -> {
                        steps.add((Runnable) args[0]);
                        clock.addAndGet(((TimeUnit) args[2]).toNanos((Long) args[1]));
                        return real.schedule(() -> { }, 0, TimeUnit.MILLISECONDS);
                    }
                    default -> throw new UnsupportedOperationException(method.getName());
                }
                return null;
            });
    }

    StoreRegistry registry(ConnectionSource source) {
        return new StoreRegistry(source, new Migrator(Migrations.all(), "test"), manual(), clock::get,
            ConnectionWait.INTERVAL, ConnectionWait.MAX);
    }

    void runAll() {
        while (!steps.isEmpty()) {
            steps.poll().run();
        }
    }

    @Test
    void aConnectionTheGatewayDoesNotHaveIsReportedWithoutWaiting() {
        StoreRegistry stores = registry(new ConnectionSource() {
            public boolean exists(String name) {
                return false;
            }

            public Connection open(String name) throws SQLException {
                throw new SQLException("no");
            }
        });
        assertEquals(StoreState.Status.NO_CONNECTION, stores.state("Missing").status());
        assertTrue(steps.isEmpty(), "no wait is started");
    }

    @Test
    void aConnectionThatNeverWorksIsUnavailableAfterTheWait() {
        int[] opens = {0};
        StoreRegistry stores = registry(new ConnectionSource() {
            public boolean exists(String name) {
                return true;
            }

            public Connection open(String name) throws SQLException {
                opens[0]++;
                throw new SQLException("Cannot create PoolableConnectionFactory", "08001");
            }
        });
        stores.ensure("MapStudio");
        assertEquals(StoreState.Status.STARTING, stores.state("MapStudio").status());
        runAll();
        StoreState state = stores.state("MapStudio");
        assertEquals(StoreState.Status.UNAVAILABLE, state.status());
        assertTrue(state.reason().contains("MapStudio"));
        assertEquals(25, opens[0], "every 5 s for 2 minutes, then one last try");
    }

    @Test
    void aConnectionThatBecomesUsableIsMigratedAndReady() {
        FakeJdbc db = new FakeJdbc();
        int[] opens = {0};
        StoreRegistry stores = registry(new ConnectionSource() {
            public boolean exists(String name) {
                return true;
            }

            public Connection open(String name) throws SQLException {
                if (++opens[0] < 3) {
                    throw new SQLException("Driver$1", "08001");
                }
                return db.connection();
            }
        });
        stores.ensure("MapStudio");
        runAll();
        assertEquals(StoreState.Status.READY, stores.state("MapStudio").status());
        assertTrue(db.executed.containsAll(Migrations.all().get(0).statements()));
        stores.ensure("MapStudio");
        assertTrue(steps.isEmpty(), "a ready connection is not waited for or migrated again");
    }

    @Test
    void aMigrationWithoutRightsIsUnavailableWithTheReason() {
        FakeJdbc db = new FakeJdbc();
        db.failOn = Migrator.CREATE_VERSION_TABLE;
        StoreRegistry stores = registry(new ConnectionSource() {
            public boolean exists(String name) {
                return true;
            }

            public Connection open(String name) {
                return db.connection();
            }
        });
        stores.ensure("MapStudioNoRights");
        runAll();
        StoreState state = stores.state("MapStudioNoRights");
        assertEquals(StoreState.Status.UNAVAILABLE, state.status());
        assertTrue(state.reason().contains("lacks the right"));
        assertEquals(Duration.ofSeconds(5), ConnectionWait.INTERVAL);
    }
}
