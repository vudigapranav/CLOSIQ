/**
 * Sprint M20 — startup validation of the backend's environment.
 *
 * Before this, a server started without SUPABASE_URL / SUPABASE_ANON_KEY
 * came up "healthy" and then rejected EVERY /api/ai/* request with 401
 * (authVerify.js fails closed, correctly) — an outage that only showed up
 * as every phone silently falling back to the local engine. A production
 * process now refuses to start in that state; development only warns.
 *
 * Pure function over an env object so it can be tested without starting a
 * server. Never prints secret values — only whether they are present.
 */
export function checkServerEnv(env) {
  const errors = [];
  const warnings = [];
  const isProduction = env.NODE_ENV === 'production';

  const supabaseUrl = env.SUPABASE_URL || '';
  if (!supabaseUrl) {
    errors.push('SUPABASE_URL is not set — every /api/ai/* request will be rejected as unauthenticated.');
  } else if (!/^https:\/\//i.test(supabaseUrl)) {
    (isProduction ? errors : warnings).push('SUPABASE_URL is not an https:// URL.');
  } else if (/placeholder|your-project/i.test(supabaseUrl)) {
    errors.push('SUPABASE_URL is still the example placeholder.');
  }

  const anonKey = env.SUPABASE_ANON_KEY || '';
  if (!anonKey) {
    errors.push('SUPABASE_ANON_KEY is not set — every /api/ai/* request will be rejected as unauthenticated.');
  } else if (/your_supabase|placeholder/i.test(anonKey)) {
    errors.push('SUPABASE_ANON_KEY is still the example placeholder.');
  }

  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    warnings.push(
      'SUPABASE_SERVICE_ROLE_KEY is set but unused — this server only needs the anon key; remove it from the environment.'
    );
  }

  const geminiKey = env.GEMINI_API_KEY || '';
  if (!geminiKey || geminiKey === 'your_gemini_api_key_here') {
    warnings.push('GEMINI_API_KEY is not set — AI endpoints will report "not configured" and phones will use the local engine.');
  }

  return { errors, warnings, isProduction };
}
