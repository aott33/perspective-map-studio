package com.aoindustrial.perspective.mapstudio.designer.setup;

import java.util.List;
import java.util.Map;

/**
 * A save refused because the form still has reasons; its message names the fields, for the log.
 * The reasons are on screen beside their fields and never repeated in a dialog (owner,
 * 2026-10-27): the project save fails with the Designer's own save failure.
 */
public final class SetupRefusedException extends Exception {
    private final Map<String, List<String>> reasons;

    public SetupRefusedException(Map<String, List<String>> reasons) {
        super(summary(reasons));
        this.reasons = reasons;
    }

    public Map<String, List<String>> reasons() {
        return reasons;
    }

    static String summary(Map<String, List<String>> reasons) {
        StringBuilder sb = new StringBuilder();
        reasons.forEach((field, list) -> sb.append(sb.length() == 0 ? "" : "; ")
            .append(field.isEmpty() ? "setup" : field).append(": ").append(String.join(" ", list)));
        return sb.toString();
    }

    /**
     * The unchecked form that leaves {@code ResourceEditor.commit()} and the workspace's
     * {@code commitAll()}, so {@code MapStudioDesignerHook.notifyProjectSaveStart} can fail the
     * project save with it.
     */
    public static final class NotSaved extends RuntimeException {
        public NotSaved(String project, SetupRefusedException cause) {
            super(SetupForm.msg("setup.refused.log", project, cause.getMessage()), cause);
        }
    }
}
