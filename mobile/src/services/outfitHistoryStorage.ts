import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@closiq_recent_outfit_signatures';
/** Keep a reasonable recent history, not an ever-growing exclusion list. */
const MAX_HISTORY = 8;

/** Deterministic identity for a garment combination: sorted IDs joined —
 *  never the outfit name/title, which Gemini can vary freely without the
 *  combination itself actually being different. */
export function buildOutfitSignature(garmentIds: string[]): string {
  return [...garmentIds].sort().join('|');
}

export async function loadRecentOutfitSignatures(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to load recent outfit history:', err);
    return [];
  }
}

/**
 * Records a combination as recently seen (generated, regenerated, saved, or
 * worn). Most-recent-first, capped at MAX_HISTORY, de-duplicated (an outfit
 * seen again just moves back to the front rather than being stored twice).
 * Persisted so the exclusion survives an app restart — closing and reopening
 * the app was exactly the repeat-outfit bug this exists to fix.
 */
export async function recordRecentOutfit(garmentIds: string[]): Promise<void> {
  if (garmentIds.length === 0) return;
  try {
    const signature = buildOutfitSignature(garmentIds);
    const existing = await loadRecentOutfitSignatures();
    const withoutDuplicate = existing.filter((s) => s !== signature);
    const updated = [signature, ...withoutDuplicate].slice(0, MAX_HISTORY);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to record recent outfit:', err);
  }
}

