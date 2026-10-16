import { FormalityLevel, GarmentCategory, GarmentItem, LayeringPreference } from '../types/wardrobe';
import { OutfitBrain } from './outfitBrain';

/**
 * "Pairs well with" (2026-10-16) — shared by the web and mobile garment
 * detail sheets. Open a T-shirt and see the bottoms (and footwear) from the
 * user's OWN wardrobe that suit it; open trousers and see the tops; and so on.
 *
 * Runs on-device, instantly, with no AI call: every suggestion is a garment
 * the user owns, ranked by formality match, colour harmony, season overlap,
 * Indian-ethnic pairing, and what the outfit brain has learned (looks the
 * user liked or wore together rank first; disliked ones sink).
 */

export interface PairingSuggestion {
  item: GarmentItem;
  score: number;
  /** One short line on why it works, e.g. "Navy grounds the red". */
  reason: string;
}

export interface PairingGroup {
  category: GarmentCategory;
  title: string;
  /** Best first. Empty when the wardrobe has nothing in this category that suits it. */
  suggestions: PairingSuggestion[];
}

export interface PairingOptions {
  brain?: OutfitBrain;
  layeringPreference?: LayeringPreference;
  /** Suggestions per group (default 3). */
  limit?: number;
}

const GROUP_TITLE: Record<GarmentCategory, string> = {
  tops: 'Tops',
  bottoms: 'Bottoms',
  outerwear: 'Layer it with',
  shoes: 'Footwear',
  accessories: 'Accessories'
};

/** Which categories to suggest for a piece, most important first. */
const PAIRS_WITH: Record<GarmentCategory, GarmentCategory[]> = {
  tops: ['bottoms', 'shoes'],
  bottoms: ['tops', 'shoes'],
  outerwear: ['tops', 'bottoms'],
  shoes: ['bottoms', 'tops'],
  accessories: ['tops', 'bottoms']
};

const text = (i: GarmentItem) => `${i.name} ${i.subcategory} ${i.style ?? ''} ${i.tags.join(' ')}`.toLowerCase();

/** Dresses, sarees, jumpsuits… worn on their own, so they never need (or get) a bottom. */
const ONE_PIECE = /\b(dress|gown|jumpsuit|romper|playsuit|saree|sari)\b/;
export const isOnePiece = (i: GarmentItem) => i.category === 'tops' && ONE_PIECE.test(text(i));

const ETHNIC = /(kurta|kurti|saree|sari\b|lehenga|sherwani|dupatta|salwar|churidar|dhoti|anarkali|bandhgala|nehru|jutti|mojari|kolhapuri|pathani|ethnic|chikankari|patiala)/;
/** Bottoms that only really work under ethnic tops. */
const ETHNIC_ONLY_BOTTOM = /(salwar|churidar|dhoti|patiala|lehenga)/;
const isEthnic = (i: GarmentItem) => ETHNIC.test(text(i));

const FORMALITY_ORDER: FormalityLevel[] = ['casual', 'smart_casual', 'formal', 'evening'];
const formalityGap = (a: FormalityLevel, b: FormalityLevel) =>
  Math.abs(FORMALITY_ORDER.indexOf(a) - FORMALITY_ORDER.indexOf(b));

// ---------- colour ----------

const NEUTRAL_NAME = /(black|white|grey|gray|charcoal|navy|beige|cream|ivory|khaki|tan\b|camel|denim|indigo|olive|brown|taupe|stone|off[- ]?white|nude|chambray|sand|ecru)/;

interface Hsl { h: number; s: number; l: number }

