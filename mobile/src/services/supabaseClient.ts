import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import { checkSupabaseConfig } from './supabaseConfig';
import { timedSupabaseFetch } from './supabaseTransport';

/**
 * CLOSIQ Mobile — Supabase client (Sprint M17).
 *
 * `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` are public,
 * Row-Level-Security-protected values — Supabase's own design intends for
 * the anon key to ship inside a client bundle, exactly like a Firebase
 * client config. This is NOT the same category of secret as
 * `GEMINI_API_KEY` (server/config.ts's whole point is that key must never
 * reach mobile) — nothing here is sensitive on its own.
 *
 * Without real project credentials configured, the client still
 * constructs successfully (a syntactically-valid placeholder URL, per
 * Supabase's own constructor requirements) so the rest of the app can
 * build/bundle/typecheck normally — actual auth calls will simply fail
 * with a clear connection error at runtime until real values are set.
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Login repair (2026-09-12): validated, not merely present. A placeholder or
 * malformed configuration is rejected up front by authService so the user is
 * told it's a build problem instead of being sent to check a working
 * internet connection. Never logs the key.
 */
export const supabaseConfigCheck = checkSupabaseConfig(SUPABASE_URL, SUPABASE_ANON_KEY);
export const isSupabaseConfigured = supabaseConfigCheck.ok;

if (!isSupabaseConfigured) {
  console.warn(
    `[CLOSIQ] Supabase is not usable in this build (${supabaseConfigCheck.problem}). ` +
      'Login/Create Account will explain this instead of attempting a request. See mobile/.env.example.'
  );
}

/**
 * Astra review (2026-09-12): a malformed `EXPO_PUBLIC_SUPABASE_URL` makes
 * `createClient()` throw while this module is being imported — the app would
 * crash on launch before the config gate in authService could ever explain
 * the problem. So an invalid configuration never reaches createClient: the
 * client is built against a syntactically valid placeholder instead, stays
 * inert, and every auth entry point refuses up front via `supabaseConfigCheck`.
 */
const SAFE_URL = supabaseConfigCheck.ok ? SUPABASE_URL : 'https://placeholder.supabase.co';
const SAFE_KEY = supabaseConfigCheck.ok ? SUPABASE_ANON_KEY : 'placeholder-anon-key';

export const supabase = createClient<Database>(
  SAFE_URL,
  SAFE_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    },
    global: { fetch: timedSupabaseFetch }
  }
);

/**
 * Sprint M20 — Supabase's documented React Native setup: keep refreshing
 * the session only while the app is in the foreground. JS timers are
 * suspended in the background, so without this a user returning after the
 * 1-hour access-token lifetime sent requests with an expired JWT (AI calls
 * 401'd, reads failed) until the next 30-second tick happened to fire.
 * `startAutoRefresh()` runs a refresh check immediately on foreground.
 * Registered once, at module load, for the app's lifetime.
 */
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
