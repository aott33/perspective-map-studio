package com.aoindustrial.perspective.mapstudio.gateway.setup;

import com.inductiveautomation.ignition.common.resourcecollection.ResourceFilter;
import com.inductiveautomation.ignition.common.resourcecollection.RuntimeResourceCollection;
import com.inductiveautomation.ignition.gateway.model.GatewayContext;
import com.inductiveautomation.ignition.gateway.resourcecollection.ResourceCollectionLifecycleFactory;

import com.aoindustrial.perspective.mapstudio.common.MapStudioModule;

/**
 * Creates one {@link SetupLifecycle} per runnable project (enabled and not
 * inheritable, the factory's default filter) and feeds it the project's
 * {@code setup} resources (the spike's {@code ChecksLifecycleFactory}, commit 51104c8).
 */
public final class SetupLifecycleFactory extends ResourceCollectionLifecycleFactory<SetupLifecycle> {

    private final SetupRegistry registry;

    public SetupLifecycleFactory(GatewayContext context, SetupRegistry registry) {
        super(context.getProjectManager());
        this.registry = registry;
    }

    @Override
    public SetupLifecycle createLifecycle(RuntimeResourceCollection project) {
        return new SetupLifecycle(project, registry);
    }

    @Override
    protected ResourceFilter getResourceFilter() {
        return ResourceFilter.newBuilder()
            .addResourceType(MapStudioModule.SETUP_RESOURCE_TYPE)
            .build();
    }
}
