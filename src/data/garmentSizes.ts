import { GarmentCategory } from '../types/wardrobe';

/**
 * Size presets per category, matching how sizes are actually labelled in
 * Indian stores: letter sizes, shirt chest/collar sizes (38, 40, 42…), waist
 * sizes for trousers and jeans, UK/India shoe sizes, and "Free size" for
 * sarees, dupattas, stoles and most accessories. Anything else is free text.
 * Shared by web and mobile. Stored as the plain label string.
 */

export interface SizeGroup {
  label: string;
  options: string[];
}

const LETTER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const CHEST = ['36', '38', '40', '42', '44', '46'];
const WAIST = ['26', '28', '30', '32', '34', '36', '38', '40'];
const SHOE_UK = ['UK 3', 'UK 4', 'UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11', 'UK 12'];
const FREE = ['Free size'];

export const SIZE_GROUPS_BY_CATEGORY: Record<GarmentCategory, SizeGroup[]> = {
  tops: [
    { label: 'Letter', options: LETTER },
    { label: 'Chest / collar', options: CHEST },
    { label: 'Other', options: FREE }
  ],
  outerwear: [
    { label: 'Letter', options: LETTER },
    { label: 'Chest', options: CHEST }
  ],
  bottoms: [
    { label: 'Waist', options: WAIST },
    { label: 'Letter', options: LETTER },
    { label: 'Other', options: FREE }
  ],
  shoes: [{ label: 'UK / India', options: SHOE_UK }],
  accessories: [
    { label: 'Other', options: FREE },
    { label: 'Letter', options: ['S', 'M', 'L'] }
  ]
};

export const SIZE_MAX_LENGTH = 24;

export function sizeOptionsFor(category: GarmentCategory): string[] {
  return (SIZE_GROUPS_BY_CATEGORY[category] || []).flatMap((g) => g.options);
}

/** Trimmed, length-capped size, or undefined when empty. */
export function normalizeSize(value: string | undefined | null): string | undefined {
  const trimmed = (value || '').trim().replace(/\s+/g, ' ').slice(0, SIZE_MAX_LENGTH);
  return trimmed || undefined;
}
