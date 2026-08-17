import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Image
} from 'react-native';
import { User, Layers, Heart, Sparkles, Shirt, ChevronRight, Bookmark, Pencil, X, Check } from 'lucide-react-native';
import { COLORS, RADIUS } from '../theme';
import { WardrobeProfile, LayeringPreference, Outfit, GarmentItem } from '../../../src/types/wardrobe';
import { loadUserWardrobe } from '../services/wardrobeStorage';
import { loadSavedOutfits, removeSavedOutfitFromStorage } from '../services/savedOutfitsStorage';
import { SavedLookDetailModal } from '../components/SavedLookDetailModal';
import { BodyTypeOptionCard } from '../components/BodyTypeOptionCard';
import {
  UserProfileData,
  BodyType,
  SkinTone,
  StylePreference,
  TemperatureUnit,
  BODY_TYPE_OPTIONS,
  SKIN_TONE_OPTIONS,
  STYLE_PREFERENCE_OPTIONS
} from '../types/onboarding';

interface ProfileScreenProps {
  profile: WardrobeProfile;
  layeringPreference: LayeringPreference;
  onProfileChange: (p: WardrobeProfile) => void;
  onLayeringChange: (l: LayeringPreference) => void;
  onWearAgain: (outfit: Outfit) => void;
  onNavigateToToday: () => void;
  userProfile: UserProfileData;
  onUpdateUserProfile: (partial: Partial<UserProfileData>) => Promise<void>;
}

