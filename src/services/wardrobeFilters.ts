import { FormalityLevel, GarmentItem, LayeringRole, Season } from '../types/wardrobe';
import { normalizeStorageLocation } from '../data/storageLocations';
import { normalizeSize, sizeOptionsFor } from '../data/garmentSizes';
import { COLOR_FAMILIES, ColorFamily, colorFamiliesOf, hexToHsl } from './wardrobeSearch';

/**
 * Wardrobe filters (2026-10-24) — shared by web and mobile.
 *
 * Opening a section (Tops, Bottoms, Footwear…) offers filters built the way
 * a stylist sorts a closet: colour, type, occasion, where it's kept, size,
 * season, fit, style vibe, fabric, layering, wear history and favourites.
 *
 * Facets are built from the pieces actually in view, so Tops only offers
 * top types and top sizes, and every option shows how many pieces it holds.
 * Within one facet the options are OR (Blue or Black); across facets they
 * are AND (Blue AND Size M AND kept in the Main almirah).
 */

export type FacetKey =
  | 'color' | 'type' | 'occasion' | 'place' | 'size' | 'season' | 'fit'
  | 'style' | 'fabric' | 'layer' | 'wear' | 'favorite';

/** Selected option values per facet; a missing/empty facet = no filter. */
export type WardrobeFilterState = Partial<Record<FacetKey, string[]>>;

export const EMPTY_FILTERS: WardrobeFilterState = {};

export interface FacetOption {
  value: string;
  label: string;
  count: number;
  /** Colour swatch for the colour facet. */
  hex?: string;
}

export interface Facet {
  key: FacetKey;
  title: string;
  /** One-line stylist hint under the title. */
  hint?: string;
  options: FacetOption[];
}

// ---------- per-piece values ----------

const OCCASIONS: { value: FormalityLevel; label: string }[] = [
  { value: 'casual', label: 'Casual / everyday' },
  { value: 'smart_casual', label: 'Smart casual' },
  { value: 'formal', label: 'Formal / office' },
  { value: 'evening', label: 'Evening / party' }
];

const SEASONS: { value: Season; label: string }[] = [
  { value: 'summer', label: 'Summer' },
  { value: 'spring', label: 'Spring' },
  { value: 'autumn', label: 'Autumn / monsoon' },
  { value: 'winter', label: 'Winter' }
];

const LAYERS: { value: LayeringRole; label: string }[] = [
  { value: 'base_layer', label: 'Base layer (tanks, camis)' },
  { value: 'primary_layer', label: 'Main layer' },
  { value: 'outer_layer', label: 'Outer layer' }
];

const FABRIC_FAMILIES: { value: string; label: string; re: RegExp }[] = [
  { value: 'cotton', label: 'Cotton', re: /(cotton|poplin|jersey|twill|khadi|mulmul|canvas|oxford|chambray)/ },
  { value: 'denim', label: 'Denim', re: /denim/ },
  { value: 'linen', label: 'Linen', re: /linen/ },
  { value: 'wool', label: 'Wool & knits', re: /(wool|knit|cashmere|merino|fleece|rib\b|cable)/ },
  { value: 'leather', label: 'Leather & suede', re: /(leather|suede|nubuck)/ },
  { value: 'silk', label: 'Silk & satin', re: /(silk|satin|chiffon|georgette|crepe|organza|velvet|chanderi|banarasi)/ },
  { value: 'synthetic', label: 'Technical & synthetic', re: /(nylon|polyester|technical|mesh|spandex|elastane|lycra|rayon|viscose|acrylic|shell|ripstop|rubber)/ },
  { value: 'metal', label: 'Metal & acetate', re: /(metal|steel|gold|silver|acetate|brass)/ }
];

export type WearBucket = 'never' | 'rarely' | 'often' | 'forgotten';

const WEAR: { value: WearBucket; label: string }[] = [
  { value: 'never', label: 'Never worn' },
  { value: 'rarely', label: 'Worn 1–2 times' },
  { value: 'often', label: 'Worn often (5+)' },
  { value: 'forgotten', label: 'Not worn in 30+ days' }
];

const DAY = 24 * 60 * 60 * 1000;

/** Fit words that describe sizing, not a silhouette. */
const NOT_A_FIT = /(one size|true to size|free size|standard)/i;

const key = (s: string | undefined) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();

