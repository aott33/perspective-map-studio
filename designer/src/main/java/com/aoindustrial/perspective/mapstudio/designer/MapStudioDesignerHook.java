package com.aoindustrial.perspective.mapstudio.designer;

import com.inductiveautomation.ignition.common.licensing.LicenseState;
import com.inductiveautomation.ignition.common.util.LoggerEx;
import com.inductiveautomation.ignition.designer.model.AbstractDesignerModuleHook;
import com.inductiveautomation.ignition.designer.model.DesignerContext;
import com.inductiveautomation.perspective.designer.DesignerComponentRegistry;
import com.inductiveautomation.perspective.designer.api.PerspectiveDesignerInterface;

import com.aoindustrial.perspective.mapstudio.common.MapStudioComponent;

/**
 * Designer scope hook: puts the Map Studio component in the Perspective palette.
 */
public class MapStudioDesignerHook extends AbstractDesignerModuleHook {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.designer");

    private DesignerComponentRegistry registry;

    @Override
    public void startup(DesignerContext context, LicenseState activationState) throws Exception {
        PerspectiveDesignerInterface pdi = PerspectiveDesignerInterface.get(context);
        this.registry = pdi.getDesignerComponentRegistry();
        log.info("Registering the Map Studio component in the Designer.");
        this.registry.registerComponent(MapStudioComponent.DESCRIPTOR);
    }

    @Override
    public void shutdown() {
        if (this.registry != null) {
            this.registry.removeComponent(MapStudioComponent.COMPONENT_ID);
        }
    }
}
