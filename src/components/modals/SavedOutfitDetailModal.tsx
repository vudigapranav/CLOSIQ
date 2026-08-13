import React from 'react';
import { X, Sparkles, Heart, AlertTriangle, Check, Trash2, ArrowRight } from 'lucide-react';
import { GarmentItem, Outfit } from '../../types/wardrobe';
import { GarmentImage } from '../ui/GarmentImage';
import { PrimaryButton } from '../ui/PrimaryButton';
import { SecondaryButton } from '../ui/SecondaryButton';

interface SavedOutfitDetailModalProps {
  outfit: Outfit | null;
  wardrobe: GarmentItem[];
  onClose: () => void;
  onWearAgain: (outfit: Outfit) => void;
  onRemoveSaved: (id: string) => void;
}

export const SavedOutfitDetailModal: React.FC<SavedOutfitDetailModalProps> = ({
  outfit,
  wardrobe,
  onClose,
  onWearAgain,
  onRemoveSaved
}) => {
  if (!outfit) return null;

  // Resolve saved outfit items against current active wardrobe
  const wardrobeMap = new Map<string, GarmentItem>();
  wardrobe.forEach((item) => wardrobeMap.set(item.id, item));

  const resolvedItems = outfit.items.map((item) => ({
    original: item,
    current: wardrobeMap.get(item.id) || null
  }));

  const missingItems = resolvedItems.filter((r) => !r.current).map((r) => r.original);
  const validItems = resolvedItems.filter((r) => r.current !== null).map((r) => r.current!);

  const handleWearClick = () => {
    onWearAgain(outfit);
    onClose();
  };

  const handleRemoveClick = () => {
    onRemoveSaved(outfit.id);
    onClose();
  };

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
      role="dialog"
      aria-modal="true"
      aria-labelledby="saved-outfit-title"
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
        className="animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span
            className="text-metadata"
            style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <Sparkles size={13} />
            <span>Saved Look • {outfit.occasion}</span>
          </span>

          <button
            onClick={onClose}
            aria-label="Close saved look details"
            title="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Title & Style Match Badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div>
            <h2 id="saved-outfit-title" className="text-screen-heading" style={{ fontSize: '1.5rem', marginBottom: 2 }}>
              {outfit.title}
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: '0.88rem',
                color: 'var(--color-text-secondary)'
              }}
            >
              {outfit.vibe}
            </p>
          </div>

          <div
            style={{
              backgroundColor: 'var(--color-primary-alpha)',
              color: 'var(--color-primary)',
              padding: '5px 12px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.78rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            {outfit.styleScore}% Match
          </div>
        </div>

        {/* Missing Garment Safety Warning */}
        {missingItems.length > 0 && (
          <div
            style={{
              padding: 12,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-surface-subtle)',
              border: '1px solid var(--color-border)',
              borderLeft: '3px solid var(--color-danger)',
              marginBottom: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}
          >
            <AlertTriangle size={18} color="var(--color-danger)" style={{ flexShrink: 0 }} />
            <p className="text-caption" style={{ fontSize: '0.8rem', color: 'var(--color-text-primary)' }}>
              {missingItems.length === 1
                ? `1 item (${missingItems[0].name}) is no longer in your wardrobe.`
                : `${missingItems.length} items from this look are no longer in your wardrobe.`}
            </p>
          </div>
        )}

        {/* Garment Grid */}
        <div style={{ marginBottom: 20 }}>
          <div className="text-metadata" style={{ marginBottom: 10 }}>
            Outfit Pieces ({validItems.length} available)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {resolvedItems.map(({ original, current }, idx) => {
              const item = current || original;
              const isMissing = !current;

              return (
                <div
                  key={original.id || idx}
                  style={{
                    backgroundColor: 'var(--color-surface-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    padding: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    opacity: isMissing ? 0.6 : 1
                  }}
                >
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      flexShrink: 0,
                      backgroundColor: 'var(--color-surface)'
                    }}
                  >
                    <GarmentImage
                      src={item.imageUrl}
                      alt={item.name}
                      category={item.category}
                      hexColor={item.hexColor}
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {item.name}
                    </div>
                    <div className="text-caption" style={{ fontSize: '0.72rem' }}>
                      {isMissing ? 'Removed from wardrobe' : `${item.color} · ${item.category}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Why It Works Rationale */}
        <div
          style={{
            padding: 16,
            backgroundColor: 'var(--color-surface-subtle)',
            borderRadius: 'var(--radius-md)',
            borderLeft: '3px solid var(--color-primary)',
            marginBottom: 24
          }}
        >
          <div className="text-metadata" style={{ color: 'var(--color-primary)', marginBottom: 4 }}>
            Why it works
          </div>
          <p className="text-body" style={{ fontSize: '0.84rem', lineHeight: 1.45, color: 'var(--color-text-primary)' }}>
            "{outfit.explanation.summary}"
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleRemoveClick}
            aria-label="Remove saved look"
            style={{
              padding: '12px 16px',
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
            Remove
          </button>

          <PrimaryButton
            onClick={handleWearClick}
            style={{ flex: 1 }}
            icon={<ArrowRight size={16} />}
          >
            Wear Again
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
};
