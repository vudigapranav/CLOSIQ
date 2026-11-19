import { comboSignature, type OutfitFeedback } from '../../../src/services/outfitBrain';
import type { OutfitRating } from '../../../src/types/wardrobe';
import { list, put } from '../local/store';
export const loadOutfitFeedback = () => list<OutfitFeedback>('feedback');
export async function getCachedRating(ids: string[]) {
  return (await loadOutfitFeedback()).find((row) => row.signature === comboSignature(ids))?.rating ?? null;
}
export async function rateOutfit(ids: string[], rating: OutfitRating, occasion?: string) {
  const signature = comboSignature(ids);
  await put('feedback', 'device', signature, {
    signature,
    garmentIds: ids,
    rating,
    occasion,
    updatedAt: new Date().toISOString()
  });
  return true;
}
