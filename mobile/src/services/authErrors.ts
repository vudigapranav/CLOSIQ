/**
 * Login repair (2026-09-12) — say what actually failed, and claim no more
 * than the signal supports.
 *
 * Before this, every transport failure collapsed into "Unable to connect.
 * Check your internet connection and try again." That was wrong in the case
 * the user hit: the phone had working internet, but the configured Supabase
 * host did not resolve, so the user was sent to debug their Wi-Fi.
 *
 * Astra review (2026-09-12), applied here: a DNS failure, a refused/reset
 * connection or a generic fetch rejection CANNOT prove that the internet is
 * working, that there is "nothing to fix on your device", or that the
 * request "never left the device" — a captive portal, a blocked resolver or
 * a VPN produce the same signals. So:
 *   - wording is neutral "couldn't reach the service", never a verdict on
 *     the user's connection;
 *   - only the OS's own explicit offline signal is reported as offline, and
 *     even then as something the device reports, not as fact;
 *   - ambiguous signals map to `connectivity`, not `offline`;
 *   - unknown errors get safe generic UI text. Raw provider strings are
 *     returned as `detail` for logging only and must never be shown.
 */

export type AuthFailureKind =
  | 'config'
  | 'dns'
  | 'offline'
  | 'connectivity'
  | 'timeout'
  | 'service_unavailable'
  | 'rate_limited'
  | 'invalid_credentials'
  | 'email_exists'
  | 'weak_password'
  | 'invalid_email'
  | 'email_not_confirmed'
  | 'demo_missing'
  | 'unknown';

export interface ClassifiedAuthError {
  kind: AuthFailureKind;
  /** User-facing text. Safe to display: never raw provider detail. */
  message: string;
  /** Raw signal, for console/diagnostics only. Never render this. */
  detail?: string;
}

/** iOS: "A server with the specified hostname could not be found." / -1003.
 *  Android/OkHttp: "Unable to resolve host …: No address associated with hostname".
 *  Node/undici: ENOTFOUND / EAI_AGAIN. */
const DNS_RE =
  /hostname could not be found|unable to resolve host|no address associated with hostname|nodename nor servname|enotfound|eai_again|dns lookup failed|name_not_resolved|-1003\b/i;

/** ONLY the OS's own explicit "you are offline" signal (iOS -1009). */
const EXPLICIT_OFFLINE_RE = /the internet connection appears to be offline|not connected to the internet|-1009\b/i;

/** Ambiguous transport failures: could be the network, the service, a proxy,
 *  a captive portal or TLS. Never reported as a proven offline device. */
const CONNECTIVITY_RE =
  /network request failed|failed to fetch|econnrefused|econnreset|connection refused|connection reset|socket hang up|network error|ssl|tls|certificate/i;

const TIMEOUT_RE = /timed? ?out|timeout|etimedout|aborted|the operation was aborted|-1001\b/i;

const UNAVAILABLE_RE = /service unavailable|bad gateway|gateway timeout|project is paused|temporarily unavailable/i;

const UNREACHABLE_ADVICE =
  "Couldn't reach CLOSIQ's account service. It may be paused, misconfigured, or unreachable from this network.";

function messageOf(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  const e = error as {
    message?: string;
    name?: string;
    code?: string;
    cause?: { message?: string; code?: string };
  };
  return [e.message, e.name, e.code, e.cause?.message, e.cause?.code].filter(Boolean).join(' ');
}

function statusOf(error: unknown): number | undefined {
  const e = error as { status?: number; statusCode?: number } | null;
  return e?.status ?? e?.statusCode;
}

export function classifyAuthError(error: unknown): ClassifiedAuthError {
  const detail = messageOf(error) || undefined;
  const text = detail ?? '';
  const status = statusOf(error);

  // Explicit HTTP signals first — unambiguous.
  if (status === 429) {
    return { kind: 'rate_limited', message: 'Too many attempts. Wait a moment and try again.', detail };
  }
  if (status === 502 || status === 503 || status === 504) {
    return {
      kind: 'service_unavailable',
      message: "CLOSIQ's account service is temporarily unavailable. Try again in a few minutes.",
      detail
    };
  }

  if (/invalid login credentials/i.test(text)) {
    return { kind: 'invalid_credentials', message: 'Incorrect email or password.', detail };
  }
  if (/email not confirmed/i.test(text)) {
    return {
      kind: 'email_not_confirmed',
      message: 'Confirm your email first — check your inbox for the confirmation link, then log in.',
      detail
    };
  }
  if (/already registered|already exists|user_already_exists/i.test(text)) {
    return { kind: 'email_exists', message: 'An account with this email already exists. Try logging in instead.', detail };
  }
  if (/password.*(at least|should be|characters)/i.test(text)) {
    return { kind: 'weak_password', message: 'Password must be at least 6 characters.', detail };
  }
  if (/invalid email|unable to validate email/i.test(text)) {
    return { kind: 'invalid_email', message: 'Enter a valid email address.', detail };
  }
  if (/rate limit/i.test(text)) {
    return { kind: 'rate_limited', message: 'Too many attempts. Wait a moment and try again.', detail };
  }

  // Transport failures — neutral wording, no verdict on the user's network.
  if (DNS_RE.test(text)) {
    return {
      kind: 'dns',
      message: `${UNREACHABLE_ADVICE} Its address could not be looked up (DNS).`,
      detail
    };
  }
  if (TIMEOUT_RE.test(text)) {
    return {
      kind: 'timeout',
      message: "CLOSIQ's account service didn't respond in time. Try again in a moment.",
      detail
    };
  }
  if (UNAVAILABLE_RE.test(text)) {
    return {
      kind: 'service_unavailable',
      message: "CLOSIQ's account service is temporarily unavailable. Try again in a few minutes.",
      detail
    };
  }
  if (EXPLICIT_OFFLINE_RE.test(text)) {
    return {
      kind: 'offline',
      message: 'Your device reports no internet connection. Check Wi-Fi or mobile data and try again.',
      detail
    };
  }
  if (CONNECTIVITY_RE.test(text)) {
    return {
      kind: 'connectivity',
      message: `${UNREACHABLE_ADVICE} Check your connection and try again.`,
      detail
    };
  }

  // Never surface raw provider text to the user.
  return { kind: 'unknown', message: 'Something went wrong signing in. Please try again.', detail };
}
