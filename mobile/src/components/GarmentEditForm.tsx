import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { COLORS, RADIUS } from '../theme';
import { FormalityLevel, GarmentCategory, GarmentDetailsPatch, GarmentItem, Season } from '../../../src/types/wardrobe';
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
} from '../../../src/services/garmentEdit';

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

const Chip: React.FC<{ label: string; active: boolean; onPress: () => void }> = ({ label, active, onPress }) => (
  <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} accessibilityRole="button">
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const Field: React.FC<{ label: string; hint?: string; error?: string; children: React.ReactNode }> = ({ label, hint, error, children }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    {children}
    {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
  </View>
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
    const pending = draftCollection.trim() ? normalizeCollections([...collections, draftCollection]) : collections;
    const { patch, errors: errs } = normalizeGarmentPatch({
      name, category, subcategory, color, hexColor, pattern, fabric, brand, purchaseDate,
      formality, seasons, fit, favorite, collections: pending
    });
    setErrors(errs as Record<string, string>);
    if (Object.keys(errs).length > 0) return;
    onSave(patch);
  };

  const suggestions = collectionSuggestions.filter((c) => !collections.some((x) => x.toLowerCase() === c.toLowerCase()));

  return (
    <View style={styles.form}>
      <Field label="Name" error={errors.name}>
        <TextInput style={styles.input} value={name} maxLength={NAME_MAX} onChangeText={setName} />
      </Field>

      <Field label="Category">
        <View style={styles.chipWrap}>
          {CATEGORIES.map((c) => <Chip key={c} label={CATEGORY_LABEL[c]} active={category === c} onPress={() => setCategory(c)} />)}
        </View>
      </Field>

      <Field label="Type" error={errors.subcategory}>
        <TextInput style={styles.input} value={subcategory} maxLength={NAME_MAX} placeholder="e.g. Shirt, Chinos" placeholderTextColor={COLORS.textMuted} onChangeText={setSubcategory} />
      </Field>

      <Field label="Main colour" error={errors.color || errors.hexColor}>
        <View style={styles.colorRow}>
          <View style={[styles.swatch, { backgroundColor: /^#[0-9a-fA-F]{6}$/.test(hexColor) ? hexColor : COLORS.surfaceSubtle }]} />
          <TextInput style={[styles.input, { flex: 1 }]} value={color} maxLength={40} placeholder="e.g. Navy" placeholderTextColor={COLORS.textMuted} onChangeText={setColor} />
          <TextInput style={[styles.input, { width: 100 }]} value={hexColor} maxLength={7} autoCapitalize="none" autoCorrect={false} placeholder="#1F2A44" placeholderTextColor={COLORS.textMuted} onChangeText={setHexColor} />
        </View>
      </Field>

      <Field label="Pattern" error={errors.pattern}>
        <TextInput style={styles.input} value={pattern} maxLength={PATTERN_MAX} placeholder="Solid, striped, checked…" placeholderTextColor={COLORS.textMuted} onChangeText={setPattern} />
      </Field>

      <Field label="Fabric" hint="Leave blank if unsure — CLOSIQ never guesses a fabric for you.">
        <TextInput style={styles.input} value={fabric} maxLength={40} placeholder="e.g. Cotton, Linen" placeholderTextColor={COLORS.textMuted} onChangeText={setFabric} />
      </Field>

      <Field label="Brand">
        <TextInput style={styles.input} value={brand} maxLength={BRAND_MAX} onChangeText={setBrand} />
      </Field>

      <Field label="Purchase month" error={errors.purchaseDate} hint="Optional, like 2026-03.">
        <TextInput style={styles.input} value={purchaseDate} maxLength={10} keyboardType="numbers-and-punctuation" placeholder="YYYY-MM" placeholderTextColor={COLORS.textMuted} onChangeText={setPurchaseDate} />
      </Field>

      <Field label="Formality">
        <View style={styles.chipWrap}>
          {FORMALITIES.map((f) => <Chip key={f} label={FORMALITY_LABEL[f]} active={formality === f} onPress={() => setFormality(f)} />)}
        </View>
      </Field>

      <Field label="Seasons">
        <View style={styles.chipWrap}>
          {SEASONS.map((s) => <Chip key={s} label={SEASON_LABEL[s]} active={seasons.includes(s)} onPress={() => toggleSeason(s)} />)}
        </View>
      </Field>

      <Field label="Fit">
        <TextInput style={styles.input} value={fit} maxLength={40} placeholder="Slim, relaxed, oversized…" placeholderTextColor={COLORS.textMuted} onChangeText={setFit} />
      </Field>

      <Field label="Favourite">
        <View style={styles.chipWrap}>
          <Chip label={favorite ? 'Favourite' : 'Mark as favourite'} active={favorite} onPress={() => setFavorite((f) => !f)} />
        </View>
      </Field>

      <Field label="Collections" hint={`Up to ${COLLECTIONS_MAX_COUNT}, like “Office” or “Goa trip”.`}>
        <View style={styles.chipWrap}>
          {collections.map((c) => (
            <Chip key={c} label={`${c}  ✕`} active onPress={() => setCollections((prev) => prev.filter((x) => x !== c))} />
          ))}
          {suggestions.map((c) => <Chip key={`s-${c}`} label={`+ ${c}`} active={false} onPress={() => addCollection(c)} />)}
        </View>
        <TextInput
          style={[styles.input, { marginTop: 8 }]}
          value={draftCollection}
          maxLength={COLLECTION_MAX}
          placeholder="New collection"
          placeholderTextColor={COLORS.textMuted}
          returnKeyType="done"
          onChangeText={setDraftCollection}
          onSubmitEditing={() => draftCollection.trim() && addCollection(draftCollection)}
        />
      </Field>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.85}>
          <Text style={styles.saveText}>Save details</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  form: { gap: 14, marginBottom: 20 },
  field: {},
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: COLORS.textSecondary, marginBottom: 6 },
  hint: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },
  error: { fontSize: 12, color: COLORS.danger, marginTop: 4 },
  input: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.borderMedium,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textPrimary
  },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: COLORS.borderMedium },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.borderMedium, backgroundColor: COLORS.surface },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary },
  chipTextActive: { color: COLORS.surfaceElevated },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: RADIUS.pill, backgroundColor: COLORS.surfaceSubtle, borderWidth: 1, borderColor: COLORS.border },
  cancelText: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: RADIUS.pill, backgroundColor: COLORS.primary },
  saveText: { fontSize: 13, fontWeight: '700', color: COLORS.surfaceElevated }
});
