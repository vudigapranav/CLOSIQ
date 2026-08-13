import React, { useState } from 'react';
import { Search, Plus, X, Shirt } from 'lucide-react';
import { CategoryChip } from '../ui/CategoryChip';
import { ClothingCard } from '../ui/ClothingCard';
import { EmptyState } from '../ui/EmptyState';
import { PrimaryButton } from '../ui/PrimaryButton';
import { GarmentItem } from '../../types/wardrobe';

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
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categoryOptions = [
    { label: 'All', key: 'All' },
    { label: 'Tops', key: 'tops' },
    { label: 'Bottoms', key: 'bottoms' },
    { label: 'Footwear', key: 'shoes' },
    { label: 'Outerwear', key: 'outerwear' },
    { label: 'Accessories', key: 'accessories' }
  ];

  const filteredWardrobe = wardrobe.filter((item) => {
    if (activeCategory !== 'All' && item.category !== activeCategory) {
      return false;
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchBrand = (item.brand || '').toLowerCase().includes(q);
      const matchColor = item.color.toLowerCase().includes(q);
      const matchFabric = item.fabric.toLowerCase().includes(q);
      return matchName || matchBrand || matchColor || matchFabric;
    }
    return true;
  });

  return (
    <div style={{ padding: '20px 20px 32px' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 className="text-screen-heading">My Collection</h1>
          <p className="text-body" style={{ marginTop: 2 }}>Everything you own, beautifully organized.</p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setShowSearch(!showSearch)}
            style={{
              background: showSearch ? 'var(--color-primary-alpha)' : 'var(--color-surface-subtle)',
              border: '1px solid var(--color-border)',
              borderRadius: '50%',
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: showSearch ? 'var(--color-primary)' : 'var(--color-text-secondary)'
            }}
            title="Search Collection"
          >
            <Search size={18} />
          </button>

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

      {/* Inline Search Bar */}
      {showSearch && (
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Search by name, color, or fabric..."
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
              style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

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
          description="Try a different category or search term."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
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
