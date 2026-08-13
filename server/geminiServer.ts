import { GoogleGenAI } from '@google/genai';

/**
 * Server-Side Gemini API Handler.
 * Executes EXCLUSIVELY in Node.js server environment.
 * The GEMINI_API_KEY is read strictly from process.env and is NEVER sent to the client browser.
 */

function getServerApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY;
  if (key && key !== 'your_gemini_api_key_here') {
    return key;
  }
  return null;
}

const GEMINI_MODEL = 'gemini-2.5-flash';

const SYSTEM_PROMPT = `You are CLOSIQ, an expert personal AI stylist.
Your primary rule: You MUST ONLY style outfits using the user's actual wardrobe items provided in the JSON input.

STRICT STYLING RULES:
1. NEVER INVENT garments. Only return garmentIds that exist in the provided wardrobe list.
2. Carefully reason about the user's requested occasion (e.g. "college presentation" vs "casual weekend" vs "airport travel" vs "date night").
3. Respect layering preferences: If layeringPreference is "avoid", do NOT automatically include base_layer garments (like tank tops) under another shirt/top unless explicitly requested.
4. Ensure color harmony, fit compatibility, category balance, and appropriate formality for the occasion.
5. Provide a contextual, genuine explanation in whyItWorks detailing why these specific pieces work together for this exact occasion.
6. Return structured JSON matching the requested schema.`;

/**
 * Endpoint 1: POST /api/ai/analyze-garment
 * Analyzes uploaded clothing photo bytes using Gemini Vision.
 */
export async function handleAnalyzeGarmentServer(body: {
  imageData: string;
  mimeType?: string;
  categoryHint?: string;
}) {
  const apiKey = getServerApiKey();
  if (!apiKey) {
    return { ok: false, mode: 'demo', error: 'GEMINI_API_KEY not configured on server' };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const mimeType = body.mimeType || 'image/png';
    // Strip data URI prefix if present
    const base64Data = body.imageData.includes(';base64,')
      ? body.imageData.split(';base64,')[1]
      : body.imageData;

    const prompt = `Analyze this uploaded garment photo as an expert fashion curator for CLOSIQ.
Return structured JSON output matching this schema:
{
  "name": "Specific concise descriptive name of garment e.g. Washed Navy Oxford Shirt",
  "category": "One of: tops, bottoms, outerwear, shoes, accessories",
  "subcategory": "Garment type e.g. Oxford Shirt, Denim Jacket, Chinos, Boots",
  "color": "Dominant color name e.g. Washed Navy, Charcoal Slate, Chalk White",
  "hexColor": "Hex color code e.g. #1B263B",
  "fabric": "Estimated fabric/material e.g. 100% Cotton Poplin, Heavy Denim",
  "fit": "Fit silhouette e.g. Tailored, Oversized, Relaxed, Slim, Regular",
  "formality": "One of: casual, smart_casual, formal, evening",
  "layeringRole": "One of: base_layer, primary_layer, outer_layer",
  "tags": ["3 to 5 relevant aesthetic or functional tags"],
  "aiConfidence": 0.95,
  "pairingNotes": "Concise 1-sentence styling advice for this garment."
}
Category hint: ${body.categoryHint || 'tops'}.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: prompt }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from Gemini Vision');

    return { ok: true, mode: 'gemini', data: JSON.parse(text) };
  } catch (err: any) {
    console.error('[Server Gemini Error] Garment analysis failed:', err?.message || err);
    return { ok: false, mode: 'demo', error: err?.message || 'Vision analysis failed' };
  }
}

/**
 * Endpoint 2: POST /api/ai/generate-outfit
 * Generates an occasion-tailored outfit strictly from the provided closet context.
 */
export async function handleGenerateOutfitServer(body: {
  wardrobe: any[];
  prompt: string;
  layeringPreference?: string;
  excludeGarmentIds?: string[];
  seed?: number;
}) {
  const apiKey = getServerApiKey();
  if (!apiKey) {
    return { ok: false, mode: 'demo', error: 'GEMINI_API_KEY not configured on server' };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const userPrompt = {
      request: body.prompt,
      layeringPreference: body.layeringPreference || 'avoid',
      excludedGarmentIds: body.excludeGarmentIds || [],
      wardrobeCount: body.wardrobe?.length || 0,
      wardrobe: body.wardrobe
    };

    const promptText = `${SYSTEM_PROMPT}

USER REQUEST & WARDROBE CONTEXT:
${JSON.stringify(userPrompt, null, 2)}

Return structured JSON matching this schema:
{
  "status": "success",
  "outfitName": "Evocative Title e.g. Polished Presentation",
  "vibe": "Style archetype e.g. Smart Casual",
  "styleMatch": 94,
  "garmentIds": ["g001", "g002", "g003"],
  "whyItWorks": {
    "color": "Color harmony rationale",
    "fit": "Silhouette & fit rationale",
    "occasion": "Occasion appropriateness rationale",
    "overall": "Concise 1-2 sentence overall styling rationale"
  }
}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3
      }
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from Gemini Stylist');

    return { ok: true, mode: 'gemini', data: JSON.parse(text) };
  } catch (err: any) {
    console.error('[Server Gemini Error] Outfit generation failed:', err?.message || err);
    return { ok: false, mode: 'demo', error: err?.message || 'Outfit generation failed' };
  }
}

/**
 * Endpoint 3: POST /api/ai/swap-garment
 * Replaces a single garment in an outfit with a compatible piece from the closet.
 */
export async function handleSwapGarmentServer(body: {
  currentOutfitGarmentIds: string[];
  targetGarmentIdToSwap: string;
  targetCategory: string;
  prompt: string;
  wardrobe: any[];
}) {
  const apiKey = getServerApiKey();
  if (!apiKey) {
    return { ok: false, mode: 'demo', error: 'GEMINI_API_KEY not configured on server' };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const swapPrompt = {
      occasion: body.prompt,
      currentOutfitGarmentIds: body.currentOutfitGarmentIds,
      targetGarmentIdToSwap: body.targetGarmentIdToSwap,
      targetGarmentCategory: body.targetCategory,
      wardrobe: body.wardrobe
    };

    const promptText = `${SYSTEM_PROMPT}

SWAP REQUEST:
The user wants to replace garmentId "${body.targetGarmentIdToSwap}" in their current outfit.
Select a replacement garmentId from the user's wardrobe that belongs to the same category (${body.targetCategory}) or fulfills a compatible role, while preserving overall outfit color harmony and suitability for "${body.prompt}".

SWAP CONTEXT:
${JSON.stringify(swapPrompt, null, 2)}

Return structured JSON:
{
  "status": "success",
  "replacementGarmentId": "ID of chosen replacement garment",
  "outfitName": "Updated Outfit Title",
  "whyItWorks": "Short rationale for the swapped piece"
}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3
      }
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from Gemini Swap');

    return { ok: true, mode: 'gemini', data: JSON.parse(text) };
  } catch (err: any) {
    console.error('[Server Gemini Error] Swap failed:', err?.message || err);
    return { ok: false, mode: 'demo', error: err?.message || 'Swap failed' };
  }
}
