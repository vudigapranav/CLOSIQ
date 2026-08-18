/**
 * Synchronous, module-level cache of the current authenticated user's ID.
 *
 * Every user-owned AsyncStorage key (wardrobe, saved outfits, planner
 * events, profile settings, onboarding/user profile, outfit history) reads
 * this internally to build its key — Supabase's own session is the real
 * source of truth (see supabaseClient.ts/authService.ts), this is just a
 * synchronous mirror of its `user.id`, kept in sync by the
 * `onAuthStateChange` listener wired up once in App.tsx. Doing it this way
 * means none of the six storage modules, and none of the screens that call
 * them, need a new `userId` parameter threaded through their signatures —
 * only each storage module's internal key-builder changes.
 */
let currentUserId: string | null = null;

export function setCurrentUserId(id: string | null): void {
  currentUserId = id;
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

/**
 * Builds a per-user storage key from a base name, e.g.
 * `userScopedKey('@closiq_saved_outfits')` → `@closiq_saved_outfits_<userId>`.
 * The 'anonymous' fallback is a defensive no-op path only — every screen
 * that reads/writes user-owned storage is only ever mounted once a session
 * exists (see App.tsx's auth gate), so this should never actually be hit
 * in normal operation.
 */
export function userScopedKey(baseKey: string): string {
  return `${baseKey}_${currentUserId ?? 'anonymous'}`;
}
