const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withAndroidAdiRegistration = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const fileContent = 'CENGSNY6BBCO6AAAAAAAAAAAAA';
      const assetsPath = path.join(config.modRequest.platformProjectRoot, 'app/src/main/assets');
      
      if (!fs.existsSync(assetsPath)) {
        fs.mkdirSync(assetsPath, { recursive: true });
      }

      fs.writeFileSync(path.join(assetsPath, 'adi-registration.properties'), fileContent);
      return config;
    },
  ]);
};

module.exports = withAndroidAdiRegistration;