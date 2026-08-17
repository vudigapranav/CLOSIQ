import AsyncStorage from '@react-native-async-storage/async-storage';
import { GarmentItem, WardrobeProfile } from '../../../src/types/wardrobe';
import { getProfileSeedWardrobe } from '../../../src/data/garmentCatalog';
import { API_BASE_URL } from '../config';

const STORAGE_KEYS: Record<WardrobeProfile, string> = {
  men: '@closiq_user_wardrobe_men',
  women: '@closiq_user_wardrobe_women'
};

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
    const raw = await AsyncStorage.getItem(STORAGE_KEYS[profile]);
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
    await AsyncStorage.setItem(STORAGE_KEYS[profile], JSON.stringify(updated));
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
    await AsyncStorage.setItem(STORAGE_KEYS[profile], JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Failed to remove mobile garment from storage:', err);
    return [];
  }
}
