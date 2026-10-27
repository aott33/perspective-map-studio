plugins {
    `java-library`
}

java {
    toolchain {
        languageVersion.set(org.gradle.jvm.toolchain.JavaLanguageVersion.of(17))
    }
}

dependencies {
    compileOnly("com.inductiveautomation.ignitionsdk:designer-api:${rootProject.extra["sdk_version"]}")
    compileOnly("com.inductiveautomation.ignitionsdk:ignition-common:${rootProject.extra["sdk_version"]}")
    compileOnly("com.inductiveautomation.ignitionsdk:perspective-common:${rootProject.extra["sdk_version"]}")
    compileOnly("com.inductiveautomation.ignitionsdk:perspective-designer:${rootProject.extra["sdk_version"]}")
    compileOnly(project(":common"))
}

// The setup editor's form tests (epic 2 story 7): SetupForm is plain Java over the common contract.
dependencies {
    testImplementation("com.inductiveautomation.ignitionsdk:ignition-common:${rootProject.extra["sdk_version"]}")
    testImplementation(project(":common"))
    testImplementation(platform("org.junit:junit-bom:5.11.4"))
    testImplementation("org.junit.jupiter:junit-jupiter")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.test {
    useJUnitPlatform()
    // SetupPanelTest builds the Swing form with no display.
    systemProperty("java.awt.headless", "true")
}

// Epic 2 story 16: SetupPanelRenderTest paints the form headless into PNGs when given a folder:
// ./gradlew :designer:test --tests '*SetupPanelRenderTest' --rerun -PmapstudioScreenshots=<folder>
tasks.test {
    systemProperty("mapstudio.screenshots", (project.findProperty("mapstudioScreenshots") ?: "").toString())
}
