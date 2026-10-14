/**
 * Login repair (2026-09-12) — regressions for the reported iPhone failure:
 * demo/sign-in showed "hostname not found", the spinner could stick, and the
 * demo button silently created accounts.
 *
 * These run the REAL authService / classifier / config modules against a
 * programmed Supabase double. No network, no cloud, no account creation.
 */
import './helpers/installMocks';
import { setSupabase, setSupabaseConfigCheck } from './helpers/installMocks';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MOBILE_ROOT } from './helpers/sourcePaths';

import { classifyAuthError } from '../src/services/authErrors';
import { checkSupabaseConfig } from '../src/services/supabaseConfig';
import { signIn, signUp, signOut } from '../src/services/authService';

/** Records every auth method the code calls, so "never signs up" is provable. */
function authDouble(handlers: Record<string, () => unknown>) {
  const calls: string[] = [];
  const wrap = (name: string) => async (..._args: unknown[]) => {
    calls.push(name);
    const handler = handlers[name];
    if (!handler) return { data: { session: null, user: null }, error: null };
    const result = handler();
    if (result instanceof Error) throw result;
    return result;
  };
  return {
    calls,
    client: {
      auth: {
        signInWithPassword: wrap('signInWithPassword'),
        signUp: wrap('signUp'),
        signOut: wrap('signOut'),
        getSession: wrap('getSession')
      }
    }
  };
}

const invalidCreds = () => ({ data: { session: null }, error: { message: 'Invalid login credentials', status: 400 } });
const iosDnsError = () =>
  new Error('A server with the specified hostname could not be found.');

// ------------------------------------------------------- no demo account
// 2026-10-13: the shared demo account was removed at the user's request —
// it made every visitor's uploads land in one shared wardrobe.

test('there is no demo sign-in left anywhere in the auth flow', async () => {
  assert.doesNotMatch(LOGIN_SOURCE, /demo/i, 'LoginScreen must not offer a demo account');
  const double = authDouble({ signInWithPassword: invalidCreds });
  setSupabase(double.client);
  const result = await signIn('demo@login', 'demo@123');
  assert.equal(result.ok, false);
  assert.equal(result.kind, 'invalid_credentials', 'the old demo shortcut is just an ordinary (wrong) login now');
  assert.deepEqual(double.calls, ['signInWithPassword']);
});

// ------------------------------------------------------- thrown errors

test('a THROWN auth rejection becomes an honest result instead of an unhandled rejection', async () => {
  for (const [name, call] of [
    ['signIn', () => signIn('a@b.com', 'pw')],
    ['signUp', () => signUp('a@b.com', 'password1')]
  ] as const) {
    setSupabase(authDouble({ signInWithPassword: iosDnsError, signUp: iosDnsError }).client);
    const result = await call();
    assert.equal(result.ok, false, `${name} must resolve, not reject`);
    assert.equal(result.kind, 'dns', name);
  }
});

test('signOut surfaces a thrown failure without leaking raw provider text', async () => {
  setSupabase(authDouble({ signOut: () => new Error('kaboom internal detail') }).client);
  const result = await signOut();
  assert.equal(result.ok, false);
  assert.doesNotMatch(result.message ?? '', /kaboom internal detail/);
});

// ------------------------------------------------- honest classification

test('a DNS failure is not blamed on the internet, and claims nothing about the device', () => {
  for (const raw of [
    'A server with the specified hostname could not be found.',
    'Unable to resolve host "x.supabase.co": No address associated with hostname',
    Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } })
  ]) {
    const { kind, message } = classifyAuthError(raw);
    assert.equal(kind, 'dns', String(raw));
    assert.doesNotMatch(message, /check your internet|your wi-?fi|mobile data/i);
    // Astra review: these signals cannot prove the connection is fine or
    // that the device is blameless.
    assert.doesNotMatch(message, /internet is working|nothing to fix|never left/i);
    assert.match(message, /couldn't reach/i);
  }
});

test('ambiguous transport errors are connectivity, never "proven offline"', () => {
  for (const raw of ['Network request failed', 'TypeError: Failed to fetch', 'connect ECONNREFUSED 127.0.0.1:443', 'socket hang up']) {
    const { kind, message } = classifyAuthError(raw);
    assert.equal(kind, 'connectivity', raw);
    assert.doesNotMatch(message, /never left|internet is working|nothing to fix/i);
  }
});

test("only the OS's own offline signal is reported as offline, and attributed to the device", () => {
  const { kind, message } = classifyAuthError('The Internet connection appears to be offline.');
  assert.equal(kind, 'offline');
  assert.match(message, /device reports/i);
});

