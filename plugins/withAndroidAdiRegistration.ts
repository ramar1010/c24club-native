import { ConfigPlugin, withDangerousMod } from '@expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';

const withAndroidAdiRegistration: ConfigPlugin = (config) => {
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

export default withAndroidAdiRegistration;