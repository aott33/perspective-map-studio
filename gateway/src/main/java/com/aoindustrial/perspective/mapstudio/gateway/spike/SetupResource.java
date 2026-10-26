package com.aoindustrial.perspective.mapstudio.gateway.spike;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import com.inductiveautomation.ignition.common.ImmutableBytes;
import com.inductiveautomation.ignition.common.gson.JsonArray;
import com.inductiveautomation.ignition.common.gson.JsonElement;
import com.inductiveautomation.ignition.common.gson.JsonObject;
import com.inductiveautomation.ignition.common.gson.JsonParser;
import com.inductiveautomation.ignition.common.resourcecollection.Resource;
import com.inductiveautomation.ignition.common.resourcecollection.ResourceType;

import com.aoindustrial.perspective.mapstudio.common.MapStudioModule;

/**
 * Spike (story 3): the project setup read from a custom project resource of
 * type {@code com.aoindustrial.perspective.mapstudio/setup}, stored as
 * {@code setup.json} in the project folder. Gateway-side read only; the
 * Designer editor is a later decision (epic-map-store-and-data).
 *
 * <p>Removed by the refactor sweep (story 8) or replaced by the real setup of AD-5.
 */
public record SetupResource(
        String connection,
        String connectionNoRights,
        String adapterFunction,
        List<String> alarmMetricPaths) {

    public static final ResourceType RESOURCE_TYPE = MapStudioModule.SETUP_RESOURCE_TYPE;
    public static final String RESOURCE_FILE = "setup.json";

    public SetupResource {
        Objects.requireNonNull(connection, "connection");
        Objects.requireNonNull(connectionNoRights, "connectionNoRights");
        Objects.requireNonNull(adapterFunction, "adapterFunction");
        alarmMetricPaths = List.copyOf(alarmMetricPaths);
    }

    /** Read the setup from a loaded project resource, or empty when it has no setup.json. */
    public static Optional<SetupResource> fromResource(Resource resource) {
        return resource.getData(RESOURCE_FILE)
            .map(ImmutableBytes::getBytesAsString)
            .map(SetupResource::parse);
    }

    /**
     * Parse the setup JSON. Pure, so the shape can be tested without a Gateway.
     *
     * @throws IllegalArgumentException when a required field is missing or has the wrong type
     */
    public static SetupResource parse(String json) {
        JsonElement root = JsonParser.parseString(json);
        if (!root.isJsonObject()) {
            throw new IllegalArgumentException("setup.json must hold a JSON object");
        }
        JsonObject o = root.getAsJsonObject();
        List<String> paths = new ArrayList<>();
        JsonElement pathsElement = o.get("alarmMetricPaths");
        if (pathsElement != null && pathsElement.isJsonArray()) {
            JsonArray array = pathsElement.getAsJsonArray();
            for (JsonElement e : array) {
                paths.add(requireString(e, "alarmMetricPaths[]"));
            }
        }
        return new SetupResource(
            requireString(o.get("connection"), "connection"),
            requireString(o.get("connectionNoRights"), "connectionNoRights"),
            requireString(o.get("adapterFunction"), "adapterFunction"),
            paths);
    }

    /** The Python module part of {@code adapterFunction}, for example {@code mapstudio_checks}. */
    public String adapterModule() {
        int dot = adapterFunction.lastIndexOf('.');
        if (dot <= 0 || dot == adapterFunction.length() - 1) {
            throw new IllegalArgumentException("adapterFunction must be <module>.<function>: " + adapterFunction);
        }
        return adapterFunction.substring(0, dot);
    }

    /** The function part of {@code adapterFunction}, for example {@code kinds}. */
    public String adapterFunctionName() {
        return adapterFunction.substring(adapterModule().length() + 1);
    }

    private static String requireString(JsonElement element, String name) {
        if (element == null || !element.isJsonPrimitive() || !element.getAsJsonPrimitive().isString()) {
            throw new IllegalArgumentException("setup.json needs a string " + name);
        }
        return element.getAsString();
    }
}
