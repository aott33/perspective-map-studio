package com.aoindustrial.perspective.mapstudio.gateway.setuplookup;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import com.aoindustrial.perspective.mapstudio.common.contract.SetupLists;
import com.aoindustrial.perspective.mapstudio.common.contract.SetupLists.Status;

class SetupLookupsTest {

    private final ExecutorService pool = Executors.newCachedThreadPool();
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
            if (namesFail) {
                throw new UnsupportedOperationException("cannot list");
            }
            return provider.equals("Internal") ? Optional.of(List.of("mapbox-token", "api-key")) : Optional.empty();
        }
    }

    private SetupLookups lookups(Fake fake, boolean designer, long timeoutMs) {
        return new SetupLookups(fake, pool, () -> designer, timeoutMs);
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
        ThreadPoolExecutor full = new ThreadPoolExecutor(0, 1, 1, TimeUnit.SECONDS, new SynchronousQueue<>());
        try {
            Fake fake = new Fake();
            fake.connectionsHang = true;
            // The first call's connection list holds the one thread past its deadline.
            new SetupLookups(fake, full, () -> true, 100).lists("default");
            SetupLists second = SetupLists.fromJson(new SetupLookups(new Fake(), full, () -> true, 100).lists("default"));
            assertEquals(Status.UNAVAILABLE, second.connections().status());
        } finally {
            never.countDown();
            full.shutdownNow();
        }
    }

    @Test
    void outsideAnRpcCallTheDesignerCheckIsFalse() {
        assertEquals(false, new DesignerCaller().getAsBoolean());
    }
}
