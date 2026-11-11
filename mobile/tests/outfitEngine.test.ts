/**
 * The explainable rule-based outfit engine (2026-11-11) —
 * src/services/intelligence/outfitEngine.ts. Shared by web and mobile; scores
 * AI and local outfits with the same factors, never invents numbers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isCoherentAIOutfit,
  rankOutfits,
  rankSwapCandidates,
  scoreOutfit,
  buildEngineOutfit,
  seasonForDate,
  matchesStylePreference
} from '../../src/services/intelligence/outfitEngine';
import { generateAIOutfit, getSwapCandidates, applySwapCandidate, calculateStyleMatchScore } from '../../src/services/aiStylist';
import { buildOutfitBrain, comboSignature, pickLocalOutfit } from '../../src/services/outfitBrain';
import { validateAIOutfitResponse } from '../../src/services/ai/validator';
import { GarmentItem, matchLabel } from '../../src/types/wardrobe';
import { WeatherSnapshot } from '../../src/services/weather/weatherCore';

function g(
  id: string,
  category: GarmentItem['category'],
  formality: GarmentItem['formality'],
  color: string,
  hexColor: string,
  extra: Partial<GarmentItem> = {}
): GarmentItem {
  return {
    id,
    name: extra.name ?? id,
    category,
    formality,
    color,
    hexColor,
    subcategory: extra.subcategory ?? category,
    fabric: extra.fabric ?? 'Cotton',
    seasons: extra.seasons ?? [],
    imageUrl: '',
    favorite: false,
    wearCount: extra.wearCount ?? 0,
    dateAdded: '2026-11-01',
    tags: extra.tags ?? [],
    ...extra
  };
}

const W: GarmentItem[] = [
  g('white_oxford', 'tops', 'formal', 'White', '#FFFFFF', { name: 'White Oxford Shirt' }),
  g('graphic_tee', 'tops', 'casual', 'Red', '#C0392B', { name: 'Graphic Tee' }),
  g('charcoal_trousers', 'bottoms', 'formal', 'Charcoal', '#36454F', { name: 'Charcoal Trousers' }),
  g('blue_jeans', 'bottoms', 'casual', 'Blue', '#3B5B8C', { name: 'Blue Jeans', subcategory: 'Jeans' }),
  g('loafers', 'shoes', 'formal', 'Brown', '#5C4033', { name: 'Leather Loafers' }),
  g('sneakers', 'shoes', 'casual', 'White', '#F5F5F5', { name: 'White Sneakers' }),
  g('wool_coat', 'outerwear', 'formal', 'Camel', '#C19A6B', { name: 'Wool Overcoat', fabric: 'Wool' })
];

const cold: WeatherSnapshot = { temperatureC: 4, condition: 'Overcast', conditionCode: 3 };
const hot: WeatherSnapshot = { temperatureC: 36, condition: 'Clear', conditionCode: 0 };
const rainy: WeatherSnapshot = { temperatureC: 24, condition: 'Rain', conditionCode: 61, precipitationProbability: 80 };

test('builds complete outfits only from the wardrobe, best fit for the occasion first', () => {
  const ranked = rankOutfits(W, { prompt: 'client meeting', today: '2026-11-11' }, 3);
  assert.ok(ranked.length >= 2);
  const ids = new Set(W.map((i) => i.id));
  for (const r of ranked) for (const i of r.items) assert.ok(ids.has(i.id), 'never invents a garment');
  const best = ranked[0].items.map((i) => i.id);
  assert.ok(best.includes('white_oxford') && best.includes('charcoal_trousers') && best.includes('loafers'));
  // Alternatives lead with different pieces where possible.
  assert.notEqual(ranked[0].items[0].id, ranked[1].items[0].id);
});

test('laundry and unavailable pieces are never recommended', () => {
  const wardrobe = W.map((i) =>
    i.id === 'white_oxford' ? { ...i, availability: 'laundry' as const } : i.id === 'loafers' ? { ...i, availability: 'unavailable' as const } : i
  );
  for (const r of rankOutfits(wardrobe, { prompt: 'office' }, 5)) {
    assert.ok(!r.items.some((i) => i.id === 'white_oxford' || i.id === 'loafers'));
  }
  const local = generateAIOutfit(wardrobe, { prompt: 'office' });
  assert.ok(!local.items.some((i) => i.availability && i.availability !== 'available'));
  const swaps = getSwapCandidates(local, 'shoes', wardrobe);
  assert.ok(!swaps.some((i) => i.id === 'loafers'));
});

test('weather: cold asks for an outer layer, heat drops it, missing weather is not guessed', () => {
  const coldBest = rankOutfits(W, { prompt: 'office', weather: cold }, 1)[0];
  assert.ok(coldBest.items.some((i) => i.category === 'outerwear'));
  const hotBest = rankOutfits(W, { prompt: 'office', weather: hot }, 1)[0];
  assert.ok(!hotBest.items.some((i) => i.category === 'outerwear'));

  const noWeather = scoreOutfit(coldBest.items, { prompt: 'office' });
  const wf = noWeather.factors.find((f) => f.key === 'weather')!;
  assert.equal(wf.weight, 0, 'no weather data → factor not counted');
  assert.match(wf.note, /No weather data/);
});

test('rain penalises suede shoes', () => {
  const suede = g('suede', 'shoes', 'casual', 'Tan', '#D2B48C', { name: 'Suede Loafers', fabric: 'Suede' });
  const body = [W[1], W[3]];
  const wet = scoreOutfit([...body, suede], { prompt: 'casual', weather: rainy });
  const dry = scoreOutfit([...body, W[5]], { prompt: 'casual', weather: rainy });
  const f = (s: typeof wet) => s.factors.find((x) => x.key === 'weather')!.score;
  assert.ok(f(wet) < f(dry));
});

test('scores are 0–100 with a per-factor breakdown that explains itself', () => {
  const s = scoreOutfit([W[0], W[2], W[4]], { prompt: 'interview', stylePreferences: ['classic'] });
  assert.ok(s.total >= 0 && s.total <= 100);
  for (const f of s.factors) {
    assert.ok(f.score >= 0 && f.score <= 1);
    if (f.weight > 0) assert.ok(f.note.length > 0, `${f.key} has a note`);
  }
  assert.ok(s.factors.find((f) => f.key === 'style')!.weight > 0);
  // A formal look scores better for an interview than a casual one.
  const casual = scoreOutfit([W[1], W[3], W[5]], { prompt: 'interview' });
  assert.ok(s.total > casual.total);
});

test('feedback: disliked combinations are never returned; liked pieces lift the score', () => {
  const first = rankOutfits(W, { prompt: 'office' }, 1)[0];
  const brain = buildOutfitBrain([
    { signature: comboSignature(first.items.map((i) => i.id)), garmentIds: first.items.map((i) => i.id), rating: 'dislike', updatedAt: '' }
  ]);
  for (const r of rankOutfits(W, { prompt: 'office', brain }, 10)) {
    assert.notEqual(comboSignature(r.items.map((i) => i.id)), comboSignature(first.items.map((i) => i.id)));
  }
  assert.equal(scoreOutfit(first.items, { prompt: 'office', brain }).factors.find((f) => f.key === 'feedback')!.score, 0);
});

test('local picks are labelled rule-based with no invented AI score', () => {
  const o = generateAIOutfit(W, { prompt: 'date night' });
  assert.equal(o.source, 'local');
  assert.equal(o.styleScore, 0);
  assert.equal(typeof o.ruleScore, 'number');
  assert.equal(o.temperature, undefined, 'no weather → no temperature');
  assert.match(matchLabel(o), /^Rule-based · \d+\/100$/);
  assert.ok(o.scoreBreakdown && o.scoreBreakdown.length === 8);
  assert.doesNotMatch(o.explanation.summary, /Sensual|Architectural/);
  const withWeather = generateAIOutfit(W, { prompt: 'office' }, 0, { weather: cold });
  assert.equal(withWeather.temperature, 4);
  // Old helper no longer returns an invented 91–99.
  assert.equal(calculateStyleMatchScore([W[0], W[2], W[4]], 'office'), scoreOutfit([W[0], W[2], W[4]], { prompt: 'office' }).total);
});

test('swaps are ranked by the whole outfit, drop a stale AI %, and respect layering', () => {
  const outfit = { ...generateAIOutfit(W, { prompt: 'office' }), source: 'ai' as const, styleScore: 95 };
  const candidates = getSwapCandidates(outfit, 'bottoms', W);
  assert.ok(candidates.every((c) => c.category === 'bottoms' && !outfit.items.some((i) => i.id === c.id)));
  const swapped = applySwapCandidate(outfit, 'bottoms', candidates[0]);
  assert.equal(swapped.styleScore, 0, 'the AI % described the old pieces');
  assert.equal(typeof swapped.ruleScore, 'number');

  const tank = g('tank', 'tops', 'casual', 'White', '#FFFFFF', { layeringRole: 'base_layer', name: 'Tank Top' });
  const noOuter = { items: [W[3], W[5]] };
  assert.ok(!rankSwapCandidates(noOuter, 'tops', [...W, tank], { prompt: 'casual', layeringPreference: 'avoid' }).some((i) => i.id === 'tank'));
  assert.ok(rankSwapCandidates(noOuter, 'tops', [...W, tank], { prompt: 'casual', layeringPreference: 'usually' }).some((i) => i.id === 'tank'));
});

test('one-pieces never get a bottom; ethnic-only bottoms only under ethnic tops', () => {
  const dress = g('dress', 'tops', 'evening', 'Black', '#000000', { name: 'Black Dress', subcategory: 'Dress' });
  const churidar = g('churidar', 'bottoms', 'formal', 'Ivory', '#FFFFF0', { name: 'Churidar' });
  const wardrobe = [...W, dress, churidar];
  for (const r of rankOutfits(wardrobe, { prompt: 'party' }, 20)) {
    const ids = r.items.map((i) => i.id);
    if (ids.includes('dress')) assert.ok(!r.items.some((i) => i.category === 'bottoms'));
    if (ids.includes('churidar')) assert.fail('churidar paired with a western top');
  }
});

test('brain-aware local pick still works and returns null when everything is disliked', () => {
  const tiny = [W[1], W[3]];
  const sig = comboSignature(['graphic_tee', 'blue_jeans']);
  const brain = buildOutfitBrain([{ signature: sig, garmentIds: ['graphic_tee', 'blue_jeans'], rating: 'dislike', updatedAt: '' }]);
  assert.equal(pickLocalOutfit(tiny, { prompt: 'casual' }, brain), null);
  assert.ok(pickLocalOutfit(tiny, { prompt: 'casual' }));
});

test('AI output: invented ids are counted, incoherent looks rejected, no default score', () => {
  const v = validateAIOutfitResponse({ status: 'success', garmentIds: ['white_oxford', 'made_up', 'white_oxford'] }, W);
  assert.equal(v.valid, true);
  assert.equal(v.droppedIds, 1);
  assert.equal(v.items.length, 1);
  assert.equal(v.styleMatch, 0, 'no score given → 0, not an invented 92');

  assert.equal(isCoherentAIOutfit([W[0], W[1], W[2]]), false, 'two tops');
  assert.equal(isCoherentAIOutfit([W[0], W[2], W[4]]), true);
  assert.equal(isCoherentAIOutfit([W[0], W[2]], ['white_oxford']), false, 'excluded piece');
});

test('helpers: season by month, style preference matching', () => {
  assert.equal(seasonForDate('2026-11-11'), 'autumn');
  assert.equal(seasonForDate('2026-01-05'), 'winter');
  assert.equal(matchesStylePreference(W[1], 'streetwear'), true);
  assert.equal(matchesStylePreference(W[0], 'minimal'), true);
  const built = buildEngineOutfit(rankOutfits(W, { prompt: 'casual' }, 1)[0], { prompt: 'casual' });
  assert.equal(built.missingCategories, undefined);
});

test('swapping a top never brings a dress over a bottom or breaks the ethnic-bottom rule', () => {
  const dress = g('dress', 'tops', 'evening', 'Black', '#000000', { name: 'Black Dress', subcategory: 'Dress' });
  const kurta = g('kurta', 'tops', 'formal', 'Ivory', '#FFFFF0', { name: 'Silk Kurta', subcategory: 'Kurta' });
  const churidar = g('churidar', 'bottoms', 'formal', 'Ivory', '#FFFFF0', { name: 'Churidar' });
  const wardrobe = [...W, dress, kurta, churidar];
  const withJeans = rankSwapCandidates({ items: [W[1], W[3], W[5]] }, 'tops', wardrobe, { prompt: 'party' });
  assert.ok(!withJeans.some((i) => i.id === 'dress'));
  const withChuridar = rankSwapCandidates({ items: [kurta, churidar, W[4]] }, 'tops', wardrobe, { prompt: 'wedding' });
  assert.ok(withChuridar.every((i) => i.id !== 'white_oxford' && i.id !== 'graphic_tee'), 'western tops never over a churidar');
});
