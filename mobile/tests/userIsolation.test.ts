/**
 * Sprint M19 — user-isolation regressions.
 *
 * The bug these lock down: a read issued for user A that RESOLVES after
 * user B has signed in. Before M19, every storage module rebuilt its
 * AsyncStorage key from the module-level "current user" at the moment the
 * promise settled, so A's data was written into B's cache key and handed
 * back to whatever React state was waiting for B.
 */
import './helpers/installMocks';
import { resetStore, store, resetAlerts } from './helpers/installMocks';
import { setSupabase } from './helpers/installMocks';
import { createFakeSupabase } from './helpers/fakeSupabase';
import test from 'node:test';
import assert from 'node:assert/strict';

import { setCurrentUserId, captureSession, isSessionCurrent, userScopedKeyFor } from '../src/services/authSession';
import { loadUserWardrobe } from '../src/services/wardrobeStorage';
import { loadSavedOutfits } from '../src/services/savedOutfitsStorage';
import { loadPlannerEvents } from '../src/services/plannerStorage';
import { loadUserProfile } from '../src/services/userProfileStorage';
import { loadProfileSettings, saveProfileSettings } from '../src/services/profileSettingsStorage';
import { loadRecentOutfitSignatures } from '../src/services/outfitHistoryStorage';

const USER_A = 'user-aaaa';
const USER_B = 'user-bbbb';

function reset() {
  resetStore();
  resetAlerts();
  setCurrentUserId(null);
}

/** A Supabase whose reads hang until the test releases them — this is how
 *  "user A's response arrives late" is reproduced deterministically. */
function deferredSupabase(rows: unknown[]) {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fake = createFakeSupabase({
    onTable: async () => {
      await gate;
      return { data: rows, error: null, count: rows.length };
    }
  });
  return { fake, release: () => release() };
}

test('session generation only advances on a real account change', () => {
  reset();
  setCurrentUserId(USER_A);
  const scope = captureSession();
  // Supabase re-emits the same user on TOKEN_REFRESHED / INITIAL_SESSION;
  // that must not invalidate an in-flight read for that same user.
  setCurrentUserId(USER_A);
  assert.equal(isSessionCurrent(scope), true);

  setCurrentUserId(USER_B);
  assert.equal(isSessionCurrent(scope), false);

  // Back to A is still a NEW session, not the original one.
  setCurrentUserId(USER_A);
  assert.equal(isSessionCurrent(scope), false);
});

test("a delayed user-A wardrobe read never reaches user B's cache or caller", async () => {
  reset();
  setCurrentUserId(USER_A);

  const rowsForA = [
    {
      garment_id: 'a-tee',
      name: "A's tee",
      category: 'tops',
      subcategory: 'tshirt',
      color: 'white',
      hex_color: '#fff',
      secondary_colors: null,
      fabric: 'cotton',
      seasons: ['summer'],
      formality: 'casual',
      image_url: '/wardrobe/men/tops/a-tee.webp',
      storage_path: null,
      brand: null,
      favorite: false,
      wear_count: 0,
      last_worn_date: null,
      date_added: '2026-01-01',
      tags: [],
      ai_confidence: null,
      pairing_notes: null,
      fit: null,
      style: null,
      layering_role: null,
      source_profile: 'men',
      is_seed_item: false
    }
  ];

  const { fake, release } = deferredSupabase(rowsForA);
  setSupabase(fake.client);

  const inFlight = loadUserWardrobe('men');

  // User A logs out, user B logs in — while A's read is still open.
  setCurrentUserId(USER_B);
  release();

  const result = await inFlight;

  assert.deepEqual(result, [], "user A's garments must not be handed to user B");
  assert.equal(
    store.has(userScopedKeyFor(USER_B, '@closiq_user_wardrobe_men')),
    false,
    "user B's cache key must not be written by user A's read"
  );
  assert.equal(
    store.has(userScopedKeyFor(USER_A, '@closiq_user_wardrobe_men')),
    false,
    'a discarded read should not write any cache at all'
  );

  // The query itself was correctly scoped to the user who started it.
  const userFilter = fake.tableCalls[0].filters.find((f) => f[0] === 'eq' && f[1] === 'user_id');
  assert.deepEqual(userFilter, ['eq', 'user_id', USER_A]);
});

