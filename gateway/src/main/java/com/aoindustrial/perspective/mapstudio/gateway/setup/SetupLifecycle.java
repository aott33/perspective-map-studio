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
 * starts ({@code onStartup}, seen in the spike, docs/platform-checks.md check 4)
 * and again whenever it is created, modified or deleted, so a changed setup
 * applies with no restart. After an edit of {@code setup.json} on disk, a project
 * scan ({@code POST /data/api/v1/scan/projects}, {@code ops/scan.sh}) calls
 * {@code onResourcesModified} within a second; the file edit alone calls nothing
 * [live 8.3.10, docs/platform-checks.md "Epic 2 story 6"]. A Designer save is
 * expected to call the same hook [not verified].
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
        read(registry, project(), resources, null);
    }

    @Override
    protected void onShutdown(List<ResourceId> resources) {
        registry.remove(project());
    }

    @Override
    protected void onResourcesCreated(List<Resource> resources) {
        read(registry, project(), resources, "resource created");
    }

    @Override
    protected void onResourcesModified(List<Resource> resources) {
        read(registry, project(), resources, "resource modified");
    }

    @Override
    protected void onResourcesDeleted(List<ResourceId> resources) {
        deleted(registry, project(), resources);
    }

    /**
     * Read the project's setup resource, if {@code resources} holds one, and replace
     * the project's state: valid, or invalid with every problem. {@code cause} names
     * the hook for the log line (null at project start).
     */
    static void read(SetupRegistry registry, String project, List<Resource> resources, String cause) {
        for (Resource resource : resources) {
            if (!MapStudioModule.SETUP_RESOURCE_TYPE.equals(resource.getResourceType())) {
                continue;
            }
            Optional<String> text = resource.getData(MapStudioModule.SETUP_FILE).map(ImmutableBytes::getBytesAsString);
            if (text.isEmpty()) {
                registry.putProblem(project, MapStudioModule.SETUP_FILE + " is missing from the setup resource.", cause);
                return;
            }
            Setup.Reading reading = Setup.read(text.get());
            if (reading.ok()) {
                registry.put(project, reading.setup(), cause);
            } else {
                registry.putProblem(project, reading.reason(), cause);
            }
            return;
        }
    }

    /** The setup resource was deleted: the project's state becomes missing. */
    static void deleted(SetupRegistry registry, String project, List<ResourceId> resources) {
        for (ResourceId id : resources) {
            if (MapStudioModule.SETUP_RESOURCE_TYPE.equals(id.getResourceType())) {
                registry.deleted(project);
                return;
            }
        }
    }
}
