import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import {
  STORAGE_LOCATION_GROUPS,
  STORAGE_LOCATION_MAX_LENGTH,
  isPresetStorageLocation,
  normalizeStorageLocation
} from '../../data/storageLocations';

interface StorageLocationFieldProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  /** Custom places already used in this wardrobe, shown as "Your places". */
  customPlaces?: string[];
  label?: string;
}

const CUSTOM = '__custom__';

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border-medium)',
  backgroundColor: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
  fontSize: '0.88rem'
};

/**
 * "Where is it kept?" — a grouped dropdown of Indian household places plus a
 * "Somewhere else…" option that reveals a free-text field for a custom place.
 */
export const StorageLocationField: React.FC<StorageLocationFieldProps> = ({
  value,
  onChange,
  customPlaces = [],
  label = 'Where is it kept?'
}) => {
  const isKnown = !value || isPresetStorageLocation(value) || customPlaces.includes(value);
  const [typingCustom, setTypingCustom] = useState(!isKnown);
  const [customText, setCustomText] = useState(isKnown ? '' : value || '');

  const selectValue = typingCustom ? CUSTOM : value || '';

  const handleSelect = (next: string) => {
    if (next === CUSTOM) {
      setTypingCustom(true);
      onChange(normalizeStorageLocation(customText));
      return;
    }
    setTypingCustom(false);
    onChange(next || undefined);
  };

  return (
    <div>
      <label className="text-metadata" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <MapPin size={13} /> {label}
      </label>
      <select value={selectValue} onChange={(e) => handleSelect(e.target.value)} style={fieldStyle}>
        <option value="">Not set</option>
        {customPlaces.length > 0 && (
          <optgroup label="Your places">
            {customPlaces.map((place) => (
              <option key={place} value={place}>{place}</option>
            ))}
          </optgroup>
        )}
        {STORAGE_LOCATION_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((place) => (
              <option key={place} value={place}>{place}</option>
            ))}
          </optgroup>
        ))}
        <option value={CUSTOM}>Somewhere else… (type your own)</option>
      </select>
      {typingCustom && (
        <input
          type="text"
          autoFocus
          value={customText}
          maxLength={STORAGE_LOCATION_MAX_LENGTH}
          placeholder="e.g. Blue suitcase on the loft"
          onChange={(e) => {
            setCustomText(e.target.value);
            onChange(normalizeStorageLocation(e.target.value));
          }}
          style={{ ...fieldStyle, marginTop: 8 }}
        />
      )}
    </div>
  );
};
