import { GarmentItem } from '../types/wardrobe';

/**
 * Style DNA (2026-10-13) — shared by web and mobile.
 *
 * Honest by construction: every score is the share of the user's OWN
 * wardrobe that shows a trait, so a new account with no clothes scores 0
 * everywhere (no invented "85% Minimalist"). The styles the user picked at
 * onboarding (`profiles.style_preferences`) are shown as their starting
 * point and name the archetype until there are clothes to read.
 */

// Canonical list, stored as profiles.style_preferences (mobile re-exports it).
export type StylePreference =
  | 'minimal'
  | 'casual'
  | 'streetwear'
  | 'smart_casual'
  | 'classic'
  | 'sporty'
  | 'oversized'
  | 'clean_contemporary';

export const STYLE_PREFERENCE_OPTIONS: { value: StylePreference; label: string }[] = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'casual', label: 'Casual' },
  { value: 'streetwear', label: 'Streetwear' },
  { value: 'smart_casual', label: 'Smart Casual' },
  { value: 'classic', label: 'Classic' },
  { value: 'sporty', label: 'Sporty' },
  { value: 'oversized', label: 'Oversized' },
  { value: 'clean_contemporary', label: 'Clean / Contemporary' }
];

export function stylePreferenceLabel(value: string): string {
  return STYLE_PREFERENCE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export interface StyleDnaAxis {
  key: 'minimal' | 'tailored' | 'smart' | 'layered' | 'ethnic' | 'street';
  label: string;
  /** 0–100: share of the wardrobe showing this trait. */
  score: number;
}

const NEUTRALS = ['navy', 'black', 'white', 'beige', 'grey', 'gray', 'charcoal', 'cream', 'khaki', 'tan', 'slate', 'ivory', 'stone', 'taupe', 'camel', 'off-white'];
const TAILORED = ['blazer', 'trouser', 'oxford', 'coat', 'suit', 'waistcoat', 'bandhgala', 'nehru', 'chino', 'loafer', 'formal'];
const ETHNIC = ['kurta', 'kurti', 'saree', 'sari', 'lehenga', 'sherwani', 'dupatta', 'salwar', 'churidar', 'dhoti', 'anarkali', 'bandhgala', 'nehru', 'jutti', 'mojari', 'kolhapuri', 'pathani', 'ethnic', 'chikankari'];
const STREET = ['graphic', 'hoodie', 'sweatshirt', 'cargo', 'oversized', 'sneaker', 'jogger', 'bomber', 'street'];

function text(item: GarmentItem): string {
  return [item.name, item.subcategory, item.style, item.fit, ...(item.tags || [])].join(' ').toLowerCase();
}

function share(wardrobe: GarmentItem[], test: (item: GarmentItem) => boolean): number {
  if (wardrobe.length === 0) return 0;
  return Math.round((wardrobe.filter(test).length / wardrobe.length) * 100);
}

function axesFor(items: GarmentItem[]): StyleDnaAxis[] {
  return [
    { key: 'minimal', label: 'Minimalist', score: share(items, (i) => NEUTRALS.some((n) => i.color.toLowerCase().includes(n))) },
    { key: 'tailored', label: 'Tailored', score: share(items, (i) => i.category === 'outerwear' || TAILORED.some((w) => text(i).includes(w))) },
    { key: 'smart', label: 'Smart / Formal', score: share(items, (i) => i.formality !== 'casual') },
    { key: 'street', label: 'Streetwear', score: share(items, (i) => STREET.some((w) => text(i).includes(w))) },
    { key: 'ethnic', label: 'Indian Ethnic', score: share(items, (i) => ETHNIC.some((w) => text(i).includes(w))) },
    { key: 'layered', label: 'Layering', score: share(items, (i) => i.layeringRole === 'base_layer' || i.layeringRole === 'outer_layer') }
  ];
}

/**
 * `taste` = garments from looks the user rated "nice" or actually wore
 * (src/services/outfitBrain.ts tasteGarments). With no taste yet, scores are
 * purely the wardrobe's; once there is some, each score is half "what you
 * own" and half "what you like to wear" — so the DNA learns from feedback.
 */
export function computeStyleDna(wardrobe: GarmentItem[], taste: GarmentItem[] = []): StyleDnaAxis[] {
  const owned = axesFor(wardrobe);
  if (taste.length === 0) return owned;
  const liked = axesFor(taste);
  return owned.map((axis, i) => ({ ...axis, score: Math.round((axis.score + liked[i].score) / 2) }));
}

const ARCHETYPE_BY_AXIS: Record<StyleDnaAxis['key'], { name: string; description: string }> = {
  minimal: { name: 'Modern Minimalist', description: 'Your wardrobe leans on neutral colours that pair with almost anything.' },
  tailored: { name: 'Tailored Classic', description: 'Structured pieces — blazers, trousers, coats — anchor your wardrobe.' },
  smart: { name: 'Polished Smart-Casual', description: 'Most of your pieces are dressed up enough for work and occasions.' },
  street: { name: 'Street Style', description: 'Relaxed fits, graphics and sneakers set the tone of your wardrobe.' },
  ethnic: { name: 'Indian Ethnic Edit', description: 'Kurtas, sarees and other ethnic wear are a big part of how you dress.' },
  layered: { name: 'Layering Enthusiast', description: 'You own plenty of pieces built for layering.' }
};

export interface StyleArchetype {
  name: string;
  description: string;
  /** 'taste' = from looks they liked/wore; 'wardrobe' = read from their clothes;
   *  'preferences' = from onboarding answers. */
  source: 'taste' | 'wardrobe' | 'preferences' | 'none';
}

/** Needs a handful of pieces before the wardrobe, not the answers, decides. */
const MIN_ITEMS_FOR_WARDROBE_ARCHETYPE = 3;

/** Liked/worn looks needed before taste, not the wardrobe, names the archetype. */
const MIN_TASTE_ITEMS_FOR_ARCHETYPE = 6; // ~2 outfits

export function styleArchetype(wardrobe: GarmentItem[], stylePreferences: string[], taste: GarmentItem[] = []): StyleArchetype {
  if (taste.length >= MIN_TASTE_ITEMS_FOR_ARCHETYPE) {
    const top = [...axesFor(taste)].sort((a, b) => b.score - a.score)[0];
    if (top && top.score > 0) {
      return {
        name: ARCHETYPE_BY_AXIS[top.key].name,
        description: `${ARCHETYPE_BY_AXIS[top.key].description} Learned from the looks you liked and wore.`,
        source: 'taste'
      };
    }
  }
  if (wardrobe.length >= MIN_ITEMS_FOR_WARDROBE_ARCHETYPE) {
    const top = [...computeStyleDna(wardrobe)].sort((a, b) => b.score - a.score)[0];
    if (top && top.score > 0) return { ...ARCHETYPE_BY_AXIS[top.key], source: 'wardrobe' };
  }
  if (stylePreferences.length > 0) {
    const labels = stylePreferences.slice(0, 2).map(stylePreferenceLabel);
    return {
      name: labels.join(' + '),
      description: 'Your starting point, from what you told us. Add your clothes and CLOSIQ will learn your real style.',
      source: 'preferences'
    };
  }
  return {
    name: 'Not discovered yet',
    description: 'Add a few of your clothes and CLOSIQ will work out your style.',
    source: 'none'
  };
}
