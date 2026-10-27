package com.aoindustrial.perspective.mapstudio.designer.setup;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import com.inductiveautomation.ignition.client.gateway_interface.GatewayConnection;
import com.inductiveautomation.ignition.common.ImmutableBytes;
import com.inductiveautomation.ignition.common.resourcecollection.Resource;
import com.inductiveautomation.ignition.common.resourcecollection.ResourceType;
import com.inductiveautomation.ignition.common.rpc.proto.ProtoRpcSerializer;
import com.inductiveautomation.ignition.common.script.ScriptLibrary;
import com.inductiveautomation.ignition.common.util.LoggerEx;
import com.inductiveautomation.ignition.designer.model.DesignerContext;
import com.inductiveautomation.ignition.designer.project.DesignableProject;

import com.aoindustrial.perspective.mapstudio.common.MapStudioModule;
import com.aoindustrial.perspective.mapstudio.common.contract.SetupLookupRpc;

/**
 * The Designer's {@link SetupListSource} (epic 2 story 16). The project half reads the open
 * project: {@code ignition/script-python} resources ({@code code.py}), the Perspective page
 * configuration ({@code com.inductiveautomation.perspective/page-config}, {@code config.json}) and
 * general properties ({@code com.inductiveautomation.perspective/general-properties}, the
 * {@code idp} key) [SDK 8.3.0 javap; unverified in a Designer: that {@code getResourcesOfType}
 * includes inherited scripts, and the general properties' file name, so every JSON file of that
 * resource is tried]. The Gateway half calls the module's {@link SetupLookupRpc} through
 * {@code GatewayConnection.getRpcInterface(serializer, moduleId, type, timeoutMs)}
 * [SDK 8.3.0 javap; live 8.3.10: the Gateway routes it at
 * {@code /data/rpc/<moduleId>/mapstudio-setup/<function>}; unverified from a Designer].
 * Names only: nothing here reads a secret's value.
 */
final class DesignerListSource implements SetupListSource {

    private static final LoggerEx LOG = LoggerEx.newBuilder().build("MapStudio.designer");

    static final ResourceType PAGE_CONFIG = new ResourceType("com.inductiveautomation.perspective", "page-config");
    static final ResourceType GENERAL_PROPERTIES =
        new ResourceType("com.inductiveautomation.perspective", "general-properties");

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
            Map<String, String> scripts = new LinkedHashMap<>();
            for (Resource r : project.getResourcesOfType(ScriptLibrary.RESOURCE_TYPE)) {
                text(r, "code.py").ifPresent(code -> scripts.put(r.getResourcePath().getFolderPath(), code));
            }
            String pages = first(project, PAGE_CONFIG, "config.json");
            String general = first(project, GENERAL_PROPERTIES, null);
            return ProjectLists.of(scripts, pages, general);
        } catch (RuntimeException ex) {
            LOG.warn("Map Studio setup: the project's functions and pages could not be read.", ex);
            return ProjectLists.Snapshot.unknown();
        }
    }

    private static String first(DesignableProject project, ResourceType type, String file) {
        for (Resource r : project.getResourcesOfType(type)) {
            if (file != null) {
                Optional<String> t = text(r, file);
                if (t.isPresent()) {
                    return t.get();
                }
            } else {
                for (String key : r.getDataKeys()) {
                    if (key.endsWith(".json") && !key.equals("resource.json")) {
                        Optional<String> t = text(r, key);
                        if (t.isPresent() && t.get().contains("\"idp\"")) {
                            return t.get();
                        }
                    }
                }
            }
        }
        return null;
    }

    private static Optional<String> text(Resource r, String file) {
        return r.getData(file).map(ImmutableBytes::getBytes).map(b -> new String(b, StandardCharsets.UTF_8));
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
