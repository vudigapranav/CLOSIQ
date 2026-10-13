import { createClient } from '@supabase/supabase-js';

/**
 * Web Supabase client (2026-10-13). Same project, same public anon key and
 * same RLS-protected tables as the mobile app, so a user sees one wardrobe
 * on the phone and in the browser. The two values are injected at build
 * time by vite.config.js (publicSupabaseDefines) from VITE_SUPABASE_* or the
 * server's SUPABASE_URL / SUPABASE_ANON_KEY.
 */

export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isCloudConfigured =
  /^https:\/\/[^/]+$/.test(SUPABASE_URL.replace(/\/$/, '')) &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_URL.includes('your-project');

// An unconfigured build still gets a syntactically valid client (createClient
// throws on a bad URL at import time); App shows a configuration message and
// never calls it.
export const supabase = createClient(
  isCloudConfigured ? SUPABASE_URL : 'https://unconfigured.invalid',
  SUPABASE_ANON_KEY || 'unconfigured',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

/** Authorization header for our own /api/ai/* routes, or {} when signed out. */
export async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const GARMENT_IMAGES_BUCKET = 'garment-images';
export const SIGNED_URL_TTL_SECONDS = 60 * 60;
