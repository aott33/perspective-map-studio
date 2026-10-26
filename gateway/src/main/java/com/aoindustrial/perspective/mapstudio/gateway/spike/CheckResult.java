package com.aoindustrial.perspective.mapstudio.gateway.spike;

import com.inductiveautomation.ignition.common.util.LoggerEx;

/**
 * One platform check's outcome, logged as a single line so that
 * {@code ops/checks.sh} can collect it: {@code CHECK <name> PASS|FAIL <evidence>}.
 */
public record CheckResult(String name, boolean passed, String evidence) {

    public static final String PREFIX = "CHECK ";

    public static CheckResult pass(String name, String evidence) {
        return new CheckResult(name, true, evidence);
    }

    public static CheckResult fail(String name, String evidence) {
        return new CheckResult(name, false, evidence);
    }

    /** The one-line form; evidence is flattened to one line. */
    public String line() {
        String flat = evidence == null ? "" : evidence.replaceAll("\\s*\\R\\s*", " | ").trim();
        return PREFIX + name + " " + (passed ? "PASS" : "FAIL") + " " + flat;
    }

    /** Log the line at info for a pass and warn for a fail, on the logger {@code MapStudio.check.<name>}. */
    public void log() {
        LoggerEx log = LoggerEx.newBuilder().build("MapStudio.check." + name);
        if (passed) {
            log.info(line());
        } else {
            log.warn(line());
        }
    }
}
