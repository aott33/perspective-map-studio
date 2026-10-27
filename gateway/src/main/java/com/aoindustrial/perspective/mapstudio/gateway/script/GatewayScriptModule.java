package com.aoindustrial.perspective.mapstudio.gateway.script;

import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import org.python.core.PyObject;

import com.inductiveautomation.ignition.common.TypeUtilities;
import com.inductiveautomation.ignition.common.gson.JsonElement;

import com.aoindustrial.perspective.mapstudio.common.MapStudioScriptModule;
import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.AdapterService;
import com.aoindustrial.perspective.mapstudio.gateway.adapter.AdapterSnapshot;
import com.aoindustrial.perspective.mapstudio.gateway.load.MapLoader;
import com.aoindustrial.perspective.mapstudio.gateway.write.Actor;
import com.aoindustrial.perspective.mapstudio.gateway.write.WriteService;

/**
 * {@code system.mapstudio} on the Gateway (AD-18): {@code getMap} and
 * {@code applyEdits} on the same write service and loader as the browser, and
 * {@code refreshAdapters} on the host adapters' cache.
 *
 * <p>Trust (owner decision, 2026-10-26): the scripting API trusts its caller, like
 * {@code system.db}. A Gateway or Perspective session script that calls
 * {@code applyEdits} saves with full editing under the actor it names, which is
 * required and recorded in the edit record. A refusal raises a
 * {@link MapStudioException} (a Java exception; its message starts with the code).
 * Python values cross with {@code TypeUtilities.pyToGson} and {@code gsonToPy}.
 */
public final class GatewayScriptModule extends MapStudioScriptModule {

    private final WriteService writes;
    private final MapLoader loader;
    private final AdapterService adapters;

    public GatewayScriptModule(WriteService writes, MapLoader loader, AdapterService adapters) {
        this.writes = writes;
        this.loader = loader;
        this.adapters = adapters;
    }

    /**
     * Refresh both host lists now and return their statuses. Waits for both calls to
     * settle: a call that times out, or one asked for while a timed-out call still
     * runs, can take up to four timeouts in all; past that the current statuses come
     * back (a later refresh still lands in the cache).
     */
    @Override
    protected PyObject refreshAdaptersImpl(String project) {
        requireProject(project);
        AdapterSnapshot snapshot;
        try {
            snapshot = adapters.refreshNow(project).get(adapters.timeout().toMillis() * 4 + 1000,
                TimeUnit.MILLISECONDS);
        } catch (TimeoutException | ExecutionException ex) {
            snapshot = adapters.snapshot(project);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            snapshot = adapters.snapshot(project);
        }
        return TypeUtilities.gsonToPy(snapshot.statusJson());
    }

    @Override
    protected PyObject getMapImpl(String project) {
        requireProject(project);
        return TypeUtilities.gsonToPy(MapLoader.toJson(loader.snapshot(project).items()));
    }

    @Override
    protected PyObject applyEditsImpl(String project, PyObject batch, String actor) {
        requireProject(project);
        if (actor == null || actor.isBlank()) {
            throw new MapStudioException(Messages.CODE_INVALID,
                "applyEdits needs an actor: who makes the change, for example \"seed-script\".");
        }
        if (batch == null) {
            throw new MapStudioException(Messages.CODE_INVALID, "applyEdits needs a batch {batchId, ops}.");
        }
        JsonElement json;
        try {
            json = TypeUtilities.pyToGson(batch);
        } catch (RuntimeException ex) {
            throw new MapStudioException(Messages.CODE_INVALID,
                "The batch could not be read as JSON (" + ex.getClass().getSimpleName() + ").");
        }
        return TypeUtilities.gsonToPy(writes.apply(project, json, Actor.script(actor), Messages.LEVEL_FULL).toJson());
    }

    private static void requireProject(String project) {
        if (project == null || project.isBlank()) {
            throw new MapStudioException(Messages.CODE_INVALID, "Name the project whose map to use.");
        }
    }
}
