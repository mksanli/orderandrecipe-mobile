const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// WebAssembly (.wasm) desteğini ekle
config.resolver.assetExts.push('wasm');

module.exports = config;