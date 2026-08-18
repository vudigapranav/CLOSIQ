import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfileData, DEFAULT_USER_PROFILE } from '../types/onboarding';
import { userScopedKey } from './authSession';

const BASE_STORAGE_KEY = '@closiq_user_profile';

/**
 * Sprint M17: this is now a genuinely per-account record — `userScopedKey()`
 * appends the authenticated session's user ID, so `onboardingCompleted` and
 * everything else here (name, body type, skin tone, style prefs, temp
 * unit, location permission) belongs to one specific account, not the
 * device. Pre-M17 builds stored this as a single device-global record
 * (see git history / STATE.md Mobile Sprint M12) — that old unscoped key is
 * deliberately left untouched rather than migrated into whichever account
 * happens to log in first.
 */
export async function loadUserProfile(): Promise<UserProfileData> {
  try {
    const raw = await AsyncStorage.getItem(userScopedKey(BASE_STORAGE_KEY));
    if (!raw) return DEFAULT_USER_PROFILE;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_USER_PROFILE, ...parsed };
  } catch (err) {
    console.warn('Failed to load user profile from storage:', err);
    return DEFAULT_USER_PROFILE;
  }
}

export async function saveUserProfile(partial: Partial<UserProfileData>): Promise<UserProfileData> {
  try {
    const existing = await loadUserProfile();
    const updated = { ...existing, ...partial };
    await AsyncStorage.setItem(userScopedKey(BASE_STORAGE_KEY), JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Failed to save user profile to storage:', err);
    return DEFAULT_USER_PROFILE;
  }
}
