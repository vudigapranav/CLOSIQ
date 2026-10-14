/**
 * 2026-10-14 AI audit. The phone app read `title` / `styleScore` /
 * `explanation.summary`, but the server's Gemini schema returns
 * `outfitName` / `styleMatch` / `whyItWorks{...}` — so every REAL AI outfit
 * showed "<prompt> Outfit", an invented 88% and canned copy. And when the AI
 * was unavailable the local engine picked "first top, first bottom", which
 * read as random shuffling. These tests pin the fixes.
 */
import './helpers/installMocks';
import { setSupabase } from './helpers/installMocks';
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateOutfitMobile, swapGarmentMobile } from '../src/services/outfitStylist';
import { GarmentItem } from '../../src/types/wardrobe';

setSupabase({
  auth: { getSession: async () => ({ data: { session: { access_token: 'token' } }, error: null }) }
});

function withJson(status: number, body: unknown) {
  globalThis.fetch = (async () => ({ status, ok: status >= 200 && status < 300, json: async () => body })) as unknown as typeof fetch;
}

function g(id: string, category: GarmentItem['category'], formality: GarmentItem['formality'], name = id): GarmentItem {
  return {
    id, name, category, formality,
    subcategory: category, color: 'Navy', hexColor: '#123', fabric: 'Cotton', seasons: [],
    imageUrl: '', favorite: false, wearCount: 0, dateAdded: '2026-10-14', tags: []
  };
}

const WARDROBE = [
  g('tee', 'tops', 'casual', 'Graphic Tee'),
  g('oxford', 'tops', 'formal', 'White Oxford Shirt'),
  g('joggers', 'bottoms', 'casual', 'Joggers'),
  g('trousers', 'bottoms', 'formal', 'Tailored Trousers'),
  g('sneakers', 'shoes', 'casual', 'Sneakers'),
  g('loafers', 'shoes', 'formal', 'Leather Loafers')
];

test("a real AI outfit keeps the AI's own title, score and reasons", async () => {
  withJson(200, {
    ok: true,
    mode: 'gemini',
    data: {
      status: 'success',
      outfitName: 'Refined Evening Casual',
      vibe: 'Smart Casual',
      styleMatch: 96,
      garmentIds: ['oxford', 'trousers', 'loafers'],
      whyItWorks: { overall: 'Polished but relaxed.', color: 'Navy on white.', fit: 'Clean lines.', occasion: 'Right for dinner.' }
    }
  });

  const res = await generateOutfitMobile('date night', WARDROBE);

  assert.equal(res.mode, 'gemini');
  assert.equal(res.data.title, 'Refined Evening Casual');
  assert.equal(res.data.styleScore, 96);
  assert.equal(res.data.explanation.summary, 'Polished but relaxed.');
  assert.equal(res.data.explanation.colorHarmony, 'Navy on white.');
  assert.equal(res.data.explanation.occasionFit, 'Right for dinner.');
  assert.equal(res.data.explanation.fit, 'Clean lines.');
});

test('the local engine picks for the occasion and claims no score', async () => {
  withJson(200, { ok: false, mode: 'demo', errorKind: 'not_configured' });

  const res = await generateOutfitMobile('Job interview at an office', WARDROBE);

  assert.equal(res.mode, 'fallback');
  assert.equal(res.data.styleScore, 0, 'no AI evaluated it, so no match score');
  assert.deepEqual(new Set(res.data.garmentIds), new Set(['oxford', 'trousers', 'loafers']));
  assert.match(res.notice ?? '', /local engine/i);
});

test('a local swap stays in the same category and is honest when there is none', async () => {
  withJson(503, { ok: false });

  const swap = await swapGarmentMobile(['oxford', 'trousers', 'loafers'], 'loafers', 'shoes', 'work', WARDROBE);
  assert.equal(swap.ok, true);
  assert.equal(swap.data.replacementGarmentId, 'sneakers');

  const onlyOneTop = WARDROBE.filter((item) => item.id !== 'tee');
  const none = await swapGarmentMobile(['oxford', 'trousers', 'loafers'], 'oxford', 'tops', 'work', onlyOneTop);
  assert.equal(none.ok, false);
  assert.equal(none.error, 'no_alternative');
});
