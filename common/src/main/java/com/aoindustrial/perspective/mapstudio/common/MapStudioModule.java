package com.aoindustrial.perspective.mapstudio.common;

import java.util.Set;

import com.inductiveautomation.ignition.common.jsonschema.JsonSchema;
import com.inductiveautomation.perspective.common.api.BrowserResource;

/**
 * Module-wide constants shared by the gateway, designer and common scopes.
 */
public final class MapStudioModule {

    private MapStudioModule() {
    }

    /** Module id; must match {@code id} in the root build.gradle.kts. */
    public static final String MODULE_ID = "com.aoindustrial.perspective.mapstudio";

    /** Mount alias: the web bundle is served at {@code /res/<URL_ALIAS>/}. */
    public static final String URL_ALIAS = "mapstudio";

    /** Palette category the component appears under in the Designer. */
    public static final String COMPONENT_CATEGORY = "Map Studio";

    /** Bundle name written by webpack (web/webpack.config.js). */
    public static final String BUNDLE_NAME = "MapStudio";

    /**
     * The browser resources Perspective loads for the component: the JS and CSS
     * bundle built by the web/ subproject and mounted by the gateway hook.
     */
    public static final Set<BrowserResource> BROWSER_RESOURCES = Set.of(
        new BrowserResource(
            "mapstudio-js",
            String.format("/res/%s/%s.js", URL_ALIAS, BUNDLE_NAME),
            BrowserResource.ResourceType.JS
        ),
        new BrowserResource(
            "mapstudio-css",
            String.format("/res/%s/%s.css", URL_ALIAS, BUNDLE_NAME),
            BrowserResource.ResourceType.CSS
        )
    );

    /** Parse a JSON schema bundled in the common resources. */
    public static JsonSchema schema(String resourcePath) {
        return JsonSchema.parse(MapStudioModule.class.getResourceAsStream(resourcePath));
    }
}
