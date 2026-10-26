/*
 * Map Studio for Ignition Perspective: root build.
 *
 * Layout and plugin configuration follow the Ignition Module Generator and the
 * working shape of other 8.3 Perspective component modules. The module is free
 * (Apache-2.0) and is left unsigned unless signing properties are supplied.
 */

plugins {
    id("io.ia.sdk.modl") version ("0.5.0")
}

// The lowest Ignition the module supports. Java compiles against this SDK so
// that nothing newer than the minimum is used by accident.
val sdk_version by extra("8.3.0")

allprojects {
    // Release builds pass -PreleaseVersion=<tag>; local builds carry a SNAPSHOT.
    version = (project.findProperty("releaseVersion") as String?)?.removePrefix("v") ?: "0.1.0-SNAPSHOT"
}

ignitionModule {
    name.set("Map Studio")
    fileName.set("Map-Studio")
    id.set("com.aoindustrial.perspective.mapstudio")

    // Ignition's module version parser accepts only numeric x.y.z(.b), so the
    // semver string is mapped to numbers: 0.1.0-SNAPSHOT -> 0.1.0, 0.1.0-rc.2 -> 0.1.0.2.
    moduleVersion.set(project.provider {
        val v = project.version.toString()
        val base = v.substringBefore("-")
        val preNumber = Regex("[0-9]+$").find(v.substringAfter("-", ""))?.value
        if (v.contains("-") && preNumber != null) "$base.$preNumber" else base
    })

    moduleDescription.set(
        "Map Studio: the project's map in Perspective, showing each site's live state, " +
            "with tools to build and edit the map in the browser."
    )

    requiredIgnitionVersion.set(sdk_version)

    projectScopes.putAll(mapOf(
        ":common" to "GD",
        ":designer" to "D",
        ":gateway" to "G"
    ))

    moduleDependencies.set(mapOf<String, String>())

    moduleDependencySpecs {
        register("com.inductiveautomation.perspective") {
            scope = "GD"
            required = true
        }
    }

    hooks.putAll(mapOf(
        "com.aoindustrial.perspective.mapstudio.gateway.MapStudioGatewayHook" to "G",
        "com.aoindustrial.perspective.mapstudio.designer.MapStudioDesignerHook" to "D"
    ))

    // Free module: no trial, activation or per-Gateway fee.
    freeModule.set(true)

    // Sign only when -Pignition.signing.* properties are supplied (never in CI
    // or a plain build). A plain `./gradlew build` produces an unsigned .modl.
    skipModlSigning.set(!project.hasProperty("ignition.signing.keystoreFile"))
}

// The licence notice ships inside the .modl and is shown at install time. The
// plugin has no property for it, so the file is staged into the module content
// and referenced from module.xml.
tasks.named("assembleModlStructure") {
    doLast {
        copy {
            from("license.html")
            into(layout.buildDirectory.dir("moduleContent"))
        }
    }
}

tasks.named("zipModule") {
    doFirst {
        val moduleXml = layout.buildDirectory.file("moduleContent/module.xml").get().asFile
        val content = moduleXml.readText()
        if (!content.contains("<license>")) {
            moduleXml.writeText(
                content.replace("</module>", "\t\t<license>license.html</license>\n\t</module>")
            )
        }
    }
}
