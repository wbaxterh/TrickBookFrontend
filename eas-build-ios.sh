#!/bin/bash

echo "🚀 Starting EAS iOS Build with all fixes..."

# Ensure patches are applied
echo "📝 Applying patches..."
npx patch-package

# Clean and reinstall
echo "🧹 Cleaning and reinstalling dependencies..."
rm -rf node_modules package-lock.json
npm install

# Run prebuild to apply plugins
echo "🔨 Running expo prebuild to apply iOS fixes..."
npx expo prebuild --platform ios --clean

# Start the build
echo "🏗️ Starting EAS build for iOS TestFlight..."
eas build --platform ios --profile testflight --clear-cache

echo "✅ Build submitted! Check EAS dashboard for progress."