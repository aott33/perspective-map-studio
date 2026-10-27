package com.aoindustrial.perspective.mapstudio.gateway.adapter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.python.core.CompileMode;
import org.python.core.CompilerFlags;
import org.python.core.Py;
import org.python.core.PyException;
import org.python.core.PyObject;
import org.python.util.PythonInterpreter;

/**
 * The Jython 2.7 sources this story ships compile under the Gateway's Jython
 * (jython-ia 2.7.3, the SDK's; the 8.3.10 Gateway runs 2.7.4): both example
 * adapters in docs/examples/adapters and the dev adapter. Also checks the
 * project function caller's reading of Python results and errors.
 */
class ExampleAdaptersCompileTest {

    static final Path ROOT = Path.of("..").toAbsolutePath().normalize();
    static final List<String> SOURCES = List.of(
        "docs/examples/adapters/udt_instances.py",
        "docs/examples/adapters/named_query.py",
        "ops/project/ignition/script-python/mapstudio_dev/code.py");

    static PythonInterpreter python;

    @BeforeAll
    static void startJython() {
        // The SDK's Jython jar ships no Lib/ folder, so skip the site module.
        System.setProperty("python.import.site", "false");
        // No package cache (it would write .jython_cache/ into the checkout).
        System.setProperty("python.cachedir.skip", "true");
        python = new PythonInterpreter();
    }

    @Test
    void theExampleAndDevAdaptersCompile() throws Exception {
        for (String source : SOURCES) {
            Path file = ROOT.resolve(source);
            assertTrue(Files.isRegularFile(file), source);
            String text = Files.readString(file, StandardCharsets.UTF_8);
            assertNotNull(Py.compile_flags(text, source, CompileMode.exec, new CompilerFlags()), source);
            assertFalse(text.contains("\u2014"), source + " has an em dash");
        }
    }

    @Test
    void aListOfDictsBecomesRows() {
        python.exec("rows = [{'id': 'pad', 'name': 'Pad', 'labelRank': 3}]\nt = ({'id': 'a'},)");
        AdapterCaller.Outcome o = ProjectFunctionCaller.convert(python.get("rows"));
        AdapterCaller.Returned r = assertInstanceOf(AdapterCaller.Returned.class, o);
        assertEquals("pad", r.rows().get(0).getAsJsonObject().get("id").getAsString());
        assertEquals(3, r.rows().get(0).getAsJsonObject().get("labelRank").getAsInt());
        assertInstanceOf(AdapterCaller.Returned.class, ProjectFunctionCaller.convert(python.get("t")));
    }

    @Test
    void otherResultsAreNamedByType() {
        python.exec("d = {'kinds': []}\ns = 'text'\nu = u'text'\nn = None\nimport java.util\nj = java.util.HashMap()");
        assertEquals("dict", name("d"));
        assertEquals("str", name("s"));
        assertEquals("unicode", name("u"));
        assertEquals("None", name("n"));
        assertEquals("HashMap", name("j"));
        assertEquals("None", ProjectFunctionCaller.typeName(null));
    }

    @Test
    void aPythonErrorIsDescribedByTypeAndMessage() {
        try {
            python.exec("raise ValueError('bad pad')");
        } catch (PyException ex) {
            assertEquals("ValueError: bad pad", ProjectFunctionCaller.describe(ex));
            return;
        }
        throw new AssertionError("no exception");
    }

    @Test
    void onlyDottedIdentifiersAreCalled() {
        AdapterCaller.Outcome o = new ProjectFunctionCaller(null).call("p", "os.system('x')");
        assertInstanceOf(AdapterCaller.Failed.class, o);
        assertInstanceOf(AdapterCaller.Failed.class, new ProjectFunctionCaller(null).call("p", "kinds"));
        assertTrue(ProjectFunctionCaller.DOTTED_NAME.matcher("a.b_c.kinds").matches());
        assertFalse(ProjectFunctionCaller.DOTTED_NAME.matcher("a.b\nimport os").matches());
    }

    private static String name(String variable) {
        PyObject value = python.get(variable);
        AdapterCaller.NotAList n = assertInstanceOf(AdapterCaller.NotAList.class, ProjectFunctionCaller.convert(value));
        return n.typeName();
    }
}
