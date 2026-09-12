/**
 * Sprint M20 — timeouts, honest failure states, session restore, and
 * release/server environment validation.
 */
import './helpers/installMocks';
import { setSupabase } from './helpers/installMocks';
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { AuthRetryableFetchError, AuthApiError } from '@supabase/supabase-js';
import { MOBILE_ROOT } from './helpers/sourcePaths';

import { postApi } from '../src/services/apiRequest';
import { analyzeGarmentImageMobile } from '../src/services/visionAnalysis';
import { generateOutfitMobile } from '../src/services/outfitStylist';
import { restoreSession } from '../src/services/authService';
import { GarmentItem } from '../../src/types/wardrobe';

// A signed-in session, so getAuthHeader() resolves without a network call.
setSupabase({
  auth: { getSession: async () => ({ data: { session: { access_token: 'token' } }, error: null }) }
});

type FetchImpl = (url: string, init: { signal?: AbortSignal }) => Promise<unknown>;
function withFetch(impl: FetchImpl) {
  globalThis.fetch = impl as unknown as typeof fetch;
}
function jsonResponse(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

// ---------------------------------------------------------------- timeouts

test('a request that never answers times out instead of spinning forever', async () => {
  withFetch(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      })
  );
  const started = Date.now();
  const result = await postApi('/api/ai/generate-outfit', {}, 50);
  assert.deepEqual(result, { ok: false, reason: 'timeout' });
  assert.ok(Date.now() - started < 2000);
});

test('each failure is classified distinctly', async () => {
  const cases: [() => Promise<unknown>, string][] = [
    [async () => { throw new TypeError('Network request failed'); }, 'offline'],
    [async () => jsonResponse(401, { ok: false }), 'unauthorized'],
    [async () => jsonResponse(429, { ok: false }), 'rate_limited'],
    [async () => jsonResponse(502, { ok: false }), 'server_error'],
    // The server answers 200 with the Gemini failure described in errorKind.
    [async () => jsonResponse(200, { ok: false, errorKind: 'rate_limited' }), 'rate_limited'],
    [async () => jsonResponse(200, { ok: false, errorKind: 'timeout' }), 'timeout'],
    [async () => jsonResponse(200, { ok: false, errorKind: 'not_configured' }), 'ai_unavailable']
  ];
  for (const [impl, expected] of cases) {
    withFetch(impl as FetchImpl);
    const result = await postApi('/api/ai/analyze-garment', {});
    assert.equal(result.ok, false);
    assert.equal((result as { reason: string }).reason, expected);
  }
});

// ---------------------------------------------------- vision: no invention

test('a failed vision analysis is reported as a failure — no invented attributes or confidence', async () => {
  withFetch(async () => jsonResponse(200, { ok: false, errorKind: 'rate_limited' }));
  const outcome = await analyzeGarmentImageMobile('b64', 'image/jpeg', 'tops');

  assert.equal(outcome.ok, false, 'used to be ok:true with a fabricated "Charcoal / Cotton Blend / 88%" result');
  assert.equal('data' in outcome, false, 'a failure must carry no garment data to pre-fill');
  assert.match((outcome as { message: string }).message, /rate limit/i);
});

test('a real analysis never gains a confidence score the model did not return', async () => {
  withFetch(async () => jsonResponse(200, { ok: true, mode: 'gemini', data: { name: 'Oxford shirt', category: 'tops' } }));
  const outcome = await analyzeGarmentImageMobile('b64');
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.data.aiConfidence, undefined, 'used to default to an invented 92');
  assert.equal(outcome.data.pairingNotes, '', 'used to default to an invented stylist note');
  assert.equal(outcome.data.name, 'Oxford shirt');
});

test("a model-provided confidence is kept as the model's", async () => {
  withFetch(async () => jsonResponse(200, { ok: true, data: { name: 'x', aiConfidence: 71 } }));
  const outcome = await analyzeGarmentImageMobile('b64');
  assert.equal(outcome.ok && outcome.data.aiConfidence, 71);
});

// ------------------------------------------ outfit fallback says why

test('a local-engine outfit carries the reason Gemini was not used', async () => {
  withFetch(async () => jsonResponse(401, { ok: false }));
  const wardrobe = [
    { id: 't', name: 'Tee', category: 'tops', color: 'white' },
    { id: 'b', name: 'Jeans', category: 'bottoms', color: 'blue' }
  ] as GarmentItem[];

  const res = await generateOutfitMobile('brunch', wardrobe);

  assert.equal(res.mode, 'fallback');
  assert.match(res.notice ?? '', /session has expired/i);
  assert.match(res.notice ?? '', /local engine/i);
});

// ------------------------------------------------------ session restore

test('offline restore with a stored session is distinguished from being signed out', async () => {
  setSupabase({
    auth: { getSession: async () => ({ data: { session: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) }) }
  });
  assert.deepEqual(await restoreSession(), { session: null, restoreFailed: true });
});

