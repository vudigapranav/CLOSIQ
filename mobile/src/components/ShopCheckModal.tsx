import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  Camera,
  Image as ImageIcon,
  X,
  Check,
  AlertTriangle,
  Info,
  Sparkles,
  Shirt,
  PencilLine,
  Plus,
  RefreshCw,
  Lightbulb
} from 'lucide-react-native';
import { COLORS, RADIUS } from '../theme';
import { FormalityLevel, GarmentCategory, GarmentItem, LayeringPreference, Outfit } from '../../../src/types/wardrobe';
import { runShopCheck, shopCandidate, ShopCheckResult, ShopVerdict } from '../../../src/services/shopCheck';
import { COLOR_FAMILIES, ColorFamily } from '../../../src/services/wardrobeSearch';
import { buildOutfitBrain, OutfitFeedback, tasteGarments } from '../../../src/services/outfitBrain';
import { analyzeGarmentImageMobile, VisionAnalysisResult } from '../services/visionAnalysis';
import { optimizeGarmentImage } from '../services/imageOptimizer';
import { loadOutfitFeedback } from '../services/outfitFeedbackStorage';
import { GarmentImage } from './GarmentImage';

/**
 * Shop Check (2026-11-01) — the raised camera button in the middle of the nav.
 *
 * "I'm in a shop and see a light-yellow T-shirt. Which of my pants go with it?"
 * Snap (or pick) a photo → the existing AI garment scan reads it → the shared
 * engine (src/services/shopCheck.ts) shows, from the user's OWN wardrobe,
 * what to wear it with, whole outfits, Style DNA fit, near-twins they already
 * own, styling tips and a verdict. Nothing is added to the wardrobe unless
 * the user taps "I bought it". If the AI scan is unavailable the user can
 * describe the piece in a few taps instead — the check itself never needs AI.
 */

interface ShopCheckModalProps {
  visible: boolean;
  onClose: () => void;
  wardrobe: GarmentItem[];
  savedOutfits: Outfit[];
  layeringPreference?: LayeringPreference;
  stylePreferences?: string[];
  /** "I bought it — add to my wardrobe". */
  onGarmentAdded: (garment: GarmentItem) => void;
}

type Step = 'pick' | 'scanning' | 'describe' | 'result';

interface Described {
  name: string;
  category: GarmentCategory;
  subcategory: string;
  color: string;
  hexColor: string;
  fabric: string;
  fit: string;
  formality: FormalityLevel;
  style?: string;
  layeringRole?: GarmentItem['layeringRole'];
  tags?: string[];
  pairingNotes?: string;
}

const CATEGORIES: { key: GarmentCategory; label: string; typeHint: string }[] = [
  { key: 'tops', label: 'Top', typeHint: 'T-shirt, shirt, kurta…' },
  { key: 'bottoms', label: 'Bottom', typeHint: 'Jeans, chinos, skirt…' },
  { key: 'outerwear', label: 'Layer', typeHint: 'Jacket, blazer, coat…' },
  { key: 'shoes', label: 'Footwear', typeHint: 'Sneakers, loafers…' },
  { key: 'accessories', label: 'Accessory', typeHint: 'Bag, cap, watch…' }
];

const OCCASIONS: { key: FormalityLevel; label: string }[] = [
  { key: 'casual', label: 'Casual' },
  { key: 'smart_casual', label: 'Smart casual' },
  { key: 'formal', label: 'Formal' },
  { key: 'evening', label: 'Party' }
];

const VERDICT_STYLE: Record<ShopVerdict, { bg: string; fg: string }> = {
  great: { bg: 'rgba(92, 122, 82, 0.14)', fg: COLORS.accent },
  good: { bg: COLORS.primaryAlpha, fg: COLORS.primary },
  think_twice: { bg: 'rgba(168, 73, 59, 0.12)', fg: COLORS.danger },
  unknown: { bg: COLORS.surfaceSubtle, fg: COLORS.textSecondary }
};

const KNOWN_CATEGORIES: GarmentCategory[] = ['tops', 'bottoms', 'outerwear', 'shoes', 'accessories'];

