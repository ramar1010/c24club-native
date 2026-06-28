module.exports = function (api) {
  // Add optional/future plugins here. Keep core plugins in babel.config.js
  return [
    // react-native-reanimated/plugin is required for Reanimated 4 worklet transforms.
    // Without it, 'worklet' directives are not transformed, causing Metro to deadlock
    // at 0% during bundle resolution when react-native-worklets initializes.
    // NOTE: react-native-worklets/plugin is intentionally NOT included here — it caused hangs.
    "react-native-reanimated/plugin",
  ];
};