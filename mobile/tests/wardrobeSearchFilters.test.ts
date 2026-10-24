/**
 * Wardrobe search + filters (2026-10-24). The user's ask after two weeks:
 * "if I search for my blue jacket it should show me all blue jackets,
 * whatever type it is", and per-section filters (place, colour, size…).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { colorFamiliesOf, describeSearch, searchWardrobe } from '../../src/services/wardrobeSearch';
import {
  activeFilterChips,
  activeFilterCount,
  applyFilters,
  buildFacets,
  pruneFilters,
  sortWardrobe,
  toggleFilter
} from '../../src/services/wardrobeFilters';
import { GarmentItem } from '../../src/types/wardrobe';

function g(
  id: string,
  name: string,
  category: GarmentItem['category'],
  subcategory: string,
  color: string,
  hexColor: string,
  extra: Partial<GarmentItem> = {}
): GarmentItem {
  return {
    id, name, category, subcategory, color, hexColor,
    fabric: 'Cotton', seasons: [], formality: 'casual',
    imageUrl: '', favorite: false, wearCount: 0, dateAdded: '2026-10-01', tags: [],
    ...extra
  };
}

const NOW = Date.parse('2026-10-24T12:00:00Z');

const W: GarmentItem[] = [
  g('bomber', 'Navy Bomber', 'outerwear', 'Bomber Jacket', 'Navy', '#1F2A44', { size: 'L', storageLocation: 'Main almirah (bedroom)' }),
  g('denim_jacket', 'Washed Denim Jacket', 'outerwear', 'Denim Jacket', 'Washed Indigo', '#3B4F7A', { fabric: 'Cotton Denim', size: 'M' }),
  g('trucker', 'Everyday Trucker', 'outerwear', 'Jacket', 'Mystery', '#2E5FA8'), // blue only by its swatch
  g('black_leather', 'Black Leather Jacket', 'outerwear', 'Biker Jacket', 'Black', '#111111', { fabric: 'Leather' }),
  g('trench', 'Blue Trench', 'outerwear', 'Trench Coat', 'Blue', '#2F4E86'),
  g('blue_tee', 'Sky Tee', 'tops', 'T-Shirt', 'Sky Blue', '#87CEEB', { size: 'M', wearCount: 7, lastWornDate: '2026-10-20' }),
  g('white_shirt', 'White Oxford Shirt', 'tops', 'Oxford Shirt', 'White', '#FFFFFF', { size: 'M', formality: 'smart_casual', favorite: true, storageLocation: 'Main almirah (bedroom)' }),
  g('olive_hoodie', 'Olive Zip Hoodie', 'tops', 'Hoodie', 'Olive', '#556B2F', { size: 'L', wearCount: 1, lastWornDate: '2026-08-01', seasons: ['winter'] }),
  g('jeans', 'Straight Jeans', 'bottoms', 'Jeans', 'Denim Blue', '#4A6FA5', { size: '32' }),
  g('chinos', 'Beige Chinos', 'bottoms', 'Chinos', 'Beige', '#D8C3A5', { size: '30' }),
  g('sneakers', 'White Leather Sneakers', 'shoes', 'Sneakers', 'White', '#FAFAFA', { size: 'UK 9' })
];

const names = (items: GarmentItem[]) => items.map((i) => i.id);

test('"blue jacket" finds every blue jacket, whatever its type or colour name', () => {
  const r = names(searchWardrobe(W, 'my blue jacket'));
  assert.deepEqual([...r].sort(), ['bomber', 'denim_jacket', 'trucker'].sort());
  assert.ok(!r.includes('black_leather'), 'not blue');
  assert.ok(!r.includes('trench'), 'a trench is a coat, not a jacket');
  assert.ok(!r.includes('blue_tee'), 'not a jacket');
  assert.deepEqual(describeSearch('my blue jacket'), ['Blue shades', 'Jackets (any type)']);
});

test('colour families come from the colour name first, the swatch second', () => {
  assert.deepEqual(colorFamiliesOf(W[0]), ['blue']); // Navy
  assert.deepEqual(colorFamiliesOf(W[2]), ['blue']); // "Mystery" + blue hex
  assert.deepEqual(colorFamiliesOf({ color: 'Grey Olive', hexColor: '#777' }).sort(), ['green', 'grey']);
  assert.deepEqual(colorFamiliesOf({ color: 'Burgundy', hexColor: '' }), ['red']);
});

test('type words cover the whole type; "shirt" leaves T-shirts out', () => {
  assert.deepEqual(names(searchWardrobe(W, 'pants')).sort(), ['chinos', 'jeans']);
  assert.deepEqual(names(searchWardrobe(W, 'shoes')), ['sneakers']);
  assert.deepEqual(names(searchWardrobe(W, 'shirt')), ['white_shirt']);
  assert.deepEqual(names(searchWardrobe(W, 't-shirt')), ['blue_tee']);
});

test('plain text still matches fabric, size and place; nonsense matches nothing', () => {
  assert.deepEqual(names(searchWardrobe(W, 'leather')).sort(), ['black_leather', 'sneakers']);
  assert.ok(names(searchWardrobe(W, 'almirah')).includes('white_shirt'));
  assert.deepEqual(searchWardrobe(W, 'xyzzy'), []);
  assert.equal(searchWardrobe(W, '  show me my  ').length, W.length, 'filler words alone do not filter');
});

test('name matches rank first', () => {
  assert.equal(searchWardrobe(W, 'white')[0].id, 'white_shirt');
});

test('facets are built from the section in view, with counts', () => {
  const tops = W.filter((i) => i.category === 'tops');
  const facets = buildFacets(tops, NOW);
  const byKey = Object.fromEntries(facets.map((f) => [f.key, f]));
  assert.deepEqual(byKey.type.options.map((o) => o.label).sort(), ['Hoodie', 'Oxford Shirt', 'T-Shirt']);
  assert.deepEqual(byKey.size.options.map((o) => `${o.value}:${o.count}`), ['M:2', 'L:1']);
  assert.ok(byKey.place, "where it's kept is offered once a top has a place");
  assert.ok(byKey.wear.options.some((o) => o.value === 'forgotten'), 'hoodie last worn in August');
  assert.ok(!byKey.fabric, 'all cotton — a fabric filter could not narrow anything');
});

test('filters: OR inside a facet, AND across facets; stale selections are pruned', () => {
  let state = toggleFilter({}, 'color', 'blue');
  state = toggleFilter(state, 'color', 'white');
  assert.deepEqual(names(applyFilters(W, state, NOW)).sort(), ['blue_tee', 'bomber', 'denim_jacket', 'jeans', 'sneakers', 'trench', 'trucker', 'white_shirt'].sort());
  state = toggleFilter(state, 'size', 'M');
  assert.deepEqual(names(applyFilters(W, state, NOW)).sort(), ['blue_tee', 'denim_jacket', 'white_shirt']);
  assert.equal(activeFilterCount(state), 3);

  const bottoms = W.filter((i) => i.category === 'bottoms');
  const pruned = pruneFilters({ ...state, type: ['hoodie'] }, buildFacets(bottoms, NOW));
  assert.equal(pruned.type, undefined, 'a top type does not linger on Bottoms');
  assert.equal(pruned.size, undefined, 'no bottom is size M');

  const chips = activeFilterChips(state, buildFacets(W, NOW));
  assert.deepEqual(chips.map((c) => c.label), ['Blue & navy', 'White & cream', 'M']);
  assert.deepEqual(toggleFilter(toggleFilter({}, 'fit', 'slim'), 'fit', 'slim'), {});
});

test('sorting', () => {
  assert.equal(sortWardrobe(W, 'most_worn')[0].id, 'blue_tee');
  assert.equal(sortWardrobe(W, 'name')[0].id, 'chinos');
  assert.deepEqual(sortWardrobe(W, 'relevance'), W);
});
