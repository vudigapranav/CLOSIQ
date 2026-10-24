import React from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Check } from 'lucide-react-native';
import { COLORS, RADIUS } from '../theme';
import {
  Facet,
  FacetKey,
  SORT_OPTIONS,
  WardrobeFilterState,
  WardrobeSort,
  activeFilterCount,
  clearFacet,
  toggleFilter
} from '../../../src/services/wardrobeFilters';

interface WardrobeFilterSheetProps {
  visible: boolean;
  /** e.g. "Tops" or "your wardrobe". */
  sectionLabel: string;
  facets: Facet[];
  filters: WardrobeFilterState;
  onChange: (next: WardrobeFilterState) => void;
  sort: WardrobeSort;
  onSortChange: (sort: WardrobeSort) => void;
  resultCount: number;
  onClose: () => void;
}

/** Every filter for the open Wardrobe section; changes apply live (shared engine: src/services/wardrobeFilters.ts). */
export const WardrobeFilterSheet: React.FC<WardrobeFilterSheetProps> = ({
  visible,
  sectionLabel,
  facets,
  filters,
  onChange,
  sort,
  onSortChange,
  resultCount,
  onClose
}) => {
  const insets = useSafeAreaInsets();
  const active = activeFilterCount(filters);
  const toggle = (facet: FacetKey, value: string) => onChange(toggleFilter(filters, facet, value));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTap} activeOpacity={1} onPress={onClose} accessibilityLabel="Close filters" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Filter {sectionLabel}</Text>
              <Text style={styles.subtitle}>
                {active > 0 ? `${active} filter${active === 1 ? '' : 's'} on` : 'Narrow down what you own'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close filters">
              <X size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <Section title="Sort by">
              {SORT_OPTIONS.map((o) => (
                <OptionChip key={o.value} label={o.label} selected={sort === o.value} onPress={() => onSortChange(o.value)} />
              ))}
            </Section>

            {facets.length === 0 && (
              <Text style={styles.emptyText}>
                Add a few more pieces (with sizes and places) and filters will appear here.
              </Text>
            )}

            {facets.map((facet) => {
              const selected = filters[facet.key] || [];
              return (
                <Section
                  key={facet.key}
                  title={facet.title}
                  hint={facet.hint}
                  onClear={selected.length > 0 ? () => onChange(clearFacet(filters, facet.key)) : undefined}
                >
                  {facet.options.map((o) => (
                    <OptionChip
                      key={o.value}
                      label={o.label}
                      count={o.count}
                      hex={o.hex}
                      selected={selected.includes(o.value)}
                      onPress={() => toggle(facet.key, o.value)}
                    />
                  ))}
                </Section>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.clearAllBtn, active === 0 && { opacity: 0.5 }]}
              disabled={active === 0}
              onPress={() => onChange({})}
            >
              <Text style={styles.clearAllText}>Clear all</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.showBtn} activeOpacity={0.85} onPress={onClose}>
              <Text style={styles.showBtnText}>
                {resultCount === 0 ? 'No pieces match' : `Show ${resultCount} piece${resultCount === 1 ? '' : 's'}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const Section: React.FC<{ title: string; hint?: string; onClear?: () => void; children: React.ReactNode }> = ({
  title,
  hint,
  onClear,
  children
}) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onClear && (
        <TouchableOpacity onPress={onClear} hitSlop={8}>
          <Text style={styles.sectionClear}>Clear</Text>
        </TouchableOpacity>
      )}
    </View>
    {hint && <Text style={styles.sectionHint}>{hint}</Text>}
    <View style={styles.chipWrap}>{children}</View>
  </View>
);

const OptionChip: React.FC<{ label: string; count?: number; hex?: string; selected: boolean; onPress: () => void }> = ({
  label,
  count,
  hex,
  selected,
  onPress
}) => (
  <TouchableOpacity
    style={[styles.chip, selected && styles.chipSelected]}
    activeOpacity={0.75}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected }}
  >
    {hex ? <View style={[styles.swatch, { backgroundColor: hex }]} /> : selected ? <Check size={12} color="#FFFFFF" /> : null}
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    {count !== undefined && <Text style={[styles.chipCount, selected && styles.chipTextSelected]}>{count}</Text>}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end'
  },
  backdropTap: {
    flex: 1
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingTop: 18,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2
  },
  closeBtn: {
    padding: 4
  },
  body: {
    paddingHorizontal: 20
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 12,
    lineHeight: 19
  },
  section: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  sectionClear: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary
  },
  sectionHint: {
    fontSize: 11.5,
    color: COLORS.textMuted,
    marginTop: -4,
    marginBottom: 8
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)'
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textPrimary
  },
  chipCount: {
    fontSize: 11,
    color: COLORS.textSecondary
  },
  chipTextSelected: {
    color: '#FFFFFF'
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  clearAllBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  clearAllText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.textPrimary
  },
  showBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary
  },
  showBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
