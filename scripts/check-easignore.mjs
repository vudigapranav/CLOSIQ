#!/usr/bin/env node
/**
 * Verifies what EAS Build will upload, using the INSTALLED eas-cli's own
 * `Ignore` implementation (build/vcs/local.js) — not a re-implementation.
 *
 * eas-cli (without `requireCommit`) copies the repository's WORKING DIRECTORY
 * from the git top level, skipping anything its Ignore class rejects; a
 * rejected directory's whole subtree is skipped. This script walks the tree
 * the same way and:
 *   - FAILS if any secret-bearing file would be uploaded (.env, .env.local,
 *     signing keys/certs),
 *   - FAILS if a file the mobile build needs would be missing,
 *   - prints the total upload size.
 * Run from the repo root:  node scripts/check-easignore.mjs
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);

function findEasCliLocal() {
  let bin;
  try {
    bin = execFileSync('which', ['eas'], { encoding: 'utf8' }).trim();
  } catch {
    throw new Error('eas-cli not found on PATH — install it (npm i -g eas-cli) to run this check.');
  }
  const real = fs.realpathSync(bin);
  const pkgDir = real.slice(0, real.indexOf('/eas-cli/') + '/eas-cli'.length);
  const version = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).version;
  return { local: require(path.join(pkgDir, 'build', 'vcs', 'local.js')), version };
}

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const { local, version } = findEasCliLocal();
const ignore = await local.Ignore.createForCopyingAsync(root);

const included = [];
let bytes = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(root, abs);
    if (ignore.ignores(rel)) continue; // mirrors fs.cp's filter: skip whole subtree
    if (entry.isDirectory()) {
      walk(abs);
    } else {
      included.push(rel);
      bytes += fs.lstatSync(abs).size;
    }
  }
}
walk(root);

const SECRET = [/(^|\/)\.env$/, /(^|\/)\.env\.(?!example$)[^/]+$/, /\.local$/, /\.(pem|p8|p12|jks|key|keystore|mobileprovision)$/, /(^|\/)credentials\.json$/];
const leaked = included.filter((f) => SECRET.some((re) => re.test(f)));

const REQUIRED = [
  '.easignore',
  'mobile/package.json',
  'mobile/package-lock.json',
  'mobile/app.json',
  'mobile/eas.json',
  'mobile/index.ts',
  'mobile/App.tsx',
  'mobile/metro.config.js',
  'mobile/tsconfig.json',
  'mobile/assets/closiq-logo.png',
  'mobile/scripts/validate-release-env.js',
  'src/data/garmentCatalog.ts',
  'src/types/wardrobe.ts'
];
const missing = REQUIRED.filter((f) => !included.includes(f));

console.log(`eas-cli ${version} ignore rules (${fs.existsSync(path.join(root, '.easignore')) ? '.easignore' : '.gitignore files'})`);
console.log(`would upload: ${included.length} files, ${(bytes / 1048576).toFixed(1)} MB`);
if (leaked.length) console.error(`SECRET FILES WOULD BE UPLOADED:\n  ${leaked.join('\n  ')}`);
if (missing.length) console.error(`REQUIRED FILES WOULD BE MISSING:\n  ${missing.join('\n  ')}`);
if (leaked.length || missing.length) process.exit(1);
console.log('OK — no secret files, all required mobile build inputs present.');
