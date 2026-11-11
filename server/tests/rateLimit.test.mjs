import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeRateLimit, resetRateLimits, rateLimitSize } from '../rateLimit.js';

test('burst then block then refill', () => {
  resetRateLimits();
  const t0 = 1_000_000;
  for (let i = 0; i < 10; i += 1) assert.equal(consumeRateLimit('u', 1, t0).allowed, true);
  const blocked = consumeRateLimit('u', 1, t0);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSec >= 1);
  assert.equal(consumeRateLimit('u', 1, t0 + 3100).allowed, true); // 20/min => 1 per 3s
});

test('cost and per-user isolation', () => {
  resetRateLimits();
  assert.equal(consumeRateLimit('a', 3, 0).allowed, true);
  assert.equal(consumeRateLimit('a', 3, 0).allowed, true);
  assert.equal(consumeRateLimit('a', 3, 0).allowed, true);
  assert.equal(consumeRateLimit('a', 3, 0).allowed, false);
  assert.equal(consumeRateLimit('b', 3, 0).allowed, true);
});

test('map is bounded', () => {
  resetRateLimits();
  for (let i = 0; i < 6000; i += 1) consumeRateLimit(`u${i}`, 1, 0);
  assert.ok(rateLimitSize() <= 5000);
});
