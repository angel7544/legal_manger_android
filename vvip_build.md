# VVIP Build & Keystore Generation Guide

This document outlines the steps required to generate a release keystore, update the necessary configuration files, and build the React Native / Expo application for the Google Play Store.

## 1. Generate the Release Keystore
We use `keytool` (which comes with the Java JDK) to generate a private keystore. The command below generates a `nyayarack-release-key.keystore` file in the `android/app` directory.

Run the following command from the `android/app` directory:
```bash
keytool -genkeypair -v -storetype PKCS12 -keystore nyayarack-release-key.keystore -alias nyayarack-key-alias -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=NyayaRackManagement, OU=Engineering, O=Nyaya, L=City, S=State, C=IN" -storepass nyayarack2026 -keypass nyayarack2026
```
*(Keep this `.keystore` file and the passwords safe. You will need them to push future updates!)*

## 2. Update `gradle.properties`
Instead of hardcoding the keystore credentials into your build scripts, add them as environment variables in your `android/gradle.properties` file.

Append the following lines to `android/gradle.properties`:
```properties
MYAPP_UPLOAD_STORE_FILE=nyayarack-release-key.keystore
MYAPP_UPLOAD_KEY_ALIAS=nyayarack-key-alias
MYAPP_UPLOAD_STORE_PASSWORD=nyayarack2026
MYAPP_UPLOAD_KEY_PASSWORD=nyayarack2026
```

## 3. Update `build.gradle`
Next, configure Gradle to use this new keystore for release builds. Open your `android/app/build.gradle` file and update the `signingConfigs` and `buildTypes` blocks.

Locate the `signingConfigs` section and add the `release` block below `debug`:
```gradle
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
                storeFile file(MYAPP_UPLOAD_STORE_FILE)
                storePassword MYAPP_UPLOAD_STORE_PASSWORD
                keyAlias MYAPP_UPLOAD_KEY_ALIAS
                keyPassword MYAPP_UPLOAD_KEY_PASSWORD
            }
        }
    }
```

Locate the `buildTypes` section and modify the `release` block to use the newly defined `release` signing config instead of `debug`:
```gradle
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.release
            // ... other settings ...
            def enableShrinkResources = findProperty('android.enableShrinkResourcesInReleaseBuilds') ?: 'false'
            shrinkResources enableShrinkResources.toBoolean()
            minifyEnabled enableMinifyInReleaseBuilds
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
            def enablePngCrunchInRelease = findProperty('android.enablePngCrunchInReleaseBuilds') ?: 'true'
            crunchPngs enablePngCrunchInRelease.toBoolean()
        }
    }
```

## 4. Build for Google Play Store

Once the configurations are saved, you can build the application for release.

1. Open your terminal and navigate to the `android` folder:
   ```bash
   cd android
   ```
2. Build the Android App Bundle (AAB):
   ```bash
   .\gradlew.bat bundleRelease
   ```
   *The generated `.aab` file will be located at `android/app/build/outputs/bundle/release/app-release.aab`. This is the file you will upload to the Google Play Console.*

3. (Optional) Build an APK for manual device testing:
   ```bash
   .\gradlew.bat assembleRelease
   ```
   *The generated `.apk` file will be located at `android/app/build/outputs/apk/release/app-release.apk`.*
