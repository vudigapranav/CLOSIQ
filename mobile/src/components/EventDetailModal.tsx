import React from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { X, Trash2, Pencil, CalendarDays, Clock, Tag, Sparkles, Sun } from 'lucide-react-native';
import { COLORS, RADIUS } from '../theme';
import { PlannerEvent } from '../types/planner';
import { formatEventDateLabel, formatEventTimeLabel } from '../services/plannerStorage';

interface EventDetailModalProps {
  event: PlannerEvent | null;
  onClose: () => void;
  onEdit: (event: PlannerEvent) => void;
  onDelete: (id: string) => void;
  onPlanOutfit: (event: PlannerEvent) => void;
  onUseForToday: (event: PlannerEvent) => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  onClose,
  onEdit,
  onDelete,
  onPlanOutfit,
  onUseForToday
}) => {
  if (!event) return null;

  const handleDelete = () => {
    Alert.alert('Delete Event', `Remove "${event.title}" from your planner?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          onDelete(event.id);
          onClose();
        }
      }
    ]);
  };

  return (
    <Modal visible={Boolean(event)} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={styles.occasionBadge}>
              <Tag size={12} color={COLORS.primary} />
              <Text style={styles.occasionBadgeText}>{event.occasion.toUpperCase()}</Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
              <X size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
            <Text style={styles.title}>{event.title}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <CalendarDays size={14} color={COLORS.primary} />
                <Text style={styles.metaText}>{formatEventDateLabel(event.date)}</Text>
              </View>
              <View style={styles.metaItem}>
                <Clock size={14} color={COLORS.primary} />
                <Text style={styles.metaText}>{formatEventTimeLabel(event.time)}</Text>
              </View>
            </View>

            {event.notes ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteTitle}>Notes</Text>
                <Text style={styles.noteBody}>{event.notes}</Text>
              </View>
            ) : null}

            <Text style={styles.sectionLabel}>Outfit</Text>
            {event.outfit ? (
              <View style={styles.outfitCard}>
                <View style={styles.outfitThumbRow}>
                  {event.outfit.items.slice(0, 4).map((item, idx) => (
                    <View key={`${item.id}-${idx}`} style={styles.outfitThumbFrame}>
                      <Image source={{ uri: item.imageUrl }} style={styles.outfitThumbImg} resizeMode="cover" />
                    </View>
                  ))}
                </View>
                <Text style={styles.outfitTitle} numberOfLines={1}>{event.outfit.title}</Text>
                <Text style={styles.outfitMeta}>{event.outfit.items.length} pieces • {event.outfit.styleScore}% Match</Text>

                <View style={styles.outfitActionRow}>
                  <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8} onPress={() => onPlanOutfit(event)}>
                    <Text style={styles.secondaryBtnText}>Change Outfit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={() => onUseForToday(event)}>
                    <Sun size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.primaryBtnText}>Use for Today</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.planOutfitBtn} activeOpacity={0.85} onPress={() => onPlanOutfit(event)}>
                <Sparkles size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.planOutfitBtnText}>Plan an Outfit</Text>
              </TouchableOpacity>
            )}

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.editBtn} activeOpacity={0.8} onPress={() => onEdit(event)}>
                <Pencil size={14} color={COLORS.textPrimary} style={{ marginRight: 6 }} />
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} activeOpacity={0.8} onPress={handleDelete}>
                <Trash2 size={14} color={COLORS.danger} style={{ marginRight: 6 }} />
                <Text style={styles.deleteBtnText}>Delete</Text>
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14
  },
  occasionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryAlpha,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    gap: 6
  },
  occasionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.8
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 12
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  metaText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary
  },
  noteBox: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.sm,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    marginBottom: 16
  },
  noteTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4
  },
  noteBody: {
    fontSize: 12.5,
    color: COLORS.textPrimary,
    lineHeight: 17
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10
  },
  outfitCard: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16
  },
  outfitThumbRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10
  },
  outfitThumbFrame: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    backgroundColor: COLORS.surface
  },
  outfitThumbImg: {
    width: '100%',
    height: '100%'
  },
  outfitTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary
  },
  outfitMeta: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    marginTop: 2,
    marginBottom: 12
  },
  outfitActionRow: {
    flexDirection: 'row',
    gap: 10
  },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  secondaryBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textPrimary
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary
  },
  primaryBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  planOutfitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary,
    marginBottom: 16
  },
  planOutfitBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: 'rgba(168, 73, 59, 0.3)'
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.danger
  }
});
