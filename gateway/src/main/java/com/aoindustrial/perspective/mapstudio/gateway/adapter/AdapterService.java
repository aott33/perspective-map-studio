package com.aoindustrial.perspective.mapstudio.gateway.adapter;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;
import java.util.function.LongSupplier;
import java.util.function.Supplier;

import com.inductiveautomation.ignition.common.util.LoggerEx;

import com.aoindustrial.perspective.mapstudio.common.contract.AdapterStatus;
import com.aoindustrial.perspective.mapstudio.common.contract.Asset;
import com.aoindustrial.perspective.mapstudio.common.contract.Kind;
import com.aoindustrial.perspective.mapstudio.common.contract.Parsed;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;

/**
 * The host adapters (AD-4): calls each project's kind function and asset
 * function, as its setup names them, on a small bounded pool with a fixed
 * timeout, checks the rows against the kind list and asset contract, and keeps
 * the result per project with a status in words (docs/kinds-and-assets.md).
 *
 * <ul>
 * <li>A tick every second refreshes each project whose {@code refreshIntervalSeconds}
 * elapsed, reading the setup afresh each time, so a changed setup applies
 * without a hook into the setup loader. Kinds are called first, then assets,
 * checked against the last good kind list.</li>
 * <li>At most one call per project and list is in flight. A call still running
 * at the next tick is skipped. An on-demand refresh ({@link #refreshNow}) joins
 * a call that has not settled; asked while a timed-out call still runs, it
 * starts one new call when that call ends (never more than one waiting).</li>
 * <li>A call that does not answer within the timeout makes the list {@code slow}.
 * Jython cannot be stopped, so the call keeps its thread until it ends and its
 * result is dropped.</li>
 * <li>A failing or slow refresh keeps the last good list and says so; an empty
 * answer replaces it (owner decision, 2026-10-26).</li>
 * <li>One log line per status change per project and list on
 * {@code MapStudio.adapters}: warn into a bad status, info into {@code ok} or
 * {@code not-configured}; ids and counts only, never row content.</li>
 * </ul>
 *
 * <p>Locking: each list has its own monitor and no code holds both. A future
 * ({@link Call#settled}, {@link ListState#pending}) is completed only after its
 * monitor is left, because completing it runs the next step of a refresh (the
 * asset call after the kind call) on the completing thread; the kind ids for an
 * asset check are read before the asset monitor is entered.
 */
public final class AdapterService {

