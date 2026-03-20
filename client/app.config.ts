import type { ExpoConfig } from 'expo/config';

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const appIconAsset = './assets/647550748_1861598611332676_3411325275701079353_n.png';

const config: ExpoConfig = {
  name: 'sakai-app',
  slug: 'sakai-app',
  scheme: 'sakai',
  version: '1.0.0',
  orientation: 'portrait',
  icon: appIconAsset,
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash-sakai.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: true,
    config: {
      googleMapsApiKey,
    },
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Sakai uses your location to suggest nearby commute origins and show them on the map.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Sakai uses your location during active navigation so it can alert you when you are near your stop.',
      NSMicrophoneUsageDescription:
        'Sakai uses the microphone to let you speak your destination.',
      NSSpeechRecognitionUsageDescription:
        'Sakai uses speech recognition to understand your route requests.',
    },
  },
  android: {
    package: 'com.anonymous.sakaiapp',
    adaptiveIcon: {
      backgroundColor: '#ffffff',
      foregroundImage: appIconAsset,
    },
    predictiveBackGestureEnabled: false,
    config: {
      googleMaps: {
        apiKey: googleMapsApiKey,
      },
    },
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'POST_NOTIFICATIONS',
      'RECORD_AUDIO',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-font',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Sakai uses your location to suggest nearby commute origins and show them on the map.',
        locationAlwaysAndWhenInUsePermission:
          'Sakai uses your location during active navigation so it can alert you when you are near your stop.',
        isAndroidBackgroundLocationEnabled: true,
        isIosBackgroundLocationEnabled: true,
      },
    ],
    'expo-notifications',
    'expo-speech-recognition',
  ],
};

export default config;
