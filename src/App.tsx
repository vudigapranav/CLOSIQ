import React, { useState, useEffect } from 'react';
import { AppHeader } from './components/ui/AppHeader';
import { BottomNavigation, NavTab } from './components/ui/BottomNavigation';
import { OnboardingScreen } from './components/screens/OnboardingScreen';
import { TodayScreen } from './components/screens/TodayScreen';
import { CollectionScreen } from './components/screens/CollectionScreen';
import { StylistScreen } from './components/screens/StylistScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { PlannerScreen } from './components/screens/PlannerScreen';
import { ClothingDetailModal } from './components/modals/ClothingDetailModal';
import { AddItemModal } from './components/modals/AddItemModal';
import { SplashScreen } from './components/ui/SplashScreen';
import { getProfileSeedWardrobe } from './data/garmentCatalog';
import { GarmentItem, Outfit, WardrobeProfile, LayeringPreference, WeekDay, WeeklyPlanEntry } from './types/wardrobe';
import { isSameOutfit } from './services/aiStylist';

const WEEK_DAYS: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function createEmptyWeeklyPlan(): WeeklyPlanEntry[] {
  return WEEK_DAYS.map((day) => ({ day, label: '' }));
}

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('today');

  // Shows on every mount of <App> (initial launch + every reload), never on
  // in-app tab navigation since those don't remount this component.
  const [showSplash, setShowSplash] = useState<boolean>(true);

  const [wardrobeProfile, setWardrobeProfile] = useState<WardrobeProfile | null>(() => {
    const saved = localStorage.getItem('closiq_wardrobe_profile');
    return saved ? (JSON.parse(saved) as WardrobeProfile) : null;
  });

  const [layeringPreference, setLayeringPreference] = useState<LayeringPreference>(() => {
    const saved = localStorage.getItem('closiq_layering_preference');
    return saved ? (JSON.parse(saved) as LayeringPreference) : 'sometimes';
  });

  const [wardrobe, setWardrobe] = useState<GarmentItem[]>(() => {
    const saved = localStorage.getItem('closiq_wardrobe');
    return saved ? JSON.parse(saved) : [];
  });

  const [savedOutfits, setSavedOutfits] = useState<Outfit[]>(() => {
    const saved = localStorage.getItem('closiq_saved_outfits');
    return saved ? JSON.parse(saved) : [];
  });

  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlanEntry[]>(() => {
    const saved = localStorage.getItem('closiq_weekly_plan');
    return saved ? (JSON.parse(saved) as WeeklyPlanEntry[]) : createEmptyWeeklyPlan();
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('closiq_dark_mode');
    return saved ? JSON.parse(saved) : false;
  });

  // Active restored outfit state for Today screen
  const [activeTodayOutfit, setActiveTodayOutfit] = useState<Outfit | null>(null);

  // Modal States
  const [selectedDetailItem, setSelectedDetailItem] = useState<GarmentItem | null>(null);
  const [isAddItemOpen, setIsAddItemOpen] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('closiq_wardrobe', JSON.stringify(wardrobe));
  }, [wardrobe]);

  useEffect(() => {
    localStorage.setItem('closiq_wardrobe_profile', JSON.stringify(wardrobeProfile));
  }, [wardrobeProfile]);

  useEffect(() => {
    localStorage.setItem('closiq_layering_preference', JSON.stringify(layeringPreference));
  }, [layeringPreference]);

  useEffect(() => {
    localStorage.setItem('closiq_saved_outfits', JSON.stringify(savedOutfits));
  }, [savedOutfits]);

  useEffect(() => {
    localStorage.setItem('closiq_weekly_plan', JSON.stringify(weeklyPlan));
  }, [weeklyPlan]);

  useEffect(() => {
    localStorage.setItem('closiq_dark_mode', JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [isDarkMode]);

  const handleToggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleAddGarment = (newItem: GarmentItem) => {
    setWardrobe((prev) => [newItem, ...prev]);
    setActiveTab('collection');
  };

  const handleDeleteItem = (id: string) => {
    setWardrobe((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSaveOutfit = (outfit: Outfit) => {
    setSavedOutfits((prev) => {
      if (prev.some((o) => isSameOutfit(o, outfit))) return prev;
      return [{ ...outfit, saved: true }, ...prev];
    });
  };

  const handleUnsaveOutfit = (outfit: Outfit) => {
    setSavedOutfits((prev) => prev.filter((o) => !isSameOutfit(o, outfit)));
  };

  const handleRemoveSavedOutfit = (id: string) => {
    setSavedOutfits((prev) => prev.filter((o) => o.id !== id));
  };

  // "Wear this" on Today — bumps wearCount for every item actually worn,
  // so Collection's "Worn N times" and the wardrobe-insights math stay real.
  const handleWearOutfit = (outfit: Outfit) => {
    const wornIds = new Set(outfit.items.map((i) => i.id));
    setWardrobe((prev) =>
      prev.map((item) => (wornIds.has(item.id) ? { ...item, wearCount: item.wearCount + 1 } : item))
    );
  };

  const handleWearAgainOutfit = (outfit: Outfit) => {
    handleWearOutfit(outfit);
    setActiveTodayOutfit(outfit);
    setActiveTab('today');
  };

  const handleUpdatePlanLabel = (day: WeekDay, label: string) => {
    setWeeklyPlan((prev) => prev.map((entry) => (entry.day === day ? { ...entry, label } : entry)));
  };

  const handleAssignPlanOutfit = (day: WeekDay, outfit: Outfit) => {
    setWeeklyPlan((prev) => prev.map((entry) => (entry.day === day ? { ...entry, outfit } : entry)));
  };

  const handleClearPlanOutfit = (day: WeekDay) => {
    setWeeklyPlan((prev) => prev.map((entry) => (entry.day === day ? { ...entry, outfit: undefined } : entry)));
  };

  const handleCompleteOnboarding = (profile: WardrobeProfile, layering: LayeringPreference) => {
    setWardrobeProfile(profile);
    setLayeringPreference(layering);
    setWardrobe((prev) => (prev.length > 0 ? prev : getProfileSeedWardrobe(profile)));
  };

  // Swaps the auto-seeded starter set for the new profile's, but never
  // touches anything the user photographed/uploaded/hand-picked themselves
  // (those never carry an `isSeedItem` flag).
  const handleChangeProfile = (profile: WardrobeProfile) => {
    if (profile === wardrobeProfile) return;
    setWardrobeProfile(profile);
    setWardrobe((prevWardrobe) => {
      const withoutOldSeed = prevWardrobe.filter((item) => !item.isSeedItem);
      const alreadyHasNewProfileItems = withoutOldSeed.some((item) => item.profile === profile);
      return alreadyHasNewProfileItems ? withoutOldSeed : [...withoutOldSeed, ...getProfileSeedWardrobe(profile)];
    });
  };

  const handleChangeLayeringPreference = (preference: LayeringPreference) => {
    setLayeringPreference(preference);
  };

  // Items with no `profile` tag are the user's own (upload or hand-picked) and
  // always visible; profile-tagged (seed) items only show for the active profile.
  const visibleWardrobe = wardrobeProfile
    ? wardrobe.filter((item) => !item.profile || item.profile === wardrobeProfile)
    : wardrobe;

  if (!wardrobeProfile) {
    return (
      <div className="app-shell">
        {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
        <OnboardingScreen onComplete={handleCompleteOnboarding} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

      {/* Centralized Brand App Header */}
      <AppHeader isDarkMode={isDarkMode} onToggleTheme={handleToggleTheme} />

      {/* Screen Presentation Layer */}
      <main style={{ flex: 1 }}>
        {activeTab === 'today' && (
          <TodayScreen
            wardrobe={visibleWardrobe}
            savedOutfits={savedOutfits}
            layeringPreference={layeringPreference}
            externalOutfit={activeTodayOutfit}
            onSaveOutfit={handleSaveOutfit}
            onUnsaveOutfit={handleUnsaveOutfit}
            onWearOutfit={handleWearOutfit}
            onOpenUpload={() => setIsAddItemOpen(true)}
            onNavigateToCollection={() => setActiveTab('collection')}
            onSelectItemDetail={(item) => setSelectedDetailItem(item)}
            onNavigateToProfile={() => setActiveTab('profile')}
          />
        )}
        {activeTab === 'collection' && (
          <CollectionScreen
            wardrobe={visibleWardrobe}
            onOpenAddItem={() => setIsAddItemOpen(true)}
            onSelectItem={(item) => setSelectedDetailItem(item)}
          />
        )}
        {activeTab === 'stylist' && (
          <StylistScreen
            wardrobe={visibleWardrobe}
            savedOutfits={savedOutfits}
            layeringPreference={layeringPreference}
            onSaveOutfit={handleSaveOutfit}
            onUnsaveOutfit={handleUnsaveOutfit}
            onSelectItemDetail={(item) => setSelectedDetailItem(item)}
            onOpenUpload={() => setIsAddItemOpen(true)}
          />
        )}
        {activeTab === 'planner' && (
          <PlannerScreen
            weeklyPlan={weeklyPlan}
            savedOutfits={savedOutfits}
            onUpdateLabel={handleUpdatePlanLabel}
            onAssignOutfit={handleAssignPlanOutfit}
            onClearOutfit={handleClearPlanOutfit}
            onNavigateToStylist={() => setActiveTab('stylist')}
          />
        )}
        {activeTab === 'profile' && (
          <ProfileScreen
            isDarkMode={isDarkMode}
            onToggleTheme={handleToggleTheme}
            wardrobe={visibleWardrobe}
            savedOutfits={savedOutfits}
            onRemoveSavedOutfit={handleRemoveSavedOutfit}
            onWearAgainOutfit={handleWearAgainOutfit}
            wardrobeProfile={wardrobeProfile}
            onChangeWardrobeProfile={handleChangeProfile}
            layeringPreference={layeringPreference}
            onChangeLayeringPreference={handleChangeLayeringPreference}
            onNavigateToCollection={() => setActiveTab('collection')}
            onNavigateToPlanner={() => setActiveTab('planner')}
          />
        )}
      </main>

      {/* Native-style Premium Bottom Navigation */}
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Clothing Detail Modal */}
      {selectedDetailItem && (
        <ClothingDetailModal
          item={selectedDetailItem}
          onClose={() => setSelectedDetailItem(null)}
          onDeleteItem={handleDeleteItem}
        />
      )}

      {/* Add Item Modal Flow */}
      {isAddItemOpen && (
        <AddItemModal
          wardrobeProfile={wardrobeProfile}
          onClose={() => setIsAddItemOpen(false)}
          onAddGarment={handleAddGarment}
        />
      )}
    </div>
  );
}
