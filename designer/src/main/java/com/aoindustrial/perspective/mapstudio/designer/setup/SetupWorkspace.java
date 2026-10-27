package com.aoindustrial.perspective.mapstudio.designer.setup;

import java.awt.event.ActionEvent;
import java.nio.charset.StandardCharsets;
import java.util.List;

import javax.swing.AbstractAction;
import javax.swing.JPopupMenu;
import javax.swing.SwingUtilities;
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
 * The Designer workspace of the project's one Map Studio setup (epic 2 stories 7 and 16): a
 * "Map Studio Setup" node in the project browser; double-click is the only way in (no node menu).
 * A project with a setup opens it in a {@link SetupEditor} tab. A project with none opens a
 * "Map Studio Setup" tab of its own holding the same {@link SetupPanel} in the empty state;
 * Create setup fills it with the defaults, marked new, and nothing is in the project until
 * File > Save, which creates the resource when the form has no reasons left and otherwise holds
 * it back while the rest of the project saves (fix 16). Discard new setup returns to the empty
 * state. The node reads "(none)", "(new, unsaved)", "(unsaved)" or "(inherited)" after its name,
 * and the tab says "(unsaved)" too while the form holds changes the project does not have.
 *
 * <p>Built from the 8.3.0 SDK (javap) and not seen in a Designer [unverified]:
 * {@code ResourceEditor} cannot open a resource that does not exist (its constructor throws), so
 * the empty and new states are a plain tab added to this {@code JideTabbedPane}; the workspace's
 * close action is replaced so it closes that tab too (the SDK's casts the selected tab to
 * {@code ResourceEditor}); the tab popup ignores a tab that is not an editor (the SDK catches the
 * cast). Whether a resource created during {@code notifyProjectSaveStart} goes up with that same
 * save is part of the owner's check.
 */
public final class SetupWorkspace extends TabbedResourceWorkspace {

    public static final String KEY = "mapstudio-setup-workspace";

    private static final LoggerEx LOG = LoggerEx.newBuilder().build("MapStudio.designer");

    /** The one setup per project, at the type folder. */
    public static final ResourcePath SETUP_PATH = MapStudioModule.SETUP_RESOURCE_TYPE.rootPath();

    private SetupPanel draft;
    private boolean draftNew;

