// CLOSIQ V2: garment scans and outfit picks come from the on-device model,
// never from Gemini. These tests run the shipping .native.ts services with a
// controlled stand-in for the native LiteRT-LM module.
import { installNativeMocks, setNativeVision } from './helpers/nativeV2Mocks';
import test from 'node:test';
import assert from 'node:assert/strict';
import type { GarmentItem } from '../../src/types/wardrobe';

installNativeMocks();
let status = 'ready';
let output = '';
let answerFor: ((prompt: string) => string) | null = null;
const prompts: string[] = [];
setNativeVision({
  status: async () => status,
  initialize: async () => {},
  answer: async (prompt) => {
    prompts.push(prompt);
    return answerFor ? answerFor(prompt) : output;
  },
  cancel: async () => {},
  unload: async () => {}
});

const base: GarmentItem = {
  id: 'shirt',
  name: 'Blue shirt',
  category: 'tops',
  subcategory: 'shirt',
  color: 'blue',
  hexColor: '#002277',
  fabric: 'unknown',
  seasons: ['summer'],
  formality: 'casual',
  imageUrl: '',
  favorite: false,
  wearCount: 0,
  dateAdded: '2026-11-19',
  tags: []
};

test('model garment output must identify a valid garment, even when wrapped in prose', async () => {
  const { validateGarment } = await import('../src/local/validation');
  const garment = { name: 'Blue kurta {long}', category: 'tops', primaryColor: 'blue', formality: 'casual', secondaryColors: ['white'] };
  const parsed = validateGarment('Here is the JSON:\n```json\n' + JSON.stringify(garment) + '\n```');
  assert.equal(parsed.name, 'Blue kurta {long}');
  assert.equal(parsed.fabric, 'unknown');
  assert.deepEqual(parsed.secondaryColors, ['white']);
  assert.throws(() => validateGarment('I think it is a shirt.'));
  assert.throws(() => validateGarment('{"category":"laptop"}'));
  assert.throws(() => validateGarment('{"name":"Blue kurta","category":"tops"'));
});

test('an outfit pick can only address one of the offered, owned outfits', async () => {
  const { validateRanking } = await import('../src/local/validation');
  assert.deepEqual(validateRanking('Sure! {"choice": 2, "explanation": "Smart \\"and\\" warm"} Hope that helps.', 2), {
    index: 1,
    explanation: 'Smart "and" warm'
  });
  for (const raw of [
    '{"choice":1,"garmentIds":["fake"],"explanation":"ok"}',
    '{"choice":3,"explanation":"ok"}',
    '{"choice":1.2,"explanation":"ok"}'
  ])
    assert.throws(() => validateRanking(raw, 2));
  assert.throws(() => validateRanking('{"choice":1,"explanation":"ok"}', 0));
});

