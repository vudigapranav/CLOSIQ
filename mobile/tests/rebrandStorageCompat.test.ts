/**
 * HeyHanger rebrand (2026-11-20) — existing phones keep their data.
 *
 * The app was called CLOSIQ. Its on-phone caches live under `@closiq_*`
 * AsyncStorage keys, and those keys were deliberately NOT renamed: nobody
 * sees them, and renaming would make every existing user's offline
 * wardrobe and settings vanish on update. This test seeds a wardrobe the
 * way a pre-rebrand build wrote it and checks the rebranded code still
 * reads it when the cloud is unreachable.
 */
import './helpers/installMocks';
import { resetStore, resetAlerts, store, alertCalls, setSupabase } from './helpers/installMocks';
import { createFakeSupabase } from './helpers/fakeSupabase';
import test from 'node:test';
import assert from 'node:assert/strict';

import { setCurrentUserId, userScopedKeyFor } from '../src/services/authSession';
import { loadUserWardrobe } from '../src/services/wardrobeStorage';
import { loadSavedOutfits } from '../src/services/savedOutfitsStorage';

const USER = 'user-pre-rebrand';

const preRebrandGarment = {
  id: 'navy_oxford_shirt',
  name: 'Navy Oxford Shirt',
  category: 'tops',
  subcategory: 'shirt',
  color: 'navy',
  hexColor: '#1F2A44',
  fabric: 'cotton',
  seasons: ['spring', 'autumn'],
  formality: 'smart_casual',
  imageUrl: 'https://cdn.example/navy.jpg',
  favorite: true,
  wearCount: 3,
  dateAdded: '2026-10-20'
};

test('a wardrobe cached by the CLOSIQ build is still read after the HeyHanger rebrand', async () => {
  resetStore();
  resetAlerts();
  setCurrentUserId(USER);
  // Exactly the key and JSON shape the pre-rebrand app wrote.
  store.set(userScopedKeyFor(USER, '@closiq_user_wardrobe_men'), JSON.stringify([preRebrandGarment]));
  store.set(
    userScopedKeyFor(USER, '@closiq_saved_outfits'),
    JSON.stringify([{ id: 'look-1', occasion: 'Dinner', garmentIds: ['navy_oxford_shirt'], savedAt: '2026-10-21T10:00:00.000Z' }])
  );
  // Cloud unreachable: the app must fall back to the existing local cache.
  setSupabase(createFakeSupabase({ onTable: () => ({ data: null, error: new Error('offline') }) }).client);

  const wardrobe = await loadUserWardrobe('men');
  assert.equal(wardrobe.length, 1);
  assert.equal(wardrobe[0].id, 'navy_oxford_shirt');
  assert.equal(wardrobe[0].name, 'Navy Oxford Shirt');
  assert.equal(alertCalls.length, 0, 'no "couldn\'t load your wardrobe" alert when the old cache exists');

  const looks = await loadSavedOutfits();
  assert.equal(looks.length, 1);
  assert.equal(looks[0].id, 'look-1');
});

test('reading the old cache twice is stable (no migration step that could run twice)', async () => {
  resetStore();
  resetAlerts();
  setCurrentUserId(USER);
  const key = userScopedKeyFor(USER, '@closiq_user_wardrobe_men');
  store.set(key, JSON.stringify([preRebrandGarment]));
  setSupabase(createFakeSupabase({ onTable: () => ({ data: null, error: new Error('offline') }) }).client);

  const first = await loadUserWardrobe('men');
  const second = await loadUserWardrobe('men');
  assert.deepEqual(second.map((g) => g.id), first.map((g) => g.id));
  assert.ok(store.has(key), 'the original key is left in place');
  assert.equal([...store.keys()].some((k) => k.includes('heyhanger')), false, 'nothing is copied to a new key');
});
