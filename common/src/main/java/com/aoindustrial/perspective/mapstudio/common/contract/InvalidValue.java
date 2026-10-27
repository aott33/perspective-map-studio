package com.aoindustrial.perspective.mapstudio.common.contract;

/**
 * A value the contract refuses (epic 2 story 9): the message is the reason in plain
 * words, naming where the value is ({@code "popupView.params.padName: ..."}). The write
 * service turns it into code {@code invalid} naming the op.
 */
public final class InvalidValue extends RuntimeException {

    public InvalidValue(String message) {
        super(message, null, false, false);
    }

    /** The same reason after {@code where}: {@code "kpis[0].path: <reason>"}. */
    InvalidValue at(String where) {
        return new InvalidValue(where + ": " + getMessage());
    }
}
