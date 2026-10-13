import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput } from 'react-native';
import { COLORS, RADIUS } from '../theme';
import { GarmentCategory } from '../../../src/types/wardrobe';
import {
  SIZE_GROUPS_BY_CATEGORY,
  SIZE_MAX_LENGTH,
  normalizeSize,
  sizeOptionsFor
} from '../../../src/data/garmentSizes';

interface SizePickerProps {
  category: GarmentCategory;
  value: string | undefined;
  /** Called once per choice: on a chip tap, or when the custom text is submitted/blurred. */
  onChange: (value: string | undefined) => void;
}

/**
 * Size: category-aware preset chips (shared presets in src/data/garmentSizes.ts)
 * plus "Other" for free text. Tapping the selected chip clears it.
 */
export const SizePicker: React.FC<SizePickerProps> = ({ category, value, onChange }) => {
  const isPreset = !value || sizeOptionsFor(category).includes(value);
  const [typingCustom, setTypingCustom] = useState(!isPreset);
  const [customText, setCustomText] = useState(isPreset ? '' : value || '');

  const commitCustom = () => onChange(normalizeSize(customText));

  return (
    <View>
      <Text style={styles.label}>Size</Text>
      <View style={styles.chipWrap}>
        {SIZE_GROUPS_BY_CATEGORY[category].flatMap((group) => group.options).map((size) => {
          const active = !typingCustom && value === size;
          return (
            <TouchableOpacity
              key={size}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                setTypingCustom(false);
                onChange(active ? undefined : size);
              }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{size}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.chip, typingCustom && styles.chipActive]}
          onPress={() => setTypingCustom(true)}
        >
          <Text style={[styles.chipText, typingCustom && styles.chipTextActive]}>Other…</Text>
        </TouchableOpacity>
      </View>
      {typingCustom && (
        <TextInput
          style={styles.input}
          autoFocus
          placeholder="e.g. 32 x 30, 7-8 yrs, 2.5 m"
          placeholderTextColor={COLORS.textMuted}
          value={customText}
          onChangeText={setCustomText}
          maxLength={SIZE_MAX_LENGTH}
          returnKeyType="done"
          onSubmitEditing={commitCustom}
          onBlur={commitCustom}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.borderMedium,
    backgroundColor: COLORS.bg
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textPrimary
  },
  chipTextActive: {
    color: '#FFFFFF'
  },
  input: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.borderMedium,
    backgroundColor: COLORS.bg,
    color: COLORS.textPrimary,
    fontSize: 13.5
  }
});
