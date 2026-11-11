/**
 * Wardrobe analytics (2026-11-11) — shared web/mobile, pure.
 *
 * Every figure is computed from the user's own persisted data: garment
 * `wearCount` / `lastWornDate` / `availability` and the looks they marked as
 * worn. Nothing is estimated or invented — with no data a metric is null or
 * an empty list, and the UI says so.
 */
import { GarmentItem, Outfit, isGarmentAvailable } from '../../types/wardrobe';
import { colorFamiliesOf, colorFamilyLabel } from '../wardrobeSearch';

export interface WornPiece {
  item: GarmentItem;
  wearCount: number;
}

export interface LeastUsedPiece {
  item: GarmentItem;
  /** Whole days since last worn, or null when never worn. */
  daysSinceWorn: number | null;
}

export interface FrequentPair {
  a: GarmentItem;
  b: GarmentItem;
  /** Number of worn looks containing both pieces. */
  count: number;
}

export interface Distribution {
  key: string;
  label: string;
  count: number;
  /** Share of the pieces counted, 0-100 (rounded). */
  percent: number;
}

export interface WardrobeAnalytics {
  totalItems: number;
  wornLooks: number;
  mostWorn: WornPiece[];
  leastUsed: LeastUsedPiece[];
  frequentPairs: FrequentPair[];
  categoryDistribution: Distribution[];
  colourDistribution: Distribution[];
  /** % of pieces worn in the last 30 days; null when the wardrobe is empty. */
  utilisation30d: number | null;
  /** % of pieces ever worn; null when the wardrobe is empty. */
  utilisationEver: number | null;
  /** Looks that repeat an earlier worn look's exact combination; null with no worn looks. */
  repetition: { repeatedLooks: number; wornLooks: number; distinctCombos: number } | null;
  availability: { available: number; laundry: number; unavailable: number };
}

const DAY_MS = 86_400_000;
const STALE_DAYS = 60;

function parseDay(value: string | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(t) ? null : t;
}

const daysBetween = (from: number, to: number) => Math.floor((to - from) / DAY_MS);

function distribution(counts: Map<string, number>, labelOf: (key: string) => string): Distribution[] {
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  return [...counts.entries()]
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .map(([key, count]) => ({ key, label: labelOf(key), count, percent: Math.round((count / total) * 100) }));
}

export function mostWorn(items: GarmentItem[], limit = 5): WornPiece[] {
  return items
    .filter((i) => i.wearCount > 0)
    .sort((a, b) => b.wearCount - a.wearCount || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((item) => ({ item, wearCount: item.wearCount }));
}

/** Never worn, or not worn for 60+ days. Never-worn pieces are ordered by
 *  when they were added (oldest first); worn ones by longest unworn. */
export function leastUsed(items: GarmentItem[], now: number = Date.now(), limit = 5): LeastUsedPiece[] {
  const rows: (LeastUsedPiece & { sortKey: number })[] = [];
  for (const item of items) {
    const last = item.wearCount > 0 || item.lastWornDate ? parseDay(item.lastWornDate) : null;
    if (last === null) {
      rows.push({ item, daysSinceWorn: null, sortKey: parseDay(item.dateAdded) ?? now });
    } else {
      const days = daysBetween(last, now);
      if (days >= STALE_DAYS) rows.push({ item, daysSinceWorn: days, sortKey: last });
    }
  }
  return rows
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(0, limit)
    .map(({ item, daysSinceWorn }) => ({ item, daysSinceWorn }));
}

export function wornLooksOnly(outfits: Outfit[]): Outfit[] {
  return outfits.filter((o) => o.status === 'worn');
}

const idsKey = (o: Outfit) => o.items.map((i) => i.id).sort().join('|');

export function frequentPairs(worn: Outfit[], limit = 3): FrequentPair[] {
  const pairs = new Map<string, { a: GarmentItem; b: GarmentItem; count: number }>();
  for (const look of worn) {
    const uniq = [...new Map(look.items.map((i) => [i.id, i])).values()].sort((x, y) => x.id.localeCompare(y.id));
    for (let i = 0; i < uniq.length; i++) {
      for (let j = i + 1; j < uniq.length; j++) {
        const key = `${uniq[i].id}::${uniq[j].id}`;
        const hit = pairs.get(key);
        if (hit) hit.count++;
        else pairs.set(key, { a: uniq[i], b: uniq[j], count: 1 });
      }
    }
  }
  // A pair seen once is a coincidence, not a habit.
  return [...pairs.values()]
    .filter((p) => p.count >= 2)
    .sort((x, y) => y.count - x.count || x.a.name.localeCompare(y.a.name))
    .slice(0, limit);
}

export function categoryDistribution(items: GarmentItem[]): Distribution[] {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);
  return distribution(counts, (k) => k);
}

/** Groups by colour family (a "Grey Olive" piece counts toward its first family). */
export function colourDistribution(items: GarmentItem[]): Distribution[] {
  const counts = new Map<string, number>();
  for (const i of items) {
    const family = colorFamiliesOf(i)[0] ?? 'other';
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  return distribution(counts, (k) => (k === 'other' ? 'Other' : colorFamilyLabel(k)));
}

export function computeWardrobeAnalytics(
  items: GarmentItem[],
  outfits: Outfit[],
  now: number = Date.now()
): WardrobeAnalytics {
  const worn = wornLooksOnly(outfits);
  const total = items.length;

  const recent = items.filter((i) => {
    const t = parseDay(i.lastWornDate);
    return t !== null && daysBetween(t, now) <= 30;
  }).length;
  const ever = items.filter((i) => i.wearCount > 0).length;

  let repetition: WardrobeAnalytics['repetition'] = null;
  if (worn.length > 0) {
    const distinct = new Set(worn.map(idsKey)).size;
    repetition = { repeatedLooks: worn.length - distinct, wornLooks: worn.length, distinctCombos: distinct };
  }

  const availability = { available: 0, laundry: 0, unavailable: 0 };
  for (const i of items) {
    if (isGarmentAvailable(i)) availability.available++;
    else if (i.availability === 'laundry') availability.laundry++;
    else availability.unavailable++;
  }

  return {
    totalItems: total,
    wornLooks: worn.length,
    mostWorn: mostWorn(items),
    leastUsed: leastUsed(items, now),
    frequentPairs: frequentPairs(worn),
    categoryDistribution: categoryDistribution(items),
    colourDistribution: colourDistribution(items),
    utilisation30d: total ? Math.round((recent / total) * 100) : null,
    utilisationEver: total ? Math.round((ever / total) * 100) : null,
    repetition,
    availability
  };
}
