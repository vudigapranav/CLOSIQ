import AsyncStorage from '@react-native-async-storage/async-storage';
import { WardrobeProfile, LayeringPreference } from '../../../src/types/wardrobe';

const STORAGE_KEY = '@closiq_profile_settings';

export interface MobileProfileSettings {
  profile: WardrobeProfile;
  layeringPreference: LayeringPreference;
}

const DEFAULT_SETTINGS: MobileProfileSettings = {
  profile: 'men',
  layeringPreference: 'avoid'
};

export async function loadProfileSettings(): Promise<MobileProfileSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      profile: parsed.profile || DEFAULT_SETTINGS.profile,
      layeringPreference: parsed.layeringPreference || DEFAULT_SETTINGS.layeringPreference
    };
  } catch (err) {
    console.warn('Failed to load profile settings from storage:', err);
    return DEFAULT_SETTINGS;
  }
}

export async function saveProfileSettings(
  partial: Partial<MobileProfileSettings>
): Promise<MobileProfileSettings> {
  try {
    const existing = await loadProfileSettings();
    const updated = { ...existing, ...partial };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Failed to save profile settings to storage:', err);
    return DEFAULT_SETTINGS;
  }
}
