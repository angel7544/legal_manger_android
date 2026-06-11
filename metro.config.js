const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add wasm to asset extensions so expo-sqlite can build for web
config.resolver.assetExts.push('wasm');

module.exports = config;
