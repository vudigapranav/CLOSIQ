/**
 * Synchronous, module-level cache of the current authenticated user's ID,
 * plus the session-scope primitives every user-owned storage operation uses
 * to stay pinned to the account it started under.
 *
 * Every user-owned AsyncStorage key (wardrobe, saved outfits, planner
 * events, profile settings, onboarding/user profile, outfit history) reads
 * this internally to build its key — Supabase's own session is the real
 * source of truth (see supabaseClient.ts/authService.ts), this is just a
 * synchronous mirror of its `user.id`, kept in sync by the
 * `onAuthStateChange` listener wired up once in App.tsx.
 *
 * Sprint M19 — why the scope primitives exist. Reading `currentUserId` at
 * the END of an async operation is a real user-isolation bug: a wardrobe
 * read that starts as user A and resolves 3 seconds later, after A logged
 * out and B logged in, would build its cache key from B's id and write A's
 * garments into B's cache (and hand them to B's React state). The fix is to
 * capture the session ONCE at operation start (`captureSession()`), derive
 * every key from that captured id (`userScopedKeyFor`), and refuse to
 * commit any cache write, cloud write, or state update once
 * `isSessionCurrent()` reports the session has moved on.
 */
let currentUserId: string | null = null;

/**
 * Bumped on every ACTUAL account change. Not bumped when Supabase re-emits
 * the same user (TOKEN_REFRESHED, repeated INITIAL_SESSION), so an
 * in-flight read for the still-signed-in user is never needlessly discarded.
 */
let sessionGeneration = 0;

/** An immutable snapshot of "which session am I acting on behalf of". */
export interface SessionScope {
  readonly userId: string | null;
  readonly generation: number;
}

export function setCurrentUserId(id: string | null): void {
  if (id !== currentUserId) sessionGeneration += 1;
  currentUserId = id;
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

/** Snapshot the session at the START of an async operation. */
export function captureSession(): SessionScope {
  return { userId: currentUserId, generation: sessionGeneration };
}

/**
 * True only if the session captured earlier is still the signed-in one.
 * Call this before committing ANY result of an async operation — a cache
 * write, a cloud write, or a React state update.
 */
export function isSessionCurrent(scope: SessionScope): boolean {
  return scope.generation === sessionGeneration && scope.userId === currentUserId;
}

/**
 * Builds a per-user storage key from an explicitly supplied user id, e.g.
 * `userScopedKeyFor(uid, '@closiq_saved_outfits')` →
 * `@closiq_saved_outfits_<uid>`. Prefer this over `userScopedKey()` inside
 * any async flow, passing the id captured at the start of the operation.
 */
export function userScopedKeyFor(userId: string | null, baseKey: string): string {
  return `${baseKey}_${userId ?? 'anonymous'}`;
}

/**
 * Same key shape, resolved against whoever is signed in RIGHT NOW. Safe
 * only in synchronous code; every async storage path uses
 * `userScopedKeyFor` with a captured id instead.
 */
export function userScopedKey(baseKey: string): string {
  return userScopedKeyFor(currentUserId, baseKey);
}
