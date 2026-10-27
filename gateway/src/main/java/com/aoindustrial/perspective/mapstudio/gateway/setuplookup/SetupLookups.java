package com.aoindustrial.perspective.mapstudio.gateway.setuplookup;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.BooleanSupplier;

import com.inductiveautomation.ignition.common.util.LoggerEx;

import com.aoindustrial.perspective.mapstudio.common.contract.SetupLists;
import com.aoindustrial.perspective.mapstudio.common.contract.SetupLookupRpc;

/**
 * The setup form's Gateway lists (epic 2 story 16), behind {@link SetupLookupRpc}: database
 * connections, the identity provider's roles, secret providers and one provider's secret names.
 * Each list runs on its own with a {@link #TIMEOUT_MS} deadline, so a slow provider gives one
 * unavailable list and never holds the others. A call that ignores the cancel keeps its thread,
 * so each list (connections, one identity provider's roles, the providers, one provider's secret
 * names) has at most one call in flight, which a later ask waits on again instead of starting
 * another; and secret names run on a pool of their own, so a hung secret provider never takes the
 * threads connections and roles need. Names only: {@link LookupSource} has no way to read
 * a secret's value. Logs counts and failure classes at debug or warn, never a secret name above
 * debug and never a value.
 *
 * <p>Only a Designer may call it (owner decision 2026-10-27): the RPC is registered without
 * {@code RunsOnClient}, and {@code designerCaller} refuses any other session as well.
 */
public final class SetupLookups implements SetupLookupRpc {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.setup-lookups");

    /** Every list answers within this, or it is unavailable. */
    public static final long TIMEOUT_MS = 5_000;

    static final String UNAVAILABLE = "The Gateway did not answer this list in time.";
    static final String FAILED = "The Gateway could not list these names.";
    static final String NOT_LISTED = "This identity provider does not list its roles.";
    static final String NO_PROVIDER = "The Gateway has no secret provider of that name.";
    static final String REFUSED = "Only a Designer may ask for the setup lists.";

    private final LookupSource source;
    private final ExecutorService listsPool;
    private final ExecutorService secretsPool;
    private final BooleanSupplier designerCaller;
    private final long timeoutMs;
    /** The one call in flight per list; a key is internal and never logged. */
    private final ConcurrentHashMap<String, CompletableFuture<SetupLists.Part>> inFlight = new ConcurrentHashMap<>();

    /**
     * @param listsPool   threads for connections, roles and secret providers
     * @param secretsPool threads for one provider's secret names, apart from the others
     */
    public SetupLookups(LookupSource source, ExecutorService listsPool, ExecutorService secretsPool,
                        BooleanSupplier designerCaller) {
        this(source, listsPool, secretsPool, designerCaller, TIMEOUT_MS);
    }

    SetupLookups(LookupSource source, ExecutorService listsPool, ExecutorService secretsPool,
                 BooleanSupplier designerCaller, long timeoutMs) {
        this.source = source;
        this.listsPool = listsPool;
        this.secretsPool = secretsPool;
        this.designerCaller = designerCaller;
        this.timeoutMs = timeoutMs;
    }

