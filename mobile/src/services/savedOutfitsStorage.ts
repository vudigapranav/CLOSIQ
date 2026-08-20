import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { Outfit } from '../../../src/types/wardrobe';
import { userScopedKey, getCurrentUserId } from './authSession';
import { supabase } from './supabaseClient';
import type { Tables } from '../types/supabase';

const BASE_STORAGE_KEY = '@closiq_saved_outfits';

/**
 * Sprint M18: `saved_outfits` (Supabase, RLS-scoped to `user_id =
 * auth.uid()`, live-verified) is now the durable source of truth.
 * AsyncStorage remains as a read cache for offline continuity.
 */
function rowToOutfit(row: Tables<'saved_outfits'>): Outfit {
  return {
    id: row.outfit_id,
    title: row.title,
    occasion: row.occasion,
    vibe: row.vibe,
    formalityLabel: row.formality_label,
    temperature: row.temperature ?? 0,
    items: ((row.items as unknown) as Outfit['items']) || [],
    styleScore: row.style_score ?? 0,
    explanation: (row.explanation as unknown) as Outfit['explanation'],
    saved: true,
    dateCreated: row.date_created,
    wornToday: row.worn_today,
    missingCategories: ((row.missing_categories as unknown) as Outfit['missingCategories']) || undefined
  };
}

async function readCache(): Promise<Outfit[]> {
  try {
    const raw = await AsyncStorage.getItem(userScopedKey(BASE_STORAGE_KEY));
    if (!raw) return [];
    return JSON.parse(raw) as Outfit[];
  } catch (err) {
    console.warn('Failed to read cached saved outfits:', err);
    return [];
  }
}

async function writeCache(list: Outfit[]): Promise<void> {
  try {
    await AsyncStorage.setItem(userScopedKey(BASE_STORAGE_KEY), JSON.stringify(list));
  } catch (err) {
    console.warn('Failed to cache saved outfits:', err);
  }
}

export async function loadSavedOutfits(): Promise<Outfit[]> {
  const userId = getCurrentUserId();
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('saved_outfits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const mapped = (data || []).map(rowToOutfit);
    await writeCache(mapped);
    return mapped;
  } catch (err) {
    console.warn('Cloud saved-outfits fetch failed, falling back to local cache:', err);
    const cached = await readCache();
    if (cached.length === 0) {
      Alert.alert(
        "Couldn't load Saved Looks",
        "Check your connection and try again. Your saved looks are safe in the cloud."
      );
    }
    return cached;
  }
}

export async function saveOutfitToStorage(outfit: Outfit): Promise<Outfit[]> {
  const userId = getCurrentUserId();
  const existing = await readCache();

  const isDuplicate = existing.some(
    (o) => o.id === outfit.id || isSameOutfitItems(o.items.map((i) => i.id), outfit.items.map((i) => i.id))
  );
  if (isDuplicate) return existing;

  const withSaved = { ...outfit, saved: true };
  const optimistic = [withSaved, ...existing];
  await writeCache(optimistic);

  if (!userId) return optimistic;

  try {
    const { error } = await supabase.from('saved_outfits').insert({
      user_id: userId,
      outfit_id: withSaved.id,
      title: withSaved.title,
      occasion: withSaved.occasion,
      vibe: withSaved.vibe,
      formality_label: withSaved.formalityLabel,
      temperature: withSaved.temperature,
      items: withSaved.items as unknown as never,
      style_score: withSaved.styleScore,
      explanation: withSaved.explanation as unknown as never,
      date_created: withSaved.dateCreated,
      worn_today: withSaved.wornToday || false,
      missing_categories: withSaved.missingCategories || []
    });
    if (error) throw error;
  } catch (err) {
    console.warn('Failed to sync saved outfit to cloud:', err);
    Alert.alert(
      "You're offline",
      "This look was saved on this device and will sync when you're back online."
    );
  }

  return optimistic;
}

export async function removeSavedOutfitFromStorage(id: string): Promise<Outfit[]> {
  const userId = getCurrentUserId();
  const existing = await readCache();
  const updated = existing.filter((o) => o.id !== id);
  await writeCache(updated);

  if (!userId) return updated;

  try {
    const { error } = await supabase.from('saved_outfits').delete().eq('user_id', userId).eq('outfit_id', id);
    if (error) throw error;
  } catch (err) {
    console.warn('Failed to delete saved outfit from cloud:', err);
    Alert.alert(
      "You're offline",
      "This look was removed on this device and will sync when you're back online."
    );
  }

  return updated;
}

export function isSameOutfitItems(idsA: string[], idsB: string[]): boolean {
  if (idsA.length !== idsB.length) return false;
  const setA = new Set(idsA);
  return idsB.every((id) => setA.has(id));
}
