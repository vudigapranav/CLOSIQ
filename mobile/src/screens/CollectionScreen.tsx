import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  FlatList,
  TextInput
} from 'react-native';
import { Shirt, Plus, Search, X, SlidersHorizontal, ChevronDown, ArrowUpDown } from 'lucide-react-native';
import { COLORS, RADIUS } from '../theme';
import { GarmentItem, GarmentDetailsPatch, LayeringPreference, WardrobeProfile } from '../../../src/types/wardrobe';
import { AddItemModal } from '../components/AddItemModal';
import { GarmentDetailModal } from '../components/GarmentDetailModal';
import { GarmentImage } from '../components/GarmentImage';
import { customStorageLocations } from '../../../src/data/storageLocations';
import { describeSearch, searchWardrobe } from '../../../src/services/wardrobeSearch';
import {
  FacetKey,
  SORT_OPTIONS,
  WardrobeFilterState,
  WardrobeSort,
  activeFilterCount,
  applyFilters,
  buildFacets,
  facetButtonLabel,
  pruneFilters,
  sortWardrobe
} from '../../../src/services/wardrobeFilters';
import { WardrobeFilterSheet } from '../components/WardrobeFilterSheet';

const { width } = Dimensions.get('window');

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'tops', label: 'Tops' },
  { key: 'bottoms', label: 'Bottoms' },
  { key: 'outerwear', label: 'Outerwear' },
  { key: 'shoes', label: 'Footwear' },
  { key: 'accessories', label: 'Accessories' }
];

interface CollectionScreenProps {
  profile: WardrobeProfile;
  wardrobe: GarmentItem[];
  onGarmentAdded: (garment: GarmentItem) => void;
  onGarmentRemoved: (id: string) => void;
  onGarmentDetailsChanged: (id: string, patch: GarmentDetailsPatch) => void;
  layeringPreference?: LayeringPreference;
}

interface GarmentCardProps {
  item: GarmentItem;
  onPress: (item: GarmentItem) => void;
}

// Memoized + a stable onPress passed from the parent (see handleSelectGarment
// below) so scrolling the grid doesn't re-render every card whenever
// CollectionScreen re-renders for an unrelated reason (opening the add-item
// modal, an unrelated state change elsewhere on the screen).
const GarmentCard = React.memo<GarmentCardProps>(({ item, onPress }) => (
  <TouchableOpacity style={styles.garmentCard} activeOpacity={0.8} onPress={() => onPress(item)}>
    <View style={styles.cardImageFrame}>
      <GarmentImage uri={item.imageUrl} style={styles.cardImage} iconSize={20} />
      <View style={styles.catBadge}>
        <Text style={styles.catBadgeText}>{item.category.slice(0, 4)}</Text>
      </View>
    </View>

    <View style={styles.cardInfo}>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {item.name}
      </Text>

      <View style={styles.cardFooterRow}>
        <View style={styles.colorGroup}>
          <View style={[styles.colorDot, { backgroundColor: item.hexColor || '#4A5568' }]} />
          <Text style={styles.colorText}>{item.color}</Text>
        </View>

        <Text style={styles.formalityText}>{item.formality}</Text>
      </View>
    </View>
  </TouchableOpacity>
));

const FilterBarButton: React.FC<{
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
  chevron?: boolean;
}> = ({ label, active, onPress, icon, chevron }) => (
  <TouchableOpacity
    style={[styles.filterBarButton, active && styles.filterBarButtonActive]}
    activeOpacity={0.75}
    onPress={onPress}
    accessibilityRole="button"
  >
    {icon}
    <Text style={[styles.filterBarText, active && styles.filterBarTextActive]}>{label}</Text>
    {chevron && <ChevronDown size={13} color={active ? COLORS.primary : COLORS.textSecondary} />}
  </TouchableOpacity>
);

