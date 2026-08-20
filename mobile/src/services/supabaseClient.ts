import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

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
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isSupabaseConfigured) {
  console.warn(
    '[CLOSIQ] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set — ' +
      'Login/Create Account will show a connection error until a real Supabase project is configured. ' +
      'See mobile/.env.example.'
  );
}

export const supabase = createClient<Database>(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  }
);
