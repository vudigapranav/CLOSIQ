import { postJsonToApi } from './geminiClient';
import { validateAIOutfitResponse, RawAIOutfitResponse } from './validator';
import { GarmentItem, Outfit, LayeringPreference, GarmentCategory, FormalityLevel } from '../../types/wardrobe';
import { generateAIOutfit as demoGenerateAIOutfit } from '../aiStylist';

export interface OutfitRequestOptions {
  prompt: string;
  temperature?: number;
  layeringPreference?: LayeringPreference;
  excludeGarmentIds?: string[];
}

/** Formats structured wardrobe context for AI styling */
function formatWardrobeContext(wardrobe: GarmentItem[]) {
  return wardrobe.map((item) => ({
    garmentId: item.id,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    color: item.color,
    hexColor: item.hexColor,
    fabric: item.fabric,
    fit: item.fit || 'Regular',
    style: item.style,
    formality: item.formality,
    layeringRole: item.layeringRole || 'primary_layer',
    tags: item.tags,
    pairingNotes: item.pairingNotes
  }));
}

const CATEGORY_LIST: GarmentCategory[] = ['tops', 'bottoms', 'outerwear', 'shoes', 'accessories'];
const FORMALITY_LIST: FormalityLevel[] = ['casual', 'smart_casual', 'formal', 'evening'];

type CoverageTier = 'none' | 'weak' | 'moderate' | 'strong';

/** Heuristic bucket for a small, hackathon-scale wardrobe — not a scoring engine. */
function coverageTier(count: number): CoverageTier {
  if (count === 0) return 'none';
  if (count <= 2) return 'weak';
  if (count <= 5) return 'moderate';
  return 'strong';
}

/**
 * Lightweight aggregate view of the active wardrobe (already profile-filtered
 * and inclusive of user-uploaded items, since it's derived from whatever
 * `wardrobe` array the caller passes in — the same array formatWardrobeContext
 * uses). This is NOT a duplicate of the per-garment list already sent to
 * Gemini; it's the one thing individual garment rows can't convey on their
 * own — how deep the closet actually runs in each formality tier — so Gemini
 * can judge what an occasion's wardrobe can realistically support instead of
 * inferring it (or not) from scanning dozens of rows itself.
 */
function summarizeWardrobeCoverage(wardrobe: GarmentItem[]) {
  const categoryCounts = Object.fromEntries(
    CATEGORY_LIST.map((cat) => [cat, wardrobe.filter((item) => item.category === cat).length])
  ) as Record<GarmentCategory, number>;

  const formalityCoverage = Object.fromEntries(
    FORMALITY_LIST.map((level) => {
      const count = wardrobe.filter((item) => item.formality === level).length;
      return [level, { count, tier: coverageTier(count) }];
    })
  ) as Record<FormalityLevel, { count: number; tier: CoverageTier }>;

  const layeringCounts = {
    base_layer: wardrobe.filter((item) => item.layeringRole === 'base_layer').length,
    primary_layer: wardrobe.filter((item) => item.layeringRole === 'primary_layer').length,
    outer_layer: wardrobe.filter((item) => item.layeringRole === 'outer_layer').length,
    unspecified: wardrobe.filter((item) => !item.layeringRole).length
  };

  const distinctStyleCount = new Set(
    wardrobe.map((item) => item.style?.trim().toLowerCase()).filter((s): s is string => Boolean(s))
  ).size;

  const distinctColorCount = new Set(wardrobe.map((item) => item.color.trim().toLowerCase())).size;

  return {
    totalItems: wardrobe.length,
    categoryCounts,
    formalityCoverage,
    layeringCounts,
    distinctStyleCount,
    distinctColorCount
  };
}

/**
 * Client-Side AI Stylist:
 * Calls server API `POST /api/ai/generate-outfit`.
 * Validates output using `validateAIOutfitResponse()` to strictly prevent invented garments.
 */
