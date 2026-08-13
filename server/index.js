import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from './apiRouter.js';

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

const server = http.createServer(async (req, res) => {
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
  console.log(`[CLOSIQ Server] Listening on http://localhost:${PORT}`);
  console.log(
    `[CLOSIQ Server] Gemini mode: ${keyConfigured ? 'LIVE (GEMINI_API_KEY configured)' : 'DEMO (no GEMINI_API_KEY set — real Gemini endpoints will report demo fallback until one is configured)'}`
  );
});
