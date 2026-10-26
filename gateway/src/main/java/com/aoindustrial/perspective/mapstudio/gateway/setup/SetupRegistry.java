package com.aoindustrial.perspective.mapstudio.gateway.setup;

import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

import com.inductiveautomation.ignition.common.util.LoggerEx;

import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;

/**
 * Each project's Map Studio setup (AD-5), keyed by the project's own name (each
 * project has its own map, even when it inherits the setup: owner decision,
 * 2026-10-26). Filled by {@link SetupLifecycle}; read by the write service, the
 * map loader and the scripting API.
 *
 * <p>A project without a usable setup warns once per Gateway start, at its first
 * {@code map.load} or {@code applyEdits} (owner decision, 2026-10-26), so
 * projects that never use Map Studio stay quiet.
 */
public final class SetupRegistry {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.setup");

    private final ConcurrentHashMap<String, Setup> setups = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> problems = new ConcurrentHashMap<>();
    private final Set<String> warned = ConcurrentHashMap.newKeySet();
    private final Consumer<Setup> onSetup;

    /** {@code onSetup} is told of every setup read (the store registry starts its connection). */
    public SetupRegistry(Consumer<Setup> onSetup) {
        this.onSetup = onSetup;
    }

    public void put(String project, Setup setup) {
        problems.remove(project);
        setups.put(project, setup);
        warned.remove(project);
        log.infof("Project %s: Map Studio setup read (connection %s, full editing roles %s, phone editing roles %s).",
            project, setup.connection(), setup.fullRoles(), setup.phoneRoles());
        onSetup.accept(setup);
    }

    /** A setup resource that could not be read: the reason is reported at the project's first use. */
    public void putProblem(String project, String reason) {
        setups.remove(project);
        problems.put(project, reason);
        warned.remove(project);
    }

    public void remove(String project) {
        setups.remove(project);
        problems.remove(project);
        warned.remove(project);
    }

    public Optional<Setup> find(String project) {
        return project == null ? Optional.empty() : Optional.ofNullable(setups.get(project));
    }

    /**
     * The project's setup, or {@code store-unreachable} with the reason (and one
     * warning per Gateway start naming the project).
     */
    public Setup require(String project) {
        Setup setup = project == null ? null : setups.get(project);
        if (setup != null) {
            return setup;
        }
        String problem = project == null ? null : problems.get(project);
        String reason = problem != null
            ? "The Map Studio setup of project " + project + " cannot be read: " + problem
            : "Project " + project + " has no Map Studio setup (project resource "
                + "com.aoindustrial.perspective.mapstudio/setup), so its map store is unavailable.";
        warnOnce(project, reason);
        throw new MapStudioException(Messages.CODE_STORE_UNREACHABLE, reason);
    }

    /** Log {@code message} at warn the first time for this project (and key) since the Gateway started. */
    public void warnOnce(String key, String message) {
        if (warned.add(String.valueOf(key))) {
            log.warn(message);
        }
    }
}
