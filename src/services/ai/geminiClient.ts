/**
 * Client-Side AI API Proxy.
 *
 * SECURITY CORRECTION:
 * Browser/client JS NEVER holds or accesses the Gemini API key.
 * All requests are dispatched to the server API boundary at /api/ai/*.
 * Secret GEMINI_API_KEY is read strictly on the Node server side.
 */

export async function postJsonToApi<T>(endpoint: string, payload: any): Promise<{ ok: boolean; mode: 'gemini' | 'demo'; data?: T; error?: string }> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      return { ok: false, mode: 'demo', error: `Server returned HTTP ${res.status}` };
    }

    const json = await res.json();
    return json;
  } catch (err: any) {
    console.warn(`[CLOSIQ AI Service] Fetch to ${endpoint} failed, switching to demo mode:`, err?.message || err);
    return { ok: false, mode: 'demo', error: err?.message || 'Network error' };
  }
}
