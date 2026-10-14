/**
 * The outfit brain (2026-10-14). The user's rule: a disliked look must never
 * come back, regenerating for the same occasion days later must not hand
 * back the first outfit, and liked/worn looks must shape Style DNA.
 */
import './helpers/installMocks';
import { setSupabase } from './helpers/installMocks';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOutfitBrain, comboSignature, isFreshCombination, pickLocalOutfit, tasteGarments, OutfitFeedback } from '../../src/services/outfitBrain';
import { computeStyleDna, styleArchetype } from '../../src/data/styleDna';
import { generateOutfitMobile } from '../src/services/outfitStylist';
import { GarmentItem, Outfit } from '../../src/types/wardrobe';

setSupabase({
  auth: { getSession: async () => ({ data: { session: { access_token: 'token' } }, error: null }) }
});

function g(id: string, category: GarmentItem['category'], formality: GarmentItem['formality'], name = id, color = 'Red'): GarmentItem {
  return {
    id, name, category, formality, color,
    subcategory: category, hexColor: '#123', fabric: 'Cotton', seasons: [],
    imageUrl: '', favorite: false, wearCount: 0, dateAdded: '2026-10-14', tags: []
  };
}

const W = [
  g('oxford', 'tops', 'formal', 'White Oxford', 'White'),
  g('polo', 'tops', 'smart_casual', 'Navy Polo', 'Navy'),
  g('trousers', 'bottoms', 'formal', 'Tailored Trousers', 'Charcoal'),
  g('chinos', 'bottoms', 'smart_casual', 'Chinos', 'Beige'),
  g('loafers', 'shoes', 'formal', 'Loafers', 'Brown'),
  g('kurta', 'tops', 'formal', 'Silk Kurta', 'Ivory')
];

const fb = (ids: string[], rating: OutfitFeedback['rating']): OutfitFeedback => ({
  signature: comboSignature(ids), garmentIds: ids, rating, updatedAt: '2026-10-14T00:00:00Z'
});

test('the local engine never returns a disliked combination', () => {
  const first = pickLocalOutfit(W, { prompt: 'office meeting' })!;
  const firstIds = first.items.map((i) => i.id);
  const brain = buildOutfitBrain([fb(firstIds, 'dislike')]);

  for (let i = 0; i < 5; i += 1) {
    const next = pickLocalOutfit(W, { prompt: 'office meeting' }, brain)!;
    assert.notEqual(comboSignature(next.items.map((x) => x.id)), comboSignature(firstIds));
  }
});

test('regenerating days later does not hand back the recently shown outfit', () => {
  const first = pickLocalOutfit(W, { prompt: 'office meeting' })!;
  const sig = comboSignature(first.items.map((i) => i.id));
  const brain = buildOutfitBrain([], [sig]);
  const next = pickLocalOutfit(W, { prompt: 'office meeting' }, brain)!;
  assert.notEqual(comboSignature(next.items.map((i) => i.id)), sig);
});

test('when every combination is disliked, the engine says so instead of repeating one', () => {
  const tiny = [g('t', 'tops', 'casual'), g('b', 'bottoms', 'casual')];
  const brain = buildOutfitBrain([fb(['t', 'b'], 'dislike')]);
  assert.equal(pickLocalOutfit(tiny, { prompt: 'casual' }, brain), null);
});

test('worn looks count as liked; a dislike always wins over a like', () => {
  const worn = { items: [W[0], W[2], W[4]], status: 'worn' } as Outfit;
  const brain = buildOutfitBrain([], [], [worn]);
  assert.ok(brain.liked.has(comboSignature(['oxford', 'trousers', 'loafers'])));
  assert.equal(brain.learnedFrom, 1);

  const both = buildOutfitBrain([fb(['oxford', 'trousers', 'loafers'], 'dislike')], [], [worn]);
  assert.equal(both.liked.size, 0);
  assert.equal(isFreshCombination(['loafers', 'oxford', 'trousers'], both), false, 'order does not matter');
});

test('if the AI returns a disliked look, the app swaps in a fresh one', async () => {
  globalThis.fetch = (async () => ({
    status: 200,
    ok: true,
    json: async () => ({ ok: true, mode: 'gemini', data: { outfitName: 'Same Again', styleMatch: 90, garmentIds: ['oxford', 'trousers', 'loafers'], whyItWorks: { overall: 'x' } } })
  })) as unknown as typeof fetch;
  const brain = buildOutfitBrain([fb(['oxford', 'trousers', 'loafers'], 'dislike')]);

  const res = await generateOutfitMobile('office meeting', W, 'sometimes', [], { brain });

  assert.equal(res.mode, 'fallback');
  assert.match(res.notice ?? '', /disliked or saw recently/);
  assert.notEqual(comboSignature(res.data.garmentIds), comboSignature(['oxford', 'trousers', 'loafers']));
});

test('Style DNA learns from liked looks, and names the archetype from taste', () => {
  const ownedOnly = computeStyleDna(W);
  const kurtaLooks = buildOutfitBrain([fb(['kurta', 'trousers', 'loafers'], 'nice'), fb(['kurta', 'chinos', 'loafers'], 'nice')]);
  const taste = tasteGarments(kurtaLooks, W);
  const learned = computeStyleDna(W, taste);
  const ethnic = (dna: typeof learned) => dna.find((a) => a.key === 'ethnic')!.score;

  assert.ok(ethnic(learned) > ethnic(ownedOnly), 'liking kurta looks raises the Indian Ethnic score');
  assert.equal(styleArchetype(W, [], taste).source, 'taste');
});
