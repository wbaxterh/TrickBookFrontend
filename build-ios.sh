#!/bin/bash

echo "🍏 Starting iOS build for TestFlight..."
echo ""
echo "This script will build your iOS app for TestFlight deployment."
echo ""

# First, let's clean and reinstall dependencies
echo "📦 Cleaning and reinstalling dependencies..."
rm -rf node_modules package-lock.json
npm install

echo ""
echo "🚀 Starting EAS build..."
echo "You will be prompted to log in to your Apple account."
echo ""

# Run the build command - note the correct spelling of "testflight"
eas build --platform ios --profile testflight

echo ""
echo "✅ Build process started!"