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

export interface ValidatedAIOutfit {
  valid: boolean;
  reason?: string;
  items: GarmentItem[];
  /** How many ids the model returned that are NOT in the user's (available)
   *  wardrobe. Callers treat > 0 as an invented outfit and reject it. */
  droppedIds: number;
  outfitName: string;
  vibe: string;
  /** The model's own match % (0 when it gave none — never a default). */
  styleMatch: number;
  whyItWorks: {
    color: string;
    fit: string;
    occasion: string;
    overall: string;
  };
  missingCategories?: GarmentCategory[];
}

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Strict validation of AI outfit output:
 * 1. Status must be success with an id array.
 * 2. Every returned garmentId must exist in the wardrobe passed in (the
 *    caller passes only AVAILABLE pieces); unknown ids are counted, not shown.
 * 3. Duplicate ids are removed.
 * 4. Text fields are type-checked and length-capped.
 * No invented numbers or canned copy: missing fields stay empty.
 */
export function validateAIOutfitResponse(raw: RawAIOutfitResponse, availableWardrobe: GarmentItem[]): ValidatedAIOutfit {
  const base = {
    items: [] as GarmentItem[],
    droppedIds: 0,
    outfitName: text(raw?.outfitName, 80),
    vibe: text(raw?.vibe, 60),
    styleMatch: 0,
    whyItWorks: { color: '', fit: '', occasion: '', overall: '' }
  };

  if (!raw || raw.status === 'insufficient_wardrobe' || !Array.isArray(raw.garmentIds)) {
    return { ...base, valid: false, reason: 'AI indicated the wardrobe is insufficient for this request' };
  }

  const wardrobeMap = new Map<string, GarmentItem>();
  availableWardrobe.forEach((item) => wardrobeMap.set(item.id, item));

  const items: GarmentItem[] = [];
  const seenIds = new Set<string>();
  let droppedIds = 0;

  for (const id of raw.garmentIds) {
    if (!id || typeof id !== 'string') {
      droppedIds += 1;
      continue;
    }
    if (seenIds.has(id)) continue;
    const item = wardrobeMap.get(id);
    if (item) {
      items.push(item);
      seenIds.add(id);
    } else {
      droppedIds += 1;
      console.warn(`[AI Validation] Model returned unknown garmentId "${id}". Rejecting invented item.`);
    }
  }

  if (items.length === 0) {
    return { ...base, droppedIds, valid: false, reason: 'Model returned no valid garment IDs from user closet' };
  }

  const color = text(raw.whyItWorks?.color, 300);
  const fit = text(raw.whyItWorks?.fit, 300);
  const occasion = text(raw.whyItWorks?.occasion, 300);
  const overall = text(raw.whyItWorks?.overall, 500) || [color, fit, occasion].filter(Boolean).join(' ');
  const styleMatch =
    typeof raw.styleMatch === 'number' && Number.isFinite(raw.styleMatch) ? Math.round(Math.max(0, Math.min(100, raw.styleMatch))) : 0;

  return {
    valid: true,
    items,
    droppedIds,
    outfitName: base.outfitName || 'Your look',
    vibe: base.vibe,
    styleMatch,
    whyItWorks: { color, fit, occasion, overall }
  };
}
