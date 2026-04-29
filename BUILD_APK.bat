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

echo 🚀 Building APK with Driver Back Button Fix...
cd android
call gradlew assembleRelease

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Build Failed! Please check if Android SDK is installed.
    pause
    exit /b %ERRORLEVEL%
)

echo ✅ Build Successful!
echo 📦 Moving APK to download location...
copy app\build\outputs\apk\release\app-release.apk ..\..\frontend\public\SchoolApp.apk
copy app\build\outputs\apk\release\app-release.apk ..\..\backend\public\SchoolApp.apk

echo.
echo 🎉 DONE! You can now download the new APK from the Login Page.
pause
