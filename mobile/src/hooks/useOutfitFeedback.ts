import { useCallback, useEffect, useState } from 'react';
import { OutfitRating } from '../../../src/types/wardrobe';
import { getCachedRating, rateOutfit } from '../services/outfitFeedbackStorage';

/**
 * The rating shown on an outfit card, for the CURRENT garment combination.
 * Resets (and re-reads any earlier rating of the same combination) whenever
 * the outfit on screen changes. Shared by Home, AI Stylist and Planner.
 */
export function useOutfitFeedback(garmentIds: string[] | undefined, occasion: string) {
  const [rating, setRating] = useState<OutfitRating | null>(null);
  const key = garmentIds && garmentIds.length > 0 ? [...garmentIds].sort().join('|') : '';

  useEffect(() => {
    let active = true;
    setRating(null);
    if (!key) return;
    getCachedRating(key.split('|')).then((r) => {
      if (active) setRating(r);
    });
    return () => {
      active = false;
    };
  }, [key]);

  const rate = useCallback(
    async (next: OutfitRating) => {
      if (!key) return;
      setRating(next);
      await rateOutfit(key.split('|'), next, occasion);
    },
    [key, occasion]
  );

  return { rating, rate };
}
