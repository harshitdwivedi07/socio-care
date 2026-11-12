@echo off
cd /d "%~dp0"
if exist run-app (
  echo The folder run-app already exists. Delete it first if you want a fresh start.
  pause
  exit /b
)
call npx create-expo-app@latest run-app --template blank --yes
cd run-app
call npx expo install expo-secure-store expo-location expo-notifications expo-speech react-native-web react-dom @expo/metro-runtime
copy /Y ..\app\App.js App.js
xcopy /E /I /Y ..\app\src src
> .env echo EXPO_PUBLIC_API_URL=http://localhost:3000
echo.
echo Done. To start the app run these two lines:
echo    cd run-app
echo    npx expo start
pause
