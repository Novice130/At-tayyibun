import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
    id("com.google.gms.google-services")
}

// Release signing credentials live outside the repo (see android/key.properties,
// which is gitignored). Debug builds never need them. A release build without
// them fails below: a release signed with the debug key cannot update an
// installed copy and must never be shipped by accident.
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
val hasReleaseSigning = keystorePropertiesFile.exists()
if (hasReleaseSigning) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

gradle.taskGraph.whenReady {
    val buildsRelease = allTasks.any { it.project == project && it.name.contains("Release") }
    if (buildsRelease && !hasReleaseSigning) {
        throw GradleException(
            "Release signing is not configured: ${keystorePropertiesFile.path} is missing. " +
                "Create it with storeFile, storePassword, keyAlias and keyPassword (see " +
                "apps/mobile/README.md). Debug builds do not need it.",
        )
    }
}

android {
    namespace = "com.attayyibun.at_tayyibun"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "com.attayyibun.at_tayyibun"
        // 24 = Android 7.0. Below this, TLS and WebView behaviour get painful
        // and the install base is negligible.
        minSdk = 24
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    // Two apps from one codebase, installable side by side:
    //   prod → com.attayyibun.at_tayyibun     "At-Tayyibun"     → attayyibun.com
    //   dev  → com.attayyibun.at_tayyibun.dev "At-Tayyibun Dev" → staging.attayyibun.com
    // The server is chosen in Dart from the flavor (lib/core/env.dart), so the
    // app ID and the backend can't disagree. Build with --flavor prod|dev.
    // Firebase config per flavor: src/prod/google-services.json (at-tayyibun-prod)
    // and src/dev/google-services.json (at-tayyibun-staging).
    flavorDimensions += "env"
    productFlavors {
        create("prod") {
            dimension = "env"
            manifestPlaceholders["appName"] = "At-Tayyibun"
        }
        create("dev") {
            dimension = "env"
            applicationIdSuffix = ".dev"
            manifestPlaceholders["appName"] = "At-Tayyibun Dev"
        }
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
