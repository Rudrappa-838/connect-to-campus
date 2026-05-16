@echo off
echo 🔨 Setting up Android Environment...
set "SDK_PATH=%LOCALAPPDATA:\=/%"
echo sdk.dir=%SDK_PATH%/Android/Sdk>frontend\android\local.properties

echo ☕ Setting JAVA_HOME to Android Studio bundled JDK...
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo 🚀 Building Frontend Assets...
cd frontend
call npm run build
echo 🔄 Syncing Capacitor...
call npx cap sync

echo 🚀 Building AAB (Android App Bundle) for Play Store...
cd android
call gradlew bundleRelease

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Build Failed! Please check if Android SDK is installed.
    pause
    exit /b %ERRORLEVEL%
)

echo ✅ Build Successful!
echo 📦 Moving AAB to release folder...
if not exist "..\..\release" mkdir "..\..\release"
copy app\build\outputs\bundle\release\app-release.aab ..\..\release\ConnectToCampus_Production.aab

echo.
echo 🎉 DONE! Your AAB file is ready in the 'release' folder for Play Store Upload.
echo 🎉 DONE! Your AAB file is ready in the 'release' folder for Play Store Upload.
