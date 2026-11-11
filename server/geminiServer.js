import { GoogleGenAI } from '@google/genai';
import {
  CATEGORIES,
  filterOutfitIds,
  isValidReplacement,
  sanitizeWeatherContext,
  validateIdList,
  validateImage,
  validatePrompt,
  validateWardrobe
} from './validation.js';

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
//
// 2026-10-13: on the free tier, individual models are often "high demand"
// (503) for long stretches — a live probe had 4 of 5 flash models refusing
// while gemini-3.5-flash-lite answered. Each model has its own free quota,
// so a request now walks this list until one answers. Overridable with a
// comma-separated GEMINI_MODELS env var without a code change.
const GEMINI_MODELS = (process.env.GEMINI_MODELS ||
  // 2026-10-14 production logs: gemini-flash-latest refused (503) or hung
  // (504) on every scan while gemini-3.5-flash-lite answered every time, so
  // the model that actually works goes first.
  'gemini-3.5-flash-lite,gemini-flash-latest,gemini-flash-lite-latest,gemini-3.1-flash-lite,gemini-3.8-flash')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

// Sprint M20: hard ceiling on every Gemini request. Previously unbounded,
// so a stalled upstream held the HTTP request (and the phone's spinner) open
// indefinitely. Now a TOTAL budget across the model fallback chain; the
// mobile client's own timeout (40s, mobile/src/services/apiRequest.ts) is
// deliberately longer, so it receives this server's honest answer instead of
// racing it. No SDK-level retries (`retryOptions`): a failed model is never
// re-sent, only a different model is tried.
const GEMINI_TIMEOUT_MS = 36_000;
// One hanging model may not eat the whole budget: cut it off and move on.
const ATTEMPT_TIMEOUT_MS = 20_000;
const MIN_ATTEMPT_MS = 4_000;

/** Overloaded, missing or out-of-quota for THIS model — another may work. */
function shouldTryNextModel(err) {
  const status = err?.status ?? err?.code;
  const message = String(err?.message || '');
  return (
    [404, 429, 500, 503, 504].includes(Number(status)) ||
    /"code":\s*(404|429|500|503|504)|UNAVAILABLE|RESOURCE_EXHAUSTED|NOT_FOUND|DEADLINE_EXCEEDED|high demand|overloaded/i.test(message) ||
    // Our own per-attempt cut-off (or a dropped connection) — try the next model.
    err?.name === 'AbortError' || err?.name === 'TimeoutError' || /abort|timed? ?out|fetch failed/i.test(message)
  );
}

/**
 * generateContent with the model fallback chain and one shared time budget.
 * Throws the last error when every model fails or the budget runs out.
 */
async function generateWithFallback(apiKey, request, { fromIndex = 0, deadline = Date.now() + GEMINI_TIMEOUT_MS } = {}) {
  let lastError = null;
  for (let i = fromIndex; i < GEMINI_MODELS.length; i += 1) {
    const model = GEMINI_MODELS[i];
    const remaining = deadline - Date.now();
    if (remaining < MIN_ATTEMPT_MS) break;
    try {
      const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: Math.min(remaining, ATTEMPT_TIMEOUT_MS) } });
      const response = await ai.models.generateContent({ ...request, model });
      if (i !== 0) console.log(`[Server Gemini] Served by fallback model ${model}`);
      return { response, index: i, deadline };
    } catch (err) {
      lastError = err;
      if (!shouldTryNextModel(err)) throw err;
      console.warn(`[Server Gemini] ${model} unavailable (${err?.status ?? err?.code ?? 'error'}), trying next model`);
    }
  }
  throw lastError || new Error('Gemini request timed out');
}

/**
 * Runs generateWithFallback and parses/validates the JSON answer with
 * `accept(parsed)` (returns the cleaned data, or null to reject). On a
 * rejected answer, tries the next model in the chain once if budget allows.
 * Returns the accepted data, or null when nothing acceptable was produced.
 */
async function generateValidated(apiKey, request, accept) {
  let first = await generateWithFallback(apiKey, request);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let parsed = null;
    try {
      parsed = first.response.text ? JSON.parse(first.response.text) : null;
    } catch {
      parsed = null;
    }
    const accepted = parsed ? accept(parsed) : null;
    if (accepted) return accepted;
    if (attempt === 1 || first.index + 1 >= GEMINI_MODELS.length) break;
    try {
      first = await generateWithFallback(apiKey, request, { fromIndex: first.index + 1, deadline: first.deadline });
    } catch {
      break;
    }
  }
  return null;
}

