const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const { wrapWithReanimatedMetroConfig } = require("react-native-reanimated/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Block non-JS files at the project root from being processed by Metro
config.resolver = {
  ...config.resolver,
  blockList: [
    // Block large JSON data files that are not modules
    /\/full_openapi\.json$/,
    /\/openapi\.json$/,
    /\/openapi_full\.json$/,
    /\/openapi_spec\.json$/,
    /\/q1_output\.json$/,
    /\/q2_output\.json$/,
    /\/q3_output\.json$/,
  ],
};

module.exports = wrapWithReanimatedMetroConfig(
  withNativeWind(config, { input: "./global.css" }),
);
