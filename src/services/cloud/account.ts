import { supabase } from './supabase';

/**
 * Web account & privacy (2026-11-11).
 *
 * - AI photo consent: `profiles.ai_photo_consent` (migration
 *   20261111120000_wardrobe_intelligence.sql) mirrored to localStorage so the
 *   choice is honoured immediately and even before that column exists in
 *   production. A failed cloud write is treated as local-only, silently.
 * - Data export: the user's own rows, fetched with their own session.
 * - Account deletion: the `delete_my_account` RPC.
 */

const CONSENT_KEY = 'closiq_ai_photo_consent';

/** True unless the user switched AI photo analysis off. Default: on (as before). */
export function isAiPhotoConsentGiven(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) !== '0';
  } catch {
    return true;
  }
}

function mirrorConsent(value: boolean) {
  try {
    localStorage.setItem(CONSENT_KEY, value ? '1' : '0');
  } catch {
    /* private mode: the cloud copy still applies on next sign-in */
  }
}

/** Reads the account's saved choice (when the column exists) and mirrors it locally. */
export async function loadAiPhotoConsent(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('profiles').select('ai_photo_consent').eq('user_id', userId).maybeSingle();
    if (!error && data && typeof (data as { ai_photo_consent?: unknown }).ai_photo_consent === 'boolean') {
      const value = (data as { ai_photo_consent: boolean }).ai_photo_consent;
      mirrorConsent(value);
      return value;
    }
  } catch {
    /* fall through to the local value */
  }
  return isAiPhotoConsentGiven();
}

/** Saves locally first, then tries the account. `cloud` is false when only this browser has it. */
export async function setAiPhotoConsent(userId: string, value: boolean): Promise<{ cloud: boolean }> {
  mirrorConsent(value);
  try {
    const { error } = await supabase.from('profiles').update({ ai_photo_consent: value } as never).eq('user_id', userId);
    return { cloud: !error };
  } catch {
    return { cloud: false };
  }
}

const EXPORT_TABLES = ['profiles', 'user_preferences', 'garments', 'saved_outfits', 'planner_events', 'outfit_feedback', 'outfit_history'] as const;

/** Everything CLOSIQ stores about the user, as one object (their own rows only). */
export async function collectMyData(userId: string, email?: string): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), account: { id: userId, email: email ?? null } };
  for (const table of EXPORT_TABLES) {
    const { data, error } = await supabase.from(table).select('*').eq('user_id', userId);
    if (error) throw new Error(`Couldn’t read ${table}: ${error.message}`);
    out[table] = data ?? [];
  }
  return out;
}

export async function downloadMyData(userId: string, email?: string): Promise<void> {
  const data = await collectMyData(userId, email);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `closiq-my-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface DeleteOutcome {
  ok: boolean;
  message?: string;
}

/**
 * Deletes the signed-in user via the `delete_my_account` RPC (every table
 * cascades from auth.users), then signs out.
 *
 * KNOWN GAP: photos under garment-images/<uid>/ are NOT removed here. Cleaning
 * storage first would destroy photos while rows remain if the RPC turned out
 * to be missing (migration not applied), and after the RPC the session is
 * gone. They stay orphaned until a server-side storage cleanup exists.
 */
export async function deleteMyAccount(): Promise<DeleteOutcome> {
  const { error } = await supabase.rpc('delete_my_account' as never);
  if (error) {
    const missing = error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message || '');
    return {
      ok: false,
      message: missing ? 'Account deletion isn’t enabled on the server yet. Nothing was deleted.' : 'Couldn’t delete your account. Nothing was deleted — please try again.'
    };
  }
  try {
    mirrorConsent(true);
    await supabase.auth.signOut();
  } catch {
    /* the account is gone either way */
  }
  return { ok: true };
}