/**
 * Coarse, non-sensitive classification of a Gemini failure, returned to the
 * client as `errorKind` so it can say "rate limited" or "timed out" instead
 * of a generic failure. Never includes provider response bodies.
 */
const SAFE_ERRORS = {
  rate_limited: 'The AI service is busy right now. Please try again in a moment.',
  timeout: 'The AI service took too long to respond. Please try again.',
  unavailable: 'The AI service is temporarily unavailable. Please try again.'
};
const invalidInput = (error) => ({ ok: false, mode: 'demo', errorKind: 'invalid_input', error });
const badAnswer = () => ({
  ok: false,
  mode: 'demo',
  errorKind: 'unavailable',
  error: 'The AI returned an unusable answer. Please try again.'
});
function failure(label, err) {
  // Details stay in the server log (message only — never bodies or tokens).
  console.error(`[Server Gemini Error] ${label} failed:`, String(err?.message || err).slice(0, 300));
  const errorKind = classifyGeminiError(err);
  return { ok: false, mode: 'demo', errorKind, error: SAFE_ERRORS[errorKind] };
}

export function classifyGeminiError(err) {
  const status = err?.status ?? err?.code;
  const message = String(err?.message || '');
  if (status === 429 || /\b429\b|RESOURCE_EXHAUSTED|quota/i.test(message)) return 'rate_limited';
  if (err?.name === 'AbortError' || err?.name === 'TimeoutError' || /abort|timed? ?out/i.test(message)) return 'timeout';
  return 'unavailable';
}

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
7. Return structured JSON matching the requested schema.

