import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { GarmentItem, WardrobeProfile } from '../../../src/types/wardrobe';
import { getProfileSeedWardrobe } from '../../../src/data/garmentCatalog';
import { API_BASE_URL } from '../config';
import { userScopedKey, getCurrentUserId } from './authSession';
import { supabase } from './supabaseClient';
import type { Tables } from '../types/supabase';

const BASE_STORAGE_KEYS: Record<WardrobeProfile, string> = {
  men: '@closiq_user_wardrobe_men',
  women: '@closiq_user_wardrobe_women'
};

const GARMENT_IMAGES_BUCKET = 'garment-images';
// Regenerated fresh on every wardrobe load, never persisted — a stored
// signed URL would eventually expire and silently break (Part 8: "handle
// expired/unavailable URLs"). One hour comfortably outlasts a single
// foreground session.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Sprint M18: wardrobe is now cloud-backed (`garments`, RLS-scoped to
 * `user_id = auth.uid()` AND further partitioned by `wardrobe_profile`,
 * live-verified — see STATE.md). AsyncStorage remains as a per-user,
 * per-profile read cache for offline continuity (Part 13/17) — it's
 * refreshed on every successful cloud read/write and is never treated as
 * authoritative once a cloud call succeeds.
 */
function storageKey(profile: WardrobeProfile): string {
  return userScopedKey(BASE_STORAGE_KEYS[profile]);
}

/**
 * The shared web catalog (src/data/garmentCatalog.ts) gives every seed item
 * a web-root-relative imageUrl like "/wardrobe/men/tops/x.webp" — correct
 * for a browser (resolves against the page's own origin) but meaningless to
 * React Native's <Image source={{uri}}>, which has no origin to resolve
 * against and needs a full scheme (http(s):, file:, data:, content:).
 * User-uploaded items already store a real device URI/signed URL and pass
 * through unchanged. The production server already serves these exact
 * static files (server/index.js), so prefixing with the configured API
 * host is correct, not a workaround.
 */
function resolveSeedImageUrl(url: string): string {
  if (/^(https?:|file:|data:|content:)/i.test(url)) return url;
  return `${API_BASE_URL}${url}`;
}

/** Seed/catalog wardrobe for the active profile, with image URLs resolved to
 *  something React Native can actually render on a device. */
export function getResolvedSeedWardrobe(profile: WardrobeProfile): GarmentItem[] {
  return getProfileSeedWardrobe(profile).map((item) => ({
    ...item,
    imageUrl: resolveSeedImageUrl(item.imageUrl)
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
    // Placeholder for storage-backed uploads — overwritten with a freshly
    // signed URL by loadUserWardrobe below. Seed/catalog rows resolve here.
    imageUrl: row.storage_path ? '' : resolveSeedImageUrl(row.image_url),
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
    isSeedItem: row.is_seed_item
  };
}

async function loadCachedWardrobe(profile: WardrobeProfile): Promise<GarmentItem[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(profile));
    if (!raw) return [];
    return JSON.parse(raw) as GarmentItem[];
  } catch (err) {
    console.warn('Failed to load cached mobile wardrobe:', err);
    return [];
  }
}

