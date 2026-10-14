/**
 * Sprint M20 — images resolve from DURABLE references, never from a stored
 * signed URL or a stored host.
 *
 * Reproduced defects these lock down:
 * - Saved Looks / Planner events store garment objects (signed URL
 *   included) in their JSON; every image broke ~1 hour after saving.
 * - Demo seed rows stored `http://<LAN-IP>:3000/wardrobe/...`, which broke
 *   whenever the network/host changed.
 * - An upload whose signing failed at load became `imageUrl: ''` — a dead
 *   end nothing could ever re-sign.
 */
import './helpers/installMocks';
import { resetStore, resetAlerts, setSupabase, store, TEST_API_URL, TEST_SUPABASE_URL } from './helpers/installMocks';
import { createFakeSupabase, TableCall, StorageCall } from './helpers/fakeSupabase';
import test from 'node:test';
import assert from 'node:assert/strict';

import { setCurrentUserId, userScopedKeyFor } from '../src/services/authSession';
import {
  storagePathFromUrl,
  resolveStaticImageUrl,
  refreshGarmentImages,
  storageReferenceUrl
} from '../src/services/garmentImages';
import { loadUserWardrobe } from '../src/services/wardrobeStorage';
import { loadSavedOutfits } from '../src/services/savedOutfitsStorage';
import { loadPlannerEvents } from '../src/services/plannerStorage';
import { isSyncPending } from '../src/services/cloudWriteFeedback';

const USER = 'user-m20';
const EXPIRED = `${TEST_SUPABASE_URL}/storage/v1/object/sign/garment-images/${USER}/shirt-1.jpg?token=EXPIRED`;
const STALE_LAN = 'http://192.168.31.215:3000/wardrobe/men/tops/navy_tee.webp';

function reset() {
  resetStore();
  resetAlerts();
  setCurrentUserId(USER);
}

/** Storage that signs any path as `…?token=FRESH`, recording each call. */
function signingStorage(onCall?: (c: StorageCall) => void) {
  return (call: StorageCall) => {
    onCall?.(call);
    if (call.op === 'createSignedUrls') {
      const paths = call.args[0] as string[];
      return {
        data: paths.map((p) => ({ path: p, signedUrl: `${TEST_SUPABASE_URL}/storage/v1/object/sign/garment-images/${p}?token=FRESH` })),
        error: null
      };
    }
    return { data: null, error: null };
  };
}

test('the storage path is recovered from a signed URL, and from nothing else', () => {
  assert.equal(storagePathFromUrl(EXPIRED), `${USER}/shirt-1.jpg`);
  assert.equal(storagePathFromUrl(storageReferenceUrl(`${USER}/a b.jpg`)), `${USER}/a b.jpg`);
  assert.equal(storagePathFromUrl(STALE_LAN), null);
  assert.equal(storagePathFromUrl('file:///tmp/x.jpg'), null);
  assert.equal(storagePathFromUrl(''), null);
});

test('seed images are re-hosted on the CURRENT API host, whatever host was stored', () => {
  assert.equal(resolveStaticImageUrl(STALE_LAN), `${TEST_API_URL}/wardrobe/men/tops/navy_tee.webp`);
  assert.equal(resolveStaticImageUrl('/wardrobe/women/bottoms/x.webp'), `${TEST_API_URL}/wardrobe/women/bottoms/x.webp`);
  // Never touches storage URLs, device files, or unrelated hosts.
  assert.equal(resolveStaticImageUrl(EXPIRED), EXPIRED);
  assert.equal(resolveStaticImageUrl('file:///tmp/x.jpg'), 'file:///tmp/x.jpg');
  assert.equal(resolveStaticImageUrl('https://cdn.example/photo.jpg'), 'https://cdn.example/photo.jpg');
});

test('refreshGarmentImages re-signs every upload in ONE batch call', async () => {
  reset();
  const calls: StorageCall[] = [];
  setSupabase(createFakeSupabase({ onStorage: signingStorage((c) => calls.push(c)) }).client);

  const out = await refreshGarmentImages([
    { id: 'a', imageUrl: EXPIRED },
    { id: 'b', imageUrl: EXPIRED.replace('shirt-1', 'shirt-2') },
    { id: 'c', imageUrl: STALE_LAN }
  ]);

  assert.equal(calls.filter((c) => c.op === 'createSignedUrls').length, 1);
  assert.match(out[0].imageUrl, /shirt-1\.jpg\?token=FRESH$/);
  assert.match(out[1].imageUrl, /shirt-2\.jpg\?token=FRESH$/);
  assert.equal(out[2].imageUrl, `${TEST_API_URL}/wardrobe/men/tops/navy_tee.webp`);
});

test('if signing fails, the durable reference is kept rather than lost', async () => {
  reset();
  setSupabase(createFakeSupabase({ onStorage: () => ({ data: null, error: new Error('offline') }) }).client);
  const out = await refreshGarmentImages([{ imageUrl: EXPIRED }]);
  assert.equal(storagePathFromUrl(out[0].imageUrl), `${USER}/shirt-1.jpg`);
});

