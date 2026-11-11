import { FormalityLevel, GarmentItem } from '../../types/wardrobe';

/**
 * Garment traits shared by every recommender (2026-11-11) — the ONE place
 * that defines formality distance, colour harmony, neutrals, ethnic pieces
 * and one-pieces. Before this, four modules each kept their own copy and
 * they disagreed (see docs/ARCHITECTURE.md "Intelligence layer").
 *
 * Pure functions, no I/O: runs identically on web, mobile and in tests.
 */

// ---------- formality ----------

export const FORMALITY_ORDER: FormalityLevel[] = ['casual', 'smart_casual', 'formal', 'evening'];

export const FORMALITY_LABEL: Record<FormalityLevel, string> = {
  casual: 'Casual',
  smart_casual: 'Smart Casual',
  formal: 'Formal',
  evening: 'Evening'
};

export function formalityGap(a: FormalityLevel, b: FormalityLevel): number {
  return Math.abs(FORMALITY_ORDER.indexOf(a) - FORMALITY_ORDER.indexOf(b));
}

/**
 * Maps a free-text occasion ("client meeting", "Goa trip", "sangeet") to the
 * dressiness it calls for. Deterministic keyword rules — the AI path reads
 * the prompt itself; this drives the rule-based engine.
 */
export function resolveTargetFormality(promptText: string): FormalityLevel {
  const p = promptText.toLowerCase();
  if (/(wedding|reception|sangeet|gala|black tie|cocktail)/.test(p)) return 'evening';
  if (/(work|meeting|interview|office|client|professional|conference|formal)/.test(p)) return 'formal';
  if (/(date|party|night out|evening|dinner|club)/.test(p)) return 'evening';
  if (/(college|presentation|school|class|campus|university|brunch|smart)/.test(p)) return 'smart_casual';
  if (/(casual|travel|weekend|airport|flight|errand|hangout|gym|home|rain|beach|trip)/.test(p)) return 'casual';
  return 'smart_casual';
}

// ---------- text helpers ----------

export const garmentText = (i: GarmentItem) =>
  `${i.name} ${i.subcategory} ${i.style ?? ''} ${i.fit ?? ''} ${i.fabric ?? ''} ${(i.tags || []).join(' ')}`.toLowerCase();

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Dresses, sarees, jumpsuits… worn on their own, so they never need (or get) a bottom. */
const ONE_PIECE = /\b(dress|gown|jumpsuit|romper|playsuit|saree|sari)\b/;
export const isOnePiece = (i: GarmentItem) => i.category === 'tops' && ONE_PIECE.test(garmentText(i));

const ETHNIC = /(kurta|kurti|saree|sari\b|lehenga|sherwani|dupatta|salwar|churidar|dhoti|anarkali|bandhgala|nehru|jutti|mojari|kolhapuri|pathani|ethnic|chikankari|patiala)/;
/** Bottoms that only really work under ethnic tops. */
export const ETHNIC_ONLY_BOTTOM = /(salwar|churidar|dhoti|patiala|lehenga)/;
export const isEthnic = (i: GarmentItem) => ETHNIC.test(garmentText(i));

// ---------- colour ----------

const NEUTRAL_NAME = /(black|white|grey|gray|charcoal|navy|beige|cream|ivory|khaki|tan\b|camel|denim|indigo|olive|brown|taupe|stone|off[- ]?white|nude|chambray|sand|ecru|slate)/;

export interface Hsl { h: number; s: number; l: number }

export function hexToHsl(hex: string | undefined): Hsl | null {
  if (!hex) return null;
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue *= 60;
  return { h: hue, s, l };
}

export function isNeutralGarment(i: Pick<GarmentItem, 'color' | 'hexColor'>): boolean {
  if (NEUTRAL_NAME.test((i.color || '').toLowerCase())) return true;
  const hsl = hexToHsl(i.hexColor);
  if (!hsl) return false;
  return hsl.s < 0.18 || hsl.l > 0.9 || hsl.l < 0.12;
}

const colorName = (i: GarmentItem) => i.color.trim().toLowerCase() || 'this';

/**
 * Colour harmony of two garments, roughly −1.5 (clash) … +2.5 (great), with
 * a short reason. Rules: neutral+neutral is safe (better with light/dark
 * contrast); neutral+colour lets the colour lead; two colours work when
 * they're in the same family (analogous) or opposite (complementary) and
 * clash in between.
 */
export function colorHarmony(a: GarmentItem, b: GarmentItem): { score: number; reason?: string } {
  const ha = hexToHsl(a.hexColor);
  const hb = hexToHsl(b.hexColor);
  const na = isNeutralGarment(a);
  const nb = isNeutralGarment(b);
  const sameName = colorName(a) === colorName(b);
  const contrast = ha && hb ? Math.abs(ha.l - hb.l) : 0;

  if (na && nb) {
    if (contrast > 0.25) return { score: 2.5, reason: `${capitalize(colorName(b))} and ${colorName(a)} — clean contrast` };
    return { score: 1.5, reason: sameName ? `Tonal ${colorName(a)} look` : 'Easy neutral pairing' };
  }
  if (na !== nb) {
    const [neutral, colour] = na ? [a, b] : [b, a];
    return { score: 2, reason: `${capitalize(colorName(neutral))} lets the ${colorName(colour)} stand out` };
  }
  if (sameName) return { score: -0.5 };
  if (!ha || !hb) return { score: 0 };
  const diff = Math.min(Math.abs(ha.h - hb.h), 360 - Math.abs(ha.h - hb.h));
  if (diff < 30) return { score: 0.5, reason: 'Same colour family' };
  if (diff > 150) return { score: 0.5, reason: 'Bold complementary colours' };
  return { score: -1.5 };
}
