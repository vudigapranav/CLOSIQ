import { GarmentItem, Outfit, OutfitExplanation, GarmentCategory, FormalityLevel, LayeringPreference } from '../types/wardrobe';

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

const FORMALITY_ORDER: FormalityLevel[] = ['casual', 'smart_casual', 'formal', 'evening'];

const CATEGORY_DISPLAY_LABEL: Record<GarmentCategory, string> = {
  tops: 'tops',
  bottoms: 'bottoms',
  outerwear: 'outerwear',
  shoes: 'footwear',
  accessories: 'accessories'
};

const VIBE_BY_FORMALITY: Record<FormalityLevel, string> = {
  casual: 'Easy & Relaxed',
  smart_casual: 'Elevated Casual',
  formal: 'Structured Minimalist',
  evening: 'Refined After-Dark'
};

/** Human-readable formality tier, e.g. "Smart Casual" — shown as the outfit's "Style" label. */
const FORMALITY_LABEL: Record<FormalityLevel, string> = {
  casual: 'Casual',
  smart_casual: 'Smart Casual',
  formal: 'Formal',
  evening: 'Evening'
};

/** "tops", "tops and bottoms", or "tops, bottoms and footwear" — for sparse-outfit UI copy. */
export function formatCategoryList(categories: GarmentCategory[]): string {
  const labels = categories.map((c) => CATEGORY_DISPLAY_LABEL[c]);
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

function formalityDistance(a: FormalityLevel, b: FormalityLevel): number {
  return Math.abs(FORMALITY_ORDER.indexOf(a) - FORMALITY_ORDER.indexOf(b));
}

/**
 * Maps free-text/occasion prompts to a target formality so the occasion a
 * user picks actually changes which wardrobe items get selected, not just
 * the outfit's title/copy.
 */
export function resolveTargetFormality(promptText: string): FormalityLevel {
  const p = promptText.toLowerCase();
  if (/(work|meeting|interview|office|client|professional|conference)/.test(p)) return 'formal';
  if (/(date|party|night out|evening|dinner|club|wedding)/.test(p)) return 'evening';
  if (/(college|presentation|school|class|campus|university)/.test(p)) return 'smart_casual';
  if (/(casual|travel|weekend|airport|flight|errand|hangout)/.test(p)) return 'casual';
  return 'smart_casual';
}

/**
 * Picks the item(s) closest to the target formality, cycling through
 * progressively-less-ideal alternatives as `variationSeed` increases. This
 * keeps outfit generation deterministic/reproducible (important for a live
 * demo) while still giving "Swap"/"Regenerate" real variety to show.
 */
function pickForOccasion<T extends { formality: FormalityLevel }>(
  pool: T[],
  targetFormality: FormalityLevel,
  variationSeed: number
): T | undefined {
  if (pool.length === 0) return undefined;
  const ranked = [...pool].sort(
    (a, b) => formalityDistance(a.formality, targetFormality) - formalityDistance(b.formality, targetFormality)
  );
  return ranked[variationSeed % ranked.length];
}

/**
 * When the user prefers to avoid base layers (tank tops etc. worn under
 * another garment), keep them out of the tops pool by default — unless the
 * prompt explicitly asks for layering, or an outer layer is already part of
 * the outfit (so the base layer is context-appropriate, not standing alone).
 */
function applyLayeringPreference(
  tops: GarmentItem[],
  layeringPreference: LayeringPreference,
  promptText: string,
  hasOuterLayer: boolean
): GarmentItem[] {
  if (layeringPreference !== 'avoid') return tops;
  const explicitlyRequestsLayering = /(layer|tank|base layer|under|camisole)/i.test(promptText);
  if (explicitlyRequestsLayering || hasOuterLayer) return tops;

  const withoutBaseLayers = tops.filter((item) => item.layeringRole !== 'base_layer');
  return withoutBaseLayers.length > 0 ? withoutBaseLayers : tops;
}

/**
 * Calculates color and formality compatibility strictly using items in user's collection
 */
export function calculateStyleMatchScore(items: GarmentItem[]): number {
  if (items.length === 0) return 85;
  const colors = items.map((i) => i.color.toLowerCase());
  
  const hasNeutral = colors.some((c) => c.includes('navy') || c.includes('charcoal') || c.includes('black') || c.includes('slate'));
  const hasWarm = colors.some((c) => c.includes('camel') || c.includes('beige') || c.includes('ivory') || c.includes('cream'));
  const hasAccent = colors.some((c) => c.includes('emerald') || c.includes('gold') || c.includes('bronze'));

  let score = 91;
  if (hasNeutral && hasWarm) score += 4;
  if (hasAccent) score += 3;

  return Math.min(score, 99);
}

/**
 * Generates natural language "Why It Works" rationale
 */
export function generateWhyItWorksExplanation(
  items: GarmentItem[],
  occasion: string
): string {
  const top = items.find((i) => i.category === 'tops');
  const bottom = items.find((i) => i.category === 'bottoms');
  const shoes = items.find((i) => i.category === 'shoes');
  const outer = items.find((i) => i.category === 'outerwear');

  // A sparse wardrobe (e.g. only one item added so far) has no top/bottom to
  // describe a pairing between — describe what's actually there instead of
  // inventing "neutral"/"tailored" placeholders for garments that don't exist.
  if (!top && !bottom) {
    if (items.length === 0) {
      return 'Add a few pieces to your Collection and CLOSIQ can start building outfits from what you actually own.';
    }
    const pieceNames = items.map((i) => i.name).join(' and ');
    return `${pieceNames} ${items.length === 1 ? 'is' : 'are'} the starting point — add a few more pieces to unlock full outfit pairings.`;
  }

  const topColor = top ? top.color.toLowerCase() : 'neutral';
  const bottomColor = bottom ? bottom.color.toLowerCase() : 'tailored';
  const shoeName = shoes ? shoes.name.toLowerCase() : 'footwear';

  if (occasion.toLowerCase().includes('college') || occasion.toLowerCase().includes('presentation')) {
    return `${topColor.charAt(0).toUpperCase() + topColor.slice(1)} and ${bottomColor} create a balanced contrast while the clean ${shoeName} keep the presentation look modern and approachable.`;
  }

  if (occasion.toLowerCase().includes('work') || occasion.toLowerCase().includes('meeting')) {
    return `Structured ${outer ? outer.subcategory.toLowerCase() : 'tailoring'} anchors ${topColor} hues against ${bottomColor} trousers for an authoritative yet comfortable professional profile.`;
  }

  if (occasion.toLowerCase().includes('date') || occasion.toLowerCase().includes('night')) {
    return `Fluid textures in ${topColor} paired with dark trousers introduce subtle depth, perfect for an elevated evening aesthetic.`;
  }

  return `${topColor.charAt(0).toUpperCase() + topColor.slice(1)} top with ${bottomColor} bottoms provides a harmonious balance, grounding the look with refined elegance.`;
}

/**
 * Core AI Outfit Generator - strictly uses items owned in user wardrobe.
 * `variationSeed` lets callers request a different (still deterministic)
 * combination for the same prompt, e.g. on "Swap"/"Regenerate".
 */
export function generateAIOutfit(
  wardrobe: GarmentItem[],
  request: StyleRequest,
  variationSeed: number = 0
): Outfit {
  const promptText = request.prompt || request.occasionChip || 'College Presentation';
  const targetFormality = resolveTargetFormality(promptText);
  const layeringPreference = request.layeringPreference || 'sometimes';

  // Group user wardrobe by category
  const tops = wardrobe.filter((i) => i.category === 'tops');
  const bottoms = wardrobe.filter((i) => i.category === 'bottoms');
  const shoes = wardrobe.filter((i) => i.category === 'shoes');
  const outerwear = wardrobe.filter((i) => i.category === 'outerwear');
  const accessories = wardrobe.filter((i) => i.category === 'accessories');

  // Outer layer is picked first so the tops pool knows whether a base layer
  // underneath it would be contextually appropriate.
  const selectedOuter = outerwear.length > 0 ? pickForOccasion(outerwear, targetFormality, variationSeed) : null;

  const eligibleTops = applyLayeringPreference(tops, layeringPreference, promptText, !!selectedOuter);

  // Select 1 item per available category, ranked by closeness to the
  // occasion's target formality, strictly from the user's own collection.
  // A category with nothing in it is simply left out of the outfit — never
  // backfilled with an item from a different category (pickForOccasion
  // already returns undefined for an empty pool).
  const selectedTop = pickForOccasion(eligibleTops, targetFormality, variationSeed);
  const selectedBottom = pickForOccasion(bottoms, targetFormality, variationSeed);
  const selectedShoes = pickForOccasion(shoes, targetFormality, variationSeed);
  const selectedAcc = pickForOccasion(accessories, targetFormality, variationSeed);

  const outfitItems = [selectedTop, selectedBottom, selectedShoes, selectedOuter, selectedAcc].filter(
    (item): item is GarmentItem => Boolean(item)
  );

  // Deduplicate
  const uniqueItems = Array.from(new Set(outfitItems));

  const missingCategories = (['tops', 'bottoms', 'shoes'] as GarmentCategory[]).filter(
    (cat) => !uniqueItems.some((item) => item.category === cat)
  );

  const score = calculateStyleMatchScore(uniqueItems);
  const whyItWorks = generateWhyItWorksExplanation(uniqueItems, promptText);

  const title = promptText.toLowerCase().includes('college')
    ? 'Smart Confidence'
    : promptText.toLowerCase().includes('date')
    ? 'Sensual Evening Tailoring'
    : promptText.toLowerCase().includes('work')
    ? 'Architectural Executive'
    : 'Elevated Monochromatic';

  const vibe = VIBE_BY_FORMALITY[targetFormality];
  const formalityLabel = FORMALITY_LABEL[targetFormality];

  return {
    id: `outfit-${Date.now()}`,
    title,
    occasion: promptText,
    vibe,
    formalityLabel,
    temperature: 68,
    items: uniqueItems,
    styleScore: score,
    explanation: {
      summary: whyItWorks,
      colorHarmony: 'Harmonious color contrast between top layer and dark bottom silhouette.',
      silhouette: 'Structured top balancing relaxed drape.',
      weatherSuitability: 'Optimized for mild temperatures.',
      versatilityNote: 'Transitions smoothly from day into evening.'
    },
    missingCategories: missingCategories.length > 0 ? missingCategories : undefined,
    saved: false,
    dateCreated: new Date().toISOString().split('T')[0]
  };
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
 * Replaces the item of `categoryToSwap` with `newItem` and recomputes score/
 * rationale/title. Shared by every swap path so there is exactly one place
 * that defines what "committing a swap" means.
 */
function buildSwappedOutfit(outfit: Outfit, categoryToSwap: GarmentCategory, newItem: GarmentItem): Outfit {
  const updatedItems = outfit.items.map((item) =>
    item.category === categoryToSwap ? newItem : item
  );

  const newScore = calculateStyleMatchScore(updatedItems);
  const newWhy = generateWhyItWorksExplanation(updatedItems, outfit.occasion);
  // Strip any existing suffix first so repeated swaps don't compound into
  // "Title (Variation) (Variation) (Variation)".
  const baseTitle = outfit.title.replace(/ \(Variation\)$/, '');

  return {
    ...outfit,
    title: `${baseTitle} (Variation)`,
    items: updatedItems,
    styleScore: newScore,
    explanation: {
      ...outfit.explanation,
      summary: newWhy
    }
  };
}

/**
 * Swaps ONE single garment in an outfit with the next candidate of the same
 * category strictly from the user's wardrobe (no preview — immediate cycle).
 */
export function swapGarmentInOutfit(
  outfit: Outfit,
  categoryToSwap: GarmentCategory,
  wardrobe: GarmentItem[]
): Outfit {
  const candidates = wardrobe.filter((i) => i.category === categoryToSwap);
  const currentItem = outfit.items.find((i) => i.category === categoryToSwap);

  if (candidates.length <= 1) return outfit;

  const currentIndex = candidates.findIndex((c) => c.id === currentItem?.id);
  const nextCandidate = candidates[(currentIndex + 1) % candidates.length];

  return buildSwappedOutfit(outfit, categoryToSwap, nextCandidate);
}

/**
 * Compatible alternatives for a category — the currently-equipped item
 * excluded, base-layer tops filtered per `layeringPreference` exactly like
 * initial generation does, ranked by closeness to the outfit's own occasion
 * formality so the best matches surface first. Lets the UI show a preview
 * strip the user picks from, instead of blindly cycling to "next".
 */
export function getSwapCandidates(
  outfit: Outfit,
  categoryToSwap: GarmentCategory,
  wardrobe: GarmentItem[],
  layeringPreference: LayeringPreference = 'sometimes'
): GarmentItem[] {
  const currentItem = outfit.items.find((i) => i.category === categoryToSwap);
  const hasOuterLayer = outfit.items.some((i) => i.category === 'outerwear');

  let pool = wardrobe.filter((i) => i.category === categoryToSwap && i.id !== currentItem?.id);
  if (categoryToSwap === 'tops') {
    pool = applyLayeringPreference(pool, layeringPreference, outfit.occasion, hasOuterLayer);
  }

  const targetFormality = resolveTargetFormality(outfit.occasion);
  return [...pool].sort(
    (a, b) => formalityDistance(a.formality, targetFormality) - formalityDistance(b.formality, targetFormality)
  );
}

/** Commits a specific, user-chosen alternative as the new garment for that category. */
export function applySwapCandidate(outfit: Outfit, categoryToSwap: GarmentCategory, newItem: GarmentItem): Outfit {
  return buildSwappedOutfit(outfit, categoryToSwap, newItem);
}
