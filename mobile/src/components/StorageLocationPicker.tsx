import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { MapPin, ChevronDown, Check, X } from 'lucide-react-native';
import { COLORS, RADIUS } from '../theme';
import {
  STORAGE_LOCATION_GROUPS,
  STORAGE_LOCATION_MAX_LENGTH,
  normalizeStorageLocation
} from '../../../src/data/storageLocations';

interface StorageLocationPickerProps {
  value: string | undefined;
  /** Called once per choice (not per keystroke), so callers can persist directly. */
  onChange: (value: string | undefined) => void;
  /** Custom places already used in this wardrobe, shown as "Your places". */
  customPlaces?: string[];
  label?: string;
}

/**
 * "Where is it kept?" — a dropdown-style field. Tapping it opens a sheet of
 * Indian household places (shared list in src/data/storageLocations.ts) plus
 * a "Somewhere else" text box for a custom place.
 */
export const StorageLocationPicker: React.FC<StorageLocationPickerProps> = ({
  value,
  onChange,
  customPlaces = [],
  label = 'Where is it kept?'
}) => {
  const [open, setOpen] = useState(false);
  const [customText, setCustomText] = useState('');

  const groups = [
    ...(customPlaces.length > 0 ? [{ label: 'Your places', options: customPlaces }] : []),
    ...STORAGE_LOCATION_GROUPS
  ];

  const choose = (place: string | undefined) => {
    onChange(place);
    setOpen(false);
    setCustomText('');
  };

  const customPlace = normalizeStorageLocation(customText);

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.field}
        activeOpacity={0.8}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label} ${value || 'Not set'}`}
      >
        <MapPin size={15} color={COLORS.primary} />
        <Text style={[styles.fieldText, !value && styles.fieldPlaceholder]} numberOfLines={1}>
          {value || 'Choose a place'}
        </Text>
        <ChevronDown size={16} color={COLORS.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} accessibilityLabel="Close">
                <X size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Custom place first, so it's reachable without scrolling past every preset */}
              <Text style={styles.groupLabel}>Somewhere else</Text>
              <View style={styles.customRow}>
                <TextInput
                  style={styles.customInput}
                  placeholder="e.g. Blue suitcase on the loft"
                  placeholderTextColor={COLORS.textMuted}
                  value={customText}
                  onChangeText={setCustomText}
                  maxLength={STORAGE_LOCATION_MAX_LENGTH}
                  returnKeyType="done"
                  onSubmitEditing={() => customPlace && choose(customPlace)}
                />
                <TouchableOpacity
                  style={[styles.customBtn, !customPlace && styles.customBtnDisabled]}
                  disabled={!customPlace}
                  onPress={() => choose(customPlace)}
                >
                  <Text style={styles.customBtnText}>Use</Text>
                </TouchableOpacity>
              </View>

              {groups.map((group) => (
                <View key={group.label}>
                  <Text style={styles.groupLabel}>{group.label}</Text>
                  {group.options.map((place) => {
                    const selected = place === value;
                    return (
                      <TouchableOpacity
                        key={place}
                        style={[styles.option, selected && styles.optionSelected]}
                        onPress={() => choose(place)}
                      >
                        <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{place}</Text>
                        {selected && <Check size={16} color={COLORS.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}

              {!!value && (
                <TouchableOpacity style={styles.clearBtn} onPress={() => choose(undefined)}>
                  <Text style={styles.clearBtnText}>Clear place</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.borderMedium,
    backgroundColor: COLORS.bg
  },
  fieldText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.textPrimary
  },
  fieldPlaceholder: {
    color: COLORS.textMuted,
    fontWeight: '500'
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    maxHeight: '80%'
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: COLORS.primary,
    marginTop: 16,
    marginBottom: 6
  },
  customRow: {
    flexDirection: 'row',
    gap: 8
  },
  customInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.borderMedium,
    backgroundColor: COLORS.bg,
    color: COLORS.textPrimary,
    fontSize: 13.5
  },
  customBtn: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary
  },
  customBtnDisabled: {
    opacity: 0.4
  },
  customBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: RADIUS.sm
  },
  optionSelected: {
    backgroundColor: COLORS.primaryAlpha
  },
  optionText: {
    fontSize: 14,
    color: COLORS.textPrimary
  },
  optionTextSelected: {
    fontWeight: '700',
    color: COLORS.primary
  },
  clearBtn: {
    alignSelf: 'center',
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 16
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.danger
  }
});
