package com.aoindustrial.perspective.mapstudio.designer.setup;

import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import javax.swing.AbstractAction;
import javax.swing.JButton;
import javax.swing.JDialog;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JPopupMenu;
import javax.swing.tree.TreePath;

import com.inductiveautomation.ignition.common.model.ApplicationScope;
import com.inductiveautomation.ignition.common.resourcecollection.ResourcePath;
import com.inductiveautomation.ignition.common.util.LoggerEx;
import com.inductiveautomation.ignition.designer.model.DesignerContext;
import com.inductiveautomation.ignition.designer.navtree.model.AbstractNavTreeNode;
import com.inductiveautomation.ignition.designer.tabbedworkspace.ResourceDescriptor;
import com.inductiveautomation.ignition.designer.tabbedworkspace.ResourceEditor;
import com.inductiveautomation.ignition.designer.tabbedworkspace.ResourceFolderNode;
import com.inductiveautomation.ignition.designer.tabbedworkspace.TabbedResourceWorkspace;

import com.aoindustrial.perspective.mapstudio.common.MapStudioModule;

/**
 * The Designer workspace of the project's one Map Studio setup (epic 2 story 7):
 * a "Map Studio Setup" node in the project browser that opens the setup at the
 * type folder ({@code com.aoindustrial.perspective.mapstudio/setup/}, story 1's
 * layout) in a {@link SetupEditor} tab, or offers "Create setup" when the project
 * has none. Creating goes through a dialog with the same form, and writes the
 * resource only when the form has no reasons left.
 *
 * <p>Built from the 8.3.0 SDK signatures (javap) and IA's project-resource example;
 * whether {@code TabbedResourceWorkspace} opens a resource at the type folder is
 * not seen in a Designer yet [not verified]; the plan's fallback is a plain node
 * opening the same panel in a dialog.
 */
public final class SetupWorkspace extends TabbedResourceWorkspace {

    public static final String KEY = "mapstudio-setup-workspace";

    private static final LoggerEx LOG = LoggerEx.newBuilder().build("MapStudio.designer");

    /** The one setup per project, at the type folder. */
    public static final ResourcePath SETUP_PATH = MapStudioModule.SETUP_RESOURCE_TYPE.rootPath();

    public SetupWorkspace(DesignerContext context) {
        super(context, ResourceDescriptor.builder()
            .resourceType(MapStudioModule.SETUP_RESOURCE_TYPE)
            .nounKey("MapStudioDesigner.setup.noun")
            .rootFolderText(SetupForm.msg("setup.root"))
            .scope(ApplicationScope.GATEWAY)
            .build());
    }

    @Override
    public String getKey() {
        return KEY;
    }

    @Override
    protected AbstractNavTreeNode createRootNavTreeNode() {
        return new SetupNode(this);
    }

    @Override
    protected ResourceEditor<SetupForm> newResourceEditor(ResourcePath path) {
        return new SetupEditor(this, path);
    }

    /** No folder node: the setup is one resource at the type folder. */
    @Override
    public void addNewResourceActions(ResourceFolderNode folder, JPopupMenu menu) {
    }

    boolean hasSetup() {
        return context.getProject().getResource(SETUP_PATH).isPresent();
    }

    /** Opens the setup, or asks to create it when the project has none. */
    void openOrCreate() {
        if (hasSetup()) {
            open(SETUP_PATH);
        } else {
            create();
        }
    }

    /** The "Create setup" dialog: the form with the defaults; the resource is written only when it may be saved. */
    void create() {
        JDialog dialog = new JDialog(context.getFrame(), SetupForm.msg("setup.create.title"), true);
        SetupPanel panel = new SetupPanel(null);
        JButton save = new JButton(SetupForm.msg("setup.create.save"));
        JButton cancel = new JButton(SetupForm.msg("setup.create.cancel"));
        save.addActionListener(e -> {
            SetupForm form = panel.current();
            Map<String, List<String>> reasons = form.reasons();
            if (!reasons.isEmpty()) {
                JOptionPane.showMessageDialog(dialog,
                    new SetupRefusedException(reasons).describe(),
                    SetupForm.msg("setup.refused.title"), JOptionPane.ERROR_MESSAGE);
                return;
            }
            try {
                context.getProject().createOrModify(SETUP_PATH, builder -> builder
                    .putData(MapStudioModule.SETUP_FILE, form.toJson().getBytes(StandardCharsets.UTF_8))
                    .setApplicationScope(ApplicationScope.GATEWAY));
                LOG.infof("Map Studio setup created in project %s (saved to the Gateway at the next project save).",
                    context.getProject().getName());
                dialog.dispose();
                open(SETUP_PATH);
            } catch (RuntimeException ex) {
                LOG.error("Map Studio setup could not be created.", ex);
                JOptionPane.showMessageDialog(dialog, ex.getMessage(), SetupForm.msg("setup.refused.title"),
                    JOptionPane.ERROR_MESSAGE);
            }
        });
        cancel.addActionListener(e -> dialog.dispose());
        JPanel buttons = new JPanel(new FlowLayout(FlowLayout.RIGHT));
        buttons.add(cancel);
        buttons.add(save);
        dialog.getContentPane().add(panel, BorderLayout.CENTER);
        dialog.getContentPane().add(buttons, BorderLayout.SOUTH);
        dialog.setSize(720, 640);
        dialog.setLocationRelativeTo(context.getFrame());
        dialog.setVisible(true);
    }

    /** The project browser node: double-click opens or creates; the menu says which. */
    static final class SetupNode extends AbstractNavTreeNode {
        private final SetupWorkspace workspace;

        SetupNode(SetupWorkspace workspace) {
            this.workspace = workspace;
            setText(SetupForm.msg("setup.root"));
        }

        @Override
        public boolean isLeaf() {
            return true;
        }

        @Override
        public String getWorkspaceName() {
            return KEY;
        }

        @Override
        public void onDoubleClick() {
            workspace.openOrCreate();
        }

        @Override
        protected void initPopupMenu(JPopupMenu menu, TreePath[] paths, List<AbstractNavTreeNode> selection,
                                     int modifiers) {
            boolean exists = workspace.hasSetup();
            menu.add(new AbstractAction(SetupForm.msg(exists ? "setup.action.open" : "setup.action.create")) {
                @Override
                public void actionPerformed(java.awt.event.ActionEvent e) {
                    workspace.openOrCreate();
                }
            });
        }
    }
}
