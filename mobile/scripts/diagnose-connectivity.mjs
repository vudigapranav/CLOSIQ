#!/usr/bin/env node
/**
 * CLOSIQ connectivity diagnostics (login repair, 2026-09-12).
 *
 *   cd mobile && npm run diagnose
 *
 * Answers the question the phone can't: is sign-in failing because of the
 * device's network, because the Supabase host doesn't resolve, or because
 * the service/backend is down? Read-only: it resolves DNS, GETs public
 * health endpoints, and makes NO authenticated call, NO cloud mutation, NO
 * account creation and NO Gemini call.
 *
 * SECRET SAFETY: it never prints (or sends) the anon key — only whether one
 * is present and its length. Hostnames are printed because they are public
 * (they ship inside the app bundle) and are the whole point of the check.
 */
import dns from 'node:dns/promises';

const API_URL = process.env.EXPO_PUBLIC_API_URL || '';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const TIMEOUT_MS = 10_000;
let failures = 0;
let warnings = 0;
const pass = (m) => console.log(`  PASS  ${m}`);
const warn = (m) => { warnings += 1; console.log(`  WARN  ${m}`); };
const fail = (m) => { failures += 1; console.log(`  FAIL  ${m}`); };

async function timedFetch(url, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'manual', headers });
    return { res, ms: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
}

async function checkDns(label, host) {
  try {
    const records = await dns.lookup(host, { all: true });
    pass(`${label} DNS resolves (${host} → ${records.length} address(es))`);
    return true;
  } catch (err) {
    fail(`${label} DNS does NOT resolve (${host}) — ${err.code || err.message}`);
    return false;
  }
}

console.log('CLOSIQ connectivity diagnostics\n');

// 1. Configuration presence (never values)
console.log('Configuration');
if (SUPABASE_URL) pass(`EXPO_PUBLIC_SUPABASE_URL set (${SUPABASE_URL})`);
else fail('EXPO_PUBLIC_SUPABASE_URL is not set');
if (ANON_KEY) pass(`EXPO_PUBLIC_SUPABASE_ANON_KEY present (${ANON_KEY.length} chars, value not shown)`);
else fail('EXPO_PUBLIC_SUPABASE_ANON_KEY is not set');
if (API_URL) pass(`EXPO_PUBLIC_API_URL set (${API_URL})`);
else warn('EXPO_PUBLIC_API_URL is not set — AI features and seed images will not load');

// 2. DNS — the failure the phone reported
console.log('\nDNS');
let supabaseHost = null;
if (SUPABASE_URL) {
  try {
    supabaseHost = new URL(SUPABASE_URL).hostname;
  } catch {
    fail(`EXPO_PUBLIC_SUPABASE_URL is not a valid URL`);
  }
}
const controlResolves = await checkDns('Control (supabase.com)', 'supabase.com');
let projectResolves = false;
if (supabaseHost) projectResolves = await checkDns('Supabase project', supabaseHost);
if (controlResolves && !projectResolves) {
  console.log(
    '\n  → supabase.com resolves but the project host does not. That points at the\n' +
      '    project itself (paused/deleted) or a wrong URL — not at general DNS.\n' +
      '    A paused Supabase project stops resolving until it is restored.'
  );
} else if (!controlResolves && !projectResolves) {
  console.log('\n  → Neither host resolves: DNS itself is failing here (network, VPN or captive portal).');
}

// 3. Supabase health (public endpoint, no auth, no mutation)
console.log('\nSupabase service');
if (projectResolves && SUPABASE_URL) {
  try {
    // The anon key is sent as a header so the health check is meaningful
    // (without it the edge answers 401 for any project, healthy or not).
    // It is never printed, and this is a read-only GET: no auth attempt, no
    // account, no mutation.
    const { res, ms } = await timedFetch(
      `${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/health`,
      ANON_KEY ? { apikey: ANON_KEY } : undefined
    );
    if (res.status === 200) {
      pass(`auth service healthy (GET /auth/v1/health → 200 in ${ms}ms)`);
    } else if (res.status === 401) {
      fail(`auth service reachable but rejected the anon key (401 in ${ms}ms) — wrong/rotated key for this project`);
    } else if (res.status === 540 || res.status >= 500) {
      fail(`auth service unavailable (${res.status} in ${ms}ms) — a paused project answers like this`);
    } else {
      warn(`auth service answered ${res.status} in ${ms}ms`);
    }
  } catch (err) {
    fail(`GET /auth/v1/health failed — ${err.name === 'AbortError' ? `timed out after ${TIMEOUT_MS}ms` : err.message}`);
  }
} else {
  warn('skipped — the project host does not resolve');
}

// 4. CLOSIQ backend
console.log('\nCLOSIQ backend');
if (API_URL) {
  try {
    const { res, ms } = await timedFetch(`${API_URL.replace(/\/+$/, '')}/healthz`);
    const body = await res.json().catch(() => null);
    if (res.status === 200 && body?.ok) {
      pass(`GET /healthz → 200 in ${ms}ms (version ${body.version}${body.commit ? `, commit ${body.commit}` : ''})`);
      if (body.supabaseConfigured) pass('backend reports Supabase auth configured');
      else fail('backend reports Supabase auth NOT configured — every /api/ai call will 401');
    } else {
      fail(`GET /healthz → ${res.status}`);
    }
  } catch (err) {
    const why = err.name === 'AbortError' ? `timed out after ${TIMEOUT_MS}ms` : err.message;
    warn(`backend unreachable at ${API_URL} — ${why} (expected if it isn't running or you're off its network)`);
  }
} else {
  warn('skipped — EXPO_PUBLIC_API_URL is not set');
}

console.log(`\n${failures ? 'PROBLEMS FOUND' : 'OK'} — ${failures} failure(s), ${warnings} warning(s)`);
process.exit(failures ? 1 : 0);
