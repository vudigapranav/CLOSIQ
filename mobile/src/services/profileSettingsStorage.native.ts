import type { MobileProfileSettings } from './profileSettingsStorage';
import { list, merge } from '../local/store';
const defaults: MobileProfileSettings = { profile: 'men', layeringPreference: 'avoid' };
export async function loadProfileSettings() {
  return (await list<MobileProfileSettings>('settings')).find((v) => v.profile) ?? defaults;
}
export async function saveProfileSettings(patch: Partial<MobileProfileSettings>) {
  return (await merge('settings', 'device', 'wardrobe', patch, defaults))!;
}
