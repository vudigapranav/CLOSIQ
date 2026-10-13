/**
 * "Where is it kept?" — places at home a garment can live, named the way an
 * Indian household actually talks about them. Shared by web and mobile (the
 * mobile app imports this through metro's widened watchFolders).
 *
 * The stored value is the plain label string, so a preset renamed here won't
 * break existing rows (they just show as a custom place). Custom places are
 * free text, capped at STORAGE_LOCATION_MAX_LENGTH to match the
 * `garments.storage_location` DB check.
 */

export interface StorageLocationGroup {
  label: string;
  options: string[];
}

export const STORAGE_LOCATION_GROUPS: StorageLocationGroup[] = [
  {
    label: 'Almirahs & cupboards',
    options: [
      'Main almirah (bedroom)',
      'Godrej steel almirah',
      'Wooden almirah',
      'Wall wardrobe',
      'Sliding wardrobe',
      "Kids' room cupboard",
      "Parents' room almirah",
      "Dadi / Nani's room almirah",
      'Guest room cupboard',
      'Hall cupboard'
    ]
  },
  {
    label: 'Drawers, boxes & storage',
    options: [
      'Diwan / bed box storage',
      'Under-bed storage',
      'Loft (above the cupboard)',
      'Trunk / peti',
      'Suitcase',
      'Saree cabinet',
      'Dressing table drawer',
      'Chest of drawers',
      'Puja room shelf',
      'Shoe rack',
      'Shoe cabinet near the door'
    ]
  },
  {
    label: 'Out for care',
    options: [
      'Laundry basket',
      'Washing machine',
      'Drying on the balcony / clothesline',
      'With the dhobi',
      'With the istriwala (ironing)',
      'With the darzi (tailor)',
      'At the dry cleaner'
    ]
  },
  {
    label: 'Away from home',
    options: [
      'Native place / village home',
      "Nani's / Dadi's house",
      "Relative's house",
      'Hostel / PG room',
      'Office locker',
      'Car'
    ]
  }
];

export const ALL_STORAGE_LOCATIONS: string[] = STORAGE_LOCATION_GROUPS.flatMap((g) => g.options);

export const STORAGE_LOCATION_MAX_LENGTH = 80;

export function isPresetStorageLocation(value: string | undefined): boolean {
  return !!value && ALL_STORAGE_LOCATIONS.includes(value);
}

/** Trimmed, length-capped place, or undefined when empty. */
export function normalizeStorageLocation(value: string | undefined | null): string | undefined {
  const trimmed = (value || '').trim().replace(/\s+/g, ' ').slice(0, STORAGE_LOCATION_MAX_LENGTH);
  return trimmed || undefined;
}

/** Custom places this user has already typed (not presets), most-used first,
 *  so they appear in the picker as "Your places" next time. */
export function customStorageLocations(items: { storageLocation?: string }[]): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const place = normalizeStorageLocation(item.storageLocation);
    if (place && !isPresetStorageLocation(place)) counts.set(place, (counts.get(place) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([place]) => place);
}

/** Every place actually used in this wardrobe (presets + custom), for filters. */
export function usedStorageLocations(items: { storageLocation?: string }[]): string[] {
  const seen = new Set<string>();
  for (const item of items) {
    const place = normalizeStorageLocation(item.storageLocation);
    if (place) seen.add(place);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}
