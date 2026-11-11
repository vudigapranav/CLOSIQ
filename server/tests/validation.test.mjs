import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateImage, validatePrompt, validateWardrobe, validateIdList, filterOutfitIds,
  isValidReplacement, isValidGarmentId, sanitizeWeatherContext
} from '../validation.js';

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(32)]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(16)]);

test('validateImage accepts real magic bytes', () => {
  assert.equal(validateImage(jpeg.toString('base64'), 'image/jpeg').ok, true);
  assert.equal(validateImage(`data:image/png;base64,${png.toString('base64')}`).value.mimeType, 'image/png');
  assert.equal(validateImage(webp.toString('base64'), 'image/webp').ok, true);
  assert.equal(validateImage(jpeg.toString('base64')).value.mimeType, 'image/jpeg');
});

test('validateImage rejects bad input', () => {
  assert.equal(validateImage('', 'image/png').ok, false);
  assert.equal(validateImage(undefined).ok, false);
  // A wrong label on real PNG bytes is corrected from the bytes (see the
  // mislabelled-image test); the safety property is that only real
  // JPEG/PNG/WebP content is ever accepted.
  assert.equal(validateImage(png.toString('base64'), 'image/jpeg').value.mimeType, 'image/png');
  assert.equal(validateImage(png.toString('base64'), 'image/gif').value.mimeType, 'image/png');
  assert.equal(validateImage(Buffer.from('<svg></svg>padding-padding').toString('base64'), 'image/png').ok, false);
  assert.equal(validateImage('A'.repeat(9 * 1024 * 1024), 'image/png').ok, false);
});

test('prompt cap', () => {
  assert.equal(validatePrompt('x'.repeat(501)).ok, false);
  assert.equal(validatePrompt('  hi ').value, 'hi');
  assert.equal(validatePrompt(undefined, { required: true }).ok, false);
});

test('garment id regex accepts real id formats', () => {
  for (const id of ['charcoal_art_tee', 'garment-1731000000000', '3f2b8c1e-aaaa-bbbb-cccc-1234567890ab', 'a.b:c']) {
    assert.equal(isValidGarmentId(id), true, id);
  }
  for (const id of ['', 'a b', 'x'.repeat(81), '../etc', 5, null]) assert.equal(isValidGarmentId(id), false);
});

test('wardrobe caps and sanitising', () => {
  const ok = validateWardrobe([{ id: 'a', category: 'tops', name: ` ${'n'.repeat(200)} `, tags: Array(30).fill('t'), extra: { x: 1 } }]);
  assert.equal(ok.ok, true);
  assert.equal(ok.value[0].name.length, 120);
  assert.equal(ok.value[0].tags.length, 15);
  assert.equal('extra' in ok.value[0], false);
  assert.equal(validateWardrobe(Array.from({ length: 301 }, (_, i) => ({ id: `g${i}` }))).ok, false);
  assert.equal(validateWardrobe([{ id: 'bad id' }]).ok, false);
  assert.equal(validateWardrobe([{ id: 'a', category: 'hats' }]).ok, false);
  assert.equal(validateWardrobe('x').ok, false);
  assert.equal(validateIdList(['a', 'b c'], 'ids').ok, false);
});

test('filterOutfitIds drops unknown, excluded and duplicate ids', () => {
  const w = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(filterOutfitIds(['a', 'zzz', 'a', 'b', 'c'], w, ['c']), ['a', 'b']);
  assert.deepEqual(filterOutfitIds('nope', w), []);
});

test('isValidReplacement', () => {
  const w = [{ id: 't1', category: 'tops' }, { id: 't2', category: 'tops' }, { id: 'b1', category: 'bottoms' }];
  const base = { wardrobe: w, category: 'tops', currentOutfitIds: ['t1', 'b1'], targetId: 't1' };
  assert.equal(isValidReplacement('t2', base), true);
  assert.equal(isValidReplacement('b1', base), false);
  assert.equal(isValidReplacement('t1', base), false);
  assert.equal(isValidReplacement('nope', base), false);
});

test('sanitizeWeatherContext supports both shapes', () => {
  assert.deepEqual(sanitizeWeatherContext({ temperatureCelsius: 21.26, condition: 'Rain', junk: 1 }), { temperatureC: 21.3, condition: 'Rain' });
  assert.equal(sanitizeWeatherContext(null), null);
  assert.equal(sanitizeWeatherContext({}), null);
});

// Regression (2026-11-11 review): the web and mobile apps send each piece as
// { garmentId, ... } — never `id`. Validation and the output filters must
// accept that exact shape, or every AI request is rejected with 400.
test('accepts the real client wardrobe payload (garmentId key, seasons array)', () => {
  const clientPayload = [
    { garmentId: 'garment-1731300000000', name: 'White Oxford', category: 'tops', seasons: ['autumn', 'winter'], tags: ['office'], formality: 'formal' },
    { garmentId: 'charcoal_art_tee', name: 'Art Tee', category: 'tops', fit: 'Regular' },
    { garmentId: '0b4f9a8e-5c1d-4e8b-9a7f-2f1d3c4b5a6e', name: 'Chinos', category: 'bottoms' }
  ];
  const res = validateWardrobe(clientPayload);
  assert.equal(res.ok, true);
  assert.equal(res.value[0].garmentId, 'garment-1731300000000');
  assert.deepEqual(res.value[0].seasons, ['autumn', 'winter']);
  assert.deepEqual(filterOutfitIds(['garment-1731300000000', '0b4f9a8e-5c1d-4e8b-9a7f-2f1d3c4b5a6e', 'invented'], res.value), [
    'garment-1731300000000',
    '0b4f9a8e-5c1d-4e8b-9a7f-2f1d3c4b5a6e'
  ]);
  assert.equal(
    isValidReplacement('charcoal_art_tee', { wardrobe: res.value, category: 'tops', currentOutfitIds: ['garment-1731300000000'], targetId: 'garment-1731300000000' }),
    true
  );
  assert.equal(validateWardrobe([{ garmentId: 'bad id' }]).ok, false);
});

test('a mislabelled but real image type is corrected from its bytes', () => {
  // The web client labels every non-JPEG/WebP data URL as image/png.
  assert.equal(validateImage(`data:image/webp;base64,${webp.toString('base64')}`, 'image/png').value.mimeType, 'image/webp');
  assert.equal(validateImage(jpeg.toString('base64'), 'image/png').value.mimeType, 'image/jpeg');
  assert.equal(validateImage(Buffer.from('GIF89a-not-allowed').toString('base64'), 'image/png').ok, false);
});
