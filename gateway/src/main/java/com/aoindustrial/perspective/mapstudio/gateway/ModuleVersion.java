package com.aoindustrial.perspective.mapstudio.gateway;

import java.io.IOException;
import java.net.JarURLConnection;
import java.net.URL;
import java.net.URLConnection;
import java.util.jar.Attributes;
import java.util.jar.Manifest;

/**
 * The module's version as the build wrote it into the gateway jar's manifest
 * ({@code Implementation-Version}, set by the root build from the Gradle
 * version: the tag in a release, {@code x.y.z-SNAPSHOT} locally). It is the
 * value the map store records in {@code mapstudio_schema_version.module_version}
 * (docs/contract.md), so it must be the real version: the 0.2.0 rehearsal found
 * every jar's manifest empty and the column saying {@link #UNKNOWN}.
 *
 * <p>The package's implementation version is tried first; when the class loader
 * did not define the package from the manifest, the manifest of the jar the
 * class came from is read directly. {@link #UNKNOWN} is only for a class that is
 * not in a jar at all (a test run against classes).
 */
final class ModuleVersion {

    /** The value recorded when no manifest names a version. */
    static final String UNKNOWN = "dev";

    private ModuleVersion() {
    }

    /** The version of the jar holding {@code type}, or {@link #UNKNOWN}. */
    static String of(Class<?> type) {
        Package pkg = type.getPackage();
        String v = pkg == null ? null : pkg.getImplementationVersion();
        if (v == null) {
            v = fromManifest(manifestOf(type));
        }
        return v == null ? UNKNOWN : v;
    }

    /** The manifest's {@code Implementation-Version}, null when absent or blank. */
    static String fromManifest(Manifest manifest) {
        if (manifest == null) {
            return null;
        }
        String v = manifest.getMainAttributes().getValue(Attributes.Name.IMPLEMENTATION_VERSION);
        return v == null || v.isBlank() ? null : v.trim();
    }

    /** The manifest of the jar {@code type} was loaded from; null when it is not in a jar. */
    private static Manifest manifestOf(Class<?> type) {
        URL url = type.getResource(type.getSimpleName() + ".class");
        if (url == null) {
            return null;
        }
        try {
            URLConnection connection = url.openConnection();
            if (connection instanceof JarURLConnection jar) {
                jar.setUseCaches(false);
                return jar.getManifest();
            }
            return null;
        } catch (IOException | RuntimeException ex) {
            return null;
        }
    }
}
