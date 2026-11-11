import {
  handleAnalyzeGarmentServer,
  handleGenerateOutfitServer,
  handleSwapGarmentServer
} from './geminiServer.js';
import { handleStudioPhotoServer } from './studioPhoto.js';
import { getAuthenticatedUserId } from './authVerify.js';
import { consumeRateLimit } from './rateLimit.js';

/**
 * Shared /api/ai/* request dispatch — the one place that knows how to turn a
 * raw Node http.IncomingMessage/ServerResponse pair into a Gemini call.
 * Used by both Vite's dev middleware (vite.config.js) and the production
 * server (server/index.js) so the two run identical routing/error-handling,
 * not two hand-maintained copies of the same logic.
 */

const ROUTES = {
  '/api/ai/analyze-garment': handleAnalyzeGarmentServer,
  '/api/ai/generate-outfit': handleGenerateOutfitServer,
  '/api/ai/swap-garment': handleSwapGarmentServer,
  '/api/ai/studio-photo': handleStudioPhotoServer
};

// Max request body (~6 MB: a ~4.5 MB photo as base64 plus JSON overhead).
export const MAX_BODY_BYTES = 6 * 1024 * 1024;
// Rate-limit cost per route (default 1); studio photo is CPU-heavy.
const ROUTE_COST = { '/api/ai/studio-photo': 3 };

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function tooLarge() {
  return new HttpError(413, 'Request body too large');
}

function readJsonBody(req) {
  // Vercel's Node runtime parses JSON bodies itself and drains the stream,
  // exposing the result as req.body; plain Node / Vite leave it to us.
  if (req.body !== undefined) {
    if (typeof req.body === 'string') {
      if (Buffer.byteLength(req.body) > MAX_BODY_BYTES) return Promise.reject(tooLarge());
      try {
        return Promise.resolve(req.body ? JSON.parse(req.body) : {});
      } catch {
        return Promise.reject(new HttpError(400, 'Malformed JSON body'));
      }
    }
    return Promise.resolve(req.body && typeof req.body === 'object' ? req.body : {});
  }
  const declared = Number(req.headers?.['content-length']);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return Promise.reject(tooLarge());
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let rejected = false;
    req.on('data', (chunk) => {
      if (rejected) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        rejected = true;
        chunks.length = 0;
        reject(tooLarge());
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (rejected) return;
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new HttpError(400, 'Malformed JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Handles the request if its path starts with /api/ai/ (writing a response
 * and returning true). Returns false for anything else so the caller can
 * fall through to its own next step (Vite's `next()`, or static file
 * serving in the production server).
 */
export async function handleApiRequest(req, res) {
  const url = req.url ? req.url.split('?')[0] : '';
  if (!url.startsWith('/api/ai/')) return false;

  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    return true;
  }

  const handler = ROUTES[url];
  if (!handler) {
    res.statusCode = 404;
    res.end(JSON.stringify({ ok: false, error: 'Endpoint not found' }));
    return true;
  }

  // Sprint M17: every /api/ai/* call must carry a valid Supabase session.
  // The user id itself isn't used below (these three endpoints are
  // stateless Gemini proxies with nothing server-side to scope by) — this
  // is purely an authentication gate, verified from the token itself, never
  // from anything the client claims. Fails closed: a request with no
  // token, an invalid token, or a server with Supabase unconfigured are all
  // rejected the same way, never treated as "unauthenticated = allowed."
  const authenticatedUserId = await getAuthenticatedUserId(req);
  if (!authenticatedUserId) {
    res.statusCode = 401;
    res.end(JSON.stringify({ ok: false, error: 'Authentication required' }));
    return true;
  }

  // Per-user rate limit: after auth, before the body is read or parsed.
  const limit = consumeRateLimit(authenticatedUserId, ROUTE_COST[url] || 1);
  if (!limit.allowed) {
    res.statusCode = 429;
    res.setHeader('Retry-After', String(limit.retryAfterSec));
    res.end(JSON.stringify({ ok: false, errorKind: 'rate_limited', error: 'Too many requests — try again in a moment.' }));
    return true;
  }

  try {
    const json = await readJsonBody(req);
    const result = await handler(json);
    if (result && result.errorKind === 'invalid_input') res.statusCode = 400;
    res.end(JSON.stringify(result));
  } catch (err) {
    if (err instanceof HttpError) {
      res.statusCode = err.status;
      res.end(JSON.stringify({ ok: false, errorKind: err.status === 413 ? 'too_large' : 'invalid_input', error: err.message }));
      if (err.status === 413) req.resume?.();
      return true;
    }
    // Deliberately generic — never forward internal error detail (stack
    // traces, provider response bodies) to the browser.
    console.error('[API Router Error]:', err?.message || err);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: 'Server error processing request' }));
  }
  return true;
}
