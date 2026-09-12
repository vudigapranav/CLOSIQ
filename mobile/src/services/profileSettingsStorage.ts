import AsyncStorage from '@react-native-async-storage/async-storage';
import { WardrobeProfile, LayeringPreference } from '../../../src/types/wardrobe';
import {
  SessionScope,
  captureSession,
  isSessionCurrent,
  userScopedKeyFor
} from './authSession';
import { runCloudWrite } from './cloudWriteFeedback';
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

async function readCache(scope: SessionScope): Promise<MobileProfileSettings | null> {
  try {
    const raw = await AsyncStorage.getItem(userScopedKeyFor(scope.userId, BASE_STORAGE_KEY));
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

async function writeCache(scope: SessionScope, settings: MobileProfileSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(userScopedKeyFor(scope.userId, BASE_STORAGE_KEY), JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to cache profile settings:', err);
  }
}

export async function loadProfileSettings(): Promise<MobileProfileSettings> {
  // Session captured once, up front — see authSession.ts (Sprint M19).
  const scope = captureSession();
  const userId = scope.userId;
  if (!userId) return DEFAULT_SETTINGS;

  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!isSessionCurrent(scope)) {
      // Would otherwise flip the new user into the previous user's
      // Men/Women wardrobe profile, which then drives the wardrobe read.
      console.warn('Discarding preferences read that resolved after a session change.');
      return DEFAULT_SETTINGS;
    }
    if (data) {
      const mapped = rowToSettings(data);
      await writeCache(scope, mapped);
      return mapped;
    }
    return DEFAULT_SETTINGS;
  } catch (err) {
    console.warn('Cloud profile-settings fetch failed, falling back to local cache:', err);
    const cached = await readCache(scope);
    if (!isSessionCurrent(scope)) return DEFAULT_SETTINGS;
    return cached ?? DEFAULT_SETTINGS;
  }
}

export async function saveProfileSettings(
  partial: Partial<MobileProfileSettings>
): Promise<MobileProfileSettings> {
  const scope = captureSession();
  const userId = scope.userId;
  const existing = (await readCache(scope)) ?? DEFAULT_SETTINGS;
  const updated = { ...existing, ...partial };

  await writeCache(scope, updated);

  if (!userId) return updated;

  await runCloudWrite({
    scope,
    title: 'Preference not saved to your account',
    message:
      "This preference wasn't saved to your account. It's in effect on this device for now, but your saved preferences will replace it the next time they load — try again to keep it.",
    run: async () => {
      const { error } = await supabase.from('user_preferences').upsert(
        {
          user_id: userId,
          wardrobe_profile: updated.profile,
          layering_preference: updated.layeringPreference
        },
        { onConflict: 'user_id' }
      );
      if (error) throw error;
    }
  });

  if (!isSessionCurrent(scope)) return DEFAULT_SETTINGS;
  return updated;
}
