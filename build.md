# Android Build & Deployment Guide

This guide documents the steps required to configure, compile, and run the **Nyaya Rack** Legal File Management application on an Android device over USB.

---

## 📋 Prerequisites

Ensure you have the following installed on your development machine:
1. **Node.js** (v18 or higher)
2. **Java Development Kit (JDK 17)** (Adoptium Temurin 17 is recommended)
3. **Android SDK** (Android Studio command-line tools or full Android Studio installation)
4. **Android Device** with **USB Debugging** enabled (under Developer Options)

---

## ⚙️ Environment Variables

Configure the following environment variables (Windows PowerShell example):

```powershell
# Set Android SDK path
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "D:\LocDataAndr\SDK", "User")

# Set JDK path (adjust to your Java install directory)
[System.Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Eclipse Adoptium\jdk-17.0.11.9-hotspot", "User")

# Add ADB to path
$currentPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
[System.Environment]::SetEnvironmentVariable("Path", "$currentPath;D:\LocDataAndr\SDK\platform-tools", "User")
```

*Note: Restart your terminal/IDE for environment variable changes to take effect.*

---

## 🔑 1. Generate Debug Keystore

To sign the debug version of the application, we generate a custom `debug.keystore` using the Java `keytool` utility. Run the following command from the root of the project:

```powershell
keytool -genkey -v -keystore android/app/debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
```

### Keystore Configuration details:
- **Keystore Path**: `android/app/debug.keystore`
- **Keystore Password**: `android`
- **Alias**: `androiddebugkey`
- **Key Password**: `android`
- **Validity**: `10,000` days

Gradle is pre-configured in Expo's native templates to automatically look at `android/app/debug.keystore` when running the `debug` build variant.

---

## 📦 2. Prebuild Android Project

If the native `android/` directory is not present or needs to be regenerated, run:

```bash
npx expo prebuild --platform android
```

This creates the Gradle files, manifests, and configures the package name `com.nyayarack.legalmanager`.

---

## 🔌 3. USB Connection Check

Connect your Android phone to the computer via USB. Make sure USB Debugging is active. Verify the connection by running:

```powershell
# Run adb from SDK folder
& "D:\LocDataAndr\SDK\platform-tools\adb.exe" devices
```

**Expected Output:**
```text
List of devices attached
G6YDQ44PN7INVW4P	device
```

---

keytool -genkeypair -v -storetype PKCS12 -keystore nyayarack-release-key.keystore -alias nyayarack-key-alias -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=NyayaRackManagement, OU=Engineering, O=Nyaya, L=City, S=State, C=IN" -storepass nyayarack2026 -keypass nyayarack2026

## 🚀 4. Compile & Run over USB

### Option A: Using Gradle Wrapper (Direct)
Navigate to the native directory and run the Gradle install task:

```powershell
# Navigate into native Android folder
cd android

# Compile and install on the USB connected device
.\gradlew.bat installDebug
```

*This will compile the native code, build the APK, and push/install it on the device.*

To connect the installed app on your USB-connected device to your computer's Metro server:
1. **Forward the port** (run this from your computer terminal):
   ```powershell
   & "D:\LocDataAndr\SDK\platform-tools\adb.exe" reverse tcp:8081 tcp:8081
   ```
2. **Start the Metro server in Dev Client mode** (in another terminal at the project root):
   ```bash
   cd ..
   npm start -- --dev-client
   ```

---

### Option B: Using Expo CLI (Orchestrated)
Alternatively, you can run a single command from the project root that compiles the app with Gradle, installs it over USB, and launches the Metro server:

```bash
npx expo run:android
```

---

## 🛠️ Troubleshooting

- **Error: SDK location not found**:
  Verify that `local.properties` exists in the `android/` directory and contains:
  ```text
  sdk.dir=D:/LocDataAndr/SDK
  ```
- **Error: ADB server failed to start**:
  Kill any stuck ADB processes:
  ```powershell
  & "D:\LocDataAndr\SDK\platform-tools\adb.exe" kill-server
  & "D:\LocDataAndr\SDK\platform-tools\adb.exe" start-server
  ```
