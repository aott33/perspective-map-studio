package com.aoindustrial.perspective.mapstudio.gateway.spike;

import com.inductiveautomation.ignition.common.resourcecollection.ResourceFilter;
import com.inductiveautomation.ignition.common.resourcecollection.RuntimeResourceCollection;
import com.inductiveautomation.ignition.gateway.model.GatewayContext;
import com.inductiveautomation.ignition.gateway.resourcecollection.ResourceCollectionLifecycleFactory;

/**
 * Creates one {@link ChecksLifecycle} per runnable project (enabled and not
 * inheritable, the factory's default filter) and feeds it the project's
 * {@code setup} resources and their later changes.
 */
public final class ChecksLifecycleFactory extends ResourceCollectionLifecycleFactory<ChecksLifecycle> {

    private final GatewayContext context;

    public ChecksLifecycleFactory(GatewayContext context) {
        super(context.getProjectManager());
        this.context = context;
    }

    @Override
    public ChecksLifecycle createLifecycle(RuntimeResourceCollection project) {
        return new ChecksLifecycle(project, context);
    }

    @Override
    protected ResourceFilter getResourceFilter() {
        return ResourceFilter.newBuilder()
            .addResourceType(SetupResource.RESOURCE_TYPE)
            .build();
    }
}
