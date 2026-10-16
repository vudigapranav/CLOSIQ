import React, { useEffect, useMemo, useRef } from 'react';
import { X, Tag, Sparkles, Layers, Trash2, Shirt } from 'lucide-react';
import { GarmentItem, GarmentDetailsPatch, LayeringPreference } from '../../types/wardrobe';
import { OutfitBrain } from '../../services/outfitBrain';
import { emptyPairingHint, suggestPairings } from '../../services/pairingSuggestions';
import { GarmentImage } from '../ui/GarmentImage';
import { StorageLocationField } from '../ui/StorageLocationField';
import { SizeField } from '../ui/SizeField';

interface ClothingDetailModalProps {
  item: GarmentItem | null;
  onClose: () => void;
  onDeleteItem: (id: string) => void;
  /** Persists an edited size / "where is it kept" place for this item. */
  onUpdateItem: (id: string, patch: GarmentDetailsPatch) => void;
  customPlaces?: string[];
  /** The user's wardrobe — "Pairs well with" only ever suggests pieces from it. */
  wardrobe?: GarmentItem[];
  brain?: OutfitBrain;
  layeringPreference?: LayeringPreference;
  /** Opens a suggested piece in this same sheet. */
  onSelectItem?: (item: GarmentItem) => void;
}

export const ClothingDetailModal: React.FC<ClothingDetailModalProps> = ({
  item,
  onClose,
  onDeleteItem,
  onUpdateItem,
  customPlaces = [],
  wardrobe = [],
  brain,
  layeringPreference,
  onSelectItem
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const pairingGroups = useMemo(
    () => (item ? suggestPairings(item, wardrobe, { brain, layeringPreference }) : []),
    [item, wardrobe, brain, layeringPreference]
  );
  const visibleGroups = pairingGroups.filter((g) => g.suggestions.length > 0);

  // Opening a suggested piece swaps the item in place; start it from the top.
  useEffect(() => {
    sheetRef.current?.scrollTo({ top: 0 });
  }, [item?.id]);

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
      className="animate-fade-in sheet-backdrop"
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          backgroundColor: 'var(--color-surface)',
          borderTopLeftRadius: 'var(--radius-xl)',
          borderTopRightRadius: 'var(--radius-xl)',
          padding: 24,
          overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border)'
        }}
        ref={sheetRef}
        className="animate-slide-up sheet"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span className="text-metadata" style={{ color: 'var(--color-primary)' }}>
            {item.brand || 'Personal Collection'}
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            title="Close"
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

        {/* Size and where it's kept — editable in place; saved as they change */}
        <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
          <SizeField category={item.category} value={item.size} onChange={(size) => onUpdateItem(item.id, { size })} />
          <StorageLocationField
            value={item.storageLocation}
            customPlaces={customPlaces}
            onChange={(storageLocation) => onUpdateItem(item.id, { storageLocation })}
          />
        </div>

        {/* Styling notes from the scan, when there are any */}
        {item.pairingNotes && (
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
              Styling notes
            </div>
            <p className="text-body" style={{ fontSize: '0.84rem', lineHeight: 1.45, color: 'var(--color-text-primary)' }}>
              {item.pairingNotes}
            </p>
          </div>
        )}

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

        {/* Pairs well with — pieces from the user's own wardrobe */}
        <section style={{ marginBottom: 24 }} aria-label="Pairs well with">
          <div className="text-metadata" style={{ color: 'var(--color-primary)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Sparkles size={13} /> Pairs well with
          </div>
          <p className="text-body" style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
            Picked from your wardrobe for this {item.subcategory.toLowerCase() || 'piece'}
          </p>

          {visibleGroups.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: 14,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border)',
                fontSize: '0.8rem',
                color: 'var(--color-text-secondary)'
              }}
            >
              <Shirt size={18} style={{ flexShrink: 0, color: 'var(--color-primary)' }} />
              {emptyPairingHint(pairingGroups)}
            </div>
          ) : (
            visibleGroups.map((group) => (
              <div key={group.category} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8 }}>
                  {group.title}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                  {group.suggestions.map(({ item: piece, reason }) => (
                    <button
                      key={piece.id}
                      type="button"
                      onClick={() => onSelectItem?.(piece)}
                      title={`Open ${piece.name}`}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        textAlign: 'left',
                        padding: 0,
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-surface-elevated)',
                        overflow: 'hidden',
                        cursor: onSelectItem ? 'pointer' : 'default',
                        color: 'inherit',
                        font: 'inherit'
                      }}
                    >
                      <div style={{ width: '100%', aspectRatio: '1 / 1.1', backgroundColor: 'var(--color-surface-subtle)' }}>
                        <GarmentImage src={piece.imageUrl} alt={piece.name} category={piece.category} hexColor={piece.hexColor} />
                      </div>
                      <div style={{ padding: '8px 8px 10px' }}>
                        <div
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            color: 'var(--color-text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {piece.name}
                        </div>
                        <div
                          style={{
                            fontSize: '0.66rem',
                            lineHeight: 1.3,
                            color: 'var(--color-text-secondary)',
                            marginTop: 2,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {reason}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>

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
              color: 'var(--color-danger)',
              border: '1px solid rgba(168,73,59,0.3)',
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
