@echo off
echo Building FileHub Android APK...
call gradlew.bat assembleDebug
if %ERRORLEVEL% equ 0 (
    echo.
    echo ============================================================
    echo APK Build SUCCESSFUL!
    echo Output: android\app\build\outputs\apk\debug\app-debug.apk
    echo ============================================================
    copy /y "app\build\outputs\apk\debug\app-debug.apk" "..\public\downloads\FileHub.apk"
) else (
    echo.
    echo Gradle build failed. Check that JDK 17+ and Android SDK are configured.
)
pause
