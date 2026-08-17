/**
 * Mobile-only onboarding/profile types. Deliberately NOT added to the shared
 * `src/types/wardrobe.ts` (the web app's types file) — the web app has no
 * onboarding step that collects any of these fields, and touching that file
 * would mean changing the web application for something it doesn't use.
 * `WardrobeProfile`/`LayeringPreference` (Men/Women, layering) already live
 * there and are reused as-is; nothing here duplicates them.
 */

export type BodyType = 'slim' | 'athletic' | 'average' | 'broad' | 'prefer_not_to_say';

export const BODY_TYPE_OPTIONS: { value: BodyType; label: string; description: string }[] = [
  { value: 'slim', label: 'Slim', description: 'Narrow build, straight silhouette' },
  { value: 'athletic', label: 'Athletic', description: 'Broader shoulders, defined waist' },
  { value: 'average', label: 'Average', description: 'Balanced, evenly proportioned' },
  { value: 'broad', label: 'Broad', description: 'Fuller build throughout' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say', description: '' }
];

export type SkinTone = 'light' | 'medium' | 'tan' | 'deep' | 'prefer_not_to_say';

export const SKIN_TONE_OPTIONS: { value: SkinTone; label: string; swatch: string }[] = [
  { value: 'light', label: 'Light', swatch: '#F3D5B5' },
  { value: 'medium', label: 'Medium', swatch: '#D2A679' },
  { value: 'tan', label: 'Tan', swatch: '#B27C4E' },
  { value: 'deep', label: 'Deep', swatch: '#6E4A34' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say', swatch: '' }
];

export type StylePreference =
  | 'minimal'
  | 'casual'
  | 'streetwear'
  | 'smart_casual'
  | 'classic'
  | 'sporty'
  | 'oversized'
  | 'clean_contemporary';

export const STYLE_PREFERENCE_OPTIONS: { value: StylePreference; label: string }[] = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'casual', label: 'Casual' },
  { value: 'streetwear', label: 'Streetwear' },
  { value: 'smart_casual', label: 'Smart Casual' },
  { value: 'classic', label: 'Classic' },
  { value: 'sporty', label: 'Sporty' },
  { value: 'oversized', label: 'Oversized' },
  { value: 'clean_contemporary', label: 'Clean / Contemporary' }
];

export type TemperatureUnit = 'celsius' | 'fahrenheit';

export type LocationPermissionStatus = 'granted' | 'denied' | 'not_asked';

/**
 * Onboarding-collected profile data. Wardrobe profile (men/women) and
 * layering preference are NOT duplicated here — they continue to live
 * exclusively in `profileSettingsStorage.ts` (`@closiq_profile_settings`),
 * the same architecture Today/Stylist already read from, per instruction
 * not to create a second incompatible representation.
 */
export interface UserProfileData {
  name: string;
  bodyType: BodyType | null;
  skinTone: SkinTone | null;
  stylePreferences: StylePreference[];
  temperatureUnit: TemperatureUnit;
  locationPermissionStatus: LocationPermissionStatus;
  onboardingCompleted: boolean;
}

export const DEFAULT_USER_PROFILE: UserProfileData = {
  name: '',
  bodyType: null,
  skinTone: null,
  stylePreferences: [],
  temperatureUnit: 'celsius',
  locationPermissionStatus: 'not_asked',
  onboardingCompleted: false
};
