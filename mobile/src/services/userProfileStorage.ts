import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { UserProfileData, DEFAULT_USER_PROFILE, BodyType, SkinTone, StylePreference, TemperatureUnit, LocationPermissionStatus } from '../types/onboarding';
import { userScopedKey, getCurrentUserId } from './authSession';
import { supabase } from './supabaseClient';
import type { Tables } from '../types/supabase';

const BASE_STORAGE_KEY = '@closiq_user_profile';

/**
 * Sprint M18: `profiles` (Supabase) is now the durable source of truth,
 * user-scoped by row-level security on `id = auth.uid()` (live-verified —
 * see STATE.md). AsyncStorage remains as a read cache so the app can still
 * render a returning user's own profile while offline (Part 13/17) — it is
 * never treated as authoritative once a cloud fetch succeeds.
 */
function rowToProfile(row: Tables<'profiles'>): UserProfileData {
  return {
    name: row.name || '',
    bodyType: (row.body_type as BodyType | null) ?? null,
    skinTone: (row.skin_tone as SkinTone | null) ?? null,
    stylePreferences: (row.style_preferences as StylePreference[]) || [],
    temperatureUnit: (row.temperature_unit as TemperatureUnit) || 'celsius',
    locationPermissionStatus: (row.location_permission_status as LocationPermissionStatus) || 'not_asked',
    onboardingCompleted: !!row.onboarding_completed
  };
}

async function readCache(): Promise<UserProfileData | null> {
  try {
    const raw = await AsyncStorage.getItem(userScopedKey(BASE_STORAGE_KEY));
    if (!raw) return null;
    return { ...DEFAULT_USER_PROFILE, ...JSON.parse(raw) };
  } catch (err) {
    console.warn('Failed to read cached user profile:', err);
    return null;
  }
}

async function writeCache(data: UserProfileData): Promise<void> {
  try {
    await AsyncStorage.setItem(userScopedKey(BASE_STORAGE_KEY), JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to cache user profile:', err);
  }
}

export async function loadUserProfile(): Promise<UserProfileData> {
  const userId = getCurrentUserId();
  if (!userId) return DEFAULT_USER_PROFILE;

  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    if (data) {
      const mapped = rowToProfile(data);
      await writeCache(mapped);
      return mapped;
    }
    // No cloud row yet (brand-new account, no row created for it yet) —
    // genuinely a fresh profile, not a connectivity failure.
    return DEFAULT_USER_PROFILE;
  } catch (err) {
    console.warn('Cloud profile fetch failed, falling back to local cache:', err);
    const cached = await readCache();
    if (!cached) {
      // Genuinely couldn't reach the cloud AND have nothing cached — without
      // this, a connectivity failure looks identical to a real new-account
      // empty profile, and the user has no idea their real data didn't load.
      Alert.alert(
        "Couldn't load your profile",
        "Check your connection and try again."
      );
    }
    return cached ?? DEFAULT_USER_PROFILE;
  }
}

export async function saveUserProfile(partial: Partial<UserProfileData>): Promise<UserProfileData> {
  const userId = getCurrentUserId();
  const existing = (await readCache()) ?? DEFAULT_USER_PROFILE;
  const updated = { ...existing, ...partial };

  // Optimistic local write first (Part 7: local update before the cloud
  // round trip resolves) — the UI reads this back immediately.
  await writeCache(updated);

  if (!userId) return updated;

  try {
    // Deliberately omits `is_demo` — never set/overwritten from the client;
    // Postgres upsert only touches columns present in this payload, so the
    // demo account's is_demo=true (and every other account's default
    // false) is preserved on every save, insert or update alike.
    const { error } = await supabase.from('profiles').upsert(
      {
        id: userId,
        name: updated.name,
        body_type: updated.bodyType,
        skin_tone: updated.skinTone,
        style_preferences: updated.stylePreferences,
        temperature_unit: updated.temperatureUnit,
        location_permission_status: updated.locationPermissionStatus,
        onboarding_completed: updated.onboardingCompleted
      },
      { onConflict: 'id' }
    );
    if (error) throw error;
  } catch (err) {
    console.warn('Failed to sync user profile to cloud:', err);
    Alert.alert(
      "You're offline",
      'Your profile change was saved on this device and will sync when you\'re back online.'
    );
  }

  return updated;
}
