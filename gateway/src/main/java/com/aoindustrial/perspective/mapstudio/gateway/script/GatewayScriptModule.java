package com.aoindustrial.perspective.mapstudio.gateway.script;

import org.python.core.PyObject;

import com.inductiveautomation.ignition.common.TypeUtilities;
import com.inductiveautomation.ignition.common.gson.JsonElement;

import com.aoindustrial.perspective.mapstudio.common.MapStudioScriptModule;
import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;
import com.aoindustrial.perspective.mapstudio.gateway.load.MapLoader;
import com.aoindustrial.perspective.mapstudio.gateway.write.Actor;
import com.aoindustrial.perspective.mapstudio.gateway.write.WriteService;

/**
 * {@code system.mapstudio} on the Gateway (AD-18): {@code getMap} and
 * {@code applyEdits} on the same write service and loader as the browser.
 *
 * <p>Trust (owner decision, 2026-10-26): the scripting API trusts its caller, like
 * {@code system.db}. A Gateway or Perspective session script that calls
 * {@code applyEdits} saves with full editing under the actor it names, which is
 * required and recorded in the edit record. A refusal raises a
 * {@link MapStudioException} (a Java exception; its message starts with the code).
 * Python values cross with {@code TypeUtilities.pyToGson} and {@code gsonToPy}.
 * {@code getMap} returns a {@link MapList}: the records, plus {@code readOnly}.
 */
public final class GatewayScriptModule extends MapStudioScriptModule {

    private final WriteService writes;
    private final MapLoader loader;

    public GatewayScriptModule(WriteService writes, MapLoader loader) {
        this.writes = writes;
        this.loader = loader;
    }

    @Override
    protected PyObject getMapImpl(String project) {
        requireProject(project);
        MapLoader.Loaded loaded = loader.load(project);
        // Still the list of records; it also answers .readOnly (epic 2 story 5).
        return new MapList(TypeUtilities.gsonToPy(MapLoader.toJson(loaded.snapshot().items())), loaded.readOnly());
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
