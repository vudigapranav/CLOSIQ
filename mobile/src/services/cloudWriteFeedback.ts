import { Alert } from 'react-native';
import { SessionScope, isSessionCurrent } from './authSession';

/**
 * Sprint M19 — honest failed-write semantics.
 *
 * Before this, every failed cloud write told the user "this was saved on
 * this device and will sync when you're back online." That was a promise
 * the app could not keep: there is no sync queue, no retry-on-reconnect
 * listener, and no background job anywhere in this codebase — a write that
 * failed simply never reached Supabase, and the local cache silently
 * diverged from the account forever.
 *
 * Rather than build a second persistence system (explicitly out of scope,
 * and the wrong thing to bolt on under time pressure), this helper makes
 * the failure explicit and offers the user the only mechanism that actually
 * exists: retrying the very same call, right now, through the same service.
 * Nothing here claims deferred or automatic synchronization.
 *
 * Every retry is session-guarded: if the account changed while the alert
 * was on screen, the write is abandoned rather than replayed against
 * whoever is signed in now.
 */

/** Bounded so a persistently failing write can't loop the user forever. */
const MAX_ATTEMPTS = 4;

export interface CloudWriteParams {
  /** The session captured at the start of the operation. */
  scope: SessionScope;
  /** Alert title, e.g. "Item not saved to your account". */
  title: string;
  /** Honest description of what is and isn't true now that it failed. */
  message: string;
  /**
   * The cloud call itself. Must throw (or reject) on failure. Receives the
   * 1-based attempt number: an insert that "failed" may still have
   * committed (the response, not the request, was lost), so a create's
   * retry must check for its own row before inserting again.
   */
  run: (attempt: number) => Promise<void>;
  /** Set false for silent background bookkeeping (no user-facing alert). */
  notify?: boolean;
}

function askRetry(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Try again', onPress: () => resolve(true) }
    ]);
  });
}

function notifyGaveUp(title: string, message: string): void {
  Alert.alert(title, message);
}

/**
 * Runs a cloud write, and on failure tells the user the truth and offers a
 * real retry. Returns whether the write actually reached the cloud —
 * callers MUST use this rather than assuming success.
 */
export async function runCloudWrite(params: CloudWriteParams): Promise<boolean> {
  const { scope, title, message, run, notify = true } = params;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    // The account may have changed between attempts (or before the first
    // one, if the caller awaited something else in between) — replaying a
    // write for a session that has ended would corrupt the new user's data.
    if (!isSessionCurrent(scope)) return false;

    try {
      await run(attempt);
      return true;
    } catch (err) {
      console.warn(`Cloud write failed (attempt ${attempt}/${MAX_ATTEMPTS}): ${title}`, err);

      if (!notify) return false;
      if (!isSessionCurrent(scope)) return false;

      if (attempt === MAX_ATTEMPTS) {
        notifyGaveUp(title, message);
        return false;
      }
      const retry = await askRetry(title, message);
      if (!retry) return false;
    }
  }

  return false;
}

/**
 * Sprint M19 audit — local-only records.
 *
 * A create whose cloud insert failed is kept on the device (rolling it back
 * would destroy the item the user just made) and marked `syncPending`. Two
 * things depend on that marker:
 *
 * 1. The next successful cloud read must NOT silently drop it. Before this,
 *    every load overwrote the cache with the cloud list, so an item the
 *    alert had just described as "on this device only" vanished from the
 *    device too on the next profile switch, relaunch, or onboarding refresh.
 * 2. The UI must not present it as saved (the Save Look button showed
 *    "Saved ✓" for a look that never reached the account).
 *
 * This is a flag on the existing cached record, not a queue: nothing
 * uploads it in the background. It is only ever cleared by a write the user
 * triggers that actually succeeds, or by the cloud read returning the same
 * id (an insert that committed even though its response was lost).
 */
export type MaybePending<T> = T & { syncPending?: boolean };

export function isSyncPending(record: object): boolean {
  return (record as { syncPending?: boolean }).syncPending === true;
}

export function markPending<T extends object>(record: T): MaybePending<T> {
  return { ...record, syncPending: true };
}

export function clearPending<T extends object>(record: MaybePending<T>): T {
  const { syncPending: _ignored, ...rest } = record;
  return rest as T;
}

/**
 * The cloud list is authoritative for everything it contains; cached
 * records still marked pending whose id the cloud doesn't have are kept,
 * in front, so a local-only item survives a reload.
 */
export function mergePendingLocal<T extends { id: string }>(cloud: T[], cached: T[]): T[] {
  const cloudIds = new Set(cloud.map((r) => r.id));
  const pending = cached.filter((r) => isSyncPending(r) && !cloudIds.has(r.id));
  return [...pending, ...cloud];
}
