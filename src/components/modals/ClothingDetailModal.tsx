import React from 'react';
import { X, Tag, Sparkles, Layers, Trash2 } from 'lucide-react';
import { GarmentItem } from '../../types/wardrobe';
import { GarmentImage } from '../ui/GarmentImage';

interface ClothingDetailModalProps {
  item: GarmentItem | null;
  onClose: () => void;
  onDeleteItem: (id: string) => void;
}

export const ClothingDetailModal: React.FC<ClothingDetailModalProps> = ({
  item,
  onClose,
  onDeleteItem
}) => {
  if (!item) return null;

  // Calculate simulated outfit usage count based on wearCount or item id hash
  const outfitCount = Math.max(3, (item.wearCount || 5) % 9 + 2);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center'
      }}
      className="animate-fade-in"
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          backgroundColor: 'var(--color-surface)',
          borderTopLeftRadius: 'var(--radius-lg)',
          borderTopRightRadius: 'var(--radius-lg)',
          padding: 24,
          overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border)'
        }}
        className="animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span className="text-metadata" style={{ color: 'var(--color-primary)' }}>
            {item.brand || 'Personal Collection'}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Large Garment Image */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 320,
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            marginBottom: 20,
            backgroundColor: 'var(--color-surface-subtle)'
          }}
        >
          <GarmentImage src={item.imageUrl} alt={item.name} category={item.category} hexColor={item.hexColor} />
          
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              backgroundColor: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(8px)',
              padding: '4px 12px',
              borderRadius: 'var(--radius-pill)',
              color: '#FFF',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: item.hexColor, display: 'inline-block' }} />
            <span>{item.color}</span>
          </div>

          {/* Outfit Count Pill Badge */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-on-primary)',
              padding: '4px 12px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.72rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <Layers size={13} />
            <span>Used in {outfitCount} outfits</span>
          </div>
        </div>

        {/* Title & Metadata */}
        <h2 className="text-screen-heading" style={{ fontSize: '1.5rem', marginBottom: 4 }}>
          {item.name}
        </h2>
        <p className="text-body" style={{ color: 'var(--color-text-secondary)', marginBottom: 20 }}>
          {item.subcategory} · {item.formality.replace('_', ' ')} · {item.fabric}
        </p>

        {/* Best Paired With Section */}
        <div
          style={{
            padding: 16,
            backgroundColor: 'var(--color-surface-subtle)',
            borderRadius: 'var(--radius-md)',
            borderLeft: '3px solid var(--color-primary)',
            marginBottom: 20
          }}
        >
          <div className="text-metadata" style={{ color: 'var(--color-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Sparkles size={13} />
            Best paired with
          </div>
          <p className="text-body" style={{ fontSize: '0.84rem', lineHeight: 1.45, color: 'var(--color-text-primary)' }}>
            {item.pairingNotes || 'Combines gracefully with tailored neutral bottoms, silk blouses, or clean white leather sneakers.'}
          </p>
        </div>

        {/* Style Tags */}
        <div style={{ marginBottom: 24 }}>
          <div className="text-metadata" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Tag size={13} /> Style Tags
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {item.tags.map((tag, idx) => (
              <span
                key={idx}
                style={{
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.75rem',
                  backgroundColor: 'var(--color-surface-subtle)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)'
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => {
              if (confirm('Remove this item from your collection?')) {
                onDeleteItem(item.id);
                onClose();
              }
            }}
            style={{
              padding: '12px 18px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.82rem',
              fontWeight: 600,
              backgroundColor: 'var(--color-surface-subtle)',
              color: '#D9534F',
              border: '1px solid rgba(217,83,79,0.3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Trash2 size={16} />
            Remove Item
          </button>

          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px 18px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-on-primary)',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
