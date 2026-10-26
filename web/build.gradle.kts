import com.github.gradle.node.npm.task.NpmTask

plugins {
    java
    id("com.github.node-gradle.node") version "7.1.0"
}

// The jar holds only resources, but it must declare the module's JVM target or
// Gradle refuses it as a dependency of :gateway when Gradle itself runs on a
// newer JDK.
java {
    toolchain {
        languageVersion.set(org.gradle.jvm.toolchain.JavaLanguageVersion.of(17))
    }
}

// Where webpack writes the bundle; the whole directory becomes module resources
// served by the gateway hook from its "mounted" folder.
val projectOutput: Provider<Directory> = layout.buildDirectory.dir("generated-resources")

node {
    // A pinned Node is downloaded for the build, independent of any system Node.
    version.set("22.22.0")
    download.set(true)
    nodeProjectDir.set(file(project.projectDir))
}

// Production build by default so every .modl is ship quality; -PwebDev gives
// the unminified build with source maps for debugging.
val webDev = project.hasProperty("webDev")
val webpack by tasks.registering(NpmTask::class) {
    group = "Ignition Module"
    description = "Builds the web bundle with webpack (-PwebDev for a development build)."
    args.set(listOf("run", if (webDev) "build:dev" else "build"))
    dependsOn(tasks.named("npmInstall"))
    inputs.property("webDev", webDev)
    inputs.dir("typescript")
    inputs.files("package.json", "package-lock.json", "webpack.config.js", "tsconfig.json")
    outputs.dir(projectOutput)
}

val jestTest by tasks.registering(NpmTask::class) {
    group = "verification"
    description = "Runs the web unit tests with Jest."
    args.set(listOf("test"))
    dependsOn(tasks.named("npmInstall"))
    inputs.dir("typescript")
    inputs.files("package.json", "package-lock.json", "jest.config.js", "tsconfig.json", "tsconfig.test.json")
}

// Jest runs as part of `gradlew check`, and so of `build`.
tasks.named("check") {
    dependsOn(jestTest)
}

tasks.named("processResources") {
    dependsOn(webpack)
}

sourceSets {
    main {
        // webpack's output (build/generated-resources/mounted/*) is the resource set.
        output.dir(projectOutput, "builtBy" to webpack)
    }
}
