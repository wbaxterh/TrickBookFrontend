#!/bin/bash

echo "🔍 Validating Android build configuration..."

# Check if prebuild exists
if [ ! -d "android" ]; then
    echo "❌ Android directory not found. Running prebuild..."
    npx expo prebuild --platform android --clean
fi

# Check gradle.properties
echo "📋 Checking gradle.properties..."
if [ -f "android/gradle.properties" ]; then
    echo "✅ gradle.properties exists"
    grep -E "(compileSdkVersion|targetSdkVersion|minSdkVersion)" android/gradle.properties || echo "SDK versions not in gradle.properties"
else
    echo "❌ gradle.properties not found"
fi

# Check build.gradle
echo "📋 Checking build.gradle..."
if [ -f "android/build.gradle" ]; then
    echo "✅ build.gradle exists"
    grep -E "(compileSdkVersion|targetSdkVersion|minSdkVersion)" android/build.gradle
else
    echo "❌ build.gradle not found"
fi

# Check app.json Android config
echo "📋 Checking app.json Android configuration..."
grep -A 10 '"android"' app.json

# Check for common issues
echo "🔍 Checking for common issues..."

# Check package name format
PACKAGE_NAME=$(grep -o '"package":\s*"[^"]*"' app.json | cut -d'"' -f4)
if [[ $PACKAGE_NAME =~ ^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$ ]]; then
    echo "✅ Package name format is valid: $PACKAGE_NAME"
else
    echo "❌ Package name format may be invalid: $PACKAGE_NAME"
fi

# Check dependencies
echo "📋 Checking problematic dependencies..."
npm list react-native-screens react-native-gesture-handler react-native-reanimated --depth=0

echo "✅ Validation complete!"
echo ""
echo "💡 To test locally with Java installed:"
echo "   cd android && ./gradlew assembleRelease"
echo ""
echo "💡 To build with EAS:"
echo "   eas build --platform android --profile production --clear-cache"