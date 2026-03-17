@echo off
echo 🔨 Setting up Android Environment...
set "SDK_PATH=%LOCALAPPDATA:\=/%"
echo sdk.dir=%SDK_PATH%/Android/Sdk>frontend\android\local.properties

echo 🚀 Building APK with Driver Back Button Fix...
cd frontend\android
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
