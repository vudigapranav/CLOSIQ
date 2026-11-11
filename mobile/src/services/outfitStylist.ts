import { GarmentItem, GarmentCategory, LayeringPreference, OutfitScoreFactor, isGarmentAvailable } from '../../../src/types/wardrobe';
import { OutfitPersonalizationContext, WeatherContext } from './personalizationContext';
import { postApi, describeApiFailure } from './apiRequest';
import { isFreshCombination, pickLocalOutfit } from '../../../src/services/outfitBrain';
import { OutfitContext, isCoherentAIOutfit, rankSwapCandidates, scoreOutfit } from '../../../src/services/intelligence/outfitEngine';
import { WeatherSnapshot } from '../../../src/services/weather/weatherCore';

/** The phone's weather context as the shared engine's snapshot (no invented numbers). */
export function weatherSnapshotFromContext(ctx?: WeatherContext): WeatherSnapshot | null {
  if (!ctx || !Number.isFinite(ctx.temperatureCelsius)) return null;
  const c = (ctx.condition || '').toLowerCase();
  // Only the condition text is known here; map wet conditions to a WMO rain code so isRainy() sees them.
  const conditionCode = /thunder/.test(c) ? 95 : /(rain|shower)/.test(c) ? 61 : /drizzle/.test(c) ? 51 : undefined;
  const extra = ctx;
  return {
    temperatureC: ctx.temperatureCelsius,
    feelsLikeC: Number.isFinite(extra.feelsLikeCelsius) ? extra.feelsLikeCelsius : undefined,
    precipitationProbability: Number.isFinite(extra.precipitationProbability) ? extra.precipitationProbability : undefined,
    maxC: Number.isFinite(extra.maxC) ? extra.maxC : undefined,
    minC: Number.isFinite(extra.minC) ? extra.minC : undefined,
    condition: ctx.condition,
    conditionCode
  };
}

function engineContextFor(
  prompt: string,
  layeringPreference: LayeringPreference,
  excludeGarmentIds: string[],
  personalization?: OutfitPersonalizationContext
): OutfitContext {
  return {
    prompt,
    layeringPreference,
    excludeGarmentIds,
    weather: weatherSnapshotFromContext(personalization?.weatherContext),
    stylePreferences: personalization?.userProfileContext?.stylePreferences,
    brain: personalization?.brain
  };
}

function formatForApi(wardrobe: GarmentItem[]) {
  return wardrobe.map((item) => ({
    garmentId: item.id,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    color: item.color,
    hexColor: item.hexColor,
    pattern: item.pattern,
    fabric: item.fabric,
    fit: item.fit || 'Regular',
    formality: item.formality,
    seasons: item.seasons,
    layeringRole: item.layeringRole || 'primary_layer',
    style: item.style || '',
    tags: item.tags || [],
    pairingNotes: item.pairingNotes || ''
  }));
}

export interface MobileOutfitResult {
  title: string;
  vibe: string;
  styleScore: number;
  garmentIds: string[];
  explanation: {
    summary: string;
    colorHarmony?: string;
    occasionFit?: string;
    fit?: string;
  };
  /** CLOSIQ's explainable rule-based score (0–100) — set for AI and local picks alike. */
  ruleScore?: number;
  scoreBreakdown?: OutfitScoreFactor[];
}

export interface MobileSwapResult {
  replacementGarmentId: string;
  outfitTitle?: string;
  whyItWorks: string;
}

