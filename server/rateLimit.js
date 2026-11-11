/**
 * In-memory per-user token bucket.
 *
 * NOTE: state lives in process memory. On Vercel (serverless) each warm
 * instance has its own bucket and cold starts reset it, so this is a
 * BEST-EFFORT guard against runaway clients and loops, not a hard global
 * quota. On the plain-Node server (one process) it is exact.
 */
export const RATE_LIMIT = { capacity: 10, refillPerMinute: 20 };
const MAX_BUCKETS = 5000;
const buckets = new Map(); // userId -> { tokens, updatedAt }

/**
 * Tries to spend `cost` tokens for `key`.
 * Returns { allowed: true } or { allowed: false, retryAfterSec }.
 */
export function consumeRateLimit(key, cost = 1, now = Date.now(), opts = RATE_LIMIT) {
  const refillPerMs = opts.refillPerMinute / 60_000;
  let bucket = buckets.get(key);
  if (bucket) {
    bucket.tokens = Math.min(opts.capacity, bucket.tokens + (now - bucket.updatedAt) * refillPerMs);
    bucket.updatedAt = now;
    buckets.delete(key); // re-insert so Map order tracks recency
  } else {
    bucket = { tokens: opts.capacity, updatedAt: now };
    if (buckets.size >= MAX_BUCKETS) {
      // Evict the least recently used entry (first in insertion order).
      buckets.delete(buckets.keys().next().value);
    }
  }
  buckets.set(key, bucket);
  const need = Math.min(cost, opts.capacity);
  if (bucket.tokens >= need) {
    bucket.tokens -= need;
    return { allowed: true };
  }
  const retryAfterSec = Math.max(1, Math.ceil((need - bucket.tokens) / refillPerMs / 1000));
  return { allowed: false, retryAfterSec };
}

export function resetRateLimits() {
  buckets.clear();
}

export function rateLimitSize() {
  return buckets.size;
}
