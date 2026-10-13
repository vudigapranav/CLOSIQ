import { checkServerEnv } from '../server/envCheck.js';

/**
 * GET /healthz (rewritten here by vercel.json) — configuration PRESENCE only,
 * never values; makes no Gemini or Supabase call. Same shape as
 * server/index.js's handler so scripts/verify-deployment.mjs works on Vercel.
 */
export default function handler(req, res) {
  const envCheck = checkServerEnv(process.env);
  const gemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(
    JSON.stringify({
      ok: true,
      version: process.env.npm_package_version || '0.0.0',
      commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
      supabaseConfigured: envCheck.errors.length === 0,
      geminiConfigured: gemini,
      uptimeSeconds: Math.round(process.uptime())
    })
  );
}
