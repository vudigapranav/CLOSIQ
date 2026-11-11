import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

// Auth is mocked by pointing Supabase at nothing: getAuthenticatedUserId then
// returns null, so we stub it through a module-level env-free approach below.
process.env.GEMINI_API_KEY = 'test-key';
const { handleApiRequest, MAX_BODY_BYTES } = await import('../apiRouter.js');
const { resetRateLimits } = await import('../rateLimit.js');

function fakeRes() {
  return { statusCode: 200, headers: {}, body: '', setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b || ''; } };
}
function fakeReq(url, { body, headers = {}, method = 'POST' } = {}) {
  const req = new EventEmitter();
  Object.assign(req, { url, method, headers: { authorization: 'Bearer x', ...headers }, body });
  return req;
}

test('without Supabase configured, requests fail closed with 401', async () => {
  const res = fakeRes();
  await handleApiRequest(fakeReq('/api/ai/generate-outfit', { body: {} }), res);
  assert.equal(res.statusCode, 401);
});

test('non-api paths fall through, wrong method is 405', async () => {
  assert.equal(await handleApiRequest(fakeReq('/foo'), fakeRes()), false);
  const res = fakeRes();
  await handleApiRequest(fakeReq('/api/ai/generate-outfit', { method: 'GET' }), res);
  assert.equal(res.statusCode, 405);
});

// The remaining tests need an authenticated user; run them in a child process
// with the auth module stubbed via a loader-free approach: re-import with a
// mocked authVerify using node:test's module mock.
test('413 / 429 / 400 with auth stubbed', async (t) => {
  const mod = t.mock.module('../authVerify.js', {
    namedExports: { getAuthenticatedUserId: async () => 'user-1', clearAuthCache() {} }
  });
  const fresh = await import('../apiRouter.js?stubbed');
  resetRateLimits();

  // 400: invalid input from a handler (empty body => prompt required)
  let res = fakeRes();
  await fresh.handleApiRequest(fakeReq('/api/ai/generate-outfit', { body: { prompt: 'hi', wardrobe: [{ id: 'bad id' }] } }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.body).errorKind, 'invalid_input');

  // 413: oversized streamed body
  resetRateLimits();
  res = fakeRes();
  const req = fakeReq('/api/ai/generate-outfit');
  const p = fresh.handleApiRequest(req, res);
  await new Promise((r) => setImmediate(r));
  req.emit('data', Buffer.alloc(MAX_BODY_BYTES + 1));
  await p;
  assert.equal(res.statusCode, 413);

  // 413: declared content-length
  resetRateLimits();
  res = fakeRes();
  await fresh.handleApiRequest(fakeReq('/api/ai/generate-outfit', { headers: { 'content-length': String(MAX_BODY_BYTES + 5) } }), res);
  assert.equal(res.statusCode, 413);

  // 429: studio-photo costs 3 of 10 -> 4th call is limited
  resetRateLimits();
  let last;
  for (let i = 0; i < 4; i += 1) {
    last = fakeRes();
    await fresh.handleApiRequest(fakeReq('/api/ai/studio-photo', { body: { imageData: '' } }), last);
  }
  assert.equal(last.statusCode, 429);
  assert.equal(JSON.parse(last.body).errorKind, 'rate_limited');
  assert.ok(Number(last.headers['Retry-After']) >= 1);
  mod.restore();
});
