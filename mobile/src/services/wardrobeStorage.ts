import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { GarmentItem, GarmentDetailsPatch, WardrobeProfile } from '../../../src/types/wardrobe';
import { getProfileSeedWardrobe } from '../../../src/data/garmentCatalog';
import {
  SessionScope,
  captureSession,
  isSessionCurrent,
  userScopedKeyFor
} from './authSession';
import { runCloudWrite, markPending, clearPending, mergePendingLocal } from './cloudWriteFeedback';
import { supabase } from './supabaseClient';
import {
  GARMENT_IMAGES_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  refreshGarmentImages,
  resolveStaticImageUrl,
  storageReferenceUrl
} from './garmentImages';
import type { Tables } from '../types/supabase';
import { normalizeStorageLocation } from '../../../src/data/storageLocations';
import { normalizeSize } from '../../../src/data/garmentSizes';

const BASE_STORAGE_KEYS: Record<WardrobeProfile, string> = {
  men: '@closiq_user_wardrobe_men',
  women: '@closiq_user_wardrobe_women'
};

/**
 * Sprint M18: wardrobe is now cloud-backed (`garments`, RLS-scoped to
 * `user_id = auth.uid()` AND further partitioned by `wardrobe_profile`,
 * live-verified — see STATE.md). AsyncStorage remains as a per-user,
 * per-profile read cache for offline continuity (Part 13/17) — it's
 * refreshed on every successful cloud read/write and is never treated as
 * authoritative once a cloud call succeeds.
 */
function storageKey(scope: SessionScope, profile: WardrobeProfile): string {
  return userScopedKeyFor(scope.userId, BASE_STORAGE_KEYS[profile]);
}

/** Seed/catalog wardrobe for the active profile, with image URLs resolved to
 *  something React Native can actually render on a device. */
export function getResolvedSeedWardrobe(profile: WardrobeProfile): GarmentItem[] {
  return getProfileSeedWardrobe(profile).map((item) => ({
    ...item,
    imageUrl: resolveStaticImageUrl(item.imageUrl)
  }));
}

/** True for a fresh local device photo that hasn't been uploaded anywhere
 *  yet — every other imageUrl shape (a signed URL from a prior cloud load,
 *  or a resolved static seed/catalog asset) already renders as-is and must
 *  never be re-uploaded ("do not upload the same image repeatedly"). */
function isLocalDeviceUri(uri: string): boolean {
  return /^(file:|content:|ph:|assets-library:)/i.test(uri);
}

function rowToGarment(row: Tables<'garments'>): GarmentItem {
  return {
    id: row.garment_id,
    name: row.name,
    category: row.category as GarmentItem['category'],
    subcategory: row.subcategory,
    color: row.color,
    hexColor: row.hex_color,
    secondaryColors: row.secondary_colors || undefined,
    fabric: row.fabric,
    seasons: (row.seasons as GarmentItem['seasons']) || [],
    formality: row.formality as GarmentItem['formality'],
    // Durable references only (Sprint M20): an uploaded photo's bucket path,
    // signed by refreshGarmentImages() in loadUserWardrobe; a seed photo's
    // `/wardrobe/...` path on the CURRENT API host, however stale the host
    // stored in the row is.
    imageUrl: row.storage_path ? storageReferenceUrl(row.storage_path) : resolveStaticImageUrl(row.image_url),
    brand: row.brand || undefined,
    favorite: row.favorite,
    wearCount: row.wear_count,
    lastWornDate: row.last_worn_date || undefined,
    dateAdded: row.date_added,
    tags: row.tags || [],
    aiConfidence: row.ai_confidence ?? undefined,
    pairingNotes: row.pairing_notes || undefined,
    fit: row.fit || undefined,
    style: row.style || undefined,
    layeringRole: (row.layering_role as GarmentItem['layeringRole']) || undefined,
    profile: (row.source_profile as WardrobeProfile) || undefined,
    isSeedItem: row.is_seed_item,
    storageLocation: row.storage_location || undefined,
    size: row.size || undefined
  };
}

