#!/bin/bash
cd "$(dirname "$0")"
[ -d run-app ] && { echo "run-app already exists. Delete it first for a fresh start."; exit 1; }
npx create-expo-app@latest run-app --template blank --yes
cd run-app
npx expo install expo-secure-store expo-location expo-notifications expo-speech react-native-web react-dom @expo/metro-runtime
cp ../app/App.js App.js
cp -r ../app/src .
echo "EXPO_PUBLIC_API_URL=http://localhost:3000" > .env
echo "Done. Start it with:  cd run-app && npx expo start"
