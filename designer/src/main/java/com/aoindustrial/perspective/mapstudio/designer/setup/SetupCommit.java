package com.aoindustrial.perspective.mapstudio.designer.setup;

import java.util.List;
import java.util.Map;

/**
 * The setup editor's commit step, with no SDK type, so it is unit tested. A setup with reasons
 * left is held back from the project save: the rest of the project saves, nothing of the setup is
 * written, and the tab keeps its changes and reasons (owner, 2026-10-27, fix 16).
 */
final class SetupCommit {

    private SetupCommit() {
    }

    /**
     * What one project save does with the setup.
     *
     * @param form the setup to write; for an open tab held back, the setup as read (equal to it, so
     *             {@code ResourceEditor.commit()} writes nothing); for a new setup held back, null
     * @param heldBack the reasons that hold it back, empty when it saves
     */
    record Decision(SetupForm form, Map<String, List<String>> heldBack) {
        Decision {
            heldBack = heldBack == null ? Map.of() : heldBack;
        }

        boolean isHeldBack() {
            return !heldBack.isEmpty();
        }

        /** The reasons in one line, for the log. */
        String summary() {
            StringBuilder sb = new StringBuilder();
            heldBack.forEach((field, list) -> sb.append(sb.length() == 0 ? "" : "; ")
                .append(field.isEmpty() ? "setup" : field).append(": ").append(String.join(" ", list)));
            return sb.toString();
        }
    }

    /**
     * What {@link SetupEditor#getObjectForSave()} hands the SDK: the setup as read when there is
     * no panel or it is read only, or when reasons are left (held back); else the panel's setup.
     */
    static Decision formToSave(SetupPanel panel, SetupForm read) {
        if (panel == null || panel.isLocked()) {
            return new Decision(read, Map.of());
        }
        SetupForm form = panel.current();
        Map<String, List<String>> reasons = form.reasons();
        return reasons.isEmpty() ? new Decision(form, Map.of()) : new Decision(read, reasons);
    }

    /**
     * True when closing the setup tab would drop its changes: they differ from the project's setup
     * and reasons are left, so the commit on close writes nothing (fix 16 review). Closing then
     * asks Discard or Cancel. A tab with changes and no reasons is committed on close as usual.
     */
    static boolean closeDropsChanges(SetupPanel panel) {
        return panel != null && !panel.isLocked() && panel.hasUnsavedChanges()
            && !panel.current().reasons().isEmpty();
    }

    /** How many reasons are left, for the close question. */
    static int reasonCount(SetupPanel panel) {
        return panel == null ? 0 : panel.current().reasons().values().stream().mapToInt(List::size).sum();
    }

    /** What a project save does with a new setup (the workspace's own tab). */
    static Decision newSetupToSave(SetupPanel draft) {
        SetupForm form = draft.current();
        Map<String, List<String>> reasons = form.reasons();
        return reasons.isEmpty() ? new Decision(form, Map.of()) : new Decision(null, reasons);
    }

    /** The project browser node's words (and the tab's). */
    static String nodeText(boolean hasSetup, boolean inherited, boolean newSetup, boolean unsaved) {
        if (hasSetup) {
            return SetupForm.msg(unsaved ? "setup.node.unsaved" : inherited ? "setup.node.inherited" : "setup.root");
        }
        return SetupForm.msg(newSetup ? "setup.node.new" : "setup.node.none");
    }
}