test('a photo scan asks the model short questions and derives checked fields', async () => {
  const { analyzeGarmentImageMobile } = await import('../src/services/visionAnalysis.native');
  status = 'ready';
  answerFor = (p) =>
    /What is this garment/.test(p)
      ? 'Sure, I can identify the garment. The garment is a pair of black cargo pants.'
      : /casual, smart casual/.test(p)
        ? 'Casual.'
        : 'unexpected question';
  prompts.length = 0;
  const scanned = await analyzeGarmentImageMobile('file:///photo.jpg');
  assert.equal(scanned.ok, true);
  if (scanned.ok)
    assert.deepEqual([scanned.data.name, scanned.data.category, scanned.data.color, scanned.data.formality, scanned.data.subcategory], [
      'Black cargo pants', 'bottoms', 'black', 'casual', 'pants'
    ]);
  assert.equal(prompts.length, 2, 'category and colour came from the name, so only two questions were asked');

  // Name without category/colour words: the follow-up questions fill them in.
  answerFor = (p) =>
    /What is this garment/.test(p) ? 'The garment is a lehenga choli set.'
      : /top, bottoms, outerwear/.test(p) ? 'Bottoms.'
      : /main colour/.test(p) ? 'Maroon'
      : 'Evening wear.';
  const filled = await analyzeGarmentImageMobile('file:///photo.jpg');
  assert.equal(filled.ok && filled.data.category, 'bottoms');
  assert.equal(filled.ok && filled.data.color, 'maroon');
  assert.equal(filled.ok && filled.data.formality, 'evening');

  // A rambling answer that never gives a usable category or formality is rejected, with the transcript kept.
  answerFor = () => 'style: casual style: casual';
  const rambling = await analyzeGarmentImageMobile('file:///photo.jpg');
  assert.equal(rambling.ok, false);
  assert.match(!rambling.ok ? rambling.raw ?? '' : '', /What is this garment/);
  answerFor = null;

  status = 'missing';
  const missing = await analyzeGarmentImageMobile('file:///photo.jpg');
  assert.equal(missing.ok, false);
  assert.match(!missing.ok ? missing.message : '', /Turn on CLOSIQ AI/);
  assert.doesNotMatch(!missing.ok ? missing.message : '', /local|on-device/i);
  status = 'failed';
  const failed = await analyzeGarmentImageMobile('file:///photo.jpg');
  assert.match(!failed.ok ? failed.message : '', /couldn't start on this phone/);
  const remote = await analyzeGarmentImageMobile('BASE64DATA');
  assert.equal(remote.ok, false);
});

test('styling uses owned, available pieces through model success, rejection and absence', async () => {
  const { generateOutfitMobile, swapGarmentMobile } = await import('../src/services/outfitStylist.native');
  const closet = [
    base,
    { ...base, id: 'slacks', name: 'Trousers', category: 'bottoms' as const },
    { ...base, id: 'second', name: 'Green shirt' },
    { ...base, id: 'wash', availability: 'laundry' as const }
  ];
  status = 'ready';
  answerFor = (p) => (/number only/.test(p) ? 'Outfit 1.' : 'Sure! The blue shirt and trousers keep it relaxed but neat for dinner.');
  const result = await generateOutfitMobile('dinner', closet, 'avoid', ['second']);
  assert.equal(result.mode, 'on_device');
  assert.deepEqual(new Set(result.data.garmentIds), new Set(['shirt', 'slacks']));
  assert.equal(result.data.explanation.summary, 'The blue shirt and trousers keep it relaxed but neat for dinner.');
  // A number that was not offered, or no number, falls back to the rules; IDs never come from model text.
  for (const bad of ['Outfit 7 with the invention jacket.', 'The first one.']) {
    answerFor = () => bad;
    const res = await generateOutfitMobile('dinner', closet);
    assert.equal(res.mode, 'fallback');
    assert.ok(res.data.garmentIds.every((id) => closet.some((g) => g.id === id)));
  }
  answerFor = null;
  status = 'missing';
  assert.equal((await generateOutfitMobile('dinner', closet)).mode, 'fallback');
  // After a native crash while starting, styling never touches the model again.
  status = 'failed';
  const before = prompts.length;
  assert.equal((await generateOutfitMobile('dinner', closet)).mode, 'fallback');
  assert.equal(prompts.length, before);
  assert.equal((await generateOutfitMobile('dinner', [])).ok, false);
  const swapped = await swapGarmentMobile(['shirt', 'slacks'], 'shirt', 'tops', 'dinner', closet);
  assert.equal(swapped.data.replacementGarmentId, 'second');
  // Nothing else to swap to: the screens' "Nothing to swap yet" contract.
  const none = await swapGarmentMobile(['shirt', 'slacks'], 'slacks', 'bottoms', 'dinner', closet);
  assert.equal(none.ok, false);
  assert.equal(none.error, 'no_alternative');
});

test('the small model line answers are accepted, normalised and still checked strictly', async () => {
  const { validateGarment, validateRanking } = await import('../src/local/validation');
  const g = validateGarment(
    'Name: Black cargo pants\nCategory: Pants\nType: cargo trousers\nColour: black\nPattern: solid\nFormality: Smart casual\nStyle: utility streetwear'
  );
  assert.deepEqual([g.name, g.category, g.subcategory, g.color, g.pattern, g.formality, g.style], [
    'Black cargo pants', 'bottoms', 'cargo trousers', 'black', 'solid', 'smart_casual', 'utility streetwear'
  ]);
  assert.equal(validateGarment('**Name:** Oxford shirt\n**Category:** tops\n**Colour:** light blue\n**Formality:** casual').category, 'tops');
  assert.throws(() => validateGarment('Name: Mystery\nCategory: furniture\nColour: red\nFormality: casual'));
  assert.throws(() => validateGarment('Name: Shirt\nCategory: tops\nColour: blue\nFormality: party'));
  assert.deepEqual(validateRanking('Choice: 2\nReason: The chinos keep it smart for dinner.', 3), {
    index: 1,
    explanation: 'The chinos keep it smart for dinner.'
  });
  assert.throws(() => validateRanking('Choice: 4\nReason: x', 3));
  assert.throws(() => validateRanking('Choice: two\nReason: x', 3));
  assert.throws(() => validateRanking('Choice: 1', 3));
});

test('chat replies keep at most two distinct sentences', async () => {
  const { chatReply } = await import('../src/local/validation');
  const looping =
    'Sure! Wear the White Oxford Shirt with Taupe Parachute Pants. If you have to wear a tie, keep it subtle. If you have to wear a tie, keep it subtle. If you have to wear a tie, keep it subtle.';
  assert.equal(chatReply(looping), 'Wear the White Oxford Shirt with Taupe Parachute Pants. If you have to wear a tie, keep it subtle.');
  assert.equal(chatReply('Black chinos. Black chinos. Black chinos.'), 'Black chinos.');
});

test('chat answers name owned pieces chosen through the grounded outfit path', async () => {
  const { answerWardrobeQuestion } = await import('../src/services/outfitStylist.native');
  const shirt = { ...base, id: 'oxford', name: 'White Oxford Shirt' };
  const trousers = { ...base, id: 'chinos', name: 'Navy Chinos', category: 'bottoms' as const };
  status = 'ready';
  answerFor = (p) => (/number only/.test(p) ? '1' : 'A crisp shirt and chinos look polished for a reception.');
  const answer = await answerWardrobeQuestion('What should I wear to a wedding reception?', [shirt, trousers]);
  assert.equal(answer, 'Try your White Oxford Shirt and Navy Chinos. A crisp shirt and chinos look polished for a reception.');
  assert.match(await answerWardrobeQuestion('Wedding?', []), /Nothing in your wardrobe fits/);
  answerFor = null;
});
