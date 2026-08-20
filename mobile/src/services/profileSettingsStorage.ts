import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { WardrobeProfile, LayeringPreference } from '../../../src/types/wardrobe';
import { userScopedKey, getCurrentUserId } from './authSession';
import { supabase } from './supabaseClient';
import type { Tables } from '../types/supabase';

const BASE_STORAGE_KEY = '@closiq_profile_settings';

export interface MobileProfileSettings {
  profile: WardrobeProfile;
  layeringPreference: LayeringPreference;
}

const DEFAULT_SETTINGS: MobileProfileSettings = {
  profile: 'men',
  layeringPreference: 'avoid'
};

/**
 * Sprint M18: `user_preferences` (Supabase, RLS-scoped to `user_id =
 * auth.uid()`, live-verified) is now the durable source of truth.
 * AsyncStorage stays as a read cache for offline continuity (Part 13/17).
 */
function rowToSettings(row: Tables<'user_preferences'>): MobileProfileSettings {
  return {
    profile: (row.wardrobe_profile as WardrobeProfile) || DEFAULT_SETTINGS.profile,
    layeringPreference: (row.layering_preference as LayeringPreference) || DEFAULT_SETTINGS.layeringPreference
  };
}

async function readCache(): Promise<MobileProfileSettings | null> {
  try {
    const raw = await AsyncStorage.getItem(userScopedKey(BASE_STORAGE_KEY));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      profile: parsed.profile || DEFAULT_SETTINGS.profile,
      layeringPreference: parsed.layeringPreference || DEFAULT_SETTINGS.layeringPreference
    };
  } catch (err) {
    console.warn('Failed to read cached profile settings:', err);
    return null;
  }
}

async function writeCache(settings: MobileProfileSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(userScopedKey(BASE_STORAGE_KEY), JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to cache profile settings:', err);
  }
}

export async function loadProfileSettings(): Promise<MobileProfileSettings> {
  const userId = getCurrentUserId();
  if (!userId) return DEFAULT_SETTINGS;

  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      const mapped = rowToSettings(data);
      await writeCache(mapped);
      return mapped;
    }
    return DEFAULT_SETTINGS;
  } catch (err) {
    console.warn('Cloud profile-settings fetch failed, falling back to local cache:', err);
    const cached = await readCache();
    return cached ?? DEFAULT_SETTINGS;
  }
}

export async function saveProfileSettings(
  partial: Partial<MobileProfileSettings>
): Promise<MobileProfileSettings> {
  const userId = getCurrentUserId();
  const existing = (await readCache()) ?? DEFAULT_SETTINGS;
  const updated = { ...existing, ...partial };

  await writeCache(updated);

  if (!userId) return updated;

  try {
    const { error } = await supabase.from('user_preferences').upsert(
      {
        user_id: userId,
        wardrobe_profile: updated.profile,
        layering_preference: updated.layeringPreference
      },
      { onConflict: 'user_id' }
    );
    if (error) throw error;
  } catch (err) {
    console.warn('Failed to sync profile settings to cloud:', err);
    Alert.alert(
      "You're offline",
      "This preference was saved on this device and will sync when you're back online."
    );
  }

  return updated;
}
