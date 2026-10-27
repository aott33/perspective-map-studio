package com.aoindustrial.perspective.mapstudio.gateway.setup;

import java.util.Optional;

import com.aoindustrial.perspective.mapstudio.common.contract.Setup;

/**
 * What the Gateway knows of one project's setup: valid (the setup), invalid (the
 * plain-words reason, every problem listed) or missing (no setup resource).
 * Replaced whole on every read, so a reader sees one state or the next, never a mix.
 */
public record SetupState(Status status, Setup setup, String reason) {

    public enum Status { VALID, INVALID, MISSING }

    private static final SetupState MISSING = new SetupState(Status.MISSING, null, null);

    public static SetupState valid(Setup setup) {
        return new SetupState(Status.VALID, setup, null);
    }

    public static SetupState invalid(String reason) {
        return new SetupState(Status.INVALID, null, reason);
    }

    public static SetupState missing() {
        return MISSING;
    }

    public boolean isValid() {
        return status == Status.VALID;
    }

    public Optional<Setup> find() {
        return Optional.ofNullable(setup);
    }
}
