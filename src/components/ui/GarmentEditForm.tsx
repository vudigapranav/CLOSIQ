import React, { useState } from 'react';
import { X } from 'lucide-react';
import { FormalityLevel, GarmentCategory, GarmentDetailsPatch, GarmentItem, Season } from '../../types/wardrobe';
import {
  BRAND_MAX,
  CATEGORIES,
  COLLECTIONS_MAX_COUNT,
  COLLECTION_MAX,
  FORMALITIES,
  NAME_MAX,
  PATTERN_MAX,
  SEASONS,
  normalizeCollections,
  normalizeGarmentPatch
} from '../../services/garmentEdit';

interface GarmentEditFormProps {
  item: GarmentItem;
  /** Collection names the user already uses — offered as one-tap chips. */
  collectionSuggestions?: string[];
  onSave: (patch: GarmentDetailsPatch) => void;
  onCancel: () => void;
}

const CATEGORY_LABEL: Record<GarmentCategory, string> = {
  tops: 'Tops', bottoms: 'Bottoms', outerwear: 'Outerwear', shoes: 'Footwear', accessories: 'Accessories'
};
const FORMALITY_LABEL: Record<FormalityLevel, string> = {
  casual: 'Casual', smart_casual: 'Smart casual', formal: 'Formal', evening: 'Evening'
};
const SEASON_LABEL: Record<Season, string> = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border-medium)',
  backgroundColor: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
  fontSize: '0.88rem'
};

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

const Field: React.FC<{ label: string; hint?: string; error?: string; children: React.ReactNode }> = ({ label, hint, error, children }) => (
  <div>
    <label className="text-metadata" style={{ display: 'block', marginBottom: 6 }}>{label}</label>
    {children}
    {hint && !error && <div className="text-caption" style={{ marginTop: 4 }}>{hint}</div>}
    {error && <div role="alert" style={{ marginTop: 4, fontSize: '0.74rem', color: 'var(--color-danger)' }}>{error}</div>}
  </div>
);