function fromScan(scan: VisionAnalysisResult): Described {
  return {
    name: scan.name,
    category: KNOWN_CATEGORIES.includes(scan.category) ? scan.category : 'tops',
    subcategory: scan.subcategory,
    color: scan.color,
    hexColor: scan.hexColor,
    fabric: scan.fabric,
    fit: scan.fit,
    formality: scan.formality,
    style: scan.style || undefined,
    layeringRole: scan.layeringRole,
    tags: scan.tags,
    pairingNotes: scan.pairingNotes || undefined
  };
}

export const ShopCheckModal: React.FC<ShopCheckModalProps> = ({
  visible,
  onClose,
  wardrobe,
  savedOutfits,
  layeringPreference,
  stylePreferences,
  onGarmentAdded
}) => {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('pick');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [described, setDescribed] = useState<Described | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  // The garment created by "I bought it": left out of the check so the open
  // result doesn't suddenly compare the piece with itself.
  const [addedId, setAddedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<OutfitFeedback[]>([]);
  // A newer photo (or closing) makes any in-flight scan result stale.
  const runRef = useRef(0);

  // Manual "describe it" form.
  const [formCategory, setFormCategory] = useState<GarmentCategory>('tops');
  const [formType, setFormType] = useState('');
  const [formFamily, setFormFamily] = useState<ColorFamily | null>(null);
  const [formColorName, setFormColorName] = useState('');
  const [formOccasion, setFormOccasion] = useState<FormalityLevel>('casual');

  useEffect(() => {
    if (!visible) return;
    let active = true;
    loadOutfitFeedback().then((list) => {
      if (active) setFeedback(list);
    });
    return () => {
      active = false;
    };
  }, [visible]);

  const reset = () => {
    runRef.current += 1;
    setStep('pick');
    setPhotoUri(null);
    setDescribed(null);
    setScanNotice(null);
    setBusy(false);
    setAdded(false);
    setAddedId(null);
    setFormType('');
    setFormFamily(null);
    setFormColorName('');
    setFormCategory('tops');
    setFormOccasion('casual');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const result: ShopCheckResult | null = useMemo(() => {
    if (!described) return null;
    const brain = buildOutfitBrain(feedback, [], savedOutfits);
    const candidate = shopCandidate({ ...described, imageUrl: photoUri ?? '' });
    const owned = addedId ? wardrobe.filter((g) => g.id !== addedId) : wardrobe;
    return runShopCheck(candidate, owned, {
      brain,
      layeringPreference,
      stylePreferences,
      taste: tasteGarments(brain, owned)
    });
  }, [described, feedback, savedOutfits, wardrobe, layeringPreference, stylePreferences, photoUri, addedId]);

  const handlePick = async (useCamera: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const permission = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert(
          useCamera ? 'Camera access needed' : 'Photo access needed',
          useCamera
            ? 'Allow camera access so CLOSIQ can look at the piece you are thinking of buying.'
            : 'Allow photo access so CLOSIQ can look at the piece you are thinking of buying.'
        );
        return;
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1, base64: false };
      const picked = useCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (picked.canceled || !picked.assets?.length) return;

      const optimized = await optimizeGarmentImage(picked.assets[0].uri);
      setPhotoUri(optimized.uri);
      setAdded(false);
      setAddedId(null);
      setStep('scanning');
      const run = ++runRef.current;
      const scan = optimized.base64
        ? await analyzeGarmentImageMobile(optimized.base64, 'image/jpeg')
        : { ok: false as const, message: "Couldn't read that photo." };
      if (runRef.current !== run) return;
      if (scan.ok) {
        setScanNotice(null);
        setDescribed(fromScan(scan.data));
        setStep('result');
      } else {
        setScanNotice(`${scan.message} Describe the piece in a few taps and CLOSIQ will still check it against your wardrobe.`);
        setStep('describe');
      }
    } catch (err) {
      console.warn('Shop Check photo error:', err);
      Alert.alert('Photo error', "Couldn't load that photo. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const openDescribe = (prefill?: Described | null) => {
    if (prefill) {
      setFormCategory(prefill.category);
      setFormType(prefill.subcategory);
      setFormColorName(prefill.color);
      setFormFamily(null);
      setFormOccasion(prefill.formality);
    }
    setStep('describe');
  };

  const handleCheckDescribed = () => {
    const family = COLOR_FAMILIES.find((f) => f.value === formFamily);
    const colourName = formColorName.trim() || family?.label.split(' ')[0] || '';
    if (!colourName) {
      Alert.alert('Pick a colour', 'Choose the closest colour so CLOSIQ can match it.');
      return;
    }
    const cat = CATEGORIES.find((c) => c.key === formCategory)!;
    const type = formType.trim() || cat.label;
    // Keep the scan's details (fabric, fit, style) when the user only corrected a few fields.
    const base = described && described.category === formCategory ? described : null;
    setDescribed({
      name: `${colourName} ${type}`.replace(/\s+/g, ' ').trim(),
      category: formCategory,
      subcategory: type,
      color: colourName,
      hexColor: family?.hex ?? (base?.color.toLowerCase() === colourName.toLowerCase() ? base.hexColor : '#9E9E9E'),
      fabric: base?.fabric ?? '',
      fit: base?.fit ?? '',
      formality: formOccasion,
      style: base?.style,
      layeringRole: formCategory === 'outerwear' ? 'outer_layer' : base?.layeringRole,
      tags: base?.tags ?? [],
      pairingNotes: base?.pairingNotes
    });
    setStep('result');
  };

  const handleBought = () => {
    if (!described || added) return;
    const garment: GarmentItem = {
      id: `user-upload-${Date.now()}`,
      name: described.name,
      category: described.category,
      subcategory: described.subcategory,
      color: described.color,
      hexColor: described.hexColor,
      fabric: described.fabric || 'Unspecified',
      fit: described.fit || undefined,
      formality: described.formality,
      layeringRole: described.layeringRole,
      style: described.style,
      seasons: ['spring', 'summer', 'autumn', 'winter'],
      imageUrl: photoUri ?? '',
      favorite: false,
      wearCount: 0,
      dateAdded: new Date().toISOString().split('T')[0],
      tags: described.tags ?? [],
      pairingNotes: described.pairingNotes
    };
    setAddedId(garment.id);
    onGarmentAdded(garment);
    setAdded(true);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      presentationStyle="fullScreen"
      // Edge-to-edge like the rest of the app (mandatory on Android at SDK 57);
      // the screen pads itself with the safe-area insets below.
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.topTitleRow}>
            <View style={styles.topIcon}>
              <Camera size={16} color={COLORS.primary} />
            </View>
            <Text style={styles.topTitle}>Shop Check</Text>
          </View>
          <TouchableOpacity onPress={handleClose} hitSlop={10} accessibilityLabel="Close Shop Check">
            <X size={22} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 'pick' && (
            <View>
              <View style={styles.hero}>
                <View style={styles.heroCircle}>
                  <Camera size={34} color="#FFFFFF" />
                </View>
                <Text style={styles.heroTitle}>Will it work with your wardrobe?</Text>
                <Text style={styles.heroText}>
                  Spotted something in a shop? Snap it before you buy. CLOSIQ tells you what you already own that goes with it,
                  the outfits it makes, and whether it suits your style.
                </Text>
              </View>

              <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={() => handlePick(true)} disabled={busy}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Camera size={18} color="#FFFFFF" />}
                <Text style={styles.primaryBtnText}>Scan with camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.85} onPress={() => handlePick(false)} disabled={busy}>
                <ImageIcon size={18} color={COLORS.primary} />
                <Text style={styles.secondaryBtnText}>Choose a photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkBtn} onPress={() => openDescribe()} hitSlop={8}>
                <PencilLine size={14} color={COLORS.primary} />
                <Text style={styles.linkText}>No photo? Describe it instead</Text>
              </TouchableOpacity>

              <View style={styles.howCard}>
                {[
                  'Point the camera at the piece — hanger or shelf is fine.',
                  'CLOSIQ reads its type, colour and style.',
                  'See what YOUR clothes pair with it, before you pay.'
                ].map((line, i) => (
                  <View key={line} style={styles.howRow}>
                    <View style={styles.howNum}>
                      <Text style={styles.howNumText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.howText}>{line}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {step === 'scanning' && (
            <View style={styles.scanning}>
              {photoUri && <Image source={{ uri: photoUri }} style={styles.scanPhoto} />}
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
              <Text style={styles.scanTitle}>Reading the garment…</Text>
              <Text style={styles.scanText}>Working out its type, colour and style, then checking it against your wardrobe.</Text>
              <TouchableOpacity style={styles.linkBtn} onPress={reset} hitSlop={8}>
                <Text style={styles.linkText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'describe' && (
            <View>
              {photoUri && <Image source={{ uri: photoUri }} style={styles.describePhoto} />}
              {scanNotice && (
                <View style={styles.noticeBox}>
                  <Info size={16} color={COLORS.primary} />
                  <Text style={styles.noticeText}>{scanNotice}</Text>
                </View>
              )}
              <Text style={styles.formTitle}>What is it?</Text>
              <View style={styles.chipWrap}>
                {CATEGORIES.map((c) => (
                  <Chip key={c.key} label={c.label} selected={formCategory === c.key} onPress={() => setFormCategory(c.key)} />
                ))}
              </View>
              <TextInput
                style={styles.input}
                value={formType}
                onChangeText={setFormType}
                placeholder={`Type (optional) — ${CATEGORIES.find((c) => c.key === formCategory)?.typeHint}`}
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.formTitle}>Colour</Text>
              <View style={styles.chipWrap}>
                {COLOR_FAMILIES.map((f) => (
                  <Chip
                    key={f.value}
                    label={f.label.split(' ')[0]}
                    hex={f.hex}
                    selected={formFamily === f.value}
                    onPress={() => {
                      setFormFamily(f.value);
                      setFormColorName('');
                    }}
                  />
                ))}
              </View>
              <TextInput
                style={styles.input}
                value={formColorName}
                onChangeText={setFormColorName}
                placeholder="Exact shade (optional) — e.g. Light Yellow"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.formTitle}>How dressy is it?</Text>
              <View style={styles.chipWrap}>
                {OCCASIONS.map((o) => (
                  <Chip key={o.key} label={o.label} selected={formOccasion === o.key} onPress={() => setFormOccasion(o.key)} />
                ))}
              </View>

              <TouchableOpacity style={[styles.primaryBtn, { marginTop: 22 }]} activeOpacity={0.85} onPress={handleCheckDescribed}>
                <Sparkles size={18} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Check it against my wardrobe</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkBtn} onPress={reset} hitSlop={8}>
                <Text style={styles.linkText}>Start over</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'result' && described && result && (
            <ResultView
              described={described}
              photoUri={photoUri}
              result={result}
              added={added}
              onEdit={() => openDescribe(described)}
              onBought={handleBought}
              onScanAnother={reset}
            />
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

// ---------- result ----------

const OCCASION_LABEL: Record<FormalityLevel, string> = {
  casual: 'Casual', smart_casual: 'Smart casual', formal: 'Formal', evening: 'Party'
};
const CATEGORY_LABEL: Record<GarmentCategory, string> = {
  tops: 'Top', bottoms: 'Bottom', outerwear: 'Layer', shoes: 'Footwear', accessories: 'Accessory'
};

const ResultView: React.FC<{
  described: Described;
  photoUri: string | null;
  result: ShopCheckResult;
  added: boolean;
  onEdit: () => void;
  onBought: () => void;
  onScanAnother: () => void;
}> = ({ described, photoUri, result, added, onEdit, onBought, onScanAnother }) => {
  const verdictStyle = VERDICT_STYLE[result.verdict];
  return (
    <View>
      {/* The piece */}
      <View style={styles.pieceRow}>
        <PieceThumb photoUri={photoUri} hex={described.hexColor} size={84} />
        <View style={{ flex: 1 }}>
          <Text style={styles.pieceName}>{described.name}</Text>
          <Text style={styles.pieceMeta}>
            {CATEGORY_LABEL[described.category]} · {described.color} · {OCCASION_LABEL[described.formality]}
          </Text>
          <TouchableOpacity style={styles.editLink} onPress={onEdit} hitSlop={8}>
            <PencilLine size={13} color={COLORS.primary} />
            <Text style={styles.linkText}>Not right? Edit details</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Verdict */}
      <View style={[styles.verdictCard, { backgroundColor: verdictStyle.bg }]}>
        <Text style={[styles.verdictTitle, { color: verdictStyle.fg }]}>{result.verdictTitle}</Text>
        {!!result.verdictSummary && <Text style={styles.verdictSummary}>{result.verdictSummary}</Text>}
        <View style={{ marginTop: 10, gap: 6 }}>
          {result.points.map((p) => (
            <View key={p.text} style={styles.pointRow}>
              {p.tone === 'good' ? (
                <Check size={15} color={COLORS.accent} />
              ) : p.tone === 'warn' ? (
                <AlertTriangle size={15} color={COLORS.danger} />
              ) : (
                <Info size={15} color={COLORS.textSecondary} />
              )}
              <Text style={styles.pointText}>{p.text}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Style DNA */}
      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>STYLE DNA</Text>
        <Text style={styles.cardTitle}>{result.styleFit.title}</Text>
        <Text style={styles.cardText}>{result.styleFit.detail}</Text>
      </View>

      {/* Wear it with */}
      {result.wearWith.map((group) => (
        <View key={group.category} style={styles.section}>
          <Text style={styles.sectionTitle}>{group.title}</Text>
          <Text style={styles.sectionSentence}>{group.sentence}</Text>
          {group.suggestions.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingTop: 10 }}>
              {group.suggestions.map((s) => (
                <View key={s.item.id} style={styles.pairCard}>
                  <GarmentImage uri={s.item.imageUrl} style={styles.pairImg} iconSize={22} />
                  <Text style={styles.pairName} numberOfLines={2}>{s.item.name}</Text>
                  <Text style={styles.pairReason} numberOfLines={2}>{s.reason}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      ))}

      {/* Outfits */}
      {result.outfits.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Outfits you could wear</Text>
          <Text style={styles.sectionSentence}>With this piece and clothes you already own.</Text>
          {result.outfits.map((o) => (
            <View key={o.id} style={styles.outfitCard}>
              <Text style={styles.outfitLabel}>{o.label}</Text>
              <View style={styles.outfitRow}>
                <View style={styles.outfitPiece}>
                  <PieceThumb photoUri={photoUri} hex={described.hexColor} size={64} />
                  <Text style={styles.outfitPieceName} numberOfLines={1}>This piece</Text>
                </View>
                {o.items.map((i) => (
                  <React.Fragment key={i.id}>
                    <Plus size={14} color={COLORS.textMuted} />
                    <View style={styles.outfitPiece}>
                      <GarmentImage uri={i.imageUrl} style={styles.outfitImg} iconSize={18} />
                      <Text style={styles.outfitPieceName} numberOfLines={1}>{i.name}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
              <Text style={styles.outfitReason}>{o.reason}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Already own */}
      {result.similarOwned.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>You already own</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingTop: 8 }}>
            {result.similarOwned.map((i) => (
              <View key={i.id} style={styles.pairCard}>
                <GarmentImage uri={i.imageUrl} style={styles.pairImg} iconSize={22} />
                <Text style={styles.pairName} numberOfLines={2}>{i.name}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Stylist tips */}
      <View style={styles.card}>
        <View style={styles.tipsHeader}>
          <Lightbulb size={15} color={COLORS.primary} />
          <Text style={styles.cardEyebrow}>STYLIST TIPS</Text>
        </View>
        {result.stylingTips.map((tip) => (
          <Text key={tip} style={styles.tipText}>• {tip}</Text>
        ))}
        {result.lookFor && <Text style={styles.lookFor}>{result.lookFor}</Text>}
      </View>

      {/* Actions */}
      <TouchableOpacity
        style={[styles.primaryBtn, added && styles.primaryBtnDone]}
        activeOpacity={0.85}
        onPress={onBought}
        disabled={added}
      >
        {added ? <Check size={18} color="#FFFFFF" /> : <Shirt size={18} color="#FFFFFF" />}
        <Text style={styles.primaryBtnText}>{added ? 'Added to your wardrobe' : 'I bought it — add to my wardrobe'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.85} onPress={onScanAnother}>
        <RefreshCw size={16} color={COLORS.primary} />
        <Text style={styles.secondaryBtnText}>Check another piece</Text>
      </TouchableOpacity>
    </View>
  );
};

const PieceThumb: React.FC<{ photoUri: string | null; hex: string; size: number }> = ({ photoUri, hex, size }) =>
  photoUri ? (
    <Image source={{ uri: photoUri }} style={{ width: size, height: size, borderRadius: RADIUS.md }} />
  ) : (
    <View style={[styles.swatchThumb, { width: size, height: size }]}>
      <View style={{ width: size * 0.5, height: size * 0.5, borderRadius: size * 0.25, backgroundColor: hex, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' }} />
    </View>
  );

const Chip: React.FC<{ label: string; selected: boolean; onPress: () => void; hex?: string }> = ({ label, selected, onPress, hex }) => (
  <TouchableOpacity style={[styles.chip, selected && styles.chipSelected]} activeOpacity={0.75} onPress={onPress}>
    {hex && <View style={[styles.chipSwatch, { backgroundColor: hex }]} />}
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  topTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primaryAlpha,
    alignItems: 'center',
    justifyContent: 'center'
  },
  topTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
  body: { paddingHorizontal: 20, paddingTop: 20 },

  hero: { alignItems: 'center', marginBottom: 24 },
  heroCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  heroText: { fontSize: 13.5, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginTop: 8 },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    paddingVertical: 14,
    marginTop: 8
  },
  primaryBtnDone: { backgroundColor: COLORS.accent },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.borderMedium,
    paddingVertical: 13,
    marginTop: 10
  },
  secondaryBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 },
  linkText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },

  howCard: {
    marginTop: 28,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  howNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primaryAlpha,
    alignItems: 'center',
    justifyContent: 'center'
  },
  howNumText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  howText: { flex: 1, fontSize: 13, color: COLORS.textPrimary, lineHeight: 18 },

  scanning: { alignItems: 'center', paddingTop: 20 },
  scanPhoto: { width: 220, height: 220, borderRadius: RADIUS.lg },
  scanTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, marginTop: 14 },
  scanText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 19, paddingHorizontal: 12 },

  describePhoto: { width: 120, height: 120, borderRadius: RADIUS.md, alignSelf: 'center', marginBottom: 14 },
  noticeBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    marginBottom: 6
  },
  noticeText: { flex: 1, fontSize: 12.5, color: COLORS.textPrimary, lineHeight: 18 },
  formTitle: { fontSize: 12, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 18, marginBottom: 8 },
  input: {
    marginTop: 10,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderMedium,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.textPrimary
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipSwatch: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' },
  chipText: { fontSize: 12.5, fontWeight: '600', color: COLORS.textPrimary },
  chipTextSelected: { color: '#FFFFFF' },

  pieceRow: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 16 },
  pieceName: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  pieceMeta: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 3 },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  swatchThumb: {
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center'
  },

  verdictCard: { borderRadius: RADIUS.lg, padding: 16, marginBottom: 14 },
  verdictTitle: { fontSize: 20, fontWeight: '800' },
  verdictSummary: { fontSize: 13.5, color: COLORS.textPrimary, lineHeight: 19, marginTop: 6 },
  pointRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  pointText: { flex: 1, fontSize: 13, color: COLORS.textPrimary, lineHeight: 18 },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  cardEyebrow: { fontSize: 11, fontWeight: '800', color: COLORS.primary, letterSpacing: 1 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginTop: 4 },
  cardText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, marginTop: 4 },

  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  sectionSentence: { fontSize: 13, color: COLORS.textSecondary, marginTop: 3, lineHeight: 18 },
  pairCard: {
    width: 118,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  pairImg: { width: '100%', height: 96, borderRadius: RADIUS.sm, backgroundColor: COLORS.bg },
  pairName: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary, marginTop: 6 },
  pairReason: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, lineHeight: 15 },

  outfitCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  outfitLabel: { fontSize: 12, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },
  outfitRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  outfitPiece: { width: 70, alignItems: 'center' },
  outfitImg: { width: 64, height: 64, borderRadius: RADIUS.md, backgroundColor: COLORS.bg },
  outfitPieceName: { fontSize: 10.5, color: COLORS.textSecondary, marginTop: 4, maxWidth: 70 },
  outfitReason: { fontSize: 12, color: COLORS.textPrimary, marginTop: 8 },

  tipsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  tipText: { fontSize: 13, color: COLORS.textPrimary, lineHeight: 19, marginTop: 4 },
  lookFor: { fontSize: 12.5, color: COLORS.textSecondary, fontStyle: 'italic', marginTop: 10, lineHeight: 18 }
});
