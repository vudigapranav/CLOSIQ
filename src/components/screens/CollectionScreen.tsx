import React, { useMemo, useState } from 'react';
import { Search, Plus, X, Shirt, SlidersHorizontal } from 'lucide-react';
import { CategoryChip } from '../ui/CategoryChip';
import { ClothingCard } from '../ui/ClothingCard';
import { EmptyState } from '../ui/EmptyState';
import { PrimaryButton } from '../ui/PrimaryButton';
import { GarmentItem } from '../../types/wardrobe';
import { describeSearch, searchWardrobe } from '../../services/wardrobeSearch';
import {
  SORT_OPTIONS,
  WardrobeFilterState,
  WardrobeSort,
  activeFilterChips,
  activeFilterCount,
  applyFilters,
  buildFacets,
  pruneFilters,
  sortWardrobe,
  toggleFilter
} from '../../services/wardrobeFilters';
import { WardrobeFilterSheet } from '../modals/WardrobeFilterSheet';

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
  const [filters, setFilters] = useState<WardrobeFilterState>({});
  const [sort, setSort] = useState<WardrobeSort>('relevance');
  const [showFilters, setShowFilters] = useState(false);

  const categoryOptions = [
    { label: 'All', key: 'All' },
    { label: 'Tops', key: 'tops' },
    { label: 'Bottoms', key: 'bottoms' },
    { label: 'Footwear', key: 'shoes' },
    { label: 'Outerwear', key: 'outerwear' },
    { label: 'Accessories', key: 'accessories' }
  ];

  const sectionLabel = categoryOptions.find((c) => c.key === activeCategory)?.label ?? 'All';
  const sectionItems = useMemo(
    () => (activeCategory === 'All' ? wardrobe : wardrobe.filter((item) => item.category === activeCategory)),
    [wardrobe, activeCategory]
  );
  // Filters on offer come from the open section (Tops shows top types, top sizes…).
  const facets = useMemo(() => buildFacets(sectionItems), [sectionItems]);
  // Selections the section doesn't offer (a top type while on Bottoms) are ignored, not lost.
  const activeFilters = useMemo(() => pruneFilters(filters, facets), [filters, facets]);
  const filterCount = activeFilterCount(activeFilters);
  const chips = activeFilterChips(activeFilters, facets);

  // Smart search: "blue jacket" = any blue-family piece that is any kind of
  // jacket (see services/wardrobeSearch.ts), then the section's filters, then sort.
  const filteredWardrobe = useMemo(
    () => sortWardrobe(applyFilters(searchWardrobe(sectionItems, searchQuery), activeFilters), sort),
    [sectionItems, searchQuery, activeFilters, sort]
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              inputMode="search"
              enterKeyHint="search"
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
          <button
            onClick={() => setShowFilters(true)}
            aria-label={filterCount > 0 ? `Filters, ${filterCount} on` : 'Filters'}
            title={`Filter ${sectionLabel === 'All' ? 'your wardrobe' : sectionLabel}`}
            style={{
              position: 'relative',
              flexShrink: 0,
              height: 44,
              padding: '0 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: 'var(--radius-pill)',
              border: `1px solid ${filterCount > 0 ? 'var(--color-primary)' : 'var(--color-border-medium)'}`,
              backgroundColor: filterCount > 0 ? 'var(--color-primary-alpha)' : 'var(--color-surface)',
              color: filterCount > 0 ? 'var(--color-primary)' : 'var(--color-text-primary)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <SlidersHorizontal size={16} />
            <span>Filters</span>
            {filterCount > 0 && (
              <span
                style={{
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text-on-primary)',
                  fontSize: '0.68rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {filterCount}
              </span>
            )}
          </button>
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

      {/* Active filters + sort */}
      {wardrobe.length > 0 && (
        <div style={{ marginTop: -8, marginBottom: 16 }}>
          {chips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {chips.map((chip) => (
                <button
                  key={`${chip.facet}:${chip.value}`}
                  onClick={() => setFilters(toggleFilter(activeFilters, chip.facet, chip.value))}
                  aria-label={`Remove filter ${chip.label}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 8px 4px 10px',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid var(--color-primary)',
                    backgroundColor: 'var(--color-primary-alpha)',
                    color: 'var(--color-primary)',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {chip.hex && (
                    <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: chip.hex, border: '1px solid rgba(0,0,0,0.15)' }} />
                  )}
                  <span>{chip.label}</span>
                  <X size={12} />
                </button>
              ))}
              <button
                onClick={() => setFilters({})}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '0.74rem', fontWeight: 600, textDecoration: 'underline' }}
              >
                Clear all
              </button>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span className="text-caption">
              {filteredWardrobe.length} of {sectionItems.length} piece{sectionItems.length === 1 ? '' : 's'}
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="text-caption">Sort</span>
              <select
                aria-label="Sort wardrobe"
                value={sort}
                onChange={(e) => setSort(e.target.value as WardrobeSort)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--color-border-medium)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  fontSize: '0.76rem'
                }}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>
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
              : sectionItems.length === 0
              ? `You haven't added any ${sectionLabel.toLowerCase()} yet.`
              : 'No pieces in this section match these filters.'
          }
          action={
            filterCount > 0 ? (
              <PrimaryButton onClick={() => setFilters({})}>Clear filters</PrimaryButton>
            ) : undefined
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

      <WardrobeFilterSheet
        open={showFilters}
        sectionLabel={sectionLabel === 'All' ? 'your wardrobe' : sectionLabel}
        facets={facets}
        filters={activeFilters}
        onChange={setFilters}
        sort={sort}
        onSortChange={setSort}
        resultCount={filteredWardrobe.length}
        onClose={() => setShowFilters(false)}
      />
    </div>
  );
};