export async function generateOutfitMobile(
  prompt: string,
  wardrobe: GarmentItem[],
  layeringPreference: LayeringPreference = 'avoid',
  excludeGarmentIds: string[] = [],
  personalization?: OutfitPersonalizationContext
): Promise<{ ok: boolean; mode: 'gemini' | 'fallback'; data: MobileOutfitResult; error?: string; notice?: string }> {
  // Laundry / unavailable pieces are never suggested — not to the AI, not locally.
  const allWardrobe = wardrobe || [];
  wardrobe = allWardrobe.filter(isGarmentAvailable);
  const engineCtx = engineContextFor(prompt, layeringPreference, excludeGarmentIds, personalization);
  if (wardrobe.length === 0) {
    const inLaundry = allWardrobe.length > 0;
    return {
      ok: false,
      mode: 'fallback',
      data: {
        title: inLaundry ? 'Everything is in the laundry' : 'Empty Closet',
        vibe: inLaundry ? 'Nothing ready to wear' : 'No Garments Cataloged',
        styleScore: 0,
        garmentIds: [],
        explanation: {
          summary: inLaundry
            ? 'Mark a few pieces as ready to wear and CLOSIQ can style them again.'
            : 'Add items to your wardrobe to unlock personalized styling.'
        }
      },
      error: inLaundry ? 'No available pieces' : 'Wardrobe is empty'
    };
  }

  const formattedWardrobe = formatForApi(wardrobe);

  // Sprint M20: timed out, and the reason is carried to the caller. A 401
  // (expired session), 429 (Gemini quota) or timeout still falls through to
  // the local deterministic engine as before — but `notice` now tells the
  // user why they're seeing the local engine instead of Gemini.
  const result = await postApi('/api/ai/generate-outfit', {
    prompt,
    layeringPreference,
    excludeGarmentIds,
    wardrobe: formattedWardrobe,
    // Undefined fields are dropped by JSON.stringify, so calling this
    // function without a 5th argument (every pre-M15 call site) sends
    // the exact same body as before — this is additive, not a breaking
    // change to the request shape.
    userProfileContext: personalization?.userProfileContext,
    weatherContext: personalization?.weatherContext,
    plannerContext: personalization?.plannerContext,
    recentOutfitContext: personalization?.recentOutfitContext
  });

  let notice: string | undefined;
  if (result.ok) {
    const resData = result.json as { mode?: string; data?: Record<string, any> };
    let validIds: string[] = [];
    if (resData.data && Array.isArray(resData.data.garmentIds)) {
      // Every returned id must be an AVAILABLE piece the user owns; an outfit
      // with any invented / excluded id, duplicates or an unwearable mix
      // (two tops, a dress plus a bottom) is rejected as a whole.
      const rawIds: unknown[] = resData.data.garmentIds;
      const uniqueIds = [...new Set(rawIds.filter((id): id is string => typeof id === 'string'))];
      const items = uniqueIds.map((id) => wardrobe.find((item) => item.id === id)).filter((g): g is GarmentItem => Boolean(g));
      const allReal = items.length === uniqueIds.length && uniqueIds.length === rawIds.length;
      validIds = allReal && isCoherentAIOutfit(items, excludeGarmentIds) ? items.map((i) => i.id) : [];

      // The brain has the last word: a combination the user disliked, or one
      // shown in the last few suggestions, is replaced by a fresh local pick
      // even if the AI ignored rule 12.
      const fresh = isFreshCombination(validIds, personalization?.brain);
      if (validIds.length > 0 && fresh) {
        // The server's schema (server/geminiServer.js) is outfitName /
        // styleMatch / whyItWorks{overall,color,fit,occasion}. This used to
        // read title / styleScore / explanation.summary — names the AI never
        // sends — so every real AI outfit showed "<prompt> Outfit", an
        // invented 88% and generic copy (2026-10-14 audit). The old names
        // are kept only as a fallback.
        const d = resData.data;
        const why = typeof d.whyItWorks === 'object' && d.whyItWorks ? d.whyItWorks : {};
        const score = Number(d.styleMatch ?? d.styleScore);
        const rule = scoreOutfit(validIds.map((id) => wardrobe.find((g) => g.id === id)!), engineCtx);
        return {
          ok: true,
          mode: resData.mode === 'gemini' ? 'gemini' : 'fallback',
          data: {
            title: d.outfitName || d.title || `${prompt.charAt(0).toUpperCase() + prompt.slice(1)} Look`,
            vibe: d.vibe || '',
            styleScore: Number.isFinite(score) && score > 0 ? Math.round(Math.min(score, 100)) : 0,
            garmentIds: validIds,
            explanation: {
              summary:
                why.overall || (typeof d.whyItWorks === 'string' ? d.whyItWorks : '') || d.explanation?.summary || '',
              colorHarmony: why.color || d.explanation?.colorHarmony,
              occasionFit: why.occasion || d.explanation?.occasionFit,
              fit: why.fit
            },
            ruleScore: rule.total,
            scoreBreakdown: rule.factors
          }
        };
      }
    }
    notice = validIds.length > 0
      ? 'The AI suggested a look you disliked or saw recently.'
      : 'The AI returned no usable pieces from your wardrobe.';
  } else {
    notice = describeApiFailure(result.reason);
  }

  // Deterministic fallback filtering excluded items
  // Local engine: the website's occasion-aware picker, brain-aware — never a
  // disliked combination, avoids recently shown / "okay" ones, leans toward
  // pieces from liked looks (src/services/outfitBrain.ts). Regenerate's
  // excluded pieces are left out when enough remain.
  const local =
    pickLocalOutfit(wardrobe, engineCtx, personalization?.brain) ??
    // Regenerate's exclusions can leave too little: retry with them allowed.
    pickLocalOutfit(wardrobe, { ...engineCtx, excludeGarmentIds: [] }, personalization?.brain);

  if (!local) {
    return {
      ok: false,
      mode: 'fallback',
      data: { title: '', vibe: '', styleScore: 0, garmentIds: [], explanation: { summary: '' } },
      error: "You've passed on every look CLOSIQ can make from these clothes. Add a few more pieces for fresh outfits."
    };
  }

  return {
    ok: true,
    mode: 'fallback',
    notice: `${notice} Showing a rule-based pick from CLOSIQ's own engine instead.`,
    data: {
      title: local.title,
      vibe: local.vibe,
      // No AI evaluated this pick, so it carries no AI match score — only the
      // engine's own explainable rule-based score.
      styleScore: 0,
      garmentIds: local.items.map((item) => item.id),
      explanation: {
        summary: local.explanation.summary,
        colorHarmony: local.explanation.colorHarmony,
        occasionFit: local.explanation.silhouette
      },
      ruleScore: local.ruleScore,
      scoreBreakdown: local.scoreBreakdown
    }
  };
}

