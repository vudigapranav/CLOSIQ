import React from 'react';
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
import { GarmentItem } from '../../../src/types/wardrobe';
import { GarmentImage } from './GarmentImage';

interface GarmentDetailModalProps {
  item: GarmentItem | null;
  onClose: () => void;
  onRemove: (id: string) => void;
}

export const GarmentDetailModal: React.FC<GarmentDetailModalProps> = ({
  item,
  onClose,
  onRemove
}) => {
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

          <ScrollView showsVerticalScrollIndicator={false}>
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
