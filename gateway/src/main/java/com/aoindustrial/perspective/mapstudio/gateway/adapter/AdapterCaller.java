package com.aoindustrial.perspective.mapstudio.gateway.adapter;

import com.inductiveautomation.ignition.common.gson.JsonArray;

/**
 * Calls one project script function by its dotted name and says what it gave
 * back. Blocking; {@link AdapterService} runs it on its own bounded pool with a
 * timeout. Implemented for the Gateway by {@link ProjectFunctionCaller} and by
 * fakes in the tests.
 */
public interface AdapterCaller {

    /** What a call gave back. */
    sealed interface Outcome permits Returned, NotAList, Failed {
    }

    /** The function returned a list; its rows as JSON (each should be a dict). */
    record Returned(JsonArray rows) implements Outcome {
    }

    /** The function returned something other than a list: the Python type's name. */
    record NotAList(String typeName) implements Outcome {
    }

    /** The function could not be called or raised: the reason, one line, at most 200 characters. */
    record Failed(String reason) implements Outcome {
    }

    Outcome call(String project, String function);
}
