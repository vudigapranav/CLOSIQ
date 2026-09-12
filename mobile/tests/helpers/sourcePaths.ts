import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Absolute path to `mobile/`, found by walking up from the compiled test
 * file until `app.json` turns up. Tests that assert on SOURCE wiring (as
 * opposed to runtime behaviour) read the real .tsx files through this, so
 * the lookup must not depend on where tsc happened to place the build.
 */
export const MOBILE_ROOT = (() => {
  let dir = __dirname;
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'app.json')) && existsSync(join(dir, 'App.tsx'))) return dir;
    dir = dirname(dir);
  }
  throw new Error('Could not locate the mobile/ project root from ' + __dirname);
})();
