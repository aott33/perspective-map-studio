package com.aoindustrial.perspective.mapstudio.common;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import com.inductiveautomation.ignition.common.BundleUtil;
import com.inductiveautomation.ignition.common.script.hints.ScriptArg;
import com.inductiveautomation.ignition.common.script.hints.JythonElement;

/**
 * The {@code system.mapstudio} scripting module (AD-18). Spike (story 3): one
 * function, {@code ping()}, proves that a module registers a scripting function
 * that project scripts and the Designer see; the real API (getMap, applyEdits)
 * is epic-map-store-and-data's.
 *
 * <p>Lives in the common scope so the Gateway hook (where scripts run) and the
 * Designer hook (autocomplete and the script console) register the same class,
 * as IA's scripting-function example does. The real API's Gateway-only functions
 * will call the Gateway over RPC from the Designer, as in that example.
 *
 * <p>Documentation comes from {@code MapStudioScriptModule.properties} through
 * the {@code PropertiesFileDocProvider} each hook registers it with.
 */
public final class MapStudioScriptModule {

    static {
        BundleUtil.get().addBundle(
            MapStudioScriptModule.class.getSimpleName(),
            MapStudioScriptModule.class.getClassLoader(),
            MapStudioScriptModule.class.getName().replace('.', '/'));
    }

    @JythonElement(docBundlePrefix = "MapStudioScriptModule")
    public String ping() {
        return "Map Studio pong at " + Instant.now().truncatedTo(ChronoUnit.SECONDS);
    }

    @JythonElement(docBundlePrefix = "MapStudioScriptModule")
    public String echo(@ScriptArg("text") String text) {
        return text == null ? "" : text;
    }
}
