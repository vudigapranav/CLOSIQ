import React from 'react';
import { OutfitRating } from '../../types/wardrobe';
import { OUTFIT_RATING_OPTIONS } from '../../services/outfitBrain';

interface OutfitRatingBarProps {
  rating: OutfitRating | null;
  onRate: (rating: OutfitRating) => void;
}

/**
 * "How do you rate this outfit?" — the outfit brain's input
 * (src/services/outfitBrain.ts). "I disliked it" is remembered and the look
 * is never suggested again; "It's nice" teaches Style DNA. Same three
 * choices as the phone app's OutfitResultCard.
 */
export const OutfitRatingBar: React.FC<OutfitRatingBarProps> = ({ rating, onRate }) => (
  <div
    style={{
      padding: 12,
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'var(--color-surface-subtle)',
      border: '1px solid var(--color-border)',
      marginBottom: 14
    }}
  >
    <div className="text-metadata" style={{ marginBottom: 8 }}>How do you rate this outfit?</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {OUTFIT_RATING_OPTIONS.map((option) => {
        const selected = rating === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onRate(option.value)}
            style={{
              padding: '9px 4px',
              borderRadius: 'var(--radius-md)',
              border: `1.5px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
              backgroundColor: selected ? 'var(--color-primary-alpha)' : 'var(--color-surface)',
              color: selected ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontSize: '0.76rem',
              fontWeight: selected ? 700 : 600,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3
            }}
          >
            <span style={{ fontSize: '1.15rem' }} aria-hidden="true">{option.emoji}</span>
            {option.label}
          </button>
        );
      })}
    </div>
    {rating === 'dislike' && (
      <p className="text-caption" style={{ marginTop: 8, fontStyle: 'italic' }}>
        Got it — you won't see this look again.
      </p>
    )}
  </div>
);
