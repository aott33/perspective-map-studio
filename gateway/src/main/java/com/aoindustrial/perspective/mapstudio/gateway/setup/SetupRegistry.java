package com.aoindustrial.perspective.mapstudio.gateway.setup;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

import com.inductiveautomation.ignition.common.util.LoggerEx;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;

/**
 * Each project's Map Studio setup state (AD-5): valid, invalid with every problem
 * as one reason, or missing. Keyed by the project's own name (each project has its
 * own map, even when it inherits the setup: owner decision, 2026-10-26). Filled by
 * {@link SetupLifecycle} at project start and on every change; read on every call
 * by the store gate (write service, map loader, scripting API) and the delegate,
 * so a change applies at the next {@code map.load}, {@code edits.apply} or
 * {@code applyEdits} with no restart. Nothing else keeps a copy.
 *
 * <p>Log lines, logger {@code MapStudio.setup}: one info line per setup applied
 * (naming the connection and the roles, never {@code tokenSecret}); one warning per
 * bad read, at the read, naming the project and every problem; a project with no
 * setup warns once per Gateway start at its first use (owner decision,
 * 2026-10-26), so projects that never use Map Studio stay quiet.
 */
public final class SetupRegistry {

    /** Where the registry's info and warning lines go: the Gateway log, or a test's list. */
    public interface Log {
        void info(String message);

        void warn(String message);

        void error(String message, Throwable cause);
    }

    private static final LoggerEx GATEWAY_LOG = LoggerEx.newBuilder().build("MapStudio.setup");

    /** Logger {@code MapStudio.setup}. */
    public static final Log GATEWAY = new Log() {
        @Override
        public void info(String message) {
            GATEWAY_LOG.info(message);
        }

        @Override
        public void warn(String message) {
            GATEWAY_LOG.warn(message);
        }

        @Override
        public void error(String message, Throwable cause) {
            GATEWAY_LOG.error(message, cause);
        }
    };

    private final Log log;

    /**
     * A project's state and whether its one warning has been logged, swapped together
     * ({@code ConcurrentHashMap.compute}), so a call racing a scan never warns twice for
     * one bad read or one missing setup. No entry means missing and not yet warned.
     */
    private record Entry(SetupState state, boolean warned) {
    }

    private final ConcurrentHashMap<String, Entry> states = new ConcurrentHashMap<>();
    /** Keys other than a project's own state ({@link #warnOnce}, for example the store gate's project and connection). */
    private final Set<String> warned = ConcurrentHashMap.newKeySet();
    private final Consumer<Setup> onSetup;
    private final List<SetupChangeListener> listeners = new CopyOnWriteArrayList<>();

    /** {@code onSetup} is told of every valid setup read (the store registry starts its connection). */
    public SetupRegistry(Consumer<Setup> onSetup) {
        this(onSetup, GATEWAY);
    }

    public SetupRegistry(Consumer<Setup> onSetup, Log log) {
        this.onSetup = onSetup;
        this.log = log;
    }

    /** Add a listener told after every state change (entries 3 and 4). */
    public void addListener(SetupChangeListener listener) {
        listeners.add(listener);
    }

    /** A valid setup read: it applies from the next call. */
    public void put(String project, Setup setup) {
        put(project, setup, null);
    }

    /**
     * A valid setup read, {@code cause} naming what read it for the log line
     * ({@code "resource modified"}; null when not known).
     */
    public void put(String project, Setup setup, String cause) {
        SetupState before = swap(project, SetupState.valid(setup), false);
        boolean change = before.status() != SetupState.Status.MISSING;
        log.info(String.format("Project %s: Map Studio setup %s%s (connection %s, full editing roles %s, "
                + "phone editing roles %s, refresh interval %d s).", project, change ? "changed and applied" : "read",
            cause == null ? "" : " on " + cause, setup.connection(), setup.fullRoles(), setup.phoneRoles(),
            setup.refreshIntervalSeconds()));
        onSetup.accept(setup);
        tell(project, before, SetupState.valid(setup));
    }