const BODY_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  BODY_TYPE_OPTIONS.map((o) => [o.value, o.label])
);
const SKIN_TONE_LABEL: Record<string, string> = Object.fromEntries(
  SKIN_TONE_OPTIONS.map((o) => [o.value, o.label])
);
const STYLE_PREFERENCE_LABEL: Record<string, string> = Object.fromEntries(
  STYLE_PREFERENCE_OPTIONS.map((o) => [o.value, o.label])
);

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  profile,
  layeringPreference,
  onProfileChange,
  onLayeringChange,
  onWearAgain,
  onNavigateToToday,
  userProfile,
  onUpdateUserProfile
}) => {
  const [savedOutfits, setSavedOutfits] = useState<Outfit[]>([]);
  const [activeWardrobe, setActiveWardrobe] = useState<GarmentItem[]>([]);
  const [selectedOutfit, setSelectedOutfit] = useState<Outfit | null>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);

  // Load saved outfits and the user's OWN wardrobe (uploads only — never the
  // seed/reference catalog, see TodayScreen.tsx's identical note) for the
  // active profile. "Cataloged Garments" below must count what the user
  // actually owns, not the reference catalog riding along invisibly.
  useEffect(() => {
    async function loadData() {
      const saved = await loadSavedOutfits();
      setSavedOutfits(saved);

      const user = await loadUserWardrobe(profile);
      setActiveWardrobe(user);
    }
    loadData();
  }, [profile]);

  const handleDeleteSavedOutfit = async (id: string) => {
    const updated = await removeSavedOutfitFromStorage(id);
    setSavedOutfits(updated);
  };

  // Wardrobe Insights Calculation
  const categoryCounts = activeWardrobe.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const dominantCategory = Object.keys(categoryCounts).length > 0
    ? Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0][0]
    : 'tops';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* User Header */}
      <View style={styles.userCard}>
        <View style={styles.avatarCircle}>
          <User size={32} color={COLORS.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>{userProfile.name || 'CLOSIQ Member'}</Text>
          <Text style={styles.userRole}>CLOSIQ Wardrobe Member</Text>
        </View>

        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => setShowEditProfile(true)}
          accessibilityLabel="Edit profile"
        >
          <Pencil size={14} color={COLORS.primary} />
        </TouchableOpacity>

        <View style={styles.profileBadge}>
          <Text style={styles.profileBadgeText}>{profile.toUpperCase()}</Text>
        </View>
      </View>

      {/* Style Profile (collected during onboarding) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Style Profile</Text>
        <View style={styles.insightsCard}>
          <View style={styles.insightRow}>
            <Text style={styles.insightLabel}>Body Type</Text>
            <Text style={styles.insightVal}>
              {userProfile.bodyType ? BODY_TYPE_LABEL[userProfile.bodyType] : 'Not set'}
            </Text>
          </View>
          <View style={styles.insightRow}>
            <Text style={styles.insightLabel}>Skin Tone</Text>
            <Text style={styles.insightVal}>
              {userProfile.skinTone ? SKIN_TONE_LABEL[userProfile.skinTone] : 'Not set'}
            </Text>
          </View>
          {/* Own block, not a label/value row — a joined comma list here
              could run to 8 items and would overflow a single line no
              matter how it's truncated. Wrapped pills instead: every
              selection stays fully visible and inside the card regardless
              of how many are chosen. */}
          <View style={styles.stylePrefBlock}>
            <Text style={styles.insightLabel}>Style Preferences</Text>
            {userProfile.stylePreferences.length > 0 ? (
              <View style={styles.stylePillWrap}>
                {userProfile.stylePreferences.map((s) => (
                  <View key={s} style={styles.stylePill}>
                    <Text style={styles.stylePillText}>{STYLE_PREFERENCE_LABEL[s]}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.insightVal}>Not set</Text>
            )}
          </View>
          <View style={styles.insightRow}>
            <Text style={styles.insightLabel}>Temperature Unit</Text>
            <Text style={styles.insightVal}>
              {userProfile.temperatureUnit === 'celsius' ? '°C Celsius' : '°F Fahrenheit'}
            </Text>
          </View>
          <View style={[styles.insightRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <Text style={styles.insightLabel}>Location Access</Text>
            <Text style={styles.insightVal}>
              {userProfile.locationPermissionStatus === 'granted'
                ? 'Granted'
                : userProfile.locationPermissionStatus === 'denied'
                ? 'Not granted'
                : 'Not asked'}
            </Text>
          </View>
        </View>
      </View>

      {/* Wardrobe Profile Switcher */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Wardrobe Profile</Text>
        <Text style={styles.sectionSubtitle}>
          Select your default catalog & styling archetype context:
        </Text>

        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, profile === 'men' && styles.selectedToggleBtn]}
            activeOpacity={0.8}
            onPress={() => onProfileChange('men')}
          >
            <Text style={[styles.toggleText, profile === 'men' && styles.selectedToggleText]}>
              Men's Closet
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleBtn, profile === 'women' && styles.selectedToggleBtn]}
            activeOpacity={0.8}
            onPress={() => onProfileChange('women')}
          >
            <Text style={[styles.toggleText, profile === 'women' && styles.selectedToggleText]}>
              Women's Closet
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Layering Preference Selector */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Layers size={16} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>Layering Preference</Text>
        </View>
        <Text style={styles.sectionSubtitle}>
          How willing are you to have base layers (tank tops, undershirts) included?
        </Text>

        <View style={styles.preferenceGrid}>
          {(['avoid', 'sometimes', 'usually'] as LayeringPreference[]).map((pref) => {
            const isSelected = layeringPreference === pref;
            return (
              <TouchableOpacity
                key={pref}
                style={[styles.prefCard, isSelected && styles.selectedPrefCard]}
                activeOpacity={0.8}
                onPress={() => onLayeringChange(pref)}
              >
                <Text style={[styles.prefTitle, isSelected && styles.selectedPrefTitle]}>
                  {pref === 'avoid' ? 'Avoid' : pref === 'sometimes' ? 'Sometimes' : 'Usually'}
                </Text>
                <Text style={[styles.prefDesc, isSelected && styles.selectedPrefDesc]}>
                  {pref === 'avoid'
                    ? 'No base layers under tops'
                    : pref === 'sometimes'
                    ? 'Only when requested'
                    : 'Layer tops liberally'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* SAVED LOOKS SECTION */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Bookmark size={16} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>Saved Looks ({savedOutfits.length})</Text>
        </View>

        {savedOutfits.length === 0 ? (
          <View style={styles.emptySavedCard}>
            <Heart size={28} color={COLORS.primary} style={{ marginBottom: 8 }} />
            <Text style={styles.emptySavedTitle}>No Saved Looks Yet</Text>
            <Text style={styles.emptySavedSubtitle}>
              Generate an outfit on Today or Stylist and tap "Save Look" to store your favorite ensembles.
            </Text>
            <TouchableOpacity style={styles.createBtn} onPress={onNavigateToToday}>
              <Text style={styles.createBtnText}>Create Your First Look</Text>
              <ChevronRight size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 4 }}>
            {savedOutfits.map((outfit) => (
              <TouchableOpacity
                key={outfit.id}
                style={styles.savedOutfitCard}
                activeOpacity={0.85}
                onPress={() => setSelectedOutfit(outfit)}
              >
                {/* Thumbnails Row */}
                <View style={styles.savedThumbnailsRow}>
                  {outfit.items.slice(0, 3).map((item, idx) => (
                    <View key={`${item.id}-${idx}`} style={styles.savedThumbFrame}>
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={styles.savedThumbImg} />
                      ) : (
                        <View style={styles.savedThumbMissing}>
                          <Shirt size={14} color={COLORS.textMuted} />
                        </View>
                      )}
                    </View>
                  ))}
                </View>

                <Text style={styles.savedOutfitTitle} numberOfLines={1}>{outfit.title}</Text>
                <Text style={styles.savedOutfitOccasion}>{outfit.occasion} • {outfit.vibe}</Text>

                <View style={styles.savedFooter}>
                  <Text style={styles.savedScore}>{outfit.styleScore}% Match</Text>
                  <Text style={styles.savedWearAction}>Open Look →</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* STYLE DNA & CLOSET INSIGHTS */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Sparkles size={16} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>Wardrobe Insights</Text>
        </View>

        <View style={styles.insightsCard}>
          <View style={styles.insightRow}>
            <Text style={styles.insightLabel}>Cataloged Garments</Text>
            <Text style={styles.insightVal}>{activeWardrobe.length} Pieces</Text>
          </View>

          <View style={styles.insightRow}>
            <Text style={styles.insightLabel}>Primary Category</Text>
            <Text style={styles.insightVal}>{dominantCategory.toUpperCase()}</Text>
          </View>

          <View style={styles.insightRow}>
            <Text style={styles.insightLabel}>Style Archetype</Text>
            <Text style={styles.insightVal}>Modern Minimalist</Text>
          </View>

          <Text style={styles.insightGuidance}>
            "Style DNA and versatility scores automatically refine as you add new pieces and save outfits."
          </Text>
        </View>
      </View>

      {/* Saved Look Detail Sheet Modal */}
      <SavedLookDetailModal
        outfit={selectedOutfit}
        onClose={() => setSelectedOutfit(null)}
        onWearAgain={onWearAgain}
        onDelete={handleDeleteSavedOutfit}
      />

      <EditProfileModal
        visible={showEditProfile}
        userProfile={userProfile}
        onClose={() => setShowEditProfile(false)}
        onSave={async (partial) => {
          await onUpdateUserProfile(partial);
          setShowEditProfile(false);
        }}
      />
    </ScrollView>
  );
};

interface EditProfileModalProps {
  visible: boolean;
  userProfile: UserProfileData;
  onClose: () => void;
  onSave: (partial: Partial<UserProfileData>) => void;
}

/** Minimal edit surface for the fields onboarding collects — reuses the same
 *  option sets, deliberately does not duplicate Men/Women or Layering (those
 *  already have dedicated, always-visible sections above). */
const EditProfileModal: React.FC<EditProfileModalProps> = ({ visible, userProfile, onClose, onSave }) => {
  const [name, setName] = useState(userProfile.name);
  const [bodyType, setBodyType] = useState<BodyType | null>(userProfile.bodyType);
  const [skinTone, setSkinTone] = useState<SkinTone | null>(userProfile.skinTone);
  const [stylePreferences, setStylePreferences] = useState<StylePreference[]>(userProfile.stylePreferences);
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnit>(userProfile.temperatureUnit);

  // Re-sync the form whenever the modal is (re)opened, so it never shows a
  // previous edit session's stale draft.
  useEffect(() => {
    if (!visible) return;
    setName(userProfile.name);
    setBodyType(userProfile.bodyType);
    setSkinTone(userProfile.skinTone);
    setStylePreferences(userProfile.stylePreferences);
    setTemperatureUnit(userProfile.temperatureUnit);
  }, [visible, userProfile]);

  const toggleStyle = (value: StylePreference) => {
    setStylePreferences((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.editBackdrop}>
        <View style={styles.editSheet}>
          <View style={styles.editHeaderRow}>
            <Text style={styles.editTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
            <Text style={styles.editLabel}>Name</Text>
            <TextInput
              style={styles.editInput}
              value={name}
              onChangeText={setName}
              placeholder="First name"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={styles.editLabel}>Body Type</Text>
            <View style={styles.bodyTypeGrid}>
              {BODY_TYPE_OPTIONS.map((opt) => (
                <BodyTypeOptionCard
                  key={opt.value}
                  value={opt.value}
                  label={opt.label}
                  description={opt.description}
                  selected={bodyType === opt.value}
                  onPress={() => setBodyType(opt.value)}
                />
              ))}
            </View>

            <Text style={styles.editLabel}>Skin Tone</Text>
            <View style={styles.editChipWrap}>
              {SKIN_TONE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.editChip, skinTone === opt.value && styles.editChipSelected]}
                  onPress={() => setSkinTone(opt.value)}
                >
                  <Text style={[styles.editChipText, skinTone === opt.value && styles.editChipTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.editLabel}>Style Preferences</Text>
            <View style={styles.editChipWrap}>
              {STYLE_PREFERENCE_OPTIONS.map((opt) => {
                const isSelected = stylePreferences.includes(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.editChip, isSelected && styles.editChipSelected]}
                    onPress={() => toggleStyle(opt.value)}
                  >
                    <Text style={[styles.editChipText, isSelected && styles.editChipTextSelected]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.editLabel}>Temperature Unit</Text>
            <View style={styles.toggleRow}>
              {(['celsius', 'fahrenheit'] as TemperatureUnit[]).map((unit) => (
                <TouchableOpacity
                  key={unit}
                  style={[styles.toggleBtn, temperatureUnit === unit && styles.selectedToggleBtn]}
                  onPress={() => setTemperatureUnit(unit)}
                >
                  <Text style={[styles.toggleText, temperatureUnit === unit && styles.selectedToggleText]}>
                    {unit === 'celsius' ? '°C' : '°F'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={styles.editSaveBtn}
            onPress={() =>
              onSave({
                name: name.trim(),
                bodyType,
                skinTone,
                stylePreferences,
                temperatureUnit
              })
            }
          >
            <Check size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.editSaveBtnText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
    gap: 14
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primaryAlpha,
    alignItems: 'center',
    justifyContent: 'center'
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 2
  },
  userRole: {
    fontSize: 12,
    color: COLORS.textSecondary
  },
  profileBadge: {
    backgroundColor: COLORS.primaryAlpha,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill
  },
  profileBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary
  },
  section: {
    marginBottom: 24
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary
  },
  sectionSubtitle: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    marginBottom: 12
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: RADIUS.pill
  },
  selectedToggleBtn: {
    backgroundColor: COLORS.primary
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary
  },
  selectedToggleText: {
    color: '#FFFFFF'
  },
  preferenceGrid: {
    flexDirection: 'row',
    gap: 8
  },
  prefCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center'
  },
  selectedPrefCard: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryAlpha
  },
  prefTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2
  },
  selectedPrefTitle: {
    color: COLORS.primary
  },
  prefDesc: {
    fontSize: 10.5,
    color: COLORS.textMuted,
    textAlign: 'center'
  },
  selectedPrefDesc: {
    color: COLORS.primary
  },
  emptySavedCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  emptySavedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4
  },
  emptySavedSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 14
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.pill
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700'
  },
  savedOutfitCard: {
    width: 200,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 12
  },
  savedThumbnailsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10
  },
  savedThumbFrame: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    backgroundColor: COLORS.bg
  },
  savedThumbImg: {
    width: '100%',
    height: '100%'
  },
  savedThumbMissing: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  savedOutfitTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2
  },
  savedOutfitOccasion: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    marginBottom: 8
  },
  savedFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  savedScore: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary
  },
  savedWearAction: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary
  },
  insightsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10
  },
  insightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  insightLabel: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    flexShrink: 0
  },
  insightVal: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 12
  },
  stylePrefBlock: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8
  },
  stylePillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  stylePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primaryAlpha
  },
  stylePillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.primary
  },
  insightGuidance: {
    fontSize: 11.5,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    marginTop: 2
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryAlpha,
    marginRight: 10
  },
  editBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end'
  },
  editSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  editHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  editTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary
  },
  editLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 14,
    marginBottom: 8
  },
  editInput: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  editChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  bodyTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  editChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  editChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary
  },
  editChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary
  },
  editChipTextSelected: {
    color: '#FFFFFF'
  },
  editSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    paddingVertical: 14,
    marginTop: 16
  },
  editSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  }
});
