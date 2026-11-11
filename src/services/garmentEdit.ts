import {
  AVAILABILITY_OPTIONS,
  FormalityLevel,
  GarmentAvailability,
  GarmentCategory,
  GarmentDetailsPatch,
  Season
} from '../types/wardrobe';
import { normalizeSize } from '../data/garmentSizes';
import { normalizeStorageLocation } from '../data/storageLocations';

/**
 * Pure validation / normalisation of a user's garment edits, shared by the
 * web and mobile edit forms and by both cloud layers. Only keys PRESENT in
 * the input are present in the output; a rejected value yields an `errors`
 * entry instead (the patch then omits it so nothing invalid is written).
 */

export const NAME_MAX = 80;
export const BRAND_MAX = 60;
export const PATTERN_MAX = 40;
export const FABRIC_MAX = 40;
export const COLLECTION_MAX = 40;
export const COLLECTIONS_MAX_COUNT = 20;

export const CATEGORIES: GarmentCategory[] = ['tops', 'bottoms', 'outerwear', 'shoes', 'accessories'];
export const FORMALITIES: FormalityLevel[] = ['casual', 'smart_casual', 'formal', 'evening'];
export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
export const PURCHASE_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/;

export interface NormalizedPatch {
  patch: GarmentDetailsPatch;
  errors: Partial<Record<keyof GarmentDetailsPatch, string>>;
}

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max).trim() : '';
}

/** Trim, cap each at 40 chars, drop blanks, de-duplicate case-insensitively, max 20. */
export function normalizeCollections(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const name = clean(raw, COLLECTION_MAX);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= COLLECTIONS_MAX_COUNT) break;
  }
  return out;
}

export function normalizePurchaseDate(value: unknown): string | undefined {
  const v = typeof value === 'string' ? value.trim() : '';
  return PURCHASE_DATE_RE.test(v) ? v : undefined;
}

export function isGarmentAvailability(value: unknown): value is GarmentAvailability {
  return AVAILABILITY_OPTIONS.some((o) => o.value === value);
}

export function normalizeGarmentPatch(input: GarmentDetailsPatch): NormalizedPatch {
  const patch: GarmentDetailsPatch = {};
  const errors: NormalizedPatch['errors'] = {};
  const has = (k: keyof GarmentDetailsPatch) => Object.prototype.hasOwnProperty.call(input, k);

  if (has('name')) {
    const name = clean(input.name, NAME_MAX);
    if (name) patch.name = name;
    else errors.name = 'Give it a name';
  }
  if (has('brand')) patch.brand = clean(input.brand, BRAND_MAX) || undefined;
  if (has('pattern')) patch.pattern = clean(input.pattern, PATTERN_MAX) || undefined;
  if (has('fabric')) patch.fabric = clean(input.fabric, FABRIC_MAX);
  if (has('subcategory')) {
    const sub = clean(input.subcategory, NAME_MAX);
    if (sub) patch.subcategory = sub;
    else errors.subcategory = 'Pick or type a type';
  }
  if (has('color')) {
    const color = clean(input.color, 40);
    if (color) patch.color = color;
    else errors.color = 'Add a main colour';
  }
  if (has('hexColor')) {
    const hex = typeof input.hexColor === 'string' ? input.hexColor.trim() : '';
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) patch.hexColor = hex;
    else errors.hexColor = 'Colour swatch must look like #A1B2C3';
  }
  if (has('secondaryColors')) {
    patch.secondaryColors = (input.secondaryColors || []).map((c) => clean(c, 40)).filter(Boolean).slice(0, 6);
  }
  if (has('category')) {
    if (CATEGORIES.includes(input.category as GarmentCategory)) patch.category = input.category;
    else errors.category = 'Unknown category';
  }
  if (has('formality')) {
    if (FORMALITIES.includes(input.formality as FormalityLevel)) patch.formality = input.formality;
    else errors.formality = 'Unknown formality';
  }
  if (has('seasons')) {
    const list = Array.isArray(input.seasons) ? input.seasons : [];
    patch.seasons = SEASONS.filter((s) => list.includes(s));
  }
  if (has('fit')) patch.fit = clean(input.fit, 40) || undefined;
  if (has('style')) patch.style = clean(input.style, 60) || undefined;
  if (has('favorite')) patch.favorite = !!input.favorite;
  if (has('tags')) {
    patch.tags = normalizeCollections(input.tags).map((t) => t.slice(0, 30)).slice(0, 30);
  }
  if (has('layeringRole')) patch.layeringRole = input.layeringRole;
  if (has('size')) patch.size = normalizeSize(input.size);
  if (has('storageLocation')) patch.storageLocation = normalizeStorageLocation(input.storageLocation);
  if (has('collections')) patch.collections = normalizeCollections(input.collections);
  if (has('availability')) {
    if (isGarmentAvailability(input.availability)) patch.availability = input.availability;
    else errors.availability = 'Unknown availability';
  }
  if (has('purchaseDate')) {
    const raw = typeof input.purchaseDate === 'string' ? input.purchaseDate.trim() : '';
    if (!raw) patch.purchaseDate = undefined;
    else {
      const ok = normalizePurchaseDate(raw);
      if (ok) patch.purchaseDate = ok;
      else errors.purchaseDate = 'Use a month like 2026-03';
    }
  }
  return { patch, errors };
}

/** Human line: "Worn 4 times · last on 3 Nov" / "Not worn yet". */
export function describeWear(wearCount: number | undefined, lastWornDate: string | undefined): string {
  const n = wearCount || 0;
  if (n <= 0) return 'Not worn yet';
  const base = `Worn ${n} ${n === 1 ? 'time' : 'times'}`;
  if (!lastWornDate) return base;
  const d = new Date(`${lastWornDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return base;
  return `${base} · last on ${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}`;
}
