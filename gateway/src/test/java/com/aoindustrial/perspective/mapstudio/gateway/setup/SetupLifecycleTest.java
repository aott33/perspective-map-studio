package com.aoindustrial.perspective.mapstudio.gateway.setup;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.inductiveautomation.ignition.common.resourcecollection.Resource;
import com.inductiveautomation.ignition.common.resourcecollection.ResourceId;
import com.inductiveautomation.ignition.common.resourcecollection.ResourcePath;
import com.inductiveautomation.ignition.common.resourcecollection.ResourceType;

import com.aoindustrial.perspective.mapstudio.common.MapStudioModule;
import com.aoindustrial.perspective.mapstudio.common.contract.MapStudioException;

/** Story 6's matrix as the lifecycle sees it: each hook replaces the project's state. */
class SetupLifecycleTest {

    static final String P = "mapstudio-dev";
    static final String GOOD = "{\"schemaVersion\":1,\"connection\":\"MapStudio\","
        + "\"roles\":{\"full\":[\"MapEditor\"],\"phone\":[\"MapOperator\"]}}";

    RecordingLog log;
    SetupRegistry registry;

    static Resource setupResource(String text) {
        var b = Resource.newBuilder()
            .setResourceCollectionName(P)
            .setResourcePath(new ResourcePath(MapStudioModule.SETUP_RESOURCE_TYPE, ""));
        if (text != null) {
            b.putData(MapStudioModule.SETUP_FILE, text);
        }
        return b.build();
    }

    static ResourceId setupId() {
        return new ResourceId(P, new ResourcePath(MapStudioModule.SETUP_RESOURCE_TYPE, ""));
    }

    @BeforeEach
    void setUp() {
        log = new RecordingLog();
        registry = new SetupRegistry(s -> { }, log);
    }

    @Test
    void aValidSetupAtStartThenABadFieldThenFixed() {
        SetupLifecycle.read(registry, P, List.of(setupResource(GOOD)), null);
        assertEquals(SetupState.Status.VALID, registry.state(P).status());

        SetupLifecycle.read(registry, P, List.of(setupResource(GOOD.replace("}}", "},\"refreshIntervalSeconds\":\"ten\"}"))),
            "resource modified");
        assertEquals(SetupState.Status.INVALID, registry.state(P).status());
        assertEquals(1, log.warnings.size());
        assertTrue(log.warnings.get(0).contains("mapstudio-dev") && log.warnings.get(0).contains("refreshIntervalSeconds"));
        MapStudioException ex = assertThrows(MapStudioException.class, () -> registry.require(P));
        assertTrue(ex.plainMessage().contains("refreshIntervalSeconds must be a whole number from 1 to 3600, not \"ten\""));

        SetupLifecycle.read(registry, P, List.of(setupResource(GOOD)), "resource modified");
        assertEquals(SetupState.Status.VALID, registry.state(P).status());
        assertTrue(log.infos.get(log.infos.size() - 1).contains("changed and applied on resource modified"));
        assertEquals(1, log.warnings.size());
    }

    @Test
    void rolesChangedApplyToTheNextRead() {
        SetupLifecycle.read(registry, P, List.of(setupResource(GOOD)), null);
        SetupLifecycle.read(registry, P, List.of(setupResource(GOOD.replace("[\"MapEditor\"]", "[\"Nobody\"]"))),
            "resource modified");
        assertEquals(List.of("Nobody"), registry.require(P).fullRoles());
    }

    @Test
    void notJsonAndAResourceWithoutTheFileAreInvalid() {
        SetupLifecycle.read(registry, P, List.of(setupResource("{\"schemaVersion\": 1,")), "resource modified");
        assertTrue(registry.state(P).reason().startsWith("setup.json is not valid JSON (line 1, column "),
            registry.state(P).reason());
        SetupLifecycle.read(registry, P, List.of(setupResource(null)), "resource created");
        assertEquals("setup.json is missing from the setup resource.", registry.state(P).reason());
        SetupLifecycle.read(registry, P, List.of(setupResource("{\"schemaVersion\":2,\"connection\":\"MapStudio\"}")), null);
        assertEquals("setup.json is written for a newer Map Studio (schema 2; this module reads 1).",
            registry.state(P).reason());
        assertEquals(3, log.warnings.size());
    }

    @Test
    void deletedMakesTheSetupMissingAndOtherTypesAreIgnored() {
        SetupLifecycle.read(registry, P, List.of(setupResource(GOOD)), null);
        ResourceType other = new ResourceType("com.inductiveautomation.perspective", "views");
        SetupLifecycle.deleted(registry, P, List.of(new ResourceId(P, new ResourcePath(other, "Main"))));
        assertEquals(SetupState.Status.VALID, registry.state(P).status(), "a view's deletion is not the setup's");
        SetupLifecycle.deleted(registry, P, List.of(setupId()));
        assertEquals(SetupState.Status.MISSING, registry.state(P).status());
        MapStudioException ex = assertThrows(MapStudioException.class, () -> registry.require(P));
        assertTrue(ex.plainMessage().contains("has no Map Studio setup"));
        SetupLifecycle.read(registry, P, List.of(), "resource modified");
        assertEquals(SetupState.Status.MISSING, registry.state(P).status(), "no setup resource, no change");
    }
}
