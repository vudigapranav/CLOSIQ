import { GarmentItem, Outfit, GarmentCategory, LayeringPreference } from '../types/wardrobe';
import { resolveTargetFormality } from './intelligence/garmentTraits';
import {
  OutfitContext,
  buildEngineOutfit,
  explainScore,
  rankOutfits,
  rankSwapCandidates,
  scoreOutfit
} from './intelligence/outfitEngine';

export interface StyleRequest {
  prompt: string;
  occasionChip?: string;
  layeringPreference?: LayeringPreference;
}

export const STYLIST_SUGGESTION_CHIPS = [
  'College',
  'Work',
  'Date Night',
  'Party',
  'Casual',
  'Travel',
  'Rainy Day'
];

const CATEGORY_DISPLAY_LABEL: Record<GarmentCategory, string> = {
  tops: 'tops',
  bottoms: 'bottoms',
  outerwear: 'outerwear',
  shoes: 'footwear',
  accessories: 'accessories'
};

/** "tops", "tops and bottoms", or "tops, bottoms and footwear" — for sparse-outfit UI copy. */
export function formatCategoryList(categories: GarmentCategory[]): string {
  const labels = categories.map((c) => CATEGORY_DISPLAY_LABEL[c]);
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/** Re-exported: one definition of occasion → dressiness (src/services/intelligence/garmentTraits.ts). */
export { resolveTargetFormality };

/** Extra signals the rule-based engine can use when the caller has them. */
export type StyleContextExtras = Pick<OutfitContext, 'weather' | 'stylePreferences' | 'brain' | 'excludeGarmentIds' | 'today'>;

const contextFor = (request: StyleRequest, extras: StyleContextExtras = {}): OutfitContext => ({
  prompt: request.prompt || request.occasionChip || '',
  layeringPreference: request.layeringPreference || 'sometimes',
  ...extras
});

/**
 * @deprecated Kept for older callers. Returns CLOSIQ's explainable rule-based
 * score (0–100) for the pieces — it used to return an invented 91–99.
 */
export function calculateStyleMatchScore(items: GarmentItem[], occasion = ''): number {
  return scoreOutfit(items, { prompt: occasion }).total;
}

/** "Why it works", built from the computed score factors (no canned copy). */
export function generateWhyItWorksExplanation(items: GarmentItem[], occasion: string): string {
  if (items.length === 0) {
    return 'Add a few pieces to your Collection and CLOSIQ can start building outfits from what you actually own.';
  }
  return explainScore(scoreOutfit(items, { prompt: occasion })).summary;
}

/**
 * The rule-based stylist — strictly uses AVAILABLE pieces the user owns
 * (laundry / unavailable pieces are skipped). Delegates to the explainable
 * engine in src/services/intelligence/outfitEngine.ts. `variationSeed` walks
 * through the ranked alternatives for "Regenerate". The result is labelled
 * `source: 'local'` with `styleScore: 0` (no AI evaluated it) and carries the
 * engine's own `ruleScore` + `scoreBreakdown`.
 */
export function generateAIOutfit(
  wardrobe: GarmentItem[],
  request: StyleRequest,
  variationSeed: number = 0,
  extras: StyleContextExtras = {}
): Outfit {
  const ctx = contextFor(request, extras);
  const ranked = rankOutfits(wardrobe, ctx, 8);
  if (ranked.length === 0) {
    const empty = buildEngineOutfit({ items: [], score: scoreOutfit([], ctx) }, ctx, variationSeed);
    return { ...empty, title: 'Not enough pieces yet', explanation: { ...empty.explanation, summary: generateWhyItWorksExplanation([], ctx.prompt) } };
  }
  return buildEngineOutfit(ranked[Math.abs(variationSeed) % ranked.length], ctx, variationSeed);
}

/**
 * Two outfits count as "the same" for save/dedup purposes if they contain
 * the exact same set of garments, regardless of generated id or title.
 */
export function outfitSignature(outfit: Outfit): string {
  return outfit.items.map((i) => i.id).sort().join('|');
}

export function isSameOutfit(a: Outfit, b: Outfit): boolean {
  return outfitSignature(a) === outfitSignature(b);
}

/**
 * Replaces the item of `categoryToSwap` with `newItem` and re-scores the
 * look with the rule-based engine. Shared by every swap path so there is
 * exactly one place that defines what "committing a swap" means. An AI
 * outfit's match score described the ORIGINAL pieces, so it is dropped
 * (styleScore 0) rather than kept as a number that no longer applies.
 */
function buildSwappedOutfit(outfit: Outfit, categoryToSwap: GarmentCategory, newItem: GarmentItem, extras: StyleContextExtras = {}): Outfit {
  const updatedItems = outfit.items.map((item) => (item.category === categoryToSwap ? newItem : item));
  const ctx: OutfitContext = { prompt: outfit.occasion, ...extras };
  const score = scoreOutfit(updatedItems, ctx);
  const baseTitle = outfit.title.replace(/ \(Variation\)$/, '');
  return {
    ...outfit,
    title: `${baseTitle} (Variation)`,
    items: updatedItems,
    styleScore: 0,
    ruleScore: score.total,
    scoreBreakdown: score.factors,
    explanation: explainScore(score)
  };
}

/**
 * Swaps ONE garment for the best-scoring available alternative of the same
 * category (cycling past the current piece), strictly from the user's wardrobe.
 */
export function swapGarmentInOutfit(outfit: Outfit, categoryToSwap: GarmentCategory, wardrobe: GarmentItem[]): Outfit {
  const candidates = rankSwapCandidates(outfit, categoryToSwap, wardrobe, { prompt: outfit.occasion });
  if (candidates.length === 0) return outfit;
  return buildSwappedOutfit(outfit, categoryToSwap, candidates[0]);
}

/**
 * Compatible alternatives for a category — current piece, laundry and
 * unavailable pieces excluded, base-layer tops filtered per
 * `layeringPreference`, ranked by how good the WHOLE outfit becomes with each.
 */
export function getSwapCandidates(
  outfit: Outfit,
  categoryToSwap: GarmentCategory,
  wardrobe: GarmentItem[],
  layeringPreference: LayeringPreference = 'sometimes',
  extras: StyleContextExtras = {}
): GarmentItem[] {
  return rankSwapCandidates(outfit, categoryToSwap, wardrobe, { prompt: outfit.occasion, layeringPreference, ...extras });
}

/** Commits a specific, user-chosen alternative as the new garment for that category. */
export function applySwapCandidate(outfit: Outfit, categoryToSwap: GarmentCategory, newItem: GarmentItem, extras: StyleContextExtras = {}): Outfit {
  return buildSwappedOutfit(outfit, categoryToSwap, newItem, extras);
}
