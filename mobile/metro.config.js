const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
// The mobile app deliberately reuses the root web app's shared types/data
// (src/types/wardrobe.ts, src/data/garmentCatalog.ts — see STATE.md's
// "Reusable Architecture") instead of duplicating them. Metro's default
// watchFolders only covers `projectRoot`, so those relative imports
// (e.g. '../../../src/data/garmentCatalog') resolve fine in `tsc` (which
// has no concept of a Metro project boundary) but fail at actual bundle
// time — confirmed via `npx expo export`. Widening watchFolders to the
// monorepo root is the standard Expo fix for this exact scenario.
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

module.exports = config;
