import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from './apiRouter.js';
import { checkServerEnv } from './envCheck.js';

/**
 * Production entry point (`npm run start`, after `npm run build`).
 *
 * The smallest reliable server that can (1) serve the built `dist/`
 * frontend with SPA fallback and (2) expose real /api/ai/* endpoints
 * outside Vite's dev-only middleware — plain Node `http`, no framework.
 * `server/apiRouter.js` / `server/geminiServer.js` are the same modules
 * `npm run dev` uses, so there is exactly one implementation of Gemini
 * behavior regardless of which mode is running.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT) || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const envCheck = checkServerEnv(process.env);
for (const warning of envCheck.warnings) console.warn(`[CLOSIQ Server] WARNING: ${warning}`);
if (envCheck.errors.length > 0) {
  for (const error of envCheck.errors) console.error(`[CLOSIQ Server] CONFIG ERROR: ${error}`);
  if (envCheck.isProduction) {
    console.error('[CLOSIQ Server] Refusing to start in production with invalid configuration.');
    process.exit(1);
  }
  console.error('[CLOSIQ Server] Continuing because NODE_ENV is not "production".');
}

if (!fs.existsSync(DIST_DIR)) {
  console.error(`[CLOSIQ Server] "dist/" not found at ${DIST_DIR}.`);
  console.error('[CLOSIQ Server] Run "npm run build" before "npm run start".');
  process.exit(1);
}

function streamFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) res.statusCode = 404;
    res.end('Not found');
  });
  stream.pipe(res);
}

function serveStatic(req, res) {
  const requestPath = decodeURIComponent(req.url.split('?')[0]);
  // Strip any leading ../ segments so a crafted path can't escape dist/.
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(DIST_DIR, safePath);

  if (!filePath.startsWith(DIST_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      streamFile(filePath, res);
      return;
    }
    // SPA fallback: any other GET (no matching static file, not an API
    // route) resolves to index.html.
    streamFile(path.join(DIST_DIR, 'index.html'), res);
  });
}

// Deployment prep (2026-09-11): version identity for /healthz and logs, so a
// deploy or rollback can be confirmed from outside. The commit comes from
// whichever variable the host sets (none required); never a secret.
const APP_VERSION = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8')
).version;
const GIT_COMMIT =
  process.env.GIT_COMMIT ||
  process.env.RENDER_GIT_COMMIT ||
  process.env.RAILWAY_GIT_COMMIT_SHA ||
  process.env.SOURCE_VERSION ||
  process.env.FLY_IMAGE_REF ||
  null;

/**
 * GET /healthz — liveness plus configuration PRESENCE (booleans only, never
 * values). Makes no Gemini or Supabase call, so hosts can poll it freely.
 */
function handleHealth(req, res) {
  const gemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(
    JSON.stringify({
      ok: true,
      version: APP_VERSION,
      commit: GIT_COMMIT,
      supabaseConfigured: envCheck.errors.length === 0,
      geminiConfigured: gemini,
      uptimeSeconds: Math.round(process.uptime())
    })
  );
}

/**
 * One JSON line per API/health request: method, path, status, duration.
 * Never logs bodies (garment photos), Authorization headers, tokens, or user
 * ids. Static asset requests are not logged (high volume, no signal).
 */
function logRequest(req, res, startedAt) {
  const url = req.url ? req.url.split('?')[0] : '';
  if (!url.startsWith('/api/') && url !== '/healthz') return;
  console.log(
    JSON.stringify({
      t: new Date().toISOString(),
      method: req.method,
      path: url,
      status: res.statusCode,
      ms: Date.now() - startedAt
    })
  );
}

const server = http.createServer(async (req, res) => {
  const startedAt = Date.now();
  res.on('finish', () => logRequest(req, res, startedAt));

  if ((req.method === 'GET' || req.method === 'HEAD') && req.url?.split('?')[0] === '/healthz') {
    handleHealth(req, res);
    return;
  }

  try {
    const handled = await handleApiRequest(req, res);
    if (handled) return;
  } catch (err) {
    console.error('[CLOSIQ Server] Unexpected API routing error:', err?.message || err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Server error' }));
    }
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.end('Method not allowed');
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  const keyConfigured = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'
  );
  console.log(`[CLOSIQ Server] Listening on port ${PORT} (version ${APP_VERSION}${GIT_COMMIT ? `, commit ${GIT_COMMIT}` : ''})`);
  console.log(
    `[CLOSIQ Server] Gemini mode: ${keyConfigured ? 'LIVE (GEMINI_API_KEY configured)' : 'DEMO (no GEMINI_API_KEY set — real Gemini endpoints will report demo fallback until one is configured)'}`
  );
});

// Graceful shutdown: hosts send SIGTERM on every deploy, restart and
// rollback. Stop accepting new connections and let in-flight requests (a
// Gemini call can take up to GEMINI_TIMEOUT_MS = 30s) finish, with a hard
// ceiling so a stuck connection can't block the rollout forever.
const SHUTDOWN_GRACE_MS = 35_000;
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[CLOSIQ Server] ${signal} received — draining in-flight requests (max ${SHUTDOWN_GRACE_MS / 1000}s).`);
  server.close(() => {
    console.log('[CLOSIQ Server] All connections closed. Exiting.');
    process.exit(0);
  });
  server.closeIdleConnections?.();
  setTimeout(() => {
    console.error('[CLOSIQ Server] Grace period elapsed; forcing exit.');
    process.exit(1);
  }, SHUTDOWN_GRACE_MS).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
