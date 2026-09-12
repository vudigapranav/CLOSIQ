#!/usr/bin/env node
/**
 * Sprint M20 — release environment gate for the mobile app.
 *
 * `EXPO_PUBLIC_*` values are inlined into the JS bundle at BUILD time, so a
 * wrong value can only be caught before or during the build — at runtime
 * it's too late (a store build pointed at a LAN IP or at config.ts's
 * deliberately-unreachable `.invalid` placeholder ships silently broken:
 * no AI, no seed images).
 *
 * Runs automatically on EAS via the `eas-build-pre-install` npm hook, and
 * enforces only for the `preview` and `production` profiles (development
 * builds legitimately use a LAN IP). Run it locally before a release with:
 *   npm run check:release-env
 * which enforces unconditionally against the current environment.
 *
 * Never prints secret values — only which variable failed and why.
 */

const ENFORCED_PROFILES = new Set(['preview', 'production']);

function isPrivateOrLocalHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.invalid') || h === '0.0.0.0') return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
  const m = /^172\.(\d+)\./.exec(h);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  return false;
}

function checkPublicHttpsUrl(name, value, problems) {
  if (!value) {
    problems.push(`${name} is not set.`);
    return;
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    problems.push(`${name} is not a valid URL.`);
    return;
  }
  if (url.protocol !== 'https:') problems.push(`${name} must use https:// in a release build.`);
  if (isPrivateOrLocalHost(url.hostname)) {
    problems.push(`${name} points at a local/private/placeholder host (${url.hostname}) — unreachable for store users.`);
  }
  if (/your-project|placeholder|not-yet-deployed|example\.com/i.test(value)) {
    problems.push(`${name} is still an example placeholder.`);
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    problems.push(`${name} should be an origin only (no path); got "${url.pathname}".`);
  }
}

/** Pure: returns the list of problems for an env object (empty = valid). */
function validateReleaseEnv(env) {
  const problems = [];
  checkPublicHttpsUrl('EXPO_PUBLIC_API_URL', env.EXPO_PUBLIC_API_URL, problems);
  checkPublicHttpsUrl('EXPO_PUBLIC_SUPABASE_URL', env.EXPO_PUBLIC_SUPABASE_URL, problems);

  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!anonKey) {
    problems.push('EXPO_PUBLIC_SUPABASE_ANON_KEY is not set.');
  } else if (/your_supabase|placeholder/i.test(anonKey)) {
    problems.push('EXPO_PUBLIC_SUPABASE_ANON_KEY is still the example placeholder.');
  } else if (isServiceRoleKey(anonKey)) {
    problems.push(
      'EXPO_PUBLIC_SUPABASE_ANON_KEY is a SERVICE-ROLE key — it bypasses RLS and must never ship in an app bundle.'
    );
  }

  for (const key of Object.keys(env)) {
    if (key.startsWith('EXPO_PUBLIC_') && /GEMINI|SERVICE_ROLE|SECRET/i.test(key)) {
      problems.push(`${key} would be inlined into the public app bundle — secrets must never use the EXPO_PUBLIC_ prefix.`);
    }
  }
  return problems;
}

/** Legacy JWT keys carry their role in the payload; new-style keys are prefixed. */
function isServiceRoleKey(key) {
  if (key.startsWith('sb_secret_')) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return payload && payload.role === 'service_role';
  } catch {
    return false;
  }
}

module.exports = { validateReleaseEnv, isPrivateOrLocalHost };

if (require.main === module) {
  const forced = process.argv.includes('--force');
  const profile = process.env.EAS_BUILD_PROFILE;
  if (!forced && !ENFORCED_PROFILES.has(profile)) {
    console.log(`[release-env] Skipped (EAS_BUILD_PROFILE=${profile || 'unset'}; enforced for preview/production only).`);
    process.exit(0);
  }
  const problems = validateReleaseEnv(process.env);
  if (problems.length > 0) {
    console.error(`[release-env] ${problems.length} problem(s) for profile "${profile || 'local --force'}":`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log('[release-env] OK — API and Supabase configuration are valid for a release build.');
}