function wearBuckets(i: GarmentItem, now: number): WearBucket[] {
  const n = i.wearCount || 0;
  const out: WearBucket[] = [];
  if (n === 0) out.push('never');
  else if (n <= 2) out.push('rarely');
  if (n >= 5) out.push('often');
  const last = Date.parse(i.lastWornDate || '') || (n === 0 ? Date.parse(i.dateAdded || '') : NaN);
  if (!Number.isNaN(last) && now - last > 30 * DAY) out.push('forgotten');
  return out;
}

/** Every value a piece has for a facet (a piece can sit in several). */
function valuesOf(i: GarmentItem, facet: FacetKey, now: number): string[] {
  switch (facet) {
    case 'color': return colorFamiliesOf(i);
    case 'type': return i.subcategory ? [key(i.subcategory)] : [];
    case 'occasion': return i.formality ? [i.formality] : [];
    case 'place': { const p = normalizeStorageLocation(i.storageLocation); return p ? [p] : []; }
    case 'size': { const s = normalizeSize(i.size); return s ? [s] : []; }
    case 'season': return i.seasons || [];
    case 'fit': return i.fit && !NOT_A_FIT.test(i.fit) ? [key(i.fit)] : [];
    case 'style': return i.style ? [key(i.style)] : [];
    case 'fabric': { const f = key(i.fabric); return FABRIC_FAMILIES.filter((x) => x.re.test(f)).map((x) => x.value); }
    case 'layer': return i.layeringRole ? [i.layeringRole] : [];
    case 'wear': return wearBuckets(i, now);
    case 'favorite': return i.favorite ? ['favorite'] : [];
  }
}

// ---------- facets ----------

const titleCase = (s: string) => s.replace(/\b([a-z])/g, (m) => m.toUpperCase());

const FACETS: { key: FacetKey; title: string; hint?: string }[] = [
  { key: 'color', title: 'Colour', hint: 'Whole colour families — Blue includes navy, indigo and denim.' },
  { key: 'type', title: 'Type' },
  { key: 'occasion', title: 'Occasion', hint: 'How dressed-up the piece is.' },
  { key: 'place', title: "Where it's kept" },
  { key: 'size', title: 'Size' },
  { key: 'season', title: 'Season & weather' },
  { key: 'fit', title: 'Fit & silhouette' },
  { key: 'style', title: 'Style vibe' },
  { key: 'fabric', title: 'Fabric' },
  { key: 'layer', title: 'Layering', hint: 'Where it sits in a layered outfit.' },
  { key: 'wear', title: 'Wear history', hint: 'Rediscover pieces you have been forgetting.' },
  { key: 'favorite', title: 'Favourites' }
];

function optionOrder(facet: FacetKey, items: GarmentItem[]): { value: string; label: string; hex?: string }[] | null {
  switch (facet) {
    case 'color': return COLOR_FAMILIES.map((f) => ({ value: f.value, label: f.label, hex: f.hex }));
    case 'occasion': return OCCASIONS;
    case 'season': return SEASONS;
    case 'layer': return LAYERS;
    case 'fabric': return FABRIC_FAMILIES;
    case 'wear': return WEAR;
    case 'favorite': return [{ value: 'favorite', label: 'Favourites only' }];
    case 'size': {
      // Size presets in their natural order (XS → 3XL, UK 3 → UK 12), then custom sizes.
      const cats = [...new Set(items.map((i) => i.category))];
      const preset = [...new Set(cats.flatMap(sizeOptionsFor))];
      return preset.map((v) => ({ value: v, label: v }));
    }
    default: return null;
  }
}

/** The filters on offer for the pieces in view, with counts. Facets that
 *  can't narrow anything (no values, or one value every piece shares) are left out. */
