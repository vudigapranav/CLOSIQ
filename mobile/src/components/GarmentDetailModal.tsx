import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView
} from 'react-native';
import { X, Trash2, Sparkles, Shirt } from 'lucide-react-native';
import { COLORS, RADIUS } from '../theme';
import { GarmentItem, GarmentDetailsPatch, LayeringPreference } from '../../../src/types/wardrobe';
import { OutfitFeedback, buildOutfitBrain } from '../../../src/services/outfitBrain';
import { emptyPairingHint, suggestPairings } from '../../../src/services/pairingSuggestions';
import { loadOutfitFeedback } from '../services/outfitFeedbackStorage';
import { GarmentImage } from './GarmentImage';
import { StorageLocationPicker } from './StorageLocationPicker';
import { SizePicker } from './SizePicker';

interface GarmentDetailModalProps {
  item: GarmentItem | null;
  onClose: () => void;
  onRemove: (id: string) => void;
  /** Persists an edited size / "where is it kept" place for this item. */
  onUpdateItem: (id: string, patch: GarmentDetailsPatch) => void;
  customPlaces?: string[];
  /** The user's wardrobe — "Pairs well with" only ever suggests pieces from it. */
  wardrobe?: GarmentItem[];
  layeringPreference?: LayeringPreference;
  /** Opens a suggested piece in this same sheet. */
  onSelectItem?: (item: GarmentItem) => void;
}

