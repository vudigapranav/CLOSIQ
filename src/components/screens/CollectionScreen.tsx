import React, { useMemo, useState } from 'react';
import { Search, Plus, X, Shirt, MapPin } from 'lucide-react';
import { CategoryChip } from '../ui/CategoryChip';
import { ClothingCard } from '../ui/ClothingCard';
import { EmptyState } from '../ui/EmptyState';
import { PrimaryButton } from '../ui/PrimaryButton';
import { GarmentItem } from '../../types/wardrobe';
import { usedStorageLocations } from '../../data/storageLocations';
import { describeSearch, searchWardrobe } from '../../services/wardrobeSearch';

interface CollectionScreenProps {
  wardrobe: GarmentItem[];
  onOpenAddItem: () => void;
  onSelectItem: (item: GarmentItem) => void;
}

export const CollectionScreen: React.FC<CollectionScreenProps> = ({
  wardrobe,
  onOpenAddItem,
  onSelectItem
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  // '' = every place. Only offered once at least one item has a place set.
  const [activePlace, setActivePlace] = useState<string>('');
  const usedPlaces = usedStorageLocations(wardrobe);
  // A place disappears once its last item is moved or removed; drop the filter with it.
  const placeFilter = usedPlaces.includes(activePlace) ? activePlace : '';

  const categoryOptions = [
    { label: 'All', key: 'All' },
    { label: 'Tops', key: 'tops' },
    { label: 'Bottoms', key: 'bottoms' },
    { label: 'Footwear', key: 'shoes' },
    { label: 'Outerwear', key: 'outerwear' },
    { label: 'Accessories', key: 'accessories' }
  ];

  // Smart search: "blue jacket" = any blue-family piece that is any kind of
  // jacket (see services/wardrobeSearch.ts). Category + place narrow first.
  const filteredWardrobe = useMemo(
    () =>
      searchWardrobe(
        wardrobe.filter(
          (item) =>
            (activeCategory === 'All' || item.category === activeCategory) &&
            (!placeFilter || item.storageLocation === placeFilter)
        ),
        searchQuery
      ),
    [wardrobe, activeCategory, placeFilter, searchQuery]
  );
  const understood = useMemo(() => describeSearch(searchQuery), [searchQuery]);

  return (
    <div style={{ padding: '20px 20px 32px' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 className="text-screen-heading">My Wardrobe</h1>
          <p className="text-body" style={{ marginTop: 2 }}>Everything you own, beautifully organized.</p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={onOpenAddItem}
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-on-primary)',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              padding: '8px 16px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <Plus size={16} />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* Smart Search Bar — always visible */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="search"
            aria-label="Search your wardrobe"
            placeholder='Try "blue jacket", "white sneakers", "office"'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px 12px 42px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--color-border-medium)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              title="Clear search"
              style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}
            >
              <X size={16} />
            </button>
          )}
        </div>
        {understood.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <span className="text-caption">Looking for</span>
            {understood.map((label, i) => (
              <span
                key={`${label}-${i}`}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: 'var(--color-primary)',
                  backgroundColor: 'var(--color-primary-alpha)',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-pill)'
                }}
              >
                {label}
              </span>
            ))}
            <span className="text-caption">
              · {filteredWardrobe.length} piece{filteredWardrobe.length === 1 ? '' : 's'}
            </span>
          </div>
        )}
      </div>

      {/* Category Chips Bar */}
      <div className="hide-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 20 }}>
        {categoryOptions.map((cat) => {
          const count = cat.key === 'All'
            ? wardrobe.length
            : wardrobe.filter((i) => i.category === cat.key).length;

          return (
            <CategoryChip
              key={cat.key}
              label={cat.label}
              count={count}
              active={activeCategory === cat.key}
              onClick={() => setActiveCategory(cat.key)}
            />
          );
        })}
      </div>

      {/* Where-is-it-kept filter */}
      {usedPlaces.length > 0 && (
        <div style={{ position: 'relative', marginTop: -8, marginBottom: 20 }}>
          <MapPin size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-primary)', pointerEvents: 'none' }} />
          <select
            aria-label="Filter by where it's kept"
            value={placeFilter}
            onChange={(e) => setActivePlace(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 36px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--color-border-medium)',
              backgroundColor: placeFilter ? 'var(--color-primary-alpha)' : 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              fontSize: '0.82rem'
            }}
          >
            <option value="">All places</option>
            {usedPlaces.map((place) => (
              <option key={place} value={place}>
                {place} ({wardrobe.filter((i) => i.storageLocation === place).length})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Wardrobe Grid / Empty States */}
      {wardrobe.length === 0 ? (
        <EmptyState
          icon={<Shirt size={28} color="var(--color-primary)" />}
          title="Your collection is empty."
          description="Add your first piece and CLOSIQ will start organizing your wardrobe."
          action={
            <PrimaryButton icon={<Plus size={18} />} onClick={onOpenAddItem}>
              Add Your First Item
            </PrimaryButton>
          }
        />
      ) : filteredWardrobe.length === 0 ? (
        <EmptyState
          icon={<Search size={26} color="var(--color-primary)" />}
          title="No items match."
          description={
            searchQuery.trim()
              ? `Nothing you own matches "${searchQuery.trim()}"${activeCategory === 'All' ? '' : ' in this section'}. Try fewer words, or a colour family like "blue".`
              : 'Try a different category or place.'
          }
        />
      ) : (
        <div className="garment-grid">
          {filteredWardrobe.map((item) => (
            <ClothingCard
              key={item.id}
              name={item.name}
              category={item.category === 'shoes' ? 'Footwear' : item.category.charAt(0).toUpperCase() + item.category.slice(1)}
              color={item.color}
              hexColor={item.hexColor}
              imageUrl={item.imageUrl}
              brand={item.brand}
              wearCount={item.wearCount}
              onClick={() => onSelectItem(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
