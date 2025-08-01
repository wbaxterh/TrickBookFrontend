#!/bin/bash

echo "🔧 Fixing iOS build issues and starting build..."

# Fix gesture handler podspec issue
echo "📝 Fixing react-native-gesture-handler podspec..."
sed -i '' 's/File.exists?/File.exist?/g' node_modules/react-native-gesture-handler/RNGestureHandler.podspec

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install expo config plugins if needed
npm install --save-dev @expo/config-plugins

# Clear all caches
echo "🧹 Clearing caches..."
rm -rf ~/Library/Developer/Xcode/DerivedData/*
cd ios && rm -rf Pods Podfile.lock && pod cache clean --all && cd ..

# Prebuild to apply plugins
echo "🔨 Running expo prebuild..."
npx expo prebuild --clean

# Start the build
echo "🚀 Starting EAS build..."
eas build --platform ios --profile testflight --clear-cache

echo "✅ Build started! Check the EAS dashboard for progress."