export const CollectionScreen: React.FC<CollectionScreenProps> = ({
  profile,
  wardrobe,
  onGarmentAdded,
  onGarmentRemoved,
  onGarmentDetailsChanged,
  layeringPreference
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<WardrobeFilterState>({});
  const [sort, setSort] = useState<WardrobeSort>('relevance');
  // Which filter sheet is open: 'all' = every filter, a facet = just that one
  // (from the inline filter bar), 'sort' = sorting; null = closed.
  const [sheet, setSheet] = useState<'all' | 'sort' | FacetKey | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  // Held by id and looked up in `wardrobe`, so the open detail sheet shows a
  // place change as soon as App's wardrobe state updates.
  const [selectedGarmentId, setSelectedGarmentId] = useState<string | null>(null);
  const selectedGarment = useMemo(
    () => (selectedGarmentId ? wardrobe.find((g) => g.id === selectedGarmentId) ?? null : null),
    [wardrobe, selectedGarmentId]
  );

  const customPlaces = useMemo(() => customStorageLocations(wardrobe), [wardrobe]);

  const sectionLabel = CATEGORIES.find((c) => c.key === selectedCategory)?.label ?? 'All';
  const sectionItems = useMemo(
    () => (selectedCategory === 'All' ? wardrobe : wardrobe.filter((g) => g.category === selectedCategory)),
    [wardrobe, selectedCategory]
  );
  // Filters on offer come from the open section (Tops shows top types, top
  // sizes…); a selection the section doesn't offer is ignored, not lost.
  const facets = useMemo(() => buildFacets(sectionItems), [sectionItems]);
  const activeFilters = useMemo(() => pruneFilters(filters, facets), [filters, facets]);
  const filterCount = activeFilterCount(activeFilters);

  // Section → smart search ("blue jacket" = every blue-family jacket of any
  // type) → filters → sort. `wardrobe` is lifted to App.tsx (Sprint M16).
  const filteredGarments = useMemo(
    () => sortWardrobe(applyFilters(searchWardrobe(sectionItems, searchQuery), activeFilters), sort),
    [sectionItems, searchQuery, activeFilters, sort]
  );
  const understood = useMemo(() => describeSearch(searchQuery), [searchQuery]);

  const handleSelectGarment = useCallback((item: GarmentItem) => setSelectedGarmentId(item.id), []);

  const renderGarmentCard = useCallback(
    ({ item }: { item: GarmentItem }) => <GarmentCard item={item} onPress={handleSelectGarment} />,
    [handleSelectGarment]
  );

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>Your Wardrobe</Text>
          <Text style={styles.screenSubtitle}>
            {wardrobe.length} cataloged item{wardrobe.length === 1 ? '' : 's'} ({profile.toUpperCase()} Profile)
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          activeOpacity={0.8}
          onPress={() => setShowAddModal(true)}
        >
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add Item</Text>
        </TouchableOpacity>
      </View>

      {/* Smart search */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={16} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder='Try "blue jacket" or "office"'
              placeholderTextColor={COLORS.textMuted}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel="Search your wardrobe"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={10} accessibilityLabel="Clear search">
                <X size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        {understood.length > 0 && (
          <View style={styles.understoodRow}>
            <Text style={styles.understoodLabel}>Looking for</Text>
            {understood.map((label, i) => (
              <View key={`${label}-${i}`} style={styles.understoodChip}>
                <Text style={styles.understoodChipText}>{label}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Category Filter Chips */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRail}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[styles.filterChip, isSelected && styles.selectedFilterChip]}
                activeOpacity={0.75}
                onPress={() => setSelectedCategory(cat.key)}
              >
                <Text style={[styles.filterText, isSelected && styles.selectedFilterText]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Filter section — always visible for the open section */}
      {sectionItems.length > 0 && (
        <View style={styles.filterBarContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
            <FilterBarButton
              icon={<SlidersHorizontal size={13} color={COLORS.primary} />}
              label={filterCount > 0 ? `All filters · ${filterCount}` : 'All filters'}
              active={filterCount > 0}
              onPress={() => setSheet('all')}
            />
            {facets.map((facet) => (
              <FilterBarButton
                key={facet.key}
                label={facetButtonLabel(facet, activeFilters)}
                active={(activeFilters[facet.key] || []).length > 0}
                chevron
                onPress={() => setSheet(facet.key)}
              />
            ))}
            <FilterBarButton
              icon={<ArrowUpDown size={13} color={COLORS.primary} />}
              label={SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Sort'}
              active={sort !== 'relevance'}
              chevron
              onPress={() => setSheet('sort')}
            />
          </ScrollView>
          <View style={styles.resultRow}>
            <Text style={styles.resultCount}>
              {filteredGarments.length} of {sectionItems.length} piece{sectionItems.length === 1 ? '' : 's'}
            </Text>
            {filterCount > 0 && (
              <TouchableOpacity onPress={() => setFilters({})} hitSlop={8}>
                <Text style={styles.clearLinkText}>Clear filters</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Wardrobe Grid or Empty State */}
      {filteredGarments.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.iconCircle}>
            <Shirt size={28} color={COLORS.primary} />
          </View>

          <Text style={styles.emptyTitle}>{searchQuery.trim() || filterCount > 0 ? 'No Matches' : 'No Garments Cataloged'}</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery.trim()
              ? `Nothing you own matches "${searchQuery.trim()}". Try fewer words, or a colour family like "blue".`
              : filterCount > 0
              ? 'No pieces in this section match these filters.'
              : selectedCategory === 'All'
              ? 'Your digital closet is empty. Tap "+ Add Item" to capture or upload real clothing photos.'
              : `No items cataloged under ${selectedCategory.toUpperCase()}. Upload a new garment to get started.`}
          </Text>

          {filterCount > 0 && (
            <TouchableOpacity style={styles.clearFiltersButton} activeOpacity={0.8} onPress={() => setFilters({})}>
              <Text style={styles.clearFiltersText}>Clear filters</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.heroAddButton}
            activeOpacity={0.8}
            onPress={() => setShowAddModal(true)}
          >
            <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.heroAddButtonText}>Upload Garment Photo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredGarments}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          renderItem={renderGarmentCard}
          removeClippedSubviews
          initialNumToRender={8}
        />
      )}

      <WardrobeFilterSheet
        visible={sheet !== null}
        focus={sheet === 'all' ? null : sheet}
        onShowAll={() => setSheet('all')}
        sectionLabel={sectionLabel === 'All' ? 'your wardrobe' : sectionLabel}
        facets={facets}
        filters={activeFilters}
        onChange={setFilters}
        sort={sort}
        onSortChange={setSort}
        resultCount={filteredGarments.length}
        onClose={() => setSheet(null)}
      />

      {/* Add Item Modal */}
      <AddItemModal
        visible={showAddModal}
        profile={profile}
        customPlaces={customPlaces}
        onClose={() => setShowAddModal(false)}
        onGarmentAdded={onGarmentAdded}
      />

      {/* Garment Detail Modal */}
      <GarmentDetailModal
        item={selectedGarment}
        onClose={() => setSelectedGarmentId(null)}
        onRemove={onGarmentRemoved}
        onUpdateItem={onGarmentDetailsChanged}
        customPlaces={customPlaces}
        wardrobe={wardrobe}
        layeringPreference={layeringPreference}
        onSelectItem={handleSelectGarment}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 0.5
  },
  screenSubtitle: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    marginTop: 2
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    gap: 4
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700'
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingBottom: 12
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderMedium
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    paddingVertical: 0
  },
  understoodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 8
  },
  understoodLabel: {
    fontSize: 11.5,
    color: COLORS.textMuted
  },
  understoodChip: {
    backgroundColor: COLORS.primaryAlpha,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: RADIUS.pill
  },
  understoodChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary
  },
  filterContainer: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 12
  },
  filterRail: {
    paddingHorizontal: 20,
    gap: 8
  },
  filterBarContainer: {
    paddingTop: 10,
    paddingBottom: 2,
    gap: 8
  },
  filterBarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderMedium
  },
  filterBarButtonActive: {
    backgroundColor: COLORS.primaryAlpha,
    borderColor: COLORS.primary
  },
  filterBarText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary
  },
  filterBarTextActive: {
    color: COLORS.primary,
    fontWeight: '700'
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20
  },
  clearLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary
  },
  resultCount: {
    fontSize: 11.5,
    color: COLORS.textMuted
  },
  clearFiltersButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginBottom: 12
  },
  clearFiltersText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700'
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  selectedFilterChip: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary
  },
  filterText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textPrimary
  },
  selectedFilterText: {
    color: '#FFFFFF'
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24
  },
  heroAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: RADIUS.pill
  },
  heroAddButtonText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700'
  },
  gridContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 14
  },
  garmentCard: {
    width: (width - 44) / 2,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  cardImageFrame: {
    width: '100%',
    height: 140,
    backgroundColor: COLORS.bg,
    position: 'relative'
  },
  cardImage: {
    width: '100%',
    height: '100%'
  },
  catBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  catBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  cardInfo: {
    padding: 10
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  colorGroup: {
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
    fontSize: 11,
    color: COLORS.textSecondary
  },
  formalityText: {
    fontSize: 10.5,
    color: COLORS.primary,
    fontWeight: '600',
    textTransform: 'capitalize'
  }
});
