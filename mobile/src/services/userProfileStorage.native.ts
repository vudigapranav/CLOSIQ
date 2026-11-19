import { DEFAULT_USER_PROFILE, type UserProfileData } from '../types/onboarding';
import { list, merge } from '../local/store';
export async function loadUserProfile() {
  return (await list<UserProfileData>('profile'))[0] ?? DEFAULT_USER_PROFILE;
}
export async function saveUserProfile(patch: Partial<UserProfileData>) {
  return (await merge('profile', 'device', 'guest', patch, DEFAULT_USER_PROFILE))!;
}