export async function generateAIOutfitWithGemini(
  wardrobe: GarmentItem[],
  options: OutfitRequestOptions,
  seed = 0
): Promise<Outfit> {
  if (wardrobe.length === 0) {
    return demoGenerateAIOutfit(wardrobe, options, seed);
  }

  const wardrobeContext = formatWardrobeContext(wardrobe);
  const wardrobeSummary = summarizeWardrobeCoverage(wardrobe);

  const res = await postJsonToApi<RawAIOutfitResponse>('/api/ai/generate-outfit', {
    prompt: options.prompt,
    layeringPreference: options.layeringPreference || 'avoid',
    excludeGarmentIds: options.excludeGarmentIds || [],
    seed,
    wardrobe: wardrobeContext,
    wardrobeSummary
  });

  if (!res.ok || !res.data) {
    return demoGenerateAIOutfit(wardrobe, options, seed);
  }

  // Pass raw AI response through strict validation layer on client
  const validated = validateAIOutfitResponse(res.data, wardrobe);

  if (!validated.valid || validated.items.length === 0) {
    console.warn('[CLOSIQ Stylist] AI output validation failed, falling back to demo engine:', validated.reason);
    return demoGenerateAIOutfit(wardrobe, options, seed);
  }

  return {
    id: `outfit_gemini_${Date.now()}_${seed}`,
    title: validated.outfitName,
    occasion: options.prompt,
    vibe: validated.vibe,
    formalityLabel: validated.vibe,
    temperature: 20,
    items: validated.items,
    styleScore: validated.styleMatch,
    explanation: {
      summary: validated.whyItWorks.overall,
      colorHarmony: validated.whyItWorks.color,
      silhouette: validated.whyItWorks.fit,
      weatherSuitability: validated.whyItWorks.occasion,
      versatilityNote: 'Selected from your personal wardrobe.'
    },
    saved: false,
    dateCreated: new Date().toISOString().split('T')[0]
  };
}

/**
 * Client-Side AI Swap:
 * Calls server API `POST /api/ai/swap-garment`.
 */
export async function swapGarmentWithGemini(
  currentOutfit: Outfit,
  targetGarmentId: string,
  wardrobe: GarmentItem[],
  options: OutfitRequestOptions
): Promise<Outfit> {
  const targetItem = wardrobe.find((i) => i.id === targetGarmentId);
  if (!targetItem || wardrobe.length <= 1) {
    return currentOutfit;
  }

  const wardrobeContext = formatWardrobeContext(wardrobe);
  const currentItemIds = currentOutfit.items.map((i) => i.id);

  const res = await postJsonToApi<any>('/api/ai/swap-garment', {
    prompt: options.prompt,
    currentOutfitGarmentIds: currentItemIds,
    targetGarmentIdToSwap: targetGarmentId,
    targetCategory: targetItem.category,
    wardrobe: wardrobeContext
  });

  if (!res.ok || !res.data || !res.data.replacementGarmentId) {
    const candidates = wardrobe.filter(
      (i) => i.category === targetItem.category && i.id !== targetGarmentId
    );
    if (candidates.length === 0) return currentOutfit;
    const replacement = candidates[Math.floor(Math.random() * candidates.length)];
    const newItems = currentOutfit.items.map((i) => (i.id === targetGarmentId ? replacement : i));
    return { ...currentOutfit, items: newItems };
  }

  const replacementId = res.data.replacementGarmentId;
  const replacementItem = wardrobe.find((i) => i.id === replacementId && i.id !== targetGarmentId);

  if (!replacementItem) {
    const candidates = wardrobe.filter(
      (i) => i.category === targetItem.category && i.id !== targetGarmentId
    );
    if (candidates.length === 0) return currentOutfit;
    const fallbackRep = candidates[Math.floor(Math.random() * candidates.length)];
    const newItems = currentOutfit.items.map((i) => (i.id === targetGarmentId ? fallbackRep : i));
    return { ...currentOutfit, items: newItems };
  }

  const newItems = currentOutfit.items.map((i) => (i.id === targetGarmentId ? replacementItem : i));

  return {
    ...currentOutfit,
    title: res.data.outfitName || currentOutfit.title,
    items: newItems,
    explanation: {
      ...currentOutfit.explanation,
      summary: res.data.whyItWorks || currentOutfit.explanation.summary
    }
  };
}
