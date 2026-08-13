import React from 'react';

interface CategoryChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  count?: number;
}

export const CategoryChip: React.FC<CategoryChipProps> = ({
  label,
  active = false,
  onClick,
  count
}) => {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 16px',
        borderRadius: 'var(--radius-pill)',
        fontSize: '0.8rem',
        fontWeight: 500,
        backgroundColor: active ? 'var(--color-primary)' : 'var(--color-surface-subtle)',
        color: active ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
        border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all 0.2s ease'
      }}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          style={{
            fontSize: '0.7rem',
            opacity: 0.8,
            backgroundColor: active ? 'rgba(255,255,255,0.2)' : 'var(--color-border)',
            padding: '2px 6px',
            borderRadius: 'var(--radius-pill)'
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
};