export function buildFacets(items: GarmentItem[], now: number = Date.now()): Facet[] {
  const facets: Facet[] = [];
  for (const def of FACETS) {
    const counts = new Map<string, number>();
    const firstLabel = new Map<string, string>();
    for (const item of items) {
      for (const v of new Set(valuesOf(item, def.key, now))) {
        counts.set(v, (counts.get(v) || 0) + 1);
        if (!firstLabel.has(v)) {
          const raw = def.key === 'type' ? item.subcategory : def.key === 'fit' ? item.fit : def.key === 'style' ? item.style : v;
          firstLabel.set(v, titleCase((raw || v).trim()));
        }
      }
    }
    if (counts.size === 0) continue;
    const ordered = optionOrder(def.key, items);
    let options: FacetOption[];
    if (ordered) {
      const known = new Set(ordered.map((o) => o.value));
      options = ordered.filter((o) => counts.has(o.value)).map((o) => ({ ...o, count: counts.get(o.value)! }));
      // Custom sizes / anything outside the preset list, alphabetically.
      [...counts.keys()].filter((v) => !known.has(v)).sort((a, b) => a.localeCompare(b))
        .forEach((v) => options.push({ value: v, label: firstLabel.get(v) || v, count: counts.get(v)! }));
    } else {
      options = [...counts.entries()]
        .map(([value, count]) => ({ value, label: def.key === 'place' ? value : firstLabel.get(value) || value, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    }
    if (def.key !== 'favorite' && options.length === 1 && options[0].count === items.length) continue;
    facets.push({ ...def, options });
  }
  return facets;
}

// ---------- applying ----------

/** Drops selections the current facets no longer offer (e.g. a top type
 *  after switching to Bottoms), so a hidden filter never empties the grid. */
export function pruneFilters(state: WardrobeFilterState, facets: Facet[]): WardrobeFilterState {
  const out: WardrobeFilterState = {};
  for (const facet of facets) {
    const offered = new Set(facet.options.map((o) => o.value));
    const kept = (state[facet.key] || []).filter((v) => offered.has(v));
    if (kept.length > 0) out[facet.key] = kept;
  }
  return out;
}

export function applyFilters(items: GarmentItem[], state: WardrobeFilterState, now: number = Date.now()): GarmentItem[] {
  const active = (Object.keys(state) as FacetKey[]).filter((k) => (state[k] || []).length > 0);
  if (active.length === 0) return items;
  return items.filter((item) =>
    active.every((facet) => {
      const wanted = state[facet]!;
      return valuesOf(item, facet, now).some((v) => wanted.includes(v));
    })
  );
}

export function toggleFilter(state: WardrobeFilterState, facet: FacetKey, value: string): WardrobeFilterState {
  const current = state[facet] || [];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  const out = { ...state };
  if (next.length > 0) out[facet] = next;
  else delete out[facet];
  return out;
}

export function clearFacet(state: WardrobeFilterState, facet: FacetKey): WardrobeFilterState {
  const out = { ...state };
  delete out[facet];
  return out;
}

export function activeFilterCount(state: WardrobeFilterState): number {
  return Object.values(state).reduce((n, values) => n + (values?.length || 0), 0);
}

export interface ActiveFilterChip {
  facet: FacetKey;
  value: string;
  label: string;
  hex?: string;
}

/** The selected options as removable chips, in facet order. */
export function activeFilterChips(state: WardrobeFilterState, facets: Facet[]): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  for (const facet of facets) {
    for (const value of state[facet.key] || []) {
      const option = facet.options.find((o) => o.value === value);
      if (option) chips.push({ facet: facet.key, value, label: option.label, hex: option.hex });
    }
  }
  return chips;
}

// ---------- sorting ----------

export type WardrobeSort = 'relevance' | 'recent' | 'oldest' | 'most_worn' | 'least_worn' | 'name' | 'color';

export const SORT_OPTIONS: { value: WardrobeSort; label: string }[] = [
  { value: 'relevance', label: 'Best match' },
  { value: 'recent', label: 'Recently added' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'most_worn', label: 'Most worn' },
  { value: 'least_worn', label: 'Least worn' },
  { value: 'color', label: 'By colour' },
  { value: 'name', label: 'Name A–Z' }
];

const FAMILY_ORDER = COLOR_FAMILIES.map((f) => f.value);
const familyRank = (i: GarmentItem) => {
  const fam = colorFamiliesOf(i)[0] as ColorFamily | undefined;
  return fam ? FAMILY_ORDER.indexOf(fam) : FAMILY_ORDER.length;
};
const time = (s: string | undefined) => Date.parse(s || '') || 0;

/** A sorted copy. 'relevance' keeps the incoming order (search ranking / as stored). */
export function sortWardrobe(items: GarmentItem[], sort: WardrobeSort): GarmentItem[] {
  const list = [...items];
  switch (sort) {
    case 'recent': return list.sort((a, b) => time(b.dateAdded) - time(a.dateAdded));
    case 'oldest': return list.sort((a, b) => time(a.dateAdded) - time(b.dateAdded));
    case 'most_worn': return list.sort((a, b) => (b.wearCount || 0) - (a.wearCount || 0));
    case 'least_worn': return list.sort((a, b) => (a.wearCount || 0) - (b.wearCount || 0));
    case 'name': return list.sort((a, b) => a.name.localeCompare(b.name));
    case 'color': return list.sort((a, b) =>
      familyRank(a) - familyRank(b) || (hexToHsl(a.hexColor)?.l ?? 0.5) - (hexToHsl(b.hexColor)?.l ?? 0.5));
    default: return list;
  }
}
