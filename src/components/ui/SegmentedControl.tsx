import React from 'react';

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * Single-track pill selector (e.g. Men/Women, layering preference) shared by
 * Onboarding and Profile so both read as one consistent editorial control.
 */
export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        backgroundColor: 'var(--color-surface-subtle)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-pill)'
      }}
    >
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
              color: isActive ? 'var(--color-text-on-primary)' : 'var(--color-text-secondary)',
              fontSize: '0.82rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
