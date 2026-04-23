/**
 * withTikTokSDK
 *
 * Expo Config Plugin that integrates the TikTok Business Android SDK via Maven
 * (JitPack). Injects into four places at prebuild time:
 *
 *   1. android/build.gradle            — adds JitPack to allprojects repositories
 *   2. android/app/build.gradle        — adds SDK + required dependencies
 *   3. android/app/proguard-rules.pro  — adds TikTok ProGuard keep rules
 *   4. MainApplication (Java/Kotlin)   — initializes the SDK on app startup
 *
 * Usage in app.config.ts:
 *   ['./plugins/withTikTokSDK.js', { appId: 'YOUR_TIKTOK_APP_ID' }]
 *
 * TikTok SDK version: 1.6.1 (latest as of April 2026)
 * Maven source: https://jitpack.io
 * Artifact: com.github.tiktok:tiktok-business-android-sdk
 */

const {
  withProjectBuildGradle,
  withAppBuildGradle,
  withMainApplication,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const TIKTOK_SDK_VERSION = '1.6.1';

// ── 1. Project-level build.gradle — add JitPack repo ──────────────────────────
function addJitPackRepo(config) {
  return withProjectBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;

    const JITPACK_LINE = `        maven { url 'https://jitpack.io' } // TikTok SDK`;

    if (gradle.includes('TikTok SDK')) {
      return cfg; // already injected
    }

    // Inject into the allprojects > repositories block
    gradle = gradle.replace(
      /allprojects\s*\{[\s\S]*?repositories\s*\{/,
      (match) => `${match}\n${JITPACK_LINE}`
    );

    cfg.modResults.contents = gradle;
    return cfg;
  });
}

// ── 2. App-level build.gradle — add dependencies ─────────────────────────────
function addTikTokDependencies(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;

    if (gradle.includes('tiktok-business-android-sdk')) {
      return cfg; // already injected
    }

    const TIKTOK_DEPS = `
    // TikTok Business Android SDK
    implementation 'com.github.tiktok:tiktok-business-android-sdk:${TIKTOK_SDK_VERSION}'
    // Required: app lifecycle listener
    implementation 'androidx.lifecycle:lifecycle-process:2.6.2'
    implementation 'androidx.lifecycle:lifecycle-common-java8:2.6.2'
    // Required: Google Install Referrer
    implementation 'com.android.installreferrer:installreferrer:2.2'
    // TikTok SDK end`;

    // Append just before the closing brace of the dependencies { } block
    gradle = gradle.replace(
      /^(dependencies\s*\{[\s\S]*?)(^\})/m,
      (match, depsBlock, closingBrace) =>
        `${depsBlock}${TIKTOK_DEPS}\n${closingBrace}`
    );

    cfg.modResults.contents = gradle;
    return cfg;
  });
}

// ── 3. ProGuard rules ─────────────────────────────────────────────────────────
function addProguardRules(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const proguardPath = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'proguard-rules.pro'
      );

      const TIKTOK_RULES = `
# ── TikTok Business Android SDK ──────────────────────────────────────────────
-keep class com.tiktok.** { *; }
-keep class com.android.billingclient.api.** { *; }
-keep class androidx.lifecycle.** { *; }
# ─────────────────────────────────────────────────────────────────────────────
`;

      let existing = '';
      if (fs.existsSync(proguardPath)) {
        existing = fs.readFileSync(proguardPath, 'utf-8');
      }

      if (existing.includes('TikTok Business Android SDK')) {
        return cfg; // already added
      }

      fs.writeFileSync(proguardPath, existing + TIKTOK_RULES);
      return cfg;
    },
  ]);
}

// ── 4. MainApplication — initialize TikTok SDK on startup ────────────────────
function addTikTokInit(config, appId) {
  return withMainApplication(config, (cfg) => {
    let contents = cfg.modResults.contents;
    const isKotlin = cfg.modResults.language === 'kt';

    if (contents.includes('TikTokBusinessSdk')) {
      return cfg; // already injected
    }

    if (isKotlin) {
      // Add import after the last existing import line
      contents = contents.replace(
        /(^import .+$)/m,
        `$1\nimport com.tiktok.TikTokBusinessSdk`
      );

      // Inject initialization right after super.onCreate()
      contents = contents.replace(
        /super\.onCreate\(\)/,
        `super.onCreate()
    // TikTok Business SDK — App ID: ${appId}
    val ttConfig = TikTokBusinessSdk.TTConfig(this).setAppId("${appId}")
    TikTokBusinessSdk.initializeSdk(ttConfig)`
      );
    } else {
      // Java
      contents = contents.replace(
        /(^import .+;$)/m,
        `$1\nimport com.tiktok.TikTokBusinessSdk;`
      );

      contents = contents.replace(
        /super\.onCreate\(\);/,
        `super.onCreate();
    // TikTok Business SDK — App ID: ${appId}
    TikTokBusinessSdk.TTConfig ttConfig = new TikTokBusinessSdk.TTConfig(this).setAppId("${appId}");
    TikTokBusinessSdk.initializeSdk(ttConfig);`
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

// ── Compose all modifications ─────────────────────────────────────────────────
const withTikTokSDK = (config, options = {}) => {
  const appId = options.appId;
  if (!appId) {
    throw new Error(
      '[withTikTokSDK] Missing required option: appId. ' +
        "Add it to your app.config.ts: ['./plugins/withTikTokSDK.js', { appId: 'YOUR_ID' }]"
    );
  }

  config = addJitPackRepo(config);
  config = addTikTokDependencies(config);
  config = addProguardRules(config);
  config = addTikTokInit(config, appId);
  return config;
};

module.exports = withTikTokSDK;