test('a Saved Look saved long ago shows freshly signed images — without rewriting or regenerating it', async () => {
  reset();
  const fake = createFakeSupabase({
    onTable: (call: TableCall) =>
      call.op === 'select'
        ? {
            data: [
              {
                outfit_id: 'look-old',
                title: 'Old look',
                items: [
                  { id: 'shirt-1', imageUrl: EXPIRED },
                  { id: 'seed-tee', imageUrl: STALE_LAN }
                ],
                worn_today: false,
                date_created: '2026-01-01'
              }
            ],
            error: null
          }
        : { data: null, error: null },
    onStorage: signingStorage()
  });
  setSupabase(fake.client);

  const looks = await loadSavedOutfits();

  assert.match(looks[0].items[0].imageUrl, /token=FRESH$/);
  assert.equal(looks[0].items[1].imageUrl, `${TEST_API_URL}/wardrobe/men/tops/navy_tee.webp`);
  assert.equal(looks[0].title, 'Old look', 'the look itself is unchanged');
  assert.deepEqual(
    fake.tableCalls.map((c) => c.op),
    ['select'],
    'a read must never write the look back or regenerate it'
  );
});

test('a pending (local-only) look also gets fresh images and keeps its pending marker', async () => {
  reset();
  const key = userScopedKeyFor(USER, '@closiq_saved_outfits');
  store.set(key, JSON.stringify([{ id: 'look-local', items: [{ id: 'shirt-1', imageUrl: EXPIRED }], syncPending: true }]));
  setSupabase(createFakeSupabase({ onTable: () => ({ data: [], error: null }), onStorage: signingStorage() }).client);

  const looks = await loadSavedOutfits();

  assert.equal(looks.length, 1);
  assert.equal(isSyncPending(looks[0]), true);
  assert.match(looks[0].items[0].imageUrl, /token=FRESH$/);
});

test("a Planner event's attached outfit gets fresh images on load", async () => {
  reset();
  setSupabase(
    createFakeSupabase({
      onTable: () => ({
        data: [
          {
            event_id: 'event-1',
            title: 'Dinner',
            event_date: '2026-02-01',
            event_time: '19:00',
            occasion: 'date',
            notes: null,
            created_at: '2026-01-01',
            outfit: { id: 'o1', items: [{ id: 'shirt-1', imageUrl: EXPIRED }] }
          },
          { event_id: 'event-2', title: 'No outfit', event_date: '2026-02-02', event_time: '09:00', occasion: 'work', notes: null, created_at: '2026-01-01', outfit: null }
        ],
        error: null
      }),
      onStorage: signingStorage()
    }).client
  );

  const events = await loadPlannerEvents();

  assert.match(events[0].outfit!.items[0].imageUrl, /token=FRESH$/);
  assert.equal(events[1].outfit, undefined, 'an event without an outfit is left alone');
});

function garmentRow(overrides: Record<string, unknown>) {
  return {
    garment_id: 'g', name: 'g', category: 'tops', subcategory: 's', color: 'c', hex_color: '#000',
    secondary_colors: null, fabric: 'f', seasons: [], formality: 'casual', image_url: '', storage_path: null,
    brand: null, favorite: false, wear_count: 0, last_worn_date: null, date_added: '2026-01-01', tags: [],
    ai_confidence: null, pairing_notes: null, fit: null, style: null, layering_role: null,
    source_profile: 'men', is_seed_item: false, ...overrides
  };
}

test('wardrobe rows resolve from storage_path and from the /wardrobe path, never the stored host', async () => {
  reset();
  setSupabase(
    createFakeSupabase({
      onTable: () => ({
        data: [
          garmentRow({ garment_id: 'upload', image_url: EXPIRED, storage_path: `${USER}/upload.jpg` }),
          garmentRow({ garment_id: 'seed', image_url: STALE_LAN, is_seed_item: true })
        ],
        error: null
      }),
      onStorage: signingStorage()
    }).client
  );

  const items = await loadUserWardrobe('men');
  const byId = Object.fromEntries(items.map((i) => [i.id, i.imageUrl]));

  assert.match(byId.upload, /upload\.jpg\?token=FRESH$/);
  assert.equal(byId.seed, `${TEST_API_URL}/wardrobe/men/tops/navy_tee.webp`);
});

test('an upload whose signing fails at load keeps a re-signable reference, not an empty string', async () => {
  reset();
  setSupabase(
    createFakeSupabase({
      onTable: () => ({ data: [garmentRow({ garment_id: 'upload', storage_path: `${USER}/upload.jpg` })], error: null }),
      onStorage: () => ({ data: null, error: new Error('offline') })
    }).client
  );

  const [item] = await loadUserWardrobe('men');

  assert.notEqual(item.imageUrl, '');
  assert.equal(storagePathFromUrl(item.imageUrl), `${USER}/upload.jpg`);
});
