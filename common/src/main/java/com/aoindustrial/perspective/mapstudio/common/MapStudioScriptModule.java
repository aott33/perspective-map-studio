package com.aoindustrial.perspective.mapstudio.common;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.python.core.PyObject;

import com.inductiveautomation.ignition.common.BundleUtil;
import com.inductiveautomation.ignition.common.script.hints.JythonElement;
import com.inductiveautomation.ignition.common.script.hints.ScriptArg;

/**
 * The {@code system.mapstudio} scripting module (AD-18), contract 0.2.0 (draft).
 *
 * <p>Abstract in the common scope, as in IA's scripting-function example: the
 * Gateway hook registers a subclass that runs {@code getMap} and
 * {@code applyEdits} on the map store's write service, and the Designer hook a
 * subclass that offers them for autocomplete and raises "runs in Gateway scope
 * only" when called there (owner decision, 2026-10-26).
 *
 * <p>Documentation comes from {@code MapStudioScriptModule.properties} through
 * the {@code PropertiesFileDocProvider} each hook registers it with.
 */
public abstract class MapStudioScriptModule {

    static {
        BundleUtil.get().addBundle(
            MapStudioScriptModule.class.getSimpleName(),
            MapStudioScriptModule.class.getClassLoader(),
            MapStudioScriptModule.class.getName().replace('.', '/'));
    }

    /** A health check: a short text with the Gateway time. */
    @JythonElement(docBundlePrefix = "MapStudioScriptModule")
    public String ping() {
        return "Map Studio pong at " + Instant.now().truncatedTo(ChronoUnit.SECONDS);
    }

    /**
     * The project's map items as a list of dicts (the map item record, AD-20),
     * deleted ones left out.
     */
    @JythonElement(docBundlePrefix = "MapStudioScriptModule")
    public PyObject getMap(@ScriptArg("project") String project) {
        return getMapImpl(project);
    }

    /**
     * Save one batch {batchId, ops} through the write service, all ops or none,
     * recorded under {@code actor}. Returns {batchId, seq, results}.
     */
    @JythonElement(docBundlePrefix = "MapStudioScriptModule")
    public PyObject applyEdits(@ScriptArg("project") String project, @ScriptArg("batch") PyObject batch,
                               @ScriptArg("actor") String actor) {
        return applyEditsImpl(project, batch, actor);
    }

    protected abstract PyObject getMapImpl(String project);

    protected abstract PyObject applyEditsImpl(String project, PyObject batch, String actor);
}
