import test from 'node:test';
import assert from 'node:assert/strict';
import { describeWear, normalizeCollections, normalizeGarmentPatch } from '../../src/services/garmentEdit';
import { isMissingColumnError, isMissingFunctionError } from '../../src/services/cloud/schemaErrors';
import { applyFilters, buildFacets } from '../../src/services/wardrobeFilters';
import { searchWardrobe } from '../../src/services/wardrobeSearch';
import { GarmentItem } from '../../src/types/wardrobe';

test('trims and caps text fields', () => {
  const { patch, errors } = normalizeGarmentPatch({ name: `  ${'a'.repeat(200)}  `, brand: 'B'.repeat(100), pattern: 'p'.repeat(90) });
  assert.equal(patch.name?.length, 80);
  assert.equal(patch.brand?.length, 60);
  assert.equal(patch.pattern?.length, 40);
  assert.deepEqual(errors, {});
});

test('blank name is rejected and omitted', () => {
  const { patch, errors } = normalizeGarmentPatch({ name: '   ' });
  assert.ok(errors.name);
  assert.equal('name' in patch, false);
});

test('collections de-duplicate case-insensitively and cap', () => {
  assert.deepEqual(normalizeCollections([' Office ', 'office', 'Goa trip', '', 'x'.repeat(60)]), ['Office', 'Goa trip', 'x'.repeat(40)]);
  assert.equal(normalizeCollections(Array.from({ length: 40 }, (_, i) => `c${i}`)).length, 20);
});

test('purchaseDate accepts YYYY-MM and YYYY-MM-DD only; blank clears', () => {
  assert.equal(normalizeGarmentPatch({ purchaseDate: '2026-03' }).patch.purchaseDate, '2026-03');
  assert.equal(normalizeGarmentPatch({ purchaseDate: '2026-03-14' }).patch.purchaseDate, '2026-03-14');
  assert.ok(normalizeGarmentPatch({ purchaseDate: '2026-13' }).errors.purchaseDate);
  assert.ok(normalizeGarmentPatch({ purchaseDate: 'March' }).errors.purchaseDate);
  const cleared = normalizeGarmentPatch({ purchaseDate: '' });
  assert.equal('purchaseDate' in cleared.patch, true);
  assert.equal(cleared.patch.purchaseDate, undefined);
});

test('enums are validated; seasons are a subset', () => {
  const { patch, errors } = normalizeGarmentPatch({
    category: 'hats' as never, formality: 'formal', availability: 'laundry', seasons: ['summer', 'monsoon' as never]
  });
  assert.ok(errors.category);
  assert.equal(patch.formality, 'formal');
  assert.equal(patch.availability, 'laundry');
  assert.deepEqual(patch.seasons, ['summer']);
  assert.ok(normalizeGarmentPatch({ availability: 'gone' as never }).errors.availability);
});

test('only present keys appear in the patch', () => {
  assert.deepEqual(Object.keys(normalizeGarmentPatch({ favorite: true }).patch), ['favorite']);
});

test('describeWear uses real numbers', () => {
  assert.equal(describeWear(0, undefined), 'Not worn yet');
  assert.equal(describeWear(4, '2026-11-03'), 'Worn 4 times · last on 3 Nov');
  assert.equal(describeWear(1, undefined), 'Worn 1 time');
});

test('schema error detection', () => {
  assert.ok(isMissingColumnError({ code: 'PGRST204' }));
  assert.ok(isMissingColumnError({ code: '42703' }));
  assert.ok(isMissingColumnError({ message: 'column "pattern" of relation "garments" does not exist' }));
  assert.ok(isMissingColumnError({ message: "Could not find the 'pattern' column of 'garments' in the schema cache" }));
  assert.equal(isMissingColumnError({ code: '23505', message: 'duplicate key' }), false);
  assert.ok(isMissingFunctionError({ code: 'PGRST202' }));
  assert.ok(isMissingFunctionError({ code: '42883' }));
  assert.equal(isMissingFunctionError({ code: '42501' }), false);
});

function item(id: string, extra: Partial<GarmentItem>): GarmentItem {
  return {
    id, name: id, category: 'tops', subcategory: 'Shirt', color: 'Blue', hexColor: '#2244aa', fabric: 'Cotton',
    seasons: ['summer'], formality: 'casual', imageUrl: '', favorite: false, wearCount: 0, dateAdded: '2026-01-01',
    tags: [], ...extra
  };
}

test('availability and collections are filter facets; laundry is searchable', () => {
  const items = [item('a', { availability: 'laundry', collections: ['Office'] }), item('b', {}), item('c', { collections: ['Office', 'Goa trip'] })];
  const facets = buildFacets(items);
  const status = facets.find((f) => f.key === 'status');
  assert.ok(status);
  assert.equal(status!.options.find((o) => o.value === 'laundry')?.count, 1);
  assert.equal(applyFilters(items, { status: ['laundry'] }).length, 1);
  const col = facets.find((f) => f.key === 'collection');
  assert.equal(col?.options.find((o) => o.value === 'Office')?.count, 2);
  assert.equal(applyFilters(items, { collection: ['Goa trip'] })[0].id, 'c');
  const hits = searchWardrobe(items, 'laundry');
  assert.ok(hits.length >= 1 && hits[0].id === 'a');
});