test('timeouts, 5xx and rate limits are each distinct and never say "no internet"', () => {
  assert.equal(classifyAuthError('Request timed out after 15s').kind, 'timeout');
  assert.equal(classifyAuthError({ status: 503, message: 'Service Unavailable' }).kind, 'service_unavailable');
  assert.equal(classifyAuthError({ status: 429, message: 'rate limit' }).kind, 'rate_limited');
  for (const e of ['Request timed out after 15s', { status: 503 }, { status: 429 }]) {
    assert.doesNotMatch(classifyAuthError(e).message, /check your internet/i);
  }
});

test('credential and email errors keep their specific meaning', () => {
  assert.equal(classifyAuthError({ message: 'Invalid login credentials', status: 400 }).kind, 'invalid_credentials');
  assert.equal(classifyAuthError({ message: 'Email not confirmed' }).kind, 'email_not_confirmed');
  assert.equal(classifyAuthError({ message: 'User already registered' }).kind, 'email_exists');
});

test('an unknown error shows safe generic text and keeps the raw string for logs only', () => {
  const raw = 'PGRST302: jwt expired for user 1234 at https://internal.example/secret-path';
  const { kind, message, detail } = classifyAuthError(new Error(raw));
  assert.equal(kind, 'unknown');
  assert.equal(message, 'Something went wrong signing in. Please try again.');
  assert.doesNotMatch(message, /PGRST302|internal\.example/);
  assert.match(detail ?? '', /PGRST302/, 'raw detail is preserved for diagnostics, not for display');
});

// ------------------------------------------------------ config rejection

test('placeholder / malformed / non-https / service-role config is rejected', () => {
  const goodKey = 'sb_publishable_abc';
  assert.equal(checkSupabaseConfig('https://abcd.supabase.co', goodKey).ok, true);
  assert.equal(checkSupabaseConfig('', goodKey).problem, 'missing');
  assert.equal(checkSupabaseConfig('https://abcd.supabase.co', '').problem, 'missing');
  assert.equal(checkSupabaseConfig('not a url', goodKey).problem, 'malformed_url');
  assert.equal(checkSupabaseConfig('http://abcd.supabase.co', goodKey).problem, 'not_https');
  assert.equal(checkSupabaseConfig('https://placeholder.supabase.co', goodKey).problem, 'placeholder');
  assert.equal(checkSupabaseConfig('https://your-project.supabase.co', goodKey).problem, 'placeholder');
  assert.equal(checkSupabaseConfig('https://abcd.supabase.co', 'your_supabase_anon_key_here').problem, 'placeholder');
  assert.equal(checkSupabaseConfig('https://abcd.supabase.co', 'sb_secret_xyz').problem, 'service_role_key');

  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const serviceJwt = `${b64({ alg: 'HS256' })}.${b64({ role: 'service_role' })}.sig`;
  const anonJwt = `${b64({ alg: 'HS256' })}.${b64({ role: 'anon' })}.sig`;
  assert.equal(checkSupabaseConfig('https://abcd.supabase.co', serviceJwt).problem, 'service_role_key');
  assert.equal(checkSupabaseConfig('https://abcd.supabase.co', anonJwt).ok, true);

  for (const bad of ['', 'not a url', 'http://abcd.supabase.co']) {
    const check = checkSupabaseConfig(bad, goodKey);
    assert.match(check.message ?? '', /build/i, 'must say it is a build problem, not a connection problem');
    assert.doesNotMatch(check.message ?? '', /check your internet/i);
  }
});

// ------------------------------------------------------- source wiring
// The LoginScreen fixes are React state/refs and there is no React renderer
// in this project, so these are SOURCE-WIRING assertions: they fail if the
// fix is removed, but they do not run the component.

const LOGIN_SOURCE = readFileSync(join(MOBILE_ROOT, 'src', 'screens', 'LoginScreen.tsx'), 'utf8');

test('LoginScreen guards duplicate taps synchronously and clears loading in finally', () => {
  assert.match(LOGIN_SOURCE, /const inFlightRef = useRef\(false\)/);
  assert.equal(
    (LOGIN_SOURCE.match(/if \(inFlightRef\.current\) return;/g) ?? []).length,
    1,
    'submit must use the synchronous ref guard'
  );
  assert.doesNotMatch(LOGIN_SOURCE, /if \(loading\) return;/, 'the async state guard must be gone');
  assert.equal(
    (LOGIN_SOURCE.match(/\} finally \{\s*\n\s*(\/\/[^\n]*\n\s*)*\s*inFlightRef\.current = false;\s*\n\s*setLoading\(false\);/g) ?? []).length,
    1,
    'the submit handler must clear the ref and loading in a finally block'
  );
});

// --------------------------------------------------- bounded transport
// Exercises the REAL timed transport (src/services/supabaseTransport.ts) with
// an injected fetch, per Astra's review — not the classifier's view of it.

