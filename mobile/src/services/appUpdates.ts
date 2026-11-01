import * as Updates from 'expo-updates';

/**
 * Apply a new over-the-air update on THIS launch (2026-11-01).
 *
 * By default expo-updates downloads a new update in the background and only
 * runs it on the next cold start — the user reopened the app after the
 * "Wardrobe search + filters" OTA and still saw the old Wardrobe. Now, on
 * launch, CLOSIQ checks for an update and, if one downloads within
 * RELOAD_WINDOW_MS (i.e. while the intro is still playing), restarts into
 * it straight away. A slower download is kept for the next launch rather
 * than yanking the screen away mid-use.
 */
const RELOAD_WINDOW_MS = 8000;

export async function applyUpdateOnLaunch(): Promise<void> {
  if (__DEV__ || !Updates.isEnabled) return;
  const startedAt = Date.now();
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return;
    const fetched = await Updates.fetchUpdateAsync();
    if (fetched.isNew && Date.now() - startedAt < RELOAD_WINDOW_MS) {
      await Updates.reloadAsync();
    }
  } catch (err) {
    // Offline or the update server is unreachable — the app keeps running
    // the version it already has.
    if (__DEV__) console.warn('[updates] check failed', err);
  }
}
