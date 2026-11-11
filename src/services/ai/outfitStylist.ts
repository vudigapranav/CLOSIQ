import { postJsonToApi } from './geminiClient';
import { validateAIOutfitResponse, RawAIOutfitResponse } from './validator';
import { GarmentItem, Outfit, LayeringPreference, GarmentCategory, FormalityLevel, isGarmentAvailable } from '../../types/wardrobe';
import { generateAIOutfit as demoGenerateAIOutfit } from '../aiStylist';
import { OutfitBrain, brainContextForAI, isFreshCombination, pickLocalOutfit } from '../outfitBrain';
import { FORMALITY_LABEL, resolveTargetFormality } from '../intelligence/garmentTraits';
import { OutfitContext, explainScore, isCoherentAIOutfit, rankSwapCandidates, scoreOutfit } from '../intelligence/outfitEngine';
import { WeatherSnapshot } from '../weather/weatherCore';

export interface OutfitRequestOptions {
  prompt: string;
  temperature?: number;
  layeringPreference?: LayeringPreference;
  excludeGarmentIds?: string[];
  /** The outfit brain (src/services/outfitBrain.ts): dislikes, recent looks, taste. */
  brain?: OutfitBrain;
  /** Real weather only (src/services/weather/webWeather.ts) — omit when unknown. */
  weather?: WeatherSnapshot | null;
  /** Onboarding style ids (profiles.style_preferences). */
  stylePreferences?: string[];
}

function engineContext(options: OutfitRequestOptions): OutfitContext {
  return {
    prompt: options.prompt,
    layeringPreference: options.layeringPreference,
    weather: options.weather ?? null,
    stylePreferences: options.stylePreferences,
    brain: options.brain,
    excludeGarmentIds: options.excludeGarmentIds
  };
}

/** What the server prompt gets for weather — honest "unknown" when absent. */
function weatherContextFor(weather: WeatherSnapshot | null | undefined) {
  if (!weather) return undefined;
  return {
    temperatureC: Math.round(weather.temperatureC),
    feelsLikeC: weather.feelsLikeC !== undefined ? Math.round(weather.feelsLikeC) : undefined,
    condition: weather.condition,
    precipitationProbability: weather.precipitationProbability,
    maxC: weather.maxC,
    minC: weather.minC
  };
}

