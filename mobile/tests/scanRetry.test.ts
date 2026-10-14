/**
 * Free-tier Gemini sometimes refuses for a moment when Google is busy
 * (2026-10-14: a scan failed after 4-5 good ones). A failed scan is retried
 * once, quietly — but never when a retry can't help (offline, signed out).
 */
import './helpers/installMocks';
import { setSupabase } from './helpers/installMocks';
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeGarmentImageMobile, scanRetry } from '../src/services/visionAnalysis';

setSupabase({
  auth: { getSession: async () => ({ data: { session: { access_token: 'token' } }, error: null }) }
});
scanRetry.delayMs = 0;

function sequence(responses: (() => unknown)[]) {
  let calls = 0;
  globalThis.fetch = (async () => {
    const next = responses[Math.min(calls, responses.length - 1)];
    calls += 1;
    return next();
  }) as unknown as typeof fetch;
  return () => calls;
}
const json = (status: number, body: unknown) => () => ({ status, ok: status >= 200 && status < 300, json: async () => body });

test('a busy AI is retried once and the second answer is used', async () => {
  const calls = sequence([
    json(200, { ok: false, mode: 'demo', errorKind: 'unavailable' }),
    json(200, { ok: true, mode: 'gemini', data: { name: 'Chalk White Cotton Shirt', category: 'tops' } })
  ]);

  const outcome = await analyzeGarmentImageMobile('b64');

  assert.equal(calls(), 2);
  assert.equal(outcome.ok && outcome.data.name, 'Chalk White Cotton Shirt');
});

test('two failures in a row fall through to manual entry (no endless retrying)', async () => {
  const calls = sequence([json(503, { ok: false })]);
  const outcome = await analyzeGarmentImageMobile('b64');
  assert.equal(calls(), 2);
  assert.equal(outcome.ok, false);
});

test('offline or signed-out scans are not retried', async () => {
  let calls = sequence([() => Promise.reject(new TypeError('Network request failed'))]);
  assert.equal((await analyzeGarmentImageMobile('b64')).ok, false);
  assert.equal(calls(), 1, 'offline: a retry cannot help');

  calls = sequence([json(401, { ok: false })]);
  assert.equal((await analyzeGarmentImageMobile('b64')).ok, false);
  assert.equal(calls(), 1, 'signed out: a retry cannot help');
});