    @Override
    public String lists(String identityProvider) {
        requireDesigner();
        String idp = identityProvider == null || identityProvider.isBlank() ? "default" : identityProvider.trim();
        Future<SetupLists.Part> connections = submit(listsPool, "connections",
            () -> SetupLists.Part.ok(sortedEntries(source.connections())));
        Future<SetupLists.Part> roles = submit(listsPool, "roles\n" + idp, () -> {
            Optional<List<String>> names = source.roles(idp);
            return names.isPresent() ? SetupLists.Part.okNames(sorted(names.get()))
                : SetupLists.Part.notListed(NOT_LISTED);
        });
        Future<SetupLists.Part> providers = submit(listsPool, "providers",
            () -> SetupLists.Part.okNames(sorted(source.secretProviders())));
        long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMs);
        SetupLists reply = new SetupLists(await(connections, deadline, "database connections"),
            await(roles, deadline, "identity provider roles"), await(providers, deadline, "secret providers"));
        log.debugf("Setup lists: %d connections, roles %s (%d), %d secret providers.",
            reply.connections().entries().size(), reply.roles().status().word(), reply.roles().entries().size(),
            reply.secretProviders().entries().size());
        return reply.toJson();
    }

    @Override
    public String secretNames(String provider) {
        requireDesigner();
        if (provider == null || provider.isBlank()) {
            return SetupLists.Part.unavailable(NO_PROVIDER).toJson();
        }
        String name = provider.trim();
        Future<SetupLists.Part> names = submit(secretsPool, "secrets\n" + name, () -> {
            Optional<List<String>> listed = source.secretNames(name);
            return listed.isPresent() ? SetupLists.Part.okNames(sorted(listed.get()))
                : SetupLists.Part.unavailable(NO_PROVIDER);
        });
        SetupLists.Part part = await(names, System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMs),
            "secret names");
        // The count only: a secret name is not logged above debug, and here not at all.
        log.debugf("Secret names: %s (%d).", part.status().word(), part.entries().size());
        return part.toJson();
    }

    private void requireDesigner() {
        if (!designerCaller.getAsBoolean()) {
            log.warn("A setup lists call from a session that is not a Designer was refused.");
            throw new SecurityException(REFUSED);
        }
    }

    /**
     * Starts {@code call} on {@code pool}, or hands back the call of the same key still running:
     * a list whose source ignores the cancel holds one thread, never one per ask.
     */
    private Future<SetupLists.Part> submit(ExecutorService pool, String key, Callable<SetupLists.Part> call) {
        CompletableFuture<SetupLists.Part> mine = new CompletableFuture<>();
        CompletableFuture<SetupLists.Part> running = inFlight.putIfAbsent(key, mine);
        if (running != null) {
            return running;
        }
        try {
            pool.execute(() -> {
                try {
                    mine.complete(call.call());
                } catch (Throwable t) {
                    mine.completeExceptionally(t);
                } finally {
                    inFlight.remove(key, mine);
                }
            });
        } catch (RejectedExecutionException ex) {
            inFlight.remove(key, mine);
            // Every thread of this pool is held by a slow source: this list is unavailable now.
            return CompletableFuture.completedFuture(SetupLists.Part.unavailable(UNAVAILABLE));
        }
        return mine;
    }

    /** Lists in flight now (tests). */
    int inFlightForTests() {
        return inFlight.size();
    }

    private static SetupLists.Part await(Future<SetupLists.Part> f, long deadline, String what) {
        try {
            long left = Math.max(0, deadline - System.nanoTime());
            return f.get(left, TimeUnit.NANOSECONDS);
        } catch (TimeoutException ex) {
            // Not cancelled: the call stays the one in flight for its list, and a later ask waits
            // on it again rather than taking another thread (cancel would not free a thread that
            // ignores interrupts anyway).
            log.warnf("Setup lists: the %s did not answer within %d ms.", what, TIMEOUT_MS);
            return SetupLists.Part.unavailable(UNAVAILABLE);
        } catch (ExecutionException ex) {
            Throwable cause = ex.getCause() == null ? ex : ex.getCause();
            // The class only: a provider's message might quote what it was asked for.
            log.warnf("Setup lists: the %s could not be listed (%s).", what, cause.getClass().getSimpleName());
            return SetupLists.Part.unavailable(FAILED);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return SetupLists.Part.unavailable(UNAVAILABLE);
        }
    }

    static List<String> sorted(List<String> names) {
        List<String> out = new ArrayList<>();
        for (String n : names) {
            if (n != null && !n.isBlank() && !out.contains(n)) {
                out.add(n);
            }
        }
        out.sort(Comparator.comparing((String s) -> s.toLowerCase(Locale.ROOT)).thenComparing(s -> s));
        return out;
    }

    private static List<SetupLists.Entry> sortedEntries(List<SetupLists.Entry> entries) {
        List<SetupLists.Entry> out = new ArrayList<>();
        for (SetupLists.Entry e : entries) {
            if (e != null && !e.name().isBlank()) {
                out.add(e);
            }
        }
        out.sort(Comparator.comparing((SetupLists.Entry e) -> e.name().toLowerCase(Locale.ROOT))
            .thenComparing(SetupLists.Entry::name));
        return out;
    }
}
