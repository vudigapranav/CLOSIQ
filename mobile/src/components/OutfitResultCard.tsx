import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Dimensions
} from 'react-native';
import { Sparkles, RefreshCw, RefreshCcw, Bookmark, BookmarkCheck } from 'lucide-react-native';
import { COLORS, RADIUS } from '../theme';
import { GarmentItem } from '../../../src/types/wardrobe';

const { width } = Dimensions.get('window');

interface OutfitResultCardProps {
  mode: 'gemini' | 'fallback';
  title: string;
  vibe: string;
  styleScore: number;
  garments: GarmentItem[];
  explanation: {
    summary: string;
    colorHarmony?: string;
  };
  isSaved: boolean;
  onSelectGarmentForSwap: (garment: GarmentItem) => void;
  onRegenerate: () => void;
  onSave: () => void;
}

// Memoized: this card renders several garment images and re-renders on
// every keystroke in Today/Stylist's free-text prompt input otherwise (the
// whole screen re-renders on that state change, and without memo this card
// re-rendered right along with it despite none of its own props changing).
export const OutfitResultCard = React.memo<OutfitResultCardProps>(({
  mode,
  title,
  vibe,
  styleScore,
  garments,
  explanation,
  isSaved,
  onSelectGarmentForSwap,
  onRegenerate,
  onSave
}) => {
  return (
    <View style={styles.resultContainer}>
      {/* Card Header */}
      <View style={styles.resultHeaderRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.modeRow}>
            <Sparkles size={12} color={COLORS.primary} />
            <Text style={styles.modeText}>
              {mode === 'gemini' ? 'Gemini AI Stylist' : 'CLOSIQ Stylist Engine'}
            </Text>
          </View>
          <Text style={styles.resultTitle}>{title}</Text>
          <Text style={styles.resultVibe}>{vibe}</Text>
        </View>

        <View style={styles.matchScoreBadge}>
          <Text style={styles.matchScoreText}>{styleScore}% Match</Text>
        </View>
      </View>

      {/* Garment Cards Grid */}
      <Text style={styles.piecesTitle}>Selected Pieces (Tap piece to Swap)</Text>
      <View style={styles.garmentGrid}>
        {garments.map((garment) => (
          <TouchableOpacity
            key={garment.id}
            style={styles.garmentCard}
            activeOpacity={0.8}
            onPress={() => onSelectGarmentForSwap(garment)}
          >
            <View style={styles.garmentImgFrame}>
              <Image source={{ uri: garment.imageUrl }} style={styles.garmentImg} resizeMode="cover" />
              <View style={styles.catTag}>
                <Text style={styles.catTagText}>{garment.category.slice(0, 4)}</Text>
              </View>
              <View style={styles.swapBadge}>
                <RefreshCw size={10} color="#FFFFFF" />
              </View>
            </View>
            <View style={styles.garmentInfo}>
              <Text style={styles.garmentName} numberOfLines={1}>{garment.name}</Text>
              <View style={styles.garmentFooter}>
                <View style={[styles.colorDot, { backgroundColor: garment.hexColor || '#4A5568' }]} />
                <Text style={styles.garmentColor}>{garment.color}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Why It Works Rationale Box */}
      <View style={styles.whyItWorksBox}>
        <View style={styles.whyHeaderRow}>
          <Sparkles size={14} color={COLORS.primary} />
          <Text style={styles.whyTitle}>Why It Works</Text>
        </View>
        <Text style={styles.whySummary}>"{explanation.summary}"</Text>
        {explanation.colorHarmony ? (
          <Text style={styles.whyDetail}>• {explanation.colorHarmony}</Text>
        ) : null}
      </View>

      {/* Action Bar: Regenerate & Save */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.regenerateBtn}
          activeOpacity={0.8}
          onPress={onRegenerate}
        >
          <RefreshCcw size={15} color={COLORS.textPrimary} style={{ marginRight: 6 }} />
          <Text style={styles.regenerateBtnText}>Regenerate</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveBtn, isSaved && styles.savedBtn]}
          activeOpacity={0.8}
          onPress={onSave}
        >
          {isSaved ? (
            <>
              <BookmarkCheck size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.saveBtnText}>Saved ✓</Text>
            </>
          ) : (
            <>
              <Bookmark size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.saveBtnText}>Save Look</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
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
  }
});
