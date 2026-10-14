import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { AppHeader } from './components/ui/AppHeader';
import { BottomNavigation, NavTab } from './components/ui/BottomNavigation';
import { OnboardingScreen, OnboardingResult } from './components/screens/OnboardingScreen';
import { TodayScreen } from './components/screens/TodayScreen';
import { CollectionScreen } from './components/screens/CollectionScreen';
import { StylistScreen } from './components/screens/StylistScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { PlannerScreen } from './components/screens/PlannerScreen';
import { LoginScreen } from './components/screens/LoginScreen';
import { ClothingDetailModal } from './components/modals/ClothingDetailModal';
import { AddItemModal } from './components/modals/AddItemModal';
import { SplashScreen } from './components/ui/SplashScreen';
import { ClosiqLogo } from './components/ui/ClosiqLogo';
import { PrimaryButton } from './components/ui/PrimaryButton';
import { GarmentItem, GarmentDetailsPatch, Outfit, WardrobeProfile, LayeringPreference, WeekDay, WeeklyPlanEntry } from './types/wardrobe';
import { isSameOutfit } from './services/aiStylist';
import { customStorageLocations } from './data/storageLocations';
import { supabase, isCloudConfigured } from './services/cloud/supabase';
import { signOut, updatePassword } from './services/cloud/auth';
import {
  loadWardrobe,
  addGarment,
  deleteGarment,
  updateGarment,
  loadSavedOutfits,
  saveOutfit,
  removeOutfit,
  loadPreferences,
  savePreferences,
  loadProfileBasics,
  saveProfileBasics,
  ProfileBasics
} from './services/cloud/wardrobeCloud';

const WEEK_DAYS: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function createEmptyWeeklyPlan(): WeeklyPlanEntry[] {
  return WEEK_DAYS.map((day) => ({ day, label: '' }));
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / storage full: the cloud copy is still authoritative.
  }
}

/**
 * Root (2026-10-13): splash → sign in → the signed-in app. Wardrobe, saved
 * looks and preferences live in the user's Supabase account (shared with the
 * mobile app); only the theme and the weekly planner stay in this browser.
 */
export function App() {
  // Shows on every mount of <App> (initial launch + every reload), never on
  // in-app tab navigation since those don't remount this component.
  const [showSplash, setShowSplash] = useState<boolean>(true);
  // undefined = still restoring a saved session.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [recoveringPassword, setRecoveringPassword] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => readLocal('closiq_dark_mode', false));

  useEffect(() => {
    writeLocal('closiq_dark_mode', isDarkMode);
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (!isCloudConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setRecoveringPassword(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const splash = showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />;

  if (!isCloudConfigured) {
    return (
      <div className="app-status">
        {splash}
        <ClosiqLogo width={170} />
        <h1 className="text-section-heading">Sign-in isn’t set up</h1>
        <p className="text-body" style={{ maxWidth: 420 }}>
          This build has no Supabase URL / anon key. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or
          SUPABASE_URL / SUPABASE_ANON_KEY) and rebuild.
        </p>
      </div>
    );
  }

  if (session === undefined) {
    return <div className="app-status">{splash}</div>;
  }

  if (recoveringPassword && session) {
    return (
      <>
        {splash}
        <SetNewPassword onDone={() => setRecoveringPassword(false)} />
      </>
    );
  }

  if (!session) {
    return (
      <>
        {splash}
        <LoginScreen />
      </>
    );
  }

  // Keyed by user: a different account gets a fresh tree, so nothing from
  // the previous user's state can leak into the next one.
  return (
    <>
      {splash}
      <SignedInApp
        key={session.user.id}
        user={session.user}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode((prev) => !prev)}
      />
    </>
  );
}

const SetNewPassword: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return setMessage('Use a password with at least 6 characters.');
    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);
    if (result.ok) onDone();
    else setMessage(result.message || 'Couldn’t update your password.');
  };

  return (
    <div className="login-layout">
      <form className="login-card" onSubmit={submit}>
        <h1 className="text-screen-heading" style={{ marginBottom: 6 }}>Choose a new password</h1>
        <p className="text-body" style={{ marginBottom: 18 }}>You followed a reset link. Pick a new password to finish.</p>
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: '100%', padding: '13px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-medium)', backgroundColor: 'var(--color-surface-elevated)', color: 'var(--color-text-primary)', marginBottom: 12 }}
        />
        {message && <p role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.84rem', marginBottom: 12 }}>{message}</p>}
        <PrimaryButton fullWidth type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</PrimaryButton>
      </form>
    </div>
  );
};

