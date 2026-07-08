// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// 3D companion models (binary glTF with VRM extensions) bundle as assets
config.resolver.assetExts.push('vrm');

// Force a single three.js instance. Package-exports resolution can pull in
// both the ESM and CJS builds (bare 'three' vs three/examples imports),
// which triggers "Multiple instances of Three.js" and breaks instanceof
// checks inside @pixiv/three-vrm.
const threeEntry = require.resolve('three');
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') {
    return { type: 'sourceFile', filePath: threeEntry };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
