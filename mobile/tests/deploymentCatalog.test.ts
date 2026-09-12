/**
 * Deployment prep — every catalog image the app can reference must exist in
 * public/wardrobe (which the backend build copies to dist/wardrobe and serves).
 * scripts/verify-deployment.mjs then proves every file in public/wardrobe is
 * served by the deployed host; together: every catalog image resolves in
 * production. Pure filesystem check, no network.
 */
import './helpers/installMocks';
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MOBILE_ROOT } from './helpers/sourcePaths';
import { GARMENT_CATALOG } from '../../src/data/garmentCatalog';

const PUBLIC_DIR = join(MOBILE_ROOT, '..', 'public');

test('every catalog entry has its WebP in public/wardrobe', () => {
  assert.ok(GARMENT_CATALOG.length > 0);
  const missing = GARMENT_CATALOG.filter((e) => !existsSync(join(PUBLIC_DIR, e.imagePath)));
  assert.deepEqual(missing.map((e) => e.imagePath), []);
});

test('catalog image files are real WebP, not symlinks to excluded source photos', () => {
  for (const entry of GARMENT_CATALOG) {
    const buf = readFileSync(join(PUBLIC_DIR, entry.imagePath));
    assert.equal(buf.subarray(0, 4).toString(), 'RIFF', entry.imagePath);
    assert.equal(buf.subarray(8, 12).toString(), 'WEBP', entry.imagePath);
  }
});
