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
import { COLORS } from './src/theme';
import { BottomNavigation, NavTab } from './src/components/BottomNavigation';
import { TodayScreen } from './src/screens/TodayScreen';
import { CollectionScreen } from './src/screens/CollectionScreen';
import { StylistScreen } from './src/screens/StylistScreen';
import { PlannerScreen } from './src/screens/PlannerScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { OnboardingScreen, OnboardingResult } from './src/screens/OnboardingScreen';
import { WardrobeProfile, LayeringPreference, Outfit } from '../src/types/wardrobe';
import { loadProfileSettings, saveProfileSettings } from './src/services/profileSettingsStorage';
import { recordRecentOutfit } from './src/services/outfitHistoryStorage';
import { loadUserProfile, saveUserProfile } from './src/services/userProfileStorage';
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

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Load persistent profile settings + onboarding/user profile on app launch
  useEffect(() => {
    loadProfileSettings().then((settings) => {
      setProfile(settings.profile);
      setLayeringPreference(settings.layeringPreference);
    });
    loadUserProfile().then(setUserProfile);
  }, []);

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

  // Still reading storage — render nothing but the frame rather than
  // guessing which screen (onboarding vs. main app) belongs here.
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
            onNavigateToCollection={() => setActiveTab('collection')}
          />
        )}
        {activeTab === 'collection' && <CollectionScreen profile={profile} />}
        {activeTab === 'planner' && (
          <PlannerScreen
            profile={profile}
            layeringPreference={layeringPreference}
            userProfile={userProfile}
            onUseForToday={handleWearAgain}
            onNavigateToCollection={() => setActiveTab('collection')}
          />
        )}
        {activeTab === 'stylist' && (
          <StylistScreen
            profile={profile}
            layeringPreference={layeringPreference}
            userProfile={userProfile}
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
