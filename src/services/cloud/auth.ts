import { supabase } from './supabase';

/**
 * Web sign-in / sign-up / password reset against the same Supabase Auth the
 * mobile app uses (mobile/src/services/authService.ts). Kept deliberately
 * small: the browser has no device-offline or DNS dialects to untangle, so
 * errors map to a handful of plain messages.
 */

export interface AuthOutcome {
  ok: boolean;
  /** Shown to the user — an error on failure, or a "check your email" note. */
  message?: string;
}

function friendlyError(err: { message?: string; status?: number; code?: string } | null): string {
  const message = (err?.message || '').toLowerCase();
  if (err?.status === 429 || message.includes('rate limit')) return 'Too many attempts. Please wait a minute and try again.';
  if (message.includes('invalid login credentials')) return 'That email and password don’t match an account.';
  if (message.includes('email not confirmed')) return 'Please confirm your email first — check your inbox for the link from CLOSIQ.';
  if (message.includes('already registered') || message.includes('already exists')) return 'An account with this email already exists. Try signing in.';
  if (message.includes('password') && message.includes('characters')) return 'Use a password with at least 6 characters.';
  if (message.includes('invalid') && message.includes('email')) return 'Please enter a valid email address.';
  if (message.includes('failed to fetch') || message.includes('network')) return 'Couldn’t reach CLOSIQ. Check your connection and try again.';
  return 'Something went wrong. Please try again.';
}

export async function signIn(email: string, password: string): Promise<AuthOutcome> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  return error ? { ok: false, message: friendlyError(error) } : { ok: true };
}

export async function signUp(email: string, password: string): Promise<AuthOutcome> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: `${window.location.origin}/email-confirmed.html` }
  });
  if (error) return { ok: false, message: friendlyError(error) };
  if (!data.session) {
    return { ok: true, message: 'Account created! Check your email and tap the confirmation link, then sign in here.' };
  }
  return { ok: true };
}

export async function sendPasswordReset(email: string): Promise<AuthOutcome> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/`
  });
  if (error) return { ok: false, message: friendlyError(error) };
  return { ok: true, message: 'If that email has an account, a reset link is on its way.' };
}

export async function updatePassword(password: string): Promise<AuthOutcome> {
  const { error } = await supabase.auth.updateUser({ password });
  return error ? { ok: false, message: friendlyError(error) } : { ok: true, message: 'Password updated.' };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