    public static final Duration TIMEOUT = Duration.ofSeconds(5);
    static final int THREADS = 2;
    static final int QUEUE = 8;
    static final Duration TICK = Duration.ofSeconds(1);
    static final int MAX_REASONS = 3;
    static final int MAX_ERROR = 200;

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneOffset.UTC);

    /** Where the service writes its log lines; the Gateway logger, or a recorder in the tests. */
    public interface Log {
        void info(String line);

        void warn(String line);
    }

    /** The two host lists. */
    enum ListKind {
        KINDS("kind", "kinds", Setup::kindsFunction),
        ASSETS("asset", "assets", Setup::assetsFunction);

        final String one;
        final String many;
        final Function<Setup, String> function;

        ListKind(String one, String many, Function<Setup, String> function) {
            this.one = one;
            this.many = many;
            this.function = function;
        }
    }

    /** One call of one list. {@code done} is guarded by the list's monitor. */
    private static final class Call {
        /** Completes when the call settles (answers or times out), outside any monitor. */
        final CompletableFuture<Void> settled = new CompletableFuture<>();
        /** The call settled: its answer or its timeout set the status. */
        boolean done;
    }

    /** One list of one project. Guarded by its own monitor. */
    private static final class ListState<T> {
        List<T> good = List.of();
        Instant goodAt;
        AdapterStatus status;
        /** The status word last logged, or null before the first line. */
        String logged;
        /** A call is running on the pool (even after its timeout). */
        boolean running;
        /** The current or last call, or null before the first. */
        Call call;
        /** An on-demand refresh asked for while a timed-out call still runs. */
        CompletableFuture<Void> pending;
    }

    private static final class ProjectState {
        final ListState<Kind> kinds = new ListState<>();
        final ListState<Asset> assets = new ListState<>();
        /** System.nanoTime of the last refresh started, or null before the first. */
        Long lastRefresh;
    }

    private final Function<String, Optional<Setup>> setups;
    private final Supplier<Set<String>> projects;
    private final AdapterCaller caller;
    private final ExecutorService pool;
    private final ScheduledExecutorService ticker;
    private final LongSupplier nanos;
    private final Clock clock;
    private final Duration timeout;
    private final Log log;
    private final Map<String, ProjectState> states = new ConcurrentHashMap<>();

    public AdapterService(Function<String, Optional<Setup>> setups, Supplier<Set<String>> projects,
                          AdapterCaller caller, ExecutorService pool, ScheduledExecutorService ticker,
                          LongSupplier nanos, Clock clock, Duration timeout, Log log) {
        this.setups = setups;
        this.projects = projects;
        this.caller = caller;
        this.pool = pool;
        this.ticker = ticker;
        this.nanos = nanos;
        this.clock = clock;
        this.timeout = timeout;
        this.log = log;
    }

    /** The Gateway's service: 2 daemon threads {@code MapStudio-adapter-N}, a queue of 8, 5 s timeout. */
    public static AdapterService create(Function<String, Optional<Setup>> setups, Supplier<Set<String>> projects,
                                       AdapterCaller caller) {
        LoggerEx logger = LoggerEx.newBuilder().build("MapStudio.adapters");
        ExecutorService pool = new ThreadPoolExecutor(THREADS, THREADS, 0L, TimeUnit.MILLISECONDS,
            new ArrayBlockingQueue<>(QUEUE), daemon("MapStudio-adapter"), new ThreadPoolExecutor.AbortPolicy());
        ScheduledExecutorService ticker = Executors.newSingleThreadScheduledExecutor(daemon("MapStudio-adapter-tick"));
        return new AdapterService(setups, projects, caller, pool, ticker, System::nanoTime, Clock.systemUTC(),
            TIMEOUT, new Log() {
                @Override
                public void info(String line) {
                    logger.info(line);
                }

                @Override
                public void warn(String line) {
                    logger.warn(line);
                }
            });
    }

    public void start() {
        ticker.scheduleWithFixedDelay(this::tickSafely, TICK.toMillis(), TICK.toMillis(), TimeUnit.MILLISECONDS);
    }

    public void stop() {
        ticker.shutdownNow();
        pool.shutdownNow();
    }

    public Duration timeout() {
        return timeout;
    }

    private void tickSafely() {
        try {
            tick();
        } catch (RuntimeException ex) {
            log.warn("Map Studio's adapter refresh failed: " + ex.getClass().getSimpleName());
        }
    }

    /** Refresh every project whose interval elapsed; forget projects without a setup. */
    void tick() {
        Set<String> current = new HashSet<>(projects.get());
        states.keySet().retainAll(current);
        long now = nanos.getAsLong();
        for (String project : current) {
            Optional<Setup> setup = setups.apply(project);
            if (setup.isEmpty()) {
                continue;
            }
            ProjectState ps = states.computeIfAbsent(project, p -> new ProjectState());
            long interval = TimeUnit.SECONDS.toNanos(setup.get().refreshIntervalSeconds());
            synchronized (ps) {
                if (ps.lastRefresh != null && now - ps.lastRefresh < interval) {
                    continue;
                }
                ps.lastRefresh = now;
            }
            refresh(project, ps, false);
        }
    }

    /**
     * Refresh both lists of {@code project} now. The future completes with the
     * snapshot once both calls settled (answered, failed or timed out).
     */
    public CompletableFuture<AdapterSnapshot> refreshNow(String project) {
        if (setups.apply(project).isEmpty()) {
            return CompletableFuture.completedFuture(snapshot(project));
        }
        ProjectState ps = states.computeIfAbsent(project, p -> new ProjectState());
        synchronized (ps) {
            ps.lastRefresh = nanos.getAsLong();
        }
        return refresh(project, ps, true).thenApply(v -> snapshot(project));
    }

    private CompletableFuture<Void> refresh(String project, ProjectState ps, boolean onDemand) {
        return callList(project, ps, ListKind.KINDS, ps.kinds, onDemand)
            .thenCompose(v -> callList(project, ps, ListKind.ASSETS, ps.assets, onDemand));
    }

    /** The project's lists and statuses now. Never blocks on a call. */
    public AdapterSnapshot snapshot(String project) {
        Optional<Setup> setup = setups.apply(project);
        ProjectState ps = project == null ? null : states.get(project);
        List<Kind> kinds;
        List<Asset> assets;
        AdapterStatus k;
        AdapterStatus a;
        if (ps == null) {
            kinds = List.of();
            assets = List.of();
            k = initial(ListKind.KINDS, setup);
            a = initial(ListKind.ASSETS, setup);
        } else {
            synchronized (ps.kinds) {
                kinds = ps.kinds.good;
                k = ps.kinds.status != null ? ps.kinds.status : initial(ListKind.KINDS, setup);
            }
            synchronized (ps.assets) {
                assets = ps.assets.good;
                a = ps.assets.status != null ? ps.assets.status : initial(ListKind.ASSETS, setup);
            }
        }
        return new AdapterSnapshot(kinds, assets, k, a);
    }

    private static AdapterStatus initial(ListKind list, Optional<Setup> setup) {
        String function = setup.map(list.function).orElse("");
        if (setup.isPresent() && function.isBlank()) {
            return notConfigured(list);
        }
        return new AdapterStatus(AdapterStatus.LOADING, "Loading the " + list.one + " list"
            + (function.isBlank() ? "." : " from " + function + "."), function, 0, 0, null);
    }

    private static AdapterStatus notConfigured(ListKind list) {
        return new AdapterStatus(AdapterStatus.NOT_CONFIGURED, "The setup names no " + list.one + " function.", "",
            0, 0, null);
    }

    private <T> CompletableFuture<Void> callList(String project, ProjectState ps, ListKind list, ListState<T> ls,
                                                 boolean onDemand) {
        Optional<Setup> setup = setups.apply(project);
        if (setup.isEmpty()) {
            return CompletableFuture.completedFuture(null);
        }
        String function = list.function.apply(setup.get());
        synchronized (ls) {
            if (function.isBlank()) {
                ls.good = List.of();
                ls.goodAt = null;
                setStatus(project, list, ls, notConfigured(list));
                return CompletableFuture.completedFuture(null);
            }
            if (ls.running) {
                if (!ls.call.done) {
                    return ls.call.settled;
                }
                if (!onDemand) {
                    return CompletableFuture.completedFuture(null);
                }
                if (ls.pending == null) {
                    ls.pending = new CompletableFuture<>();
                }
                return ls.pending;
            }
            return startCall(project, ps, list, ls, function);
        }
    }

    /**
     * Start one call; the caller holds {@code ls}'s monitor. The returned future
     * is new, so nothing depends on it yet when a refused call completes it here.
     */
    private <T> CompletableFuture<Void> startCall(String project, ProjectState ps, ListKind list, ListState<T> ls,
                                                  String function) {
        Call call = new Call();
        CompletableFuture<Void> settled = call.settled;
        ls.running = true;
        ls.call = call;
        try {
            pool.execute(() -> {
                AdapterCaller.Outcome outcome;
                try {
                    outcome = caller.call(project, function);
                } catch (RuntimeException ex) {
                    outcome = new AdapterCaller.Failed(firstLine(ex.toString()));
                }
                finish(project, ps, list, ls, function, call, outcome);
            });
        } catch (RejectedExecutionException ex) {
            ls.running = false;
            call.done = true;
            setStatus(project, list, ls, slow(list, ls, function, "Map Studio is busy calling other project"
                + " functions, so the " + list.one + " function " + function + " was not called."));
            settled.complete(null);
            return settled;
        }
        ticker.schedule(() -> {
            boolean timedOut = false;
            synchronized (ls) {
                if (!call.done) {
                    call.done = true;
                    timedOut = true;
                    setStatus(project, list, ls, slow(list, ls, function, "The " + list.one + " function "
                        + function + " did not answer within " + seconds(timeout) + "."));
                }
            }
            if (timedOut) {
                settled.complete(null);
            }
        }, timeout.toMillis(), TimeUnit.MILLISECONDS);
        return settled;
    }

    private <T> void finish(String project, ProjectState ps, ListKind list, ListState<T> ls, String function,
                            Call call, AdapterCaller.Outcome outcome) {
        // Read before entering the asset monitor: never hold both lists' monitors.
        Set<String> kindIds = list == ListKind.ASSETS ? kindIds(ps) : Set.of();
        boolean answered = false;
        CompletableFuture<Void> pending;
        CompletableFuture<Void> next = null;
        synchronized (ls) {
            ls.running = false;
            if (!call.done) {
                call.done = true;
                answered = true;
                apply(project, list, ls, function, outcome, kindIds);
            }
            pending = ls.pending;
            ls.pending = null;
            if (pending != null) {
                Optional<Setup> setup = setups.apply(project);
                String now = setup.map(list.function).orElse("");
                if (setup.isPresent() && !now.isBlank()) {
                    next = startCall(project, ps, list, ls, now);
                }
            }
        }
        // Complete outside the monitor: a dependent step may take another list's monitor.
        if (answered) {
            call.settled.complete(null);
        }
        if (pending != null) {
            if (next != null) {
                next.whenComplete((v, ex) -> pending.complete(null));
            } else {
                pending.complete(null);
            }
        }
    }

    @SuppressWarnings("unchecked")
    private <T> void apply(String project, ListKind list, ListState<T> ls, String function,
                           AdapterCaller.Outcome outcome, Set<String> kindIds) {
        Instant now = clock.instant().truncatedTo(ChronoUnit.SECONDS);
        AdapterStatus status;
        if (outcome instanceof AdapterCaller.Returned returned) {
            if (returned.rows().isEmpty()) {
                ls.good = List.of();
                ls.goodAt = now;
                status = new AdapterStatus(AdapterStatus.EMPTY, "The " + list.one + " function " + function
                    + " returned no " + list.many + ".", function, 0, 0, iso(now));
            } else {
                Parsed<T> parsed = list == ListKind.KINDS
                    ? (Parsed<T>) Kind.parseList(returned.rows())
                    : (Parsed<T>) Asset.parseList(returned.rows(), kindIds);
                ls.good = parsed.kept();
                ls.goodAt = now;
                if (parsed.left() == 0) {
                    status = new AdapterStatus(AdapterStatus.OK, parsed.kept().size() + " " + plural(list,
                        parsed.kept().size()) + " from " + function + ".", function, parsed.kept().size(), 0, iso(now));
                } else {
                    String head = parsed.left() + " of " + parsed.total() + " " + list.many + " from " + function
                        + " left out";
                    status = new AdapterStatus(AdapterStatus.INCOMPLETE, head + ": " + parsed.firstReasons(MAX_REASONS)
                        + (parsed.left() > MAX_REASONS ? "; ..." : "") + ".", function, parsed.kept().size(),
                        parsed.left(), iso(now), head + ".");
                }
            }
        } else if (outcome instanceof AdapterCaller.NotAList notAList) {
            String message = "The " + list.one + " function " + function + " returned a "
                + firstLine(notAList.typeName()) + ", expected a list of dicts.";
            status = failing(list, ls, function, message, message);
        } else {
            String reason = firstLine(((AdapterCaller.Failed) outcome).reason());
            status = failing(list, ls, function, "The " + list.one + " function " + function + " failed: "
                + reason + (reason.endsWith(".") ? "" : "."), "The " + list.one + " function " + function + " failed.");
        }
        setStatus(project, list, ls, status);
    }

    private static Set<String> kindIds(ProjectState ps) {
        synchronized (ps.kinds) {
            Set<String> ids = new HashSet<>();
            for (Kind k : ps.kinds.good) {
                ids.add(k.id());
            }
            return ids;
        }
    }

    /** {@code viewerMessage}: the same words without the host's error text (level {@code none}). */
    private <T> AdapterStatus failing(ListKind list, ListState<T> ls, String function, String message,
                                      String viewerMessage) {
        return kept(AdapterStatus.FAILING, list, ls, function, message, viewerMessage);
    }

    private <T> AdapterStatus slow(ListKind list, ListState<T> ls, String function, String message) {
        return kept(AdapterStatus.SLOW, list, ls, function, message, message);
    }

    /** A bad status that keeps the last good list, and says so. */
    private static <T> AdapterStatus kept(String word, ListKind list, ListState<T> ls, String function,
                                          String message, String viewerMessage) {
        boolean keeps = ls.goodAt != null && !ls.good.isEmpty();
        String suffix = keeps ? " Showing the list from " + HH_MM.format(ls.goodAt) + " UTC." : "";
        return new AdapterStatus(word, message + suffix, function, ls.good.size(), 0, keeps ? iso(ls.goodAt) : null,
            viewerMessage + suffix);
    }

    /** Set the status; log one line when the status word changed. Caller holds {@code ls}'s monitor. */
    private <T> void setStatus(String project, ListKind list, ListState<T> ls, AdapterStatus status) {
        String before = ls.logged;
        ls.status = status;
        if (status.status().equals(before)) {
            return;
        }
        ls.logged = status.status();
        String line = "Project " + project + ": " + status.message();
        if (AdapterStatus.OK.equals(status.status())) {
            log.info(before == null || AdapterStatus.NOT_CONFIGURED.equals(before) ? line
                : "Project " + project + ": the " + list.one + " function " + status.function() + " recovered: "
                    + status.message());
        } else if (AdapterStatus.NOT_CONFIGURED.equals(status.status())) {
            log.info(line);
        } else {
            log.warn(line);
        }
    }

    /** "5 s", or "0.3 s" for a timeout that is not whole seconds (tests). */
    static String seconds(Duration d) {
        long ms = d.toMillis();
        return ms % 1000 == 0 ? (ms / 1000) + " s" : (ms / 1000.0) + " s";
    }

    private static String plural(ListKind list, int n) {
        return n == 1 ? list.one : list.many;
    }

    private static String iso(Instant t) {
        return t == null ? null : DateTimeFormatter.ISO_INSTANT.format(t);
    }

    /**
     * The first line of {@code text}, trimmed, at most 200 characters, with any
     * other control character (carriage return, tab, escape) or line or
     * paragraph separator replaced by "?", so it is one line in the Gateway log.
     */
    public static String firstLine(String text) {
        if (text == null) {
            return "";
        }
        String s = text.strip();
        int nl = s.indexOf('\n');
        if (nl >= 0) {
            s = s.substring(0, nl).strip();
        }
        boolean cut = s.length() > MAX_ERROR;
        if (cut) {
            s = s.substring(0, MAX_ERROR);
        }
        StringBuilder b = new StringBuilder(s.length() + 3);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            b.append(Character.isISOControl(c) || c == 0x2028 || c == 0x2029 ? '?' : c);
        }
        return cut ? b.append("...").toString() : b.toString();
    }

    private static ThreadFactory daemon(String name) {
        AtomicInteger n = new AtomicInteger();
        return r -> {
            Thread t = new Thread(r, name + "-" + n.incrementAndGet());
            t.setDaemon(true);
            return t;
        };
    }
}