    /**
     * A setup resource that could not be read: one warning now, naming the project
     * and the reason; the project's map store is unavailable until it is fixed.
     */
    public void putProblem(String project, String reason) {
        putProblem(project, reason, null);
    }

    /** As {@link #putProblem(String, String)}, {@code cause} naming what read it (null when not known). */
    public void putProblem(String project, String reason, String cause) {
        SetupState after = SetupState.invalid(reason);
        // Marked warned in the same swap: a call that sees the invalid state never warns again.
        SetupState before = swap(project, after, true);
        log.warn(cause == null ? invalidReason(project, reason)
            : "The Map Studio setup of project " + project + " (read on " + cause + ") cannot be read: " + reason);
        tell(project, before, after);
    }

    /** The setup resource was deleted: the project has no setup from the next call. */
    public void deleted(String project) {
        SetupState before = swap(project, SetupState.missing(), false);
        if (before.status() != SetupState.Status.MISSING) {
            log.info("Project " + project
                + ": Map Studio setup removed; its map store is unavailable until a setup is added.");
        }
        tell(project, before, SetupState.missing());
    }

    /** The project stopped: forget its state, quietly. */
    public void remove(String project) {
        SetupState before = swap(project, SetupState.missing(), false);
        tell(project, before, SetupState.missing());
    }

    /** The project's state now ({@code missing} when nothing was read). */
    public SetupState state(String project) {
        Entry e = project == null ? null : states.get(project);
        return e == null ? SetupState.missing() : e.state();
    }

    public Optional<Setup> find(String project) {
        return state(project).find();
    }

    /** The names of the projects that have a valid setup now (read by the adapter service's tick). */
    public Set<String> projects() {
        Set<String> valid = new HashSet<>();
        states.forEach((project, e) -> {
            if (e.state().isValid()) {
                valid.add(project);
            }
        });
        return Set.copyOf(valid);
    }

    /**
     * The project's setup, or {@code store-unreachable} with the reason (an invalid
     * setup was warned about when it was read; a missing one warns once per Gateway
     * start, naming the project).
     */
    public Setup require(String project) {
        SetupState s = state(project);
        if (s.isValid()) {
            return s.setup();
        }
        if (s.status() == SetupState.Status.INVALID) {
            // Warned once at the read (putProblem), never again at use.
            throw new MapStudioException(Messages.CODE_STORE_UNREACHABLE, invalidReason(project, s.reason()));
        }
        String reason = "Project " + project + " has no Map Studio setup (project resource "
            + "com.aoindustrial.perspective.mapstudio/setup), so its map store is unavailable.";
        if (project == null ? warned.add("null") : markMissingWarned(project)) {
            log.warn(reason);
        }
        throw new MapStudioException(Messages.CODE_STORE_UNREACHABLE, reason);
    }

    /** True the first time a missing project is marked warned since it went missing; atomic with the swaps. */
    private boolean markMissingWarned(String project) {
        boolean[] first = {false};
        states.compute(project, (k, e) -> {
            if (e == null) {
                first[0] = true;
                return new Entry(SetupState.missing(), true);
            }
            return e;
        });
        return first[0];
    }

    /** Log {@code message} at warn the first time for this project (and key) since the Gateway started. */
    public void warnOnce(String key, String message) {
        if (warned.add(String.valueOf(key))) {
            log.warn(message);
        }
    }

    private static String invalidReason(String project, String reason) {
        return "The Map Studio setup of project " + project + " cannot be read: " + reason;
    }

    private SetupState swap(String project, SetupState after, boolean warnedAfter) {
        Entry next = after.status() == SetupState.Status.MISSING && !warnedAfter ? null : new Entry(after, warnedAfter);
        Entry before = next == null ? states.remove(project) : states.put(project, next);
        return before == null ? SetupState.missing() : before.state();
    }

    private void tell(String project, SetupState before, SetupState after) {
        for (SetupChangeListener listener : listeners) {
            try {
                listener.onSetupChanged(project, before, after);
            } catch (RuntimeException ex) {
                log.error("A Map Studio setup listener failed for project " + project + ": "
                    + ex.getClass().getSimpleName(), ex);
            }
        }
    }
}
