/**
 * Expo App Configuration
 * Uses environment variables for sensitive data
 */

const GOOGLE_MAPS_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export default {
  expo: {
    name: 'TrickBook',
    slug: 'TrickBook',
    version: '2.1.0',
    privacy: 'public',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    userInterfaceStyle: 'automatic',
    scheme: 'trickbook',
    plugins: [
      'expo-secure-store',
      'expo-router',
      'expo-video',
      'expo-apple-authentication',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'TrickBook uses your location to find nearby spots and show directions.',
        },
      ],
      [
        '@react-native-google-signin/google-signin',
        {
          iosUrlScheme: 'com.googleusercontent.apps.624774098704-r7eqvb0jc4i3or885fk3k1u3l5uqlqmd',
        },
      ],
    ],
    splash: {
      image: './assets/images/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#121212',
    },
    updates: {
      fallbackToCacheTimeout: 0,
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.thetrickbook.trickbook',
      buildNumber: '6',
      config: {
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
      },
      infoPlist: {
        NSCameraUsageDescription:
          'TrickBook uses the camera to take photos for your profile and spots.',
        NSPhotoLibraryUsageDescription: 'TrickBook needs access to your photos to upload images.',
        NSLocationWhenInUseUsageDescription: 'TrickBook uses your location to find nearby spots.',
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'com.thetrickbook.trickbook',
      versionCode: 6,
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#121212',
      },
      config: {
        googleMaps: {
          apiKey: GOOGLE_MAPS_API_KEY,
        },
      },
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
    },
    web: {
      bundler: 'metro',
      favicon: './assets/images/favicon.png',
    },
    extra: {
      eas: {
        projectId: '5fbfc8fe-e3e5-4663-b3af-2a6f903a974f',
      },
      router: {
        origin: false,
      },
    },
    experiments: {
      typedRoutes: true,
    },
  },
};
