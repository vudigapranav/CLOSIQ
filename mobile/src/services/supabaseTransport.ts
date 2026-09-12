/**
 * Bounded per-request timeout for the Supabase transport (login repair,
 * 2026-09-12). Kept in its own module so regression tests can exercise the
 * real implementation with an injected fetch.
 */
/**
 * Bounded per-request timeout for the Supabase transport ONLY.
 *
 * supabase-js has no request timeout of its own, so a black-holed network
 * (or a paused project whose host stops answering) left sign-in spinning
 * indefinitely. This wraps only the client's own fetch — `globalThis.fetch`
 * is untouched, so `wardrobeStorage`'s local `file://` photo read keeps
 * working exactly as before, and expo/fetch stays the global.
 *
 * Uploads get a much larger budget than auth/database calls: a garment photo
 * on a slow connection legitimately takes far longer than a token refresh.
 * Session refreshes are ordinary auth requests and stay well inside the
 * default budget, so autoRefreshToken behaviour is unchanged.
 */
export const REQUEST_TIMEOUT_MS = 15_000;
export const UPLOAD_TIMEOUT_MS = 90_000;

function requestUrlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return (input as Request).url ?? '';
}

export interface TimedFetchOptions {
  requestTimeoutMs?: number;
  uploadTimeoutMs?: number;
  /** Injectable for tests; defaults to the runtime's global fetch (expo/fetch
   *  on SDK 56+). The global itself is never replaced or wrapped. */
  fetchImpl?: typeof fetch;
}

export function createTimedFetch(options: TimedFetchOptions = {}) {
  const requestBudget = options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
  const uploadBudget = options.uploadTimeoutMs ?? UPLOAD_TIMEOUT_MS;

  return async function timedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const doFetch = options.fetchImpl ?? fetch;
  const url = requestUrlOf(input);
  const budget = url.includes('/storage/v1/') ? uploadBudget : requestBudget;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, budget);

  // A caller-supplied signal (supabase-js passes one for some calls) must
  // still be able to cancel the request.
  const callerSignal = init?.signal;
  const forwardAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', forwardAbort);
  }

  try {
    return await doFetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (timedOut) {
      // Reworded so classifyAuthError() reports a timeout rather than an
      // opaque "aborted", which reads like a user cancellation.
      throw new Error(`Request to CLOSIQ's account service timed out after ${budget / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', forwardAbort);
  }
  };
}

/** The instance the Supabase client uses. */
export const timedSupabaseFetch = createTimedFetch();

