/**
 * Sprint M19 — honest failed-write semantics, and delete ordering.
 *
 * Before M19 every failed cloud write told the user the change "will sync
 * when you're back online". No sync queue, retry-on-reconnect listener, or
 * background job exists anywhere in this codebase, so that was a promise
 * the app could never keep. These tests lock in the replacement: an honest
 * message, a real retry through the same service, and a local cache that
 * never claims a deletion the account didn't accept.
 */
import './helpers/installMocks';
import {
  resetStore,
  resetAlerts,
  store,
  alertCalls,
  setAlertResponse,
  setSupabase,
  setAlertHook
} from './helpers/installMocks';
import { createFakeSupabase, flush, TableCall } from './helpers/fakeSupabase';
import test from 'node:test';
import assert from 'node:assert/strict';

import { setCurrentUserId, userScopedKeyFor } from '../src/services/authSession';
import { loadUserWardrobe } from '../src/services/wardrobeStorage';
import { loadSavedOutfits } from '../src/services/savedOutfitsStorage';
import { loadPlannerEvents } from '../src/services/plannerStorage';
import { isSyncPending } from '../src/services/cloudWriteFeedback';
import { saveUserGarment, removeUserGarment, seedDemoWardrobeIfNeeded } from '../src/services/wardrobeStorage';
import { saveOutfitToStorage, removeSavedOutfitFromStorage } from '../src/services/savedOutfitsStorage';
import { addPlannerEvent, deletePlannerEvent, updatePlannerEvent } from '../src/services/plannerStorage';
import { saveUserProfile } from '../src/services/userProfileStorage';
import { saveProfileSettings } from '../src/services/profileSettingsStorage';
import { GarmentItem } from '../../src/types/wardrobe';

const USER = 'user-cccc';
const WARDROBE_KEY = userScopedKeyFor(USER, '@closiq_user_wardrobe_men');

function reset() {
  resetStore();
  resetAlerts();
  setCurrentUserId(USER);
}

function garment(id: string, imageUrl = 'https://cdn.example/x.jpg'): GarmentItem {
  return {
    id,
    name: id,
    category: 'tops',
    subcategory: 'tshirt',
    color: 'white',
    hexColor: '#ffffff',
    fabric: 'cotton',
    seasons: ['summer'],
    formality: 'casual',
    imageUrl,
    favorite: false,
    wearCount: 0,
    dateAdded: '2026-01-01',
    tags: []
  } as GarmentItem;
}

/** No alert raised by this codebase may promise deferred synchronization. */
function assertNoSyncPromise() {
  for (const call of alertCalls) {
    const text = `${call.title} ${call.message ?? ''}`.toLowerCase();
    assert.ok(
      !/will sync|syncs? when|sync automatically|automatically sync/.test(text),
      `alert promises synchronization the app cannot perform: ${JSON.stringify(call)}`
    );
  }
}

const failEverything = () => ({ data: null, error: new Error('network down') });

test('a failed garment save reports failure honestly and keeps the item locally', async () => {
  reset();
  const fake = createFakeSupabase({ onTable: failEverything });
  setSupabase(fake.client);

  const result = await saveUserGarment(garment('tee-1'), 'men');

  assert.equal(result.cloudSynced, false, 'a failed insert must not be reported as synced');
  assert.equal(result.items.length, 1, "the user's own new item must not be thrown away");
  assert.equal(result.items[0].id, 'tee-1');

  // Local cache still holds it — no data loss, no second persistence system.
  const cached = JSON.parse(store.get(WARDROBE_KEY) as string);
  assert.equal(cached.length, 1);

  assert.ok(alertCalls.length > 0, 'the failure must be surfaced, not swallowed');
  assertNoSyncPromise();
  assert.match(alertCalls[0].message ?? '', /does not upload later on its own/);
  assert.deepEqual(
    alertCalls[0].buttons?.map((b) => b.text),
    ['Not now', 'Try again'],
    'the only real recovery mechanism — retrying now — must be offered'
  );
});

test('retrying a failed save re-issues the write through the same service', async () => {
  reset();
  let attempts = 0;
  const fake = createFakeSupabase({
    onTable: (call: TableCall) => {
      if (call.op !== 'insert') return { data: [], error: null };
      attempts += 1;
      // Fails once, then succeeds — the retry is what makes it land.
      return attempts === 1 ? { data: null, error: new Error('network down') } : { data: null, error: null };
    }
  });
  setSupabase(fake.client);
  setAlertResponse('accept');

  const result = await saveUserGarment(garment('tee-2'), 'men');

  assert.equal(attempts, 2, 'the retry must actually re-run the insert');
  assert.equal(result.cloudSynced, true);
  assertNoSyncPromise();
});

