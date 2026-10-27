package com.aoindustrial.perspective.mapstudio.designer.setup;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

import com.inductiveautomation.ignition.common.ImmutableBytes;
import com.inductiveautomation.ignition.common.resourcecollection.Resource;
import com.inductiveautomation.ignition.common.resourcecollection.ResourceType;
import com.inductiveautomation.ignition.common.script.ModuleLibrary;

/**
 * Reads the setup form's project lists from the open project's resources (epic 2 story 16), with
 * common types only, so it is unit tested on the dev project's own files.
 *
 * <p>The project library is the resource type {@code ignition/script-python}
 * ({@link ModuleLibrary#RESOURCE_TYPE}), one resource per package, its code in {@code code.py}
 * ({@link ModuleLibrary#CODE_DATA_KEY}) [SDK 8.3.0 javap]. Not {@code ScriptLibrary.RESOURCE_TYPE}:
 * that is {@code ignition/script-app-library}, which a Perspective project does not have, so the
 * function list came back empty and every function was "not a function in this project's
 * library" (owner, seen in the Designer 2026-10-27; fixed here).
 */
final class ProjectResources {

    static final ResourceType SCRIPTS = ModuleLibrary.RESOURCE_TYPE;
    static final String CODE = ModuleLibrary.CODE_DATA_KEY;
    static final ResourceType PAGE_CONFIG = new ResourceType("com.inductiveautomation.perspective", "page-config");
    static final ResourceType GENERAL_PROPERTIES =
        new ResourceType("com.inductiveautomation.perspective", "general-properties");

    private ProjectResources() {
    }

    /**
     * The project's lists.
     *
     * @param ofType the project's resources of a type (in the Designer
     *               {@code DesignableProject.getResourcesOfType})
     */
    static ProjectLists.Snapshot read(Function<ResourceType, List<Resource>> ofType) {
        Map<String, String> scripts = new LinkedHashMap<>();
        for (Resource r : ofType.apply(SCRIPTS)) {
            text(r, CODE).ifPresent(code -> scripts.put(r.getResourcePath().getFolderPath(), code));
        }
        String pages = first(ofType.apply(PAGE_CONFIG), "config.json");
        String general = first(ofType.apply(GENERAL_PROPERTIES), null);
        return ProjectLists.of(scripts, pages, general);
    }

    private static String first(List<Resource> resources, String file) {
        for (Resource r : resources) {
            if (file != null) {
                Optional<String> t = text(r, file);
                if (t.isPresent()) {
                    return t.get();
                }
            } else {
                for (String key : r.getDataKeys()) {
                    if (key.endsWith(".json") && !key.equals("resource.json")) {
                        Optional<String> t = text(r, key);
                        if (t.isPresent() && t.get().contains("\"idp\"")) {
                            return t.get();
                        }
                    }
                }
            }
        }
        return null;
    }

    private static Optional<String> text(Resource r, String file) {
        return r.getData(file).map(ImmutableBytes::getBytes).map(b -> new String(b, StandardCharsets.UTF_8));
    }
}
