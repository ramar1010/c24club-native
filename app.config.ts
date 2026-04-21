import { ExpoConfig, ConfigContext } from "expo/config";
import * as fs from "fs";
import * as path from "path";

// Read .env file at build time so values get baked into the APK
function loadEnv(): Record<string, string> {
  try {
    const envPath = path.join(__dirname, ".env");
    const content = fs.readFileSync(envPath, "utf-8");
    const result: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed
        .slice(eqIndex + 1)
        .trim()
        .replace(/^[\'\"]|[\'\"]$/g, "");
      result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

const env = loadEnv();

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: "ramar1010",
  // Must match the existing EAS project slug for extra.eas.projectId
  slug: "template",
  name: "C24 Club",
  version: "1.7.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "c24club",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.c24club.app",
    usesAppleSignIn: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: "C24 Club needs camera access for video chat.",
      NSMicrophoneUsageDescription: "C24 Club needs microphone access for video chat.",
      UIBackgroundModes: ["remote-notification"],
    },
  },
  android: {
    package: "com.c24club.app",
    googleServicesFile: "./google-services.json",
    versionCode: 55,
    permissions: [
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
      "android.permission.MODIFY_AUDIO_SETTINGS",
      "android.permission.INTERNET",
      "android.permission.ACCESS_NETWORK_STATE",
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
      "com.android.vending.BILLING",
    ],
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-web-browser",
    "expo-apple-authentication",
    "./plugins/withAndroidAdiRegistration.js",
    [
      "expo-notifications",
      {
        icon: "./assets/images/favicon.png",
        color: "#EF4444",
        androidMode: "default",
        androidCollapsedTitle: "C24 Club",
        iosDisplayInForeground: true,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#1A1A2E",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    supabaseUrl:
      process.env.EXPO_PUBLIC_SUPABASE_URL ||
      "https://ncpbiymnafxdfsvpxirb.supabase.co",
    supabaseAnonKey:
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFvA",
    eas: { projectId: "3f21aa81-c90d-4050-b1a6-80b40a69cf31" },
  },
});