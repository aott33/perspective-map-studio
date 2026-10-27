package com.aoindustrial.perspective.mapstudio.common;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.nio.charset.StandardCharsets;
import java.util.Properties;
import java.util.Set;
import java.util.TreeSet;

import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.script.hints.JythonElement;
import com.inductiveautomation.ignition.common.script.hints.ScriptArg;

/**
 * The Designer's autocomplete text for {@code system.mapstudio} (epic 2 story 11): every
 * {@code @JythonElement} method of {@link MapStudioScriptModule} has a {@code desc}, a
 * {@code param.<name>} for each {@code @ScriptArg} and a {@code returns} in
 * {@code MapStudioScriptModule.properties}, and the file names no method that is gone.
 */
class ScriptDocsTest {

    private static final String PROPERTIES = "/com/aoindustrial/perspective/mapstudio/common/MapStudioScriptModule.properties";

    private static Properties docs() throws Exception {
        Properties p = new Properties();
        try (InputStream in = ScriptDocsTest.class.getResourceAsStream(PROPERTIES)) {
            assertNotNull(in, PROPERTIES);
            p.load(new InputStreamReader(in, StandardCharsets.UTF_8));
        }
        return p;
    }

    private static Class<?> module() throws Exception {
        // Not initialised: its static block registers a bundle, which needs a running platform.
        return Class.forName(MapStudioScriptModule.class.getName(), false, ScriptDocsTest.class.getClassLoader());
    }

    @Test
    void everyScriptFunctionIsDocumented() throws Exception {
        Properties p = docs();
        Set<String> functions = new TreeSet<>();
        Set<String> expected = new TreeSet<>();
        for (Method m : module().getDeclaredMethods()) {
            if (m.getAnnotation(JythonElement.class) == null) {
                continue;
            }
            String name = m.getName();
            functions.add(name);
            expected.add(name + ".desc");
            expected.add(name + ".returns");
            for (Parameter param : m.getParameters()) {
                ScriptArg arg = param.getAnnotation(ScriptArg.class);
                assertNotNull(arg, name + " parameter " + param.getName() + " has no @ScriptArg");
                expected.add(name + ".param." + arg.value());
            }
        }
        assertEquals(Set.of("ping", "getMap", "applyEdits", "refreshAdapters"), functions);
        for (String key : expected) {
            String text = p.getProperty(key);
            assertNotNull(text, "missing " + key);
            assertFalse(text.isBlank(), "blank " + key);
            assertFalse(text.contains("\u2014"), key + " has an em dash");
        }
        assertEquals(expected, new TreeSet<>(p.stringPropertyNames()), "keys for methods or params that do not exist");
    }

    @Test
    void theTextCoversTheContractsScriptRules() throws Exception {
        Properties p = docs();
        String apply = p.getProperty("applyEdits.desc") + " " + p.getProperty("applyEdits.param.batch")
            + " " + p.getProperty("applyEdits.returns");
        for (String word : new String[] {"delete", "kindSetup", "attachment", "conflicts()", "conflict", "role",
            "invalid", "read-only", "store-unreachable", "UUIDv5", "re-run"}) {
            assertTrue(apply.contains(word), "applyEdits text does not mention " + word);
        }
        assertTrue(p.getProperty("getMap.returns").contains("kindSetups"), "getMap.returns names kindSetups");
    }
}
