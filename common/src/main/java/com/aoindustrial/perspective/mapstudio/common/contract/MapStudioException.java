package com.aoindustrial.perspective.mapstudio.common.contract;

import com.inductiveautomation.ignition.common.gson.JsonObject;

/**
 * A refusal with a contract error code ({@code Messages.CODE_*}) and a plain-words
 * message, optionally naming the op of a batch that caused it. Thrown by the
 * write service and the scripting API; the delegate turns it into an
 * {@code error} envelope, and a script receives it as an exception whose
 * message starts with the code ({@code "role: ..."}).
 */
public class MapStudioException extends RuntimeException {

    private final String code;
    private final String plainMessage;
    private final Integer opIndex;
    private final String opId;

    public MapStudioException(String code, String message) {
        this(code, message, null, null);
    }

    public MapStudioException(String code, String message, Integer opIndex, String opId) {
        super(code + ": " + message);
        this.code = code;
        this.plainMessage = message;
        this.opIndex = opIndex;
        this.opId = opId;
    }

    public String code() {
        return code;
    }

    /** The message without the code prefix. */
    public String plainMessage() {
        return plainMessage;
    }

    /** Zero-based index of the op at fault, or null. */
    public Integer opIndex() {
        return opIndex;
    }

    /** Id of the op at fault, or null. */
    public String opId() {
        return opId;
    }

    /** The error body {code, message, op?: {index, id}}; the caller adds batchId. */
    public JsonObject toErrorBody() {
        JsonObject body = new JsonObject();
        body.addProperty("code", code);
        body.addProperty("message", plainMessage);
        if (opIndex != null) {
            JsonObject op = new JsonObject();
            op.addProperty("index", opIndex);
            if (opId != null) {
                op.addProperty("id", opId);
            }
            body.add("op", op);
        }
        return body;
    }
}