PERSONALIZATION CONTEXT (all of the following may be null — when a field is null, simply skip that consideration entirely; never fabricate a value for a null field or claim to have used context that wasn't provided):
8. USER STYLE CONTEXT: When userProfileContext is provided, treat stylePreferences as a blended set of preference SIGNALS to interpret into one coherent look — not a checklist of hard constraints and not separate outfits per preference (e.g. "Minimal" + "Streetwear" + "Smart Casual" together should read as one tasteful, coherent interpretation of all three, not three unrelated outfits). When bodyType is provided, use it only for proportion, silhouette, balance, and fit guidance (e.g. favoring a silhouette that flatters the general proportions of that body type) — never state or imply that the user "cannot," "should not," or "must not" wear something because of body type; the user retains full freedom of choice regardless. When skinTone is provided, use it only for color harmony, contrast, and complementary color suggestions — never as a hard restriction; the user's own requested colors and style always take priority over a skin-tone suggestion.
9. WEATHER CONTEXT: When weatherContext is provided, factor the real, practical conditions into the selection using only owned pieces — favor breathable/lighter pieces in hot conditions, practical footwear and weather-appropriate outerwear in rain, and additional layering in cold conditions. Weather guidance must still respect layeringPreference: never introduce a base_layer to address cold weather if layeringPreference is "avoid" and the user did not explicitly request one. If the wardrobe cannot fully satisfy the ideal weather requirement, select the closest owned pieces and say so honestly in whyItWorks — the same honesty standard as rule 4's formality feasibility, never implying a weather-fit the actual garments don't have.
10. PLANNER CONTEXT: When plannerContext is provided, treat its title/occasion/notes as the specific real-world event driving this request, and reason about it the same way you reason about the free-text request in the OCCASION REASONING section above — a real, specific occasion, not a flat label.
11. RECENT OUTFIT VARIETY: When recentOutfitContext is provided, treat recentGarmentIdCombinations as a soft signal to favor a genuinely different combination from what was very recently shown, and treat savedLookVibes (if present) as loose inspiration for the user's demonstrated taste — never as pieces that must be reused or a combination that is permanently forbidden. A small wardrobe reusing a piece from recent history is expected and completely fine; never sacrifice a correct, occasion-appropriate outfit just to force variety. excludedGarmentIds (outside this context) remains the only hard exclusion of individual garments — everything in recentOutfitContext is a preference, EXCEPT the feedback rule below.
12. USER FEEDBACK (the user's own ratings — recentOutfitContext may carry these; each may be missing):
   - dislikedCombinations: the user said "I disliked it" to each of these exact garment sets. HARD RULE: never return a garmentIds set that is exactly equal to any of them (same garments, any order). Reusing an individual piece from one in a DIFFERENT combination is fine.
   - avoidRepeatingCombinations: shown recently or rated only "okay". Do not return exactly one of these sets unless the wardrobe genuinely has no other sensible option for the occasion.
   - likedCombinations: looks the user rated "nice" or actually wore — their real taste. Lean toward these pieces, colours and styling, but build a fresh combination rather than repeating one exactly.`;

/**
 * Endpoint 1: POST /api/ai/analyze-garment
 * Analyzes uploaded clothing photo bytes using Gemini Vision.
 */
export async function handleAnalyzeGarmentServer(body) {
  const apiKey = getServerApiKey();
  if (!apiKey) {
    return { ok: false, mode: 'demo', errorKind: 'not_configured', error: 'The AI service is not configured on the server.' };
  }
  const img = validateImage(body?.imageData, body?.mimeType);
  if (!img.ok) return invalidInput(img.error);
  const hint = body.categoryHint;
  if (hint !== undefined && hint !== null && hint !== '' && !CATEGORIES.includes(hint)) {
    return invalidInput('categoryHint is invalid');
  }

  try {
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
  "pattern": "One of: Solid, Striped, Checked, Floral, Printed, Graphic, Other",
  "style": "Short 2-4 word style descriptor e.g. Streetwear Essential, Tailored Modern, Classic Casual, Refined Minimalist",
  "formality": "One of: casual, smart_casual, formal, evening",
  "layeringRole": "One of: base_layer, primary_layer, outer_layer",
  "tags": ["3 to 5 relevant aesthetic or functional tags"],
  "aiConfidence": 0.95,
  "pairingNotes": "Concise 1-sentence styling advice for this garment."
}
Only state what is visible. Never guess a brand name, and never guess a fabric or material that cannot be identified from the photo: return an empty string for brand-like fields and "Unknown" for fabric when it is not visually identifiable.
${hint ? `Category hint: ${hint}.` : 'No category hint: decide the category from the photo (it may be a top, bottom, layer, footwear or an accessory).'}`;

    const str = { type: 'STRING' };
    const { response } = await generateWithFallback(apiKey, {
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType: img.value.mimeType, data: img.value.base64 } }, { text: prompt }]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            name: str,
            category: { type: 'STRING', enum: CATEGORIES },
            subcategory: str,
            color: str,
            hexColor: str,
            fabric: str,
            fit: str,
            pattern: str,
            style: str,
            formality: { type: 'STRING', enum: ['casual', 'smart_casual', 'formal', 'evening'] },
            layeringRole: { type: 'STRING', enum: ['base_layer', 'primary_layer', 'outer_layer'] },
            tags: { type: 'ARRAY', items: str },
            aiConfidence: { type: 'NUMBER' },
            pairingNotes: str
          },
          required: ['name', 'category', 'color']
        },
        temperature: 0.2
      }
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from Gemini Vision');

    return { ok: true, mode: 'gemini', data: JSON.parse(text) };
  } catch (err) {
    return failure('Garment analysis', err);
  }
}

const OUTFIT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    status: { type: 'STRING' },
    outfitName: { type: 'STRING' },
    vibe: { type: 'STRING' },
    styleMatch: { type: 'NUMBER' },
    garmentIds: { type: 'ARRAY', items: { type: 'STRING' } },
    whyItWorks: {
      type: 'OBJECT',
      properties: {
        color: { type: 'STRING' },
        fit: { type: 'STRING' },
        occasion: { type: 'STRING' },
        overall: { type: 'STRING' }
      }
    }
  },
  required: ['garmentIds']
};

const SWAP_SCHEMA = {
  type: 'OBJECT',
  properties: {
    status: { type: 'STRING' },
    replacementGarmentId: { type: 'STRING' },
    outfitName: { type: 'STRING' },
    whyItWorks: { type: 'STRING' }
  },
  required: ['replacementGarmentId']
};

/**
 * Endpoint 2: POST /api/ai/generate-outfit
 * Generates an occasion-tailored outfit strictly from the provided closet context.
 */
