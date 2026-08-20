import AsyncStorage from '@react-native-async-storage/async-storage';
import { userScopedKey, getCurrentUserId } from './authSession';
import { supabase } from './supabaseClient';

const BASE_STORAGE_KEY = '@closiq_recent_outfit_signatures';
/** Keep a reasonable recent history, not an ever-growing exclusion list. */
const MAX_HISTORY = 8;

/** Deterministic identity for a garment combination: sorted IDs joined —
 *  never the outfit name/title, which Gemini can vary freely without the
 *  combination itself actually being different. */
export function buildOutfitSignature(garmentIds: string[]): string {
  return [...garmentIds].sort().join('|');
}

async function readCache(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(userScopedKey(BASE_STORAGE_KEY));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to read cached recent outfit history:', err);
    return [];
  }
}

async function writeCache(signatures: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(userScopedKey(BASE_STORAGE_KEY), JSON.stringify(signatures));
  } catch (err) {
    console.warn('Failed to cache recent outfit history:', err);
  }
}

/**
 * Sprint M18: `outfit_history` (Supabase, RLS-scoped to `user_id =
 * auth.uid()`, live-verified) is now the durable source of truth — the
 * soft-variety exclusion list survives an app restart AND a logout/login,
 * not just a restart. AsyncStorage remains as a read cache.
 */
export async function loadRecentOutfitSignatures(): Promise<string[]> {
  const userId = getCurrentUserId();
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('outfit_history')
      .select('signature')
      .eq('user_id', userId)
      .order('last_seen_at', { ascending: false })
      .limit(MAX_HISTORY);
    if (error) throw error;
    const signatures = (data || []).map((row) => row.signature);
    await writeCache(signatures);
    return signatures;
  } catch (err) {
    console.warn('Cloud outfit-history fetch failed, falling back to local cache:', err);
    return readCache();
  }
}

/**
 * Records a combination as recently seen (generated, regenerated, saved, or
 * worn). Most-recent-first, capped at MAX_HISTORY, de-duplicated (an outfit
 * seen again just moves back to the front rather than being stored twice).
 * This is silent background bookkeeping, not a user-initiated save — a
 * cloud-sync failure here is logged, not surfaced as an alert, matching its
 * original local-only behavior.
 */
export async function recordRecentOutfit(garmentIds: string[]): Promise<void> {
  if (garmentIds.length === 0) return;

  const signature = buildOutfitSignature(garmentIds);
  const existing = await readCache();
  const withoutDuplicate = existing.filter((s) => s !== signature);
  const updated = [signature, ...withoutDuplicate].slice(0, MAX_HISTORY);
  await writeCache(updated);

  const userId = getCurrentUserId();
  if (!userId) return;

  try {
    const nowIso = new Date().toISOString();
    const { data: existingRow, error: selectError } = await supabase
      .from('outfit_history')
      .select('id')
      .eq('user_id', userId)
      .eq('signature', signature)
      .maybeSingle();
    if (selectError) throw selectError;

    if (existingRow) {
      const { error } = await supabase
        .from('outfit_history')
        .update({ last_seen_at: nowIso, garment_ids: garmentIds })
        .eq('id', existingRow.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('outfit_history').insert({
        user_id: userId,
        signature,
        garment_ids: garmentIds,
        last_seen_at: nowIso
      });
      if (error) throw error;
    }

    // Trim to MAX_HISTORY server-side too, so a returning session never
    // sees more exclusions than the soft-variety design intends.
    const { data: overflow, error: overflowError } = await supabase
      .from('outfit_history')
      .select('id')
      .eq('user_id', userId)
      .order('last_seen_at', { ascending: false })
      .range(MAX_HISTORY, 999);
    if (overflowError) throw overflowError;
    if (overflow && overflow.length > 0) {
      await supabase
        .from('outfit_history')
        .delete()
        .in('id', overflow.map((row) => row.id));
    }
  } catch (err) {
    console.warn('Failed to record recent outfit to cloud:', err);
  }
}
