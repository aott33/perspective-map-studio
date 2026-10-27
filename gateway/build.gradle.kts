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
