import type { GarmentCategory, GarmentItem, LayeringPreference } from '../../../src/types/wardrobe';
import {
  rankOutfits,
  buildEngineOutfit,
  rankSwapCandidates
} from '../../../src/services/intelligence/outfitEngine';
import { isFreshCombination } from '../../../src/services/outfitBrain';
import type { OutfitPersonalizationContext } from './personalizationContext';
import { weatherSnapshotFromContext } from '../local/outfitWeather';
import { infer, modelStatus } from '../local/model';
import { validateRanking } from '../local/validation';
import type { MobileOutfitResult } from './outfitStylist';

export async function generateOutfitMobile(
  prompt: string,
  wardrobe: GarmentItem[],
  layeringPreference: LayeringPreference = 'avoid',
  excludeGarmentIds: string[] = [],
  personalization?: OutfitPersonalizationContext
) {
  const ctx = {
    prompt,
    layeringPreference,
    excludeGarmentIds,
    brain: personalization?.brain,
    weather: weatherSnapshotFromContext(personalization?.weatherContext),
    stylePreferences: personalization?.userProfileContext?.stylePreferences
  };
  const ranked = rankOutfits(wardrobe, ctx, 12);
  const fresh = ranked.filter((r) =>
    isFreshCombination(
      r.items.map((i) => i.id),
      personalization?.brain
    )
  );
  const options = (fresh.length ? fresh : ranked).slice(0, 3);
  if (!options.length) {
    return {
      ok: false,
      mode: 'fallback' as const,
      error: 'Add available pieces to create an outfit.',
      data: {
        title: 'No outfit available',
        vibe: '',
        styleScore: 0,
        garmentIds: [],
        explanation: { summary: '' }
      } as MobileOutfitResult
    };
  }
  let index = 0,
    summary = '',
    notice = 'Styled on this device using wardrobe rules.';
  let mode: 'on_device' | 'fallback' = 'fallback';
  try {
    const status = await modelStatus();
    if (status === 'installed' || status === 'ready') {
      const choices = options.map((o, i) => [
        i + 1,
        o.items.map((item) => [item.color.slice(0, 20), item.name.slice(0, 36)])
      ]);
      const instruction =
        'Pick the best numbered outfit for ' +
        JSON.stringify(prompt.slice(0, 200)) +
        '. Options: ' +
        JSON.stringify(choices) +
        '. Return only {"choice":1,"explanation":"short reason"} using one offered number.';
      const selection = validateRanking(await infer(instruction), options.length);
      index = selection.index;
      summary = selection.explanation;
      mode = 'on_device';
    }
  } catch {
    notice = 'The model could not rank these outfits. Wardrobe rules selected this look.';
  }
  const look = buildEngineOutfit(options[index], ctx);
  const data: MobileOutfitResult = {
    title: look.title,
    vibe: look.vibe,
    styleScore: 0,
    garmentIds: look.items.map((i) => i.id),
    explanation: {
      summary: summary || look.explanation.summary,
      colorHarmony: look.explanation.colorHarmony
    },
    ruleScore: look.ruleScore,
    scoreBreakdown: look.scoreBreakdown
  };
  return { ok: true, mode, data, notice };
}

export async function swapGarmentMobile(
  ids: string[],
  target: string,
  category: GarmentCategory,
  prompt: string,
  wardrobe: GarmentItem[]
) {
  const items = ids.map((id) => wardrobe.find((item) => item.id === id)).filter((i): i is GarmentItem => !!i);
  const candidate = rankSwapCandidates({ items }, category, wardrobe, { prompt }).find(
    (i) => !ids.includes(i.id)
  );
  const ok = !!candidate && items.some((i) => i.id === target && i.category === category);
  return {
    ok,
    mode: 'fallback' as const,
    error: ok ? undefined : 'No available replacement in this category.',
    data: {
      replacementGarmentId: ok ? candidate!.id : '',
      whyItWorks: 'Selected from available matching pieces in your wardrobe.'
    }
  };
}
