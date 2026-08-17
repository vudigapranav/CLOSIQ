import { GarmentItem, GarmentCategory, LayeringPreference } from '../../../src/types/wardrobe';
import { API_BASE_URL } from '../config';

export interface MobileOutfitResult {
  title: string;
  vibe: string;
  styleScore: number;
  garmentIds: string[];
  explanation: {
    summary: string;
    colorHarmony?: string;
    occasionFit?: string;
  };
}

export interface MobileSwapResult {
  replacementGarmentId: string;
  outfitTitle?: string;
  whyItWorks: string;
}

export async function generateOutfitMobile(
  prompt: string,
  wardrobe: GarmentItem[],
  layeringPreference: LayeringPreference = 'avoid',
  excludeGarmentIds: string[] = []
): Promise<{ ok: boolean; mode: 'gemini' | 'fallback'; data: MobileOutfitResult; error?: string }> {
  if (!wardrobe || wardrobe.length === 0) {
    return {
      ok: false,
      mode: 'fallback',
      data: {
        title: 'Empty Closet',
        vibe: 'No Garments Cataloged',
        styleScore: 0,
        garmentIds: [],
        explanation: { summary: 'Add items to your wardrobe to unlock personalized styling.' }
      },
      error: 'Wardrobe is empty'
    };
  }

  // Format wardrobe payload for backend API
  const formattedWardrobe = wardrobe.map((item) => ({
    garmentId: item.id,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    color: item.color,
    fabric: item.fabric,
    fit: item.fit || 'Regular',
    formality: item.formality,
    layeringRole: item.layeringRole || 'primary_layer',
    style: item.style || 'Casual Essential',
    tags: item.tags || [],
    pairingNotes: item.pairingNotes || ''
  }));

  const SERVER_URL = `${API_BASE_URL}/api/ai/generate-outfit`;

  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        layeringPreference,
        excludeGarmentIds,
        wardrobe: formattedWardrobe
      })
    });

    if (response.ok) {
      const resData = await response.json();
      if (resData.ok && resData.data && Array.isArray(resData.data.garmentIds)) {
        // Validate returned IDs exist in closet
        const validIds = resData.data.garmentIds.filter((id: string) =>
          wardrobe.some((item) => item.id === id)
        );

        if (validIds.length > 0) {
          return {
            ok: true,
            mode: resData.mode === 'gemini' ? 'gemini' : 'fallback',
            data: {
              title: resData.data.title || `${prompt} Outfit`,
              vibe: resData.data.vibe || 'Smart Editorial',
              styleScore: resData.data.styleScore || 88,
              garmentIds: validIds,
              explanation: {
                summary: resData.data.explanation?.summary || 'Tailored to your active wardrobe and occasion needs.',
                colorHarmony: resData.data.explanation?.colorHarmony,
                occasionFit: resData.data.explanation?.occasionFit
              }
            }
          };
        }
      }
    }
  } catch {
    console.log('Mobile outfit endpoint note: server offline or unconfigured, using deterministic styling fallback');
  }

  // Deterministic fallback filtering excluded items
  const availableWardrobe = wardrobe.filter((i) => !excludeGarmentIds.includes(i.id));
  const activeSet = availableWardrobe.length >= 2 ? availableWardrobe : wardrobe;

  const top = activeSet.find((i) => i.category === 'tops') || activeSet[0];
  const bottom = activeSet.find((i) => i.category === 'bottoms') || activeSet[1] || activeSet[0];
  const shoes = activeSet.find((i) => i.category === 'shoes') || activeSet[2] || activeSet[0];
  const outerwear = layeringPreference !== 'avoid'
    ? activeSet.find((i) => i.category === 'outerwear')
    : undefined;

  const fallbackIds = [top.id, bottom.id, shoes.id];
  if (outerwear && !fallbackIds.includes(outerwear.id)) {
    fallbackIds.push(outerwear.id);
  }
  const uniqueFallbackIds = Array.from(new Set(fallbackIds)).filter(Boolean);

  return {
    ok: true,
    mode: 'fallback',
    data: {
      title: `${prompt.charAt(0).toUpperCase() + prompt.slice(1)} Ensemble`,
      vibe: top.style || 'Elevated Everyday',
      styleScore: 90,
      garmentIds: uniqueFallbackIds,
      explanation: {
        summary: `Pairs ${top.name} with ${bottom.name} for a balanced, occasion-appropriate look tailored to your ${prompt} request.`,
        colorHarmony: `Harmonizes ${top.color} and ${bottom.color} tones with natural visual contrast.`
      }
    }
  };
}

export async function swapGarmentMobile(
  currentOutfitGarmentIds: string[],
  targetGarmentIdToSwap: string,
  targetCategory: GarmentCategory,
  prompt: string,
  wardrobe: GarmentItem[]
): Promise<{ ok: boolean; mode: 'gemini' | 'fallback'; data: MobileSwapResult; error?: string }> {
  const formattedWardrobe = wardrobe.map((item) => ({
    garmentId: item.id,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    color: item.color,
    fabric: item.fabric,
    fit: item.fit || 'Regular',
    formality: item.formality,
    layeringRole: item.layeringRole || 'primary_layer',
    style: item.style || 'Casual Essential',
    tags: item.tags || [],
    pairingNotes: item.pairingNotes || ''
  }));

  const SERVER_URL = `${API_BASE_URL}/api/ai/swap-garment`;

  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentOutfitGarmentIds,
        targetGarmentIdToSwap,
        targetCategory,
        prompt,
        wardrobe: formattedWardrobe
      })
    });

    if (response.ok) {
      const resData = await response.json();
      if (resData.ok && resData.data && resData.data.replacementGarmentId) {
        // Validate replacement exists in closet
        const exists = wardrobe.some((item) => item.id === resData.data.replacementGarmentId);
        if (exists && resData.data.replacementGarmentId !== targetGarmentIdToSwap) {
          return {
            ok: true,
            mode: resData.mode === 'gemini' ? 'gemini' : 'fallback',
            data: {
              replacementGarmentId: resData.data.replacementGarmentId,
              outfitTitle: resData.data.outfitName,
              whyItWorks: resData.data.whyItWorks || 'Replaced piece with an alternative matching option from your wardrobe.'
            }
          };
        }
      }
    }
  } catch {
    console.log('Mobile swap endpoint note: server offline or unconfigured, using fallback swap selection');
  }

  // Fallback swap algorithm: find alternative garment in same category
  const candidates = wardrobe.filter(
    (item) => item.category === targetCategory && item.id !== targetGarmentIdToSwap
  );
  const replacement = candidates.length > 0
    ? candidates[Math.floor(Math.random() * candidates.length)]
    : wardrobe.find((item) => item.id !== targetGarmentIdToSwap) || wardrobe[0];

  return {
    ok: true,
    mode: 'fallback',
    data: {
      replacementGarmentId: replacement.id,
      whyItWorks: `Swapped to ${replacement.name} (${replacement.color}) for fresh visual contrast while maintaining occasion suitability.`
    }
  };
}
