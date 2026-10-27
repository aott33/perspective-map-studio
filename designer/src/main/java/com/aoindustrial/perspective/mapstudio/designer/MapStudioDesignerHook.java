package com.aoindustrial.perspective.mapstudio.designer;

import com.inductiveautomation.ignition.common.BundleUtil;
import com.inductiveautomation.ignition.common.licensing.LicenseState;
import com.inductiveautomation.ignition.common.script.ScriptManager;
import com.inductiveautomation.ignition.common.script.hints.PropertiesFileDocProvider;
import com.inductiveautomation.ignition.common.util.LoggerEx;
import com.inductiveautomation.ignition.designer.model.AbstractDesignerModuleHook;
import com.inductiveautomation.ignition.designer.model.DesignerContext;
import com.inductiveautomation.perspective.designer.DesignerComponentRegistry;
import com.inductiveautomation.perspective.designer.api.PerspectiveDesignerInterface;

import com.aoindustrial.perspective.mapstudio.common.MapStudioComponent;
import com.aoindustrial.perspective.mapstudio.designer.setup.SetupWorkspace;

/**
 * Designer scope hook: puts the Map Studio component in the Perspective palette
 * and the project's Map Studio setup in the project browser (epic 2 story 7).
 */
public class MapStudioDesignerHook extends AbstractDesignerModuleHook {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.designer");

    /** The Designer texts, {@code MapStudioDesigner.properties} beside this class. */
    private static final String BUNDLE = "MapStudioDesigner";

    private DesignerComponentRegistry registry;

    @Override
    public void startup(DesignerContext context, LicenseState activationState) throws Exception {
        PerspectiveDesignerInterface pdi = PerspectiveDesignerInterface.get(context);
        this.registry = pdi.getDesignerComponentRegistry();
        log.info("Registering the Map Studio component in the Designer.");
        this.registry.registerComponent(MapStudioComponent.DESCRIPTOR);
        BundleUtil.get().addBundle(BUNDLE, MapStudioDesignerHook.class, BUNDLE);
        try {
            context.registerResourceWorkspace(new SetupWorkspace(context));
        } catch (RuntimeException | LinkageError ex) {
            // The component stays usable without the setup editor.
            log.error("Could not add the Map Studio Setup editor to the Designer.", ex);
        }
    }

    /** The same {@code system.mapstudio} module as the Gateway, for autocomplete and the script console. */
    @Override
    public void initializeScriptManager(ScriptManager manager) {
        super.initializeScriptManager(manager);
        manager.addScriptModule("system.mapstudio", new DesignerScriptModule(), new PropertiesFileDocProvider());
    }

    @Override
    public void shutdown() {
        if (this.registry != null) {
            this.registry.removeComponent(MapStudioComponent.COMPONENT_ID);
        }
        BundleUtil.get().removeBundle(BUNDLE);
    }
}
