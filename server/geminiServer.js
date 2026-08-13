import { GoogleGenAI } from '@google/genai';

/**
 * Server-Side Gemini API Handler.
 * Executes EXCLUSIVELY in Node.js server environment.
 * The GEMINI_API_KEY is read strictly from process.env and is NEVER sent to the client browser.
 *
 * Runs under both `npm run dev` (imported by vite.config.js's dev middleware)
 * and `npm run start` (imported by server/index.js) — this file is the one
 * source of truth for Gemini prompt/schema behavior in either mode.
 */

function getServerApiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (key && key !== 'your_gemini_api_key_here') {
    return key;
  }
  return null;
}

// 'gemini-2.5-flash' returns 404 ("no longer available to new users") for
// this project's API key as of Sprint 20's live verification — confirmed via
// ai.models.list() and a direct generateContent call. 'gemini-flash-latest'
// is Google's rolling alias for the current-generation flash model, so it
// won't go stale the same way a pinned version number will.
const GEMINI_MODEL = 'gemini-flash-latest';

const SYSTEM_PROMPT = `You are CLOSIQ, an expert personal AI stylist.
Your primary rule: You MUST ONLY style outfits using the user's actual wardrobe items provided in the JSON input.

OCCASION REASONING: Before selecting garments, read the user's own request and derive its real styling context — do not treat it as a flat label or match it only against the example words below. Consider:
- Social context: professional/academic (credibility, restraint) vs. solo/practical (comfort, ease) vs. social/romantic (personal presentation, intentional styling).
- Time of day and setting: evening and romantic/social occasions generally call for more deliberately-styled, dressed-up pieces than daytime academic or professional occasions do, even when both sound "polished" on the surface.
- Practical demands: mobility, weather layering, standing/presenting for long periods, etc.
- Degree of intentionality: effortless/low-effort (e.g. a casual weekend) vs. deliberate/considered — and, when both are deliberate, WHY: personal attraction and social polish for a date is a different goal than credibility and professionalism for a presentation or interview, even if both draw from the wardrobe's most polished tier.
Two occasions that sound similarly "polished" (e.g. a romantic dinner and an academic presentation) are not automatically the same styling problem — reason about which of the above dimensions genuinely differ for this specific request.

STRICT STYLING RULES:
1. NEVER INVENT garments. Only return garmentIds that exist in the provided wardrobe list.
2. Respect layering preferences: If layeringPreference is "avoid", do NOT automatically include base_layer garments (like tank tops) under another shirt/top unless explicitly requested.
3. When several wardrobe items in a category are all plausible for the occasion, choose among them in this order: occasion fit (per the reasoning above) → formality → style → color harmony → fabric/fit/silhouette → layering role → overall coherence. Each wardrobe item's style field (e.g. "Streetwear Essential", "Tailored Modern") is a real signal about how that piece actually reads, not just its formality tier — weigh it accordingly. If two distinct occasions land on the same formality tier because the wardrobe has nothing higher, differentiate using style, color, fabric, fit, tags, and pairingNotes rather than defaulting to the identical combination for both.
4. WARDROBE FEASIBILITY: When a wardrobeSummary is provided, its formalityCoverage tells you, per formality tier, how many items actually exist and a rough tier (none/weak/moderate/strong). Use it honestly. If the occasion calls for a formality tier the wardrobe covers weakly or not at all, do NOT claim or imply the result meets that tier anyway — select the closest formality the wardrobe genuinely has, still produce the best possible outfit from owned items, and say so plainly in whyItWorks (e.g. that the wardrobe doesn't currently have formal or evening pieces, so this is the most polished option available). Never invent the impression of tailoring, formality, or polish the actual garments don't have.
5. Ensure color harmony, fit compatibility, category balance, and appropriate formality for the occasion.
6. Provide a contextual, genuine explanation in whyItWorks detailing why these specific pieces work together for this exact occasion — including the honest feasibility note from rule 4 when it applies.
7. Return structured JSON matching the requested schema.`;

/**
 * Endpoint 1: POST /api/ai/analyze-garment
 * Analyzes uploaded clothing photo bytes using Gemini Vision.
 */
export async function handleAnalyzeGarmentServer(body) {
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
  "style": "Short 2-4 word style descriptor e.g. Streetwear Essential, Tailored Modern, Classic Casual, Refined Minimalist",
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
  } catch (err) {
    console.error('[Server Gemini Error] Garment analysis failed:', err?.message || err);
    return { ok: false, mode: 'demo', error: err?.message || 'Vision analysis failed' };
  }
}

/**
 * Endpoint 2: POST /api/ai/generate-outfit
 * Generates an occasion-tailored outfit strictly from the provided closet context.
 */
export async function handleGenerateOutfitServer(body) {
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
      wardrobeSummary: body.wardrobeSummary || null,
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
  } catch (err) {
    console.error('[Server Gemini Error] Outfit generation failed:', err?.message || err);
    return { ok: false, mode: 'demo', error: err?.message || 'Outfit generation failed' };
  }
}

/**
 * Endpoint 3: POST /api/ai/swap-garment
 * Replaces a single garment in an outfit with a compatible piece from the closet.
 */
export async function handleSwapGarmentServer(body) {
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
  } catch (err) {
    console.error('[Server Gemini Error] Swap failed:', err?.message || err);
    return { ok: false, mode: 'demo', error: err?.message || 'Swap failed' };
  }
}