// Profile and preferences (the other two of the six modules) have their own
// tests below, because they return defaults rather than an empty list.
test('delayed A→B reads are discarded by the four list-shaped modules', async () => {
  const cases: { name: string; run: () => Promise<unknown>; expected: unknown }[] = [
    { name: 'wardrobe', run: () => loadUserWardrobe('men'), expected: [] },
    { name: 'saved looks', run: () => loadSavedOutfits(), expected: [] },
    { name: 'planner', run: () => loadPlannerEvents(), expected: [] },
    { name: 'outfit history', run: () => loadRecentOutfitSignatures(), expected: [] }
  ];

  for (const testCase of cases) {
    reset();
    setCurrentUserId(USER_A);
    const { fake, release } = deferredSupabase([]);
    setSupabase(fake.client);

    const inFlight = testCase.run();
    setCurrentUserId(USER_B);
    release();

    assert.deepEqual(await inFlight, testCase.expected, `${testCase.name} leaked across a session change`);
    assert.equal(store.size, 0, `${testCase.name} wrote a cache entry after the session changed`);
  }
});

test("a delayed profile read does not show user A's identity to user B", async () => {
  reset();
  setCurrentUserId(USER_A);

  // profiles uses .maybeSingle(), so `data` is a row object, not an array.
  const fakeSingle = createFakeSupabase({
    onTable: async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
      return {
        data: {
          id: USER_A,
          name: 'Alice',
          body_type: 'rectangle',
          skin_tone: 'warm',
          style_preferences: ['minimal'],
          temperature_unit: 'celsius',
          location_permission_status: 'granted',
          onboarding_completed: true
        },
        error: null
      };
    }
  });
  setSupabase(fakeSingle.client);

  const inFlight = loadUserProfile();
  setCurrentUserId(USER_B);
  const result = await inFlight;

  assert.equal(result.name, '', "user A's name must not be returned to user B");
  assert.equal(result.onboardingCompleted, false, 'a stale profile must not mark the new user onboarded');
  assert.equal(store.size, 0, 'no cache entry should be written for a discarded profile read');
});

test('a stale preferences response cannot flip the new user to the old wardrobe profile', async () => {
  reset();
  setCurrentUserId(USER_A);

  const fake = createFakeSupabase({
    onTable: async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
      return { data: { user_id: USER_A, wardrobe_profile: 'women', layering_preference: 'usually' }, error: null };
    }
  });
  setSupabase(fake.client);

  const inFlight = loadProfileSettings();
  setCurrentUserId(USER_B);
  const settings = await inFlight;

  // Falls back to the defaults rather than user A's 'women' — which would
  // otherwise have driven the wardrobe read for user B.
  assert.equal(settings.profile, 'men');
  assert.equal(settings.layeringPreference, 'avoid');
});

test('a preference WRITE that resolves after the account changes is not applied', async () => {
  reset();
  setCurrentUserId(USER_A);

  let upsertPayload: unknown = null;
  const fake = createFakeSupabase({
    onTable: async (call) => {
      if (call.op !== 'upsert') return { data: null, error: null };
      upsertPayload = call.payload;
      // The request is on the wire; the account changes before it answers.
      setCurrentUserId(USER_B);
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
      return { data: null, error: null };
    }
  });
  setSupabase(fake.client);

  const saved = await saveProfileSettings({ profile: 'women' });

  assert.ok(upsertPayload, 'the cloud write must genuinely have been issued for this test to mean anything');
  assert.equal((upsertPayload as { user_id: string }).user_id, USER_A, 'the write belongs to the user who made it');
  assert.equal(saved.profile, 'men', "user A's saved profile must not be returned into user B's session");
  assert.equal(
    store.has(userScopedKeyFor(USER_B, '@closiq_profile_settings')),
    false,
    "user A's write must not land on user B's key"
  );
  assert.equal(store.has(userScopedKeyFor(USER_A, '@closiq_profile_settings')), true);
});

test('a write not yet issued when the account changes is abandoned, not sent as the new user', async () => {
  reset();
  setCurrentUserId(USER_A);
  const fake = createFakeSupabase({ onTable: () => ({ data: null, error: null }) });
  setSupabase(fake.client);

  const inFlight = saveProfileSettings({ profile: 'women' });
  setCurrentUserId(USER_B); // before the cache read yields and the upsert is built
  await inFlight;

  assert.equal(fake.tableCalls.filter((c) => c.op === 'upsert').length, 0);
});
