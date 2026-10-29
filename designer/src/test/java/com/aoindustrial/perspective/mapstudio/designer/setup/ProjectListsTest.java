package com.aoindustrial.perspective.mapstudio.designer.setup;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

/** Epic 2 story 16: the project's lists, read from the dev project in ops/project. */
class ProjectListsTest {

    private static final Path PROJECT = Path.of("..", "ops", "project");

    private static String read(String path) throws IOException {
        return Files.readString(PROJECT.resolve(path), StandardCharsets.UTF_8);
    }

    @Test
    void theDevProjectsFunctionsPagesAndIdentityProvider() throws IOException {
        Map<String, String> scripts = new LinkedHashMap<>();
        scripts.put("mapstudio_dev", read("ignition/script-python/mapstudio_dev/code.py"));
        scripts.put("mapstudio_seed", read("ignition/script-python/mapstudio_seed/code.py"));
        ProjectLists.Snapshot s = ProjectLists.of(scripts,
            read("com.inductiveautomation.perspective/page-config/config.json"), null);
        assertTrue(s.functions().contains("mapstudio_dev.kinds"), s.functions().toString());
        assertTrue(s.functions().contains("mapstudio_dev.assets"));
        assertTrue(s.functions().contains("mapstudio_dev._globals"));
        assertTrue(s.offeredFunctions().contains("mapstudio_dev.kinds"));
        assertFalse(s.offeredFunctions().contains("mapstudio_dev._globals"));
        assertEquals(List.of("/", "/adapters", "/alarms/:item", "/edit", "/live", "/pad/:name", "/styles", "/two"), s.pages());
        assertEquals("default", s.identityProvider());
    }

    @Test
    void aNestedScriptGivesDottedNamesAndIndentedDefsAreNotFunctions() {
        String code = "def kinds():\n    def inner():\n        pass\n    return []\n\nclass K:\n    def m(self):\n"
            + "        pass\ndef  assets( project ):\n    pass\n#def commented():\n";
        assertEquals(List.of("site.adapter.kinds", "site.adapter.assets"),
            ProjectLists.functions("site/adapter", code));
    }

    @Test
    void theIdentityProviderComesFromTheGeneralProperties() {
        assertEquals("okta", ProjectLists.identityProvider("{\"idp\": \"okta\", \"locale\": \"Browser\"}"));
        assertEquals("default", ProjectLists.identityProvider("{\"idp\": \"\"}"));
        assertEquals("default", ProjectLists.identityProvider("not json"));
    }

    @Test
    void pagesMatchWithParametersAndAPickedPageTakesItemName() {
        List<String> pages = List.of("/", "/alarms/:name", "/edit");
        assertTrue(ProjectLists.isPage("/alarms/{item.name}", pages));
        assertTrue(ProjectLists.isPage("/alarms/P12", pages));
        assertTrue(ProjectLists.isPage("/", pages));
        assertFalse(ProjectLists.isPage("/alarm", pages));
        assertFalse(ProjectLists.isPage("/edit/x", pages));
        assertEquals("/alarms/{item.name}", ProjectLists.asAlarmPage("/alarms/:name"));
        assertEquals("/", ProjectLists.asAlarmPage("/"));
        // No page configuration, or one that cannot be read: no list, so no page warnings.
        assertNull(ProjectLists.pages("{\"pages\": 3}"));
        assertNull(ProjectLists.pages(null));
        assertNull(ProjectLists.pages("not json"));
        assertNull(ProjectLists.of(Map.of(), null, null).pages());
        assertEquals(List.of(), ProjectLists.pages("{\"pages\": {}}"));
    }
}
