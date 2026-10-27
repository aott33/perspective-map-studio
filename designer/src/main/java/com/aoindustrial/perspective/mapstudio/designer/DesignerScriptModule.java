package com.aoindustrial.perspective.mapstudio.designer;

import org.python.core.PyObject;

import com.aoindustrial.perspective.mapstudio.common.MapStudioScriptModule;
import com.aoindustrial.perspective.mapstudio.common.Messages;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;

/**
 * {@code system.mapstudio} in the Designer: registered so the Script Console and
 * the script editors autocomplete it with its docs; {@code getMap} and
 * {@code applyEdits} raise "runs in Gateway scope only" when called here (owner
 * decision, 2026-10-26: no RPC in this version). {@code ping} answers locally.
 */
public final class DesignerScriptModule extends MapStudioScriptModule {

    @Override
    protected PyObject getMapImpl(String project) {
        throw gatewayOnly("getMap");
    }

    @Override
    protected PyObject applyEditsImpl(String project, PyObject batch, String actor) {
        throw gatewayOnly("applyEdits");
    }

    private static MapStudioException gatewayOnly(String function) {
        return new MapStudioException(Messages.CODE_INVALID, "system.mapstudio." + function
            + " runs in Gateway scope only (a Gateway event script, a Perspective session script, or a project"
            + " library function called from them).");
    }
}
