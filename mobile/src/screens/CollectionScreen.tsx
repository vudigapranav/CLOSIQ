import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  FlatList
} from 'react-native';
import { Shirt, Plus } from 'lucide-react-native';
import { COLORS, RADIUS } from '../theme';
import { GarmentItem, WardrobeProfile } from '../../../src/types/wardrobe';
import { AddItemModal } from '../components/AddItemModal';
import { GarmentDetailModal } from '../components/GarmentDetailModal';

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
      <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
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

export const CollectionScreen: React.FC<CollectionScreenProps> = ({
  profile,
  wardrobe,
  onGarmentAdded,
  onGarmentRemoved
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedGarment, setSelectedGarment] = useState<GarmentItem | null>(null);

  // Filter items by category. `wardrobe` is lifted to App.tsx (Sprint
  // M16) — this screen no longer loads its own copy from AsyncStorage.
  const filteredGarments = useMemo(
    () =>
      selectedCategory === 'All'
        ? wardrobe
        : wardrobe.filter((g) => g.category === selectedCategory),
    [wardrobe, selectedCategory]
  );

  const handleSelectGarment = useCallback((item: GarmentItem) => setSelectedGarment(item), []);

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

      {/* Wardrobe Grid or Empty State */}
      {filteredGarments.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.iconCircle}>
            <Shirt size={28} color={COLORS.primary} />
          </View>

          <Text style={styles.emptyTitle}>No Garments Cataloged</Text>
          <Text style={styles.emptySubtitle}>
            {selectedCategory === 'All'
              ? 'Your digital closet is empty. Tap "+ Add Item" to capture or upload real clothing photos.'
              : `No items cataloged under ${selectedCategory.toUpperCase()}. Upload a new garment to get started.`}
          </Text>

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

      {/* Add Item Modal */}
      <AddItemModal
        visible={showAddModal}
        profile={profile}
        onClose={() => setShowAddModal(false)}
        onGarmentAdded={onGarmentAdded}
      />

      {/* Garment Detail Modal */}
      <GarmentDetailModal
        item={selectedGarment}
        onClose={() => setSelectedGarment(null)}
        onRemove={onGarmentRemoved}
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
  filterContainer: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 12
  },
  filterRail: {
    paddingHorizontal: 20,
    gap: 8
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
