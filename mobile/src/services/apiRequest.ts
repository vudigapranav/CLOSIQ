import { API_BASE_URL } from '../config';
import { getAuthHeader } from './authService';

/**
 * Sprint M20 — the one way the mobile app calls CLOSIQ's own `/api/ai/*`.
 *
 * Before this, `visionAnalysis.ts` and `outfitStylist.ts` each called
 * `fetch()` directly with NO timeout — a stalled LAN connection, or the
 * deliberately unreachable production placeholder host, left the
 * "Understanding your garment…" / generation spinner up indefinitely. And
 * every failure (offline, expired session, Gemini 429, server down)
 * collapsed into the same silent local fallback, so the user couldn't
 * tell "you're offline" from "sign in again" from "AI is busy".
 *
 * This keeps the existing fallback behaviour of every caller — it only
 * adds a hard timeout and says WHY a request didn't succeed.
 */

export type ApiFailureReason =
  | 'timeout'
  | 'offline'
  | 'unauthorized'
  | 'rate_limited'
  | 'ai_unavailable'
  | 'server_error';

export type ApiResult =
  | { ok: true; json: Record<string, unknown> }
  | { ok: false; reason: ApiFailureReason; status?: number };

/**
 * Must exceed the server's own Gemini timeout (server/geminiServer.js,
 * GEMINI_TIMEOUT_MS = 30s) plus auth verification, so a slow-but-healthy
 * Gemini call reports the server's honest answer rather than a client-side
 * timeout racing it.
 */
export const DEFAULT_API_TIMEOUT_MS = 40_000;

/** Maps the server's `errorKind` (see geminiServer.js) to a reason. */
function reasonFromServerBody(json: Record<string, unknown>): ApiFailureReason {
  if (json.errorKind === 'rate_limited') return 'rate_limited';
  if (json.errorKind === 'timeout') return 'timeout';
  return 'ai_unavailable';
}

export async function postApi(
  path: string,
  body: unknown,
  timeoutMs: number = DEFAULT_API_TIMEOUT_MS
): Promise<ApiResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: 'unauthorized', status: response.status };
    }
    if (response.status === 429) return { ok: false, reason: 'rate_limited', status: 429 };
    if (!response.ok) return { ok: false, reason: 'server_error', status: response.status };

    const json = (await response.json()) as Record<string, unknown>;
    if (json && json.ok === true) return { ok: true, json };
    return { ok: false, reason: reasonFromServerBody(json || {}), status: response.status };
  } catch (err) {
    if (controller.signal.aborted || (err as { name?: string })?.name === 'AbortError') {
      return { ok: false, reason: 'timeout' };
    }
    // fetch() rejects (TypeError "Network request failed") only when no HTTP
    // response arrived at all: no connection, DNS failure, refused, TLS.
    return { ok: false, reason: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

/** One plain sentence per failure, safe to show the user as-is. */
export function describeApiFailure(reason: ApiFailureReason): string {
  switch (reason) {
    case 'timeout':
      return 'CLOSIQ took too long to respond.';
    case 'offline':
      return "Couldn't reach CLOSIQ — check your connection.";
    case 'unauthorized':
      return 'Your session has expired — log out and back in to use AI features.';
    case 'rate_limited':
      return 'The AI service is busy right now (rate limit reached). Try again later.';
    case 'ai_unavailable':
      return 'The AI service is unavailable right now.';
    case 'server_error':
      return 'The CLOSIQ server ran into a problem.';
  }
}
