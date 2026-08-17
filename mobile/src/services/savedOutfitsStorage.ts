import AsyncStorage from '@react-native-async-storage/async-storage';
import { Outfit } from '../../../src/types/wardrobe';

const STORAGE_KEY = '@closiq_saved_outfits';

export async function loadSavedOutfits(): Promise<Outfit[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Outfit[];
  } catch (err) {
    console.warn('Failed to load saved outfits from storage:', err);
    return [];
  }
}

export async function saveOutfitToStorage(outfit: Outfit): Promise<Outfit[]> {
  try {
    const existing = await loadSavedOutfits();
    // Prevent duplicate saves by checking ID or matching items array
    const isDuplicate = existing.some(
      (o) => o.id === outfit.id || isSameOutfitItems(o.items.map((i) => i.id), outfit.items.map((i) => i.id))
    );

    if (isDuplicate) {
      return existing;
    }

    const updated = [{ ...outfit, saved: true }, ...existing];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Failed to save outfit to storage:', err);
    return [];
  }
}

export async function removeSavedOutfitFromStorage(id: string): Promise<Outfit[]> {
  try {
    const existing = await loadSavedOutfits();
    const updated = existing.filter((o) => o.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Failed to remove saved outfit from storage:', err);
    return [];
  }
}

export function isSameOutfitItems(idsA: string[], idsB: string[]): boolean {
  if (idsA.length !== idsB.length) return false;
  const setA = new Set(idsA);
  return idsB.every((id) => setA.has(id));
}
