package com.aoindustrial.perspective.mapstudio.designer.setup;

import java.awt.BorderLayout;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import javax.swing.JOptionPane;
import javax.swing.SwingUtilities;

import com.inductiveautomation.ignition.common.resourcecollection.Resource;
import com.inductiveautomation.ignition.common.resourcecollection.ResourceBuilder;
import com.inductiveautomation.ignition.common.resourcecollection.ResourcePath;
import com.inductiveautomation.ignition.common.util.LoggerEx;
import com.inductiveautomation.ignition.designer.project.DesignableProject;
import com.inductiveautomation.ignition.designer.tabbedworkspace.ResourceEditor;
import com.inductiveautomation.ignition.designer.tabbedworkspace.TabbedResourceWorkspace;

import com.aoindustrial.perspective.mapstudio.common.MapStudioModule;

/**
 * The setup editor tab (epic 2 story 7): a {@link SetupPanel} on the project's one
 * setup resource. A save with reasons left is refused with them and writes
 * nothing; a read-only setup is never written.
 *
 * <p>SDK behaviour read from the 8.3.0 jars with javap, not yet seen in a Designer
 * [not verified]: {@code ResourceEditor}'s constructor reads the resource and calls
 * {@link #init} before this class's fields are set, so the panel is made in
 * {@code init}; {@code commit()} calls {@link #getObjectForSave}, skips the write
 * when {@link #isOptimizeCommits} and the object equals the one read, modifies a
 * local resource or creates this project's own copy of an inherited one, and hands
 * any exception to {@link #onCommitFailed}.
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
            panel = new SetupPanel(null);
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
        if (panel == null || panel.isLocked()) {
            return getResource();
        }
        SetupForm form = panel.current();
        Map<String, List<String>> reasons = form.reasons();
        if (!reasons.isEmpty()) {
            throw new SetupRefusedException(reasons);
        }
        return form;
    }

    @Override
    protected void serializeResource(ResourceBuilder builder, SetupForm form) {
        builder.putData(MapStudioModule.SETUP_FILE, form.toJson().getBytes(StandardCharsets.UTF_8));
    }

    @Override
    protected void onCommitFailed(Exception ex) {
        if (ex instanceof SetupRefusedException) {
            SetupRefusedException refused = (SetupRefusedException) ex;
            LOG.warnf("Map Studio setup of project %s not saved: %s", context.getProject().getName(),
                refused.getMessage());
            SwingUtilities.invokeLater(() -> JOptionPane.showMessageDialog(this, refused.describe(),
                SetupForm.msg("setup.refused.title"), JOptionPane.ERROR_MESSAGE));
            return;
        }
        super.onCommitFailed(ex);
    }

    /** A save refused because the form still has reasons; its message names the fields. */
    public static final class SetupRefusedException extends Exception {
        private final Map<String, List<String>> reasons;

        public SetupRefusedException(Map<String, List<String>> reasons) {
            super(summary(reasons));
            this.reasons = reasons;
        }

        public Map<String, List<String>> reasons() {
            return reasons;
        }

        /** The dialog text: the heading and one line per field. */
        public String describe() {
            StringBuilder sb = new StringBuilder(SetupForm.msg("setup.refused.message"));
            reasons.forEach((field, list) -> sb.append("\n- ")
                .append(field.isEmpty() ? "" : SetupForm.msg("setup.label." + field) + ": ")
                .append(String.join(" ", list)));
            return sb.toString();
        }

        private static String summary(Map<String, List<String>> reasons) {
            StringBuilder sb = new StringBuilder();
            reasons.forEach((field, list) -> sb.append(sb.length() == 0 ? "" : "; ")
                .append(field.isEmpty() ? "setup" : field).append(": ").append(String.join(" ", list)));
            return sb.toString();
        }
    }
}