export const GarmentDetailModal: React.FC<GarmentDetailModalProps> = ({
  item,
  onClose,
  onRemove,
  onUpdateItem,
  customPlaces = [],
  wardrobe = [],
  layeringPreference,
  onSelectItem
}) => {
  // Outfit ratings, so looks the user loved together rank first. Read once
  // each time the sheet opens; suggestions show immediately without them.
  const isOpen = Boolean(item);
  const [feedback, setFeedback] = useState<OutfitFeedback[]>([]);
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    loadOutfitFeedback()
      .then((list) => {
        if (active) setFeedback(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isOpen]);

  const pairingGroups = useMemo(
    () => (item ? suggestPairings(item, wardrobe, { brain: buildOutfitBrain(feedback), layeringPreference }) : []),
    [item, wardrobe, feedback, layeringPreference]
  );
  const visibleGroups = pairingGroups.filter((g) => g.suggestions.length > 0);

  if (!item) return null;

  return (
    <Modal
      visible={Boolean(item)}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.categoryBadge}>
              <Shirt size={12} color={COLORS.primary} />
              <Text style={styles.categoryText}>{item.category.toUpperCase()}</Text>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView key={item.id} showsVerticalScrollIndicator={false}>
            {/* Garment Image */}
            <View style={styles.imageFrame}>
              <GarmentImage uri={item.imageUrl} style={styles.garmentImg} iconSize={28} />
            </View>

            {/* Title & Style Archetype */}
            <View style={styles.titleSection}>
              <Text style={styles.garmentTitle}>{item.name}</Text>
              <Text style={styles.garmentStyle}>
                {item.style || 'Casual Essential'} • {item.subcategory}
              </Text>
            </View>

            {/* Color & Attributes Grid */}
            <View style={styles.attrGrid}>
              <View style={styles.attrCard}>
                <Text style={styles.attrLabel}>Color</Text>
                <View style={styles.colorRow}>
                  <View style={[styles.colorDot, { backgroundColor: item.hexColor || '#4A5568' }]} />
                  <Text style={styles.attrVal}>{item.color}</Text>
                </View>
              </View>

              <View style={styles.attrCard}>
                <Text style={styles.attrLabel}>Formality</Text>
                <Text style={styles.attrVal}>{item.formality}</Text>
              </View>

              <View style={styles.attrCard}>
                <Text style={styles.attrLabel}>Fabric</Text>
                <Text style={styles.attrVal}>{item.fabric}</Text>
              </View>

              <View style={styles.attrCard}>
                <Text style={styles.attrLabel}>Fit</Text>
                <Text style={styles.attrVal}>{item.fit || 'Regular'}</Text>
              </View>
            </View>

            {/* Size and where it's kept */}
            <View key={item.id} style={styles.placeSection}>
              <SizePicker category={item.category} value={item.size} onChange={(size) => onUpdateItem(item.id, { size })} />
              <StorageLocationPicker
                value={item.storageLocation}
                customPlaces={customPlaces}
                onChange={(storageLocation) => onUpdateItem(item.id, { storageLocation })}
              />
            </View>

            {/* Pairing Notes */}
            {item.pairingNotes && (
              <View style={styles.noteBox}>
                <View style={styles.noteHeader}>
                  <Sparkles size={13} color={COLORS.primary} />
                  <Text style={styles.noteTitle}>Styling Notes</Text>
                </View>
                <Text style={styles.noteBody}>"{item.pairingNotes}"</Text>
              </View>
            )}

            {/* Pairs well with — pieces from the user's own wardrobe */}
            <View style={styles.pairSection}>
              <View style={styles.noteHeader}>
                <Sparkles size={13} color={COLORS.primary} />
                <Text style={styles.pairTitle}>Pairs well with</Text>
              </View>
              <Text style={styles.pairSubtitle}>
                Picked from your wardrobe for this {item.subcategory.toLowerCase() || 'piece'}
              </Text>

              {visibleGroups.length === 0 ? (
                <View style={styles.pairEmpty}>
                  <Shirt size={18} color={COLORS.primary} />
                  <Text style={styles.pairEmptyText}>{emptyPairingHint(pairingGroups)}</Text>
                </View>
              ) : (
                visibleGroups.map((group) => (
                  <View key={group.category} style={styles.pairGroup}>
                    <Text style={styles.pairGroupTitle}>{group.title}</Text>
                    <View style={styles.pairRow}>
                      {group.suggestions.map(({ item: piece, reason }) => (
                        <TouchableOpacity
                          key={piece.id}
                          style={styles.pairCard}
                          activeOpacity={0.8}
                          disabled={!onSelectItem}
                          onPress={() => onSelectItem?.(piece)}
                        >
                          <View style={styles.pairImageFrame}>
                            <GarmentImage uri={piece.imageUrl} style={styles.pairImage} iconSize={18} />
                          </View>
                          <View style={styles.pairInfo}>
                            <Text style={styles.pairName} numberOfLines={1}>
                              {piece.name}
                            </Text>
                            <Text style={styles.pairReason} numberOfLines={2}>
                              {reason}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                      {/* Keep cards the same width when a group has fewer than three. */}
                      {Array.from({ length: 3 - group.suggestions.length }, (_, i) => (
                        <View key={`spacer-${i}`} style={styles.pairSpacer} />
                      ))}
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Delete / Remove Action */}
            <TouchableOpacity
              style={styles.deleteBtn}
              activeOpacity={0.8}
              onPress={() => {
                onRemove(item.id);
                onClose();
              }}
            >
              <Trash2 size={16} color={COLORS.danger} style={{ marginRight: 6 }} />
              <Text style={styles.deleteBtnText}>Remove from Wardrobe</Text>
            </TouchableOpacity>
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
    marginBottom: 14
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryAlpha,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    gap: 6
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.8
  },
  closeBtn: {
    padding: 4
  },
  imageFrame: {
    width: '100%',
    height: 220,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.bg,
    marginBottom: 16
  },
  garmentImg: {
    width: '100%',
    height: '100%'
  },
  titleSection: {
    marginBottom: 16
  },
  garmentTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4
  },
  garmentStyle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic'
  },
  attrGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16
  },
  attrCard: {
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
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)'
  },
  attrVal: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textTransform: 'capitalize'
  },
  placeSection: {
    gap: 16,
    marginBottom: 16
  },
  noteBox: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.sm,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    marginBottom: 20
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4
  },
  noteTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary
  },
  noteBody: {
    fontSize: 12.5,
    color: COLORS.textPrimary,
    lineHeight: 17
  },
  pairSection: {
    marginBottom: 20
  },
  pairTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary
  },
  pairSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 12
  },
  pairEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  pairEmptyText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    color: COLORS.textSecondary
  },
  pairGroup: {
    marginBottom: 14
  },
  pairGroupTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8
  },
  pairRow: {
    flexDirection: 'row',
    gap: 10
  },
  pairCard: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
    overflow: 'hidden'
  },
  pairSpacer: {
    flex: 1
  },
  pairImageFrame: {
    width: '100%',
    aspectRatio: 1 / 1.1,
    backgroundColor: COLORS.surfaceSubtle
  },
  pairImage: {
    width: '100%',
    height: '100%'
  },
  pairInfo: {
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 9
  },
  pairName: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.textPrimary
  },
  pairReason: {
    fontSize: 10.5,
    lineHeight: 14,
    color: COLORS.textSecondary,
    marginTop: 2
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: 'rgba(168, 73, 59, 0.3)',
    marginBottom: 10
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.danger
  }
});
