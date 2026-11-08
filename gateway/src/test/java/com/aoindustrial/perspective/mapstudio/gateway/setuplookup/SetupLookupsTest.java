package com.aoindustrial.perspective.mapstudio.gateway.setuplookup;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import com.aoindustrial.perspective.mapstudio.common.contract.SetupLists;
import com.aoindustrial.perspective.mapstudio.common.contract.SetupLists.Status;

class SetupLookupsTest {

    private final LookupPool pool = new LookupPool(8, "test-setup-lookups");
    private final CountDownLatch never = new CountDownLatch(1);

    @AfterEach
    void stop() {
        never.countDown();
        pool.shutdownNow();
    }

    /** A Gateway with two connections, the default user source, one secret provider with two names. */
    private class Fake implements LookupSource {
        boolean connectionsFail;
        boolean connectionsHang;
        boolean providersHang;
        boolean namesFail;
        String namesHang;
        final java.util.concurrent.atomic.AtomicInteger namesAsked = new java.util.concurrent.atomic.AtomicInteger();
        String askedIdp;

        @Override
        public List<SetupLists.Entry> connections() throws Exception {
            while (connectionsHang && never.getCount() > 0) {
                try {
                    // A provider that ignores the cancel and keeps its thread.
                    never.await();
                } catch (InterruptedException ignored) {
                    // keep holding the thread
                }
            }
            if (connectionsFail) {
                throw new IllegalStateException("datasource manager down");
            }
            return List.of(new SetupLists.Entry("mes", "MSSQL"), new SetupLists.Entry("MapStudio", "POSTGRES"));
        }

        @Override
        public Optional<List<String>> roles(String identityProvider) {
            askedIdp = identityProvider;
            return identityProvider.equals("default")
                ? Optional.of(List.of("MapOperator", "Administrator", "MapEditor", "MapEditor")) : Optional.empty();
        }

        @Override
        public List<String> secretProviders() throws Exception {
            if (providersHang) {
                never.await();
            }
            return List.of("Internal");
        }

        @Override
        public Optional<List<String>> secretNames(String provider) {
            namesAsked.incrementAndGet();
            while (provider.equals(namesHang) && never.getCount() > 0) {
                try {
                    // A provider whose list() ignores the cancel and keeps its thread.
                    never.await();
                } catch (InterruptedException ignored) {
                    // keep holding the thread
                }
            }
            if (namesFail) {
                throw new UnsupportedOperationException("cannot list");
            }
            return provider.equals("Internal") ? Optional.of(List.of("mapbox-token", "api-key")) : Optional.empty();
        }
    }

    private SetupLookups lookups(Fake fake, boolean designer, long timeoutMs) {
        return new SetupLookups(fake, pool, pool, () -> designer, timeoutMs);
    }

    @Test
    void listsAnswerNamesSortedWithTheConnectionType() {
        SetupLists lists = SetupLists.fromJson(lookups(new Fake(), true, 2000).lists("default"));
        assertEquals(Status.OK, lists.connections().status());
        assertEquals(List.of("MapStudio", "mes"), lists.connections().names());
        assertEquals("POSTGRES", lists.connections().entries().get(0).detail());
        assertEquals(List.of("Administrator", "MapEditor", "MapOperator"), lists.roles().names());
        assertEquals(List.of("Internal"), lists.secretProviders().names());
    }

    @Test
    void aBlankIdentityProviderAsksForDefault() {
        Fake fake = new Fake();
        lookups(fake, true, 2000).lists(" ");
        assertEquals("default", fake.askedIdp);
    }

    @Test
    void anIdentityProviderWithoutAUserSourceIsNotListed() {
        SetupLists lists = SetupLists.fromJson(lookups(new Fake(), true, 2000).lists("okta"));
        assertEquals(Status.NOT_LISTED, lists.roles().status());
        assertTrue(lists.roles().entries().isEmpty());
        assertEquals(Status.OK, lists.connections().status());
    }

