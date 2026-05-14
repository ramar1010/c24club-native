/**
 * Config plugin that renames the main Xcode native target in the generated
 * project.pbxproj. Expo prebuild derives the target name from the app slug
 * ('c24club'), but EAS credentials have 'C24Club' stored — this bridges
 * the gap by renaming the target after prebuild.
 */
const { withXcodeProject } = require('@expo/config-plugins');

const withRenameTarget = (config, { from, to }) => {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;

    // 1. Rename in PBXNativeTarget section
    const nativeTargets = project.pbxNativeTargetSection();
    for (const [key, target] of Object.entries(nativeTargets)) {
      if (key.endsWith('_comment')) continue;
      if (
        target.productType === '"com.apple.product-type.application"' &&
        target.name === from
      ) {
        console.log(`[withRenameTarget] Renaming target: ${from} → ${to}`);
        target.name = to;
        target.productName = to;
        if (nativeTargets[`${key}_comment`] === from) {
          nativeTargets[`${key}_comment`] = to;
        }
      }
    }

    // 2. Rename in PBXProject section (targets list comments)
    const projects = project.pbxProjectSection();
    for (const [key, proj] of Object.entries(projects)) {
      if (key.endsWith('_comment')) continue;
      if (proj.targets) {
        for (const t of proj.targets) {
          if (t.comment === from) {
            t.comment = to;
          }
        }
      }
    }

    // 3. Rename in XCConfigurationList (build configuration names reference the target)
    const configLists = project.pbxXCConfigurationList();
    for (const [key, list] of Object.entries(configLists)) {
      if (key.endsWith('_comment')) {
        if (configLists[key] && configLists[key].includes(`"${from}"`)) {
          configLists[key] = configLists[key].replace(
            new RegExp(`"${from}"`, 'g'),
            `"${to}"`
          );
        }
      }
    }

    return config;
  });
};

module.exports = withRenameTarget;