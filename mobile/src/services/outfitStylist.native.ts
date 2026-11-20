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
import { chosenIndex, reasonSentence } from '../local/validation';
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
    notice = 'Styled with HeyHanger wardrobe rules.';
  let mode: 'on_device' | 'fallback' = 'fallback';
  try {
    const status = await modelStatus();
    if (status === 'installed' || status === 'ready') {
      // Two short questions: the 500M base model answers each reliably,
      // while a combined "Choice/Reason" format is often ignored.
      const occasion = prompt.slice(0, 200).replace(/"/g, "'");
      const list = options
        .map((o, i) => i + 1 + ') ' + o.items.map((item) => item.name.slice(0, 36)).join(' + '))
        .join('\n');
      const pickAnswer = await infer('Which outfit is best for "' + occasion + '"?\n' + list + '\nAnswer with the number only.');
      index = chosenIndex(pickAnswer, options.length);
      const why = await infer(
        'In one short sentence, say why ' +
          options[index].items.map((item) => item.name.slice(0, 36)).join(', ') +
          ' work for "' +
          occasion +
          '".'
      ).catch(() => '');
      summary = reasonSentence(why);
      mode = 'on_device';
      notice = 'Picked by HeyHanger.ai from your wardrobe.';
    }
  } catch {
    notice = "HeyHanger.ai couldn't rank these looks, so wardrobe rules picked this one.";
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
    // Same contract as the V1 service: screens show "Nothing to swap yet"
    // with whyItWorks for 'no_alternative'.
    error: ok ? undefined : ('no_alternative' as const),
    data: {
      replacementGarmentId: ok ? candidate!.id : target,
      whyItWorks: ok
        ? 'Selected from available matching pieces in your wardrobe.'
        : 'There is no other available piece in this category in your wardrobe yet — add one to swap.'
    }
  };
}

/**
 * Stylist chat. A 500M model asked an open question about a wardrobe list
 * copies the list or invents clothes, so the chat reuses the grounded path:
 * the question is the occasion, HeyHanger builds outfits from owned, available
 * pieces and HeyHanger.ai picks one and says why.
 */
export async function answerWardrobeQuestion(question: string, wardrobe: GarmentItem[]) {
  const res = await generateOutfitMobile(question, wardrobe);
  if (!res.ok || !res.data.garmentIds.length)
    return 'Nothing in your wardrobe fits this yet. Add a top and a bottom you can wear for it.';
  const names = res.data.garmentIds
    .map((id) => wardrobe.find((g) => g.id === id)?.name)
    .filter((n): n is string => !!n);
  const pieces = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names.at(-1) : names[0];
  return 'Try your ' + pieces + '. ' + res.data.explanation.summary;
}
