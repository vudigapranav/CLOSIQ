import type { Session, AuthError } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

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
}

// The brief's literal demo credentials — what the user actually types.
// Supabase requires a real-looking email (a TLD/domain), so "demo@login"
// is translated internally to a real backing account; the UI-facing
// literals below are what's shown/typed, never the backing email.
export const DEMO_DISPLAY_EMAIL = 'demo@login';
export const DEMO_DISPLAY_PASSWORD = 'demo@123';
const DEMO_BACKING_EMAIL = 'demo.account@closiq.app';
const DEMO_BACKING_PASSWORD = 'demo@123';

function mapAuthError(error: AuthError | { message?: string }): string {
  const msg = error?.message || '';
  if (/invalid login credentials/i.test(msg)) return 'Incorrect email or password.';
  if (/already registered|already exists|user_already_exists/i.test(msg)) {
    return 'An account with this email already exists. Try logging in instead.';
  }
  if (/password.*(at least|should be|characters)/i.test(msg)) return 'Password must be at least 6 characters.';
  if (/invalid email|unable to validate email/i.test(msg)) return 'Enter a valid email address.';
  if (/rate limit/i.test(msg)) return 'Too many attempts. Wait a moment and try again.';
  if (/network|fetch|failed to fetch|timed? ?out/i.test(msg)) {
    return 'Unable to connect. Check your internet connection and try again.';
  }
  return msg || 'Something went wrong. Please try again.';
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
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

  const { data, error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
  if (error) return { ok: false, session: null, message: mapAuthError(error) };
  return { ok: true, session: data.session };
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const trimmedEmail = email.trim();
  const { data, error } = await supabase.auth.signUp({ email: trimmedEmail, password });
  if (error) return { ok: false, session: null, message: mapAuthError(error) };

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
}

/**
 * Signs into the fixed demo account, self-provisioning it on first use so
 * this doesn't depend on someone having manually created it via the
 * Supabase dashboard first. Demo wardrobe seeding (see wardrobeStorage.ts)
 * happens separately, keyed off `isDemoUser()`, once a session exists.
 */
export async function signInDemo(): Promise<AuthResult> {
  const signInAttempt = await supabase.auth.signInWithPassword({
    email: DEMO_BACKING_EMAIL,
    password: DEMO_BACKING_PASSWORD
  });
  if (!signInAttempt.error) {
    return { ok: true, session: signInAttempt.data.session };
  }

  const signUpAttempt = await supabase.auth.signUp({
    email: DEMO_BACKING_EMAIL,
    password: DEMO_BACKING_PASSWORD
  });
  if (signUpAttempt.error) {
    return { ok: false, session: null, message: mapAuthError(signUpAttempt.error) };
  }
  if (signUpAttempt.data.session) {
    return { ok: true, session: signUpAttempt.data.session };
  }

  // Signed up but no session (email confirmation required project-wide) —
  // one more sign-in attempt in case confirmation doesn't apply here for
  // some other reason; otherwise surface a clear, actionable message.
  const retry = await supabase.auth.signInWithPassword({
    email: DEMO_BACKING_EMAIL,
    password: DEMO_BACKING_PASSWORD
  });
  if (!retry.error) {
    return { ok: true, session: retry.data.session };
  }

  return {
    ok: false,
    session: null,
    message:
      'The demo account needs email confirmation disabled on this Supabase project (Authentication > Providers > Email > "Confirm email") to sign in automatically.'
  };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
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
