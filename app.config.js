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
      [
        'expo-notifications',
        {
          // Default Android small-icon color; iOS picks up the app icon automatically.
          color: '#FCF150',
        },
      ],
      // Add `use_frameworks! :linkage => :static` to the iOS Podfile. Required
      // because @react-native-google-signin/google-signin transitively pulls in
      // AppCheckCore (Swift), whose Obj-C deps (GoogleUtilities, RecaptchaInterop)
      // don't expose modules — CocoaPods refuses to mix them as static libs.
      // Switching to static frameworks resolves it without rewriting any pod.
      [
        'expo-build-properties',
        {
          ios: {
            useFrameworks: 'static',
          },
        },
      ],
      // Patch the Podfile to allow non-modular includes inside framework modules.
      // react-native-maps imports React-Core headers as <React/...>, which Xcode
      // rejects under use_frameworks! unless this flag is set. Must come AFTER
      // expo-build-properties since both edit the Podfile's post_install block.
      './plugins/withAllowNonModularIncludes',
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
      // Enable the APNs entitlement so the production build can register for
      // remote notifications. Required for push to actually arrive on iOS.
      entitlements: {
        'aps-environment': 'production',
      },
      infoPlist: {
        NSCameraUsageDescription:
          'TrickBook uses the camera to take photos for your profile and spots.',
        NSPhotoLibraryUsageDescription: 'TrickBook needs access to your photos to upload images.',
        NSLocationWhenInUseUsageDescription: 'TrickBook uses your location to find nearby spots.',
        ITSAppUsesNonExemptEncryption: false,
        // Background fetch for silent push (reserved for future use); enabling
        // this is harmless when we don't actually send content-available pushes.
        UIBackgroundModes: ['remote-notification'],
      },
    },
    android: {
      package: 'com.thetrickbook.trickbook',
      versionCode: 6,
      // Firebase config for FCM push notifications. Locally this resolves to the
      // gitignored secrets file; on EAS Build, set a file secret named
      // GOOGLE_SERVICES_JSON (eas secret:create --type file) and EAS injects the path.
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || '../../secrets/google-services.json',
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#121212',
      },
      config: {
        googleMaps: {
          apiKey: GOOGLE_MAPS_API_KEY,
        },
      },
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'POST_NOTIFICATIONS'],
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
