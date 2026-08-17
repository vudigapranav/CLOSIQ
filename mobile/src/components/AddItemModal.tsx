import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, Sparkles, X, Check, RefreshCw } from 'lucide-react-native';
import { COLORS, RADIUS } from '../theme';
import { GarmentItem, GarmentCategory, WardrobeProfile } from '../../../src/types/wardrobe';
import { analyzeGarmentImageMobile, VisionAnalysisResult } from '../services/visionAnalysis';

const { width } = Dimensions.get('window');

const CATEGORY_HINTS: { key: GarmentCategory; label: string }[] = [
  { key: 'tops', label: 'Top' },
  { key: 'bottoms', label: 'Bottom' },
  { key: 'outerwear', label: 'Outerwear' },
  { key: 'shoes', label: 'Footwear' },
  { key: 'accessories', label: 'Accessory' }
];

interface AddItemModalProps {
  visible: boolean;
  profile: WardrobeProfile;
  onClose: () => void;
  onGarmentAdded: (garment: GarmentItem) => void;
}

type ModalStep = 'choose' | 'preview' | 'analyzing' | 'confirm';

export const AddItemModal: React.FC<AddItemModalProps> = ({
  visible,
  profile: _profile,
  onClose,
  onGarmentAdded
}) => {
  const [step, setStep] = useState<ModalStep>('choose');
  const [selectedCategory, setSelectedCategory] = useState<GarmentCategory>('tops');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [base64Data, setBase64Data] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<VisionAnalysisResult | null>(null);
  // Gemini's detected category is only the DEFAULT — the user has final say
  // before saving. Separate from `analysisResult.category` (which stays as
  // Gemini's original read) so a correction never has to reconcile against
  // what the model actually said.
  const [editedCategory, setEditedCategory] = useState<GarmentCategory>('tops');
  // Guards against a double-tap firing the permission prompt/native picker
  // twice before the first launch has resolved — the picker itself gives no
  // visual feedback until it opens.
  const [isPicking, setIsPicking] = useState(false);

  const resetState = () => {
    setStep('choose');
    setImageUri(null);
    setBase64Data(null);
    setAnalysisResult(null);
    setEditedCategory('tops');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handlePickImage = async (useCamera: boolean) => {
    if (isPicking) return;
    setIsPicking(true);
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Camera Access Required', 'CLOSIQ requires camera permissions to capture clothing photos.');
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Gallery Access Required', 'CLOSIQ requires photo library permissions to select clothing photos.');
          return;
        }
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            base64: true
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            base64: true
          });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        setBase64Data(asset.base64 || null);
        setStep('preview');
      }
    } catch (err) {
      console.warn('Image picker error:', err);
      Alert.alert('Photo Selection Error', 'Unable to load selected photo. Please try again.');
    } finally {
      setIsPicking(false);
    }
  };

  const handleStartAnalysis = async () => {
    if (!base64Data) {
      Alert.alert('Analysis Error', 'No image data found to analyze.');
      return;
    }

    setStep('analyzing');
    const result = await analyzeGarmentImageMobile(base64Data, 'image/jpeg', selectedCategory);
    setAnalysisResult(result.data);
    setEditedCategory(result.data.category);
    setStep('confirm');
  };

  const handleConfirmAndAdd = () => {
    if (!analysisResult || !imageUri) return;

    // Create stable application ID for user upload
    const newGarment: GarmentItem = {
      id: `user-upload-${Date.now()}`,
      name: analysisResult.name,
      category: editedCategory,
      subcategory: analysisResult.subcategory,
      color: analysisResult.color,
      hexColor: analysisResult.hexColor,
      fabric: analysisResult.fabric,
      fit: analysisResult.fit,
      formality: analysisResult.formality,
      layeringRole: analysisResult.layeringRole,
      style: analysisResult.style,
      seasons: ['spring', 'summer', 'autumn', 'winter'],
      imageUrl: imageUri,
      favorite: false,
      wearCount: 0,
      dateAdded: new Date().toISOString().split('T')[0],
      tags: analysisResult.tags,
      aiConfidence: analysisResult.aiConfidence,
      pairingNotes: analysisResult.pairingNotes
    };

    onGarmentAdded(newGarment);
    handleClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <Sparkles size={16} color={COLORS.primary} />
              <Text style={styles.sheetTitle}>Add to Wardrobe</Text>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              accessibilityLabel="Close modal"
            >
              <X size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* STEP 1: CHOOSE PHOTO SOURCE */}
          {step === 'choose' && (
            <View style={styles.stepContent}>
              <Text style={styles.sectionSubtitle}>
                Select category hint and choose how to upload your garment image:
              </Text>

              {/* Category Hint Selector */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hintRail}>
                {CATEGORY_HINTS.map((hint) => {
                  const isSel = selectedCategory === hint.key;
                  return (
                    <TouchableOpacity
                      key={hint.key}
                      style={[styles.hintChip, isSel && styles.selectedHintChip]}
                      onPress={() => setSelectedCategory(hint.key)}
                    >
                      <Text style={[styles.hintText, isSel && styles.selectedHintText]}>
                        {hint.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Source Buttons */}
              <View style={styles.sourceGrid}>
                <TouchableOpacity
                  style={[styles.sourceCard, isPicking && styles.sourceCardDisabled]}
                  activeOpacity={0.8}
                  onPress={() => handlePickImage(true)}
                  disabled={isPicking}
                >
                  <View style={styles.sourceIconBox}>
                    <Camera size={26} color={COLORS.primary} />
                  </View>
                  <Text style={styles.sourceTitle}>Take Photo</Text>
                  <Text style={styles.sourceDesc}>Capture item with camera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sourceCard, isPicking && styles.sourceCardDisabled]}
                  activeOpacity={0.8}
                  onPress={() => handlePickImage(false)}
                  disabled={isPicking}
                >
                  <View style={styles.sourceIconBox}>
                    <ImageIcon size={26} color={COLORS.primary} />
                  </View>
                  <Text style={styles.sourceTitle}>Photo Library</Text>
                  <Text style={styles.sourceDesc}>Choose existing photo</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 2: PREVIEW PHOTO */}
          {step === 'preview' && imageUri && (
            <View style={styles.stepContent}>
              <View style={styles.previewImageFrame}>
                <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={resetState}>
                  <RefreshCw size={14} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={styles.cancelBtnText}>Retake</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.heroAnalyzeBtn} onPress={handleStartAnalysis}>
                  <Sparkles size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.heroAnalyzeBtnText}>Analyze with CLOSIQ</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 3: ANALYZING STATE */}
          {step === 'analyzing' && (
            <View style={styles.analyzingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginBottom: 16 }} />
              <Text style={styles.analyzingTitle}>Understanding your garment...</Text>
              <Text style={styles.analyzingSubtitle}>
                Identifying category, color, fit, fabric, formality, and style archetype
              </Text>
            </View>
          )}

          {/* STEP 4: CONFIRMATION & EDIT METADATA */}
          {step === 'confirm' && analysisResult && (
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <View style={styles.confirmHeader}>
                <View style={styles.thumbnailBox}>
                  {imageUri && <Image source={{ uri: imageUri }} style={styles.thumbnailImg} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultCategory}>{editedCategory.toUpperCase()}</Text>
                  <Text style={styles.resultTitle}>{analysisResult.name}</Text>
                  <Text style={styles.resultStyle}>{analysisResult.style} • {analysisResult.color}</Text>
                </View>
              </View>

              {/* Category — Gemini's detection is only the default; the user
                  has final control over what actually gets saved. */}
              <Text style={styles.categoryEditLabel}>Category</Text>
              <View style={styles.categoryEditRow}>
                {CATEGORY_HINTS.map((opt) => {
                  const isSelected = editedCategory === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.categoryEditChip, isSelected && styles.categoryEditChipSelected]}
                      onPress={() => setEditedCategory(opt.key)}
                    >
                      <Text
                        style={[styles.categoryEditChipText, isSelected && styles.categoryEditChipTextSelected]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Metadata Attributes List */}
              <View style={styles.attributeGrid}>
                <View style={styles.attrChip}>
                  <Text style={styles.attrLabel}>Formality</Text>
                  <Text style={styles.attrVal}>{analysisResult.formality}</Text>
                </View>
                <View style={styles.attrChip}>
                  <Text style={styles.attrLabel}>Fit</Text>
                  <Text style={styles.attrVal}>{analysisResult.fit}</Text>
                </View>
                <View style={styles.attrChip}>
                  <Text style={styles.attrLabel}>Fabric</Text>
                  <Text style={styles.attrVal}>{analysisResult.fabric}</Text>
                </View>
                <View style={styles.attrChip}>
                  <Text style={styles.attrLabel}>Layering Role</Text>
                  <Text style={styles.attrVal}>{analysisResult.layeringRole || 'Primary'}</Text>
                </View>
              </View>

              {/* Rationale & Pairing Note */}
              <View style={styles.pairingBox}>
                <Text style={styles.pairingTitle}>Stylist Note</Text>
                <Text style={styles.pairingBody}>"{analysisResult.pairingNotes}"</Text>
              </View>

              {/* Confirm Actions */}
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={resetState}>
                  <Text style={styles.cancelBtnText}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.heroAnalyzeBtn} onPress={handleConfirmAndAdd}>
                  <Check size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.heroAnalyzeBtnText}>Confirm & Add</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end'
  },
  sheetContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary
  },
  closeBtn: {
    padding: 4
  },
  stepContent: {
    paddingBottom: 10
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 12
  },
  hintRail: {
    marginBottom: 16,
    flexGrow: 0
  },
  hintChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8
  },
  selectedHintChip: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary
  },
  hintText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary
  },
  selectedHintText: {
    color: '#FFFFFF'
  },
  sourceGrid: {
    flexDirection: 'row',
    gap: 12
  },
  sourceCard: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.lg,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  sourceCardDisabled: {
    opacity: 0.5
  },
  sourceIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primaryAlpha,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  sourceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2
  },
  sourceDesc: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center'
  },
  previewImageFrame: {
    width: '100%',
    height: 240,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: COLORS.bg
  },
  previewImage: {
    width: '100%',
    height: '100%'
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary
  },
  heroAnalyzeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary
  },
  heroAnalyzeBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  analyzingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  analyzingTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6
  },
  analyzingSubtitle: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    textAlign: 'center',
    maxWidth: width * 0.7
  },
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    padding: 12,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md
  },
  thumbnailBox: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    backgroundColor: COLORS.surface
  },
  thumbnailImg: {
    width: '100%',
    height: '100%'
  },
  resultCategory: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.8
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginVertical: 2
  },
  resultStyle: {
    fontSize: 12,
    color: COLORS.textSecondary
  },
  categoryEditLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  categoryEditRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16
  },
  categoryEditChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  categoryEditChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary
  },
  categoryEditChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary
  },
  categoryEditChipTextSelected: {
    color: '#FFFFFF'
  },
  attributeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16
  },
  attrChip: {
    width: '48%',
    backgroundColor: COLORS.bg,
    padding: 10,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  attrLabel: {
    fontSize: 10.5,
    color: COLORS.textMuted,
    marginBottom: 2
  },
  attrVal: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textTransform: 'capitalize'
  },
  pairingBox: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.sm,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    marginBottom: 16
  },
  pairingTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 2
  },
  pairingBody: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontStyle: 'italic',
    lineHeight: 16
  }
});
