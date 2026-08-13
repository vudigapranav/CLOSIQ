import React from 'react';
import { GarmentImage } from './GarmentImage';

export interface ClothingCardProps {
  name: string;
  category: string;
  color: string;
  hexColor: string;
  imageUrl: string;
  brand?: string;
  wearCount?: number;
  onClick?: () => void;
}

export const ClothingCard: React.FC<ClothingCardProps> = ({
  name,
  category,
  color,
  hexColor,
  imageUrl,
  brand,
  wearCount,
  onClick
}) => {
  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-sm)',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: 210, backgroundColor: 'var(--color-surface-subtle)' }}>
        <GarmentImage src={imageUrl} alt={name} category={category} hexColor={hexColor} />
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            backgroundColor: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(8px)',
            padding: '3px 10px',
            borderRadius: 'var(--radius-pill)',
            color: '#FFFFFF',
            fontSize: '0.7rem',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: hexColor,
              display: 'inline-block',
              border: '1px solid rgba(255,255,255,0.4)'
            }}
          />
          {color}
        </div>
      </div>

      <div style={{ padding: 12 }}>
        <div className="text-metadata" style={{ marginBottom: 2 }}>
          {brand || category}
        </div>
        <div
          style={{
            fontSize: '0.88rem',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {name}
        </div>
        {wearCount !== undefined && (
          <div className="text-caption" style={{ marginTop: 4 }}>
            Worn {wearCount} {wearCount === 1 ? 'time' : 'times'}
          </div>
        )}
      </div>
    </div>
  );
};
