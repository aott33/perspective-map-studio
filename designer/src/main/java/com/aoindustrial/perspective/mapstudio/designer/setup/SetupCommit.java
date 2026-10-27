package com.aoindustrial.perspective.mapstudio.designer.setup;

import java.util.List;
import java.util.Map;

/** The setup editor's commit step, with no SDK type, so it is unit tested. */
final class SetupCommit {

    private SetupCommit() {
    }

    /**
     * What {@link SetupEditor#getObjectForSave()} hands the SDK: the setup as read when
     * there is no panel or it is read only (equal to the one read, so nothing is
     * written), else the panel's setup; a setup with reasons left is refused.
     */
    static SetupForm formToSave(SetupPanel panel, SetupForm read) throws SetupRefusedException {
        if (panel == null || panel.isLocked()) {
            return read;
        }
        SetupForm form = panel.current();
        Map<String, List<String>> reasons = form.reasons();
        if (!reasons.isEmpty()) {
            throw new SetupRefusedException(reasons);
        }
        return form;
    }

    /**
     * What a project save does with a new setup (the workspace's own tab): the form to create
     * the resource with, or a refusal when reasons are left (the save fails, no dialog).
     */
    static SetupForm newSetupToSave(SetupPanel draft) throws SetupRefusedException {
        SetupForm form = draft.current();
        Map<String, List<String>> reasons = form.reasons();
        if (!reasons.isEmpty()) {
            throw new SetupRefusedException(reasons);
        }
        return form;
    }

    /** The project browser node's words. */
    static String nodeText(boolean hasSetup, boolean inherited, boolean newSetup) {
        if (hasSetup) {
            return SetupForm.msg(inherited ? "setup.node.inherited" : "setup.root");
        }
        return SetupForm.msg(newSetup ? "setup.node.new" : "setup.node.none");
    }
}
