import test from 'node:test';
import assert from 'node:assert/strict';
import { computeWardrobeAnalytics, frequentPairs, leastUsed, mostWorn } from '../../src/services/intelligence/wardrobeAnalytics';
import { GarmentItem, Outfit } from '../../src/types/wardrobe';

const NOW = Date.parse('2026-11-11T12:00:00');

function g(id: string, category: GarmentItem['category'], color: string, extra: Partial<GarmentItem> = {}): GarmentItem {
  return {
    id, name: id, category, subcategory: 'x', color, hexColor: '#808080', fabric: 'Cotton', seasons: [],
    formality: 'casual' as GarmentItem['formality'], imageUrl: '', favorite: false, wearCount: 0,
    dateAdded: '2026-01-01', tags: [], ...extra
  };
}

function look(id: string, items: GarmentItem[], status: Outfit['status'] = 'worn'): Outfit {
  return { id, title: id, occasion: 'Casual', vibe: '', formalityLabel: '', items, styleScore: 0, saved: true, dateCreated: '', status } as unknown as Outfit;
}

test('empty wardrobe yields null/empty metrics, never invented numbers', () => {
  const a = computeWardrobeAnalytics([], [], NOW);
  assert.equal(a.utilisation30d, null);
  assert.equal(a.utilisationEver, null);
  assert.equal(a.repetition, null);
  assert.deepEqual(a.mostWorn, []);
  assert.deepEqual(a.leastUsed, []);
  assert.deepEqual(a.frequentPairs, []);
  assert.deepEqual(a.categoryDistribution, []);
  assert.deepEqual(a.colourDistribution, []);
});

test('mostWorn: only worn pieces, top 5 by count', () => {
  const items = [1, 2, 3, 4, 5, 6, 7].map((n) => g(`p${n}`, 'tops', 'Black', { wearCount: n === 7 ? 0 : n }));
  const top = mostWorn(items);
  assert.equal(top.length, 5);
  assert.equal(top[0].item.id, 'p6');
  assert.ok(!top.some((t) => t.item.id === 'p7'));
});

test('leastUsed: never worn and 60+ days stale, oldest first, capped', () => {
  const items = [
    g('never-old', 'tops', 'Black', { dateAdded: '2025-01-01' }),
    g('never-new', 'tops', 'Black', { dateAdded: '2026-10-01' }),
    g('stale', 'tops', 'Black', { wearCount: 3, lastWornDate: '2026-08-01' }),
    g('fresh', 'tops', 'Black', { wearCount: 3, lastWornDate: '2026-11-01' })
  ];
  const lu = leastUsed(items, NOW);
  assert.deepEqual(lu.map((l) => l.item.id), ['never-old', 'stale', 'never-new']);
  assert.equal(lu[0].daysSinceWorn, null);
  assert.equal(lu[1].daysSinceWorn, 102);
});

test('frequentPairs needs 2+ co-occurrences and ignores non-worn looks', () => {
  const a = g('a', 'tops', 'Black'), b = g('b', 'bottoms', 'Blue'), c = g('c', 'shoes', 'White');
  const pairs = frequentPairs([look('1', [a, b, c]), look('2', [a, b]), look('3', [a, c])]);
  assert.equal(pairs[0].count, 2);
  assert.deepEqual([pairs[0].a.id, pairs[0].b.id], ['a', 'b']);
  assert.equal(pairs.length, 2);
  const a2 = computeWardrobeAnalytics([a, b, c], [look('x', [a, b], 'try_later'), look('y', [a, b], 'try_later')], NOW);
  assert.deepEqual(a2.frequentPairs, []);
  assert.equal(a2.wornLooks, 0);
});

test('category and colour distribution use counts and colour families', () => {
  const items = [
    g('a', 'tops', 'Navy'), g('b', 'tops', 'Dark Blue'), g('c', 'bottoms', 'Charcoal'), g('d', 'shoes', 'White')
  ];
  const a = computeWardrobeAnalytics(items, [], NOW);
  assert.equal(a.categoryDistribution[0].key, 'tops');
  assert.equal(a.categoryDistribution[0].percent, 50);
  const blue = a.colourDistribution.find((c) => c.key === 'blue');
  assert.equal(blue?.count, 2);
  assert.ok(a.colourDistribution.find((c) => c.key === 'grey'));
});

test('utilisation uses lastWornDate within 30 days, and ever-worn from wearCount', () => {
  const items = [
    g('a', 'tops', 'Black', { wearCount: 2, lastWornDate: '2026-11-05' }),
    g('b', 'tops', 'Black', { wearCount: 1, lastWornDate: '2026-08-01' }),
    g('c', 'tops', 'Black'),
    g('d', 'tops', 'Black')
  ];
  const a = computeWardrobeAnalytics(items, [], NOW);
  assert.equal(a.utilisation30d, 25);
  assert.equal(a.utilisationEver, 50);
});

test('repetition counts worn looks repeating an identical combination', () => {
  const a = g('a', 'tops', 'Black'), b = g('b', 'bottoms', 'Blue'), c = g('c', 'tops', 'Red');
  const r = computeWardrobeAnalytics([a, b, c], [look('1', [a, b]), look('2', [b, a]), look('3', [c, b])], NOW).repetition;
  assert.deepEqual(r, { repeatedLooks: 1, wornLooks: 3, distinctCombos: 2 });
});

test('availability counts', () => {
  const items = [g('a', 'tops', 'Black'), g('b', 'tops', 'Black', { availability: 'laundry' }), g('c', 'tops', 'Black', { availability: 'unavailable' })];
  assert.deepEqual(computeWardrobeAnalytics(items, [], NOW).availability, { available: 1, laundry: 1, unavailable: 1 });
});