test('a garment image is deleted ONLY after the database row is confirmed gone', async () => {
  reset();
  const fake = createFakeSupabase({
    onTable: (call: TableCall) =>
      call.op === 'delete' ? { data: null, error: new Error('delete rejected') } : { data: [], error: null }
  });
  setSupabase(fake.client);

  // Seed the local cache with the item being removed.
  store.set(WARDROBE_KEY, JSON.stringify([garment('tee-3')]));

  const remaining = await removeUserGarment('tee-3', 'men');

  assert.equal(
    fake.storageCalls.filter((c) => c.op === 'remove').length,
    0,
    'the image must NOT be deleted while its database row still exists'
  );
  assert.equal(remaining.length, 1, 'a deletion the account rejected must not be shown as done');
  const cached = JSON.parse(store.get(WARDROBE_KEY) as string);
  assert.equal(cached.length, 1, 'the local cache must match what the account actually holds');
  assertNoSyncPromise();
  assert.match(alertCalls[0].message ?? '', /still there/);
});

test('a successful garment delete removes the row first, then the image', async () => {
  reset();
  const fake = createFakeSupabase({
    onTable: () => ({ data: null, error: null }),
    onStorage: () => ({ data: null, error: null })
  });
  setSupabase(fake.client);
  store.set(WARDROBE_KEY, JSON.stringify([garment('tee-4')]));

  const remaining = await removeUserGarment('tee-4', 'men');

  assert.deepEqual(remaining, []);
  const removeCalls = fake.storageCalls.filter((c) => c.op === 'remove');
  assert.equal(removeCalls.length, 1, 'the orphaned image should be cleaned up once the row is gone');
  assert.deepEqual(removeCalls[0].args[0], [`${USER}/tee-4.jpg`]);
  // Ordering: the storage removal happened strictly after the DB delete
  // resolved — never before, never concurrently.
  const deleteAt = fake.sequence.indexOf('garments.delete');
  const removeAt = fake.sequence.indexOf('storage.remove');
  assert.ok(deleteAt >= 0 && removeAt > deleteAt, `wrong order: ${fake.sequence.join(' → ')}`);
});

test("a seed item's delete does not attempt an image removal it never had", async () => {
  reset();
  const fake = createFakeSupabase({ onTable: () => ({ data: null, error: null }) });
  setSupabase(fake.client);
  const seed = { ...garment('seed-1'), isSeedItem: true } as GarmentItem;
  store.set(WARDROBE_KEY, JSON.stringify([seed]));

  await removeUserGarment('seed-1', 'men');

  assert.equal(fake.storageCalls.filter((c) => c.op === 'remove').length, 0);
});

test('a failed photo upload still saves the garment and says exactly what happened', async () => {
  reset();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })) as unknown as typeof fetch;

  const fake = createFakeSupabase({
    onTable: () => ({ data: null, error: null }),
    onStorage: (call) =>
      call.op === 'upload' ? { data: null, error: new Error('bucket missing') } : { data: null, error: null }
  });
  setSupabase(fake.client);

  const result = await saveUserGarment(garment('tee-5', 'file:///tmp/photo.jpg'), 'men');
  globalThis.fetch = originalFetch;

  assert.equal(result.cloudSynced, true, 'the metadata row did save');
  assert.equal(result.imageSynced, false, 'the photo did not');
  assertNoSyncPromise();
  assert.ok(alertCalls.some((a) => /photo/i.test(a.title)));
});

test('failed saves across looks, planner, profile and preferences all report honestly', async () => {
  const cases: { name: string; run: () => Promise<unknown> }[] = [
    {
      name: 'saved look',
      run: () =>
        saveOutfitToStorage({
          id: 'look-1',
          title: 'Look',
          occasion: 'casual',
          vibe: 'easy',
          formalityLabel: 'Casual',
          temperature: 20,
          items: [],
          styleScore: 90,
          explanation: { summary: '', points: [] },
          saved: false,
          dateCreated: '2026-01-01'
        } as never)
    },
    {
      name: 'planner event',
      run: () => addPlannerEvent({ title: 'Dinner', date: '2026-02-01', time: '19:00', occasion: 'date' } as never)
    },
    { name: 'user profile', run: () => saveUserProfile({ name: 'Casey' }) },
    { name: 'preferences', run: () => saveProfileSettings({ layeringPreference: 'usually' }) }
  ];

  for (const testCase of cases) {
    reset();
    setSupabase(createFakeSupabase({ onTable: failEverything }).client);
    await testCase.run();
    await flush();
    assert.ok(alertCalls.length > 0, `${testCase.name} failure was swallowed`);
    assertNoSyncPromise();
  }
});

