const { withDangerousMod } = require('@expo/config-plugins');
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve, join } = require('node:path');

function withFixCppBuildError(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      // Fix gesture handler podspec
      const gestureHandlerPath = resolve(
        config.modRequest.projectRoot,
        'node_modules/react-native-gesture-handler/RNGestureHandler.podspec',
      );

      try {
        let gestureHandlerContent = readFileSync(gestureHandlerPath, 'utf8');
        // Replace File.exists? with File.exist?
        gestureHandlerContent = gestureHandlerContent.replace('File.exists?', 'File.exist?');
        writeFileSync(gestureHandlerPath, gestureHandlerContent);
      } catch (_e) {}

      return config;
    },
  ]);
}

module.exports = withFixCppBuildError;
