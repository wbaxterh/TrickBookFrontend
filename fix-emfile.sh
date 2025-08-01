#!/bin/bash

echo "Fixing EMFILE error..."

# Kill any existing Metro/Expo processes
echo "Stopping existing processes..."
pkill -f "react-native"
pkill -f "metro"
pkill -f "expo"

# Clear various caches
echo "Clearing caches..."
rm -rf node_modules/.cache
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-*
rm -rf $TMPDIR/react-*

# Install watchman for better file watching
echo "Installing watchman..."
brew install watchman

# Clear watchman state
echo "Clearing watchman state..."
watchman watch-del-all 2>/dev/null || true

# Reset Metro bundler cache
echo "Resetting Metro bundler cache..."
npx react-native start --reset-cache &
sleep 5
pkill -f "react-native"

echo "Fix complete! Try running 'npx expo start' again."