interface SignedInAppProps {
  user: User;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

const SignedInApp: React.FC<SignedInAppProps> = ({ user, isDarkMode, onToggleTheme }) => {
  const userId = user.id;
  const [activeTab, setActiveTab] = useState<NavTab>('today');

  // 'loading' until preferences are read; a null profile means onboarding.
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [wardrobeProfile, setWardrobeProfile] = useState<WardrobeProfile | null>(null);
  const [layeringPreference, setLayeringPreference] = useState<LayeringPreference>('sometimes');
  const [wardrobe, setWardrobe] = useState<GarmentItem[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<Outfit[]>([]);
  const [basics, setBasics] = useState<ProfileBasics>({ name: '', stylePreferences: [] });
  const [notice, setNotice] = useState<string | null>(null);

  // The weekly planner is browser-local (the mobile app's planner is a
  // different, event-based model), kept per account.
  const planKey = `closiq_weekly_plan:${userId}`;
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlanEntry[]>(() => readLocal(planKey, createEmptyWeeklyPlan()));
  useEffect(() => writeLocal(planKey, weeklyPlan), [planKey, weeklyPlan]);

  // Active restored outfit state for Today screen
  const [activeTodayOutfit, setActiveTodayOutfit] = useState<Outfit | null>(null);

  // Modal States
  const [selectedDetailItem, setSelectedDetailItem] = useState<GarmentItem | null>(null);
  const [isAddItemOpen, setIsAddItemOpen] = useState<boolean>(false);

  const fail = useCallback((what: string, err: unknown) => {
    console.warn(`[CLOSIQ cloud] ${what}:`, err);
    setNotice(`${what}. Check your connection and try again.`);
  }, []);

  const loadAll = useCallback(async () => {
    setStatus('loading');
    try {
      const [prefs, profileBasics] = await Promise.all([loadPreferences(userId), loadProfileBasics(userId)]);
      setBasics(profileBasics);
      if (prefs) {
        setWardrobeProfile(prefs.profile);
        setLayeringPreference(prefs.layeringPreference);
        const [items, looks] = await Promise.all([loadWardrobe(userId, prefs.profile), loadSavedOutfits(userId)]);
        setWardrobe(items);
        setSavedOutfits(looks);
      }
      setStatus('ready');
    } catch (err) {
      console.warn('[CLOSIQ cloud] Initial load failed:', err);
      setStatus('error');
    }
  }, [userId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Size / place edits are saved as the user types; coalesce them per item.
  const pendingDetails = useRef(new Map<string, { patch: GarmentDetailsPatch; timer: number }>());
  useEffect(() => {
    const pending = pendingDetails.current;
    return () => pending.forEach(({ timer }) => window.clearTimeout(timer));
  }, []);

  const handleAddGarment = async (newItem: GarmentItem) => {
    if (!wardrobeProfile) return;
    setWardrobe((prev) => [newItem, ...prev]);
    setActiveTab('collection');
    try {
      const saved = await addGarment(userId, wardrobeProfile, newItem);
      setWardrobe((prev) => prev.map((item) => (item.id === saved.id ? saved : item)));
    } catch (err) {
      setWardrobe((prev) => prev.filter((item) => item.id !== newItem.id));
      fail('Couldn’t save that item to your account', err);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!wardrobeProfile) return;
    const item = wardrobe.find((i) => i.id === id);
    if (!item) return;
    setWardrobe((prev) => prev.filter((i) => i.id !== id));
    try {
      await deleteGarment(userId, wardrobeProfile, item);
    } catch (err) {
      setWardrobe((prev) => [item, ...prev]);
      fail('Couldn’t remove that item', err);
    }
  };

  const handleUpdateItem = (id: string, patch: GarmentDetailsPatch) => {
    setWardrobe((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setSelectedDetailItem((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
    if (!wardrobeProfile) return;
    const profile = wardrobeProfile;
    const pending = pendingDetails.current;
    const existing = pending.get(id);
    if (existing) window.clearTimeout(existing.timer);
    const merged = { ...(existing?.patch || {}), ...patch };
    const timer = window.setTimeout(() => {
      pending.delete(id);
      updateGarment(userId, profile, id, merged).catch((err) => fail('Couldn’t save that change', err));
    }, 600);
    pending.set(id, { patch: merged, timer });
  };

  const handleSaveOutfit = async (outfit: Outfit) => {
    if (savedOutfits.some((o) => isSameOutfit(o, outfit))) return;
    const saved = { ...outfit, saved: true };
    setSavedOutfits((prev) => [saved, ...prev]);
    try {
      await saveOutfit(userId, saved);
    } catch (err) {
      setSavedOutfits((prev) => prev.filter((o) => o.id !== saved.id));
      fail('Couldn’t save that look', err);
    }
  };

  const removeSaved = async (target: Outfit) => {
    setSavedOutfits((prev) => prev.filter((o) => o.id !== target.id));
    try {
      await removeOutfit(userId, target.id);
    } catch (err) {
      setSavedOutfits((prev) => [target, ...prev]);
      fail('Couldn’t remove that look', err);
    }
  };

  const handleUnsaveOutfit = (outfit: Outfit) => {
    const match = savedOutfits.find((o) => isSameOutfit(o, outfit));
    if (match) removeSaved(match);
  };

  const handleRemoveSavedOutfit = (id: string) => {
    const match = savedOutfits.find((o) => o.id === id);
    if (match) removeSaved(match);
  };

  // "Wear this" on Today — bumps wearCount for every item actually worn,
  // so Collection's "Worn N times" and the wardrobe-insights math stay real.
  const handleWearOutfit = (outfit: Outfit) => {
    if (!wardrobeProfile) return;
    const profile = wardrobeProfile;
    const today = new Date().toISOString().split('T')[0];
    const wornIds = new Set(outfit.items.map((i) => i.id));
    const updates = wardrobe
      .filter((item) => wornIds.has(item.id))
      .map((item) => ({ id: item.id, wearCount: item.wearCount + 1 }));
    setWardrobe((prev) =>
      prev.map((item) => (wornIds.has(item.id) ? { ...item, wearCount: item.wearCount + 1, lastWornDate: today } : item))
    );
    Promise.all(updates.map((u) => updateGarment(userId, profile, u.id, { wearCount: u.wearCount, lastWornDate: today }))).catch(
      (err) => fail('Couldn’t record what you wore', err)
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

  const persistPreferences = (profile: WardrobeProfile, layering: LayeringPreference) =>
    savePreferences(userId, { profile, layeringPreference: layering }).catch((err) => fail('Couldn’t save your preferences', err));

  const handleCompleteOnboarding = async ({ profile, layering, name, stylePreferences }: OnboardingResult) => {
    setLayeringPreference(layering);
    const nextBasics = { name: name || basics.name, stylePreferences };
    setBasics(nextBasics);
    await Promise.all([
      persistPreferences(profile, layering),
      saveProfileBasics(userId, nextBasics).catch((err) => fail('Couldn’t save your style answers', err))
    ]);
    setWardrobeProfile(profile);
    try {
      // A new account's wardrobe starts empty — CLOSIQ styles what you own.
      const [items, looks] = await Promise.all([loadWardrobe(userId, profile), loadSavedOutfits(userId)]);
      setWardrobe(items);
      setSavedOutfits(looks);
    } catch (err) {
      fail('Couldn’t load your wardrobe', err);
    }
  };

  // Each profile (Men/Women) is its own wardrobe in the account.
  const handleChangeProfile = async (profile: WardrobeProfile) => {
    if (profile === wardrobeProfile) return;
    setWardrobeProfile(profile);
    setWardrobe([]);
    persistPreferences(profile, layeringPreference);
    try {
      setWardrobe(await loadWardrobe(userId, profile));
    } catch (err) {
      fail('Couldn’t load that wardrobe', err);
    }
  };

  const handleChangeLayeringPreference = (preference: LayeringPreference) => {
    setLayeringPreference(preference);
    if (wardrobeProfile) persistPreferences(wardrobeProfile, preference);
  };

  // Items with no `profile` tag are the user's own (upload or hand-picked) and
  // always visible; profile-tagged (seed) items only show for the active profile.
  const visibleWardrobe = wardrobeProfile
    ? wardrobe.filter((item) => !item.profile || item.profile === wardrobeProfile)
    : wardrobe;

  if (status === 'loading') {
    return (
      <div className="app-status">
        <ClosiqLogo width={150} />
        <p className="text-body">Opening your wardrobe…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="app-status">
        <ClosiqLogo width={150} />
        <h1 className="text-section-heading">Couldn’t load your wardrobe</h1>
        <p className="text-body">Check your connection. Your clothes are safe in your account.</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <PrimaryButton onClick={loadAll}>Try again</PrimaryButton>
          <PrimaryButton onClick={signOut} style={{ backgroundColor: 'var(--color-surface-subtle)', color: 'var(--color-text-primary)' }}>
            Sign out
          </PrimaryButton>
        </div>
      </div>
    );
  }

  if (!wardrobeProfile) {
    return (
      <div className="app-shell">
        <OnboardingScreen onComplete={handleCompleteOnboarding} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Centralized Brand App Header */}
      <AppHeader isDarkMode={isDarkMode} onToggleTheme={onToggleTheme} />

      {notice && (
        <div
          role="alert"
          style={{
            margin: '12px 20px 0',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(168, 73, 59, 0.10)',
            color: 'var(--color-danger)',
            fontSize: '0.84rem',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          <span>{notice}</span>
          <button
            onClick={() => setNotice(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', fontWeight: 700, cursor: 'pointer' }}
          >
            Dismiss
          </button>
        </div>
      )}

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
            onToggleTheme={onToggleTheme}
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
            userEmail={user.email}
            userName={basics.name}
            stylePreferences={basics.stylePreferences}
            onSignOut={signOut}
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
          onUpdateItem={handleUpdateItem}
          customPlaces={customStorageLocations(wardrobe)}
        />
      )}

      {/* Add Item Modal Flow */}
      {isAddItemOpen && (
        <AddItemModal
          wardrobeProfile={wardrobeProfile}
          customPlaces={customStorageLocations(wardrobe)}
          onClose={() => setIsAddItemOpen(false)}
          onAddGarment={handleAddGarment}
        />
      )}
    </div>
  );
};
