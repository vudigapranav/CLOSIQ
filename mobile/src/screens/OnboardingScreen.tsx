import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import * as Location from 'expo-location';
import { Check, ArrowRight, ArrowLeft, MapPin, Shirt } from 'lucide-react-native';
import { COLORS, RADIUS } from '../theme';
import { WardrobeProfile, LayeringPreference, GarmentItem } from '../../../src/types/wardrobe';
import {
  BodyType,
  SkinTone,
  StylePreference,
  TemperatureUnit,
  LocationPermissionStatus,
  UserProfileData,
  BODY_TYPE_OPTIONS,
  SKIN_TONE_OPTIONS,
  STYLE_PREFERENCE_OPTIONS
} from '../types/onboarding';
import { loadUserWardrobe, saveUserGarment } from '../services/wardrobeStorage';
import { AddItemModal } from '../components/AddItemModal';
import { BodyTypeOptionCard } from '../components/BodyTypeOptionCard';

const STEP = {
  NAME: 0,
  PROFILE: 1,
  BODY_TYPE: 2,
  SKIN_TONE: 3,
  STYLE: 4,
  LAYERING: 5,
  TEMPERATURE: 6,
  LOCATION: 7,
  WARDROBE: 8
} as const;
const TOTAL_STEPS = 9;

const LAYERING_OPTIONS: { value: LayeringPreference; label: string; desc: string }[] = [
  { value: 'avoid', label: 'Avoid', desc: 'No base layers under tops' },
  { value: 'sometimes', label: 'Sometimes', desc: 'Only when requested' },
  { value: 'usually', label: 'Usually', desc: 'Layer tops liberally' }
];

const MIN_TOPS = 2;
const MIN_BOTTOMS = 2;

export interface OnboardingResult {
  profile: WardrobeProfile;
  layeringPreference: LayeringPreference;
  userProfile: UserProfileData;
}

interface OnboardingScreenProps {
  onComplete: (result: OnboardingResult) => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [step, setStep] = useState<number>(STEP.NAME);

  const [name, setName] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<WardrobeProfile | null>(null);
  const [bodyType, setBodyType] = useState<BodyType | null>(null);
  const [skinTone, setSkinTone] = useState<SkinTone | null>(null);
  const [stylePreferences, setStylePreferences] = useState<StylePreference[]>([]);
  const [layeringPreference, setLayeringPreference] = useState<LayeringPreference>('avoid');
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnit>('celsius');
  const [locationPermissionStatus, setLocationPermissionStatus] =
    useState<LocationPermissionStatus>('not_asked');

  const [wardrobe, setWardrobe] = useState<GarmentItem[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);

  // Load any items already uploaded for the chosen profile (covers the case
  // where the user backs out of onboarding mid-way and returns).
  useEffect(() => {
    if (!selectedProfile) return;
    loadUserWardrobe(selectedProfile).then(setWardrobe);
  }, [selectedProfile]);

  const topsCount = wardrobe.filter((i) => i.category === 'tops').length;
  const bottomsCount = wardrobe.filter((i) => i.category === 'bottoms').length;
  const outerwearCount = wardrobe.filter((i) => i.category === 'outerwear').length;
  const shoesCount = wardrobe.filter((i) => i.category === 'shoes').length;
  const accessoriesCount = wardrobe.filter((i) => i.category === 'accessories').length;
  const canCompleteWardrobe = topsCount >= MIN_TOPS && bottomsCount >= MIN_BOTTOMS;

  const handleGarmentAdded = async (garment: GarmentItem) => {
    if (!selectedProfile) return;
    const updated = await saveUserGarment(garment, selectedProfile);
    setWardrobe(updated);
  };

