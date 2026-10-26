package com.aoindustrial.perspective.mapstudio.gateway.spike;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;

import org.junit.jupiter.api.Test;

/** The custom project resource row of the I/O matrix: the setup.json shape the Gateway reads. */
class SetupResourceTest {

    private static final String SAMPLE = "{\n"
        + "  \"connection\": \"MapStudio\",\n"
        + "  \"connectionNoRights\": \"MapStudioNoRights\",\n"
        + "  \"adapterFunction\": \"mapstudio_checks.kinds\",\n"
        + "  \"alarmMetricPaths\": [\n"
        + "    \"[default]Checks/Alarm Metrics.HasActive\",\n"
        + "    \"[default]Checks/Pump1/Alarm Metrics.HasActive\"\n"
        + "  ]\n"
        + "}\n";

    @Test
    void parsesTheDevSetup() {
        SetupResource setup = SetupResource.parse(SAMPLE);
        assertEquals("MapStudio", setup.connection());
        assertEquals("MapStudioNoRights", setup.connectionNoRights());
        assertEquals("mapstudio_checks", setup.adapterModule());
        assertEquals("kinds", setup.adapterFunctionName());
        assertEquals(List.of("[default]Checks/Alarm Metrics.HasActive",
            "[default]Checks/Pump1/Alarm Metrics.HasActive"), setup.alarmMetricPaths());
    }

    @Test
    void resourceTypeIsTheModulesSetup() {
        assertEquals("com.aoindustrial.perspective.mapstudio", SetupResource.RESOURCE_TYPE.moduleId());
        assertEquals("setup", SetupResource.RESOURCE_TYPE.typeId());
    }

    @Test
    void missingFieldIsRefusedInWords() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
            () -> SetupResource.parse("{\"connection\": \"MapStudio\"}"));
        assertEquals("setup.json needs a string connectionNoRights", ex.getMessage());
    }

    @Test
    void adapterFunctionNeedsAModule() {
        SetupResource setup = SetupResource.parse(
            "{\"connection\": \"a\", \"connectionNoRights\": \"b\", \"adapterFunction\": \"kinds\"}");
        assertThrows(IllegalArgumentException.class, setup::adapterModule);
        assertEquals(List.of(), setup.alarmMetricPaths());
    }
}
