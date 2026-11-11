package com.aoindustrial.perspective.mapstudio.gateway.script;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.python.util.PythonInterpreter;

import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;

import com.aoindustrial.perspective.mapstudio.common.contract.KindSetup;
import com.aoindustrial.perspective.mapstudio.common.contract.Placeholders;

/**
 * Entry 13a, G4: the one tag path rule (TagPaths, as a save checks it) accepts every tag path the
 * dev seed and the showcase seed store, in their kind setups and in their items' overrides, and the
 * paths the template's install is documented with (docs/template-install.md). Both seeds run under
 * the SDK's Jython against DevSeedTest's stand-in map store; what they sent is read back as JSON.
 */
class SeedTagPathsTest {

    static final Path SCRIPTS = Path.of("..").toAbsolutePath().normalize().resolve("ops/project/ignition/script-python");

    /** Each seed's one batch as Gson: {"ops": [...]}. */
    static JsonObject dev;
    static JsonObject showcase;

    @BeforeAll
    static void runBothSeeds() throws Exception {
        System.setProperty("python.import.site", "false");
        System.setProperty("python.cachedir.skip", "true");
        PythonInterpreter python = new PythonInterpreter();
        try (InputStream in = DevSeedTest.class.getResourceAsStream("seed_harness.py")) {
            assertNotNull(in, "seed_harness.py");
            python.exec(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        }
        // The dev seed as the module the showcase seed imports, then the showcase seed itself.
        python.set("dev_seed_code", Files.readString(SCRIPTS.resolve("mapstudio_seed/code.py"), StandardCharsets.UTF_8));
        python.set("showcase_seed_code",
            Files.readString(SCRIPTS.resolve("mapstudio_showcase_seed/code.py"), StandardCharsets.UTF_8));
        python.exec(String.join("\n",
            "import sys, __builtin__",
            "from com.inductiveautomation.ignition.common.gson import JsonNull, JsonPrimitive",
            "def to_gson(v):",
            "    if v is None:",
            "        return JsonNull.INSTANCE",
            "    if isinstance(v, bool):",
            "        return JsonPrimitive(java.lang.Boolean(v))",
            "    if isinstance(v, (int, long, float)):",
            "        return JsonPrimitive(java.lang.Double(v))",
            "    if isinstance(v, basestring):",
            "        return JsonPrimitive(java.lang.String(unicode(v)))",
            "    if isinstance(v, dict):",
            "        o = JsonObject()",
            "        for k in v:",
            "            o.add(unicode(k), to_gson(v[k]))",
            "        return o",
            "    a = JsonArray()",
            "    for x in v:",
            "        a.add(to_gson(x))",
            "    return a",
            "seed_module = type(__builtin__)('mapstudio_seed')",
            "seed_module.system = system",
            "exec dev_seed_code in seed_module.__dict__",
            "sys.modules['mapstudio_seed'] = seed_module",
            "dev_api = FakeApi()",
            "dev_result = seed_module.run(api=dev_api, make_id=make_id, new_batch=_Batches())",
            "showcase_module = type(__builtin__)('mapstudio_showcase_seed')",
            "showcase_module.system = system",
            "exec showcase_seed_code in showcase_module.__dict__",
            "showcase_api = FakeApi()",
            "showcase_result = seed_module.run(showcase_module.PROJECT, showcase_module.ACTOR, showcase_api, make_id,",
            "    new_batch=_Batches(), seed=showcase_module.seed_items(make_id), kind_setups=showcase_module.KIND_SETUPS)",
            "dev_ops = to_gson({'ops': dev_api.batches[0]['ops'], 'error': dev_result.get('error')})",
            "showcase_ops = to_gson({'ops': showcase_api.batches[0]['ops'], 'error': showcase_result.get('error')})"));
        dev = python.get("dev_ops", JsonObject.class);
        showcase = python.get("showcase_ops", JsonObject.class);
    }

    /** The kind setups and the items with overrides of one seed's batch, each checked; returns how many tag paths passed. */
    private static int checked(JsonObject batch) {
        assertTrue(batch.get("error").isJsonNull(), String.valueOf(batch.get("error")));
        int paths = 0;
        for (JsonElement e : batch.getAsJsonArray("ops")) {
            JsonObject op = e.getAsJsonObject();
            JsonObject data = op.getAsJsonObject("data");
            boolean setup = "kindSetup".equals(op.get("entity").getAsString());
            JsonElement value = setup ? data.get("setup") : data.get("overrides");
            if (value == null || !value.isJsonObject()) {
                continue;
            }
            assertEquals(List.of(), KindSetup.pathFaults(value, !setup), op.get("id").getAsString());
            paths += count(value);
        }
        return paths;
    }

    /** The "path" texts below a value that look like tag paths (a popup view's path is a view path). */
    private static int count(JsonElement v) {
        int n = 0;
        if (v.isJsonArray()) {
            for (JsonElement e : v.getAsJsonArray()) {
                n += count(e);
            }
        } else if (v.isJsonObject()) {
            for (var e : v.getAsJsonObject().entrySet()) {
                boolean path = "path".equals(e.getKey()) && e.getValue().isJsonPrimitive();
                String text = path ? e.getValue().getAsString() : "";
                n += text.startsWith("{") || text.startsWith("[") ? 1 : count(e.getValue());
            }
        }
        return n;
    }

    @Test
    void everyTagPathOfTheDevSeedPassesTheRule() {
        JsonArray ops = dev.getAsJsonArray("ops");
        assertEquals(80, ops.size(), "75 map items and the five kind setups");
        assertTrue(checked(dev) >= 12, "the dev kind setups' tag paths were read");
    }

    @Test
    void everyTagPathOfTheShowcaseSeedPassesTheRule() {
        assertTrue(showcase.getAsJsonArray("ops").size() > 7, "the showcase items and its kind setups");
        assertTrue(checked(showcase) >= 20, "the showcase kind setups' tag paths were read");
    }

    @Test
    void theTemplatesDocumentedPathsAndTheDocsExamplesPassTheRule() {
        // docs/template-install.md, "The map in the template's own project"; docs/kind-setup.md's examples.
        for (String path : new String[] {"{asset.path}/_Summary/GasRate", "{asset.path}/_Summary/OilRate", "{asset.path}",
            "{asset.path}/CommsOk", "{asset.path}/GasRate", "{asset.path}/TubingPressure", "{asset.path}/Comms",
            "{asset.path}/Pressure", "[default]Shared/GasPrice"}) {
            assertDoesNotThrow(() -> Placeholders.checkTagPath(path, true), path);
        }
        for (String path : new String[] {"[default]Mesa/P12/Pressure", "[default]Mesa/P12/State", "[default]Mesa/P14/Pressure"}) {
            assertDoesNotThrow(() -> Placeholders.checkTagPath(path, false), path);
        }
        assertDoesNotThrow(() -> Placeholders.checkParam("pressure", "{asset.path}/Pressure", java.util.Set.of()));
    }
}
