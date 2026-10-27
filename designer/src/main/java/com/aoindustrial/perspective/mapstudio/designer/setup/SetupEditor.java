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
 * The setup editor tab (epic 2 stories 7 and 16, fix 16): a {@link SetupPanel} on the project's
 * one setup resource. A setup with reasons left is held back from the project save: the rest of
 * the project saves, nothing of the setup is written, and the tab keeps its changes and reasons,
 * its tab and node reading "(unsaved)" (owner, 2026-10-27). A read-only setup is never written.
 *
 * <p>SDK behaviour read from the 8.3.0 jars with javap, not yet seen in a Designer
 * [unverified]: {@code ResourceEditor}'s constructor reads the resource and calls {@link #init}
 * before this class's fields are set, so the panel is made in {@code init}; {@code commit()}
 * calls {@link #getObjectForSave} and, with {@link #isOptimizeCommits}, writes nothing when that
 * object equals the one read ("Avoiding commit - resource has not changed."), which is how the
 * setup is held back; a throw from {@code commit()} would instead fail the whole project save
 * (the Designer's module commit task returns false and shows "Error encountered in module ...
 * while saving."), which is what story 16 did.
 */
public final class SetupEditor extends ResourceEditor<SetupForm> {

    private static final LoggerEx LOG = LoggerEx.newBuilder().build("MapStudio.designer");

    /** Not final and not initialised here: the super constructor calls {@link #init} first. */
    private SetupPanel panel;
    /** True when the last project save held this setup back. */
    private boolean heldBack;

    public SetupEditor(TabbedResourceWorkspace workspace, ResourcePath path) {
        super(workspace, path);
    }

    @Override
    protected boolean isOptimizeCommits() {
        return true;
    }

    @Override
    public String getTabTitle() {
        return SetupForm.msg(hasUnsavedChanges() ? "setup.node.unsaved" : "setup.tab");
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
            // ResourceEditor has no dirty flag to raise: the project save commits this tab
            // (MapStudioDesignerHook.notifyProjectSaveStart) and commit() compares the form with
            // the one read [SDK 8.3.0 javap]. An edit only updates the "(unsaved)" words.
            panel = new SetupPanel(this::edited, null, new DesignerListSource(context), SetupListSource.Async.SWING);
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
        heldBack = false;
        panel.show(form, locked, note);
        edited();
    }

    /** The form holds changes the project does not have. */
    boolean hasUnsavedChanges() {
        return panel != null && panel.hasUnsavedChanges();
    }

    /** True when the last project save held this setup back; cleared when read. */
    boolean takeHeldBack() {
        boolean was = heldBack;
        heldBack = false;
        return was;
    }

    private void edited() {
        if (workspace instanceof SetupWorkspace w) {
            w.refreshNode();
        }
    }

    @Override
    protected SetupForm getObjectForSave() {
        SetupCommit.Decision d = SetupCommit.formToSave(panel, getResource());
        if (d.isHeldBack()) {
            heldBack = true;
            LOG.warn(SetupForm.msg("setup.heldBack.log", context.getProject().getName(), d.summary()));
        }
        return d.form();
    }

    @Override
    protected void serializeResource(ResourceBuilder builder, SetupForm form) {
        builder.putData(MapStudioModule.SETUP_FILE, form.toJson().getBytes(StandardCharsets.UTF_8));
    }
}