export async function swapGarmentMobile(
  currentOutfitGarmentIds: string[],
  targetGarmentIdToSwap: string,
  targetCategory: GarmentCategory,
  prompt: string,
  wardrobe: GarmentItem[]
): Promise<{ ok: boolean; mode: 'gemini' | 'fallback'; data: MobileSwapResult; error?: string; notice?: string }> {
  const fullWardrobe = wardrobe;
  wardrobe = wardrobe.filter(isGarmentAvailable);
  const formattedWardrobe = formatForApi(wardrobe);

  const result = await postApi('/api/ai/swap-garment', {
    currentOutfitGarmentIds,
    targetGarmentIdToSwap,
    targetCategory,
    prompt,
    wardrobe: formattedWardrobe
  });

  let notice: string | undefined;
  if (result.ok) {
    const resData = result.json as { mode?: string; data?: Record<string, any> };
    if (resData.data && resData.data.replacementGarmentId) {
      // Validate replacement exists in closet
      const replacementId = resData.data.replacementGarmentId;
      const replacement = wardrobe.find((item) => item.id === replacementId);
      if (
        replacement &&
        replacement.category === targetCategory &&
        replacementId !== targetGarmentIdToSwap &&
        !currentOutfitGarmentIds.includes(replacementId)
      ) {
        return {
          ok: true,
          mode: resData.mode === 'gemini' ? 'gemini' : 'fallback',
          data: {
            replacementGarmentId: resData.data.replacementGarmentId,
            outfitTitle: resData.data.outfitName,
            whyItWorks: resData.data.whyItWorks || 'Replaced piece with an alternative matching option from your wardrobe.'
          }
        };
      }
    }
    notice = 'The AI returned no usable replacement.';
  } else {
    notice = describeApiFailure(result.reason);
  }

  // Rule-based swap: the same-category piece that makes the WHOLE outfit
  // score best with the shared engine (layering, ethnic pairing, colour,
  // formality) — deterministic, never another category, never a laundry piece.
  const others = currentOutfitGarmentIds
    .filter((id) => id !== targetGarmentIdToSwap)
    .map((id) => fullWardrobe.find((g) => g.id === id))
    .filter((g): g is GarmentItem => Boolean(g));
  const current = fullWardrobe.find((item) => item.id === targetGarmentIdToSwap);
  const candidates = rankSwapCandidates(
    { items: current ? [...others, current] : others },
    targetCategory,
    wardrobe.filter((g) => !currentOutfitGarmentIds.includes(g.id) || g.id === targetGarmentIdToSwap),
    { prompt }
  );

  if (candidates.length === 0) {
    return {
      ok: false,
      mode: 'fallback',
      notice,
      error: 'no_alternative',
      data: {
        replacementGarmentId: targetGarmentIdToSwap,
        whyItWorks: 'There is no other piece in this category in your wardrobe yet — add one to swap.'
      }
    };
  }

  const replacement = candidates[0];
  return {
    ok: true,
    mode: 'fallback',
    notice: `${notice} Swapped using CLOSIQ's rule-based engine instead.`,
    data: {
      replacementGarmentId: replacement.id,
      whyItWorks: `${replacement.name} (${replacement.color}) scores best with the rest of this outfit for "${prompt}".`
    }
  };
}