export { isCoherentAIOutfit };

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
  // Local picks are marked as such and carry no score (2026-10-14 audit:
  // they used to be shown exactly like AI results, with an invented 91-99%).
  // Brain-aware: never a disliked combination, avoids recently shown ones.
  // (Only when every possible combination is disliked does it fall back to
  // the plain occasion pick, so the screen is never left empty.)
  // Laundry / unavailable pieces are never offered to the AI or the engine.
  const available = wardrobe.filter(isGarmentAvailable);
  const ctx = engineContext(options);

  // Rule-based picks are labelled as such: source 'local', styleScore 0, and
  // the engine's own explainable ruleScore. Brain-aware: never a disliked
  // combination, avoids recently shown ones. Only when every combination is
  // disliked does it fall back to the plain ranked pick, so the screen is
  // never left empty.
  const localPick = (): Outfit => {
    const picked =
      pickLocalOutfit(available, ctx, options.brain) ??
      demoGenerateAIOutfit(available, { prompt: options.prompt, layeringPreference: options.layeringPreference }, seed, {
        weather: ctx.weather,
        stylePreferences: ctx.stylePreferences
      });
    return { ...picked, source: 'local' as const, styleScore: 0 };
  };

  if (available.length === 0) {
    return localPick();
  }

  const wardrobeContext = formatWardrobeContext(available);
  const wardrobeSummary = summarizeWardrobeCoverage(available);

  const res = await postJsonToApi<RawAIOutfitResponse>('/api/ai/generate-outfit', {
    weatherContext: weatherContextFor(options.weather),
    stylePreferences: options.stylePreferences,
    prompt: options.prompt,
    layeringPreference: options.layeringPreference || 'avoid',
    excludeGarmentIds: options.excludeGarmentIds || [],
    seed,
    wardrobe: wardrobeContext,
    wardrobeSummary,
    // Server rule 12: dislikes (hard), recent/okay (avoid repeating), liked (taste).
    recentOutfitContext: options.brain
      ? {
          recentGarmentIdCombinations: options.brain.recent.slice(0, 3).map((sig) => sig.split('|')),
          ...brainContextForAI(options.brain)
        }
      : undefined
  });

  if (!res.ok || !res.data) {
    return localPick();
  }

  // Pass raw AI response through strict validation layer on client
  const validated = validateAIOutfitResponse(res.data, available);

  if (validated.valid && (validated.droppedIds > 0 || !isCoherentAIOutfit(validated.items, options.excludeGarmentIds))) {
    // The model invented a piece, used an excluded one, or built an
    // unwearable look — don't show a silently "repaired" outfit as AI.
    console.warn('[CLOSIQ Stylist] AI outfit rejected (invented/excluded/incoherent pieces); using the rule-based stylist.');
    return localPick();
  }

  if (validated.valid && !isFreshCombination(validated.items.map((i) => i.id), options.brain)) {
    // The AI repeated a disliked or just-shown look: the brain overrides it.
    return localPick();
  }

  if (!validated.valid || validated.items.length === 0) {
    console.warn('[CLOSIQ Stylist] AI output validation failed, falling back to demo engine:', validated.reason);
    return localPick();
  }

  const score = scoreOutfit(validated.items, ctx);
  const target = resolveTargetFormality(options.prompt);
  return {
    id: `outfit_gemini_${Date.now()}_${seed}`,
    title: validated.outfitName,
    occasion: options.prompt,
    vibe: validated.vibe,
    formalityLabel: FORMALITY_LABEL[target],
    temperature: options.weather ? Math.round(options.weather.temperatureC) : undefined,
    items: validated.items,
    styleScore: validated.styleMatch,
    ruleScore: score.total,
    scoreBreakdown: score.factors,
    explanation: {
      summary: validated.whyItWorks.overall,
      colorHarmony: validated.whyItWorks.color,
      silhouette: validated.whyItWorks.fit,
      weatherSuitability: explainScore(score).weatherSuitability,
      versatilityNote: validated.whyItWorks.occasion
    },
    saved: false,
    dateCreated: new Date().toISOString().split('T')[0],
    source: 'ai'
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
  const available = wardrobe.filter(isGarmentAvailable);
  if (!targetItem || available.length === 0) {
    return currentOutfit;
  }
  const ctx = engineContext(options);
  const currentItemIds = currentOutfit.items.map((i) => i.id);

  // Every swap — AI or rule-based — is re-scored; an AI match % described the
  // original pieces, so it is dropped (styleScore 0) instead of kept stale.
  const commit = (replacement: GarmentItem, summary?: string, title?: string, viaAI = false): Outfit => {
    const items = currentOutfit.items.map((i) => (i.id === targetGarmentId ? replacement : i));
    const score = scoreOutfit(items, ctx);
    const explanation = explainScore(score);
    return {
      ...currentOutfit,
      title: title || currentOutfit.title,
      items,
      styleScore: 0,
      ruleScore: score.total,
      scoreBreakdown: score.factors,
      source: viaAI ? currentOutfit.source : 'local',
      explanation: { ...currentOutfit.explanation, ...explanation, summary: summary || explanation.summary }
    };
  };
  const ruleBased = (): Outfit => {
    const best = rankSwapCandidates(currentOutfit, targetItem.category, available, ctx)[0];
    return best ? commit(best) : currentOutfit;
  };

  const res = await postJsonToApi<any>('/api/ai/swap-garment', {
    prompt: options.prompt,
    currentOutfitGarmentIds: currentItemIds,
    targetGarmentIdToSwap: targetGarmentId,
    targetCategory: targetItem.category,
    wardrobe: formatWardrobeContext(available)
  });

  const replacementId = res.ok ? res.data?.replacementGarmentId : undefined;
  const replacementItem = available.find(
    (i) => i.id === replacementId && i.category === targetItem.category && !currentItemIds.includes(i.id)
  );
  if (!replacementItem) return ruleBased();

  const whyItWorks = typeof res.data.whyItWorks === 'string' ? res.data.whyItWorks.slice(0, 400) : undefined;
  const outfitName = typeof res.data.outfitName === 'string' ? res.data.outfitName.slice(0, 80) : undefined;
  return commit(replacementItem, whyItWorks, outfitName, true);
}
