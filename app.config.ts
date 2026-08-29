import type { ExpoConfig } from 'expo/config';

/**
 * Converted from app.json to app.config.ts so the react-native-maps plugin
 * can read real API keys out of process.env at config-evaluation time.
 * Static app.json only supports literal strings in plugin config — a
 * `"${GOOGLE_MAPS_IOS_API_KEY}"`-style placeholder does not get substituted,
 * and ends up baked verbatim into AndroidManifest.xml, producing a blank map
 * with no error. Reading `process.env` directly here is what actually works.
 *
 * Neither key is prefixed EXPO_PUBLIC_: both are consumed only here, at
 * `expo prebuild` time, to generate native config (Info.plist,
 * AndroidManifest.xml) — never inlined into the JS bundle. See
 * .env.example for where each of the three Maps keys this app uses (this
 * pair, plus the separate EXPO_PUBLIC_ web key used by
 * src/components/MiniMap.web.tsx) comes from and how it should be
 * restricted in Google Cloud Console.
 */
// `newArchEnabled` is a real, current Expo config key that the installed
// @expo/config-types version hasn't caught up to yet -- widening the type
// here rather than dropping the field or suppressing the whole file.
const config: ExpoConfig & { newArchEnabled?: boolean } = {
  name: 'Nightlife',
  slug: 'nightlife',
  scheme: 'nightout',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  updates: {
    fallbackToCacheTimeout: 0,
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'io.linqx.nightout',
  },
  android: {
    package: 'io.linqx.nightout',
    adaptiveIcon: {
      backgroundColor: '#1B3FBF',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: 'metro',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-web-browser',
    [
      'react-native-maps',
      {
        iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY,
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
      },
    ],
    [
      'expo-image-picker',
      {
        // src/lib/media.ts calls both launchCameraAsync and
        // launchImageLibraryAsync, restricted to mediaTypes: ['images'] --
        // never video -- so microphonePermission is set false rather than
        // left to the plugin's default, which would otherwise request
        // RECORD_AUDIO on Android and an NSMicrophoneUsageDescription on iOS
        // for a capability (video/audio capture) this app never uses.
        photosPermission: 'Nightlife uses your photo library so you can add photos to a venue review.',
        cameraPermission: 'Nightlife uses your camera so you can take a photo to add to a venue review.',
        microphonePermission: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: false,
  },
  extra: {
    eas: {
      projectId: 'b2d39e4b-f8c0-419f-be3a-765f9d12ca60',
    },
  },
};

export default config;
