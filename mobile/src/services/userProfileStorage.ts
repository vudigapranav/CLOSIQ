import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfileData, DEFAULT_USER_PROFILE } from '../types/onboarding';

const STORAGE_KEY = '@closiq_user_profile';

/**
 * NOTE ON SCOPE: this is a single, device-global profile record — there is
 * no authenticated-user identity anywhere in this app to key it by (verified
 * by direct trace, not assumed; see STATE.md "Mobile Sprint M12"). This is
 * the same isolation model every other storage key in this app already
 * uses (one profile per device, split further only by men/women via
 * `profileSettingsStorage.ts`). It is NOT per-account storage and must not
 * be described as such until real authentication exists.
 */
export async function loadUserProfile(): Promise<UserProfileData> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
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
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Failed to save user profile to storage:', err);
    return DEFAULT_USER_PROFILE;
  }
}