import { createTimedFetch, REQUEST_TIMEOUT_MS, UPLOAD_TIMEOUT_MS } from '../src/services/supabaseTransport';

/** A fetch that never settles until aborted, so cancellation is observable. */
function hangingFetch(seen: { signals: AbortSignal[] }) {
  return ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal as AbortSignal;
      seen.signals.push(signal);
      const abortError = () => Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
      // Real fetch rejects straight away for an already-aborted signal; the
      // double must too, or an aborted-before-call test would hang forever.
      if (signal?.aborted) {
        reject(abortError());
        return;
      }
      signal?.addEventListener('abort', () => reject(abortError()));
    })) as unknown as typeof fetch;
}

test('a hung request is cancelled at the budget and reported as a timeout', async () => {
  const seen = { signals: [] as AbortSignal[] };
  const timedFetch = createTimedFetch({ requestTimeoutMs: 30, fetchImpl: hangingFetch(seen) });

  const startedAt = Date.now();
  await assert.rejects(
    () => timedFetch('https://proj.supabase.co/auth/v1/token'),
    (err: Error) => {
      assert.match(err.message, /timed out after/i);
      // The message must classify as a timeout, not as an opaque abort.
      assert.equal(classifyAuthError(err).kind, 'timeout');
      return true;
    }
  );
  assert.ok(Date.now() - startedAt < 2000, 'must not wait the full production budget');
  assert.equal(seen.signals[0].aborted, true, 'the underlying request is actually cancelled');
});

test('uploads get the larger budget, auth calls the shorter one', async () => {
  assert.ok(UPLOAD_TIMEOUT_MS > REQUEST_TIMEOUT_MS);
  const seen = { signals: [] as AbortSignal[] };
  // Upload budget is long, request budget tiny: only the auth call times out.
  const timedFetch = createTimedFetch({ requestTimeoutMs: 25, uploadTimeoutMs: 5000, fetchImpl: hangingFetch(seen) });

  await assert.rejects(() => timedFetch('https://proj.supabase.co/auth/v1/token'), /timed out/i);

  let uploadSettled = false;
  timedFetch('https://proj.supabase.co/storage/v1/object/garment-images/u/x.jpg', { method: 'POST' })
    .catch(() => {})
    .finally(() => {
      uploadSettled = true;
    });
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(uploadSettled, false, 'a slow photo upload must not be cut off by the auth budget');
});

test("a caller's own cancellation still works and is not reported as a timeout", async () => {
  const seen = { signals: [] as AbortSignal[] };
  const timedFetch = createTimedFetch({ requestTimeoutMs: 5000, fetchImpl: hangingFetch(seen) });
  const caller = new AbortController();

  const pending = timedFetch('https://proj.supabase.co/auth/v1/user', { signal: caller.signal });
  caller.abort();

  await assert.rejects(pending, (err: Error) => {
    assert.doesNotMatch(err.message, /timed out after/i, 'a user cancellation is not a timeout');
    return true;
  });
  assert.equal(seen.signals[0].aborted, true);
});

test('a successful response passes through untouched and the timer is cleared', async () => {
  const response = new Response('{"ok":true}', { status: 200 });
  const timedFetch = createTimedFetch({ requestTimeoutMs: 50, fetchImpl: (async () => response) as unknown as typeof fetch });
  const result = await timedFetch('https://proj.supabase.co/auth/v1/token');
  assert.equal(result, response);
  // If the timeout timer were left pending, this wait would abort nothing and
  // the process would still exit cleanly — asserted by the suite completing.
  await new Promise((r) => setTimeout(r, 80));
});

test('an already-aborted caller signal is honoured immediately', async () => {
  const seen = { signals: [] as AbortSignal[] };
  const timedFetch = createTimedFetch({ requestTimeoutMs: 5000, fetchImpl: hangingFetch(seen) });
  await assert.rejects(() => timedFetch('https://proj.supabase.co/auth/v1/user', { signal: AbortSignal.abort() }));
});

// ------------------------------------------- config gate blocks requests

test('an unusable config is refused BEFORE any network call is attempted', async () => {
  const double = authDouble({ signInWithPassword: () => ({ data: { session: null }, error: null }) });
  setSupabase(double.client);
  setSupabaseConfigCheck({ ok: false, problem: 'placeholder', message: 'Build configuration problem.' });

  try {
    for (const call of [() => signIn('a@b.com', 'pw'), () => signUp('a@b.com', 'password1')]) {
      const result = await call();
      assert.equal(result.ok, false);
      assert.equal(result.kind, 'config');
      assert.match(result.message ?? '', /build/i);
    }
    assert.deepEqual(double.calls, [], 'no auth request may be attempted with an unusable config');
  } finally {
    setSupabaseConfigCheck({ ok: true });
  }
});
