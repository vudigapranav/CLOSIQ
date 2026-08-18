import AsyncStorage from '@react-native-async-storage/async-storage';
import { GarmentItem, WardrobeProfile } from '../../../src/types/wardrobe';
import { getProfileSeedWardrobe } from '../../../src/data/garmentCatalog';
import { API_BASE_URL } from '../config';
import { userScopedKey } from './authSession';

const BASE_STORAGE_KEYS: Record<WardrobeProfile, string> = {
  men: '@closiq_user_wardrobe_men',
  women: '@closiq_user_wardrobe_women'
};

/**
 * Sprint M17: wardrobe is now scoped by authenticated user, not just by
 * Men/Women — `userScopedKey()` appends the current session's user ID.
 * Old pre-M17 device-global keys (e.g. `@closiq_user_wardrobe_men` with no
 * user suffix) are deliberately left untouched rather than migrated into
 * whichever user happens to sign up first — see STATE.md "Mobile Sprint
 * M17, Migration" for why silently reassigning old anonymous-device data
 * to a specific account would be wrong.
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
 * User-uploaded items already store a real device URI from the image picker
 * and pass through unchanged. The production server already serves these
 * exact static files (server/index.js), so prefixing with the configured
 * API host is correct, not a workaround.
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

export async function loadUserWardrobe(profile: WardrobeProfile): Promise<GarmentItem[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(profile));
    if (!raw) return [];
    return JSON.parse(raw) as GarmentItem[];
  } catch (err) {
    console.warn('Failed to load mobile wardrobe from storage:', err);
    return [];
  }
}

export async function saveUserGarment(
  item: GarmentItem,
  profile: WardrobeProfile
): Promise<GarmentItem[]> {
  try {
    const existing = await loadUserWardrobe(profile);
    const updated = [item, ...existing];
    await AsyncStorage.setItem(storageKey(profile), JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Failed to save mobile garment to storage:', err);
    return [];
  }
}

export async function removeUserGarment(
  id: string,
  profile: WardrobeProfile
): Promise<GarmentItem[]> {
  try {
    const existing = await loadUserWardrobe(profile);
    const updated = existing.filter((item) => item.id !== id);
    await AsyncStorage.setItem(storageKey(profile), JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Failed to remove mobile garment from storage:', err);
    return [];
  }
}

/**
 * Bulk-write used exactly once, for demo-account wardrobe seeding (see
 * authService.ts/App.tsx) — a single write of the whole seed set instead of
 * ~20-36 sequential prepend-writes via saveUserGarment. Overwrites whatever
 * is currently stored for this profile; callers are responsible for only
 * calling this when the target wardrobe is actually empty (see
 * seedDemoWardrobeIfNeeded below).
 */
async function setUserWardrobe(items: GarmentItem[], profile: WardrobeProfile): Promise<void> {
  await AsyncStorage.setItem(storageKey(profile), JSON.stringify(items));
}

/**
 * Seeds the CURRENT user's wardrobe (both Men and Women profiles) from the
 * existing seed/reference catalog — reusing getResolvedSeedWardrobe(), not
 * a second "demo data" source — but ONLY if that profile's wardrobe is
 * currently empty. Idempotent by construction: a returning demo user who
 * has since added/removed items is never force-reset, and this must only
 * ever be called for the demo account (see App.tsx) — a brand-new real
 * account's wardrobe starts and stays empty until the user adds something,
 * exactly the "must NOT receive the demo wardrobe" requirement.
 */
export async function seedDemoWardrobeIfNeeded(): Promise<void> {
  for (const profile of ['men', 'women'] as WardrobeProfile[]) {
    const existing = await loadUserWardrobe(profile);
    if (existing.length === 0) {
      await setUserWardrobe(getResolvedSeedWardrobe(profile), profile);
    }
  }
}
