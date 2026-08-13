import React from 'react';

export interface OutfitCardProps {
  title: string;
  occasion: string;
  harmonyScore: number;
  items: { id: string; name: string; category: string; imageUrl: string }[];
  rationale: string;
  onClick?: () => void;
}

export const OutfitCard: React.FC<OutfitCardProps> = ({
  title,
  occasion,
  harmonyScore,
  items,
  rationale,
  onClick
}) => {
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        padding: 20,
        boxShadow: 'var(--shadow-sm)',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <span className="text-metadata" style={{ color: 'var(--color-primary)' }}>
            {occasion}
          </span>
          <h3 className="text-section-heading" style={{ marginTop: 2 }}>{title}</h3>
        </div>

        <div
          style={{
            backgroundColor: 'var(--color-primary-alpha)',
            color: 'var(--color-primary)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-pill)',
            fontSize: '0.75rem',
            fontWeight: 700
          }}
        >
          {harmonyScore}% Harmony
        </div>
      </div>

      {/* Garment Thumbnails Row */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 14, paddingBottom: 4 }}>
        {items.map((item) => (
          <div key={item.id} style={{ position: 'relative', flexShrink: 0 }}>
            <img
              src={item.imageUrl}
              alt={item.name}
              style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
            />
            <span
              style={{
                position: 'absolute',
                bottom: 2,
                left: 2,
                backgroundColor: 'rgba(0,0,0,0.6)',
                color: '#FFF',
                fontSize: '0.58rem',
                padding: '1px 4px',
                borderRadius: 4
              }}
            >
              {item.category}
            </span>
          </div>
        ))}
      </div>

      <p className="text-body" style={{ fontSize: '0.82rem', lineHeight: 1.4, color: 'var(--color-text-secondary)' }}>
        {rationale}
      </p>
    </div>
  );
};
