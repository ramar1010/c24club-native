const fs = require('fs');
const path = require('path');

// Use path.resolve to ensure absolute paths for require in EAS environment
const pluginsDir = path.resolve(__dirname, 'plugins');
const withAndroidAdiRegistration = require(path.join(pluginsDir, 'withAndroidAdiRegistration.js'));
const withTikTokSDK = require(path.join(pluginsDir, 'withTikTokSDK.js'));

// Read .env file at build time so values get baked into the build
function loadEnv() {
  try {
    const envPath = path.join(process.cwd(), '.env');
    const content = fs.readFileSync(envPath, 'utf-8');

    const result = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed
        .slice(eqIndex + 1)
        .trim()
        .replace(/^['"]|['"]$/g, '');

      result[key] = value;
    }

    return result;
  } catch {
    return {};
  }
}

const env = loadEnv();

module.exports = ({ config }) => ({
  ...config,
  owner: 'ramar1010',

  // Expo project slug
  slug: 'cclub',
  name: 'C24 Club',
  version: '1.9.8',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  // scheme drives deep links; target name comes from package.json name ('c24-club' → 'c24club')
  scheme: 'c24club',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.c24club.app',
    googleServicesFile: './GoogleService-Info.plist',
    usesAppleSignIn: true,
    usesApplePushNotifications: true,
    buildNumber: '133',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      CFBundleDisplayName: 'C24 Club',
      NSCameraUsageDescription:
        'C24 Club needs camera access to allow you to be seen by your chat partner during live video matches.',
      NSMicrophoneUsageDescription:
        'C24 Club needs microphone access so your chat partner can hear you during live video calls.',
    },
  },
  android: {
    package: 'com.c24club.app',
    googleServicesFile: './google-services.json',
    versionCode: 86,
    permissions: [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      'com.android.vending.BILLING',
    ],
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#FACC15',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-web-browser',
    'expo-apple-authentication',
    'expo-notifications',
    withAndroidAdiRegistration,
    [withTikTokSDK, { appId: '7632014615634804757' }],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#1A1A2E',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    ...(config?.extra ?? {}),
    supabaseUrl:
      process.env.EXPO_PUBLIC_SUPABASE_URL ||
      env.EXPO_PUBLIC_SUPABASE_URL ||
      'https://ncpbiymnafxdfsvpxirb.supabase.co',
    supabaseAnonKey:
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
      env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFvA',
    eas: {
      projectId: 'e252f063-663b-44cb-abb0-0cf12a137f15',
    },
  },
});