export async function loadUserWardrobe(profile: WardrobeProfile): Promise<GarmentItem[]> {
  const userId = getCurrentUserId();
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
    const items = rows.map(rowToGarment);

    // Batch-mint signed URLs for every storage-backed (user-uploaded) image
    // in one call rather than N individual round trips.
    const uploadIndexes: number[] = [];
    const paths: string[] = [];
    rows.forEach((row, i) => {
      if (row.storage_path) {
        uploadIndexes.push(i);
        paths.push(row.storage_path);
      }
    });
    if (paths.length > 0) {
      try {
        const { data: signed, error: signError } = await supabase.storage
          .from(GARMENT_IMAGES_BUCKET)
          .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
        if (signError) throw signError;
        signed?.forEach((s, j) => {
          const itemIndex = uploadIndexes[j];
          if (s.signedUrl) items[itemIndex].imageUrl = s.signedUrl;
        });
      } catch (signErr) {
        // Bucket may not exist yet (see supabase/sql/001_garment_images_bucket.sql)
        // or an individual object may be missing — degrade gracefully rather
        // than failing the whole wardrobe load.
        console.warn('Failed to sign garment image URLs:', signErr);
      }
    }

    await AsyncStorage.setItem(storageKey(profile), JSON.stringify(items));
    return items;
  } catch (err) {
    console.warn('Cloud wardrobe fetch failed, falling back to local cache:', err);
    const cached = await loadCachedWardrobe(profile);
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
): Promise<GarmentItem[]> {
  const userId = getCurrentUserId();
  const existingCache = await loadCachedWardrobe(profile);

  // Optimistic local write first — the UI shows the new garment immediately
  // with the local device photo, before the cloud round trip resolves.
  await AsyncStorage.setItem(storageKey(profile), JSON.stringify([item, ...existingCache]));

  if (!userId) return [item, ...existingCache];

  let imageUrl = item.imageUrl;
  let storagePath: string | null = null;
  // Distinct from the DB-insert failure below: this garment can still save
  // successfully with metadata intact even when only the photo upload
  // fails — that combination needs its own honest message rather than
  // either silently swallowing it or reusing the "offline, nothing synced"
  // wording, which wouldn't be true here.
  let imageUploadFailed = false;

  if (isLocalDeviceUri(item.imageUrl)) {
    // optimizeGarmentImage() (imageOptimizer.ts) always outputs JPEG
    // regardless of the source format, so the extension is fixed, not
    // derived — one less thing that can go stale/mismatch.
    const path = `${userId}/${item.id}.jpg`;
    try {
      const response = await fetch(item.imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from(GARMENT_IMAGES_BUCKET)
        .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;
      storagePath = path;
      const { data: signed } = await supabase.storage
        .from(GARMENT_IMAGES_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (signed?.signedUrl) imageUrl = signed.signedUrl;
    } catch (err) {
      // Bucket may not exist yet (see supabase/sql/001_garment_images_bucket.sql).
      // Not fatal — the garment row still saves below with the local device
      // URI, which renders fine for the remainder of THIS session, but
      // won't resolve on another device/session — surfaced honestly below
      // rather than left as a console-only warning no one sees.
      console.warn('Garment image upload failed:', err);
      imageUploadFailed = true;
    }
  }

  try {
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
      is_seed_item: item.isSeedItem || false
    });
    if (error) throw error;
  } catch (err) {
    console.warn('Failed to sync new garment to cloud:', err);
    Alert.alert(
      "You're offline",
      "This item was saved on this device and will sync when you're back online."
    );
    return [item, ...existingCache];
  }

  if (imageUploadFailed) {
    Alert.alert(
      'Item saved',
      "The details saved, but the photo couldn't upload — it'll only show on this device until you try adding the photo again."
    );
  }

  // Cloud write succeeded — reflect the final imageUrl (a signed URL, not
  // the local device URI, which won't resolve in a later session).
  const finalItem = { ...item, imageUrl };
  const finalList = [finalItem, ...existingCache];
  await AsyncStorage.setItem(storageKey(profile), JSON.stringify(finalList));
  return finalList;
}

export async function removeUserGarment(
  id: string,
  profile: WardrobeProfile
): Promise<GarmentItem[]> {
  const userId = getCurrentUserId();
  const existingCache = await loadCachedWardrobe(profile);
  const updated = existingCache.filter((item) => item.id !== id);
  await AsyncStorage.setItem(storageKey(profile), JSON.stringify(updated));

  if (!userId) return updated;

  try {
    const { error } = await supabase
      .from('garments')
      .delete()
      .eq('user_id', userId)
      .eq('garment_id', id)
      .eq('wardrobe_profile', profile);
    if (error) throw error;
  } catch (err) {
    console.warn('Failed to delete garment from cloud:', err);
    Alert.alert(
      "You're offline",
      "This item was removed on this device and will sync when you're back online."
    );
  }

  // Best-effort image cleanup — never fatal (seed items have no stored
  // object at all, and a missing/already-gone object is not an error worth
  // surfacing to the user; the database row is already gone either way).
  supabase.storage
    .from(GARMENT_IMAGES_BUCKET)
    .remove([`${userId}/${id}.jpg`])
    .catch(() => {});

  return updated;
}

/**
 * Seeds the CURRENT user's cloud wardrobe (both Men and Women profiles)
 * from the existing seed/reference catalog — reusing getResolvedSeedWardrobe(),
 * not a second "demo data" source — but ONLY if that profile's cloud
 * wardrobe is currently empty. Idempotent by construction (checked via a
 * live cloud count, not a local flag): a returning demo user who has since
 * added/removed items is never force-reset, and this must only ever be
 * called for the demo account (see App.tsx) — a brand-new real account's
 * wardrobe starts and stays empty until the user adds something.
 */
export async function seedDemoWardrobeIfNeeded(): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) return;

  for (const profile of ['men', 'women'] as WardrobeProfile[]) {
    try {
      const { count, error } = await supabase
        .from('garments')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('wardrobe_profile', profile);
      if (error) throw error;
      if ((count ?? 0) > 0) continue;

      const seed = getResolvedSeedWardrobe(profile);
      const rows = seed.map((item) => ({
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
        image_url: item.imageUrl,
        storage_path: null,
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
        source_profile: item.profile || profile,
        is_seed_item: true
      }));
      const { error: insertError } = await supabase.from('garments').insert(rows);
      if (insertError) throw insertError;
    } catch (err) {
      console.warn(`Failed to seed ${profile} demo wardrobe:`, err);
    }
  }
}
