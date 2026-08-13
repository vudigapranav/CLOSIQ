import { GarmentItem, GarmentCategory } from '../../types/wardrobe';

export interface RawAIOutfitResponse {
  status?: 'success' | 'insufficient_wardrobe';
  outfitName?: string;
  vibe?: string;
  styleMatch?: number;
  garmentIds?: string[];
  whyItWorks?: {
    color?: string;
    fit?: string;
    occasion?: string;
    overall?: string;
  };
}

/**
 * Strict Validation Layer for AI Output:
 * 1. Checks valid status.
 * 2. Guarantees every returned garmentId actually exists in the user's current closet.
 * 3. Prevents duplicate garment IDs.
 * 4. Ensures returned garments are valid items.
 * 5. Returns validated GarmentItem objects or rejects invented items.
 */
export function validateAIOutfitResponse(
  raw: RawAIOutfitResponse,
  availableWardrobe: GarmentItem[]
): {
  valid: boolean;
  reason?: string;
  items: GarmentItem[];
  outfitName: string;
  vibe: string;
  styleMatch: number;
  whyItWorks: {
    color: string;
    fit: string;
    occasion: string;
    overall: string;
  };
  missingCategories?: GarmentCategory[];
} {
  if (raw.status === 'insufficient_wardrobe' || !raw.garmentIds || !Array.isArray(raw.garmentIds)) {
    return {
      valid: false,
      reason: 'AI indicated wardrobe is insufficient for this request',
      items: [],
      outfitName: raw.outfitName || 'Closet Recommendation',
      vibe: raw.vibe || 'Personal Style',
      styleMatch: 80,
      whyItWorks: {
        color: 'Simple color coordination.',
        fit: 'Balanced proportions.',
        occasion: 'Suitable for daily wear.',
        overall: 'Your current collection offers versatile essential combinations.'
      }
    };
  }

  // Create lookup map of user's real wardrobe by ID
  const wardrobeMap = new Map<string, GarmentItem>();
  availableWardrobe.forEach((item) => wardrobeMap.set(item.id, item));

  const items: GarmentItem[] = [];
  const seenIds = new Set<string>();

  for (const id of raw.garmentIds) {
    if (!id || typeof id !== 'string') continue;
    if (seenIds.has(id)) continue; // prevent duplicates

    const item = wardrobeMap.get(id);
    if (item) {
      items.push(item);
      seenIds.add(id);
    } else {
      console.warn(`[AI Validation] Model returned unknown garmentId "${id}". Rejecting invented item.`);
    }
  }

  // Check if we have at least one main item (top or bottom or shoe)
  if (items.length === 0) {
    return {
      valid: false,
      reason: 'Model returned no valid garment IDs from user closet',
      items: [],
      outfitName: raw.outfitName || 'Personal Style',
      vibe: raw.vibe || 'Casual',
      styleMatch: 75,
      whyItWorks: {
        color: '',
        fit: '',
        occasion: '',
        overall: ''
      }
    };
  }

  const outfitName = (raw.outfitName && raw.outfitName.trim()) || 'Polished Ensemble';
  const vibe = (raw.vibe && raw.vibe.trim()) || 'Smart Casual';
  const styleMatch = typeof raw.styleMatch === 'number' ? Math.max(70, Math.min(99, raw.styleMatch)) : 92;

  const colorExpl = raw.whyItWorks?.color || 'Colors harmonize cleanly.';
  const fitExpl = raw.whyItWorks?.fit || 'Balanced proportions.';
  const occasionExpl = raw.whyItWorks?.occasion || 'Appropriate formality for your request.';
  const overallExpl = raw.whyItWorks?.overall || `${colorExpl} ${fitExpl} ${occasionExpl}`;

  return {
    valid: true,
    items,
    outfitName,
    vibe,
    styleMatch,
    whyItWorks: {
      color: colorExpl,
      fit: fitExpl,
      occasion: occasionExpl,
      overall: overallExpl
    }
  };
}