test('a rejected planner edit or delete is rolled back to what the account holds', async () => {
  const key = userScopedKeyFor(USER, '@closiq_planner_events');
  const stored = [
    { id: 'event-1', title: 'Dinner', date: '2026-02-01', time: '19:00', occasion: 'date', createdAt: '2026-01-01' }
  ];

  reset();
  setSupabase(createFakeSupabase({ onTable: failEverything }).client);
  store.set(key, JSON.stringify(stored));
  const afterEdit = await updatePlannerEvent('event-1', { title: 'Lunch' });
  assert.equal(afterEdit[0].title, 'Dinner', 'an edit the account rejected must not be shown as applied');
  assertNoSyncPromise();

  reset();
  setSupabase(createFakeSupabase({ onTable: failEverything }).client);
  store.set(key, JSON.stringify(stored));
  const afterDelete = await deletePlannerEvent('event-1');
  assert.equal(afterDelete.length, 1, 'a delete the account rejected must not be shown as done');
  assertNoSyncPromise();
});

test('a rejected saved-look delete leaves the look in place', async () => {
  reset();
  const key = userScopedKeyFor(USER, '@closiq_saved_outfits');
  store.set(key, JSON.stringify([{ id: 'look-9', items: [], title: 'Look' }]));
  setSupabase(createFakeSupabase({ onTable: failEverything }).client);

  const remaining = await removeSavedOutfitFromStorage('look-9');

  assert.equal(remaining.length, 1);
  assert.equal(JSON.parse(store.get(key) as string).length, 1);
  assertNoSyncPromise();
});

test('a failed demo seed is not reported as a completed cloud wardrobe', async () => {
  reset();
  setSupabase(
    createFakeSupabase({
      onTable: (call: TableCall) =>
        call.op === 'insert' ? { data: null, error: new Error('insert failed') } : { data: [], error: null, count: 0 }
    }).client
  );

  assert.equal(await seedDemoWardrobeIfNeeded(), false);
});

test('a successful demo seed reports success', async () => {
  reset();
  setSupabase(createFakeSupabase({ onTable: () => ({ data: [], error: null, count: 0 }) }).client);

  assert.equal(await seedDemoWardrobeIfNeeded(), true);
});

// ---------------------------------------------------------------------------
// Retry: correct user, no duplicates (added in the M19 audit)
// ---------------------------------------------------------------------------

test('a retry is abandoned — not replayed as the new user — if the account changes mid-dialog', async () => {
  reset();
  const inserts: TableCall[] = [];
  const fake = createFakeSupabase({
    onTable: (call: TableCall) => {
      if (call.op === 'insert') inserts.push(call);
      return call.op === 'insert' ? { data: null, error: new Error('network down') } : { data: [], error: null };
    }
  });
  setSupabase(fake.client);
  setAlertResponse('accept');
  // User A logs out and user B logs in while the "Try again" dialog is up.
  setAlertHook(() => setCurrentUserId('user-other'));

  const result = await saveUserGarment(garment('tee-r1'), 'men');

  assert.equal(inserts.length, 1, 'no retry may run once the session has changed');
  assert.equal((inserts[0].payload as { user_id: string }).user_id, USER);
  assert.equal(result.cloudSynced, false);
  assert.equal(
    store.has(userScopedKeyFor('user-other', '@closiq_user_wardrobe_men')),
    false,
    "nothing may be written to the new user's cache"
  );
});

test('every retry attempt writes as the user who started the save', async () => {
  reset();
  const inserts: TableCall[] = [];
  let n = 0;
  setSupabase(
    createFakeSupabase({
      onTable: (call: TableCall) => {
        if (call.op !== 'insert') return { data: [], error: null };
        inserts.push(call);
        n += 1;
        return n < 3 ? { data: null, error: new Error('network down') } : { data: null, error: null };
      }
    }).client
  );
  setAlertResponse('accept');

  await saveOutfitToStorage({ id: 'look-r2', items: [], title: 'L' } as never);

  assert.equal(inserts.length, 3);
  for (const call of inserts) assert.equal((call.payload as { user_id: string }).user_id, USER);
});

