package com.aoindustrial.perspective.mapstudio.gateway.adapter;

import java.util.regex.Pattern;

import org.python.core.Py;
import org.python.core.PyDictionary;
import org.python.core.PyException;
import org.python.core.PyList;
import org.python.core.PyObject;
import org.python.core.PyString;
import org.python.core.PyStringMap;
import org.python.core.PyTuple;
import org.python.core.PyUnicode;

import com.inductiveautomation.ignition.common.Dataset;
import com.inductiveautomation.ignition.common.TypeUtilities;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.script.JythonExecException;
import com.inductiveautomation.ignition.common.script.ScriptManager;
import com.inductiveautomation.ignition.gateway.project.ProjectManager;

/**
 * Calls a project library function from module code through the project's
 * {@link ScriptManager} (the spike's way 2, docs/platform-checks.md checks 2 and
 * 3, [live 8.3.10]): import the function's module into a fresh locals map, walk
 * the dotted attributes to the function and run it with {@code runFunction}.
 * Project modules are not in the globals until something imports them.
 *
 * <p>The function name is put into an {@code import} statement, so it must be a
 * dotted Python identifier ({@code mapstudio_dev.kinds}); anything else is
 * refused before any code runs.
 */
public final class ProjectFunctionCaller implements AdapterCaller {

    /** A module path and a function: at least one dot, identifiers only. */
    static final Pattern DOTTED_NAME = Pattern.compile("^[A-Za-z_][A-Za-z0-9_]*(\\.[A-Za-z_][A-Za-z0-9_]*)+$");

    private final ProjectManager projects;

    public ProjectFunctionCaller(ProjectManager projects) {
        this.projects = projects;
    }

    @Override
    public Outcome call(String project, String function) {
        if (function == null || !DOTTED_NAME.matcher(function).matches()) {
            return new Failed("it is not a function name such as my_library.kinds (a project library module and a"
                + " function in it)");
        }
        ScriptManager manager = projects.getProjectScriptManager(project);
        if (manager == null) {
            return new Failed("the project's script manager is not available");
        }
        String[] parts = function.split("\\.");
        String module = function.substring(0, function.lastIndexOf('.'));
        try {
            PyStringMap locals = manager.createLocalsMap();
            manager.runCode("import " + module + "\n", locals, "MapStudio.adapters");
            PyObject target = locals.__finditem__(parts[0]);
            for (int i = 1; target != null && i < parts.length; i++) {
                target = target.__findattr__(parts[i]);
            }
            if (target == null || !target.isCallable()) {
                return new Failed("the project library has no function " + function);
            }
            return convert(manager.runFunction(target));
        } catch (JythonExecException ex) {
            return new Failed(AdapterService.firstLine(ex.getPyCause().map(ProjectFunctionCaller::describe)
                .orElseGet(ex::toString)));
        } catch (PyException ex) {
            return new Failed(AdapterService.firstLine(describe(ex)));
        } catch (RuntimeException ex) {
            return new Failed(AdapterService.firstLine(ex.toString()));
        }
    }

    /** A list or tuple becomes rows; anything else is named by its type. */
    static Outcome convert(PyObject result) {
        if (result instanceof PyList || result instanceof PyTuple) {
            JsonElement json;
            try {
                json = TypeUtilities.pyToGson(result);
            } catch (RuntimeException ex) {
                return new Failed("its rows could not be read as JSON (" + ex.getClass().getSimpleName() + ")");
            }
            if (json == null || !json.isJsonArray()) {
                return new Failed("its rows could not be read as JSON");
            }
            return new Returned(json.getAsJsonArray());
        }
        return new NotAList(typeName(result));
    }

    static String typeName(PyObject result) {
        if (result == null || result == Py.None) {
            return "None";
        }
        if (result instanceof PyDictionary || result instanceof PyStringMap) {
            return "dict";
        }
        if (result instanceof PyUnicode) {
            return "unicode";
        }
        if (result instanceof PyString) {
            return "str";
        }
        Object java = result.__tojava__(Object.class);
        if (java instanceof Dataset) {
            return "Dataset";
        }
        if (java != Py.NoConversion && java != null && !(java instanceof PyObject)) {
            return java.getClass().getSimpleName();
        }
        return result.getType().getName();
    }

    /** "ValueError: the message" from a Python exception, without the traceback. */
    static String describe(PyException ex) {
        String type = "error";
        try {
            PyObject name = ex.type == null ? null : ex.type.__findattr__("__name__");
            if (name != null) {
                type = name.toString();
            }
        } catch (RuntimeException ignored) {
            // keep "error"
        }
        String value = "";
        try {
            if (ex.value != null && ex.value != Py.None) {
                Object java = ex.value.__tojava__(Throwable.class);
                value = java instanceof Throwable t ? String.valueOf(t.getMessage()) : ex.value.__str__().toString();
            }
        } catch (RuntimeException ignored) {
            value = "";
        }
        return value.isEmpty() ? type : type + ": " + value;
    }
}
