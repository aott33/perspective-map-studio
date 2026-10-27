package com.aoindustrial.perspective.mapstudio.designer.setup;

import java.util.List;
import java.util.Map;

/** A save refused because the form still has reasons; its message names the fields. */
public final class SetupRefusedException extends Exception {
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

    static String summary(Map<String, List<String>> reasons) {
        StringBuilder sb = new StringBuilder();
        reasons.forEach((field, list) -> sb.append(sb.length() == 0 ? "" : "; ")
            .append(field.isEmpty() ? "setup" : field).append(": ").append(String.join(" ", list)));
        return sb.toString();
    }
}