export async function handleGenerateOutfitServer(body) {
  const apiKey = getServerApiKey();
  if (!apiKey) {
    return { ok: false, mode: 'demo', errorKind: 'not_configured', error: 'The AI service is not configured on the server.' };
  }
  const prompt = validatePrompt(body?.prompt, { required: true });
  if (!prompt.ok) return invalidInput(prompt.error);
  const wardrobe = validateWardrobe(body?.wardrobe);
  if (!wardrobe.ok) return invalidInput(wardrobe.error);
  const exclude = validateIdList(body?.excludeGarmentIds, 'excludeGarmentIds');
  if (!exclude.ok) return invalidInput(exclude.error);
  if (wardrobe.value.length === 0) return invalidInput('wardrobe is empty');

  try {
    const weatherContext = sanitizeWeatherContext(body.weatherContext);
    const userPrompt = {
      request: prompt.value,
      layeringPreference: body.layeringPreference || 'avoid',
      excludedGarmentIds: exclude.value,
      wardrobeCount: wardrobe.value.length,
      wardrobeSummary: body.wardrobeSummary || null,
      // Optional personalization context. Each defaults to null (not
      // omitted) so the prompt's own "may be null" instruction always has an
      // explicit field to reason about.
      userProfileContext: body.userProfileContext || null,
      // Accepts both the web shape (temperatureC, feelsLikeC, maxC, minC,
      // precipitationProbability) and the mobile shape (temperatureCelsius).
      weatherContext,
      weatherNote: weatherContext
        ? 'Weather data is provided in weatherContext.'
        : 'No weather data is available for this request; do not assume or invent any weather.',
      plannerContext: body.plannerContext || null,
      recentOutfitContext: body.recentOutfitContext || null,
      wardrobe: wardrobe.value
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

    const data = await generateValidated(
      apiKey,
      {
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        config: { responseMimeType: 'application/json', responseSchema: OUTFIT_SCHEMA, temperature: 0.3 }
      },
      (parsed) => {
        const ids = filterOutfitIds(parsed.garmentIds, wardrobe.value, exclude.value);
        return ids.length ? { ...parsed, garmentIds: ids } : null;
      }
    );
    return data ? { ok: true, mode: 'gemini', data } : badAnswer();
  } catch (err) {
    return failure('Outfit generation', err);
  }
}

/**
 * Endpoint 3: POST /api/ai/swap-garment
 * Replaces a single garment in an outfit with a compatible piece from the closet.
 */
export async function handleSwapGarmentServer(body) {
  const apiKey = getServerApiKey();
  if (!apiKey) {
    return { ok: false, mode: 'demo', errorKind: 'not_configured', error: 'The AI service is not configured on the server.' };
  }
  const prompt = validatePrompt(body?.prompt);
  if (!prompt.ok) return invalidInput(prompt.error);
  const wardrobe = validateWardrobe(body?.wardrobe);
  if (!wardrobe.ok) return invalidInput(wardrobe.error);
  const current = validateIdList(body?.currentOutfitGarmentIds, 'currentOutfitGarmentIds', 20);
  if (!current.ok) return invalidInput(current.error);
  const targetId = body?.targetGarmentIdToSwap;
  const targetCheck = validateIdList([targetId], 'targetGarmentIdToSwap');
  if (!targetCheck.ok) return invalidInput(targetCheck.error);
  const targetCategory = body?.targetCategory;
  if (targetCategory !== undefined && targetCategory !== null && !CATEGORIES.includes(targetCategory)) {
    return invalidInput('targetCategory is invalid');
  }

  try {
    const swapPrompt = {
      occasion: prompt.value,
      currentOutfitGarmentIds: current.value,
      targetGarmentIdToSwap: targetId,
      targetGarmentCategory: targetCategory ?? null,
      wardrobe: wardrobe.value
    };

    const promptText = `${SYSTEM_PROMPT}

SWAP REQUEST:
The user wants to replace garmentId "${targetId}" in their current outfit.
Select a replacement garmentId from the user's wardrobe that belongs to the same category (${targetCategory ?? 'unspecified'}) or fulfills a compatible role, while preserving overall outfit color harmony and suitability for the occasion given in SWAP CONTEXT.

SWAP CONTEXT:
${JSON.stringify(swapPrompt, null, 2)}

Return structured JSON:
{
  "status": "success",
  "replacementGarmentId": "ID of chosen replacement garment",
  "outfitName": "Updated Outfit Title",
  "whyItWorks": "Short rationale for the swapped piece"
}`;

    const data = await generateValidated(
      apiKey,
      {
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        config: { responseMimeType: 'application/json', responseSchema: SWAP_SCHEMA, temperature: 0.3 }
      },
      (parsed) =>
        isValidReplacement(parsed.replacementGarmentId, {
          wardrobe: wardrobe.value,
          category: targetCategory,
          currentOutfitIds: current.value,
          targetId
        })
          ? parsed
          : null
    );
    return data ? { ok: true, mode: 'gemini', data } : badAnswer();
  } catch (err) {
    return failure('Swap', err);
  }
}
