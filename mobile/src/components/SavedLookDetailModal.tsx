import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert
} from 'react-native';
import { X, Sparkles, Trash2, ArrowRight } from 'lucide-react-native';
import { COLORS, RADIUS } from '../theme';
import { Outfit } from '../../../src/types/wardrobe';
import { GarmentImage } from './GarmentImage';

interface SavedLookDetailModalProps {
  outfit: Outfit | null;
  onClose: () => void;
  onWearAgain: (outfit: Outfit) => void;
  onDelete: (id: string) => void;
}

export const SavedLookDetailModal: React.FC<SavedLookDetailModalProps> = ({
  outfit,
  onClose,
  onWearAgain,
  onDelete
}) => {
  if (!outfit) return null;

  const handleDeletePress = () => {
    Alert.alert(
      'Delete Saved Look',
      'Are you sure you want to remove this look from your saved collection?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete(outfit.id);
            onClose();
          }
        }
      ]
    );
  };

  return (
    <Modal
      visible={Boolean(outfit)}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <Sparkles size={16} color={COLORS.primary} />
              <Text style={styles.sheetTitle}>{outfit.title}</Text>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Meta Row */}
            <View style={styles.metaRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{outfit.occasion.toUpperCase()}</Text>
              </View>

              <Text style={styles.vibeText}>{outfit.vibe}</Text>

              <View style={styles.scoreBadge}>
                <Text style={styles.scoreText}>{outfit.styleScore}% Match</Text>
              </View>
            </View>

            {/* Garment Cards Grid */}
            <Text style={styles.sectionTitle}>Outfit Pieces ({outfit.items.length})</Text>
            <View style={styles.garmentGrid}>
              {outfit.items.map((item) => (
                <View key={item.id} style={styles.garmentCard}>
                  <View style={styles.garmentImgFrame}>
                    <GarmentImage uri={item.imageUrl} style={styles.garmentImg} iconSize={20} />
                    <View style={styles.catBadge}>
                      <Text style={styles.catBadgeText}>{item.category.slice(0, 4)}</Text>
                    </View>
                  </View>

                  <View style={styles.garmentInfo}>
                    <Text style={styles.garmentName} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.colorRow}>
                      <View style={[styles.colorDot, { backgroundColor: item.hexColor || '#4A5568' }]} />
                      <Text style={styles.colorText}>{item.color}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* Why It Works Rationale Box */}
            <View style={styles.whyItWorksBox}>
              <View style={styles.whyHeader}>
                <Sparkles size={14} color={COLORS.primary} />
                <Text style={styles.whyTitle}>Why It Works</Text>
              </View>
              <Text style={styles.whyBody}>"{outfit.explanation.summary}"</Text>
              {outfit.explanation.colorHarmony ? (
                <Text style={styles.whyDetail}>• {outfit.explanation.colorHarmony}</Text>
              ) : null}
            </View>

            {/* Action Row: Wear Again & Delete */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDeletePress}>
                <Trash2 size={16} color={COLORS.danger} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.wearAgainBtn}
                activeOpacity={0.8}
                onPress={() => {
                  onWearAgain(outfit);
                  onClose();
                }}
              >
                <Text style={styles.wearAgainText}>Wear Again</Text>
                <ArrowRight size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          </ScrollView>
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
    marginBottom: 12
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    flex: 1
  },
  closeBtn: {
    padding: 4
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16
  },
  badge: {
    backgroundColor: COLORS.primaryAlpha,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary
  },
  vibeText: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    flex: 1
  },
  scoreBadge: {
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary
  },
  sectionTitle: {
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
    width: '48%',
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
  missingImgBox: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg
  },
  catBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3
  },
  catBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase'
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
  colorRow: {
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
  colorText: {
    fontSize: 10.5,
    color: COLORS.textSecondary
  },
  whyItWorksBox: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.md,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    marginBottom: 20
  },
  whyHeader: {
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
  whyBody: {
    fontSize: 12.5,
    color: COLORS.textPrimary,
    lineHeight: 17,
    fontStyle: 'italic'
  },
  whyDetail: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    marginTop: 4
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10
  },
  deleteBtn: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(168,73,59,0.3)'
  },
  wearAgainBtn: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill
  },
  wearAgainText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
