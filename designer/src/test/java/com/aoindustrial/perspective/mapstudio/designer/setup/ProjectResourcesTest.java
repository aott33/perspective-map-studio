package com.aoindustrial.perspective.mapstudio.designer.setup;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import com.inductiveautomation.ignition.common.resourcecollection.Resource;
import com.inductiveautomation.ignition.common.resourcecollection.ResourceBuilder;
import com.inductiveautomation.ignition.common.resourcecollection.ResourcePath;
import com.inductiveautomation.ignition.common.resourcecollection.ResourceType;
import com.inductiveautomation.ignition.common.script.ScriptLibrary;

import org.junit.jupiter.api.Test;

/**
 * Fix 16 (owner, Designer 2026-10-27): "mapstudio_dev.kinds is not a function in this project's
 * library" although the dev project defines it. The project is read here as the Designer holds it:
 * one resource per folder holding a resource.json, at {@code <module>/<type>/<path>} of the dev
 * project's own files in ops/project, each with its files as data.
 */
class ProjectResourcesTest {

    private static final Path PROJECT = Path.of("..", "ops", "project");

    /** The dev project's resources, from its files on disk. */
    static List<Resource> devProject() throws IOException {
        List<Resource> out = new ArrayList<>();
        List<Path> folders;
        try (Stream<Path> walk = Files.walk(PROJECT)) {
            folders = walk.filter(p -> Files.isRegularFile(p.resolve("resource.json"))).toList();
        }
        for (Path folder : folders) {
            Path rel = PROJECT.relativize(folder);
            ResourceType type = new ResourceType(rel.getName(0).toString(), rel.getName(1).toString());
            String path = rel.getNameCount() > 2 ? rel.subpath(2, rel.getNameCount()).toString().replace('\\', '/') : "";
            ResourceBuilder b = Resource.newBuilder()
                .setResourceCollectionName("mapstudio-dev")
                .setResourcePath(new ResourcePath(type, path));
            try (Stream<Path> files = Files.list(folder)) {
                for (Path f : files.filter(Files::isRegularFile).toList()) {
                    b.putData(f.getFileName().toString(), Files.readAllBytes(f));
                }
            }
            out.add(b.build());
        }
        return out;
    }

    private static List<Resource> ofType(List<Resource> all, ResourceType type) {
        return all.stream().filter(r -> r.getResourcePath().getResourceType().equals(type)).toList();
    }

    @Test
    void theDevProjectsLibraryFunctionsAreRead() throws IOException {
        List<Resource> all = devProject();
        ProjectLists.Snapshot s = ProjectResources.read(type -> ofType(all, type));
        assertTrue(s.functions().contains("mapstudio_dev.kinds"), s.functions().toString());
        assertTrue(s.functions().contains("mapstudio_dev.assets"), s.functions().toString());
        assertTrue(s.offeredFunctions().contains("mapstudio_dev.kinds"));
        assertFalse(s.offeredFunctions().contains("mapstudio_dev._globals"));
        assertEquals(List.of("/", "/adapters", "/edit", "/fallback-empty", "/fallback-missing", "/live"), s.pages());
        assertEquals("default", s.identityProvider());
        // So the dev setup's kindsFunction and assetsFunction give no warning.
        FormLists lists = FormLists.none().withProject(s);
        SetupForm dev = SetupForm.fromJson(Files.readString(
            PROJECT.resolve("com.aoindustrial.perspective.mapstudio/setup/setup.json")));
        assertEquals("mapstudio_dev.kinds", dev.text(SetupForm.KINDS_FUNCTION));
        assertEquals("mapstudio_dev.assets", dev.text(SetupForm.ASSETS_FUNCTION));
        assertFalse(dev.warnings(lists).containsKey(SetupForm.KINDS_FUNCTION), dev.warnings(lists).toString());
        assertFalse(dev.warnings(lists).containsKey(SetupForm.ASSETS_FUNCTION), dev.warnings(lists).toString());
    }

    /** The root cause: the project library is ignition/script-python, not ScriptLibrary's type. */
    @Test
    void theLibraryIsScriptPythonNotScriptAppLibrary() throws IOException {
        List<Resource> all = devProject();
        assertEquals(new ResourceType("ignition", "script-python"), ProjectResources.SCRIPTS);
        assertEquals("code.py", ProjectResources.CODE);
        assertEquals(3, ofType(all, ProjectResources.SCRIPTS).size());
        assertEquals("ignition/script-app-library", ScriptLibrary.RESOURCE_TYPE.toString());
        assertTrue(ofType(all, ScriptLibrary.RESOURCE_TYPE).isEmpty());
    }

    @Test
    void aNestedPackageIsDottedAndAFolderWithoutCodeIsSkipped() {
        Resource folder = Resource.newBuilder().setResourceCollectionName("p")
            .setResourcePath(new ResourcePath(ProjectResources.SCRIPTS, "site")).setFolder(true).build();
        Resource adapter = Resource.newBuilder().setResourceCollectionName("p")
            .setResourcePath(new ResourcePath(ProjectResources.SCRIPTS, "site/adapter"))
            .putData("code.py", "def kinds():\n    return []\n").build();
        ProjectLists.Snapshot s = ProjectResources.read(
            type -> type.equals(ProjectResources.SCRIPTS) ? List.of(folder, adapter) : List.of());
        assertEquals(List.of("site.adapter.kinds"), s.functions());
        assertEquals(null, s.pages());
    }

    /**
     * Fix 16 review: no script found at all reads as "not known" (a child project whose inherited
     * scripts might be left out), so the function fields give no warning.
     */
    @Test
    void noScriptAtAllIsUnknownAndWarnsNothing() {
        ProjectLists.Snapshot s = ProjectResources.read(type -> List.of());
        assertNull(s.functions());
        assertTrue(s.offeredFunctions().isEmpty());
        SetupForm form = SetupForm.defaults().setText(SetupForm.KINDS_FUNCTION, "mapstudio_dev.kinds");
        assertFalse(form.warnings(FormLists.none().withProject(s)).containsKey(SetupForm.KINDS_FUNCTION));
        // A library that was read and lacks the function still warns.
        ProjectLists.Snapshot known = new ProjectLists.Snapshot(List.of("site.other"), null, null);
        assertTrue(form.warnings(FormLists.none().withProject(known)).containsKey(SetupForm.KINDS_FUNCTION));
    }
}
