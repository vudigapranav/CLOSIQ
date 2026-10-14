import { GarmentItem, GarmentCategory, LayeringPreference } from '../../../src/types/wardrobe';
import { OutfitPersonalizationContext } from './personalizationContext';
import { postApi, describeApiFailure } from './apiRequest';
import { isFreshCombination, pickLocalOutfit } from '../../../src/services/outfitBrain';

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
  if (!wardrobe || wardrobe.length === 0) {
    return {
      ok: false,
      mode: 'fallback',
      data: {
        title: 'Empty Closet',
        vibe: 'No Garments Cataloged',
        styleScore: 0,
        garmentIds: [],
        explanation: { summary: 'Add items to your wardrobe to unlock personalized styling.' }
      },
      error: 'Wardrobe is empty'
    };
  }

  // Format wardrobe payload for backend API
  const formattedWardrobe = wardrobe.map((item) => ({
    garmentId: item.id,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    color: item.color,
    fabric: item.fabric,
    fit: item.fit || 'Regular',
    formality: item.formality,
    layeringRole: item.layeringRole || 'primary_layer',
    style: item.style || 'Casual Essential',
    tags: item.tags || [],
    pairingNotes: item.pairingNotes || ''
  }));

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
      // Validate returned IDs exist in closet
      validIds = resData.data.garmentIds.filter((id: string) =>
        wardrobe.some((item) => item.id === id)
      );

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
            }
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
  const availableWardrobe = wardrobe.filter((i) => !excludeGarmentIds.includes(i.id));
  const local = pickLocalOutfit(
    availableWardrobe.length >= 2 ? availableWardrobe : wardrobe,
    { prompt, layeringPreference },
    personalization?.brain
  );

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
    notice: `${notice} Showing a pick from CLOSIQ's local engine instead.`,
    data: {
      title: local.title,
      vibe: local.vibe,
      // No AI evaluated this pick, so it carries no match score.
      styleScore: 0,
      garmentIds: local.items.map((item) => item.id),
      explanation: { summary: local.explanation.summary }
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
  const formattedWardrobe = wardrobe.map((item) => ({
    garmentId: item.id,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    color: item.color,
    fabric: item.fabric,
    fit: item.fit || 'Regular',
    formality: item.formality,
    layeringRole: item.layeringRole || 'primary_layer',
    style: item.style || 'Casual Essential',
    tags: item.tags || [],
    pairingNotes: item.pairingNotes || ''
  }));

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
      const exists = wardrobe.some((item) => item.id === resData.data!.replacementGarmentId);
      if (exists && resData.data.replacementGarmentId !== targetGarmentIdToSwap) {
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

  // Local swap (2026-10-14): another piece from the SAME category, closest in
  // formality to the one being replaced — not a random pick, and never a
  // piece from a different category.
  const current = wardrobe.find((item) => item.id === targetGarmentIdToSwap);
  const FORMALITY_ORDER = ['casual', 'smart_casual', 'formal', 'evening'];
  const rank = (f: string) => FORMALITY_ORDER.indexOf(f);
  const candidates = wardrobe
    .filter((item) => item.category === targetCategory && item.id !== targetGarmentIdToSwap && !currentOutfitGarmentIds.includes(item.id))
    .sort((a, b) => Math.abs(rank(a.formality) - rank(current?.formality ?? 'casual')) - Math.abs(rank(b.formality) - rank(current?.formality ?? 'casual')));

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
    notice: `${notice} Swapped using CLOSIQ's local engine instead.`,
    data: {
      replacementGarmentId: replacement.id,
      whyItWorks: `${replacement.name} (${replacement.color}) is the closest match in formality to the piece it replaces.`
    }
  };
}
