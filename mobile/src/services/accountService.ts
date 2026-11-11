import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';
import { supabase } from './supabaseClient';
import { signOut } from './authService';
import { classifyAuthError } from './authErrors';
import { getCurrentUserId } from './authSession';

/**
 * Account & privacy actions: delete account, export data, AI photo consent.
 */

export const AI_PHOTO_CONSENT_KEY = 'closiq_ai_photo_consent';

// Postgres/PostgREST codes for "function does not exist" — the
// delete_my_account RPC ships in migration 20261111054834_wardrobe_intelligence
// which may not be applied to the project yet.
const MISSING_RPC_CODES = ['PGRST202', '42883'];

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; reason: 'not_enabled' | 'not_signed_in' | 'failed'; message: string };

/**
 * Permanently deletes the signed-in account via the `delete_my_account` RPC,
 * then signs out and clears this device's cached data.
 *
 * NOTE: photos in the Supabase storage bucket are NOT removed by the RPC —
 * they are orphaned until a server-side cleanup exists.
 *
 * If the RPC is not deployed, NOTHING is deleted and `not_enabled` is returned.
 */
export async function deleteMyAccount(): Promise<DeleteAccountResult> {
  const userId = getCurrentUserId();
  try {
    // The generated Database type does not know this RPC yet.
    const { error } = await (supabase as unknown as {
      rpc: (fn: string) => Promise<{ error: { code?: string; message?: string } | null }>;
    }).rpc('delete_my_account');
    if (error) {
      if (error.code && MISSING_RPC_CODES.includes(error.code)) {
        return {
          ok: false,
          reason: 'not_enabled',
          message: 'Account deletion is not enabled yet. Nothing was deleted.'
        };
      }
      const { message } = classifyAuthError(error);
      return { ok: false, reason: 'failed', message: `Couldn't delete your account. Nothing was changed. ${message}` };
    }
  } catch (err) {
    const { message } = classifyAuthError(err);
    return { ok: false, reason: 'failed', message: `Couldn't delete your account. Nothing was changed. ${message}` };
  }

  await signOut();
  await clearLocalCaches(userId);
  return { ok: true };
}

/** Removes this device's cached per-user data (keys are suffixed `_<userId>`). */
async function clearLocalCaches(userId: string | null): Promise<void> {
  try {
    const storage = AsyncStorage as unknown as {
      getAllKeys?: () => Promise<readonly string[]>;
      multiRemove?: (keys: string[]) => Promise<void>;
      removeItem: (key: string) => Promise<void>;
    };
    if (storage.getAllKeys && storage.multiRemove && userId) {
      const keys = (await storage.getAllKeys()).filter((k) => k.includes(userId));
      if (keys.length) await storage.multiRemove(keys);
    }
    await storage.removeItem(AI_PHOTO_CONSENT_KEY);
  } catch {
    /* best effort */
  }
}

const EXPORT_TABLES = ['garments', 'saved_outfits', 'planner_events', 'outfit_feedback'] as const;

export type ExportResult = { ok: true } | { ok: false; message: string };

/** Collects the user's own rows (garments, saved outfits, planner, feedback) as JSON. */
export async function buildDataExport(): Promise<{ ok: true; json: string } | { ok: false; message: string }> {
  try {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return { ok: false, message: 'Sign in to export your data.' };
    const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), userId: uid };
    for (const table of EXPORT_TABLES) {
      const res = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => { eq: (c: string, v: string) => Promise<{ data: unknown[] | null; error: unknown }> };
        };
      })
        .from(table)
        .select('*')
        .eq('user_id', uid);
      if (res.error) return { ok: false, message: `Couldn't read your ${table.replace('_', ' ')}. Try again.` };
      out[table] = res.data ?? [];
    }
    return { ok: true, json: JSON.stringify(out, null, 2) };
  } catch (err) {
    return { ok: false, message: classifyAuthError(err).message };
  }
}

export async function exportMyData(): Promise<ExportResult> {
  const built = await buildDataExport();
  if (!built.ok) return built;
  try {
    await Share.share({ title: 'CLOSIQ data export', message: built.json });
    return { ok: true };
  } catch {
    return { ok: false, message: "Couldn't open the share sheet." };
  }
}

/** AI photo analysis consent. Defaults to ON until the user turns it off. */
export async function getAiPhotoConsent(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(AI_PHOTO_CONSENT_KEY)) !== 'false';
  } catch {
    return true;
  }
}

export async function setAiPhotoConsent(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(AI_PHOTO_CONSENT_KEY, value ? 'true' : 'false');
  } catch {
    /* ignore */
  }
  // Best-effort mirror; the column may not exist yet.
  try {
    const uid = getCurrentUserId();
    if (uid) {
      await (supabase as unknown as {
        from: (t: string) => { update: (v: object) => { eq: (c: string, v: string) => Promise<unknown> } };
      })
        .from('profiles')
        .update({ ai_photo_consent: value })
        .eq('id', uid);
    }
  } catch {
    /* ignore */
  }
}
