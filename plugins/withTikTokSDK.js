/**
 * withTikTokSDK
 *
 * Expo Config Plugin that integrates the TikTok Business Android SDK via Maven
 * (JitPack). Injects into three places at prebuild time:
 *
 *   1. android/build.gradle       — adds JitPack to allprojects repositories
 *   2. android/app/build.gradle   — adds SDK + required dependencies
 *   3. android/app/proguard-rules.pro — adds TikTok keep rules
 *
 * TikTok SDK version: 1.6.1 (latest as of April 2026)
 * Maven source: https://jitpack.io
 * Artifact: com.github.tiktok:tiktok-business-android-sdk
 */

const {
  withProjectBuildGradle,
  withAppBuildGradle,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const TIKTOK_SDK_VERSION = '1.6.1';

// ── 1. Project-level build.gradle — add JitPack repo ──────────────────────────
function addJitPackRepo(config) {
  return withProjectBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;

    const JITPACK_BLOCK = `        maven { url 'https://jitpack.io' }`;
    const MARKER = '// TikTok SDK - JitPack';

    if (gradle.includes(MARKER)) {
      // Already injected — no-op
      return cfg;
    }

    // Inject into the allprojects > repositories block.
    // Expo's generated build.gradle always has an allprojects { repositories { … } } section.
    gradle = gradle.replace(
      /allprojects\s*\{[\s\S]*?repositories\s*\{/,
      (match) => `${match}\n${JITPACK_BLOCK} ${MARKER}`
    );

    cfg.modResults.contents = gradle;
    return cfg;
  });
}

// ── 2. App-level build.gradle — add dependencies ─────────────────────────────
function addTikTokDependencies(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;

    const TIKTOK_DEPS = `
    // TikTok Business Android SDK
    implementation 'com.github.tiktok:tiktok-business-android-sdk:${TIKTOK_SDK_VERSION}'
    // Required: app lifecycle listener
    implementation 'androidx.lifecycle:lifecycle-process:2.6.2'
    implementation 'androidx.lifecycle:lifecycle-common-java8:2.6.2'
    // Required: Google Install Referrer
    implementation 'com.android.installreferrer:installreferrer:2.2'
    // TikTok SDK end`;

    if (gradle.includes('tiktok-business-android-sdk')) {
      // Already injected — no-op
      return cfg;
    }

    // Append just before the closing brace of the dependencies block
    gradle = gradle.replace(
      /^(dependencies\s*\{[\s\S]*?)(^\})/m,
      (match, depsBlock, closingBrace) => `${depsBlock}${TIKTOK_DEPS}\n${closingBrace}`
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
        // Already added — no-op
        return cfg;
      }

      fs.writeFileSync(proguardPath, existing + TIKTOK_RULES);
      return cfg;
    },
  ]);
}

// ── Compose all three modifications ──────────────────────────────────────────
const withTikTokSDK = (config) => {
  config = addJitPackRepo(config);
  config = addTikTokDependencies(config);
  config = addProguardRules(config);
  return config;
};

module.exports = withTikTokSDK;