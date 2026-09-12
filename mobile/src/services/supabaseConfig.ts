/**
 * Login repair (2026-09-12) — reject an unusable Supabase configuration
 * BEFORE any auth call.
 *
 * `createClient()` happily accepts a placeholder URL, so a misconfigured
 * build only failed later, as a network error, and the user was told to
 * "check your internet connection" when the real cause was configuration.
 * Pure functions, no imports, so they are cheap to unit-test.
 */

export type SupabaseConfigProblem =
  | 'missing'
  | 'not_https'
  | 'malformed_url'
  | 'placeholder'
  | 'service_role_key';

export interface SupabaseConfigCheck {
  ok: boolean;
  problem?: SupabaseConfigProblem;
  /** User-facing, safe to display. Never contains the URL's key material. */
  message?: string;
}

const PLACEHOLDER_HOSTS = ['placeholder.supabase.co', 'your-project.supabase.co', 'example.supabase.co'];
const PLACEHOLDER_KEYS = ['placeholder-anon-key', 'your_supabase_anon_key_here', 'your-anon-key'];

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Minimal base64url decoder — `Buffer` doesn't exist in React Native and
 *  `atob` isn't guaranteed across engines, so this stays dependency-free. */
function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  let out = '';
  for (const char of normalized) {
    const index = B64_ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((value >> bits) & 0xff);
    }
  }
  return out;
}

/** Legacy JWT keys carry the role in the payload; new-style keys are prefixed. */
function isServiceRoleKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    return JSON.parse(decodeBase64Url(parts[1]))?.role === 'service_role';
  } catch {
    return false;
  }
}

export function checkSupabaseConfig(url: string, key: string): SupabaseConfigCheck {
  if (!url || !key) {
    return {
      ok: false,
      problem: 'missing',
      message:
        "CLOSIQ's account service isn't configured in this build, so signing in can't work. This is a build configuration problem, not your connection."
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      ok: false,
      problem: 'malformed_url',
      message: "CLOSIQ's account service address is invalid in this build. This is a build configuration problem, not your connection."
    };
  }

  if (parsed.protocol !== 'https:') {
    return {
      ok: false,
      problem: 'not_https',
      message: "CLOSIQ's account service address must use https in this build. This is a build configuration problem, not your connection."
    };
  }

  if (PLACEHOLDER_HOSTS.includes(parsed.hostname.toLowerCase()) || PLACEHOLDER_KEYS.includes(key)) {
    return {
      ok: false,
      problem: 'placeholder',
      message:
        "CLOSIQ's account service is still set to a placeholder in this build, so signing in can't work. This is a build configuration problem, not your connection."
    };
  }

  if (isServiceRoleKey(key)) {
    // Refuse to authenticate with a key that bypasses row-level security,
    // even though it would "work" — it must never ship in an app.
    return {
      ok: false,
      problem: 'service_role_key',
      message: "CLOSIQ's account service is misconfigured in this build (wrong key type). Sign-in is disabled for safety."
    };
  }

  return { ok: true };
}
