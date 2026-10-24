import React from 'react';
import { X, Check } from 'lucide-react';
import { PrimaryButton } from '../ui/PrimaryButton';
import { SecondaryButton } from '../ui/SecondaryButton';
import {
  Facet,
  FacetKey,
  SORT_OPTIONS,
  WardrobeFilterState,
  WardrobeSort,
  activeFilterCount,
  clearFacet,
  toggleFilter
} from '../../services/wardrobeFilters';

interface WardrobeFilterSheetProps {
  open: boolean;
  /** e.g. "Tops" or "your wardrobe" — shown in the title. */
  sectionLabel: string;
  facets: Facet[];
  filters: WardrobeFilterState;
  onChange: (next: WardrobeFilterState) => void;
  sort: WardrobeSort;
  onSortChange: (sort: WardrobeSort) => void;
  /** Pieces that match right now — the "Show N pieces" button. */
  resultCount: number;
  onClose: () => void;
}

/** Bottom sheet (a centred dialog on desktop) with every filter for the open section. Changes apply live. */
export const WardrobeFilterSheet: React.FC<WardrobeFilterSheetProps> = ({
  open,
  sectionLabel,
  facets,
  filters,
  onChange,
  sort,
  onSortChange,
  resultCount,
  onClose
}) => {
  if (!open) return null;
  const active = activeFilterCount(filters);
  const toggle = (facet: FacetKey, value: string) => onChange(toggleFilter(filters, facet, value));

  return (
    <div
      className="animate-fade-in sheet-backdrop"
      onClick={onClose}
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
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Filter ${sectionLabel}`}
        className="animate-slide-up sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '88vh',
          backgroundColor: 'var(--color-surface)',
          borderTopLeftRadius: 'var(--radius-xl)',
          borderTopRightRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 12px' }}>
          <div>
            <h2 className="text-section-heading" style={{ margin: 0 }}>Filter {sectionLabel}</h2>
            <p className="text-caption" style={{ marginTop: 2 }}>
              {active > 0 ? `${active} filter${active === 1 ? '' : 's'} on` : 'Narrow down what you own'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close filters"
            title="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Facets */}
        <div style={{ overflowY: 'auto', padding: '4px 24px 16px', flex: 1 }}>
          <FacetSection title="Sort by">
            {SORT_OPTIONS.map((o) => (
              <OptionChip key={o.value} label={o.label} selected={sort === o.value} onClick={() => onSortChange(o.value)} />
            ))}
          </FacetSection>

          {facets.length === 0 && (
            <p className="text-body" style={{ marginTop: 8 }}>
              Add a few more pieces (with sizes and places) and filters will appear here.
            </p>
          )}

          {facets.map((facet) => {
            const selected = filters[facet.key] || [];
            return (
              <FacetSection
                key={facet.key}
                title={facet.title}
                hint={facet.hint}
                onClear={selected.length > 0 ? () => onChange(clearFacet(filters, facet.key)) : undefined}
              >
                {facet.options.map((o) => (
                  <OptionChip
                    key={o.value}
                    label={o.label}
                    count={o.count}
                    hex={o.hex}
                    selected={selected.includes(o.value)}
                    onClick={() => toggle(facet.key, o.value)}
                  />
                ))}
              </FacetSection>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: '14px 24px 20px',
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)'
          }}
        >
          <SecondaryButton onClick={() => onChange({})} disabled={active === 0} style={{ opacity: active === 0 ? 0.5 : 1 }}>
            Clear all
          </SecondaryButton>
          <PrimaryButton fullWidth onClick={onClose}>
            {resultCount === 0 ? 'No pieces match' : `Show ${resultCount} piece${resultCount === 1 ? '' : 's'}`}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
};

const FacetSection: React.FC<{ title: string; hint?: string; onClear?: () => void; children: React.ReactNode }> = ({
  title,
  hint,
  onClear,
  children
}) => (
  <section style={{ padding: '14px 0', borderBottom: '1px solid var(--color-border)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: hint ? 2 : 10 }}>
      <span className="text-metadata" style={{ color: 'var(--color-text-primary)' }}>{title}</span>
      {onClear && (
        <button
          onClick={onClear}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: '0.75rem', fontWeight: 600 }}
        >
          Clear
        </button>
      )}
    </div>
    {hint && <p className="text-caption" style={{ marginBottom: 10 }}>{hint}</p>}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
  </section>
);

const OptionChip: React.FC<{ label: string; count?: number; hex?: string; selected: boolean; onClick: () => void }> = ({
  label,
  count,
  hex,
  selected,
  onClick
}) => (
  <button
    onClick={onClick}
    aria-pressed={selected}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '7px 12px',
      borderRadius: 'var(--radius-pill)',
      fontSize: '0.78rem',
      fontWeight: 500,
      cursor: 'pointer',
      backgroundColor: selected ? 'var(--color-primary)' : 'var(--color-surface-subtle)',
      color: selected ? 'var(--color-text-on-primary)' : 'var(--color-text-primary)',
      border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
      transition: 'all 0.15s ease'
    }}
  >
    {hex && (
      <span
        style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: hex, border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0 }}
      />
    )}
    {selected && !hex && <Check size={13} />}
    <span>{label}</span>
    {count !== undefined && <span style={{ opacity: 0.7, fontSize: '0.7rem' }}>{count}</span>}
  </button>
);