async function loadCachedWardrobe(
  scope: SessionScope,
  profile: WardrobeProfile
): Promise<GarmentItem[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(scope, profile));
    if (!raw) return [];
    return JSON.parse(raw) as GarmentItem[];
  } catch (err) {
    console.warn('Failed to load cached mobile wardrobe:', err);
    return [];
  }
}

/**
 * Result of a garment save. `cloudSynced` is the ONLY honest signal that
 * the garment actually reached the account — callers that gate anything on
 * "the cloud wardrobe is set up" (onboarding, notably) must read this
 * rather than assuming the returned list is durable (Sprint M19).
 */
export interface GarmentSaveResult {
  /** The wardrobe as it now stands locally, including an unsynced item. */
  items: GarmentItem[];
  /** True only once the `garments` row is confirmed written. */
  cloudSynced: boolean;
  /** True unless a photo upload was attempted and failed. */
  imageSynced: boolean;
}

async function garmentRowExists(userId: string, garmentId: string, profile: WardrobeProfile): Promise<boolean> {
  const { data, error } = await supabase
    .from('garments')
    .select('id')
    .eq('user_id', userId)
    .eq('garment_id', garmentId)
    .eq('wardrobe_profile', profile)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function loadUserWardrobe(profile: WardrobeProfile): Promise<GarmentItem[]> {
  // Captured ONCE, up front: every key and every query below belongs to
  // this session even if the user signs out and back in as someone else
  // while the network call is still in flight (Sprint M19).
  const scope = captureSession();
  const userId = scope.userId;
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('garments')
      .select('*')
      .eq('user_id', userId)
      .eq('wardrobe_profile', profile)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const rows = data || [];
    // One batch signing call for every uploaded photo; a signing failure
    // keeps the durable reference rather than failing the whole load.
    const items = await refreshGarmentImages(rows.map(rowToGarment));

    if (!isSessionCurrent(scope)) {
      // A different account is signed in now. Writing this cache entry
      // would be harmless (the key is still A's), but HANDING these items
      // back would let a caller drop user A's wardrobe into user B's React
      // state — the exact delayed-read bug this sprint exists to fix.
      console.warn('Discarding wardrobe read that resolved after a session change.');
      return [];
    }

    // Garments whose cloud insert failed exist only in this cache — keep
    // them rather than letting the cloud list overwrite them away.
    const merged = mergePendingLocal(items, await loadCachedWardrobe(scope, profile));
    if (!isSessionCurrent(scope)) return [];
    await AsyncStorage.setItem(storageKey(scope, profile), JSON.stringify(merged));
    return merged;
  } catch (err) {
    console.warn('Cloud wardrobe fetch failed, falling back to local cache:', err);
    // Cached URLs may be expired signatures or old LAN hosts; re-resolve
    // them (re-signing simply no-ops while offline).
    const cached = await refreshGarmentImages(await loadCachedWardrobe(scope, profile));
    if (!isSessionCurrent(scope)) return [];
    if (cached.length === 0) {
      // No cache to fall back on either — an empty wardrobe here would look
      // identical to a genuinely empty closet with no explanation. Say so.
      Alert.alert(
        "Couldn't load your wardrobe",
        "Check your connection and try again. Your items are safe in the cloud."
      );
    }
    return cached;
  }
}

