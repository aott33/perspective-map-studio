package com.aoindustrial.perspective.mapstudio.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.File;
import java.net.URL;
import java.net.URLClassLoader;
import java.util.jar.Attributes;
import java.util.jar.JarFile;
import java.util.jar.Manifest;

import org.junit.jupiter.api.Test;

/**
 * The built gateway jar's manifest names the build's version: the map store
 * records it in {@code mapstudio_schema_version.module_version} (docs/contract.md).
 * The 0.2.0 rehearsal found every module jar's manifest empty and the column
 * saying "dev" (owner decision 2026-10-27: fixed before the tag). The gateway
 * build hands the jar's path and the Gradle version in as system properties.
 */
class GatewayJarManifestTest {

    private static File gatewayJar() {
        String path = System.getProperty("mapstudio.gatewayJar");
        assertNotNull(path, "the gateway build sets mapstudio.gatewayJar to the built jar");
        File jar = new File(path);
        assertTrue(jar.isFile(), "the gateway jar is built before the tests: " + path);
        return jar;
    }

    private static String buildVersion() {
        String version = System.getProperty("mapstudio.version");
        assertNotNull(version, "the gateway build sets mapstudio.version");
        assertFalse(version.isBlank(), "the build's version is not blank");
        return version;
    }

    @Test
    void theGatewayJarManifestCarriesTheBuildVersion() throws Exception {
        try (JarFile jar = new JarFile(gatewayJar())) {
            Manifest manifest = jar.getManifest();
            assertNotNull(manifest, "the gateway jar has a manifest");
            String v = manifest.getMainAttributes().getValue(Attributes.Name.IMPLEMENTATION_VERSION);
            assertNotNull(v, "META-INF/MANIFEST.MF lacks Implementation-Version: module_version would be 'dev'");
            assertEquals(buildVersion(), v, "Implementation-Version is the build's version (the tag in a release)");
            assertEquals(v, ModuleVersion.fromManifest(manifest));
        }
    }

    @Test
    void theVersionIsReadFromTheJarAClassWasLoadedFrom() throws Exception {
        // The gateway's reading path (ModuleVersion.of): a class loaded from the jar, as the Gateway loads it.
        String version = buildVersion();
        URL[] urls = {gatewayJar().toURI().toURL()};
        // The parent is the platform loader only, so the class is defined from the jar, not the test classpath.
        try (URLClassLoader loader = new URLClassLoader(urls, ClassLoader.getPlatformClassLoader())) {
            Class<?> fromJar = Class.forName(ModuleVersion.class.getName(), true, loader);
            var of = fromJar.getDeclaredMethod("of", Class.class);
            of.setAccessible(true);
            assertEquals(version, of.invoke(null, fromJar));
        }
    }

    @Test
    void aClassOutsideAJarIsUnknown() {
        // The tests run against classes, where no manifest exists: the placeholder, never a wrong version.
        assertEquals(ModuleVersion.UNKNOWN, ModuleVersion.of(GatewayJarManifestTest.class));
    }
}
