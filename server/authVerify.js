import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

/**
 * Server-side bearer-token verification (Sprint M17).
 *
 * `SUPABASE_URL`/`SUPABASE_ANON_KEY` are the SAME public, RLS-protected
 * values the mobile app ships with under `EXPO_PUBLIC_` names — not a
 * secret, and no service-role key is needed here: `auth.getUser(token)`
 * validates a bearer token against Supabase's own auth server and is
 * designed to be called with just the anon key.
 *
 * This never trusts anything the client claims about who it is — the
 * returned user id comes only from Supabase's own verification of the
 * token, never from a request body/header value the client could set to
 * anything.
 *
 * `realtime.transport: ws` — this server never uses Realtime (only
 * `auth.getUser`), but `createClient()` unconditionally constructs a
 * RealtimeClient, which throws at startup on Node < 22 (no native
 * WebSocket) unless given a WebSocket implementation explicitly. This is
 * the fix Supabase's own error message documents; it does not change any
 * auth behavior.
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const authClient =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { realtime: { transport: ws } })
    : null;

/**
 * Returns the verified user id for a request's `Authorization: Bearer
 * <token>` header, or null if there is no token, the token is invalid, or
 * Supabase isn't configured on this server at all. Callers must treat null
 * as "not authenticated" and fail closed — never proceed on the absence of
 * a check, the same posture geminiServer.js already uses for a missing
 * GEMINI_API_KEY.
 */
export async function getAuthenticatedUserId(req) {
  if (!authClient) return null;

  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || !header.startsWith('Bearer ')) return null;

  const token = header.slice('Bearer '.length).trim();
  if (!token) return null;

  try {
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch (err) {
    console.error('[Auth Verify Error]:', err?.message || err);
    return null;
  }
}
