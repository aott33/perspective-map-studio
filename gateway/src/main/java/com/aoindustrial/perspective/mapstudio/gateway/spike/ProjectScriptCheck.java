package com.aoindustrial.perspective.mapstudio.gateway.spike;

import com.inductiveautomation.ignition.common.script.JythonExecException;
import com.inductiveautomation.ignition.common.script.ScriptManager;
import com.inductiveautomation.ignition.common.util.LoggerEx;
import com.inductiveautomation.ignition.gateway.project.ProjectManager;
import org.python.core.PyObject;
import org.python.core.PyStringMap;

/**
 * Spike checks 2 and 3: call a project script function from module code through
 * the project's {@link ScriptManager}, two ways ({@code runCode} with a locals
 * map, and {@code runFunction} on the function object found in the globals).
 * The dev project's function itself calls {@code system.mapstudio.ping()}, so
 * its return value also proves the module's scripting function is registered
 * in the project's script scope.
 */
public final class ProjectScriptCheck {

    private static final LoggerEx log = LoggerEx.newBuilder().build("MapStudio.check.project-script");

    private final ProjectManager projects;

    public ProjectScriptCheck(ProjectManager projects) {
        this.projects = projects;
    }

    public CheckResult run(String projectName, SetupResource setup) {
        String name = "project-script";
        ScriptManager manager = projects.getProjectScriptManager(projectName);
        if (manager == null) {
            return CheckResult.fail(name, "getProjectScriptManager(" + projectName + ") returned null");
        }
        String module = setup.adapterModule();
        String function = setup.adapterFunctionName();
        StringBuilder evidence = new StringBuilder();
        boolean viaCode = false;
        boolean viaFunction = false;

        // Way 1: run a snippet in a fresh locals map and read the result back.
        try {
            PyStringMap locals = manager.createLocalsMap();
            String code = "import " + module + "\n__result__ = " + module + "." + function + "()\n";
            manager.runCode(code, locals, "MapStudio.check.project-script");
            PyObject result = locals.__finditem__("__result__");
            viaCode = result != null;
            evidence.append("runCode: ").append(result).append("; ");
        } catch (JythonExecException ex) {
            evidence.append("runCode failed: ").append(pyCause(ex)).append("; ");
        } catch (RuntimeException ex) {
            evidence.append("runCode failed: ").append(ex).append("; ");
        }

        // Way 2: import the project module into a locals map, take the function
        // object and run it with runFunction (project modules are not in the
        // globals until something imports them).
        try {
            PyStringMap locals = manager.createLocalsMap();
            manager.runCode("import " + module + "\n", locals, "MapStudio.check.project-script");
            PyObject moduleObject = locals.__finditem__(module);
            if (moduleObject == null) {
                evidence.append("runFunction: import left no '").append(module).append("' in the locals; ");
            } else {
                PyObject callable = moduleObject.__getattr__(function);
                PyObject result = manager.runFunction(callable);
                viaFunction = result != null;
                evidence.append("runFunction: ").append(result).append("; ");
            }
        } catch (JythonExecException ex) {
            evidence.append("runFunction failed: ").append(pyCause(ex)).append("; ");
        } catch (RuntimeException ex) {
            evidence.append("runFunction failed: ").append(ex).append("; ");
        }

        String summary = String.format("project %s, %s via ScriptManager %s: %s", projectName,
            setup.adapterFunction(), manager.getClass().getSimpleName(), evidence);
        if (viaCode || viaFunction) {
            log.info(summary);
            return CheckResult.pass(name, summary);
        }
        return CheckResult.fail(name, summary);
    }

    private static String pyCause(JythonExecException ex) {
        return ex.getPyCause().map(Object::toString).orElseGet(ex::toString).replace('\n', ' ');
    }
}
