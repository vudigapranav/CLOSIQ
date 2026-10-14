import AsyncStorage from '@react-native-async-storage/async-storage';
import { OutfitRating } from '../../../src/types/wardrobe';
import { OutfitFeedback, comboSignature } from '../../../src/services/outfitBrain';
import { SessionScope, captureSession, isSessionCurrent, userScopedKeyFor } from './authSession';
import { supabase } from './supabaseClient';

/**
 * The outfit brain's memory on the phone (2026-10-14): how the user rated
 * each outfit combination, in the `outfit_feedback` table (RLS: own rows
 * only) with a per-user AsyncStorage copy so it still works offline and
 * the screens can show a rating instantly. Same session-scoping rules as
 * the other storage modules (authSession.ts).
 */

const BASE_STORAGE_KEY = '@closiq_outfit_feedback';

async function readCache(scope: SessionScope): Promise<OutfitFeedback[]> {
  try {
    const raw = await AsyncStorage.getItem(userScopedKeyFor(scope.userId, BASE_STORAGE_KEY));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to read cached outfit feedback:', err);
    return [];
  }
}

async function writeCache(scope: SessionScope, list: OutfitFeedback[]): Promise<void> {
  try {
    await AsyncStorage.setItem(userScopedKeyFor(scope.userId, BASE_STORAGE_KEY), JSON.stringify(list));
  } catch (err) {
    console.warn('Failed to cache outfit feedback:', err);
  }
}

export async function loadOutfitFeedback(): Promise<OutfitFeedback[]> {
  const scope = captureSession();
  const userId = scope.userId;
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('outfit_feedback')
      .select('signature, garment_ids, rating, occasion, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    const list: OutfitFeedback[] = (data || []).map((row) => ({
      signature: row.signature,
      garmentIds: row.garment_ids || [],
      rating: row.rating as OutfitRating,
      occasion: row.occasion || undefined,
      updatedAt: row.updated_at
    }));
    if (!isSessionCurrent(scope)) return [];
    await writeCache(scope, list);
    return list;
  } catch (err) {
    console.warn('Cloud outfit feedback fetch failed, falling back to local cache:', err);
    const cached = await readCache(scope);
    return isSessionCurrent(scope) ? cached : [];
  }
}

/** The rating already given to this exact combination, if any (cache only, instant). */
export async function getCachedRating(garmentIds: string[]): Promise<OutfitRating | null> {
  const scope = captureSession();
  const sig = comboSignature(garmentIds);
  return (await readCache(scope)).find((f) => f.signature === sig)?.rating ?? null;
}

/**
 * Records (or changes) the rating for a combination. The cache updates first
 * so the next suggestion already respects it; the cloud write follows.
 * Returns false if the cloud write failed (the rating still holds on this
 * device, so suggestions here keep respecting it).
 */
export async function rateOutfit(garmentIds: string[], rating: OutfitRating, occasion?: string): Promise<boolean> {
  const scope = captureSession();
  const signature = comboSignature(garmentIds);
  const entry: OutfitFeedback = {
    signature,
    garmentIds: signature.split('|'),
    rating,
    occasion,
    updatedAt: new Date().toISOString()
  };
  const existing = await readCache(scope);
  await writeCache(scope, [entry, ...existing.filter((f) => f.signature !== signature)]);

  const userId = scope.userId;
  if (!userId || !isSessionCurrent(scope)) return false;
  try {
    const { error } = await supabase.from('outfit_feedback').upsert(
      {
        user_id: userId,
        signature,
        garment_ids: entry.garmentIds,
        rating,
        occasion: occasion ?? null,
        updated_at: entry.updatedAt
      },
      { onConflict: 'user_id,signature' }
    );
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Saving outfit feedback to the cloud failed (kept on this device):', err);
    return false;
  }
}
