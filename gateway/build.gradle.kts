plugins {
    `java-library`
}

java {
    toolchain {
        languageVersion.set(org.gradle.jvm.toolchain.JavaLanguageVersion.of(17))
    }
}

dependencies {
    compileOnly("com.inductiveautomation.ignitionsdk:ignition-common:${rootProject.extra["sdk_version"]}")
    compileOnly("com.inductiveautomation.ignitionsdk:gateway-api:${rootProject.extra["sdk_version"]}")
    compileOnly("com.inductiveautomation.ignitionsdk:perspective-common:${rootProject.extra["sdk_version"]}")
    compileOnly("com.inductiveautomation.ignitionsdk:perspective-gateway:${rootProject.extra["sdk_version"]}")
    compileOnly(project(":common"))
    // The web bundle (React, TypeScript, MapLibre) ships inside the gateway scope.
    modlImplementation(project(":web"))
}

dependencies {
    // Unit tests run the pure parts of the delegate against the same SDK jars.
    testImplementation("com.inductiveautomation.ignitionsdk:ignition-common:${rootProject.extra["sdk_version"]}")
    testImplementation("com.inductiveautomation.ignitionsdk:perspective-common:${rootProject.extra["sdk_version"]}")
    testImplementation("com.inductiveautomation.ignitionsdk:perspective-gateway:${rootProject.extra["sdk_version"]}")
    testImplementation("com.inductiveautomation.ignitionsdk:gateway-api:${rootProject.extra["sdk_version"]}")
    testImplementation(project(":common"))
    testImplementation(platform("org.junit:junit-bom:5.11.4"))
    testImplementation("org.junit.jupiter:junit-jupiter")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.test {
    useJUnitPlatform()
    // GatewayScriptModuleTest starts Jython; keep it from writing a package cache into the checkout.
    systemProperty("python.cachedir.skip", "true")
}

// GatewayJarManifestTest opens the built gateway jar and fails when its manifest
// does not name this build's version (the map store's module_version column
// comes from it, see the root build). Tests run against classes, not the jar,
// so the jar is built first and its path handed over.
val gatewayJar = tasks.jar.flatMap { it.archiveFile }
tasks.test {
    dependsOn(tasks.jar)
    inputs.file(gatewayJar)
    systemProperty("mapstudio.gatewayJar", gatewayJar.get().asFile.absolutePath)
    systemProperty("mapstudio.version", project.version.toString())
}
