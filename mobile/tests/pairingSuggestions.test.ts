/**
 * "Pairs well with" (2026-10-16). The user's ask: open a T-shirt and see
 * which of your pants suit it; open pants and see the tops — always from the
 * clothes you actually own.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyPairingHint, suggestPairings } from '../../src/services/pairingSuggestions';
import { buildOutfitBrain, comboSignature } from '../../src/services/outfitBrain';
import { GarmentItem } from '../../src/types/wardrobe';

function g(
  id: string,
  category: GarmentItem['category'],
  formality: GarmentItem['formality'],
  color: string,
  hexColor: string,
  extra: Partial<GarmentItem> = {}
): GarmentItem {
  return {
    id, name: id, category, formality, color, hexColor,
    subcategory: category, fabric: 'Cotton', seasons: [],
    imageUrl: '', favorite: false, wearCount: 0, dateAdded: '2026-10-16', tags: [],
    ...extra
  };
}

const tee = g('white_tee', 'tops', 'casual', 'White', '#FFFFFF', { subcategory: 'T-Shirt' });
const W = [
  tee,
  g('red_tee', 'tops', 'casual', 'Red', '#C0392B', { subcategory: 'T-Shirt' }),
  g('blazer', 'outerwear', 'formal', 'Navy', '#1F2A44', { layeringRole: 'outer_layer' }),
  g('tank', 'tops', 'casual', 'Black', '#111111', { layeringRole: 'base_layer' }),
  g('jeans', 'bottoms', 'casual', 'Indigo', '#2E3A59', { subcategory: 'Jeans' }),
  g('chinos', 'bottoms', 'smart_casual', 'Beige', '#D8C3A5', { subcategory: 'Chinos' }),
  g('suit_trousers', 'bottoms', 'evening', 'Black', '#111111'),
  g('green_cargo', 'bottoms', 'casual', 'Green', '#2E8B57'),
  g('churidar', 'bottoms', 'casual', 'White', '#F5F5F5', { subcategory: 'Churidar' }),
  g('sneakers', 'shoes', 'casual', 'White', '#FAFAFA'),
  g('oxfords', 'shoes', 'formal', 'Brown', '#5C3A21'),
  g('dress', 'tops', 'smart_casual', 'Blue', '#2F6FB0', { subcategory: 'Dress' })
];

test('a T-shirt gets bottoms first, then footwear — only pieces the user owns', () => {
  const groups = suggestPairings(tee, W);
  assert.deepEqual(groups.map((x) => x.category), ['bottoms', 'shoes']);
  const ids = new Set(W.map((x) => x.id));
  for (const group of groups) {
    assert.ok(group.suggestions.length <= 3);
    for (const s of group.suggestions) {
      assert.ok(ids.has(s.item.id));
      assert.equal(s.item.category, group.category);
      assert.ok(s.reason.length > 0);
    }
  }
  const bottoms = groups[0].suggestions.map((s) => s.item.id);
  assert.equal(bottoms[0], 'jeans', 'casual neutral jeans suit a casual white tee best');
  assert.ok(!bottoms.includes('churidar'), 'ethnic-only bottoms are not suggested under a western tee');
  assert.ok(!bottoms.includes('dress'));
});

test('bottoms get tops, never a dress, and an evening trouser does not top the list for a casual tee', () => {
  const groups = suggestPairings(W.find((x) => x.id === 'jeans')!, W);
  assert.equal(groups[0].category, 'tops');
  const tops = groups[0].suggestions.map((s) => s.item.id);
  assert.ok(!tops.includes('dress'));
  assert.ok(!tops.includes('jeans'));
  const forTee = suggestPairings(tee, W)[0].suggestions.map((s) => s.item.id);
  assert.notEqual(forTee[0], 'suit_trousers');
});

test('a dress is not paired with bottoms; it gets footwear and a layer', () => {
  const groups = suggestPairings(W.find((x) => x.id === 'dress')!, W);
  assert.deepEqual(groups.map((x) => x.category), ['shoes', 'outerwear']);
});

test('under a jacket, "avoid base layers" keeps the tank top out', () => {
  const blazer = W.find((x) => x.id === 'blazer')!;
  const avoid = suggestPairings(blazer, W, { layeringPreference: 'avoid', limit: 10 })[0].suggestions.map((s) => s.item.id);
  assert.ok(!avoid.includes('tank'));
});

test('a combination the user loved ranks first', () => {
  const brain = buildOutfitBrain([
    { signature: comboSignature(['white_tee', 'green_cargo']), garmentIds: ['white_tee', 'green_cargo'], rating: 'nice', updatedAt: '2026-10-16' }
  ]);
  const top = suggestPairings(tee, W, { brain })[0].suggestions[0];
  assert.equal(top.item.id, 'green_cargo');
  assert.equal(top.reason, 'You loved these together');
});

test('an empty category gives an honest hint instead of an invented suggestion', () => {
  const groups = suggestPairings(tee, [tee]);
  assert.ok(groups.every((x) => x.suggestions.length === 0));
  assert.match(emptyPairingHint(groups), /Add bottoms or footwear/);
});

test('suggestions are stable across calls', () => {
  assert.deepEqual(
    suggestPairings(tee, W).map((x) => x.suggestions.map((s) => s.item.id)),
    suggestPairings(tee, [...W].reverse()).map((x) => x.suggestions.map((s) => s.item.id))
  );
});
