import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigCheck } from './supabaseClient';
import { classifyAuthError, AuthFailureKind } from './authErrors';
import { API_BASE_URL } from '../config';

/**
 * CLOSIQ Mobile — Authentication service (Sprint M17).
 *
 * Thin wrapper over Supabase Auth: every function returns a small,
 * human-readable result rather than a raw Supabase error object, so
 * `LoginScreen.tsx` never has to interpret a Supabase-shaped error itself.
 */

export interface AuthResult {
  ok: boolean;
  session: Session | null;
  /** Set on failure (human-readable), or on a success-without-session case
   *  (e.g. "check your email to confirm your account"). */
  message?: string;
  /** Why it failed, for callers that need to react differently (2026-09-12). */
  kind?: AuthFailureKind;
}

/**
 * Login repair (2026-09-12): a build whose Supabase configuration is
 * missing/placeholder/malformed must not attempt a request at all — the
 * resulting network error would be reported as a connection problem when it
 * is actually a build problem.
 */
function configFailure(): AuthResult | null {
  if (supabaseConfigCheck.ok) return null;
  return { ok: false, session: null, kind: 'config', message: supabaseConfigCheck.message };
}

/**
 * supabase-js normally RETURNS errors, but its transport can also THROW
 * (DNS failure, an aborted request, an unexpected runtime error). Every
 * call below goes through this so a throw becomes an honest result instead
 * of an unhandled rejection that leaves the UI spinning.
 */
async function attemptAuth(run: () => Promise<AuthResult>): Promise<AuthResult> {
  try {
    return await run();
  } catch (err) {
    const { kind, message } = classifyAuthError(err);
    console.warn(`[CLOSIQ] Auth request threw (${kind})`);
    return { ok: false, session: null, kind, message };
  }
}

// The brief's literal demo credentials — what the user actually types.
// Supabase requires a real-looking email (a TLD/domain), so "demo@login"
// is translated internally to a real backing account; the UI-facing
// literals below are what's shown/typed, never the backing email.
export const DEMO_DISPLAY_EMAIL = 'demo@login';
export const DEMO_DISPLAY_PASSWORD = 'demo@123';
const DEMO_BACKING_EMAIL = 'demo.account@closiq.app';
const DEMO_BACKING_PASSWORD = 'demo@123';

export async function getCurrentSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Startup session restore that can tell "signed out" apart from "couldn't
 * refresh" (Sprint M20).
 *
 * When the stored access token has expired (1 hour) and the app cold-starts
 * without a connection, auth-js's `getSession()` tries a refresh, fails
 * with a retryable network error, and returns `session: null` — while
 * KEEPING the stored session (only non-retryable failures discard it). The
 * app used to render that as a plain Login screen, as if the user had been
 * signed out. `restoreFailed` (true ONLY for that network case) lets the
 * caller say what actually happened;
 * the auto-refresh ticker then restores the session (emitting
 * TOKEN_REFRESHED) as soon as the network is back.
 */
export async function restoreSession(): Promise<{ session: Session | null; restoreFailed: boolean }> {
  try {
    const { data, error } = await supabase.auth.getSession();
    // ONLY a network (retryable) failure means the session is still stored.
    // A revoked/invalid refresh token is a genuine sign-out — auth-js has
    // already discarded it, and the Login screen is the correct, silent
    // outcome there.
    return { session: data.session, restoreFailed: !data.session && isAuthRetryableFetchError(error) };
  } catch (err) {
    return { session: null, restoreFailed: isAuthRetryableFetchError(err) };
  }
}

/** Returns an unsubscribe function. */
export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const trimmedEmail = email.trim();
  if (trimmedEmail.toLowerCase() === DEMO_DISPLAY_EMAIL && password === DEMO_DISPLAY_PASSWORD) {
    return signInDemo();
  }

  const configProblem = configFailure();
  if (configProblem) return configProblem;

  return attemptAuth(async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
    if (error) {
      const { kind, message } = classifyAuthError(error);
      return { ok: false, session: null, kind, message };
    }
    return { ok: true, session: data.session };
  });
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const trimmedEmail = email.trim();

  const configProblem = configFailure();
  if (configProblem) return configProblem;

  return attemptAuth(async () => {
  // Without an explicit redirect, the confirmation email links to the
  // project's Site URL — which defaulted to http://localhost:3000. Send
  // people to the deployed "email confirmed" page instead (it must also be
  // in Supabase → Auth → URL Configuration → Redirect URLs).
  const emailRedirectTo = API_BASE_URL.startsWith('https://') ? `${API_BASE_URL}/email-confirmed.html` : undefined;
  const { data, error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
    options: emailRedirectTo ? { emailRedirectTo } : undefined
  });
  if (error) {
    const { kind, message } = classifyAuthError(error);
    return { ok: false, session: null, kind, message };
  }

  if (!data.session) {
    // Common when the Supabase project has "Confirm email" enabled — the
    // account genuinely was created, there's just no session yet.
    return {
      ok: true,
      session: null,
      message: 'Account created — check your email to confirm it, then log in.'
    };
  }
  return { ok: true, session: data.session };
  });
}

/**
 * Signs into the fixed demo account, self-provisioning it on first use so
 * this doesn't depend on someone having manually created it via the
 * Supabase dashboard first. Demo wardrobe seeding (see wardrobeStorage.ts)
 * happens separately, keyed off `isDemoUser()`, once a session exists.
 */
export async function signInDemo(): Promise<AuthResult> {
  const configProblem = configFailure();
  if (configProblem) return configProblem;

  return attemptAuth(async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: DEMO_BACKING_EMAIL,
      password: DEMO_BACKING_PASSWORD
    });

    if (!error) return { ok: true, session: data.session };

    const classified = classifyAuthError(error);

    // Login repair (2026-09-12): this used to fall back to `signUp()` (and
    // then a second sign-in) whenever sign-in failed. That is wrong twice
    // over: a transport failure like DNS is not "the account is missing",
    // and creating accounts is never a demo button's job — it silently
    // provisioned a shared account, and against a reachable-but-wrong
    // project it would create an account there. Demo now ONLY signs in.
    if (classified.kind === 'invalid_credentials') {
      return {
        ok: false,
        session: null,
        kind: 'demo_missing',
        message:
          "The demo account isn't set up on this project. CLOSIQ won't create it automatically — ask the team to provision it, or log in with your own account."
      };
    }

    return { ok: false, session: null, kind: classified.kind, message: classified.message };
  });
}

export async function signOut(): Promise<{ ok: boolean; message?: string }> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      const classified = classifyAuthError(error);
      console.warn(`[CLOSIQ] Sign-out failed (${classified.kind})`);
      return { ok: false, message: classified.message };
    }
    return { ok: true };
  } catch (err) {
    const classified = classifyAuthError(err);
    console.warn(`[CLOSIQ] Sign-out threw (${classified.kind})`);
    return { ok: false, message: classified.message };
  }
}

export function isDemoUser(email?: string | null): boolean {
  return (email || '').toLowerCase() === DEMO_BACKING_EMAIL;
}

/** For attaching to /api/ai/* requests — empty object (no header) if
 *  there's no active session, so a stateless/expired call fails the
 *  server's own auth check rather than silently omitting the header. */
export async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