  const toggleStylePreference = (value: StylePreference) => {
    setStylePreferences((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleRequestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermissionStatus(status === 'granted' ? 'granted' : 'denied');
    } catch (err) {
      console.warn('Location permission request failed:', err);
      setLocationPermissionStatus('denied');
    }
    // Only the permission grant/deny state is stored. No coordinates are
    // ever read and no weather API is called — that remains future work.
    setStep((s) => s + 1);
  };

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleCompleteSetup = () => {
    if (!selectedProfile) return;
    if (!canCompleteWardrobe) {
      Alert.alert('Almost there', `Add at least ${MIN_TOPS} tops and ${MIN_BOTTOMS} bottoms to finish setup.`);
      return;
    }
    const userProfile: UserProfileData = {
      name: name.trim(),
      bodyType,
      skinTone,
      stylePreferences,
      temperatureUnit,
      locationPermissionStatus,
      onboardingCompleted: true
    };
    onComplete({ profile: selectedProfile, layeringPreference, userProfile });
  };

  const canContinue =
    step === STEP.NAME ? name.trim().length > 0 : step === STEP.PROFILE ? selectedProfile !== null : true;

  return (
    <View style={styles.container}>
      {/* Progress dots */}
      <View style={styles.progressRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {step === STEP.NAME && (
          <View style={styles.stepBlock}>
            <Text style={styles.question}>What should CLOSIQ call you?</Text>
            <Text style={styles.subtext}>Your first name is enough.</Text>
            <TextInput
              style={styles.textInput}
              placeholder="First name"
              placeholderTextColor={COLORS.textMuted}
              value={name}
              onChangeText={setName}
              autoFocus
            />
          </View>
        )}

        {step === STEP.PROFILE && (
          <View style={styles.stepBlock}>
            <Text style={styles.question}>Who are we styling for?</Text>
            <Text style={styles.subtext}>This sets your initial wardrobe catalog.</Text>
            <View style={styles.tileRow}>
              {(['men', 'women'] as WardrobeProfile[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.profileTile, selectedProfile === p && styles.profileTileSelected]}
                  onPress={() => setSelectedProfile(p)}
                  activeOpacity={0.85}
                >
                  <Shirt size={26} color={selectedProfile === p ? COLORS.primary : COLORS.textSecondary} />
                  <Text style={[styles.tileLabel, selectedProfile === p && styles.tileLabelSelected]}>
                    {p === 'men' ? "Men's Closet" : "Women's Closet"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === STEP.BODY_TYPE && (
          <View style={styles.stepBlock}>
            <Text style={styles.question}>What's your body type?</Text>
            <Text style={styles.subtext}>
              Optional — pick whichever silhouette looks closest. Skip anytime.
            </Text>
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
          </View>
        )}

        {step === STEP.SKIN_TONE && (
          <View style={styles.stepBlock}>
            <Text style={styles.question}>What's your skin tone?</Text>
            <Text style={styles.subtext}>Optional and approximate — used only for future color guidance.</Text>
            <View style={styles.chipWrap}>
              {SKIN_TONE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, skinTone === opt.value && styles.chipSelected]}
                  onPress={() => setSkinTone(opt.value)}
                >
                  {opt.swatch ? (
                    <View style={[styles.swatch, { backgroundColor: opt.swatch }]} />
                  ) : null}
                  <Text style={[styles.chipText, skinTone === opt.value && styles.chipTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === STEP.STYLE && (
          <View style={styles.stepBlock}>
            <Text style={styles.question}>What kind of style do you usually like?</Text>
            <Text style={styles.subtext}>Optional — select as many as apply.</Text>
            <View style={styles.chipWrap}>
              {STYLE_PREFERENCE_OPTIONS.map((opt) => {
                const isSelected = stylePreferences.includes(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => toggleStylePreference(opt.value)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {step === STEP.LAYERING && (
          <View style={styles.stepBlock}>
            <Text style={styles.question}>Layering preference</Text>
            <Text style={styles.subtext}>How willing are you to have base layers included?</Text>
            <View style={styles.preferenceGrid}>
              {LAYERING_OPTIONS.map((opt) => {
                const isSelected = layeringPreference === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.prefCard, isSelected && styles.prefCardSelected]}
                    onPress={() => setLayeringPreference(opt.value)}
                  >
                    <Text style={[styles.prefTitle, isSelected && styles.prefTitleSelected]}>{opt.label}</Text>
                    <Text style={styles.prefDesc}>{opt.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {step === STEP.TEMPERATURE && (
          <View style={styles.stepBlock}>
            <Text style={styles.question}>How should CLOSIQ display temperature?</Text>
            <Text style={styles.subtext}>You can change this later in Profile.</Text>
            <View style={styles.tileRow}>
              {(['celsius', 'fahrenheit'] as TemperatureUnit[]).map((unit) => (
                <TouchableOpacity
                  key={unit}
                  style={[styles.profileTile, temperatureUnit === unit && styles.profileTileSelected]}
                  onPress={() => setTemperatureUnit(unit)}
                >
                  <Text style={[styles.tileLabel, temperatureUnit === unit && styles.tileLabelSelected]}>
                    {unit === 'celsius' ? '°C Celsius' : '°F Fahrenheit'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === STEP.LOCATION && (
          <View style={styles.stepBlock}>
            <MapPin size={28} color={COLORS.primary} style={{ marginBottom: 12 }} />
            <Text style={styles.question}>Let CLOSIQ use your location?</Text>
            <Text style={styles.subtext}>
              Used to provide local weather and improve outfit recommendations. You can continue either way.
            </Text>
            {locationPermissionStatus === 'not_asked' ? (
              <View style={{ gap: 10, marginTop: 8 }}>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleRequestLocation}>
                  <Text style={styles.primaryBtnText}>Allow Location</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={goNext}>
                  <Text style={styles.secondaryBtnText}>Not Now</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.confirmedText}>
                {locationPermissionStatus === 'granted' ? 'Location access granted.' : 'Continuing without location access.'}
              </Text>
            )}
          </View>
        )}

        {step === STEP.WARDROBE && (
          <View style={styles.stepBlock}>
            <Text style={styles.question}>Initial Wardrobe</Text>
            <Text style={styles.subtext}>
              Add at least {MIN_TOPS} tops and {MIN_BOTTOMS} bottoms to start styling. Outerwear, footwear, and
              accessories are optional.
            </Text>

            <View style={styles.wardrobeCounts}>
              <WardrobeCountRow label="Tops" count={topsCount} min={MIN_TOPS} />
              <WardrobeCountRow label="Bottoms" count={bottomsCount} min={MIN_BOTTOMS} />
              <WardrobeCountRow label="Outerwear" count={outerwearCount} min={0} />
              <WardrobeCountRow label="Footwear" count={shoesCount} min={0} />
              <WardrobeCountRow label="Accessories" count={accessoriesCount} min={0} />
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowAddItem(true)}>
              <Text style={styles.primaryBtnText}>+ Add Item</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Footer Nav */}
      <View style={styles.footer}>
        {step > STEP.NAME && (
          <TouchableOpacity style={styles.backBtn} onPress={goBack}>
            <ArrowLeft size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}

        {step === STEP.WARDROBE ? (
          <TouchableOpacity
            style={[styles.continueBtn, !canCompleteWardrobe && styles.continueBtnDisabled]}
            onPress={handleCompleteSetup}
            disabled={!canCompleteWardrobe}
          >
            <Check size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.continueBtnText}>Complete Setup</Text>
          </TouchableOpacity>
        ) : step === STEP.LOCATION && locationPermissionStatus === 'not_asked' ? null : (
          <TouchableOpacity
            style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
            onPress={goNext}
            disabled={!canContinue}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
            <ArrowRight size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        )}
      </View>

      {selectedProfile && (
        <AddItemModal
          visible={showAddItem}
          profile={selectedProfile}
          onClose={() => setShowAddItem(false)}
          onGarmentAdded={handleGarmentAdded}
        />
      )}
    </View>
  );
};

const WardrobeCountRow: React.FC<{ label: string; count: number; min: number }> = ({ label, count, min }) => {
  const satisfied = min === 0 || count >= min;
  return (
    <View style={styles.countRow}>
      <Text style={styles.countLabel}>{label}</Text>
      <Text style={[styles.countValue, satisfied && min > 0 && styles.countValueSatisfied]}>
        {count} / {min > 0 ? min : 'optional'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: 60
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border
  },
  progressDotActive: {
    backgroundColor: COLORS.primary
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    flexGrow: 1
  },
  stepBlock: {
    paddingTop: 8
  },
  question: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8
  },
  subtext: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
    lineHeight: 19,
    marginBottom: 24
  },
  textInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 14,
    fontSize: 16,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  tileRow: {
    flexDirection: 'row',
    gap: 12
  },
  profileTile: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 20,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  profileTileSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryAlpha
  },
  tileLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.textPrimary
  },
  tileLabelSelected: {
    color: COLORS.primary
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  bodyTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary
  },
  chipTextSelected: {
    color: '#FFFFFF'
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)'
  },
  preferenceGrid: {
    gap: 10
  },
  prefCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  prefCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryAlpha
  },
  prefTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2
  },
  prefTitleSelected: {
    color: COLORS.primary
  },
  prefDesc: {
    fontSize: 12,
    color: COLORS.textSecondary
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center'
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  secondaryBtn: {
    borderRadius: RADIUS.pill,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  secondaryBtnText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600'
  },
  confirmedText: {
    fontSize: 13.5,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 8
  },
  wardrobeCounts: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
    gap: 12
  },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  countLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.textPrimary
  },
  countValue: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.textMuted
  },
  countValueSatisfied: {
    color: COLORS.accent
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 'auto'
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    paddingVertical: 14,
    paddingHorizontal: 24
  },
  continueBtnDisabled: {
    opacity: 0.4
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  }
});