export async function saveUserGarment(
  item: GarmentItem,
  profile: WardrobeProfile
): Promise<GarmentSaveResult> {
  const scope = captureSession();
  const userId = scope.userId;
  const existingCache = await loadCachedWardrobe(scope, profile);

  // Optimistic local write first — the UI shows the new garment immediately
  // with the local device photo, before the cloud round trip resolves.
  const optimistic = [item, ...existingCache];
  await AsyncStorage.setItem(storageKey(scope, profile), JSON.stringify(optimistic));

  if (!userId) return { items: optimistic, cloudSynced: false, imageSynced: false };

  let imageUrl = item.imageUrl;
  let storagePath: string | null = null;
  // Distinct from the DB-insert failure below: this garment can still save
  // successfully with metadata intact even when only the photo upload
  // fails — that combination needs its own honest message rather than
  // either silently swallowing it or reusing the "offline, nothing synced"
  // wording, which wouldn't be true here.
  let imageSynced = true;

  if (isLocalDeviceUri(item.imageUrl)) {
    // optimizeGarmentImage() (imageOptimizer.ts) always outputs JPEG
    // regardless of the source format, so the extension is fixed, not
    // derived — one less thing that can go stale/mismatch.
    const path = `${userId}/${item.id}.jpg`;
    const uploaded = await runCloudWrite({
      scope,
      title: "Photo didn't upload",
      message:
        "The photo for this item couldn't be uploaded to your account. It will show on this device only — it does not upload later on its own.",
      run: async () => {
        const response = await fetch(item.imageUrl);
        const arrayBuffer = await response.arrayBuffer();
        const { error: uploadError } = await supabase.storage
          .from(GARMENT_IMAGES_BUCKET)
          .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
        if (uploadError) throw uploadError;
      }
    });

    if (uploaded) {
      storagePath = path;
      const { data: signed } = await supabase.storage
        .from(GARMENT_IMAGES_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (signed?.signedUrl) imageUrl = signed.signedUrl;
    } else {
      // Not fatal — the garment row still saves below with the local device
      // URI, which renders fine for the remainder of THIS session but won't
      // resolve on another device/session. Already surfaced above.
      imageSynced = false;
    }
  }

  const cloudSynced = await runCloudWrite({
    scope,
    title: 'Item not saved to your account',
    message:
      "This item is on this device only. It won't appear on your other devices, and it does not upload later on its own — try again to save it to your account.",
    run: async (attempt) => {
      // A failed attempt may still have committed; never insert twice.
      if (attempt > 1 && (await garmentRowExists(userId, item.id, profile))) return;
      const { error } = await supabase.from('garments').insert({
        user_id: userId,
        garment_id: item.id,
        wardrobe_profile: profile,
        name: item.name,
        category: item.category,
        subcategory: item.subcategory,
        color: item.color,
        hex_color: item.hexColor,
        secondary_colors: item.secondaryColors || null,
        fabric: item.fabric,
        seasons: item.seasons,
        formality: item.formality,
        image_url: imageUrl,
        storage_path: storagePath,
        brand: item.brand || null,
        favorite: item.favorite,
        wear_count: item.wearCount,
        last_worn_date: item.lastWornDate || null,
        date_added: item.dateAdded,
        tags: item.tags,
        ai_confidence: item.aiConfidence ?? null,
        pairing_notes: item.pairingNotes || null,
        fit: item.fit || null,
        style: item.style || null,
        layering_role: item.layeringRole || null,
        source_profile: item.profile || null,
        is_seed_item: item.isSeedItem || false,
        storage_location: normalizeStorageLocation(item.storageLocation) ?? null,
        size: normalizeSize(item.size) ?? null
      });
      if (error) throw error;
    }
  });

  // The local-optimistic write above is deliberately NOT rolled back on a
  // cloud failure: the user's own new item is the one thing that would be
  // genuinely destroyed by a rollback. It stays, honestly labelled unsynced.
  if (!cloudSynced) {
    if (!isSessionCurrent(scope)) return { items: [], cloudSynced: false, imageSynced };
    // Marked so the next cloud read keeps it (see mergePendingLocal) — the
    // alert above told the user it stays on this device, so it must.
    const pendingList = [markPending(item), ...existingCache];
    await AsyncStorage.setItem(storageKey(scope, profile), JSON.stringify(pendingList));
    return { items: pendingList, cloudSynced: false, imageSynced };
  }

  if (!isSessionCurrent(scope)) {
    return { items: [], cloudSynced: true, imageSynced };
  }

  // Cloud write succeeded — reflect the final imageUrl (a signed URL, not
  // the local device URI, which won't resolve in a later session).
  const finalItem = clearPending({ ...item, imageUrl });
  const finalList = [finalItem, ...existingCache];
  await AsyncStorage.setItem(storageKey(scope, profile), JSON.stringify(finalList));
  return { items: finalList, cloudSynced: true, imageSynced };
}

export async function removeUserGarment(
  id: string,
  profile: WardrobeProfile
): Promise<GarmentItem[]> {
  const scope = captureSession();
  const userId = scope.userId;
  const existingCache = await loadCachedWardrobe(scope, profile);
  const removed = existingCache.find((item) => item.id === id);
  const updated = existingCache.filter((item) => item.id !== id);
  await AsyncStorage.setItem(storageKey(scope, profile), JSON.stringify(updated));

  if (!userId) return updated;

  const cloudDeleted = await runCloudWrite({
    scope,
    title: 'Item not removed',
    message:
      "This item couldn't be removed from your account, so it's still there and will come back next time your wardrobe loads. Try again to remove it for good.",
    run: async () => {
      const { error } = await supabase
        .from('garments')
        .delete()
        .eq('user_id', userId)
        .eq('garment_id', id)
        .eq('wardrobe_profile', profile);
      if (error) throw error;
    }
  });

  if (!isSessionCurrent(scope)) return [];

  if (!cloudDeleted) {
    // The row still exists in the cloud, so the local cache must say so
    // too — otherwise the app shows a deletion that never happened and the
    // item silently reappears on the next load with no explanation. The
    // image is deliberately left alone: deleting it here would orphan a
    // live row's photo (Sprint M19).
    await AsyncStorage.setItem(storageKey(scope, profile), JSON.stringify(existingCache));
    return existingCache;
  }

  // Image cleanup runs ONLY after the database row is confirmed gone, and
  // only for a garment that actually had an uploaded photo (seed/catalog
  // items never do). Awaited so a failure is observable rather than a
  // floating promise; still non-fatal, since the row — the thing that makes
  // the item visible — is already deleted either way.
  if (!removed?.isSeedItem) {
    const { error: removeError } = await supabase.storage
      .from(GARMENT_IMAGES_BUCKET)
      .remove([`${userId}/${id}.jpg`]);
    if (removeError) {
      console.warn('Garment row deleted, but its image object was not removed:', removeError);
    }
  }

  return updated;
}

/**
 * Edits the user-editable details of a saved garment (size, where it's
 * kept). Optimistic like the other mutations: the cache updates first; if
 * the cloud write fails the cache is rolled back, so the app never shows a
 * value the account doesn't have.
 */
export async function updateUserGarmentDetails(
  id: string,
  profile: WardrobeProfile,
  patch: GarmentDetailsPatch
): Promise<GarmentItem[]> {
  const scope = captureSession();
  const userId = scope.userId;
  const clean: GarmentDetailsPatch = {};
  const row: { storage_location?: string | null; size?: string | null } = {};
  if ('storageLocation' in patch) {
    clean.storageLocation = normalizeStorageLocation(patch.storageLocation);
    row.storage_location = clean.storageLocation ?? null;
  }
  if ('size' in patch) {
    clean.size = normalizeSize(patch.size);
    row.size = clean.size ?? null;
  }

  const existingCache = await loadCachedWardrobe(scope, profile);
  const updated = existingCache.map((item) => (item.id === id ? { ...item, ...clean } : item));
  await AsyncStorage.setItem(storageKey(scope, profile), JSON.stringify(updated));

  if (!userId) return updated;

  const cloudUpdated = await runCloudWrite({
    scope,
    title: 'Change not saved',
    message: "We couldn't save this change to your account. Try again in a moment.",
    run: async () => {
      const { error } = await supabase
        .from('garments')
        .update(row)
        .eq('user_id', userId)
        .eq('garment_id', id)
        .eq('wardrobe_profile', profile);
      if (error) throw error;
    }
  });

  if (!isSessionCurrent(scope)) return [];
  if (!cloudUpdated) {
    await AsyncStorage.setItem(storageKey(scope, profile), JSON.stringify(existingCache));
    return existingCache;
  }
  return updated;
}
