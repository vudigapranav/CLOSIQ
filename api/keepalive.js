/**
 * Daily Vercel Cron (vercel.json "crons"): one tiny query against Supabase so
 * the free-plan project never counts as idle and pauses (which is what broke
 * sign-in before). Under RLS the anon role simply gets [] back — the request
 * still reaches Postgres, which is what counts as activity.
 *
 * When CRON_SECRET is set in Vercel, Vercel sends it as a Bearer token and
 * any other caller is refused.
 */
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    res.statusCode = 401;
    res.end('Unauthorized');
    return;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: 'Supabase not configured' }));
    return;
  }

  const started = Date.now();
  try {
    const response = await fetch(`${url}/rest/v1/garments?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    res.statusCode = response.ok ? 200 : 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: response.ok, supabaseStatus: response.status, ms: Date.now() - started }));
  } catch (err) {
    console.error('[keepalive] Supabase ping failed:', err?.message || err);
    res.statusCode = 502;
    res.end(JSON.stringify({ ok: false, error: 'Supabase unreachable' }));
  }
}