    @Test
    void aFailingListIsUnavailableAndTheOthersStillAnswer() {
        Fake fake = new Fake();
        fake.connectionsFail = true;
        SetupLists lists = SetupLists.fromJson(lookups(fake, true, 2000).lists("default"));
        assertEquals(Status.UNAVAILABLE, lists.connections().status());
        assertEquals(SetupLookups.FAILED, lists.connections().reason());
        assertEquals(Status.OK, lists.roles().status());
        assertEquals(Status.OK, lists.secretProviders().status());
    }

    @Test
    void aSlowProviderIsUnavailableAfterTheDeadlineAndHoldsNothingElse() {
        Fake fake = new Fake();
        fake.providersHang = true;
        long t0 = System.nanoTime();
        SetupLists lists = SetupLists.fromJson(lookups(fake, true, 200).lists("default"));
        long ms = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - t0);
        assertTrue(ms < 2000, "answered after " + ms + " ms");
        assertEquals(Status.UNAVAILABLE, lists.secretProviders().status());
        assertEquals(SetupLookups.UNAVAILABLE, lists.secretProviders().reason());
        assertEquals(Status.OK, lists.connections().status());
        assertEquals(Status.OK, lists.roles().status());
    }

    @Test
    void secretNamesAreNamesOnly() {
        SetupLists.Part part = SetupLists.Part.fromJson(lookups(new Fake(), true, 2000).secretNames("Internal"));
        assertEquals(List.of("api-key", "mapbox-token"), part.names());
    }

    @Test
    void secretNamesOfAProviderThatCannotListAreUnavailable() {
        Fake fake = new Fake();
        fake.namesFail = true;
        SetupLists.Part part = SetupLists.Part.fromJson(lookups(fake, true, 2000).secretNames("Internal"));
        assertEquals(Status.UNAVAILABLE, part.status());
        SetupLists.Part missing = SetupLists.Part.fromJson(lookups(new Fake(), true, 2000).secretNames("Vault"));
        assertEquals(Status.UNAVAILABLE, missing.status());
        assertEquals(SetupLookups.NO_PROVIDER, missing.reason());
    }

    @Test
    void aCallerThatIsNotADesignerIsRefused() {
        SetupLookups refused = lookups(new Fake(), false, 2000);
        SecurityException ex = assertThrows(SecurityException.class, () -> refused.lists("default"));
        assertEquals(SetupLookups.REFUSED, ex.getMessage());
        assertThrows(SecurityException.class, () -> refused.secretNames("Internal"));
    }

    @Test
    void aFullPoolGivesUnavailableListsNotAnError() {
        LookupPool full = new LookupPool(1, "test-full");
        try {
            Fake fake = new Fake();
            fake.connectionsHang = true;
            // The first call's connection list holds the one thread past its deadline.
            new SetupLookups(fake, full, full, () -> true, 100).lists("default");
            SetupLists second = SetupLists.fromJson(
                new SetupLookups(new Fake(), full, full, () -> true, 100).lists("default"));
            assertEquals(Status.UNAVAILABLE, second.connections().status());
        } finally {
            never.countDown();
            full.shutdownNow();
        }
    }

    @Test
    void aHungSecretProviderHoldsOneThreadAndNeverTheOtherLists() {
        // The hook's shape: a small lists pool and a small secret names pool, each limited by its permits.
        LookupPool lists = new LookupPool(3, "test-lists");
        LookupPool secrets = new LookupPool(2, "test-secrets");
        try {
            Fake fake = new Fake();
            fake.namesHang = "Vault";
            // Two timeouts over the same pools and source: the hung provider's asks give up after
            // 50 ms (ten of them, so the test stays short), while the healthy lists get the
            // production timeout to answer in, which a busy shared runner meets (a 50 ms limit
            // failed once on CI, PR #30). What is proven is unchanged: the hung call holds one
            // secrets thread and the other lists still answer OK beside it.
            SetupLookups lookups = new SetupLookups(fake, lists, secrets, () -> true, 50);
            SetupLookups healthy = new SetupLookups(fake, lists, secrets, () -> true, SetupLookups.TIMEOUT_MS);
            for (int i = 0; i < 10; i++) {
                SetupLists.Part hung = SetupLists.Part.fromJson(lookups.secretNames("Vault"));
                assertEquals(Status.UNAVAILABLE, hung.status());
                assertEquals(SetupLookups.UNAVAILABLE, hung.reason());
            }
            // Ten asks, one call: the later asks waited on the one in flight.
            assertEquals(1, fake.namesAsked.get());
            assertEquals(1, secrets.inUse());
            assertEquals(List.of("api-key", "mapbox-token"),
                SetupLists.Part.fromJson(healthy.secretNames("Internal")).names());
            for (int i = 0; i < 10; i++) {
                SetupLists all = SetupLists.fromJson(healthy.lists("default"));
                assertEquals(Status.OK, all.connections().status());
                assertEquals(Status.OK, all.roles().status());
                assertEquals(Status.OK, all.secretProviders().status());
            }
            // The hung call was never asked again: two calls in all, it and the one "Internal" ask.
            assertEquals(2, fake.namesAsked.get());
        } finally {
            never.countDown();
            lists.shutdownNow();
            secrets.shutdownNow();
        }
    }

    @Test
    void aHungListIsAskedOnceWhileInFlight() {
        LookupPool lists = new LookupPool(3, "test-lists");
        try {
            Fake fake = new Fake();
            fake.connectionsHang = true;
            SetupLookups lookups = new SetupLookups(fake, lists, pool, () -> true, 50);
            for (int i = 0; i < 6; i++) {
                SetupLists all = SetupLists.fromJson(lookups.lists("default"));
                assertEquals(Status.UNAVAILABLE, all.connections().status());
                assertEquals(Status.OK, all.roles().status());
                assertEquals(Status.OK, all.secretProviders().status());
            }
            assertEquals(1, lookups.inFlightForTests());
        } finally {
            never.countDown();
            lists.shutdownNow();
        }
    }

    /**
     * A pool whose worker is slow to come back: after each call the worker waits until the
     * caller's next call has been handed to the executor (up to a second), as a busy machine can
     * leave it. A call that completes its future before the worker is back waiting for work used to
     * find no idle thread and come back UNAVAILABLE though nothing was slow (2026-11-08).
     */
    private static final class SlowReturningExecutor extends ThreadPoolExecutor {
        private final AtomicInteger handed = new AtomicInteger();
        private final AtomicInteger finished = new AtomicInteger();

        SlowReturningExecutor(int threads) {
            super(threads, threads, 1, TimeUnit.SECONDS, new LinkedBlockingQueue<>());
        }

        @Override
        public void execute(Runnable command) {
            try {
                super.execute(command);
            } finally {
                synchronized (this) {
                    handed.incrementAndGet();
                    notifyAll();
                }
            }
        }

        @Override
        protected void afterExecute(Runnable r, Throwable t) {
            int done = finished.incrementAndGet();
            long until = System.nanoTime() + TimeUnit.SECONDS.toNanos(1);
            synchronized (this) {
                while (handed.get() <= done && System.nanoTime() < until && !isShutdown()) {
                    try {
                        wait(Math.max(1, TimeUnit.NANOSECONDS.toMillis(until - System.nanoTime())));
                    } catch (InterruptedException ex) {
                        Thread.currentThread().interrupt();
                        return;
                    }
                }
            }
        }
    }

    @Test
    void backToBackCallsAtFullCapacityAllAnswer() {
        // One thread, one permit: each ask needs the whole pool, and the next ask comes while the
        // worker of the last one has not yet gone back to wait for work.
        SlowReturningExecutor slow = new SlowReturningExecutor(1);
        LookupPool one = new LookupPool(slow, 1);
        try {
            SetupLookups lookups = new SetupLookups(new Fake(), one, one, () -> true, SetupLookups.TIMEOUT_MS);
            for (int i = 0; i < 20; i++) {
                SetupLists.Part part = SetupLists.Part.fromJson(lookups.secretNames("Internal"));
                assertEquals(Status.OK, part.status(), "ask " + i);
                assertEquals(List.of("api-key", "mapbox-token"), part.names());
            }
            assertEquals(0, lookups.inFlightForTests());
        } finally {
            slow.shutdownNow();
        }
    }

    @Test
    void outsideAnRpcCallTheDesignerCheckIsFalse() {
        assertEquals(false, new DesignerCaller().getAsBoolean());
    }
}
