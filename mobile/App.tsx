import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  SafeAreaView,
  StatusBar,
  Animated,
  Dimensions
} from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { COLORS } from './src/theme';
import { BottomNavigation, NavTab } from './src/components/BottomNavigation';
import { TodayScreen } from './src/screens/TodayScreen';
import { CollectionScreen } from './src/screens/CollectionScreen';
import { StylistScreen } from './src/screens/StylistScreen';
import { PlannerScreen } from './src/screens/PlannerScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { OnboardingScreen, OnboardingResult } from './src/screens/OnboardingScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { WardrobeProfile, LayeringPreference, Outfit, GarmentItem } from '../src/types/wardrobe';
import { loadProfileSettings, saveProfileSettings } from './src/services/profileSettingsStorage';
import { recordRecentOutfit } from './src/services/outfitHistoryStorage';
import { loadUserProfile, saveUserProfile } from './src/services/userProfileStorage';
import { loadUserWardrobe, saveUserGarment, removeUserGarment, seedDemoWardrobeIfNeeded } from './src/services/wardrobeStorage';
import { loadSavedOutfits, saveOutfitToStorage, removeSavedOutfitFromStorage } from './src/services/savedOutfitsStorage';
import { getCurrentSession, onAuthStateChange, signOut, isDemoUser } from './src/services/authService';
import { setCurrentUserId } from './src/services/authSession';
import { UserProfileData } from './src/types/onboarding';

const { width } = Dimensions.get('window');

export default function App() {
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

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Sprint M17 — checks for a restorable Supabase session once on launch,
  // then stays subscribed for every subsequent change (login, logout,
  // token refresh). `setCurrentUserId()` (authSession.ts) is called BEFORE
  // any per-user storage read below can run, since every one of those
  // reads builds its AsyncStorage key from whatever that module-level
  // value currently is — getting the order right here is what makes user
  // data isolation actually hold.
  useEffect(() => {
    let mounted = true;

    async function applySession(session: Session | null) {
      const nextUserId = session?.user?.id ?? null;
      setCurrentUserId(nextUserId);
      if (nextUserId && isDemoUser(session?.user?.email)) {
        // Idempotent — only actually writes anything the first time this
        // specific demo account has an empty wardrobe. A brand-new real
        // account never reaches this branch, so it never gets seeded.
        await seedDemoWardrobeIfNeeded();
      }
      if (!mounted) return;
      setUserEmail(session?.user?.email ?? null);
      setUserId(nextUserId);
    }

    getCurrentSession().then(applySession);
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
    loadProfileSettings().then((settings) => {
      setProfile(settings.profile);
      setLayeringPreference(settings.layeringPreference);
    });
    loadUserProfile().then(setUserProfile);
    loadSavedOutfits().then(setSavedOutfits);
  }, [userId]);

  // Wardrobe depends on BOTH the authenticated user and the active
  // Men/Women profile (separate @closiq_user_wardrobe_<userId>_men/_women
  // keys — see wardrobeStorage.ts).
  useEffect(() => {
    if (userId === 'loading' || !userId) return;
    loadUserWardrobe(profile).then(setWardrobe);
  }, [userId, profile]);

  const handleLogout = async () => {
    await signOut();
    // onAuthStateChange (above) picks up the resulting SIGNED_OUT event and
    // handles clearing per-user state + returning to Login — nothing else
    // needed here. Does NOT delete the account or any server-side data.
  };

  const handleGarmentAdded = async (garment: GarmentItem) => {
    const updated = await saveUserGarment(garment, profile);
    setWardrobe(updated);
  };

  const handleGarmentRemoved = async (id: string) => {
    const updated = await removeUserGarment(id, profile);
    setWardrobe(updated);
  };

  const handleSaveOutfit = async (outfit: Outfit): Promise<Outfit[]> => {
    const updated = await saveOutfitToStorage(outfit);
    setSavedOutfits(updated);
    return updated;
  };

  const handleDeleteSavedOutfit = async (id: string) => {
    const updated = await removeSavedOutfitFromStorage(id);
    setSavedOutfits(updated);
  };

  const handleProfileChange = async (p: WardrobeProfile) => {
    setProfile(p);
    await saveProfileSettings({ profile: p });
  };

  const handleLayeringChange = async (l: LayeringPreference) => {
    setLayeringPreference(l);
    await saveProfileSettings({ layeringPreference: l });
  };

  // Onboarding writes to the SAME profile/layering architecture Today and
  // Stylist already read from (handleProfileChange/handleLayeringChange) —
  // no second, incompatible representation of Men/Women or layering exists.
  const handleOnboardingComplete = async (result: OnboardingResult) => {
    await handleProfileChange(result.profile);
    await handleLayeringChange(result.layeringPreference);
    const saved = await saveUserProfile(result.userProfile);
    setUserProfile(saved);
  };

  const handleWearAgain = (outfit: Outfit) => {
    setWearAgainOutfit(outfit);
    setActiveTab('today');
    // A worn look shouldn't be immediately re-recommended either — same
    // recent-outfit memory Today/Stylist use for generate/regenerate/save.
    recordRecentOutfit(outfit.items.map((i) => i.id));
  };

  useEffect(() => {
    // Launch splash animation sequence
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true
      })
    ]).start();

    // Hold for 1.8 seconds then transition to main app
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true
      }).start(() => {
        setShowSplash(false);
      });
    }, 1800);

    return () => clearTimeout(timer);
  }, [fadeAnim, scaleAnim]);

  if (showSplash) {
    return (
      <SafeAreaView style={styles.splashContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
        <Animated.View
          style={[
            styles.splashContent,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <Image
            source={require('./assets/closiq-logo.png')}
            style={styles.splashLogo}
            resizeMode="contain"
          />
          <Text style={styles.splashTagline}>AI Personal Wardrobe & Stylist</Text>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // Still checking for a restorable session — render nothing but the frame
  // rather than flashing Login before we actually know one doesn't exist.
  if (userId === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      </SafeAreaView>
    );
  }

  if (!userId) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
        <LoginScreen />
      </SafeAreaView>
    );
  }

  // Authenticated, but still reading THIS user's own storage — render
  // nothing but the frame rather than guessing which screen (onboarding vs.
  // main app) belongs here.
  if (!userProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      </SafeAreaView>
    );
  }

  if (!userProfile.onboardingCompleted) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

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
            onUpdateUserProfile={async (partial) => setUserProfile(await saveUserProfile(partial))}
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
  splashContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center'
  },
  splashContent: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  splashLogo: {
    width: width * 0.55,
    height: 60,
    marginBottom: 12
  },
  splashTagline: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    letterSpacing: 1.2,
    textTransform: 'uppercase'
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  screenView: {
    flex: 1,
    backgroundColor: COLORS.bg
  }
});
