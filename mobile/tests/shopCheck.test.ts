/**
 * Shop Check (2026-11-01). The user's ask: "I'm in a shop and see a light
 * yellow T-shirt — which of my pants would go with it? Tell me: brown pants,
 * black pants, blue jeans…" Everything recommended must be something the
 * user already owns; the scanned piece is judged, never added.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { runShopCheck, shopCandidate, SHOP_CHECK_CANDIDATE_ID } from '../../src/services/shopCheck';
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

const WARDROBE: GarmentItem[] = [
  g('brown_chinos', 'Brown Chinos', 'bottoms', 'Chinos', 'Brown', '#6B4A2F'),
  g('black_trousers', 'Black Trousers', 'bottoms', 'Trousers', 'Black', '#111111'),
  g('black_jeans', 'Black Jeans', 'bottoms', 'Jeans', 'Black', '#1A1A1A'),
  g('blue_jeans', 'Blue Jeans', 'bottoms', 'Jeans', 'Denim Blue', '#4A6FA5'),
  g('white_sneakers', 'White Sneakers', 'shoes', 'Sneakers', 'White', '#FAFAFA'),
  g('brown_loafers', 'Brown Loafers', 'shoes', 'Loafers', 'Brown', '#5C3A21'),
  g('white_tee', 'White Tee', 'tops', 'T-Shirt', 'White', '#FFFFFF'),
  g('black_tee', 'Black Tee', 'tops', 'T-Shirt', 'Black', '#111111'),
  g('grey_tee', 'Grey Graphic Tee', 'tops', 'Graphic Tee', 'Grey', '#888888', { style: 'Streetwear Essential' })
];

const yellowTee = shopCandidate({
  name: 'Light Yellow Crew Tee', category: 'tops', subcategory: 'T-Shirt', color: 'Light Yellow', hexColor: '#F6E7A1',
  fabric: 'Cotton Jersey', fit: 'Regular', formality: 'casual'
});

test('the light-yellow tee: "wear it with your brown, black or blue" — spread across colours, all owned', () => {
  const r = runShopCheck(yellowTee, WARDROBE);
  const bottoms = r.wearWith.find((w) => w.category === 'bottoms')!;
  const firstThree = bottoms.suggestions.slice(0, 3).map((s) => s.item.id);
  // Two black bottoms exist; diversity puts brown, black and blue in the first three.
  assert.ok(firstThree.includes('brown_chinos'), firstThree.join());
  assert.ok(firstThree.includes('blue_jeans'), firstThree.join());
  assert.ok(firstThree.some((id) => id === 'black_trousers' || id === 'black_jeans'), firstThree.join());
  assert.match(bottoms.sentence, /^Wear it with your .+\.$/);
  assert.ok(['great', 'good'].includes(r.verdict));
  assert.match(r.stylingTips[0], /light yellow/i);
});

test('outfits use only owned pieces, never the scanned one, each with a different main partner', () => {
  const r = runShopCheck(yellowTee, WARDROBE);
  assert.ok(r.outfits.length >= 2);
  const owned = new Set(WARDROBE.map((i) => i.id));
  for (const o of r.outfits) {
    assert.ok(o.items.every((i) => owned.has(i.id)));
    assert.ok(!o.items.some((i) => i.id === SHOP_CHECK_CANDIDATE_ID));
    assert.deepEqual(o.items.map((i) => i.category).sort(), ['bottoms', 'shoes']);
  }
  const leads = r.outfits.map((o) => o.items[0].id);
  assert.equal(new Set(leads).size, leads.length);
});

test('a near-twin of something owned is flagged; two twins means think twice', () => {
  const blackTee = shopCandidate({ name: 'Black Basic Tee', category: 'tops', subcategory: 'T-Shirt', color: 'Black', hexColor: '#0F0F0F', fabric: 'Cotton', fit: 'Regular', formality: 'casual' });
  const one = runShopCheck(blackTee, WARDROBE);
  assert.deepEqual(one.similarOwned.map((i) => i.id), ['black_tee']);
  assert.notEqual(one.verdict, 'great');

  const two = runShopCheck(blackTee, [...WARDROBE, g('black_tee_2', 'Washed Black Tee', 'tops', 'T-Shirt', 'Washed Black', '#222222')]);
  assert.equal(two.verdict, 'think_twice');
  assert.ok(two.points.some((p) => p.tone === 'warn' && /very similar/.test(p.text)));
});

test('a first piece of a new colour, or a missing category, counts as filling a gap', () => {
  const r = runShopCheck(yellowTee, WARDROBE);
  assert.ok(r.points.some((p) => p.tone === 'good' && /Your first yellow T-shirt/.test(p.text)), JSON.stringify(r.points));

  const noShoes = WARDROBE.filter((i) => i.category !== 'shoes');
  const boots = shopCandidate({ name: 'Tan Boots', category: 'shoes', subcategory: 'Boots', color: 'Tan', hexColor: '#C19A6B', fabric: 'Leather', fit: '', formality: 'casual' });
  assert.ok(runShopCheck(boots, noShoes).points.some((p) => /don't own any footwear yet/.test(p.text)));
});

test('style DNA: matches the streetwear user, honest when there is nothing to compare', () => {
  const graphic = shopCandidate({ name: 'Navy Graphic Tee', category: 'tops', subcategory: 'Graphic Tee', color: 'Navy', hexColor: '#1F2A44', fabric: 'Cotton', fit: 'Oversized', formality: 'casual', style: 'Streetwear' });
  assert.equal(runShopCheck(graphic, WARDROBE, { stylePreferences: ['streetwear'] }).styleFit.level, 'strong');

  const empty = runShopCheck(yellowTee, []);
  assert.equal(empty.verdict, 'unknown');
  assert.equal(empty.wearWith.length, 0);
  assert.equal(empty.outfits.length, 0);
});

test('no bottoms to finish a look → says so, and offers a clearly-labelled future idea', () => {
  const r = runShopCheck(yellowTee, WARDROBE.filter((i) => i.category !== 'bottoms'));
  assert.equal(r.outfits.length, 0);
  assert.ok(r.points.some((p) => p.tone === 'warn' && /need bottoms/.test(p.text)), JSON.stringify(r.points));
  assert.match(r.lookFor ?? '', /^Future idea:/);
});
