#!/bin/bash

echo "🔧 Fixing iOS build dependencies..."

# Clean npm cache and node_modules
echo "📦 Cleaning npm cache and node_modules..."
rm -rf node_modules
rm -rf package-lock.json
npm cache clean --force

# Install dependencies with exact versions for Expo SDK 47
echo "📦 Installing compatible dependencies..."
npm install

# Clear EAS build cache
echo "🧹 Clearing EAS build cache..."
npx eas build --clear-cache --platform ios --profile testflight --non-interactive || true

echo "✅ Dependencies fixed! Try building again..."
echo "🚀 Run: npx eas build --platform ios --profile testflight"