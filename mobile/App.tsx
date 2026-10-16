import React, { useState, useEffect } from 'react';
import {
  Alert,
  StyleSheet,
  View,
  StatusBar
} from 'react-native';
// SDK 55+ makes edge-to-edge mandatory on Android, where React Native's own
// SafeAreaView is a no-op (and is now deprecated) — content would render under
// the status bar and gesture navigation. react-native-safe-area-context is
// Expo's documented replacement and behaves the same as before on iOS.
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { COLORS } from './src/theme';
import { IntroSplash } from './src/components/IntroSplash';
import { BottomNavigation, NavTab } from './src/components/BottomNavigation';
import { TodayScreen } from './src/screens/TodayScreen';
import { CollectionScreen } from './src/screens/CollectionScreen';
import { StylistScreen } from './src/screens/StylistScreen';
import { PlannerScreen } from './src/screens/PlannerScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { OnboardingScreen, OnboardingResult } from './src/screens/OnboardingScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { WardrobeProfile, LayeringPreference, Outfit, GarmentItem, GarmentDetailsPatch } from '../src/types/wardrobe';
import { loadProfileSettings, saveProfileSettings } from './src/services/profileSettingsStorage';
import { recordRecentOutfit } from './src/services/outfitHistoryStorage';
import { loadUserProfile, saveUserProfile } from './src/services/userProfileStorage';
import {
  loadUserWardrobe,
  saveUserGarment,
  removeUserGarment,
  updateUserGarmentDetails,
  recordGarmentsWorn
} from './src/services/wardrobeStorage';
import { loadSavedOutfits, saveOutfitToStorage, removeSavedOutfitFromStorage } from './src/services/savedOutfitsStorage';
import { restoreSession, onAuthStateChange, signOut } from './src/services/authService';
import { setCurrentUserId, captureSession, isSessionCurrent } from './src/services/authSession';
import { UserProfileData } from './src/types/onboarding';

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>('today');
  const [profile, setProfile] = useState<WardrobeProfile>('men');
  const [layeringPreference, setLayeringPreference] = useState<LayeringPreference>('avoid');
  const [wearAgainOutfit, setWearAgainOutfit] = useState<Outfit | null>(null);
  // null = still reading from storage; guards against a flash of the
  // onboarding screen before we actually know whether it's needed.
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);

  // Sprint M17 — real auth. 'loading' = session check not resolved yet
  // (guards against a flash of Login before we know a session already
  // exists); null = no session (show Login); a string = the authenticated
  // user's Supabase ID, which every per-user storage read below keys off.
  const [userId, setUserId] = useState<string | null | 'loading'>('loading');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  // Set when a stored session couldn't be refreshed at startup (offline
  // with an expired access token) — distinct from being signed out.
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  // Wardrobe and saved outfits, lifted here (Sprint M16) rather than each of
  // Collection/Today/Stylist/Planner/Profile independently re-reading the
  // same AsyncStorage keys on every tab visit — since App.tsx never
  // unmounts, "load once, hold in state, refresh only on an actual mutation"
  // means switching tabs is now an instant prop read instead of a fresh
  // JSON parse of the whole wardrobe/saved-outfits array every time,
  // scaling directly with how large those two get (Part 4's 200-garment
  // case). Screens still reset their own transient outfit-generation state
  // (outfitResult, errors, swap selection) on a profile change themselves —
  // that reset logic didn't move, only the data loading did.
  const [wardrobe, setWardrobe] = useState<GarmentItem[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<Outfit[]>([]);
  // Bumped to force a wardrobe re-read when nothing in [userId, profile]
  // changed but the underlying data did — onboarding finishing on the
  // already-active profile (Men, the default) being the case that used to
  // silently leave the parent showing a stale, empty wardrobe.
  const [wardrobeRefreshKey, setWardrobeRefreshKey] = useState(0);

  // Sprint M17 — checks for a restorable Supabase session once on launch,
  // then stays subscribed for every subsequent change (login, logout,
  // token refresh). `setCurrentUserId()` (authSession.ts) is called BEFORE
  // any per-user storage read below can run, since every one of those
  // reads builds its AsyncStorage key from whatever that module-level
  // value currently is — getting the order right here is what makes user
  // data isolation actually hold.
  useEffect(() => {
    let mounted = true;

    function applySession(session: Session | null) {
      const nextUserId = session?.user?.id ?? null;
      setCurrentUserId(nextUserId);
      if (!mounted) return;
      if (nextUserId) setSessionNotice(null);
      setUserEmail(session?.user?.email ?? null);
      setUserId(nextUserId);
    }

    restoreSession().then(({ session, restoreFailed }) => {
      if (restoreFailed && mounted) {
        setSessionNotice(
          "You're still signed in on this device, but CLOSIQ couldn't be reached to refresh your session. " +
            "Reconnect and you'll be signed back in automatically — or log in again."
        );
      }
      applySession(session);
    });
    const unsubscribe = onAuthStateChange(applySession);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Reloads every per-user record fresh whenever the AUTHENTICATED USER
  // changes — covers first login, session restoration, and (critically for
  // Phase 6/9's isolation requirement) logging out and back in as a
  // different account. On logout, everything is cleared rather than left
  // showing the previous user's data for even a frame.
  useEffect(() => {
    if (userId === 'loading') return;

    if (!userId) {
      setUserProfile(null);
      setWardrobe([]);
      setSavedOutfits([]);
      setWearAgainOutfit(null);
      setProfile('men');
      setLayeringPreference('avoid');
      return;
    }

    setUserProfile(null); // show the "reading storage" frame while this user's data loads

    // `active` is the second half of the isolation guard (the first being
    // each storage module's own captured session): a read for user A that
    // resolves after this effect has re-run for user B must never reach
    // React state. React does not cancel in-flight promises for us.
    let active = true;
    loadProfileSettings().then((settings) => {
      if (!active) return;
      setProfile(settings.profile);
      setLayeringPreference(settings.layeringPreference);
    });
    loadUserProfile().then((p) => {
      if (active) setUserProfile(p);
    });
    loadSavedOutfits().then((o) => {
      if (active) setSavedOutfits(o);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  // Wardrobe depends on BOTH the authenticated user and the active
  // Men/Women profile (separate @closiq_user_wardrobe_<userId>_men/_women
  // keys — see wardrobeStorage.ts).
  useEffect(() => {
    if (userId === 'loading' || !userId) return;
    // Guards BOTH stale users and stale profiles: a Men wardrobe read that
    // resolves after the user switched to Women (or signed out and back in
    // as someone else) is dropped rather than rendered.
    let active = true;
    loadUserWardrobe(profile).then((w) => {
      if (active) setWardrobe(w);
    });
    return () => {
      active = false;
    };
  }, [userId, profile, wardrobeRefreshKey]);

  const handleLogout = async () => {
    // A failed signOut used to be swallowed entirely, leaving the user
    // still signed in with no explanation and no SIGNED_OUT event — they'd
    // tap Log Out, nothing would happen, and the next person to pick up the
    // phone would still be in the previous account.
    const result = await signOut();
    if (!result.ok) {
      // supabase-js keeps the local session when the server call fails
      // (auth-js `_signOut` returns before `_removeSession()`), so "still
      // signed in" is the literal truth — and the part the user most needs.
      Alert.alert(
        "Couldn't log out",
        `${result.message ?? 'Something went wrong.'} You're still signed in on this device.`
      );
      return;
    }
    // onAuthStateChange (above) picks up the resulting SIGNED_OUT event and
    // handles clearing per-user state + returning to Login — nothing else
    // needed here. Does NOT delete the account or any server-side data.
  };

  // Every mutation below captures the session before awaiting and refuses
  // to write its result into state if the account changed in the meantime —
  // the same rule the storage modules apply to their caches, applied here
  // to React state (Sprint M19).
  const handleGarmentAdded = async (garment: GarmentItem) => {
    const scope = captureSession();
    const result = await saveUserGarment(garment, profile);
    if (isSessionCurrent(scope)) setWardrobe(result.items);
  };

  const handleGarmentRemoved = async (id: string) => {
    const scope = captureSession();
    const updated = await removeUserGarment(id, profile);
    if (isSessionCurrent(scope)) setWardrobe(updated);
  };

  const handleGarmentDetailsChanged = async (id: string, patch: GarmentDetailsPatch) => {
    const scope = captureSession();
    // Show the edit immediately; the stored result (rolled back on a failed
    // cloud write) replaces it when the write settles.
    setWardrobe((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    const updated = await updateUserGarmentDetails(id, profile, patch);
    if (isSessionCurrent(scope)) setWardrobe(updated);
  };

  // "Try next time" saves with status try_later; "Wear today" saves with
  // status worn AND counts a wear for every garment in the look.
  const handleSaveOutfit = async (outfit: Outfit): Promise<Outfit[]> => {
    const scope = captureSession();
    const updated = await saveOutfitToStorage(outfit);
    if (!isSessionCurrent(scope)) return savedOutfits;
    setSavedOutfits(updated);
    if (outfit.status === 'worn') {
      const worn = await recordGarmentsWorn(outfit.items.map((i) => i.id), profile);
      if (isSessionCurrent(scope) && worn.length > 0) setWardrobe(worn);
    }
    return updated;
  };

  const handleDeleteSavedOutfit = async (id: string) => {
    const scope = captureSession();
    const updated = await removeSavedOutfitFromStorage(id);
    if (isSessionCurrent(scope)) setSavedOutfits(updated);
  };

  const handleProfileChange = async (p: WardrobeProfile) => {
    const scope = captureSession();
    setProfile(p);
    const saved = await saveProfileSettings({ profile: p });
    // A preference write that resolves after a session change must not
    // reapply the previous account's Men/Women profile — which would then
    // drive the wardrobe read for the new user.
    if (isSessionCurrent(scope)) setProfile(saved.profile);
  };

  const handleLayeringChange = async (l: LayeringPreference) => {
    const scope = captureSession();
    setLayeringPreference(l);
    const saved = await saveProfileSettings({ layeringPreference: l });
    if (isSessionCurrent(scope)) setLayeringPreference(saved.layeringPreference);
  };

  // Onboarding writes to the SAME profile/layering architecture Today and
  // Stylist already read from (handleProfileChange/handleLayeringChange) —
  // no second, incompatible representation of Men/Women or layering exists.
  const handleOnboardingComplete = async (result: OnboardingResult) => {
    const scope = captureSession();
    await handleProfileChange(result.profile);
    await handleLayeringChange(result.layeringPreference);
    const saved = await saveUserProfile(result.userProfile);
    if (!isSessionCurrent(scope)) return;
    setUserProfile(saved);
    // Onboarding added garments through its own local wardrobe state, so
    // the parent's copy is stale. Bumping the refresh key re-reads it
    // unconditionally — the [userId, profile] deps alone are NOT enough,
    // because the common case is finishing onboarding on Men, which is
    // already the active profile, so nothing in those deps changes and the
    // user lands on Today with an empty closet.
    setWardrobeRefreshKey((k) => k + 1);
  };

  const handleWearAgain = (outfit: Outfit) => {
    setWearAgainOutfit(outfit);
    setActiveTab('today');
    // A worn look shouldn't be immediately re-recommended either — same
    // recent-outfit memory Today/Stylist use for generate/regenerate/save.
    recordRecentOutfit(outfit.items.map((i) => i.id));
    // Wearing it counts: it moves to "Worn" in Saved Looks (added there if it
    // came from the Planner) and each garment gets a wear (2026-10-14).
    handleSaveOutfit({ ...outfit, saved: true, status: 'worn' });
  };

  // Cinematic intro (src/components/IntroSplash.tsx): full film once a day,
  // a short cut otherwise; tap to skip.
  if (showSplash) {
    return <IntroSplash onFinish={() => setShowSplash(false)} />;
  }

  // Still checking for a restorable session — render nothing but the frame
  // rather than flashing Login before we actually know one doesn't exist.
  if (userId === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
      </SafeAreaView>
    );
  }

  if (!userId) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <LoginScreen sessionNotice={sessionNotice} />
      </SafeAreaView>
    );
  }

  // Authenticated, but still reading THIS user's own storage — render
  // nothing but the frame rather than guessing which screen (onboarding vs.
  // main app) belongs here.
  if (!userProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
      </SafeAreaView>
    );
  }

  if (!userProfile.onboardingCompleted) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Screen Destination Switcher */}
      <View style={styles.screenView}>
        {activeTab === 'today' && (
          <TodayScreen
            profile={profile}
            layeringPreference={layeringPreference}
            wearAgainOutfit={wearAgainOutfit}
            userName={userProfile.name}
            temperatureUnit={userProfile.temperatureUnit}
            userProfile={userProfile}
            wardrobe={wardrobe}
            savedOutfits={savedOutfits}
            onSaveOutfit={handleSaveOutfit}
            onNavigateToCollection={() => setActiveTab('collection')}
          />
        )}
        {activeTab === 'collection' && (
          <CollectionScreen
            profile={profile}
            wardrobe={wardrobe}
            onGarmentAdded={handleGarmentAdded}
            onGarmentRemoved={handleGarmentRemoved}
            onGarmentDetailsChanged={handleGarmentDetailsChanged}
            layeringPreference={layeringPreference}
          />
        )}
        {activeTab === 'planner' && (
          <PlannerScreen
            profile={profile}
            layeringPreference={layeringPreference}
            userProfile={userProfile}
            wardrobe={wardrobe}
            onUseForToday={handleWearAgain}
            onNavigateToCollection={() => setActiveTab('collection')}
          />
        )}
        {activeTab === 'stylist' && (
          <StylistScreen
            profile={profile}
            layeringPreference={layeringPreference}
            userProfile={userProfile}
            wardrobe={wardrobe}
            savedOutfits={savedOutfits}
            onSaveOutfit={handleSaveOutfit}
            onNavigateToCollection={() => setActiveTab('collection')}
          />
        )}
        {activeTab === 'profile' && (
          <ProfileScreen
            profile={profile}
            layeringPreference={layeringPreference}
            onProfileChange={handleProfileChange}
            onLayeringChange={handleLayeringChange}
            onWearAgain={handleWearAgain}
            onNavigateToToday={() => setActiveTab('today')}
            userProfile={userProfile}
            onUpdateUserProfile={async (partial) => {
              const scope = captureSession();
              const saved = await saveUserProfile(partial);
              if (isSessionCurrent(scope)) setUserProfile(saved);
            }}
            wardrobe={wardrobe}
            savedOutfits={savedOutfits}
            onDeleteSavedOutfit={handleDeleteSavedOutfit}
            userEmail={userEmail}
            onLogout={handleLogout}
          />
        )}
      </View>

      {/* Polished Floating Bottom Navigation */}
      <BottomNavigation activeTab={activeTab} onSelectTab={setActiveTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  screenView: {
    flex: 1,
    backgroundColor: COLORS.bg
  }
});

/**
 * SafeAreaProvider must sit above every screen that reads insets — required by
 * react-native-safe-area-context (Sprint M21 / SDK 57 upgrade). AppContent is
 * unchanged apart from where SafeAreaView comes from.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
