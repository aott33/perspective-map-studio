pluginManagement {
    repositories {
        gradlePluginPortal()
        maven {
            url = uri("https://nexus.inductiveautomation.com/repository/public")
        }
    }
}

rootProject.name = "perspective-map-studio"

dependencyResolutionManagement {
    repositories {
        // Ignition SDK artifacts come from Inductive Automation's repository.
        maven {
            url = uri("https://nexus.inductiveautomation.com/repository/public")
        }
        mavenCentral()
    }
}

include(
    ":common",
    ":gateway",
    ":designer",
    ":web"
)
