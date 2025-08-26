const { getDefaultConfig } = require('expo/metro-config');

module.exports = (() => {
  const config = getDefaultConfig(__dirname);

  config.resolver.sourceExts.push('cjs'); // ✅ Allow CommonJS files
  config.resolver.unstable_enablePackageExports = false; // ✅ Disable "exports" resolution to fix Firebase modules

  return config;
})();
