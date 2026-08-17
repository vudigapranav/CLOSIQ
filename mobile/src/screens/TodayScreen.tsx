import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Modal,
  Dimensions,
  Alert
} from 'react-native';
import { Sparkles, Calendar, Thermometer, Shirt, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react-native';
import { COLORS, RADIUS } from '../theme';
import { GarmentItem, WardrobeProfile, LayeringPreference, Outfit } from '../../../src/types/wardrobe';
import { loadUserWardrobe } from '../services/wardrobeStorage';
import { generateOutfitMobile, swapGarmentMobile, MobileOutfitResult } from '../services/outfitStylist';
import { loadSavedOutfits, saveOutfitToStorage, isSameOutfitItems } from '../services/savedOutfitsStorage';
import { recordRecentOutfit, getMostRecentExcludedGarmentIds } from '../services/outfitHistoryStorage';
import { OutfitResultCard } from '../components/OutfitResultCard';
import { TemperatureUnit } from '../types/onboarding';
import { WeatherData, WeatherFetchStatus } from '../types/weather';
import { fetchCurrentWeather, celsiusToFahrenheit } from '../services/weatherService';

const { width } = Dimensions.get('window');

const OCCASIONS = [
  'College',
  'Work',
  'Date',
  'Party',
  'Casual',
  'Travel'
];

/** 05:00–11:59 morning, 12:00–16:59 afternoon, 17:00–20:59 evening, 21:00–04:59 night — device local clock. */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  if (hour >= 17 && hour < 21) return 'Good Evening';
  return 'Good Night';
}

// Real weather's canonical unit is always Celsius (see weatherService.ts) —
// this only ever converts for display, never fetches or stores a second unit.
function formatWeatherTemperature(celsius: number, unit: TemperatureUnit): string {
  if (unit === 'fahrenheit') {
    return `${celsiusToFahrenheit(celsius)}°F`;
  }
  return `${Math.round(celsius)}°C`;
}

interface TodayScreenProps {
  profile: WardrobeProfile;
  layeringPreference?: LayeringPreference;
  wearAgainOutfit?: Outfit | null;
  userName?: string;
  temperatureUnit?: TemperatureUnit;
  onNavigateToCollection?: () => void;
}