    public SetupWorkspace(DesignerContext context) {
        super(context, ResourceDescriptor.builder()
            .resourceType(MapStudioModule.SETUP_RESOURCE_TYPE)
            .nounKey("MapStudioDesigner.setup.noun")
            .rootFolderText(SetupForm.msg("setup.root"))
            .scope(ApplicationScope.GATEWAY)
            .build());
        setCloseAction(new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                closeSelected();
            }
        });
        refreshNode();
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

    @Override
    protected JPopupMenu getTabPopupMenu(ResourceEditor editor) {
        return editor == null ? null : super.getTabPopupMenu(editor);
    }

    boolean hasSetup() {
        return context.getProject().getResource(SETUP_PATH).isPresent();
    }

    /** Double-click on the node: the setup's tab, or the empty (or new) setup tab. */
    void openSetup() {
        if (hasSetup()) {
            dropDraft();
            open(SETUP_PATH);
        } else {
            showDraftTab();
        }
        refreshNode();
    }

    private void showDraftTab() {
        if (draft == null) {
            draft = new SetupPanel(this::refreshNode, null, new DesignerListSource(context),
                SetupListSource.Async.SWING);
            draft.onCreate(() -> {
                draftNew = true;
                draft.showNew();
                refreshNode();
            });
            draft.onDiscard(() -> {
                draftNew = false;
                draft.showEmpty();
                refreshNode();
            });
        }
        if (indexOfComponent(draft) < 0) {
            if (draftNew) {
                draft.repaint();
            } else {
                draft.showEmpty();
            }
            addTab(SetupForm.msg(draftNew ? "setup.node.new" : "setup.tab"), getDescriptor().getNavRootIcon(), draft,
                null);
        }
        setSelectedComponent(draft);
    }

    /**
     * The project has the setup now (saved here, or pulled in from another Designer's save): a new
     * setup still in memory is dropped, so a later save never overwrites the project's setup with it.
     */
    private void dropDraft() {
        if (draftNew) {
            LOG.info("Map Studio setup: the project has a setup now, so the new unsaved one was dropped.");
        }
        draftNew = false;
        removeDraftTab();
        if (draft != null) {
            draft.showEmpty();
        }
    }

    private void removeDraftTab() {
        if (draft != null && indexOfComponent(draft) >= 0) {
            remove(draft);
        }
    }

    private void closeSelected() {
        java.awt.Component selected = getSelectedComponent();
        if (selected instanceof ResourceEditor) {
            close(((ResourceEditor<?>) selected).getResourcePath());
        } else if (selected != null && selected == draft) {
            // A new setup stays in memory (the node says "(new, unsaved)"); Discard drops it.
            remove(draft);
        }
    }

    /**
     * Commits the open editors (story 7), then a new setup. A setup with reasons left is held back
     * from this save (owner, 2026-10-27, fix 16): the open tab's commit writes nothing (its
     * {@code getObjectForSave} hands back the setup as read), a new setup is not created, the rest
     * of the project saves, and the setup's tab is brought forward (reopened for a new setup whose
     * tab was closed) with its changes and reasons, "(unsaved)" on its tab and node. No dialog and
     * no throw: a throw here would fail the whole project save. A new setup is dropped first when
     * the project has a setup by now.
     */
    @Override
    public void commitAll() {
        if (draftNew && hasSetup()) {
            // Never overwrite a setup that reached the project since Create setup was pressed.
            dropDraft();
            refreshNode();
        }
        super.commitAll();
        for (ResourceEditor<?> e : getEditors()) {
            if (e instanceof SetupEditor editor && editor.takeHeldBack()) {
                SwingUtilities.invokeLater(() -> {
                    if (indexOfComponent(editor) >= 0) {
                        setSelectedComponent(editor);
                    }
                    refreshNode();
                });
            }
        }
        if (!draftNew || draft == null) {
            return;
        }
        SetupCommit.Decision d = SetupCommit.newSetupToSave(draft);
        if (d.isHeldBack()) {
            LOG.warn(SetupForm.msg("setup.heldBack.log", context.getProject().getName(), d.summary()));
            // A new setup's tab may have been closed: reopen it, so what was held back is on screen.
            SwingUtilities.invokeLater(() -> {
                showDraftTab();
                refreshNode();
            });
            return;
        }
        SetupForm form = d.form();
        context.getProject().createOrModify(SETUP_PATH, builder -> builder
            .putData(MapStudioModule.SETUP_FILE, form.toJson().getBytes(StandardCharsets.UTF_8))
            .setApplicationScope(ApplicationScope.GATEWAY));
        LOG.infof("Map Studio setup created in project %s with this project save.", context.getProject().getName());
        draftNew = false;
        SwingUtilities.invokeLater(() -> {
            removeDraftTab();
            open(SETUP_PATH);
            refreshNode();
        });
    }

    /** True when an open setup tab holds changes the project does not have. */
    private boolean openSetupUnsaved() {
        for (ResourceEditor<?> e : getEditors()) {
            if (e instanceof SetupEditor editor && editor.hasUnsavedChanges()) {
                return true;
            }
        }
        return false;
    }

    /** The node's words: the name, and "(none)", "(new, unsaved)" or "(inherited)". */
    String nodeText() {
        boolean has = hasSetup();
        return SetupCommit.nodeText(has, has && context.getProject().isInherited(SETUP_PATH), draftNew,
            has && openSetupUnsaved());
    }

    /** The node's words, and each setup tab's title ("(unsaved)" while it holds changes). */
    void refreshNode() {
        AbstractNavTreeNode node = getRootNode();
        if (node instanceof SetupNode) {
            ((SetupNode) node).update(nodeText());
        }
        for (ResourceEditor<?> e : getEditors()) {
            int i = indexOfComponent(e);
            if (i >= 0 && !e.getTabTitle().equals(getTitleAt(i))) {
                setTitleAt(i, e.getTabTitle());
            }
        }
        if (draft != null) {
            int i = indexOfComponent(draft);
            String title = SetupForm.msg(draftNew ? "setup.node.new" : "setup.tab");
            if (i >= 0 && !title.equals(getTitleAt(i))) {
                setTitleAt(i, title);
            }
        }
    }

    @Override
    public void onActivation() {
        super.onActivation();
        refreshNode();
    }

    /** The project browser node: double-click opens the setup tab; no menu. */
    static final class SetupNode extends AbstractNavTreeNode {
        private final SetupWorkspace workspace;

        SetupNode(SetupWorkspace workspace) {
            this.workspace = workspace;
            setText(SetupForm.msg("setup.root"));
        }

        void update(String text) {
            if (!text.equals(getText())) {
                setText(text);
                refresh();
            }
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
            workspace.openSetup();
        }

        /** No Map Studio menu on the node (owner, 2026-10-27): double-click is the only way in. */
        @Override
        protected void initPopupMenu(JPopupMenu menu, TreePath[] paths, List<AbstractNavTreeNode> selection,
                                     int modifiers) {
        }
    }
}