/** Full "Edit details" form for a saved garment. Validates via garmentEdit.ts on save. */
export const GarmentEditForm: React.FC<GarmentEditFormProps> = ({ item, collectionSuggestions = [], onSave, onCancel }) => {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState<GarmentCategory>(item.category);
  const [subcategory, setSubcategory] = useState(item.subcategory);
  const [color, setColor] = useState(item.color);
  const [hexColor, setHexColor] = useState(item.hexColor);
  const [pattern, setPattern] = useState(item.pattern || '');
  const [fabric, setFabric] = useState(item.fabric || '');
  const [brand, setBrand] = useState(item.brand || '');
  const [purchaseDate, setPurchaseDate] = useState(item.purchaseDate?.slice(0, 7) || '');
  const [formality, setFormality] = useState<FormalityLevel>(item.formality);
  const [seasons, setSeasons] = useState<Season[]>(item.seasons || []);
  const [fit, setFit] = useState(item.fit || '');
  const [favorite, setFavorite] = useState(item.favorite);
  const [collections, setCollections] = useState<string[]>(item.collections || []);
  const [draftCollection, setDraftCollection] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const addCollection = (value: string) => {
    setCollections((prev) => normalizeCollections([...prev, value]));
    setDraftCollection('');
  };
  const toggleSeason = (s: Season) => setSeasons((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const save = () => {
    const pendingCollections = draftCollection.trim() ? normalizeCollections([...collections, draftCollection]) : collections;
    const { patch, errors: errs } = normalizeGarmentPatch({
      name, category, subcategory, color, hexColor, pattern, fabric, brand, purchaseDate,
      formality, seasons, fit, favorite, collections: pendingCollections
    });
    setErrors(errs as Record<string, string>);
    if (Object.keys(errs).length > 0) return;
    onSave(patch);
  };

  const suggestions = collectionSuggestions.filter((c) => !collections.some((x) => x.toLowerCase() === c.toLowerCase()));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save(); }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}
    >
      <Field label="Name" error={errors.name}>
        <input style={inputStyle} value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} />
      </Field>

      <Field label="Category">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CATEGORIES.map((c) => (
            <button key={c} type="button" style={chipStyle(category === c)} onClick={() => setCategory(c)}>
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Type" error={errors.subcategory}>
        <input style={inputStyle} value={subcategory} maxLength={NAME_MAX} placeholder="e.g. Shirt, Chinos, Sneakers" onChange={(e) => setSubcategory(e.target.value)} />
      </Field>

      <Field label="Main colour" error={errors.color || errors.hexColor}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="color"
            aria-label="Colour swatch"
            value={/^#[0-9a-fA-F]{6}$/.test(hexColor) ? hexColor : '#888888'}
            onChange={(e) => setHexColor(e.target.value)}
            style={{ width: 44, height: 40, padding: 2, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-medium)', background: 'var(--color-surface)' }}
          />
          <input style={inputStyle} value={color} maxLength={40} placeholder="e.g. Navy" onChange={(e) => setColor(e.target.value)} />
        </div>
      </Field>

      <Field label="Pattern" error={errors.pattern}>
        <input style={inputStyle} value={pattern} maxLength={PATTERN_MAX} placeholder="Solid, striped, checked…" onChange={(e) => setPattern(e.target.value)} />
      </Field>

      <Field label="Fabric" hint="Leave blank if unsure — CLOSIQ never guesses a fabric for you.">
        <input style={inputStyle} value={fabric} maxLength={40} placeholder="e.g. Cotton, Linen" onChange={(e) => setFabric(e.target.value)} />
      </Field>

      <Field label="Brand">
        <input style={inputStyle} value={brand} maxLength={BRAND_MAX} onChange={(e) => setBrand(e.target.value)} />
      </Field>

      <Field label="Purchase date" error={errors.purchaseDate} hint="Optional — just the month is fine.">
        <input type="month" style={inputStyle} value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
      </Field>

      <Field label="Formality">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {FORMALITIES.map((f) => (
            <button key={f} type="button" style={chipStyle(formality === f)} onClick={() => setFormality(f)}>
              {FORMALITY_LABEL[f]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Seasons">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SEASONS.map((s) => (
            <button key={s} type="button" style={chipStyle(seasons.includes(s))} onClick={() => toggleSeason(s)}>
              {SEASON_LABEL[s]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Fit">
        <input style={inputStyle} value={fit} maxLength={40} placeholder="Slim, relaxed, oversized…" onChange={(e) => setFit(e.target.value)} />
      </Field>

      <Field label="Favourite">
        <button type="button" style={chipStyle(favorite)} onClick={() => setFavorite((f) => !f)}>
          {favorite ? 'Favourite' : 'Mark as favourite'}
        </button>
      </Field>

      <Field label="Collections" hint={`Up to ${COLLECTIONS_MAX_COUNT}, like “Office” or “Goa trip”.`}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {collections.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Remove ${c}`}
              style={{ ...chipStyle(true), display: 'inline-flex', alignItems: 'center', gap: 4 }}
              onClick={() => setCollections((prev) => prev.filter((x) => x !== c))}
            >
              {c} <X size={12} />
            </button>
          ))}
        </div>
        {suggestions.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {suggestions.map((c) => (
              <button key={c} type="button" style={chipStyle(false)} onClick={() => addCollection(c)}>+ {c}</button>
            ))}
          </div>
        )}
        <input
          style={inputStyle}
          value={draftCollection}
          maxLength={COLLECTION_MAX}
          placeholder="New collection, then press Enter"
          onChange={(e) => setDraftCollection(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (draftCollection.trim()) addCollection(draftCollection);
            }
          }}
        />
      </Field>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{ padding: '12px 18px', borderRadius: 'var(--radius-pill)', fontSize: '0.85rem', fontWeight: 600, backgroundColor: 'var(--color-surface-subtle)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          style={{ flex: 1, padding: '12px 18px', borderRadius: 'var(--radius-pill)', fontSize: '0.85rem', fontWeight: 600, backgroundColor: 'var(--color-primary)', color: 'var(--color-text-on-primary)', border: 'none', cursor: 'pointer' }}
        >
          Save details
        </button>
      </div>
    </form>
  );
};