export const TodayScreen: React.FC<TodayScreenProps> = ({
  profile,
  layeringPreference = 'avoid',
  wearAgainOutfit,
  userName,
  temperatureUnit = 'celsius',
  onNavigateToCollection
}) => {
  const [selectedOccasion, setSelectedOccasion] = useState('College');
  const [customPrompt, setCustomPrompt] = useState('');
  const [wardrobe, setWardrobe] = useState<GarmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [selectedGarmentForSwap, setSelectedGarmentForSwap] = useState<GarmentItem | null>(null);
  const [savedOutfits, setSavedOutfits] = useState<Outfit[]>([]);
  const [outfitResult, setOutfitResult] = useState<{
    mode: 'gemini' | 'fallback';
    data: MobileOutfitResult;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<WeatherFetchStatus | 'loading'>('loading');

  // Fetches once per mount — Today unmounts/remounts on every tab visit
  // (App.tsx renders screens as plain conditional JSX, no persistent
  // navigator, per Sprint M10's State Synchronization finding), which
  // already gives this the "fetch on startup/focus" behavior the brief asks
  // for. fetchCurrentWeather() itself throttles against its own cache, so
  // rapid tab-switching does not re-hit the network every time.
  useEffect(() => {
    let cancelled = false;
    fetchCurrentWeather().then((res) => {
      if (cancelled) return;
      setWeather(res.weather);
      setWeatherStatus(res.status);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // If Wear Again is passed from Profile, display saved outfit context
  useEffect(() => {
    if (wearAgainOutfit) {
      setSelectedOccasion(wearAgainOutfit.occasion);
      setOutfitResult({
        mode: 'fallback',
        data: {
          title: wearAgainOutfit.title,
          vibe: wearAgainOutfit.vibe,
          styleScore: wearAgainOutfit.styleScore,
          garmentIds: wearAgainOutfit.items.map((i) => i.id),
          explanation: {
            summary: wearAgainOutfit.explanation.summary,
            colorHarmony: wearAgainOutfit.explanation.colorHarmony
          }
        }
      });
    }
  }, [wearAgainOutfit]);

  // Load ONLY the current user's own wardrobe (uploads) on profile change — the
  // seed/reference catalog is deliberately never merged in here. It used to be
  // (`[...userItems, ...seedItems]`), which meant Today could generate real
  // outfits from garments that never appeared as "owned" in Collection (which
  // only ever shows uploads) — a confirmed product bug, not a display quirk.
  // Also clears any outfit currently on screen: it may reference garments from
  // the profile being switched away from, which would otherwise survive the
  // switch and render with missing images once resolved against the new
  // wardrobe (see Mobile Sprint M10, Issue 2).
  useEffect(() => {
    async function loadData() {
      const userItems = await loadUserWardrobe(profile);
      setWardrobe(userItems);

      const saved = await loadSavedOutfits();
      setSavedOutfits(saved);
    }
    loadData();
    setOutfitResult(null);
    setErrorMessage(null);
    setSelectedGarmentForSwap(null);
  }, [profile]);

  const handleGenerateOutfit = async () => {
    if (wardrobe.length === 0) return;

    setLoading(true);
    setErrorMessage(null);

    const promptText = customPrompt.trim() || `${selectedOccasion} occasion`;
    // Lightweight anti-repeat memory: exclude whatever combination was most
    // recently shown (persisted, so this holds across app restarts — the
    // in-memory-only version of this only ever protected a single session).
    const recentExclude = await getMostRecentExcludedGarmentIds();
    const res = await generateOutfitMobile(promptText, wardrobe, layeringPreference, recentExclude);

    setLoading(false);
    if (res.ok && res.data && res.data.garmentIds.length > 0) {
      setOutfitResult({
        mode: res.mode,
        data: res.data
      });
      await recordRecentOutfit(res.data.garmentIds);
    } else {
      setErrorMessage(res.error || 'CLOSIQ couldn’t build a look right now. Try again.');
    }
  };

  // useCallback here isn't just style — OutfitResultCard is memoized
  // specifically so it doesn't re-render on every keystroke in the prompt
  // input below, and that memo only holds if the handlers passed to it keep
  // a stable identity across those unrelated re-renders.
  const handleRegenerateOutfit = useCallback(async () => {
    if (!outfitResult || wardrobe.length === 0) return;

    setLoading(true);
    setErrorMessage(null);

    const promptText = customPrompt.trim() || `${selectedOccasion} occasion`;
    const recentExclude = await getMostRecentExcludedGarmentIds();
    const excludeIds = Array.from(new Set([...outfitResult.data.garmentIds, ...recentExclude]));

    const res = await generateOutfitMobile(promptText, wardrobe, layeringPreference, excludeIds);

    setLoading(false);
    if (res.ok && res.data && res.data.garmentIds.length > 0) {
      // Check if new outfit is identical due to small wardrobe
      if (isSameOutfitItems(res.data.garmentIds, excludeIds)) {
        Alert.alert('Limited Wardrobe', 'Your wardrobe is a little limited for another distinct look.');
      }
      setOutfitResult({
        mode: res.mode,
        data: res.data
      });
      await recordRecentOutfit(res.data.garmentIds);
    } else {
      setErrorMessage(res.error || 'Unable to regenerate look.');
    }
  }, [outfitResult, wardrobe, customPrompt, selectedOccasion, layeringPreference]);

  const handleSwapGarment = async (garment: GarmentItem) => {
    if (!outfitResult) return;

    setSelectedGarmentForSwap(null);
    setSwapping(true);

    const promptText = customPrompt.trim() || `${selectedOccasion} occasion`;
    const currentIds = outfitResult.data.garmentIds;

    const res = await swapGarmentMobile(
      currentIds,
      garment.id,
      garment.category,
      promptText,
      wardrobe
    );

    setSwapping(false);
    if (res.ok && res.data && res.data.replacementGarmentId) {
      const updatedGarmentIds = currentIds.map((id) =>
        id === garment.id ? res.data.replacementGarmentId : id
      );

      setOutfitResult({
        mode: res.mode,
        data: {
          ...outfitResult.data,
          title: res.data.outfitTitle || outfitResult.data.title,
          garmentIds: updatedGarmentIds,
          explanation: {
            ...outfitResult.data.explanation,
            summary: res.data.whyItWorks
          }
        }
      });
    } else {
      Alert.alert('Swap Error', 'Unable to swap garment. Please try again.');
    }
  };

  // Resolve garment IDs to actual GarmentItem objects. Memoized: this array
  // is a prop of the memoized OutfitResultCard below, and a fresh array
  // literal every render (the old behavior) would defeat that memo just as
  // surely as an unstable callback would.
  const resolvedGarments: GarmentItem[] = useMemo(
    () =>
      outfitResult
        ? outfitResult.data.garmentIds
            .map((id) => wardrobe.find((item) => item.id === id))
            .filter((item): item is GarmentItem => Boolean(item))
        : [],
    [outfitResult, wardrobe]
  );

  const isCurrentOutfitSaved = useMemo(
    () =>
      outfitResult
        ? savedOutfits.some((o) => isSameOutfitItems(o.items.map((i) => i.id), outfitResult.data.garmentIds))
        : false,
    [outfitResult, savedOutfits]
  );

  const handleSaveOutfit = useCallback(async () => {
    if (!outfitResult || resolvedGarments.length === 0) return;

    const newOutfit: Outfit = {
      id: `outfit-${Date.now()}`,
      title: outfitResult.data.title,
      occasion: selectedOccasion,
      vibe: outfitResult.data.vibe,
      formalityLabel: 'Smart Casual',
      // Real reading when we have one (rounded, canonical Celsius — the
      // Outfit type's `temperature` field is not itself unit-aware); never
      // invented when weather is unavailable, since this field isn't shown
      // anywhere in the mobile UI (only `weatherSuitability` below is), so
      // there is nothing user-facing to fabricate either way.
      temperature: weather ? Math.round(weather.temperatureCelsius) : 0,
      items: resolvedGarments,
      styleScore: outfitResult.data.styleScore,
      explanation: {
        summary: outfitResult.data.explanation.summary,
        colorHarmony: outfitResult.data.explanation.colorHarmony || 'Balanced tones',
        silhouette: 'Proportional fit',
        weatherSuitability: weather
          ? `Suitable for ${formatWeatherTemperature(weather.temperatureCelsius, temperatureUnit)} • ${weather.condition}`
          : 'Suitable for current conditions',
        versatilityNote: 'High pairing versatility'
      },
      saved: true,
      dateCreated: new Date().toISOString()
    };

    const updatedSaved = await saveOutfitToStorage(newOutfit);
    setSavedOutfits(updatedSaved);
    await recordRecentOutfit(resolvedGarments.map((i) => i.id));
  }, [outfitResult, resolvedGarments, selectedOccasion, temperatureUnit, weather]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Bar */}
      <View style={styles.header}>
        <Image
          source={require('../../assets/closiq-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.dateBadge}>
          <Calendar size={12} color={COLORS.primary} />
          <Text style={styles.dateText}>Today</Text>
        </View>
      </View>

      {/* Greeting & Headline */}
      <View style={styles.greetingSection}>
        <Text style={styles.greetingText}>
          {userName && userName.trim() ? `${getGreeting()}, ${userName.trim()}.` : getGreeting()}
        </Text>
        <Text style={styles.headlineText}>What should I wear?</Text>
        <Text style={styles.subheadlineText}>
          CLOSIQ knows your closet ({wardrobe.length} items cataloged) and styles tailored outfits.
        </Text>
      </View>

      {/* Weather Strip — real device-aware weather (Open-Meteo), loads
          asynchronously and never blocks the rest of the screen. */}
      <View style={styles.weatherStrip}>
        {weatherStatus === 'loading' ? (
          <>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.weatherText}>Getting local weather…</Text>
          </>
        ) : weather ? (
          <>
            <Thermometer size={16} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.weatherText}>
                {weather.locationName ? `${weather.locationName} — ` : ''}
                {formatWeatherTemperature(weather.temperatureCelsius, temperatureUnit)} • {weather.condition}
              </Text>
              {weather.source === 'cached' && (
                <Text style={styles.weatherSubtext}>Last known conditions</Text>
              )}
            </View>
          </>
        ) : (
          <>
            <Thermometer size={16} color={COLORS.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.weatherText}>Weather unavailable</Text>
              {weatherStatus === 'permission-denied' && (
                <Text style={styles.weatherSubtext}>Enable location to get local weather.</Text>
              )}
            </View>
          </>
        )}
        <View style={styles.weatherBadge}>
          <Text style={styles.weatherBadgeText}>Layering: {layeringPreference}</Text>
        </View>
      </View>

      {/* Empty Wardrobe Block */}
      {wardrobe.length === 0 ? (
        <View style={styles.emptyCard}>
          <Shirt size={32} color={COLORS.primary} style={{ marginBottom: 10 }} />
          <Text style={styles.emptyTitle}>Your wardrobe is waiting.</Text>
          <Text style={styles.emptyBody}>
            Add at least 2 tops and 2 bottoms to start styling.
          </Text>
          <TouchableOpacity
            style={styles.emptyAddBtn}
            onPress={onNavigateToCollection}
          >
            <Text style={styles.emptyAddBtnText}>Add Items</Text>
            <ArrowRight size={14} color="#FFFFFF" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Occasion Rail */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Occasion</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRail}
            >
              {OCCASIONS.map((occasion) => {
                const isSelected = selectedOccasion === occasion;
                return (
                  <TouchableOpacity
                    key={occasion}
                    style={[styles.chip, isSelected && styles.selectedChip]}
                    activeOpacity={0.75}
                    onPress={() => {
                      setSelectedOccasion(occasion);
                      setCustomPrompt('');
                    }}
                  >
                    <Text style={[styles.chipText, isSelected && styles.selectedChipText]}>
                      {occasion}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Optional Free-Form Request Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Specific Request (Optional)</Text>
            <View style={styles.inputCard}>
              <TextInput
                style={styles.textInput}
                placeholder={`e.g. ${selectedOccasion} presentation tomorrow, chilly evening walk, or airport travel...`}
                placeholderTextColor={COLORS.textMuted}
                value={customPrompt}
                onChangeText={setCustomPrompt}
              />
            </View>

            {/* Generate Action Button */}
            <TouchableOpacity
              style={styles.generateButton}
              activeOpacity={0.85}
              onPress={handleGenerateOutfit}
              disabled={loading || swapping}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Sparkles size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.generateButtonText}>
                    Generate {customPrompt.trim() ? 'Custom' : selectedOccasion} Outfit
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Loading / Swapping State */}
          {(loading || swapping) && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginBottom: 12 }} />
              <Text style={styles.loadingTitle}>
                {swapping ? 'Finding a better match...' : 'Building your look...'}
              </Text>
              <Text style={styles.loadingSubtitle}>
                {swapping ? 'Swapping piece from your wardrobe' : 'Styling pieces from your cataloged wardrobe'}
              </Text>
            </View>
          )}

          {/* Error View */}
          {errorMessage && !loading && !swapping && (
            <View style={styles.errorBox}>
              <AlertCircle size={18} color={COLORS.danger} style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* OUTFIT RESULT HERO CARD */}
          {outfitResult && !loading && !swapping && (
            <OutfitResultCard
              mode={outfitResult.mode}
              title={outfitResult.data.title}
              vibe={outfitResult.data.vibe}
              styleScore={outfitResult.data.styleScore}
              garments={resolvedGarments}
              explanation={outfitResult.data.explanation}
              isSaved={isCurrentOutfitSaved}
              onSelectGarmentForSwap={setSelectedGarmentForSwap}
              onRegenerate={handleRegenerateOutfit}
              onSave={handleSaveOutfit}
            />
          )}
        </>
      )}

      {/* SWAP PIECE MODAL */}
      <Modal
        visible={Boolean(selectedGarmentForSwap)}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedGarmentForSwap(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {selectedGarmentForSwap && (
              <>
                <Text style={styles.modalCategory}>{selectedGarmentForSwap.category.toUpperCase()}</Text>
                <Text style={styles.modalTitle}>{selectedGarmentForSwap.name}</Text>
                <Text style={styles.modalSubtitle}>{selectedGarmentForSwap.color} • {selectedGarmentForSwap.fabric}</Text>

                <View style={styles.modalActionRow}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setSelectedGarmentForSwap(null)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalSwapBtn}
                    onPress={() => handleSwapGarment(selectedGarmentForSwap)}
                  >
                    <RefreshCw size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.modalSwapText}>Swap This Piece</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  logo: {
    width: 110,
    height: 34
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  dateText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.primary
  },
  greetingSection: {
    marginBottom: 18
  },
  greetingText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4
  },
  headlineText: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
    marginBottom: 6
  },
  subheadlineText: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
    lineHeight: 19
  },
  weatherStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
    gap: 8
  },
  weatherText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1
  },
  weatherSubtext: {
    fontSize: 10.5,
    color: COLORS.textMuted,
    marginTop: 1
  },
  weatherBadge: {
    backgroundColor: COLORS.primaryAlpha,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill
  },
  weatherBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'capitalize'
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6
  },
  emptyBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: RADIUS.pill
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  section: {
    marginBottom: 20
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10
  },
  chipRail: {
    gap: 8,
    paddingVertical: 4
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  selectedChip: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary
  },
  selectedChipText: {
    color: '#FFFFFF'
  },
  inputCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12
  },
  textInput: {
    fontSize: 13.5,
    color: COLORS.textPrimary,
    minHeight: 40
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.pill
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  loadingBox: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4
  },
  loadingSubtitle: {
    fontSize: 12.5,
    color: COLORS.textSecondary
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    padding: 14,
    borderRadius: RADIUS.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.danger,
    marginBottom: 20
  },
  errorText: {
    fontSize: 12.5,
    color: COLORS.textPrimary,
    flex: 1
  },
  resultContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24
  },
  resultHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2
  },
  modeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 2
  },
  resultVibe: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic'
  },
  matchScoreBadge: {
    backgroundColor: COLORS.primaryAlpha,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill
  },
  matchScoreText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary
  },
  piecesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10
  },
  garmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16
  },
  garmentCard: {
    width: (width - 70) / 2,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  garmentImgFrame: {
    width: '100%',
    height: 110,
    position: 'relative',
    backgroundColor: COLORS.surface
  },
  garmentImg: {
    width: '100%',
    height: '100%'
  },
  catTag: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3
  },
  catTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  swapBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  garmentInfo: {
    padding: 8
  },
  garmentName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4
  },
  garmentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)'
  },
  garmentColor: {
    fontSize: 10.5,
    color: COLORS.textSecondary
  },
  whyItWorksBox: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.md,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    marginBottom: 18
  },
  whyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  whyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary
  },
  whySummary: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 18,
    marginBottom: 4
  },
  whyDetail: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    marginTop: 2
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10
  },
  regenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  regenerateBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary
  },
  savedBtn: {
    backgroundColor: COLORS.accent
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end'
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  modalCategory: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.8,
    marginBottom: 2
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 20
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12
  },
  modalCancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary
  },
  modalSwapBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary
  },
  modalSwapText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