test('a revoked/invalid refresh token is a genuine sign-out, not a restore failure', async () => {
  setSupabase({
    auth: {
      getSession: async () => ({
        data: { session: null },
        error: new AuthApiError('Invalid Refresh Token: Refresh Token Not Found', 400, 'refresh_token_not_found')
      })
    }
  });
  assert.deepEqual(await restoreSession(), { session: null, restoreFailed: false });
});

test('no stored session at all is a plain signed-out state', async () => {
  setSupabase({ auth: { getSession: async () => ({ data: { session: null }, error: null }) } });
  assert.deepEqual(await restoreSession(), { session: null, restoreFailed: false });
});

// ------------------------------------------- release env (mobile build gate)

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { validateReleaseEnv } = require(join(MOBILE_ROOT, 'scripts', 'validate-release-env.js')) as {
  validateReleaseEnv: (env: Record<string, string>) => string[];
};

const GOOD = {
  EXPO_PUBLIC_API_URL: 'https://api.closiq.app',
  EXPO_PUBLIC_SUPABASE_URL: 'https://abcd.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_abc123'
};

function jwt(payload: object) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.sig`;
}

test('a valid release configuration passes', () => {
  assert.deepEqual(validateReleaseEnv(GOOD), []);
  assert.deepEqual(validateReleaseEnv({ ...GOOD, EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt({ role: 'anon' }) }), []);
});

test('the release gate rejects LAN, localhost, http, the .invalid placeholder, and missing values', () => {
  const bad = [
    { ...GOOD, EXPO_PUBLIC_API_URL: 'http://192.168.31.215:3000' },
    { ...GOOD, EXPO_PUBLIC_API_URL: 'https://localhost:3000' },
    { ...GOOD, EXPO_PUBLIC_API_URL: 'https://10.0.0.5' },
    { ...GOOD, EXPO_PUBLIC_API_URL: 'https://closiq-backend-not-yet-deployed.invalid' },
    { ...GOOD, EXPO_PUBLIC_SUPABASE_URL: 'https://your-project.supabase.co' },
    { ...GOOD, EXPO_PUBLIC_API_URL: '' }
  ];
  for (const env of bad) assert.ok(validateReleaseEnv(env).length > 0, JSON.stringify(env));
});

test('the release gate refuses a service-role key or any EXPO_PUBLIC_ secret', () => {
  assert.ok(validateReleaseEnv({ ...GOOD, EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt({ role: 'service_role' }) }).length > 0);
  assert.ok(validateReleaseEnv({ ...GOOD, EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_xyz' }).length > 0);
  assert.ok(validateReleaseEnv({ ...GOOD, EXPO_PUBLIC_GEMINI_API_KEY: 'k' }).length > 0);
});

// --------------------------------------------- server env + Gemini errors

// Node 22.12+ can require() an ES module synchronously (server/ is ESM).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { checkServerEnv } = require(join(MOBILE_ROOT, '..', 'server', 'envCheck.js')) as {
  checkServerEnv: (env: Record<string, string>) => { errors: string[]; warnings: string[]; isProduction: boolean };
};

test('a production server without Supabase config reports blocking errors', () => {
  const r = checkServerEnv({ NODE_ENV: 'production', GEMINI_API_KEY: 'g' });
  assert.equal(r.isProduction, true);
  assert.equal(r.errors.length, 2);
});

test('a complete production server config has no errors; a missing Gemini key only warns', () => {
  const env = { NODE_ENV: 'production', SUPABASE_URL: 'https://abcd.supabase.co', SUPABASE_ANON_KEY: 'k' };
  const r = checkServerEnv(env);
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.length, 1);
});

test('an http Supabase URL blocks production but only warns in development', () => {
  const base = { SUPABASE_URL: 'http://abcd.supabase.co', SUPABASE_ANON_KEY: 'k', GEMINI_API_KEY: 'g' };
  assert.equal(checkServerEnv({ ...base, NODE_ENV: 'production' }).errors.length, 1);
  assert.equal(checkServerEnv({ ...base, NODE_ENV: 'development' }).errors.length, 0);
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { classifyGeminiError } = require(join(MOBILE_ROOT, '..', 'server', 'geminiServer.js')) as {
  classifyGeminiError: (err: unknown) => string;
};

test('Gemini failures are classified without leaking provider detail', () => {
  assert.equal(classifyGeminiError({ status: 429, message: 'x' }), 'rate_limited');
  assert.equal(classifyGeminiError({ message: '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}' }), 'rate_limited');
  assert.equal(classifyGeminiError({ name: 'AbortError', message: 'This operation was aborted' }), 'timeout');
  assert.equal(classifyGeminiError({ status: 500, message: 'internal' }), 'unavailable');
});