for (const kind of ['garment', 'look', 'planner event'] as const) {
  test(`a ${kind} insert that committed despite a lost response is not inserted twice on retry`, async () => {
    reset();
    const rows: unknown[] = [];
    let insertCalls = 0;
    const table = kind === 'garment' ? 'garments' : kind === 'look' ? 'saved_outfits' : 'planner_events';
    setSupabase(
      createFakeSupabase({
        onTable: (call: TableCall) => {
          if (call.table !== table) return { data: [], error: null };
          if (call.op === 'insert') {
            insertCalls += 1;
            // The row IS written, but the client only ever sees an error.
            rows.push(call.payload);
            return { data: null, error: new Error('response lost') };
          }
          if (call.op === 'select') return { data: rows.map((_, i) => ({ id: i })), error: null };
          return { data: null, error: null };
        }
      }).client
    );
    setAlertResponse('accept');

    if (kind === 'garment') await saveUserGarment(garment('tee-dup'), 'men');
    else if (kind === 'look') await saveOutfitToStorage({ id: 'look-dup', items: [], title: 'L' } as never);
    else await addPlannerEvent({ title: 'Dinner', date: '2026-02-01', time: '19:00', occasion: 'date' } as never);

    assert.equal(insertCalls, 1, 'the retry must find the committed row instead of inserting again');
    assert.equal(rows.length, 1, 'exactly one row may exist');
  });
}

// ---------------------------------------------------------------------------
// Local-only records survive a reload, and are never shown as saved
// ---------------------------------------------------------------------------

test('a garment whose save failed survives the next wardrobe reload instead of vanishing', async () => {
  reset();
  setSupabase(createFakeSupabase({ onTable: failEverything }).client);
  const failed = await saveUserGarment(garment('tee-p1'), 'men');
  assert.equal(isSyncPending(failed.items[0]), true);

  // Connectivity returns; the cloud has never heard of this garment.
  setSupabase(createFakeSupabase({ onTable: () => ({ data: [], error: null }) }).client);
  const reloaded = await loadUserWardrobe('men');

  assert.deepEqual(reloaded.map((g) => g.id), ['tee-p1'], 'the alert said it stays on this device — it must');
  assert.equal(isSyncPending(reloaded[0]), true);
});

test('a pending record the cloud turns out to have is taken from the cloud, not duplicated', async () => {
  reset();
  setSupabase(createFakeSupabase({ onTable: failEverything }).client);
  await saveOutfitToStorage({ id: 'look-p2', items: [], title: 'L' } as never);

  setSupabase(
    createFakeSupabase({
      onTable: () => ({
        data: [{ outfit_id: 'look-p2', title: 'L', items: [], worn_today: false, date_created: '2026-01-01' }],
        error: null
      })
    }).client
  );
  const reloaded = await loadSavedOutfits();

  assert.equal(reloaded.length, 1);
  assert.equal(isSyncPending(reloaded[0]), false, 'the cloud copy is authoritative once it exists');
});

test('a pending planner event survives the next Planner reload', async () => {
  reset();
  setSupabase(createFakeSupabase({ onTable: failEverything }).client);
  await addPlannerEvent({ title: 'Dinner', date: '2026-02-01', time: '19:00', occasion: 'date' } as never);

  setSupabase(createFakeSupabase({ onTable: () => ({ data: [], error: null }) }).client);
  const reloaded = await loadPlannerEvents();

  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].title, 'Dinner');
});

test('saving a pending look again genuinely retries the cloud write (it used to be a silent no-op)', async () => {
  reset();
  const look = { id: 'look-p3', items: [{ id: 'g1' }], title: 'L' } as never;
  setSupabase(createFakeSupabase({ onTable: failEverything }).client);
  const first = await saveOutfitToStorage(look);
  assert.equal(isSyncPending(first[0]), true, 'a failed save must be marked, not presented as saved');

  let inserts = 0;
  setSupabase(
    createFakeSupabase({
      onTable: (call: TableCall) => {
        if (call.op === 'insert') inserts += 1;
        return { data: [], error: null };
      }
    }).client
  );
  const second = await saveOutfitToStorage(look);

  assert.equal(inserts, 1, 'the second tap must reach the cloud');
  assert.equal(second.length, 1, 'still one look, not two');
  assert.equal(isSyncPending(second[0]), false);
});

test('saving an already-synced look again stays a no-op', async () => {
  reset();
  let inserts = 0;
  setSupabase(
    createFakeSupabase({
      onTable: (call: TableCall) => {
        if (call.op === 'insert') inserts += 1;
        return { data: [], error: null };
      }
    }).client
  );
  const look = { id: 'look-p4', items: [{ id: 'g1' }], title: 'L' } as never;
  await saveOutfitToStorage(look);
  await saveOutfitToStorage(look);
  assert.equal(inserts, 1);
});
