import {
  handleAnalyzeGarmentServer,
  handleGenerateOutfitServer,
  handleSwapGarmentServer
} from './geminiServer.js';
import { getAuthenticatedUserId } from './authVerify.js';

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
  '/api/ai/swap-garment': handleSwapGarmentServer
};

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Malformed JSON body'));
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

  try {
    const json = await readJsonBody(req);
    const result = await handler(json);
    res.end(JSON.stringify(result));
  } catch (err) {
    // Deliberately generic — never forward internal error detail (stack
    // traces, provider response bodies) to the browser.
    console.error('[API Router Error]:', err?.message || err);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: 'Server error processing request' }));
  }
  return true;
}
