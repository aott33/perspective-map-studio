package com.aoindustrial.perspective.mapstudio.gateway.setup;

import java.util.List;
import java.util.Optional;

import com.inductiveautomation.ignition.common.ImmutableBytes;
import com.inductiveautomation.ignition.common.resourcecollection.Resource;
import com.inductiveautomation.ignition.common.resourcecollection.ResourceId;
import com.inductiveautomation.ignition.common.resourcecollection.RuntimeResourceCollection;
import com.inductiveautomation.ignition.gateway.resourcecollection.ResourceCollectionLifecycle;

import com.aoindustrial.perspective.mapstudio.common.MapStudioModule;
import com.aoindustrial.perspective.mapstudio.common.contract.Setup;

/**
 * One per runnable project: reads the project's setup resource when the project
 * starts ({@code onStartup}, seen working in the spike, docs/platform-checks.md
 * check 4) and keeps the registry in step. Reading a changed setup without a
 * restart is entry 6's ({@code onResourcesModified} is [not verified]); this
 * lifecycle already re-reads it.
 */
public final class SetupLifecycle extends ResourceCollectionLifecycle {

    private final SetupRegistry registry;

    public SetupLifecycle(RuntimeResourceCollection project, SetupRegistry registry) {
        super(project);
        this.registry = registry;
    }

    private String project() {
        return getResourceCollection().getName();
    }

    @Override
    protected void onStartup(List<Resource> resources) {
        read(resources);
    }

    @Override
    protected void onShutdown(List<ResourceId> resources) {
        registry.remove(project());
    }

    @Override
    protected void onResourcesCreated(List<Resource> resources) {
        read(resources);
    }

    @Override
    protected void onResourcesModified(List<Resource> resources) {
        read(resources);
    }

    @Override
    protected void onResourcesDeleted(List<ResourceId> resources) {
        registry.remove(project());
    }

    private void read(List<Resource> resources) {
        for (Resource resource : resources) {
            if (!MapStudioModule.SETUP_RESOURCE_TYPE.equals(resource.getResourceType())) {
                continue;
            }
            Optional<String> text = resource.getData(MapStudioModule.SETUP_FILE).map(ImmutableBytes::getBytesAsString);
            if (text.isEmpty()) {
                registry.putProblem(project(), "the setup resource " + resource.getResourcePath() + " has no "
                    + MapStudioModule.SETUP_FILE + ".");
                return;
            }
            try {
                registry.put(project(), Setup.parse(text.get()));
            } catch (Setup.SetupException ex) {
                registry.putProblem(project(), ex.getMessage());
            }
            return;
        }
    }
}
