package com.aoindustrial.perspective.mapstudio.designer.setup;

import java.awt.BorderLayout;
import java.nio.charset.StandardCharsets;

import com.inductiveautomation.ignition.common.resourcecollection.Resource;
import com.inductiveautomation.ignition.common.resourcecollection.ResourceBuilder;
import com.inductiveautomation.ignition.common.resourcecollection.ResourcePath;
import com.inductiveautomation.ignition.common.util.LoggerEx;
import com.inductiveautomation.ignition.designer.project.DesignableProject;
import com.inductiveautomation.ignition.designer.tabbedworkspace.ResourceEditor;
import com.inductiveautomation.ignition.designer.tabbedworkspace.TabbedResourceWorkspace;

import com.aoindustrial.perspective.mapstudio.common.MapStudioModule;

/**
 * The setup editor tab (epic 2 stories 7 and 16): a {@link SetupPanel} on the project's one
 * setup resource. A save with reasons left is refused and writes nothing; the refusal fails the
 * project save with the Designer's own save failure and no Map Studio dialog (owner, 2026-10-27);
 * a read-only setup is never written.
 *
 * <p>SDK behaviour read from the 8.3.0 jars with javap, not yet seen in a Designer
 * [unverified]: {@code ResourceEditor}'s constructor reads the resource and calls {@link #init}
 * before this class's fields are set, so the panel is made in {@code init}; {@code commit()}
 * calls {@link #getObjectForSave}, skips the write when {@link #isOptimizeCommits} and the object
 * equals the one read, and hands any exception to {@link #onCommitFailed}, whose throw leaves
 * {@code commit()}.
 */
public final class SetupEditor extends ResourceEditor<SetupForm> {

    private static final LoggerEx LOG = LoggerEx.newBuilder().build("MapStudio.designer");

    /** Not final and not initialised here: the super constructor calls {@link #init} first. */
    private SetupPanel panel;

    public SetupEditor(TabbedResourceWorkspace workspace, ResourcePath path) {
        super(workspace, path);
    }

    @Override
    protected boolean isOptimizeCommits() {
        return true;
    }

    @Override
    public String getTabTitle() {
        return SetupForm.msg("setup.tab");
    }

    @Override
    protected SetupForm deserialize(Resource resource) {
        return resource.getData(MapStudioModule.SETUP_FILE)
            .map(bytes -> SetupForm.fromJson(new String(bytes.getBytes(), StandardCharsets.UTF_8)))
            .orElseGet(SetupForm::missingFile);
    }

    @Override
    protected void init(SetupForm form) {
        if (panel == null) {
            // No edit callback: ResourceEditor has no dirty flag to raise. The project save
            // commits this tab (MapStudioDesignerHook.notifyProjectSaveStart) and commit()
            // compares the form with the one read [SDK 8.3.0 javap].
            panel = new SetupPanel(null, null, new DesignerListSource(context), SetupListSource.Async.SWING);
            setLayout(new BorderLayout());
            add(panel, BorderLayout.CENTER);
        }
        DesignableProject project = context.getProject();
        ResourcePath path = getResourcePath();
        boolean inherited = project.isInherited(path);
        boolean locked = inherited && !project.isOverridable(path);
        String note = "";
        if (inherited) {
            String from = project.getDefiningProject(path);
            note = SetupForm.msg(locked ? "setup.state.inheritedLocked" : "setup.state.inherited", from);
        }
        panel.show(form, locked, note);
    }

    @Override
    protected SetupForm getObjectForSave() throws SetupRefusedException {
        return SetupCommit.formToSave(panel, getResource());
    }

    @Override
    protected void serializeResource(ResourceBuilder builder, SetupForm form) {
        builder.putData(MapStudioModule.SETUP_FILE, form.toJson().getBytes(StandardCharsets.UTF_8));
    }

    @Override
    protected void onCommitFailed(Exception ex) {
        if (ex instanceof SetupRefusedException) {
            SetupRefusedException.NotSaved notSaved =
                new SetupRefusedException.NotSaved(context.getProject().getName(), (SetupRefusedException) ex);
            LOG.warn(notSaved.getMessage());
            // No dialog: the reasons are beside their fields and in the footer. The throw fails
            // the project save, which the Designer reports in its own words [unverified].
            throw notSaved;
        }
        super.onCommitFailed(ex);
    }
}
