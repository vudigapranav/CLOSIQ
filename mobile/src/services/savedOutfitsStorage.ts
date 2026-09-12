import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { Outfit } from '../../../src/types/wardrobe';
import {
  SessionScope,
  captureSession,
  isSessionCurrent,
  userScopedKeyFor
} from './authSession';
import { runCloudWrite, isSyncPending, markPending, clearPending, mergePendingLocal } from './cloudWriteFeedback';
import { supabase } from './supabaseClient';
import { refreshNestedGarmentImages } from './garmentImages';

/**
 * Saved looks store full garment objects — including each garment's image
 * URL at save time — in `saved_outfits.items`. Those URLs are signed (they
 * expire) or seed URLs on an old host, so they are re-resolved from their
 * durable path on every load (Sprint M20). The stored look is never
 * rewritten and never regenerated.
 */
function withFreshImages(outfits: Outfit[]): Promise<Outfit[]> {
  return refreshNestedGarmentImages(
    outfits,
    (o) => o.items,
    (o, items) => ({ ...o, items: items as Outfit['items'] })
  );
}
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

async function readCache(scope: SessionScope): Promise<Outfit[]> {
  try {
    const raw = await AsyncStorage.getItem(userScopedKeyFor(scope.userId, BASE_STORAGE_KEY));
    if (!raw) return [];
    return JSON.parse(raw) as Outfit[];
  } catch (err) {
    console.warn('Failed to read cached saved outfits:', err);
    return [];
  }
}

async function writeCache(scope: SessionScope, list: Outfit[]): Promise<void> {
  try {
    await AsyncStorage.setItem(userScopedKeyFor(scope.userId, BASE_STORAGE_KEY), JSON.stringify(list));
  } catch (err) {
    console.warn('Failed to cache saved outfits:', err);
  }
}

export async function loadSavedOutfits(): Promise<Outfit[]> {
  // Session captured once, up front — see authSession.ts (Sprint M19).
  const scope = captureSession();
  const userId = scope.userId;
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('saved_outfits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const mapped = (data || []).map(rowToOutfit);
    if (!isSessionCurrent(scope)) {
      console.warn('Discarding saved-looks read that resolved after a session change.');
      return [];
    }
    // Looks whose cloud insert failed exist only in this cache — keep them.
    const merged = await withFreshImages(mergePendingLocal(mapped, await readCache(scope)));
    if (!isSessionCurrent(scope)) return [];
    await writeCache(scope, merged);
    return merged;
  } catch (err) {
    console.warn('Cloud saved-outfits fetch failed, falling back to local cache:', err);
    const cached = await withFreshImages(await readCache(scope));
    if (!isSessionCurrent(scope)) return [];
    if (cached.length === 0) {
      Alert.alert(
        "Couldn't load Saved Looks",
        "Check your connection and try again. Your saved looks are safe in the cloud."
      );
    }
    return cached;
  }
}

async function outfitRowExists(userId: string, outfitId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('saved_outfits')
    .select('id')
    .eq('user_id', userId)
    .eq('outfit_id', outfitId)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function saveOutfitToStorage(outfit: Outfit): Promise<Outfit[]> {
  const scope = captureSession();
  const userId = scope.userId;
  const existing = await readCache(scope);

  const duplicate = existing.find(
    (o) => o.id === outfit.id || isSameOutfitItems(o.items.map((i) => i.id), outfit.items.map((i) => i.id))
  );
  // An already-synced look is genuinely a no-op. A look still marked
  // pending is NOT — tapping Save again is the user's way to retry it, so
  // it must reach the cloud call instead of being silently swallowed here.
  if (duplicate && !isSyncPending(duplicate)) return existing;

  const withSaved = clearPending({ ...(duplicate ?? outfit), saved: true });
  const others = existing.filter((o) => o.id !== withSaved.id);
  const optimistic = [withSaved, ...others];
  await writeCache(scope, optimistic);

  if (!userId) return optimistic;

  const cloudSynced = await runCloudWrite({
    scope,
    title: 'Look not saved to your account',
    message:
      "This look is on this device only. It won't appear on your other devices, and it does not upload later on its own — try again now, or tap Save Look again later.",
    run: async (attempt) => {
      // A previous attempt (this call's, or an earlier failed save of this
      // same pending look) may have committed; never insert it twice.
      if ((attempt > 1 || duplicate) && (await outfitRowExists(userId, withSaved.id))) return;
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
    }
  });

  if (!isSessionCurrent(scope)) return [];
  if (cloudSynced) return optimistic;

  // Kept locally — a rollback here would throw away the look the user just
  // asked to keep — but marked, so the UI doesn't show it as saved and the
  // next cloud read doesn't erase it.
  const pendingList = [markPending(withSaved), ...others];
  await writeCache(scope, pendingList);
  return pendingList;
}

export async function removeSavedOutfitFromStorage(id: string): Promise<Outfit[]> {
  const scope = captureSession();
  const userId = scope.userId;
  const existing = await readCache(scope);
  const updated = existing.filter((o) => o.id !== id);
  await writeCache(scope, updated);

  if (!userId) return updated;

  const cloudDeleted = await runCloudWrite({
    scope,
    title: 'Look not removed',
    message:
      "This look couldn't be removed from your account, so it's still there and will come back next time Saved Looks loads. Try again to remove it for good.",
    run: async () => {
      const { error } = await supabase.from('saved_outfits').delete().eq('user_id', userId).eq('outfit_id', id);
      if (error) throw error;
    }
  });

  if (!isSessionCurrent(scope)) return [];

  if (!cloudDeleted) {
    // Still in the cloud — the local cache must not claim otherwise.
    await writeCache(scope, existing);
    return existing;
  }

  return updated;
}

export function isSameOutfitItems(idsA: string[], idsB: string[]): boolean {
  if (idsA.length !== idsB.length) return false;
  const setA = new Set(idsA);
  return idsB.every((id) => setA.has(id));
}
