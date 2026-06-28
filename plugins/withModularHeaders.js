/**
 * Config plugin that adds `:modular_headers => true` for GoogleUtilities
 * and RecaptchaInterop in the generated Podfile.
 *
 * This is required because AppCheckCore (a Swift pod pulled in by
 * @react-native-google-signin/google-signin) depends on those two pods,
 * which do not define modules by default. Without this, `pod install`
 * fails with:
 *   "The following Swift pods cannot yet be integrated as static libraries"
 */
const { withPodfile } = require('@expo/config-plugins');

const withModularHeaders = (config) =>
  withPodfile(config, (mod) => {
    const podfile = mod.modResults.contents;

    // Only patch if not already patched
    if (podfile.includes('GoogleUtilities', ':modular_headers => true') ||
        podfile.includes("pod 'GoogleUtilities'")) {
      // Already has an explicit GoogleUtilities entry — skip
      return mod;
    }

    // Insert the modular_headers overrides right before the final `end`
    // of the target block (before the last `end` in the file).
    const modularHeadersSnippet = `
  # Required for AppCheckCore (Swift pod) used by @react-native-google-signin
  pod 'GoogleUtilities', :modular_headers => true
  pod 'RecaptchaInterop', :modular_headers => true
`;

    // Find the last `end` in the Podfile and insert before it
    const lastEndIndex = podfile.lastIndexOf('\nend');
    if (lastEndIndex === -1) {
      console.warn('[withModularHeaders] Could not find closing `end` in Podfile — skipping patch.');
      return mod;
    }

    mod.modResults.contents =
      podfile.slice(0, lastEndIndex) +
      modularHeadersSnippet +
      podfile.slice(lastEndIndex);

    return mod;
  });

module.exports = withModularHeaders;