function hexToHsl(hex: string | undefined): Hsl | null {
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

function isNeutral(i: GarmentItem, hsl: Hsl | null): boolean {
  if (NEUTRAL_NAME.test(i.color.toLowerCase())) return true;
  if (!hsl) return false;
  return hsl.s < 0.18 || hsl.l > 0.9 || hsl.l < 0.12;
}

const colorName = (i: GarmentItem) => i.color.trim().toLowerCase() || 'this';
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function colorScore(a: GarmentItem, b: GarmentItem): { score: number; reason?: string } {
  const ha = hexToHsl(a.hexColor);
  const hb = hexToHsl(b.hexColor);
  const na = isNeutral(a, ha);
  const nb = isNeutral(b, hb);
  const sameName = colorName(a) === colorName(b);
  const contrast = ha && hb ? Math.abs(ha.l - hb.l) : 0;

  if (na && nb) {
    if (contrast > 0.25) return { score: 2.5, reason: `${cap(colorName(b))} and ${colorName(a)} — clean contrast` };
    return { score: 1.5, reason: sameName ? `Tonal ${colorName(a)} look` : 'Easy neutral pairing' };
  }
  if (na !== nb) {
    const [neutral, colour] = na ? [a, b] : [b, a];
    return { score: 2, reason: `${cap(colorName(neutral))} lets the ${colorName(colour)} stand out` };
  }
  // Two colours.
  if (sameName) return { score: -0.5 };
  if (!ha || !hb) return { score: 0 };
  const diff = Math.min(Math.abs(ha.h - hb.h), 360 - Math.abs(ha.h - hb.h));
  if (diff < 30) return { score: 0.5, reason: 'Same colour family' };
  if (diff > 150) return { score: 0.5, reason: 'Bold complementary colours' };
  return { score: -1.5 };
}

// ---------- scoring ----------

function pairScore(
  item: GarmentItem,
  candidate: GarmentItem,
  brain: OutfitBrain | undefined
): { score: number; reason: string } {
  const reasons: { weight: number; text: string }[] = [];
  let score = 0;

  // Formality is the strongest signal: a blazer-and-shorts pairing looks wrong whatever the colours.
  const gap = formalityGap(item.formality, candidate.formality);
  score += [3, 1.5, -1, -3][gap];
  if (gap === 0) reasons.push({ weight: 1, text: `Both ${item.formality.replace('_', ' ')}` });

  const colour = colorScore(item, candidate);
  score += colour.score;
  if (colour.reason) reasons.push({ weight: colour.score, text: colour.reason });

  if (item.seasons.length > 0 && candidate.seasons.length > 0) {
    score += item.seasons.some((s) => candidate.seasons.includes(s)) ? 0.5 : -1;
  }

  const itemEthnic = isEthnic(item);
  const candEthnic = isEthnic(candidate);
  if (itemEthnic && candEthnic) {
    score += 1.5;
    reasons.push({ weight: 2.2, text: 'A matching ethnic look' });
  } else if (candidate.category === 'bottoms' && ETHNIC_ONLY_BOTTOM.test(text(candidate)) && !itemEthnic) {
    score -= 2;
  } else if (item.category === 'bottoms' && ETHNIC_ONLY_BOTTOM.test(text(item)) && !candEthnic) {
    score -= 2;
  }

  if (brain) {
    const both = (sig: string) => {
      const ids = sig.split('|');
      return ids.includes(item.id) && ids.includes(candidate.id);
    };
    if ([...brain.liked].some(both)) {
      score += 2.5;
      reasons.push({ weight: 5, text: 'You loved these together' });
    } else if ([...brain.disliked].some(both)) {
      score -= 1.5;
    } else if (brain.likedGarmentIds.has(candidate.id)) {
      score += 0.5;
    }
  }

  reasons.sort((a, b) => b.weight - a.weight);
  return { score, reason: reasons[0]?.text ?? 'Works with this piece' };
}

function candidatePool(
  item: GarmentItem,
  category: GarmentCategory,
  wardrobe: GarmentItem[],
  layeringPreference: LayeringPreference
): GarmentItem[] {
  let pool = wardrobe.filter((g) => g.id !== item.id && g.category === category);
  if (category === 'bottoms') pool = pool.filter((g) => !isOnePiece(g));
  if (category === 'tops') {
    // A one-piece already is the outfit; suggest it only for shoes/outerwear.
    pool = pool.filter((g) => !isOnePiece(g) || item.category === 'outerwear' || item.category === 'shoes' || item.category === 'accessories');
    if (item.category === 'outerwear') {
      // Under a jacket: no second outer layer, and no tank top if the user avoids base layers.
      pool = pool.filter((g) => g.layeringRole !== 'outer_layer');
      if (layeringPreference === 'avoid') pool = pool.filter((g) => g.layeringRole !== 'base_layer');
    } else if (layeringPreference === 'avoid') {
      const noBase = pool.filter((g) => g.layeringRole !== 'base_layer');
      if (noBase.length > 0) pool = noBase;
    }
  }
  return pool;
}

/**
 * The "Pairs well with" groups for one garment. A group can be empty when the
 * wardrobe has nothing in that category (or nothing that suits it) — the UI
 * uses that to nudge the user to add one instead of inventing a suggestion.
 */
export function suggestPairings(item: GarmentItem, wardrobe: GarmentItem[], options: PairingOptions = {}): PairingGroup[] {
  const { brain, layeringPreference = 'sometimes', limit = 3 } = options;
  const categories: GarmentCategory[] = isOnePiece(item) ? ['shoes', 'outerwear'] : PAIRS_WITH[item.category];

  return categories.map((category) => {
    const suggestions = candidatePool(item, category, wardrobe, layeringPreference)
      .map((candidate) => ({ item: candidate, ...pairScore(item, candidate, brain) }))
      // Below zero = clashing formality or colours; better to show fewer than a bad match.
      .filter((s) => s.score >= 0)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name) || a.item.id.localeCompare(b.item.id))
      .slice(0, limit);
    return { category, title: GROUP_TITLE[category], suggestions };
  });
}

const EMPTY_LABEL: Record<GarmentCategory, string> = {
  tops: 'tops',
  bottoms: 'bottoms',
  outerwear: 'outerwear',
  shoes: 'footwear',
  accessories: 'accessories'
};

/** "Add bottoms or footwear and CLOSIQ will suggest what to pair with this." */
export function emptyPairingHint(groups: PairingGroup[]): string {
  const names = groups.map((g) => EMPTY_LABEL[g.category]);
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0] ?? 'more pieces';
  return `Add ${list} to your wardrobe and CLOSIQ will suggest what to pair with this.`;
}
