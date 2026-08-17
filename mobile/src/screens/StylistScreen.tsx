import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert
} from 'react-native';
import { Wand2, Sparkles, RefreshCw, Shirt, ArrowRight, AlertCircle } from 'lucide-react-native';
import { COLORS, RADIUS } from '../theme';
import { GarmentItem, WardrobeProfile, LayeringPreference, Outfit } from '../../../src/types/wardrobe';
import { loadUserWardrobe } from '../services/wardrobeStorage';
import { generateOutfitMobile, swapGarmentMobile, MobileOutfitResult } from '../services/outfitStylist';
import { loadSavedOutfits, saveOutfitToStorage, isSameOutfitItems } from '../services/savedOutfitsStorage';
import { recordRecentOutfit, getMostRecentExcludedGarmentIds } from '../services/outfitHistoryStorage';
import { OutfitResultCard } from '../components/OutfitResultCard';

const PROMPT_SUGGESTIONS = [
  'Date Night Minimal',
  'Relaxed Weekend',
  'Smart Presentation',
  'Streetwear Fit',
  'Monochrome Clean'
];

interface StylistScreenProps {
  profile?: WardrobeProfile;
  layeringPreference?: LayeringPreference;
  onNavigateToCollection?: () => void;
}

export const StylistScreen: React.FC<StylistScreenProps> = ({
  profile = 'men',
  layeringPreference = 'avoid',
  onNavigateToCollection
}) => {
  const [promptText, setPromptText] = useState('');
  const [wardrobe, setWardrobe] = useState<GarmentItem[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [selectedGarmentForSwap, setSelectedGarmentForSwap] = useState<GarmentItem | null>(null);
  const [outfitResult, setOutfitResult] = useState<{
    mode: 'gemini' | 'fallback';
    data: MobileOutfitResult;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load ONLY the current user's own wardrobe (uploads) on profile change —
  // see the identical note in TodayScreen.tsx (Mobile Sprint M10, Issue 3):
  // the seed/reference catalog must never be silently treated as owned.
  // Also clears any outfit on screen, since it may reference garments from
  // the profile being switched away from (Issue 2).
  useEffect(() => {
    async function loadData() {
      const user = await loadUserWardrobe(profile);
      setWardrobe(user);

      const saved = await loadSavedOutfits();
      setSavedOutfits(saved);
    }
    loadData();
    setOutfitResult(null);
    setErrorMessage(null);
    setSelectedGarmentForSwap(null);
  }, [profile]);

  const handleGenerateStylistOutfit = async () => {
    if (wardrobe.length === 0) return;

    setLoading(true);
    setErrorMessage(null);

    const query = promptText.trim() || 'Date Night Minimal';
    const recentExclude = await getMostRecentExcludedGarmentIds();
    const res = await generateOutfitMobile(query, wardrobe, layeringPreference, recentExclude);

    setLoading(false);
    if (res.ok && res.data && res.data.garmentIds.length > 0) {
      setOutfitResult({
        mode: res.mode,
        data: res.data
      });
      await recordRecentOutfit(res.data.garmentIds);
    } else {
      setErrorMessage(res.error || 'CLOSIQ Stylist could not generate a look right now.');
    }
  };

  // useCallback here isn't just style — OutfitResultCard is memoized
  // specifically so it doesn't re-render on every keystroke in the styling
  // brief textarea below, and that memo only holds if the handlers passed
  // to it keep a stable identity across those unrelated re-renders.
  const handleRegenerateOutfit = useCallback(async () => {
    if (!outfitResult || wardrobe.length === 0) return;

    setLoading(true);
    setErrorMessage(null);

    const query = promptText.trim() || 'Custom Stylist Look';
    const recentExclude = await getMostRecentExcludedGarmentIds();
    const excludeIds = Array.from(new Set([...outfitResult.data.garmentIds, ...recentExclude]));

    const res = await generateOutfitMobile(query, wardrobe, layeringPreference, excludeIds);

    setLoading(false);
    if (res.ok && res.data && res.data.garmentIds.length > 0) {
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
  }, [outfitResult, wardrobe, promptText, layeringPreference]);

  const handleSwapGarment = async (garment: GarmentItem) => {
    if (!outfitResult) return;

    setSelectedGarmentForSwap(null);
    setSwapping(true);

    const query = promptText.trim() || 'Custom Stylist Look';
    const currentIds = outfitResult.data.garmentIds;

    const res = await swapGarmentMobile(
      currentIds,
      garment.id,
      garment.category,
      query,
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
      Alert.alert('Swap Error', 'Unable to swap garment.');
    }
  };

  // Resolve garment IDs to actual GarmentItem objects. Memoized: this array
  // is a prop of the memoized OutfitResultCard below, and a fresh array
  // literal every render would defeat that memo just as surely as an
  // unstable callback would.
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
      id: `outfit-stylist-${Date.now()}`,
      title: outfitResult.data.title,
      occasion: promptText.trim() || 'AI Stylist Look',
      vibe: outfitResult.data.vibe,
      formalityLabel: 'Smart Casual',
      temperature: 72,
      items: resolvedGarments,
      styleScore: outfitResult.data.styleScore,
      explanation: {
        summary: outfitResult.data.explanation.summary,
        colorHarmony: outfitResult.data.explanation.colorHarmony || 'Balanced tones',
        silhouette: 'Proportional fit',
        weatherSuitability: 'Suitable for current climate',
        versatilityNote: 'High styling versatility'
      },
      saved: true,
      dateCreated: new Date().toISOString()
    };

    const updatedSaved = await saveOutfitToStorage(newOutfit);
    setSavedOutfits(updatedSaved);
    await recordRecentOutfit(resolvedGarments.map((i) => i.id));
  }, [outfitResult, resolvedGarments, promptText]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Wand2 size={24} color={COLORS.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.screenTitle}>AI Stylist Studio</Text>
          <Text style={styles.screenSubtitle}>
            Describe any vibe, occasion, or style requirement ({profile.toUpperCase()} Profile)
          </Text>
        </View>
      </View>

      {/* Empty Wardrobe Card */}
      {wardrobe.length === 0 ? (
        <View style={styles.emptyCard}>
          <Shirt size={32} color={COLORS.primary} style={{ marginBottom: 10 }} />
          <Text style={styles.emptyTitle}>Wardrobe Required</Text>
          <Text style={styles.emptyBody}>
            Upload or catalog your clothing items first so the AI Stylist can build personalized ensembles from what you own.
          </Text>
          <TouchableOpacity style={styles.emptyAddBtn} onPress={onNavigateToCollection}>
            <Text style={styles.emptyAddBtnText}>Add Items to Wardrobe</Text>
            <ArrowRight size={14} color="#FFFFFF" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Prompt Text Area */}
          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>Styling Brief</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 'I want a relaxed weekend outfit using my black denim', or 'first date dinner'..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              value={promptText}
              onChangeText={setPromptText}
            />

            {/* Quick Prompt Suggestion Chips */}
            <Text style={styles.chipsLabel}>Try a quick prompt:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
              {PROMPT_SUGGESTIONS.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={styles.suggestionChip}
                  onPress={() => setPromptText(suggestion)}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={styles.heroButton}
            activeOpacity={0.85}
            onPress={handleGenerateStylistOutfit}
            disabled={loading || swapping}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Sparkles size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.heroButtonText}>Style Outfit</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Loading / Swapping Box */}
          {(loading || swapping) && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginBottom: 12 }} />
              <Text style={styles.loadingTitle}>
                {swapping ? 'Finding a better match...' : 'CLOSIQ AI Stylist working...'}
              </Text>
              <Text style={styles.loadingSubtitle}>
                {swapping ? 'Swapping piece from your closet' : 'Formulating ensemble from your active catalog'}
              </Text>
            </View>
          )}

          {/* Error Message Box */}
          {errorMessage && !loading && !swapping && (
            <View style={styles.errorBox}>
              <AlertCircle size={18} color={COLORS.danger} style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Outfit Result Card Component */}
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

      {/* SWAP PIECE MODAL SHEET */}
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
    marginBottom: 20,
    gap: 12
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryAlpha,
    alignItems: 'center',
    justifyContent: 'center'
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary
  },
  screenSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2
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
  inputCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8
  },
  textInput: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: 12,
    fontSize: 13.5,
    color: COLORS.textPrimary,
    minHeight: 80,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12
  },
  chipsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 6
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6
  },
  suggestionText: {
    fontSize: 11.5,
    color: COLORS.textPrimary,
    fontWeight: '600'
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.pill,
    marginBottom: 20
  },
  heroButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
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
