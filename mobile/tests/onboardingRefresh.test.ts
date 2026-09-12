/**
 * Sprint M19 — onboarding hand-off to the parent wardrobe.
 *
 * The bug: App.tsx reloaded the wardrobe only when `[userId, profile]`
 * changed. Onboarding adds garments through its OWN local state, so when
 * the user finishes on Men — the default, and the common case — nothing in
 * those deps changed, the parent never re-read, and the user landed on
 * Today with an empty closet holding items they had just added.
 *
 * WHAT THIS FILE DOES AND DOES NOT PROVE (M19 audit):
 * - The refresh TRIGGER lives in App.tsx React state. There is no React
 *   renderer in this project (no react-test-renderer/jsdom), so the first
 *   and last tests are SOURCE-WIRING assertions: they fail if the dep or
 *   the bump is removed, but they do not run React. The trigger itself is
 *   therefore SOURCE VERIFIED, and must be DEVICE VERIFIED for Men and
 *   Women in native QA.
 * - The middle tests are BEHAVIOURAL: they run the real storage module
 *   through the refresh's read and prove it keeps an item that failed to
 *   sync (it used to be wiped by exactly this refresh).
 */
import './helpers/installMocks';
import { resetStore, resetAlerts, setSupabase } from './helpers/installMocks';
import { createFakeSupabase, TableCall } from './helpers/fakeSupabase';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MOBILE_ROOT } from './helpers/sourcePaths';

import { setCurrentUserId } from '../src/services/authSession';
import { loadUserWardrobe, saveUserGarment } from '../src/services/wardrobeStorage';
import { isSyncPending } from '../src/services/cloudWriteFeedback';
import { GarmentItem } from '../../src/types/wardrobe';

const USER = 'user-dddd';
const APP_SOURCE = readFileSync(join(MOBILE_ROOT, 'App.tsx'), 'utf8');

function garmentFor(id: string, profile: 'men' | 'women'): GarmentItem {
  return {
    id, name: id, category: 'tops', subcategory: 'tshirt', color: 'white', hexColor: '#fff',
    fabric: 'cotton', seasons: ['summer'], formality: 'casual', imageUrl: 'https://cdn.example/x.jpg',
    favorite: false, wearCount: 0, dateAdded: '2026-01-01', tags: [], profile
  } as GarmentItem;
}

function rowFor(id: string, profile: 'men' | 'women') {
  return {
    garment_id: id, name: id, category: 'tops', subcategory: 'tshirt', color: 'white', hex_color: '#fff',
    secondary_colors: null, fabric: 'cotton', seasons: ['summer'], formality: 'casual',
    image_url: 'https://cdn.example/x.jpg', storage_path: null, brand: null, favorite: false, wear_count: 0,
    last_worn_date: null, date_added: '2026-01-01', tags: [], ai_confidence: null, pairing_notes: null,
    fit: null, style: null, layering_role: null, source_profile: profile, is_seed_item: false
  };
}

test('the parent wardrobe re-read is not gated on the profile changing', () => {
  // The wardrobe effect must carry a refresh key alongside [userId, profile],
  // otherwise finishing onboarding on the already-active profile re-runs
  // nothing at all.
  assert.match(
    APP_SOURCE,
    /\}, \[userId, profile, wardrobeRefreshKey\]\);/,
    'the wardrobe effect must depend on wardrobeRefreshKey, not just [userId, profile]'
  );
  // And onboarding completion must actually bump it.
  const onboardingHandler = APP_SOURCE.slice(
    APP_SOURCE.indexOf('const handleOnboardingComplete'),
    APP_SOURCE.indexOf('const handleWearAgain')
  );
  assert.match(
    onboardingHandler,
    /setWardrobeRefreshKey\(\(k\) => k \+ 1\)/,
    'finishing onboarding must trigger a parent wardrobe refresh'
  );
});

for (const profile of ['men', 'women'] as const) {
  test(`the post-onboarding refresh (${profile}) keeps an item that failed to sync instead of wiping it`, async () => {
    resetStore();
    resetAlerts();
    setCurrentUserId(USER);

    // One item syncs, one doesn't (declined retry) during onboarding.
    let inserts = 0;
    setSupabase(
      createFakeSupabase({
        onTable: (call: TableCall) => {
          if (call.op !== 'insert') return { data: [], error: null };
          inserts += 1;
          return inserts === 1 ? { data: null, error: null } : { data: null, error: new Error('network down') };
        }
      }).client
    );
    await saveUserGarment(garmentFor('synced-tee', profile), profile);
    await saveUserGarment(garmentFor('unsynced-tee', profile), profile);

    // The refresh App.tsx triggers on completion: the cloud has only one.
    setSupabase(
      createFakeSupabase({
        onTable: () => ({ data: [rowFor('synced-tee', profile)], error: null })
      }).client
    );
    const refreshed = await loadUserWardrobe(profile);

    assert.deepEqual(refreshed.map((g) => g.id).sort(), ['synced-tee', 'unsynced-tee']);
    assert.equal(isSyncPending(refreshed.find((g) => g.id === 'synced-tee')!), false);
    assert.equal(isSyncPending(refreshed.find((g) => g.id === 'unsynced-tee')!), true);
  });
}

test('onboarding counts only cloud-confirmed items toward completed setup', () => {
  const onboardingSource = readFileSync(
    join(MOBILE_ROOT, 'src', 'screens', 'OnboardingScreen.tsx'),
    'utf8'
  );
  // The category counts that gate "Complete setup" must be derived from the
  // synced subset, never from the raw optimistic list.
  assert.match(onboardingSource, /const syncedWardrobe = wardrobe\.filter\(\(i\) => !unsyncedIds\.includes\(i\.id\)\)/);
  for (const category of ['tops', 'bottoms', 'outerwear', 'shoes', 'accessories']) {
    assert.match(
      onboardingSource,
      new RegExp(`syncedWardrobe\\.filter\\(\\(i\\) => i\\.category === '${category}'\\)`),
      `${category} count must come from cloud-confirmed items only`
    );
  }
  assert.match(
    onboardingSource,
    /result\.cloudSynced/,
    'onboarding must read the honest cloudSynced signal from saveUserGarment'
  );
});
