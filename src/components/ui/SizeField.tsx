import React, { useState } from 'react';
import { Ruler } from 'lucide-react';
import { GarmentCategory } from '../../types/wardrobe';
import { SIZE_GROUPS_BY_CATEGORY, SIZE_MAX_LENGTH, normalizeSize, sizeOptionsFor } from '../../data/garmentSizes';

interface SizeFieldProps {
  category: GarmentCategory;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

const chipStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 'var(--radius-pill)',
  fontSize: '0.78rem',
  fontWeight: 600,
  cursor: 'pointer',
  border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border-medium)'}`,
  backgroundColor: active ? 'var(--color-primary)' : 'var(--color-surface)',
  color: active ? 'var(--color-text-on-primary)' : 'var(--color-text-primary)'
});

/**
 * Size picker: category-aware preset chips (letter, chest, waist, UK shoe,
 * Free size) plus "Other…" for anything else. Tapping the selected chip
 * clears it.
 */
export const SizeField: React.FC<SizeFieldProps> = ({ category, value, onChange }) => {
  const isPreset = !value || sizeOptionsFor(category).includes(value);
  const [typingCustom, setTypingCustom] = useState(!isPreset);

  return (
    <div>
      <label className="text-metadata" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
        <Ruler size={13} /> Size
      </label>
      {SIZE_GROUPS_BY_CATEGORY[category].map((group) => (
        <div key={group.label} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          {group.options.map((size) => {
            const active = !typingCustom && value === size;
            return (
              <button
                key={size}
                type="button"
                style={chipStyle(active)}
                onClick={() => {
                  setTypingCustom(false);
                  onChange(active ? undefined : size);
                }}
              >
                {size}
              </button>
            );
          })}
        </div>
      ))}
      <button
        type="button"
        style={chipStyle(typingCustom)}
        onClick={() => {
          setTypingCustom(true);
          if (isPreset) onChange(undefined);
        }}
      >
        Other…
      </button>
      {typingCustom && (
        <input
          type="text"
          autoFocus
          value={value || ''}
          maxLength={SIZE_MAX_LENGTH}
          placeholder="e.g. 32 x 30, 7-8 yrs, 2.5 m"
          onChange={(e) => onChange(e.target.value.slice(0, SIZE_MAX_LENGTH) || undefined)}
          onBlur={(e) => onChange(normalizeSize(e.target.value))}
          style={{
            width: '100%',
            marginTop: 8,
            padding: '10px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border-medium)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            fontSize: '0.88rem'
          }}
        />
      )}
    </div>
  );
};
