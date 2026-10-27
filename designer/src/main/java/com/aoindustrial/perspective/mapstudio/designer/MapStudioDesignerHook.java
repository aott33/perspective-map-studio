package com.aoindustrial.perspective.mapstudio.designer;

import java.awt.EventQueue;
import java.lang.reflect.InvocationTargetException;

import com.inductiveautomation.ignition.common.BundleUtil;
import com.inductiveautomation.ignition.common.licensing.LicenseState;
import com.inductiveautomation.ignition.common.script.ScriptManager;
import com.inductiveautomation.ignition.common.script.hints.PropertiesFileDocProvider;
import com.inductiveautomation.ignition.common.util.LoggerEx;
import com.inductiveautomation.ignition.designer.model.AbstractDesignerModuleHook;
import com.inductiveautomation.ignition.designer.model.DesignerContext;
import com.inductiveautomation.ignition.designer.model.SaveContext;
import com.inductiveautomation.perspective.designer.DesignerComponentRegistry;
import com.inductiveautomation.perspective.designer.api.PerspectiveDesignerInterface;

import com.aoindustrial.perspective.mapstudio.common.MapStudioComponent;
import com.aoindustrial.perspective.mapstudio.designer.setup.SetupRefusedException;
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
    private SetupWorkspace setupWorkspace;

    @Override
    public void startup(DesignerContext context, LicenseState activationState) throws Exception {
        PerspectiveDesignerInterface pdi = PerspectiveDesignerInterface.get(context);
        this.registry = pdi.getDesignerComponentRegistry();
        log.info("Registering the Map Studio component in the Designer.");
        this.registry.registerComponent(MapStudioComponent.DESCRIPTOR);
        BundleUtil.get().addBundle(BUNDLE, MapStudioDesignerHook.class, BUNDLE);
        try {
            SetupWorkspace workspace = new SetupWorkspace(context);
            context.registerResourceWorkspace(workspace);
            this.setupWorkspace = workspace;
        } catch (RuntimeException | LinkageError ex) {
            // The component stays usable without the setup editor.
            log.error("Could not add the Map Studio Setup editor to the Designer.", ex);
        }
    }

    /**
     * Commits the open setup tab into the project before the project save uploads it.
     * The Designer commits only its own workspaces (scripts, named queries) and asks
     * each module hook here [SDK 8.3.0 javap: {@code IgnitionDesigner.getCommitTasks}];
     * nothing commits a module's {@code TabbedResourceWorkspace} for it. The SDK has no
     * dirty flag on {@code ResourceEditor}: {@code commit()} compares the form with the
     * one read, so every save is asked and an unchanged setup writes nothing. A setup with
     * reasons left (an open tab or a new setup) fails the save here, with no Map Studio dialog.
     */
    @Override
    public void notifyProjectSaveStart(SaveContext save) throws Exception {
        SetupWorkspace workspace = this.setupWorkspace;
        if (workspace == null) {
            return;
        }
        // The save runs off the Swing thread; the editors read Swing fields.
        if (EventQueue.isDispatchThread()) {
            workspace.commitAll();
        } else {
            try {
                EventQueue.invokeAndWait(workspace::commitAll);
            } catch (InvocationTargetException ex) {
                if (ex.getCause() instanceof SetupRefusedException.NotSaved) {
                    // Already logged; failing here fails the project save with the Designer's own
                    // save failure and no Map Studio dialog (owner, 2026-10-27) [unverified wording].
                    throw (SetupRefusedException.NotSaved) ex.getCause();
                }
                log.error("Map Studio setup could not be committed for the project save.", ex.getCause());
            }
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
        this.setupWorkspace = null;
        BundleUtil.get().removeBundle(BUNDLE);
    }
}
