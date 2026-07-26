// Default Expo Metro config. The shared backend in ./src is bundled directly
// (root-level app), resolved via the `@backend/*` path alias in tsconfig.json.
const { getDefaultConfig } = require('expo/metro-config')

module.exports = getDefaultConfig(__dirname)
