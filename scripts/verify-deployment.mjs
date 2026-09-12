#!/usr/bin/env node
/**
 * Post-deploy verification for the CLOSIQ backend — makes ZERO Gemini calls
 * and needs no credentials. Usage (from the repo root):
 *
 *   node scripts/verify-deployment.mjs https://api.example.com
 *   node scripts/verify-deployment.mjs http://localhost:3000 --allow-http   # local only
 *
 * Checks: HTTPS + TLS, http→https behaviour, /healthz (configuration
 * presence), the /api/ai auth gate (401 without a token — rejected before any
 * Gemini handler runs), method gating, every catalog image under
 * public/wardrobe served as real WebP, and path traversal. Exit 1 on failure.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith('--')) || '').replace(/\/+$/, '');
const allowHttp = args.includes('--allow-http');
if (!base) {
  console.error('Usage: node scripts/verify-deployment.mjs <baseUrl> [--allow-http]');
  process.exit(2);
}

const failures = [];
const warnings = [];
const ok = (msg) => console.log(`  PASS  ${msg}`);
const fail = (msg) => {
  failures.push(msg);
  console.log(`  FAIL  ${msg}`);
};
const warn = (msg) => {
  warnings.push(msg);
  console.log(`  WARN  ${msg}`);
};

async function req(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(url, { redirect: 'manual', ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

console.log(`CLOSIQ deployment check → ${base}\n`);

// 1. Transport
const u = new URL(base);
if (u.protocol === 'https:') ok('base URL is https');
else if (allowHttp) warn('base URL is http (allowed with --allow-http; a release build will refuse it)');
else fail('base URL must be https (release builds block cleartext; the EAS release gate rejects it)');

if (u.protocol === 'https:') {
  try {
    const r = await req(`http://${u.host}/healthz`);
    const loc = r.headers.get('location') || '';
    if (r.status >= 300 && r.status < 400 && loc.startsWith('https://')) ok(`http:// redirects to https (${r.status})`);
    else warn(`http:// answered ${r.status} without redirecting to https — enable HTTPS-only/redirect at the host`);
  } catch {
    ok('http:// is not served (connection refused/closed)');
  }
}

// 2. Health
try {
  const r = await req(`${base}/healthz`);
  const body = await r.json().catch(() => null);
  if (r.status === 200 && body?.ok === true) ok(`/healthz 200 (version ${body.version}${body.commit ? `, commit ${body.commit}` : ''})`);
  else fail(`/healthz returned ${r.status}`);
  if (body) {
    if (body.supabaseConfigured === true) ok('server reports Supabase auth configured');
    else fail('server reports Supabase auth NOT configured — every /api/ai call will 401');
    if (body.geminiConfigured === true) ok('server reports GEMINI_API_KEY configured');
    else warn('server reports GEMINI_API_KEY missing — AI features will use the local engine');
  }
  if (u.protocol === 'https:' && !r.headers.get('strict-transport-security')) {
    warn('no Strict-Transport-Security header (set HSTS at the host/proxy if supported)');
  }
} catch (err) {
  fail(`/healthz unreachable: ${err.message}`);
}

// 3. Auth gate + method gating (no Gemini spend: rejected before the handler)
try {
  const r = await req(`${base}/api/ai/generate-outfit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  if (r.status === 401) ok('POST /api/ai/generate-outfit without a token → 401 (auth gate live)');
  else fail(`POST /api/ai/generate-outfit without a token → ${r.status} (expected 401)`);
} catch (err) {
  fail(`/api/ai unreachable: ${err.message}`);
}
try {
  const r = await req(`${base}/api/ai/generate-outfit`);
  if (r.status === 405) ok('GET /api/ai/generate-outfit → 405');
  else fail(`GET /api/ai/generate-outfit → ${r.status} (expected 405)`);
} catch (err) {
  fail(`method check failed: ${err.message}`);
}

// 4. Catalog images: every WebP shipped in public/wardrobe must be served.
const wardrobeDir = path.resolve(import.meta.dirname, '..', 'public', 'wardrobe');
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs);
    else if (e.name.endsWith('.webp')) files.push('/' + path.relative(path.resolve(wardrobeDir, '..'), abs).split(path.sep).join('/'));
  }
})(wardrobeDir);

let served = 0;
const badImages = [];
const queue = [...files];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const p = queue.shift();
      try {
        const r = await req(`${base}${p}`);
        const buf = Buffer.from(await r.arrayBuffer());
        const isWebp = buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP';
        if (r.status === 200 && (r.headers.get('content-type') || '').startsWith('image/webp') && isWebp) served += 1;
        else badImages.push(`${p} → ${r.status} ${r.headers.get('content-type')}`);
      } catch (err) {
        badImages.push(`${p} → ${err.message}`);
      }
    }
  })
);
if (files.length > 0 && badImages.length === 0) ok(`all ${served}/${files.length} catalog images served as real WebP`);
else fail(`${badImages.length}/${files.length} catalog images not served correctly:\n        ${badImages.slice(0, 10).join('\n        ')}`);

// 5. Path traversal must not expose server source.
try {
  const r = await req(`${base}/..%2fserver%2findex.js`);
  const text = await r.text();
  if (text.includes('handleApiRequest')) fail('path traversal exposed server source');
  else ok(`path traversal blocked (${r.status})`);
} catch (err) {
  warn(`path traversal check inconclusive: ${err.message}`);
}

console.log(`\n${failures.length ? 'FAILED' : 'PASSED'} — ${failures.length} failure(s), ${warnings.length} warning(s)`);
process.exit(failures.length ? 1 : 0);
