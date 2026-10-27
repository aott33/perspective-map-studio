package com.aoindustrial.perspective.mapstudio.designer.setup;

import com.inductiveautomation.ignition.client.gateway_interface.GatewayConnection;
import com.inductiveautomation.ignition.common.rpc.proto.ProtoRpcSerializer;
import com.inductiveautomation.ignition.common.util.LoggerEx;
import com.inductiveautomation.ignition.designer.model.DesignerContext;
import com.inductiveautomation.ignition.designer.project.DesignableProject;

import com.aoindustrial.perspective.mapstudio.common.MapStudioModule;
import com.aoindustrial.perspective.mapstudio.common.contract.SetupLookupRpc;

/**
 * The Designer's {@link SetupListSource} (epic 2 story 16). The project half reads the open
 * project through {@link ProjectResources}: the project library ({@code ignition/script-python},
 * {@code code.py}), the Perspective page configuration and general properties [SDK 8.3.0 javap;
 * owner, seen in the Designer 2026-10-27: the library was read under the wrong resource type
 * until fix 16; unverified: that {@code getResourcesOfType} includes inherited scripts, and the
 * general properties' file name, so every JSON file of that resource is tried]. The Gateway half
 * calls the module's {@link SetupLookupRpc} through
 * {@code GatewayConnection.getRpcInterface(serializer, moduleId, type, timeoutMs)}
 * [SDK 8.3.0 javap; live 8.3.10: the Gateway routes it at
 * {@code /data/rpc/<moduleId>/mapstudio-setup/<function>}; unverified from a Designer].
 * Names only: nothing here reads a secret's value.
 */
final class DesignerListSource implements SetupListSource {

    private static final LoggerEx LOG = LoggerEx.newBuilder().build("MapStudio.designer");

    /** The client waits a little longer than the Gateway's 5 s per list. */
    static final int RPC_TIMEOUT_MS = 8_000;

    private final DesignerContext context;

    DesignerListSource(DesignerContext context) {
        this.context = context;
    }

    @Override
    public ProjectLists.Snapshot project() {
        try {
            DesignableProject project = context.getProject();
            return ProjectResources.read(project::getResourcesOfType);
        } catch (RuntimeException ex) {
            LOG.warn("Map Studio setup: the project's functions and pages could not be read.", ex);
            return ProjectLists.Snapshot.unknown();
        }
    }

    private static SetupLookupRpc rpc() {
        return GatewayConnection.getRpcInterface(ProtoRpcSerializer.DEFAULT_INSTANCE,
            MapStudioModule.MODULE_ID, SetupLookupRpc.class, RPC_TIMEOUT_MS);
    }

    @Override
    public String gatewayLists(String identityProvider) {
        return rpc().lists(identityProvider);
    }

    @Override
    public String secretNames(String provider) {
        return rpc().secretNames(provider);
    }
}
