/**
 * Style DNA honesty (2026-10-14): a new account must start at zero — no
 * invented "85% Minimalist" — and only the user's own clothes move the
 * scores. The archetype comes from onboarding answers until then.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStyleDna, styleArchetype } from '../../src/data/styleDna';
import { GarmentItem } from '../../src/types/wardrobe';

function item(overrides: Partial<GarmentItem>): GarmentItem {
  return {
    id: Math.random().toString(36).slice(2),
    name: 'Shirt',
    category: 'tops',
    subcategory: 'Shirt',
    color: 'Red',
    hexColor: '#f00',
    fabric: 'Cotton',
    seasons: [],
    formality: 'casual',
    imageUrl: '',
    favorite: false,
    wearCount: 0,
    dateAdded: '2026-10-14',
    tags: [],
    ...overrides
  };
}

test('a new account with no clothes scores 0 on every Style DNA axis', () => {
  const dna = computeStyleDna([]);
  assert.ok(dna.length > 0);
  for (const axis of dna) assert.equal(axis.score, 0, axis.label);
});

test('with no clothes, the archetype is the onboarding answers — or honestly "not discovered"', () => {
  assert.equal(styleArchetype([], ['minimal', 'streetwear']).source, 'preferences');
  assert.equal(styleArchetype([], ['minimal', 'streetwear']).name, 'Minimal + Streetwear');
  assert.equal(styleArchetype([], []).source, 'none');
});

test('scores are the share of the wardrobe showing each trait', () => {
  const wardrobe = [
    item({ name: 'White Kurta', color: 'White' }),
    item({ name: 'Navy Kurta', color: 'Navy' }),
    item({ name: 'Graphic Tee', color: 'Red' }),
    item({ name: 'Red Saree', color: 'Red', formality: 'evening' })
  ];
  const byKey = Object.fromEntries(computeStyleDna(wardrobe).map((a) => [a.key, a.score]));
  assert.equal(byKey.ethnic, 75);
  assert.equal(byKey.minimal, 50);
  assert.equal(byKey.street, 25);
  assert.equal(byKey.smart, 25);
  assert.equal(styleArchetype(wardrobe, ['minimal']).name, 'Indian Ethnic Edit');
});
