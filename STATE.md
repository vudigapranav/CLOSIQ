# STATE.md — CLOSIQ Living Implementation State

This document tracks the live implementation status of **CLOSIQ**. It is updated at the end of every active development turn/session.

---

## Current Phase

* **Phase**: Wardrobe Intelligence (Sprint 24)
* **Status**: Gave Gemini a lightweight aggregate view of the whole closet — not just the per-garment list it already had — plus an explicit instruction to be honest when an occasion's needed formality tier is weakly or not covered, instead of implying casual pieces are formal ones. Verified against real catalog data (not estimated): the men's wardrobe is `strong` in casual/smart_casual but `none` in formal/evening; the women's wardrobe is `strong` in casual/smart_casual, `none` in formal, `weak` (1 item) in evening. Profile partitioning confirmed clean (36 + 22 = 58, zero overlap). Live re-verification blocked by the same exhausted free-tier quota as every prior sprint. Full details in "Sprint 24 — Wardrobe Intelligence" below.

---

## Sprint 24 — Wardrobe Intelligence

### Problem
Gemini received every individual garment but nothing that summarized the closet as a whole — so it had no compact signal for "this wardrobe is deep in casual but has nothing formal," and no explicit instruction to be honest about that gap rather than styling casual pieces as if they were something they're not.

### Implementation
1. **`src/services/ai/outfitStylist.ts`** — new `summarizeWardrobeCoverage(wardrobe)`, computed from the exact same `wardrobe` array `formatWardrobeContext()` already uses (so it's automatically profile-correct and includes uploaded items — no separate filtering logic to get wrong). Returns:
   - `categoryCounts` — tops/bottoms/outerwear/shoes/accessories counts.
   - `formalityCoverage` — per formality tier (`casual`/`smart_casual`/`formal`/`evening`), a `{ count, tier }` pair where `tier` is a heuristic bucket (`none` = 0, `weak` ≤ 2, `moderate` ≤ 5, `strong` = 6+) — deliberately simple thresholds sized for a hackathon-scale wardrobe, not a scoring engine.
   - `layeringCounts` — base/primary/outer/unspecified counts.
   - `distinctStyleCount` / `distinctColorCount` — single diversity numbers, not full breakdowns, to avoid re-sending data Gemini already has per-item.
   - Sent as a new `wardrobeSummary` field alongside the existing `wardrobe` array in the `POST /api/ai/generate-outfit` body — a ~10-line aggregate object, not a duplicate of the per-item list.
   - `formatWardrobeContext()` also gained `hexColor` per item (was missing; explicitly called for as a "use where useful" signal).
2. **`server/geminiServer.js`** — `handleGenerateOutfitServer` forwards `body.wardrobeSummary` into the prompt payload (same pass-through pattern as the existing `wardrobeCount` field). `SYSTEM_PROMPT` gained one new numbered rule (STRICT STYLING RULES #4, "WARDROBE FEASIBILITY"): when `formalityCoverage` shows the occasion's needed tier is `weak`/`none`, Gemini must not claim or imply the result meets that tier — it should pick the closest formality the wardrobe genuinely has, still produce the best outfit from owned items, and say so plainly in `whyItWorks`. No occasion string is named in this rule; it operates purely on the coverage data plus whatever occasion context the model has already derived (Sprint 22's framework), so it generalizes rather than hardcoding.

### Formality Coverage (verified from real catalog data)
| Profile | casual | smart_casual | formal | evening |
|---|---|---|---|---|
| Men (n=36) | strong (24) | strong (12) | **none (0)** | **none (0)** |
| Women (n=22) | strong (11) | strong (10) | **none (0)** | weak (1) |

Confirms and quantifies Sprint 22's finding precisely — the men's wardrobe has zero pieces above smart_casual, and the women's wardrobe has exactly one evening piece. No catalog data was added or changed to "fix" this — per the brief, an honest `none`/`weak` result is the correct output, not a defect.

### Occasion Feasibility
Deliberately **not** precomputed as a fixed value in code (that would risk being a disguised occasion→outfit/feasibility mapping, which the brief forbids). Instead, `formalityCoverage` gives Gemini the raw coverage data and the new STRICT STYLING RULES #4 tells it how to reason about full/partial/unsupported feasibility for whatever occasion the user actually typed, at request time. "Fully supported" / "partially supported" / "unsupported" are not fields the app computes or stores anywhere — they're an emergent judgment Gemini makes and expresses in the existing free-text `whyItWorks` fields, which already flow to the UI unchanged. No response schema change, no validator change, no UI change.

### Men/Women
`PASS`. Verified by parsing `garmentCatalog.ts` directly (see table above) and confirming `men` + `women` entry counts sum to the full 58-entry catalog with zero overlap — the profile field is a true partition. `summarizeWardrobeCoverage()` itself does no profile filtering (correctly — that already happens once, upstream, in `App.tsx`'s `visibleWardrobe`), so it can't diverge from whatever the rest of the app already shows as the active wardrobe.

### Uploaded Items
`PASS` — by construction, not a special code path. `summarizeWardrobeCoverage()` and `formatWardrobeContext()` both operate on the identical `wardrobe` array passed into `generateAIOutfitWithGemini()`, which is `App.tsx`'s `visibleWardrobe` (seed items for the active profile + all user-uploaded items, which never carry a `profile` tag — confirmed by reading `App.tsx`, unchanged this sprint). Neither function filters by `isSeedItem`/`profile`, so an uploaded item is counted identically to a catalog item.

### Layering
`PASS`. `layeringCounts` computed and verified against real data: men have 0 `base_layer`, 8 `primary_layer`, 4 `outer_layer`, 24 `unspecified` (mostly bottoms/shoes/accessories, which don't carry a layering role); women have 1/7/1/13 respectively. No "Inners" category introduced; tank tops remain under Tops with `layeringRole: base_layer`, unchanged.

### Validator
`PASS`, no code change. `validateAIOutfitResponse()` still only checks returned `garmentId`s against the real wardrobe map — `wardrobeSummary` never reaches the validator and has no path to influence which IDs are accepted.

### Gemini Live Verification
`NOT TESTED — QUOTA`. Made exactly the two calls the brief permits ("job interview", "first date dinner") against the real running server with the real key — both returned a genuine `429 RESOURCE_EXHAUSTED` from Google (same quota every sprint since 20 has hit), correct demo-fallback, no crash. No further calls were made. The coverage-summary math itself was instead verified deterministically (see Formality Coverage table and Men/Women above) — a genuine source-level test, not a skipped one.

### Build
`PASS` — `npm run build`, 0 errors.

### Lint
`PASS` — `npm run lint` (oxlint), 0 errors, 0 warnings.

### Remaining Risks
- **Not confirmed live** that Gemini actually uses `wardrobeSummary`/rule #4 to produce an honest "this wardrobe doesn't have formal pieces" explanation instead of silently ignoring the new context — blocked by quota, same as every AI-quality change since Sprint 20.
- **`formalityCoverage` is a flat per-tier count, not per-category-per-tier** — it can't by itself capture a narrower ceiling like "only 3 of the wardrobe's 12 smart_casual items are tops" (the exact College-vs-Interview thinness Sprint 20 found). That finer detail is still fully visible to Gemini in the per-item `wardrobe` array; the summary is deliberately coarse to stay lightweight, not a replacement for it (per the brief's own instruction).
- Free-tier quota remains the top operational/demo risk, unchanged.

### Next Priority
Once the free-tier quota resets: run the "job interview" vs. "first date dinner" comparison live and specifically check whether `whyItWorks` now honestly names the formal/evening gap for the men's wardrobe, rather than just checking garment-ID differentiation as prior sprints did.

---

## Sprint 23 — Garment Style Metadata Pipeline

### Problem
Sprint 22 found that `garmentCatalog.ts` defines a `style` field on every catalog entry (a short descriptor like "Streetwear Essential", "Classic Casual", "Tailored Modern", "Elevated Evening") but `catalogEntryToGarmentItem()` never copies it onto the resulting `GarmentItem` — so it never existed anywhere downstream (wardrobe state, `formatWardrobeContext()`, the Gemini request). Sprint 22 deliberately left this unfixed as out of scope; this sprint closes it.

### Trace (as instructed — verified, not assumed)
1. **Where `style` is defined**: `CatalogEntry`/`CatalogEntryInput` in `src/data/garmentCatalog.ts:32`, required `string`, populated on all 58 `RAW_CATALOG` entries with real per-garment values (confirmed by grep — no blanks/placeholders).
2. **Where it was dropped**: `catalogEntryToGarmentItem()` (`garmentCatalog.ts`) — its return object listed every other `CatalogEntry` field except `style`.
3. **Whether `GarmentItem` had a representation**: No. No `style` field, and no other field was an appropriate substitute — `tags` is a short keyword array, `pairingNotes` is a full sentence; neither is the short style-descriptor shape the catalog already uses.
4. **Whether uploaded garments had style metadata**: No, on two levels — the real Gemini vision-analysis JSON schema (`handleAnalyzeGarmentServer` in `server/geminiServer.js`) never requested a `style` field, and even if it had, the client mapper (`wardrobeVision.ts`) wasn't reading one. The demo-fallback scanner (`aiVisionScanner.ts`'s `analyzeUploadedPhoto()`, pixel-color-only, no real garment understanding) has no basis to produce one at all.
5. **Whether Gemini received style for catalog garments**: No — `formatWardrobeContext()` in `outfitStylist.ts` (already fixed to forward `pairingNotes` in Sprint 22) did not include `style`, and it couldn't have, since `GarmentItem` didn't carry it yet.

### Implementation
Minimal, additive, one clear source of truth (`GarmentItem.style`, optional):
1. **`src/types/wardrobe.ts`**: added `style?: string` to `GarmentItem` — reuses the catalog's existing "short descriptor string" shape rather than inventing a new union/enum (none existed to reuse; `style` in the catalog was always a free-text string, not a closed set). Optional so old `localStorage`-persisted wardrobes (no schema migration exists or was added) and any construction path that doesn't set it continue to type-check and run unchanged.
2. **`src/data/garmentCatalog.ts`**: `catalogEntryToGarmentItem()` now includes `style: entry.style` — the one-line fix for the core Sprint 22 finding. Garment IDs, image paths, and category structure untouched.
3. **`server/geminiServer.js`**: `handleAnalyzeGarmentServer`'s vision JSON schema gained one field — `"style": "Short 2-4 word style descriptor e.g. Streetwear Essential, Tailored Modern, Classic Casual, Refined Minimalist"` — alongside the existing name/category/fabric/fit/etc. fields it already asks Gemini to derive from the actual photo. This is not an invented label: it's the same vision model already deriving fabric/fit/formality/pairingNotes from the image, asked for one more real attribute in the same call. `SYSTEM_PROMPT`'s existing tie-breaking rule (added Sprint 22) got a minimal clarification — `style` added to the selection-priority order and the tie-break-signal list, plus one sentence noting a garment's `style` field is a real signal distinct from its formality tier. No other prompt text was touched.
4. **`src/services/ai/wardrobeVision.ts`**: the client-side Gemini response mapper now reads `json.style` (trimmed, falls back to `undefined` if missing/blank) into the returned `VisionAnalysisResult` — real photos analyzed by the real model now carry a real, image-derived style descriptor.
5. **`src/services/aiVisionScanner.ts`**: `VisionAnalysisResult` gained the matching optional `style?: string` field. `analyzeCatalogGarment()` (the "Add Item" quick-add instant-recognition path for known catalog pieces) now passes through the catalog's real `entry.style`. `analyzeUploadedPhoto()` (the deterministic pixel-color-only demo fallback used when Gemini is unavailable) deliberately does **not** set `style` — per the brief's explicit instruction not to invent arbitrary labels, since this path has no actual garment understanding, only a dominant-color guess.
6. **`src/components/modals/AddItemModal.tsx`**: added `style` local state, populated by `applyAnalysis()` from whichever scanner ran (real Gemini, demo pixel-color, or catalog quick-add), and included in `handleConfirmAdd()`'s final `GarmentItem` construction. No new visible form field was added — `style` is carried through the same way `tags`/`pairingNotes`/`aiConfidence` already are (AI-detected, not manually edited in the confirm step), so this is a pure data-plumbing change, not a UI change.
7. **`src/services/ai/outfitStylist.ts`**: `formatWardrobeContext()` now also forwards `style: item.style` per garment (alongside the `pairingNotes` Sprint 22 added). `JSON.stringify` naturally omits `undefined` values, so items without a style (old stored items, demo-scanned uploads) are simply sent without that key — no null/placeholder pollution in the Gemini payload.

### Validation
`PASS`, no code change needed. Traced `validateAIOutfitResponse()` in `validator.ts`: it looks up each returned `garmentId` in a `Map<string, GarmentItem>` built from the caller's actual wardrobe and pushes the matched `GarmentItem` object itself — so `style` (when present) rides along automatically as part of that object. The validator's actual check (does this ID exist in the user's wardrobe?) is completely untouched and cannot be bypassed by anything in the `style` field.

### Backward Compatibility
`style` is optional everywhere it appears (`GarmentItem`, `VisionAnalysisResult`) and no `localStorage` schema version/migration exists in this project (confirmed — `App.tsx` reads/writes wardrobe state as a plain `JSON.parse`/`JSON.stringify` array, no versioning). An existing stored item shaped like `{ id, name, category, color, ... }` with no `style` key simply parses with `style` as `undefined` — every consumer (`formatWardrobeContext()`, the validator, `AddItemModal`) already treats it as optional, so nothing breaks for pre-Sprint-23 wardrobes.

### Build
`PASS` — `npm run build`, 0 errors. (One self-caught issue during this sprint: the first `SYSTEM_PROMPT` edit used backtick-quoted `` `style` `` inside the already-backtick-delimited JS template literal, which terminated the string early and broke the build — caught immediately by `npm run build`, fixed by switching to plain text, re-verified clean.)

### Lint
`PASS` — `npm run lint` (oxlint), 0 errors, 0 warnings. No separate `tsc` type-check is configured in this project (confirmed again this sprint — `npx tsc` resolves to a placeholder, not a real compiler); `vite build`'s esbuild/rolldown transform is the only build-time check, consistent with every prior sprint's verification standard.

### Remaining Risks
- **Not live-tested against real Gemini this sprint** — no request was made to Gemini at all (data-model sprint, no reason to burn the still-likely-exhausted free-tier quota on a change that doesn't require a live call to verify structurally). The vision-schema addition (`style` in `handleAnalyzeGarmentServer`) specifically has not been confirmed to produce good real values from an actual photo — first real garment upload once quota allows should check this.
- **Existing wardrobes need no migration to stay functional, but won't retroactively gain `style`** — a user's wardrobe items added before this sprint will simply have no `style` value until re-scanned/re-added; this is expected, intentional graceful degradation, not a bug.
- **No UI surfaces `style` anywhere** — deliberately out of scope per this sprint's explicit "do not redesign the UI" rule. The field exists purely to improve Gemini's reasoning material; a future sprint could choose to surface it (e.g. in `ClothingDetailModal`) if desired.

### Next Priority
Once the free-tier quota resets: (1) re-run Sprint 22's "first date dinner" vs. "college presentation" comparison now that Gemini also receives `style` (not just `pairingNotes`) as a tie-breaking signal, and (2) upload one real photo to confirm the vision endpoint actually returns a sensible `style` value end-to-end.

---

## Sprint 22 — Occasion Reasoning

### Problem
Sprint 20 found "first date dinner" produced an outfit with garment IDs byte-identical to "college presentation tomorrow" — only the title/copy differed. Two unrelated occasions collapsed into the same result.

### Root Cause
Traced the full pipeline: chip/prompt text (`TodayScreen.tsx`/`StylistScreen.tsx`) → `generateAIOutfitWithGemini()` (`src/services/ai/outfitStylist.ts`, unchanged control flow) → `POST /api/ai/generate-outfit` → `handleGenerateOutfitServer()` (`server/geminiServer.js`) → Gemini → `validateAIOutfitResponse()` (`src/services/ai/validator.ts`, unchanged) → UI. Nothing in this chain is hardcoded per-occasion; the collapse happens inside Gemini's own reasoning, and two concrete, data-grounded factors explain why:

1. **Wardrobe formality ceiling (verified by parsing `src/data/garmentCatalog.ts` directly, not assumed)**: the men's seed wardrobe has **58 items total, and not one is tagged `formal` or `evening`** — every men's garment is either `casual` (24) or `smart_casual` (12). Within `smart_casual` specifically there are only **3 tops, 4 bottoms, 2 shoes, 1 outerwear, 2 accessories** (confirmed via a direct parse of `RAW_CATALOG`). Any occasion Gemini judges as needing more polish than plain casual — a college presentation, a job interview, a first date — is forced to draw from this same narrow pool, because the wardrobe genuinely has nothing above it. This matches and extends Sprint 20's own "college vs. interview is wardrobe-capped" finding — the same ceiling was silently capping date-night too.
2. **No tie-breaking instruction when the ceiling is shared, and a real metadata gap**: the old `SYSTEM_PROMPT` only said "carefully reason about the occasion," with no guidance on what to do once two different occasions land on the identical formality tier. Worse, `formatWardrobeContext()` in `outfitStylist.ts` was not forwarding `item.pairingNotes` to Gemini at all — a per-garment field that already exists on every `GarmentItem` (both catalog-seeded items and real Gemini-vision-analyzed uploads carry it) and already contains genuinely differentiating styling language (e.g. white oxford: "lets trousers or denim lead" vs. stone taupe poplin: "layers cleanly under a jacket" vs. light blue poplin: "reads relaxed with denim"). Gemini had no explicit instruction to use color/fabric/tags as tie-breakers, and was missing one of the richest tie-breaking signals already sitting in the data.

Also independently confirmed (not previously documented): `catalogEntryToGarmentItem()` in `garmentCatalog.ts` silently drops the raw catalog's `style` field (e.g. "Streetwear Essential", "Classic Casual", "Collegiate Casual") when converting seed items to `GarmentItem` — that field never reaches `GarmentItem`, so it could never have reached Gemini regardless of `formatWardrobeContext`. Not fixed this sprint (see Remaining Risks) — resurrecting it would mean a new `GarmentItem` field, a vision-schema addition so uploaded photos get the same field, and validator/type updates, which is a larger structural change than this sprint's scope of "improve reasoning without redesigning data model."

This was not caused by: insufficient model selection, deterministic ordering bugs, missing profile/layering context (all confirmed still correctly threaded through, unchanged), or a validator regression (`validateAIOutfitResponse()` untouched, still strictly ID-checked).

### Implementation
Two minimal, additive changes — no UI, no architecture, no hardcoded occasion→outfit mapping:

1. **`server/geminiServer.js`** — `SYSTEM_PROMPT` rewritten with:
   - A new "OCCASION REASONING" section instructing Gemini to derive an occasion's *social context* (professional/academic vs. practical vs. social/romantic), *time of day/setting*, *practical demands*, and *degree/purpose of intentionality* from the user's own words — generically, for any input text, not via keyword-matching against the example occasions still listed for illustration. Explicitly states that two occasions which both sound "polished" (e.g. a date and a presentation) are not automatically the same styling problem.
   - A new strict rule (STRICT STYLING RULES #3): when multiple wardrobe items in a category are all plausible, choose in priority order — occasion fit → formality → color harmony → fabric/fit/silhouette → layering role → overall coherence — and explicitly: *"If two distinct occasions land on the same formality tier because the wardrobe has nothing higher, differentiate using color, fabric, fit, tags, and pairingNotes rather than defaulting to the identical combination for both."* This directly targets the confirmed wardrobe-ceiling scenario without naming any specific occasion.
   - This is the same `SYSTEM_PROMPT` used by both `generate-outfit` and `swap-garment` (shared constant, unchanged sharing), so swap reasoning benefits from the same tie-breaking guidance for free; `analyze-garment`'s vision prompt does not use `SYSTEM_PROMPT` and was not touched.
2. **`src/services/ai/outfitStylist.ts`** — `formatWardrobeContext()` now also forwards `pairingNotes: item.pairingNotes` per garment (one line). This is pre-existing data (already present on every `GarmentItem`, already generated by the vision endpoint for real uploads) that was simply never transmitted for outfit generation before — not a new metadata dimension, not a schema change, purely closing a transmission gap.

No changes to `validator.ts`, regenerate/exclusion wiring, the API-key architecture, `server/index.js`/`server/apiRouter.js`, or any screen/UI component.

### Occasion Reasoning Model
Generic, reusable dimensions (social context, time-of-day/setting, practical demands, intentionality-and-why) applied by Gemini to whatever text the user actually typed — works equally for "first date dinner," "date night," "casual dinner with someone," "college presentation," "presentation tomorrow," etc., since none of these strings are matched literally; the model derives the dimensions itself. No per-occasion branching was added anywhere in the codebase.

### Casual vs Travel Regression
`NOT RE-TESTED LIVE — QUOTA` (see Gemini Live Verification below). No code path touching casual/travel reasoning was changed — `SYSTEM_PROMPT`'s occasion-reasoning additions are occasion-agnostic (apply to every request identically), and the wardrobe-context change only adds a field, never removes or reorders existing ones — so Sprint 20's verified casual-vs-travel differentiation has no mechanism by which this sprint could have regressed it. Source-level confidence only; not re-confirmed against a live response this sprint.

### Date vs College
`NOT TESTED — QUOTA`. See Gemini Live Verification below for the real attempt made and why it couldn't complete.

### Wardrobe Validation
`PASS`. `validateAIOutfitResponse()` in `validator.ts` was not modified — every returned `garmentId` still must exist in the caller's actual wardrobe or it is rejected and logged (`"Rejecting invented item"`), regardless of how `SYSTEM_PROMPT` or the wardrobe payload changed. The `pairingNotes` addition only enriches what's sent to Gemini; it cannot influence what the validator accepts back.

### Build
`PASS` — `npm run build`, 0 errors.

### Lint
`PASS` — `npm run lint` (oxlint), 0 errors, 0 warnings.

### Remaining Risks
- **Live confirmation still owed** — the exact same free-tier quota that blocked Sprints 20/21 blocked this sprint too (see Gemini Live Verification). The reasoning/data fixes are grounded in a verified root cause (the wardrobe formality ceiling, confirmed by directly parsing the catalog) and are the correct fix in principle, but "first date dinner" and "college presentation" have not yet been observed to actually diverge against the real model since this change.
- **`style` field is silently dropped at seed-conversion time** (`catalogEntryToGarmentItem()` in `garmentCatalog.ts` never copies `entry.style` onto the `GarmentItem`) — a real, previously-undocumented metadata gap discovered this sprint. Deliberately not fixed here: doing so properly would require adding the field to the `GarmentItem` type, extending the vision-analysis schema so real uploaded photos get an equivalent classification (otherwise seed items and user items would be inconsistent), and validator/type updates — a larger, separate change than this sprint's scope.
- **Free-tier quota (20 requests/day/model) remains the top operational risk** for any live demo — unchanged from Sprints 20/21, not addressed this sprint (out of scope; this sprint's two attempted test calls both counted against it and both hit `429`).
- The women's wardrobe was not re-parsed for the same ceiling analysis (it does have exactly one `evening`-tagged item, unlike men's) — the men's-wardrobe-specific ceiling described above should not be assumed identical for the women's profile without checking.

### Next Priority
Re-run the two-call "first date dinner" vs. "college presentation" comparison against the real model once the free-tier quota resets, to confirm the `SYSTEM_PROMPT`/`pairingNotes` changes actually produce genuine divergence rather than just being well-reasoned in principle.

---

## Sprint 21 — Regenerate Exclusion Wiring

### Problem
Sprint 20 proved `excludeGarmentIds` works correctly on the real-Gemini path whenever it's populated (a manually-constructed regenerate request with exclusion produced a completely different, zero-overlap outfit). But neither `TodayScreen.tsx` nor `StylistScreen.tsx` ever actually populated it — every real Regenerate click sent `excludeGarmentIds: []` regardless of what was currently on screen, so live users got none of that benefit; variety only ever came from the demo engine's `seed`-cycling, which has no effect once a request actually reaches Gemini.

### Fix
Traced the flow exactly as instructed: `Today`/`Stylist` Regenerate → `runGeneration()` → `generateAIOutfitWithGemini()` (`src/services/ai/outfitStylist.ts`, unchanged) → `POST /api/ai/generate-outfit` → `server/geminiServer.js` (unchanged) → Gemini. The `excludeGarmentIds` field already existed end-to-end in `OutfitRequestOptions`, the HTTP payload, and the Gemini prompt construction (`userPrompt.excludedGarmentIds`) — confirmed no second exclusion mechanism needed to be built, only the one missing link: the UI never filled it in.

- `TodayScreen.tsx`: `runGeneration(promptText, seed, excludeGarmentIds = [])` gained a third parameter (default `[]`, so every existing call site — mount effect, occasion chips, custom prompt submit, error-retry — is unchanged). `handleSwapLook` (Today's regenerate-the-whole-look action) now reads `outfit.items.map(item => item.id)` from current component state and passes it through.
- `StylistScreen.tsx`: same pattern — `runGeneration(seed, excludeGarmentIds = [])`, and `handleRegenerate` now passes the current outfit's item IDs. `handleGenerate` (fresh Generate, seed 0) deliberately still passes none — a fresh Generate can follow a prompt/occasion change, and excluding an unrelated previous outfit's items would only get in the way, not help.
- Exclusion is read from live component state (`outfit`) at the moment each handler runs, so it's automatically never stale: Generate A → Regenerate A (excludes A) → Generate B (excludes nothing, fresh outfit) → Regenerate B (excludes B, not A) — no extra bookkeeping needed, this falls directly out of React's render/closure semantics.
- No garment ID is ever constructed, concatenated, or suffixed anywhere in this change — `excludeGarmentIds` is always a plain array of the real stable `.id` values already on the outfit, so there's no risk of the "garment-123-regenerated-regenerated" compounding failure mode the brief warned about.
- Did not touch the demo-fallback engine (`src/services/aiStylist.ts`) — its `StyleRequest` type has no `excludeGarmentIds` field and never will need one for this fix; the brief's scope is specifically the already-proven-working Gemini-side mechanism, not a second implementation for the offline fallback.

### Today
`VERIFIED` (by source tracing; see Live Gemini below for why not by a fresh live call). Today's regenerate control is the "Swap" button (whole-look regenerate, distinct from per-item category swap) — `handleSwapLook` now sends real exclusion.

### Stylist
`VERIFIED` (by source tracing). Stylist's "Regen" button — `handleRegenerate` now sends real exclusion. Both screens' Regenerate paths are fixed; this was not a Today-only or Stylist-only gap.

### Validation
`VERIFIED`. `excludeGarmentIds` flows only into the Gemini request payload — the response still passes through `validateAIOutfitResponse()` exactly as before (untouched this sprint), which still rejects any garmentId not present in the actual wardrobe regardless of what was excluded. Exclusion cannot bypass validation because it's never consulted by the validator at all; it only ever affects what Gemini is asked to avoid choosing.

### Live Gemini
`NOT TESTED — QUOTA`. Made exactly one targeted verification attempt (as the brief explicitly permits — not a suite): a real Generate followed by a real Regenerate call with `excludeGarmentIds` populated, through the actual running `npm run start` production server. Both calls returned a real `429 RESOURCE_EXHAUSTED` from Google (`generate_content_free_tier_requests`, limit 20/day/model) — the same quota Sprint 20 exhausted, still not reset. This is a real Google-side rejection, not a local/code error, which is itself evidence the request was constructed and dispatched correctly (a malformed payload from a wiring bug would more likely surface as a local error or a different Gemini-side rejection, not a clean quota block) — but it does not constitute a live confirmation that a real regenerate response actually honored the exclusion. That confirmation rests on Sprint 20's existing live test (which used a manually-constructed payload of the identical shape this sprint's code now sends automatically) combined with this sprint's source-level trace. No fabricated results are reported.

### Build
`PASS` — `npm run build`, 0 errors.

### Lint
`PASS` — `npm run lint` (oxlint), 0 errors, 0 warnings.

### Remaining Risks
- **Live confirmation still owed**: re-run the Sprint 20/21 regenerate test once the free-tier quota resets (or a paid tier is configured) to get an actual live confirmation of this specific code path, not just the equivalent manually-constructed one.
- **Today has no "same outfit" honesty message**: `StylistScreen` already tells the user honestly when a sparse wardrobe can't produce a different regenerate result (`isSameOutfit` check → info message); `TodayScreen`'s Swap does not have this, a pre-existing asymmetry flagged in earlier sprints and still out of scope here (targeted sprint, not a UX-parity pass) — now slightly more relevant since Today's regenerate is more likely to actually change results, making the sparse-wardrobe edge case more visible if it does occur.
- Free-tier quota (20 requests/day/model) remains the top operational risk for any live demo — unchanged from Sprint 20, not addressed this sprint (out of scope).

### Next Priority
Re-run one live Regenerate test end-to-end once quota allows, to move "Live Gemini" from `NOT TESTED — QUOTA` to a real confirmed result.

---

## Sprint 20 — Real Gemini Live Verification

### Gemini Connection
`CONNECTED` — but not on the first attempt. `node scripts/testGeminiIntegration.js` initially failed with `404 ... "gemini-2.5-flash is no longer available to new users"`. Queried `ai.models.list()` against the real key, empirically confirmed `gemini-flash-latest` works (plain text and `responseMimeType: 'application/json'` structured mode both tested directly against the SDK before touching app code), then applied the minimum fix: updated the one `GEMINI_MODEL` constant in `server/geminiServer.js` and the one hardcoded model string in `scripts/testGeminiIntegration.js`. Re-ran the integration test — real success: `"Gemini API Connection Test Successful: Hello, style icon!"`. Model used: `gemini-flash-latest` (Google's rolling alias — resolves server-side to `gemini-3.7-flash` per a later quota error message, so it won't go stale the way a pinned version number did here).

**Also found and fixed a real credential-hygiene issue before any of this**: the real API key had been placed in `.env.example` (tracked by git, not gitignored) instead of `.env`. Moved it to `.env`, restored `.env.example` to the placeholder. Confirmed via `git log --all --full-history -- .env` that `.env` has never been committed at any point, and via `git show <commit>:.env.example` that the user's own subsequent commit this session captured the clean placeholder version, not the key. No leak occurred, but it was one file-name-confusion away from one.

### Garment Vision
`VERIFIED`. Real photos from `public/test samples/men/` (not the demo fallback) through `POST /api/ai/analyze-garment`:

| Category | File | Gemini's Result | Accurate? |
|---|---|---|---|
| Top | Vintage Gray Tee.png | "Washed Charcoal Graphic T-Shirt", casual, base_layer, #767575 | Yes — correct garment type, plausible color read, sensible fabric/fit guess |
| Bottom | Black Cargo Pants.png | "Black Nylon Parachute Cargo Pants", casual, primary_layer, #1E1E1E | Yes — correct type and near-black color |
| Footwear | Leather Loafers.png | "Dark Espresso Leather Hybrid Penny Loafers", smart_casual, #322D2D | Yes — correct type; "dark espresso" is a reasonable read of the actual brown leather |
| Outerwear | Washed Denim Jacket.png | "Vintage Wash Relaxed Denim Jacket", casual, outer_layer, #4A6B8E | Yes — correct type, correct layering role |
| Accessory | Black Fisherman Beanie.png | "Black Ribbed Knit Beanie", casual, #181818 | Yes — correct type and color |

All 5 returned complete metadata (name/category/subcategory/color/hexColor/fabric/fit/formality/layeringRole/tags/aiConfidence/pairingNotes) — none were the demo fallback (`mode: "gemini"` on every response). Not verified through the actual browser upload UI this sprint (per standing no-browser-testing convention) — verified at the API layer, which is what actually determines correctness; the UI layer's handling of this response was already code-reviewed in the Sprint 18 audit.

### Outfit Generation
`VERIFIED`. All 6 occasion prompts returned real, valid, structured Gemini responses (see table below).

### Occasion Tests

| Occasion | Gemini Called | Valid Garments | Occasion-Aware | Result |
|---|---|---|---|---|
| casual weekend | Yes | Yes (5/5 valid IDs) | Yes | "Laid-Back Weekend Utility" — cream tee, olive cargo pants, trail runners, hobo bag, sunglasses |
| airport travel | Yes (1st attempt hit a transient `503 UNAVAILABLE`, real retry succeeded) | Yes (5/5) | Yes, strongly | "Transit Tech Minimalist" — explicitly reasoned about security-friendly layers, stretch fabric for flights, terminal-walking comfort, hands-free bag |
| college presentation tomorrow | Yes | Yes (4/4) | Yes | "Tailored Academic Poise" — light blue poplin shirt, cream trousers, loafers, crossbody bag |
| job interview tomorrow | Yes | Yes (4/4) | Partial | "Crisp Executive Poise" — swapped only the shirt (white oxford vs. light blue poplin, i.e. moved to the crisper of the wardrobe's 3 smart-casual tops); bottoms/shoes/bag identical to the college outfit — the wardrobe only has 3 smart-casual tops total, so this may be a wardrobe ceiling as much as a reasoning gap |
| first date dinner | Yes | Yes (4/4) | **No — flagged below** | "Effortless Evening Elegance" — garment IDs byte-identical to the college-presentation outfit; only the title/vibe/copy differed |
| night party | Yes | Yes (5/5) | Yes, strongly | "Midnight Edge" — full dark-monochrome streetwear swap (black tee, charcoal bomber, black parachute pants, white sneakers, black sling) |

### Casual vs Travel
Real, meaningful differentiation — not just cosmetic. Casual kept the cream tee but paired it with olive cargo pants, trail runners, a hobo bag, and sunglasses for a relaxed "errands" framing. Travel kept the same tee but added a charcoal zip hoodie as a removable layer, swapped in charcoal tech pants, kept the trail runners (genuinely practical for both), and swapped the hobo bag for a charcoal utility sling — with its own rationale explicitly citing "easy-to-remove layers for security," "stretch tech fabrics for long flights," "cushioned footwear for terminal walking," and "hands-free utility sling for passport and travel essentials." That's the model reasoning about mobility/practicality/security-line logistics specifically, not reusing the casual outfit's generic "running errands" framing. **Verdict: genuine differentiation, good quality.**

### College vs Interview
Real but thin differentiation, likely wardrobe-limited: only the shirt changed (white oxford for the interview vs. light blue poplin for college), everything else (cream trousers, loafers, crossbody bag) stayed identical. The wardrobe only contains 3 smart-casual-tier tops total, so there wasn't much room for the model to differentiate further even if it wanted to — this reads as the model making the one available formality-appropriate swap rather than failing to reason about the difference. **Verdict: correct direction, wardrobe-capped magnitude.**

### Date vs Party
Strong differentiation between these two — but see the negative finding above: "first date dinner" independently turned out identical to "college presentation," not to a `date`-appropriate look distinct from `party`. Party itself (all-black nightlife streetwear) was clearly and strongly distinguished from both. **Verdict: Party is well-differentiated; Date's reasoning collapsed into the same result as an unrelated occasion (college), which is the sprint's most notable AI-quality finding — see P1.**

### Swap
`VERIFIED`. Real request against a real generated outfit: asked Gemini to replace `cream_graphic_tee` (tops) from the casual-weekend outfit. It returned `washed_black_graphic_tee` — same category, a real wardrobe item, with a contextual rationale ("maintains the relaxed streetwear silhouette... complements the stone grey trail runners"). Confirmed the replacement ID exists in the wardrobe and matches the target category.

### Regenerate
`VERIFIED` (mechanism) with an important caveat already flagged in Sprint 18, now further confirmed with live data. Manually sending `excludeGarmentIds` populated with the first generation's IDs produced a completely different 5-item combination (zero ID overlap) — the exclusion mechanism itself works excellently when used. **However**: the actual app (`TodayScreen`/`StylistScreen`) still never populates `excludeGarmentIds` on a real Regenerate click (confirmed unchanged since the Sprint 18 audit) — so in-app Regenerate today does not get this real benefit from Gemini; variety currently comes only from the demo engine's `seed`-cycling, which doesn't apply once a request actually reaches Gemini. This is a concrete, actionable P1 for Sprint 21: wiring the already-working exclusion mechanism to real Regenerate clicks.

### Validator
`VERIFIED` — with a nuance. Stress-tested by giving Gemini only 2 wardrobe items and an occasion neither suited ("formal wedding" with only 2 casual tees available): Gemini did not invent a garment — it picked the single closest existing item and its own rationale honestly acknowledged the compromise ("While casual for a formal wedding dress code, the charcoal art tee serves as the most minimalist and tonal foundation available"). Gemini never attempted to invent an ID in any test this sprint, so the validator's actual *rejection* code path was not live-triggered — its correctness remains verified by code review (Sprint 18 audit) rather than by observing a real rejection. The "never invent" instruction held up under real adversarial-ish conditions regardless.

### Men / Women
`VERIFIED`. Generated `casual weekend` against both wardrobes independently: the men's result used only valid men's garment IDs, the women's result used only valid women's garment IDs, zero cross-contamination in either direction.

### Layering
`PARTIAL`. `avoid` was verified correct — a real women's-wardrobe generation with `layeringPreference: "avoid"` produced a valid outfit that correctly excluded `fitted_ribbed_tank_top` (the wardrobe's one `base_layer` item), selecting an Ivory Cropped Crew Neck instead. `sometimes` and `usually` could not be completed — both hit `429 RESOURCE_EXHAUSTED` (see Production/Security section) on first attempt and again on a retry 3 seconds later. Not a code defect; a real external quota wall reached mid-sprint. **Needs a follow-up pass once quota resets or a paid tier is configured.**

### Production Gemini
`VERIFIED`. `npm run build && npm run start` with the real key present: server log correctly reported `Gemini mode: LIVE (GEMINI_API_KEY configured)`, and every real-Gemini test above (vision, all 6 occasions, swap, regenerate, profile, partial layering) ran through this exact production server on port 3000 — not `npm run dev`, not a bypassed SDK call. This is the direct, concrete proof that Sprint 19's P0 fix actually works with a real key, not just architecturally.

### Security
`VERIFIED`, after fixing the near-miss described under Gemini Connection. Re-confirmed this sprint: zero occurrences of `GEMINI_API_KEY`/`GoogleGenAI`/`VITE_GEMINI` or key-shaped strings in `dist/assets/*.js`; `.env` gitignored and untracked (`git status --short .env` empty); `.env.example` contains only the placeholder; `.env` has never appeared in git history at any point (`git log --all --full-history -- .env` empty); the real key string appears nowhere in the repository except the gitignored `.env` file itself (repo-wide grep, excluding `.git`/`node_modules`/`dist`, confirmed empty). The key value itself was never printed in any tool output, log, or this document.

### Build
`PASS` — `npm run build`, 0 errors.

### Lint
`PASS` — `npm run lint` (oxlint), 0 errors, 0 warnings.

### Real free-tier quota constraint (new finding, not previously known)
The configured key is on Gemini's free tier: `generativelanguage.googleapis.com/generate_content_free_tier_requests`, quota id `GenerateRequestsPerDayPerProjectPerModel-FreeTier`, **limit 20 requests/day/model** for `gemini-3.7-flash` (the model `gemini-flash-latest` currently resolves to). This sprint's testing (5 vision calls + ~15 generate/swap/regenerate calls) exhausted it partway through the layering test. When exhausted, the server correctly returned `{"ok": false, "mode": "demo", "error": "...RESOURCE_EXHAUSTED..."}` rather than crashing — an unplanned but genuine, live demonstration that the demo-fallback safety net works under a real failure condition, not just a simulated one. This is now the single most important operational risk for any live demo.

### P0 — Blocking the real Gemini demo
1. **Free-tier quota (20 requests/day/model)** — exhausted mid-session by this sprint's own testing alone. A live demo involving multiple garment uploads and outfit generations could exhaust it during the demo itself, at which point the app silently and correctly falls back to demo mode — correct behavior, but with zero visible signal to the presenter or audience that "real AI" quietly stopped. Needs either a paid-tier key before any real demo, or an explicit plan to demo on a fresh quota window.
2. ~~Stale hardcoded model name (`gemini-2.5-flash`, 404)~~ — found and fixed this sprint (`server/geminiServer.js`, `scripts/testGeminiIntegration.js` → `gemini-flash-latest`). No longer open.

### P1 — AI-quality issues materially affecting the demo
1. **"First date dinner" produced an outfit byte-identical to "college presentation tomorrow"** — same 4 garment IDs, only the title/copy differed. Occasion reasoning did not differentiate a romantic dinner from an academic presentation for this wardrobe.
2. **Regenerate's exclusion mechanism isn't wired up in the app** — Gemini honors `excludeGarmentIds` excellently when it's sent (verified: zero ID overlap on a manually-excluded regenerate), but `TodayScreen`/`StylistScreen` never actually send it, so real users get no anti-repeat benefit from Gemini on Regenerate today (carried over from the Sprint 18 audit, now confirmed with live data that fixing it would actually work).
3. **College vs. Interview differentiation is thin** — only the shirt changed; likely wardrobe-capped (only 3 smart-casual tops exist) rather than a pure reasoning gap, but worth a wardrobe-breadth note for Sprint 21's prompt/selection tuning.

### P2 — Minor
1. No UI indicator of which mode (`gemini` vs `demo`) produced a given outfit — would make the P0 quota-exhaustion scenario observable instead of silent. Cheap, worth considering alongside the P0 fix.
2. `sometimes`/`usually` layering preference tests incomplete (quota-blocked, not failed) — re-run once quota resets.

---

### Architecture

**Before**: `vite.config.js`'s `geminiApiPlugin()` implemented only Vite's `configureServer` hook, which exists solely for `npm run dev`. `server/geminiServer.ts` was TypeScript, importable only through Vite/esbuild's transform — not runnable by plain Node. No `configurePreviewServer` hook, no standalone server, no `npm run start`. `vite.config.js` also never called `loadEnv()`, so `process.env.GEMINI_API_KEY` was never actually populated from a `.env` file in any mode, dev included — this had never been caught because no session had ever created a real `.env` file.

**After**:
- `server/geminiServer.ts` → **`server/geminiServer.js`** — mechanical type-stripping conversion (delete the old `.ts`, zero logic/prompt/schema changes), now runnable directly by plain Node. Confirmed via `grep` that `vite.config.js` was the only importer before deleting the `.ts`.
- **New `server/apiRouter.js`** — the `/api/ai/*` request-parsing + routing logic (previously duplicated inline in `vite.config.js`'s plugin) factored into one `handleApiRequest(req, res)` function operating on plain Node `http.IncomingMessage`/`ServerResponse`, so it's usable identically from both Vite's middleware and a raw `http.createServer` callback. This is now the one source of truth for HTTP-level dispatch, same as `geminiServer.js` is for Gemini prompt/schema behavior.
- **New `server/index.js`** — the production entry point. Plain Node `http` (no Express/Fastify/other framework, per the brief). Serves `dist/` with a small extension→MIME-type map, guards against path traversal (`path.normalize` + prefix check — verified live, see Production Mode below), falls back to `dist/index.html` for any unmatched GET (SPA fallback), and routes `/api/ai/*` through `handleApiRequest`. Reads `PORT` (default `3000`).
- `vite.config.js` — `geminiApiPlugin()` now just delegates to `handleApiRequest`; added `loadEnv(mode, process.cwd(), '')` + `process.env = {...process.env, ...env}` so `.env` actually reaches server code in dev (the bug above).
- `package.json` — new `"start": "node --env-file-if-exists=.env server/index.js"`. Zero new dependencies: `--env-file-if-exists` is a native Node 20.6+ flag (confirmed present on the Node 20.20.2 in this environment), silently skips loading if `.env` doesn't exist (verified — does not crash), so demo mode still works out of the box with no setup.
- `.env.example` — now lists only `GEMINI_API_KEY` (removed the stale, unused `VITE_GEMINI_API_KEY`/`VITE_AI_MODE` lines left over from before Sprint 12's security correction).
- `README.md` — added a real Setup/Development/Production section (previously default Vite-template boilerplate with no actual project instructions).

### Development
**Works.** `npm run dev` started cleanly (auto-selected port 5175 — 5173/5174 already occupied by leftover processes from earlier sessions, a known pre-existing condition, not caused by this sprint). Verified live: `GET /` → 200, and `POST /api/ai/generate-outfit` → correct demo-fallback JSON via the new shared `apiRouter.js` path.

### Production
**Works.** `npm run build && npm run start` verified live end-to-end this session:
- Server starts, correctly reports `.env not found. Continuing without it.` (no crash) and logs its demo/live mode.
- `GET /` → 200 `text/html`.
- Real built asset (`/assets/*.js`) → 200 `text/javascript`.
- Real wardrobe asset (`/wardrobe/men/tops/charcoal_art_tee.webp`) → 200 `image/webp`.
- Brand logo (`/brand/closiq-logo.png`) → 200 `image/png`.
- Unknown deep route → 200, correctly serves `index.html` (SPA fallback).
- Path-traversal attempt (`/../../../../etc/passwd`) → 200, confirmed by byte size (1143 bytes, matches `dist/index.html`) that it served the SPA fallback, **not** the real `/etc/passwd` (9344 bytes) — traversal guard verified effective, not just present.
- All three `/api/ai/*` endpoints → 200, correct `{"ok":false,"mode":"demo","error":"GEMINI_API_KEY not configured on server"}` (no key configured in this environment).
- Malformed JSON body → 500, generic error, no stack trace leaked.
- GET instead of POST on an AI route → 405.
- Unknown `/api/ai/*` sub-path → 404.
- Unrelated `/api/*` path → correctly falls through to SPA serving (confirms the router's `/api/ai/` prefix match is precise, not overly broad).
- Test server processes cleanly killed after verification; no `.env` file was created or left behind.

### Real Gemini
`LIVE GEMINI VERIFICATION BLOCKED — GEMINI_API_KEY NOT CONFIGURED`. No `.env` file exists anywhere in this environment (confirmed via `ls .env` before and after this sprint) and none was fabricated for testing, per explicit instruction not to fake this. All verification above is HTTP/architecture-level (endpoints reachable, demo-fallback path correct, security clean) — not a live Gemini response. Casual-weekend / airport-travel occasion-intelligence testing and the swap test from the audit brief remain untested against the real model for the same reason.

### API Endpoints
- `POST /api/ai/analyze-garment`
- `POST /api/ai/generate-outfit`
- `POST /api/ai/swap-garment`

All three confirmed reachable and functioning (in demo-fallback mode) through both `npm run dev` and `npm run start`, backed by the single `server/geminiServer.js` implementation.

### Security
- `grep` of `dist/assets/*.js` for `GEMINI_API_KEY`, `GoogleGenAI`, `VITE_GEMINI` → zero matches (re-verified after this sprint's changes).
- `grep` for API-key-shaped strings (`AIza...`) in the built bundle → zero matches.
- `.env` confirmed absent from the filesystem, `.gitignore` already covers `.env`/`.env.local`/`.env.*.local` (unchanged, already correct).
- Server logs (captured during testing) contain no key material — only mode status and a generic malformed-JSON warning.
- `.env.example` now contains only the placeholder `GEMINI_API_KEY` line — no client-exposed `VITE_`-prefixed variant exists anywhere in the codebase (verified by repo-wide grep, only historical `STATE.md` sprint-log mentions remain, correctly left untouched).

### Remaining Risks
- **Real Gemini has still never executed once in this project** — everything above verifies the *pipe* is now correct in both dev and prod; it does not verify Gemini itself returns well-formed, high-quality outfit/vision JSON under real load. First real key test should specifically watch for: (a) the `responseMimeType: 'application/json'` config actually producing parseable JSON every time, (b) the regenerate weakness flagged in the Sprint 18 audit (`seed`/`excludeGarmentIds` not forwarded into the Gemini prompt — still not fixed this sprint, was explicitly out of scope: "Do NOT modify the Gemini prompts unless required by the server migration," and this isn't required by the migration itself).
- `npm run preview` (Vite's own preview command) still won't serve `/api/ai/*` — it was intentionally left alone rather than modified, since `npm run start` is the new, correct production path and the brief didn't ask to fix `preview` specifically. Worth a one-line note if anyone reaches for `npm run preview` expecting AI to work.
- No process manager / restart-on-crash / graceful shutdown handling in `server/index.js` — appropriate for "smallest reliable architecture" at hackathon scale, but worth knowing before pointing real production traffic at it long-term.
- Ports 5173/5174 were already occupied by leftover dev-server processes from earlier sessions before this sprint even started — not caused by this work, but worth a `lsof -i :5173` cleanup check in a future session.

### Next Task
`Configure GEMINI_API_KEY and perform live Gemini verification`

---

## Feature Audit — Sprint 18 (2026-08-14)

Code-only completeness audit against `CLAUDE.md`/`STATE.md` requirements — **no application code, UI, or Gemini integration was modified this sprint**, per explicit instruction. Verified by reading source (`aiStylist.ts`, `validator.ts`, `geminiServer.ts`, `vite.config.js`, `garmentCatalog.ts`, every screen), grepping for leftover/dead references, and `npm run build` (✅ 330ms, 0 errors) / `npm run lint` (✅ 0 warnings, 0 errors).

**Implemented & verified**: core wardrobe/AI loop (upload → understand → collect → style → why-it-works → swap → save), Men/Women profiles with correct seed-vs-user-item preservation on switch, layering preference wired into both the demo engine and the real-Gemini system prompt, garment categories with no "Inners" category and tank tops correctly under Tops (`layeringRole: base_layer`), stable garment IDs (`.webp`, 58 catalog entries, no duplicate catalogs), strict server-side-only Gemini key handling (confirmed 0 `GEMINI_API_KEY`/`GoogleGenAI` strings in the built `dist/assets/*.js`, `.env` not present, `.gitignore` correct), demo-mode fallback on missing key, and dynamic (non-hardcoded) Style DNA / Wardrobe Insights.

**New findings this audit** (not previously documented):
1. **Real Gemini path is architecturally dev-server-only** — `geminiApiPlugin()` in `vite.config.js` only implements Vite's `configureServer` hook (dev), not `configurePreviewServer`, and there is no standalone server/serverless function. A `vite build` + `vite preview` or static-host deployment would 404 on every `/api/ai/*` call and silently run in demo mode regardless of whether `GEMINI_API_KEY` is set. The real Gemini path has never been exercised end-to-end in any session (no `.env` file has ever existed here).
2. **`excludeGarmentIds` is plumbed but never populated** — the type/server support "don't repeat this garment on regenerate" but no caller (`TodayScreen`, `StylistScreen`) ever fills it in; regenerate variety currently comes entirely from the demo engine's `seed`-based ranking cycle. Compounding this, `handleGenerateOutfitServer` never forwards `seed` into the actual Gemini prompt text either — so if the real path is ever reached, back-to-back Regenerate calls have no explicit anti-repeat signal at all (mitigated only by the client's `isSameOutfit()` honesty check in `StylistScreen`, which is itself not present in `TodayScreen`'s Swap).
3. **Saved outfits cannot be reopened** — `ProfileScreen`'s saved-look cards have a delete button only, no `onClick`/reuse action; §13's "saved outfit can be opened" is not implemented (Planner's "assign a saved look to a day" is an adjacent but different capability).
4. **`OutfitExplanation`'s `colorHarmony`/`silhouette`/`weatherSuitability`/`versatilityNote` fields are dead code** — never rendered anywhere (only `.summary` is shown); hardcoded static strings in the demo engine, partially real in the Gemini path. Zero user-facing impact today, but not "real" data as the type implies.
5. **Two documentation-drift nitpicks**: `.env.example` still lists `VITE_GEMINI_API_KEY` even though it was removed from actual use in Sprint 12; `garmentCatalog.ts`'s file-header comment still describes PNG symlinks even though Sprint 15 converted everything to real (non-symlink) `.webp` files.
6. **P2 backlog correction**: STATE.md's own P2 list says "Persist saved looks to LocalStorage across browser sessions" is still open — it is not; `App.tsx` already persists `savedOutfits` to `localStorage` (`closiq_saved_outfits`) and has since early sessions. Leaving the stale backlog line in place below rather than silently deleting it (audit rule: don't rewrite history) — treat it as resolved.
7. **Nav/palette section-number drift, not a bug**: this audit prompt's own §15/§17 assumed a 4-tab Today/Collection/Stylist/Profile nav and a "Sage × Cream" palette — both were deliberately superseded by the user in Sprint 17 (now 5 tabs — Home/Wardrobe/AI Stylist/Planner/Profile — and a Warm Ivory × Taupe palette, both documented in `CLAUDE.md` §3/§4). Verified the *current* implementation for internal consistency instead of the prompt's outdated assumption, per the audit's own "verify against the actual implementation" rule.

**Full findings, feature matrix, and prioritization**: see chat response for this turn (not duplicated here in full to keep this file from growing unbounded — this entry is the durable summary/pointer).

---

## Real Gemini Verification Summary
* **Real Gemini Status**: `CONNECTED` — live-verified Sprint 20, real key configured, model fixed to `gemini-flash-latest`. Free-tier quota (20 req/day/model) exhausted partway through this session's testing — see Sprint 20 for the layering-preference tests left incomplete because of it.
* **Garment Vision Service**: `VERIFIED` — 5 real photos across all 5 categories, real Gemini responses, metadata checked against the actual images. Sprint 23 added a `style` field to the vision JSON schema after that verification ran — not yet re-confirmed live (see Sprint 23).
* **Outfit Generation Service**: `VERIFIED` — all 6 required occasion prompts produced real, valid Gemini responses.
* **Occasion Reasoning Pipeline**: `IMPROVED, LIVE RE-VERIFICATION PENDING` — Sprint 20 found "first date dinner" identical to "college presentation" (real AI-quality gap). Sprint 22 root-caused it to a genuine men's-wardrobe formality ceiling (zero `formal`/`evening` items) combined with a missing tie-breaking instruction and an untransmitted `pairingNotes` field, and fixed both in `server/geminiServer.js` and `outfitStylist.ts`. Sprint 23 closed a related gap — the catalog's `style` descriptor was silently dropped before ever reaching `GarmentItem` or Gemini — and now forwards it as a further tie-breaking signal. Sprint 24 added an aggregate `wardrobeSummary` (formality/category/layering coverage) plus an explicit honesty rule so Gemini acknowledges (rather than papers over) a weak/none formality tier. None of these fixes yet re-confirmed against a live response — blocked by the same free-tier quota (see Sprints 22–24).
* **Swap Pipeline**: `VERIFIED` — real replacement, correct category, valid ID, contextual rationale.
* **Regenerate/Exclusion Pipeline**: `VERIFIED` the underlying mechanism works well when `excludeGarmentIds` is populated — **correcting an earlier overclaim**: the app itself still never populates it on a real Regenerate click (Sprint 18 finding, unchanged), so live in-app Regenerate does not yet get this benefit. Not "exclusion handling active" as previously stated here.
* **Validator Safety**: `VERIFIED` by code review + real adversarial testing (Gemini never attempted to invent a garment even when given only 2 unsuitable items) — the actual rejection code path was never live-triggered since nothing needed rejecting.
* **Credential Architecture**: `VERIFIED` — 100% server-side, 0 secrets in client JS, re-confirmed post-Sprint-20. (A real key briefly landed in the tracked `.env.example` instead of `.env` mid-session — caught and fixed before any commit captured it; see Sprint 20.)

---

## Next Priority Task
* **Task**: Once the free-tier quota resets — run "job interview" and "first date dinner" live and check two things at once: (1) whether `whyItWorks` now honestly names the men's wardrobe's formal/evening gap (Sprint 24) instead of implying a formal look, and (2) whether the outfits meaningfully diverge from each other (Sprint 22/23). Also upload one real photo to confirm the vision endpoint's `style` field (Sprint 23) returns sensible values, and re-test the `sometimes`/`usually` layering cases (pending since Sprint 20).

---

## Completed Work

- [x] **Sprint 17 — Warm Ivory × Taupe Redesign, 5-Tab Nav, Outfit Planner** (this session):
  - **Second re-palette of the same day**: a new reference-image-driven brief called for a different, more specific palette than Sprint 16's sage — warm ivory/cream background, taupe/beige surfaces, deep charcoal text, muted brown/olive accent. Rewrote `src/index.css` again: `--color-primary` #1F3A2B (forest green) → `#6B5A3D` (muted olive-brown); `--color-bg` sage `#C7CDAE` → warm ivory `#F7F2E9`; `--color-surface` cream `#FBF8F0` → taupe/beige `#EFE7D9`; `--color-text-primary` → deep charcoal `#2B2723`. Added a proper `--color-danger` token (`#A8493B`) and swapped every hardcoded `#D9534F`/`rgba(217,83,79,...)` error-red across `StylistScreen`, `AddItemModal`, `ClothingDetailModal` to reference it — these had been missed in Sprint 16. Dark mode recolored to match (muted gold-olive primary `#C6A876` on deep warm charcoal). Full new hex values in `CLAUDE.md` §4.
  - **Bottom nav expanded 4→5 tabs**: `BottomNavigation.tsx` now shows Home / Wardrobe / AI Stylist / Planner / Profile (relabeled from Today/Collection/Stylist/Profile, plus the new Planner destination) with new icons (`Home`, `Shirt`, `Sparkles`, `CalendarDays`, `User`). **Deliberately kept the internal `NavTab` keys unchanged** (`today`/`collection`/`stylist`/`planner`/`profile`) rather than renaming them to match the new labels — this was a scope call to avoid touching every `activeTab === 'today'` conditional in `App.tsx` and every screen for a change that's purely cosmetic (visible label vs. variable name); the label is what the brief actually specified. The AI Stylist tab carries a permanent soft `--color-primary-alpha` background/icon tint even when inactive (brief: "can be visually emphasized subtly"). This is a permanent architecture change — **`CLAUDE.md` §3 updated**, superseding the old "exactly 4 tabs, do not rename" rule from the original brief, since the user's new prompt explicitly specified 5 named tabs.
  - **New Outfit Planner feature — not just a re-theme**: added `WeekDay`/`WeeklyPlanEntry` types (`src/types/wardrobe.ts`), `weeklyPlan` state in `App.tsx` persisted to `localStorage` (`closiq_weekly_plan`, same pattern as every other piece of app state), and a brand-new `PlannerScreen.tsx` — 7 rows (Mon–Sun), each with an editable free-text occasion label (plain controlled `<input>`, no new validation needed) and an optional outfit slot. Assigning a day's outfit opens an inline picker strip listing the user's actual `savedOutfits` (no invented data — if there are none yet, the picker shows a message + a shortcut into the Stylist tab instead of an empty dead-end). Handlers (`handleUpdatePlanLabel`/`handleAssignPlanOutfit`/`handleClearPlanOutfit`) added to `App.tsx` alongside the existing wardrobe/outfit handlers, same shape/conventions.
  - **"Wear this" is a real action, not just a label**: `Outfit.wornToday` and `GarmentItem.wearCount` already existed in the types but `wearCount` was initialized to 0 and never once incremented anywhere in the codebase (confirmed by grep before writing this). Added `handleWearOutfit` in `App.tsx` — increments `wearCount` for every item in the outfit being worn — wired to a new primary "Wear this" button on `TodayScreen` (replacing "View Outfit" as the hero CTA; View/Swap/Save moved into a 3-column secondary row, reusing the exact layout pattern already proven safe at 375px in `StylistScreen`'s Save/Regen/Details row). Button shows a "Worn Today" confirmed state (tracked via local `wornOutfitId`, reset whenever `outfit.id` changes) so repeated taps on the same outfit can't double-count.
  - **Today screen enrichment**: dynamic time-of-day greeting (`getGreeting()` — was hardcoded "Good afternoon" regardless of actual time); a small weather chip showing `outfit.temperature°` (surfaces an already-existing-but-previously-unused field, same category of change as `wearCount`/`wornToday` — not a new fabricated data source); a "Try a different look" quick-shortcut row (other occasions minus the active one); a horizontal "Recently added" rail (top 8 wardrobe items by `dateAdded`, tappable into `ClothingDetailModal` via a newly-threaded `onSelectItemDetail` prop); and a Wardrobe Insights teaser card (item count + most common color, tappable into Profile via a new `onNavigateToProfile` prop). All purely additive reads of existing wardrobe/outfit data — no new AI calls.
  - **Style dimension added to AI Stylist**: new `STYLE_OPTIONS` chip row (Minimal/Streetwear/Smart Casual/Vintage/Athleisure) in `StylistScreen.tsx`, toggleable (click again to deselect). Folds into the natural-language prompt sent to `generateAIOutfitWithGemini` (`${basePrompt} — ${style} style`) rather than adding a second filtering dimension to the scoring engine — this reuses the exact mechanism Occasion chips and free-text already use (the demo engine's `resolveTargetFormality` does keyword regex over the prompt string), so no changes to `aiStylist.ts`'s scoring/selection logic were needed or made. Relabeled the existing chip row from "Contextual Suggestions" to "Occasion" for clarity now that there are two chip dimensions.
  - **Onboarding expanded to 2 steps**: new `welcome` step (large "Your wardrobe. Understood." headline, 3 feature bullets, "Get Started" CTA) before the existing profile/layering picker (`setup` step, unchanged logic), with a 2-dot progress indicator and a Back link. No change to what data onboarding collects or how `onComplete(profile, layering)` fires.
  - **Profile restructured into a hub**: added a "Quick Links" row (My Wardrobe / Outfit Planner cards, navigating via new `onNavigateToCollection`/`onNavigateToPlanner` props from `App.tsx`) right under the Style Archetype card. Grouped the old separate "Wardrobe Profile" and "Layering" sections under one new "Style Preferences" section header sharing a single card. Renamed "Preferences" → "Settings" and added a static, honestly-labeled "Notifications — Coming soon" row above the existing (fully functional, unchanged) Appearance Theme toggle — no fake notification backend was built.
  - **Copy consistency fixes**: since the Wardrobe tab is now literally labeled "Wardrobe" (not "Collection"), renamed `CollectionScreen`'s on-screen H1 "My Collection" → "My Wardrobe" and `AddItemModal`'s step-1 title/confirm-button from "Add to Collection"/"Confirm & Add to Collection" → "Add to Wardrobe" (also matches the brief's literal example CTA) — internal code identifiers (`CollectionScreen`, `closiq_wardrobe` localStorage key, etc.) were left alone; only user-facing copy changed.
  - **Zero AI/data-engine changes**: no edits to `src/services/ai/*`, `src/services/aiVisionScanner.ts`, `src/data/garmentCatalog.ts`, `vite.config.js`, or any Gemini/server code. The only `src/types/wardrobe.ts` change was purely additive (`WeekDay`/`WeeklyPlanEntry`) — no existing field was renamed, removed, or retyped.
  - **`npm run build` and `npm run lint` verified clean** after every meaningful change this session (7+ rebuilds); 0 errors, 0 warnings throughout.
  - **Live browser verification explicitly declined this session** — the user's own words: "dont check anything in the browser and stuff just mae the code changes that are requested." Unlike Sprint 16 (pure re-theme), this sprint shipped genuinely new interactive surfaces — the Planner's assign/clear picker, the Wear-this confirmed-state toggle, the Style chip toggle-and-fold-into-prompt behavior, the 2-step Onboarding flow — none of which have been clicked once. See Known Risks for the specific list.

---

- [x] **Sprint 16 — Sage × Cream Editorial Redesign**:
  - **New design token system** (`src/index.css`): replaced the all-ivory/emerald palette with a two-tier system — a muted warm sage "environment" (`--color-bg` `#C7CDAE` light / `#0D1712` dark) that the app canvas, header, and bottom nav sit on, and a warm cream/ivory `--color-surface` (`#FBF8F0` light / `#17221C` dark) that every card, modal, and input floats on top of as the dominant *content* surface — matching the brief's "sage environment, cream surface, green reserved for accents/typography/buttons" direction. `--color-primary` moved from the old single emerald to a deep forest green in light mode (`#1F3A2B`) and a softer sage-green in dark mode (`#5AA37E`, with dark-on-light text for contrast against its own brighter tone). Added `--radius-xl` (26px) for bottom-sheet modals and the new floating nav dock. Shadows retuned (darker/more opaque) so cream cards read as elevated against the mid-tone sage canvas instead of a near-white background. Typography (Playfair Display headings / Plus Jakarta Sans body) was already brief-compliant and untouched. Full rationale and final hex values documented in `CLAUDE.md` §4.
  - **New `SegmentedControl` component** (`src/components/ui/SegmentedControl.tsx`): a single reusable pill-track selector (generic over any string union), used to replace `ProfileScreen`'s old 2-button/3-button CSS-grid selectors for Wardrobe Profile (Men/Women) and Layering Preference — same state/handlers, purely a presentational swap to the "segmented selector or pill control" the brief asked for. Onboarding's larger Men/Women tile-cards were deliberately left as bigger tap targets (first-impression moment, not a settings control) — just re-themed via tokens.
  - **`BottomNavigation.tsx` rebuilt as a floating cream pill dock**: was a full-bleed bar flush to the screen edges; now a `16px`-inset, `--radius-xl`-rounded, `--shadow-lg`-elevated cream capsule with a soft primary-alpha highlight pill behind the active tab's icon+label. Exactly the same 4 tabs (Today/Collection/Stylist/Profile) and the same `activeTab`/`onTabChange` contract — no navigation behavior changed. `.app-shell`'s `padding-bottom` bumped 84px→104px in `index.css` to keep content clear of the now-floating dock.
  - **`TodayScreen` outfit card rebuilt as hero-first editorial composition** (the brief's explicit ask for the app's most important screen): the old 2-column grid of equal-size garment tiles is now a full-width ~300px hero image (always the outfit's top piece — confirmed from `generateAIOutfit`'s fixed `[selectedTop, selectedBottom, selectedShoes, selectedOuter, selectedAcc]` item ordering in `src/services/aiStylist.ts`, so this is safe without changing the AI engine) with a gradient name/category caption overlay, and the remaining pieces as a smaller supporting-row grid underneath. Pure presentation change — `outfit.items` is read the same way, no new AI/data logic. `StylistScreen` deliberately keeps its existing 2-column equal-size grid (documented decision, not an oversight): each tile there carries its own inline "Swap" trigger and the swap-picker strip needs to anchor under a specific tile, which a variable-size hero layout would complicate; Stylist and Today already share identical card chrome (tokens, radii, shadows), so the two screens still read as one system despite the different information density.
  - **Consistent "no dashed borders" pass**: replaced every dashed empty-state/dropzone border (`EmptyState.tsx`, `AddItemModal.tsx`'s Take Photo/Upload Photo tiles, `ProfileScreen`'s empty Saved Looks placeholder) with a solid border + soft shadow — dashed borders read as wireframe/placeholder rather than premium editorial, called out as an anti-pattern to avoid in the brief.
  - **Card/modal radius and imagery polish**: `ClothingCard` (Collection grid) radius bumped `--radius-md`→`--radius-lg` and image height 210px→228px for more "large clothing imagery" presence per the brief; its color-tag overlay pill recolored from flat black to a forest-green-tinted `rgba(20,32,24,0.72)` to stay on-brand. Both bottom-sheet modals (`AddItemModal`, `ClothingDetailModal`) bumped their top-corner radius to the new `--radius-xl`. `AppHeader` swapped its hard `border-bottom` for a touch more breathing-room padding (no border), since the header now sits directly on the sage canvas rather than needing a hard line against a near-identical ivory background.
  - **Zero functional/AI changes**: no edits to `src/services/ai/*`, `src/services/aiStylist.ts`, `src/services/aiVisionScanner.ts`, `src/data/garmentCatalog.ts`, `src/types/wardrobe.ts`, `vite.config.js`, or any Gemini/server code. Every screen's data flow, generation, swap, save, and layering-preference logic is byte-for-byte unchanged — confirmed by diffing that all edited files only touch `style`/JSX-presentation code, never handlers, state shape, or service calls.
  - **`npm run build` and `npm run lint` verified clean** after every change this session (multiple rebuilds); no TypeScript compiler is configured as a separate check in this project (`vite build` alone doesn't type-check), consistent with how every prior sprint in this file verified.
  - **Live browser verification NOT performed this session** — per the standing project preference recorded in memory (`feedback-no-browser-verification`, set 2026-08-13 after repeated explicit user instructions), verification here is code-review + `npm run build`/`npm run lint` only, same standard as Sprint 13. This is a materially higher-risk sprint to skip visual verification on than most prior ones, since the entire point of the work is a color/contrast/layout overhaul — see Known Risks.

---

## Completed Work

- [x] **Sprint 12 — Gemini Security Correction & Server API Boundary**:
  - Created server-side API handler `server/geminiServer.ts` reading `GEMINI_API_KEY` strictly via Node's `process.env`.
  - Added Vite server middleware plugin `geminiApiPlugin()` in `vite.config.js` handling `/api/ai/analyze-garment`, `/api/ai/generate-outfit`, `/api/ai/swap-garment`.
  - Refactored client services (`src/services/ai/geminiClient.ts`, `src/services/ai/wardrobeVision.ts`, `src/services/ai/outfitStylist.ts`) into lightweight HTTP proxies calling `/api/ai/*`.
  - Removed `VITE_GEMINI_API_KEY` and verified 0 secrets in production `dist/` bundle.
  - Retained strict client-side validation (`validator.ts`) and seamless demo fallback on network/missing-key errors.
  - Verified `npm run build` (352ms, 0 errors) and `oxlint` (0 warnings, 0 errors across 36 files).

---

## Completed Work

- [x] **Sprint 11 — Real AI Integration — Gemini Multimodal Wardrobe + Stylist**:
  - Installed `@google/genai` package and built modular AI architecture (`src/services/ai/geminiClient.ts`, `src/services/ai/wardrobeVision.ts`, `src/services/ai/outfitStylist.ts`, `src/services/ai/validator.ts`).
  - Secured API key handling via `GEMINI_API_KEY` / `VITE_GEMINI_API_KEY`, created `.env.example`, updated `.gitignore`.
  - Connected `AddItemModal.tsx`, `TodayScreen.tsx`, and `StylistScreen.tsx` to the unified AI abstraction layer with seamless loading UI states and fallback handling.
  - Verified clean build (`npm run build` 441ms) and 0 linter errors/warnings (`oxlint` 0 errors, 0 warnings).

---

## Completed Work

- [x] **Sprint 10 — Final Hackathon Demo Dry-Run**:
  - Executed full 21-step end-to-end demo dry-run from clean application state.
  - Verified clean launch, official CLOSIQ logo plate, splash animation, Men/Women profile switching, Add Item AI vision scanner flow, Collection gallery, Today AI styling engine, Why It Works rationale, Swap item interaction, Saved Looks persistence, Layering Preference rules, responsive mobile/desktop shell, and light/dark theme contrast.
  - Verified 0 build errors (`npm run build` 748ms, `dist` size: 2.2 MB) and 0 lint warnings/errors (`oxlint` 0 errors, 0 warnings).

- [x] **Sprint 9 — Responsive + Theme + Cross-Screen QA**:
  - Tested screen hierarchy across 375px, 390px, 414px, 768px, and 1024px+ viewports.
  - Verified Light Mode (warm ivory `#FAF8F5`) and Dark Mode (dark green-black `#0B100E`).
  - Added WAI-ARIA labels to theme toggle, bottom navigation, modal close buttons, and keyboard interaction to garment cards.

---

## Remaining Risks & Mitigations
* **LocalStorage Upload Quota**: Uploading high-resolution camera photos via base64 `data:` URLs consumes `localStorage` quota. Demo users are encouraged to use quick-add samples or standard photo sizes. Low severity for demo flows.

- [x] **Sprint 15 — Wardrobe Asset Performance Optimization**:
  - **Asset Optimization**: Converted 58 uncompressed 15MB PNG garment images into web-optimized WebP format (`quality=85`, max dimension 1000px).
  - **Asset Size Reduction**: Reduced `public/wardrobe/` asset folder from 431 MB to **1.5 MB** (**99.65% reduction**).
  - **Production Build Size**: Reduced production `dist/` bundle size from 876 MB to **2.2 MB** (**99.7% reduction**).
  - **Raw Source Preservation**: Kept `public/test samples/` (444 MB source archive) **100% untouched**.
  - **Vite Config Optimization**: Added `remove-test-samples-from-dist` plugin in `vite.config.js` using `import.meta.dirname` to eliminate build deprecation warnings.
  - **Garment Catalog Integration**: Updated `getGarmentImagePath()` in `src/data/garmentCatalog.ts` to map stable IDs directly to `.webp` paths.
  - **Verification**: `npm run build` succeeds cleanly in 316ms; `npm run lint` (`oxlint`) passes with 0 errors and 0 warnings across 29 files.

- [x] **Sprint 1 — Design System & Application Shell**:
  - Centralized design tokens for Light mode (Ivory `#FAF8F5`, Emerald `#0D3B2E`) and Dark mode (`#0B100E` green-black).
  - Serif headings (*Playfair Display*) + Geometric sans body (*Plus Jakarta Sans*).
  - 4 primary navigation tabs (**Today**, **Collection**, **Stylist**, **Profile**).
  - Mobile viewport container shell with border elevation.
- [x] **Sprint 2 — Today Experience**:
  - Header greeting (*"Good afternoon, Pranav. Let's find your look. What are you dressing for?"*).
  - Contextual occasion chips (*College, Work, Date, Party, Casual, Travel*) and free-form prompt input.
  - Today's Look recommendation card with **Style Match Score**, visual clothing cards, *"Why it works"* rationale, and View/Swap/Save actions.
  - Empty state handling when wardrobe is empty (*"Your wardrobe is waiting."*).
- [x] **Sprint 3 — Digital Collection**:
  - "My Collection" gallery displaying owned items with zero ecommerce elements.
  - Category chips filter (*All, Tops, Bottoms, Footwear, Outerwear, Accessories*) and inline search toggle.
  - **Add Item Flow**: Photo upload / camera simulation, *"Understanding your garment..."* AI Vision state, and attribute confirmation.
  - **Clothing Detail Drawer**: Displays large photo, metadata, *"Best paired with"* recommendation, and *"Used in X outfits"* metric.
- [x] **Sprint 4 — AI Stylist Core**:
  - AI Outfit Generator sourcing garments **strictly from the user's wardrobe**.
  - Natural language rationale generator.
  - Single-garment **Swap** interaction replacing one item while maintaining outfit harmony.
- [x] **Sprint 5 — Personalization & Final Polish**:
  - **Style DNA**: Visual progress bars representing inferred aesthetic tendencies.
  - **Intelligent Wardrobe Insights**: Closet color breakdown and mix-and-match advice.
  - **Saved Looks**: Saved outfits management.
  - Seamless Light/Dark theme switching.
- [x] **Sprint 14 — Today + Profile + High-Impact UX Polish** (requested as "Sprint 8" in the brief):
  - **Today Screen Audit**: Verified header hierarchy (*"Good afternoon, Pranav."* → *"Let's find your look."* → *"What are you dressing for?"*), contextual occasion chips (*College, Work, Date, Party, Casual, Travel*), free-form request input, AI result hero card with stable garment images, style score, vibe, rationale, swap/save buttons, and empty state CTA.
  - **Profile Layering Preference**: Updated option label from `'Avoid'` to `'Avoid base layers'` (`ProfileScreen.tsx`) matching exact brief requirements.
  - **Dynamic Style DNA**: Replaced static placeholder numbers with dynamic score calculation (`calculateStyleDNA`) derived from closet color ratio, tailoring pieces, layering preferences, and saved outfits.
  - **Dynamic Wardrobe Insights**: Replaced hardcoded text with real dynamic closet analysis (`calculateWardrobeInsights`) counting anchored color tones, top/bottom ensemble combination math, star item versatility, and layering rules.
  - **Saved Looks Integration**: Verified real saved outfit state rendering (title, occasion, vibe/formality style line, item thumbnails, explanation summary, remove button) from `savedOutfits`.
  - **Brand & UX Polish**: Verified `ClosiqLogo` and `SplashScreen` integration; fixed oxlint warnings in `PrimaryButton.tsx` and `aiStylist.ts` to achieve 0 warnings and 0 errors across 29 files.
- [x] **Sprint 6 — Wardrobe Profiles, Layering & Browser Verification**:
  - Men/Women wardrobe profiles with profile-scoped `GARMENT_CATALOG` (`src/data/garmentCatalog.ts`).
  - Nested asset structure `public/wardrobe/<profile>/<category>/<id>.png` with graceful `GarmentImage` placeholder fallback when PNGs are absent.
  - Stable garment IDs resolved via `getGarmentImagePath()`.
  - `layeringRole` (`base_layer`/`primary_layer`/`outer_layer`) on catalog entries; tank tops correctly filed under **Tops**, no "Inners" category.
  - `LayeringPreference` (`avoid`/`sometimes`/`usually`) set at onboarding and editable in Profile; wired through `App.tsx` → `aiStylist.generateAIOutfit()`.
  - Profile switch (`handleChangeProfile`) swaps only auto-seeded items, never touches user-photographed/uploaded items.
- [x] **Sprint 7 — Official Brand Logo & Launch Splash**:
  - Official CLOSIQ wordmark asset (brain integrated into the Q) provided by the user at the project root (`logo.png`) and moved into the official location `public/brand/closiq-logo.png`. A separate `~/Downloads/closiq-wordmark.svg` was found first and **rejected** as not matching the brand (plain diagonal Q-tail, no brain motif, wrong sky-blue/rose palette) — flagged rather than used.
  - `ClosiqLogo` (`src/components/ui/ClosiqLogo.tsx`): reusable wordmark component. Wraps the asset in a `#F5F6F2` plate matching its own baked-in (opaque, non-transparent) background so it reads with zero seam in both light and dark mode without altering the artwork.
  - `SplashScreen` (`src/components/ui/SplashScreen.tsx`): fade/scale entrance → ~650ms hold → 350ms fade-out (~1s total, within the 1–2s target). Respects `prefers-reduced-motion` (150ms/150ms near-instant fade). Overlays `.app-shell` via `position: absolute`, so it's scoped to the mobile shell, not the full viewport.
  - Wired into `src/App.tsx` via a plain `showSplash` state initialized `true` on mount — fires on initial load and every reload by construction, and never on in-app tab navigation (tab switches don't remount `<App>`).
  - `CLAUDE.md` updated with new permanent **§5 Brand Identity & Launch Experience** section (existing §5–14 renumbered to §6–15).
- [x] **Sprint 8 — Real Wardrobe Asset System (catalog schema completion)**:
  - `CatalogEntry` (`src/data/garmentCatalog.ts`) now explicitly carries every requested field: `id` (= garmentId — the stable identity the AI and every screen key off, never the filename), `profile`, `category`, `subcategory`, `name` (= displayName), `color`, `fit`, **`style`** (new — short descriptor, e.g. "Streetwear", "Tailored Modern", added to all 20 entries), and `layeringRole`.
  - **`imagePath`** (new) is now a materialized field on every `GARMENT_CATALOG` entry, derived once via `RAW_CATALOG.map(...)` from `getGarmentImagePath(id, profile, category)` — single source of truth for the id→path formula stays in one function; nothing hardcodes a path string.
  - `AddItemModal.tsx` simplified to read `entry.imagePath` directly instead of recomputing it via `getGarmentImagePath()` at each call site.
  - Confirmed `public/wardrobe/<men|women>/<tops|bottoms|outerwear|footwear|accessories>/` structure matches spec exactly; still only `.gitkeep` placeholders, no PNGs (team adds those manually, per instructions).
  - Missing-asset handling reconfirmed as the existing `GarmentImage` onError → on-brand placeholder (icon + category label). Deliberately did **not** add a separate manually-maintained "asset present?" boolean to the catalog — it would duplicate/risk drifting from the real filesystem state; the runtime fallback can never go stale. Documented this decision in `public/wardrobe/README.md`.
  - Deliberately did **not** rename `id`→`garmentId` or `name`→`displayName` across the codebase — those fields already serve exactly that role everywhere (React keys, dedup, AI, save/swap logic); a cosmetic rename would touch ~15 files for zero functional gain and risk regressions. Documented the equivalence in code comments and here instead.
- [x] **Sprint 9 — P0 Core Demo Flow Hardening**:
  - **Single outfit engine confirmed**: Today and Stylist both call `generateAIOutfit()` (`src/services/aiStylist.ts`) — no separate/static outfit system exists. Verified live: generating the same wardrobe on both screens produces the identical outfit and the same "Saved" state.
  - **Real bug fixed — wrong-category fallback removed**: `generateAIOutfit()` used to fall back to `wardrobe[0]`/`wardrobe[1]`/`wardrobe[2]` when a category (bottoms/shoes) was empty, which could silently insert a wrong-category item into the outfit or (via `Set` dedup collapsing to a single item) crash `calculateStyleMatchScore` on an `undefined` entry. Fixed: each slot is now `undefined` when its category is empty and simply omitted — never backfilled from a different category.
  - **New: sparse-outfit graceful UX**: `Outfit.missingCategories` (new field, `src/types/wardrobe.ts`) records which of tops/bottoms/shoes had nothing to draw from. Today and Stylist both render a small inline note ("Add bottoms and footwear to your Collection for a more complete look.") via a new shared `formatCategoryList()` helper in `aiStylist.ts` — verified live with a single-item wardrobe.
  - **Generation failure hardening**: `runGeneration`/`handleGenerate`/`handleRegenerate`/`handleSwapPiece` in both screens now wrap `generateAIOutfit`/`swapGarmentInOutfit` in try/catch/finally, so `isGenerating` can never get stuck `true` (a silent UI freeze) and a real error banner + Retry button shows instead.
  - **Real bug fixed — uploaded photo persistence**: `AddItemModal.tsx` used `URL.createObjectURL(file)` for uploaded photos, which only stays valid for the current page session — after any reload the `blob:` URL is dead even though its string is still sitting in `localStorage`, silently breaking the "real uploaded images must remain attached" requirement. Switched to a `FileReader`-based base64 `data:` URL, which survives `JSON.stringify`/`localStorage`/reload. Verified live: uploaded a real image, reloaded the page, photo still rendered correctly in both Today's outfit card and Collection.
  - **New error states in Add Item flow**: file-type validation (rejects non-images with a friendly message instead of silently mis-scanning them) and a try/catch around the upload+analysis pipeline, surfaced via a new `error` step in `AddItemModal` (icon + message + "Try Again," which resets cleanly back to the options step). Verified live by uploading a `.txt` file.
  - Confirmed `AIRecommendationCard.tsx` and `OutfitCard.tsx` are unused dead code (zero imports anywhere) — not a second live outfit system, left untouched (out of scope for this sprint).
- [x] **Sprint 10 — Today Screen Hero Polish**:
  - **Header hierarchy fixed** (`TodayScreen.tsx`): the populated view was missing the "Let's find your look." subtitle entirely (empty state had it, populated state didn't) and used "What's the occasion?" where the spec calls for a distinct "What are you dressing for?" prompt right before the chips. Now reads: H1 → subtitle → dressing-for prompt → chips → free-text input, matching spec exactly in both states.
  - **Copy aligned to spec**: empty-state description shortened to "Add a few pieces and CLOSIQ will start styling you." (was a longer paraphrase); free-text placeholder simplified to "Tell CLOSIQ what you're dressing for..." (dropped the "then press Enter" instructional tail — reads less like a chatbot hint, more editorial).
  - **"Style/vibe" now visible**: `Outfit.vibe` existed in the type and was generated by `aiStylist.ts` but was never rendered anywhere and was hardcoded to the constant `'Architectural Minimalist'` regardless of occasion. Added `VIBE_BY_FORMALITY` (`aiStylist.ts`) so vibe is derived from the same `targetFormality` the rest of generation already uses (e.g. "Easy & Relaxed" for casual, "Refined After-Dark" for evening) — this lives in the one shared engine, so Stylist benefits too even though this sprint's UI work was scoped to Today. Rendered as an italic serif line under the outfit title.
  - **Hero-ified the outfit card** without restructuring it (still the same 2-column grid — not a redesign): garment image height 130px → 176px for real visual presence, grid gap and card spacing opened up (12→14px, 20→24px), title bumped 1.4rem → 1.6rem, header row switched to `align-items: flex-start` so the now-3-line title block (metadata / title / vibe) doesn't force the match badge to look mis-centered.
  - **Verified live**: fresh empty state, populated hero card, and full button row all confirmed at 375px and 414px in both light and dark mode — no wrapped buttons, no broken/clipped score badge, no horizontal overflow, no clipped text (only the intentional single-line title ellipsis at the narrowest width, which resolves itself by 414px).
- [x] **Sprint 11 — Real Testsamples Wardrobe Asset Integration**:
  - The brief named a root-level `Testsamples/` folder that did not exist anywhere in the filesystem (searched project root, full home directory, Desktop, Downloads, Documents, cloud-sync locations). User clarified: it's actually `public/test samples/` (lowercase, with a space) — a real folder with 60 files (58 unique garment photos + 2 exact-duplicate images + a couple `.DS_Store`).
  - Inspected every file (folder structure, filenames, dimensions, exact-duplicate detection via `md5`, and direct visual review of every ambiguous/color-unclear filename) before writing any code — see full inventory below.
  - Replaced the entire placeholder-only `RAW_CATALOG` in `src/data/garmentCatalog.ts` with 58 real entries derived from that inventory — every field (`id`/`profile`/`category`/`subcategory`/`name`/`color`/`fit`/`style`/`layeringRole`) traces to an actual image, none fabricated.
  - **Asset pipeline decision**: rather than physically copying ~431MB of source PNGs into `public/wardrobe/`, each `public/wardrobe/<profile>/<category>/<id>.png` is a **symlink** back into `public/test samples/...`. This satisfies "don't duplicate unnecessarily" while keeping the existing stable-ID path convention (`getGarmentImagePath()`) as the single source of truth. Verified `vite build` correctly dereferences symlinks into real files in `dist/` (confirmed via `file` on the build output, not just existence). `public/test samples/` itself was never moved, renamed, or edited — only new symlink files were created elsewhere pointing at it.
  - Updated `AddItemModal`'s quick-add sample set (5 per profile, one per category) and `public/wardrobe/README.md` to document the `test samples/` → `wardrobe/` symlink pipeline.
  - **Per user's explicit instruction this session, no dev server was started and no browser verification was performed.** Verification for this sprint is build/static-only: `npm run build` succeeds, all 58 `dist/wardrobe/**/*.png` are confirmed real (non-broken) image data via `file`, and `npm run lint` shows only the two pre-existing unrelated warnings. The Collection/AI Stylist/Profile live-verification steps the sprint brief requested (Men/Women Collection display, category filters, tank-top placement, AI outfit resolution) have **not** been empirically confirmed in a running app this session — they follow from the same `imageUrl`/`garmentId` resolution path already verified working in Sprints 8–9, but that is inference from prior sessions, not a fresh check. Flagged in Known Risks below.
- [x] **Sprint 12 — P0 Core Demo Flow Hardening** (requested as "Sprint 6" in the brief):
  - **Partial live check before the session pivoted to code-only**: started the dev server (an already-running instance on :5173 from a prior session, localStorage cleared for a fresh run), completed Onboarding → selected Men profile → Today screen. Confirmed live at 390px: the seed wardrobe resolves **real photographed garments** (not placeholders) across all 5 categories simultaneously (Light Blue Poplin Shirt, Black Parachute Pants, Leather Loafers, Washed Denim Jacket, Black Sling Bag), 91% match score, correct "Why It Works" copy, Swap/Save buttons all rendered correctly at mobile width. The user then asked to stop browser verification entirely and continue as a code-only review — every fix below (and the flow steps past this point: Add Item, Collection, Stylist, Profile, dark mode, other breakpoints, error states) was done and checked by reading source, not by clicking through the running app. See Known Risks.
  - **Real bug fixed — brand wordmark rendered as plain CSS text, not the official logo**: `AppHeader.tsx` (present on every single screen) and `OnboardingScreen.tsx` both rendered `CLOSIQ` as a styled `<div>` text string instead of using the existing `ClosiqLogo` component (`src/components/ui/ClosiqLogo.tsx`), which wraps the real brand asset (`public/brand/closiq-logo.png`, brain-in-the-Q motif) and was already correctly used in `SplashScreen` but never wired into these two. This is a direct violation of CLAUDE.md §5 ("Never redraw the wordmark in text/CSS"). Fixed both to render `<ClosiqLogo />` (compact `width={92}`, shadow-less, in the sticky header; `width={170}` on Onboarding's hero). Confirmed live in the one browser pass that ran before the pivot — logo renders correctly, header height re-tuned (`padding: 16px→10px`) so the taller logo plate doesn't bloat the sticky header.
  - **Real bug fixed — every real-photo upload silently misclassified as "Tops"**: `AddItemModal.tsx`'s `category` state defaulted to `'tops'` with no way to change it before a Take Photo/Upload Photo action, so `analyzeUploadedPhoto(dataUrl, category)` always ran with `categoryHint: 'tops'` — a photo of shoes, pants, or a jacket would still come back tagged `Category: tops` under a confident "AI Auto-Detected · ~91% confidence" badge. This directly undermines the core promise ("CLOSIQ understands them") and CLAUDE.md §4's "do not invent metadata the image doesn't support." Fixed by adding a "What are you adding?" category chip row (reusing the existing `CategoryChip` component — no new component, no redesign) to the options step, so the category hint driving the simulated analysis reflects what the user is actually photographing.
  - **Real bug fixed — Profile screen showed a different person than the rest of the app**: `ProfileScreen`'s Style Archetype card showed the hardcoded name **"Elena Rostova"** with an external Unsplash stock photo, while `TodayScreen` greets **"Good afternoon, Pranav."** — two different identities visible on two tabs of the same app. Fixed `INITIAL_PROFILE.name` (`src/data/initialWardrobe.ts`) to `'Pranav'` for consistency. Also removed `avatarUrl` (now unused everywhere — confirmed via grep) and replaced the `<img>` with a local initials avatar (no network dependency, no risk of a broken-image icon if the demo network drops the Unsplash request mid-pitch — that `<img>` had no `onError` fallback, unlike every other image render in the app which goes through `GarmentImage`). Removed `avatarUrl` from the `UserProfile` type too.
  - **Real bug fixed — Collection screen had no empty state**: Today and Stylist both show a proper `EmptyState` for a wardrobe of 0 items; `CollectionScreen` just rendered a blank grid — the exact "leave the user staring at a dead ... indefinite loading state"-adjacent gap section 11 of the brief calls out. Added two states: a full `EmptyState` (reusing the existing component, "Add Your First Item" CTA) for a genuinely empty wardrobe, and a lighter "No items match" message when a category filter or search query matches nothing but the wardrobe itself isn't empty.
  - **Real bug fixed — Swap button was a silent no-op ("dead button") when a category had only one item**: `swapGarmentInOutfit()` (`aiStylist.ts`) already correctly returned the outfit unchanged when `candidates.length <= 1`, but `StylistScreen.handleSwapPiece` gave the user zero feedback — clicking Swap just did nothing, indistinguishable from a broken button. Fixed by checking candidate count before calling swap and surfacing an inline message ("No other `<category>` in your wardrobe to swap in yet.") via the existing error-banner UI, reusing `formatCategoryList`.
  - **Real bug fixed — repeated swaps compounded the outfit title**: `swapGarmentInOutfit()` appended `" (Variation)"` to `outfit.title` on every call without checking for an existing suffix, so swapping tops then shoes then bottoms produced `"Smart Confidence (Variation) (Variation) (Variation)"` — a bug a judge would very plausibly trigger by clicking Swap a few times in a demo. Fixed to strip any existing `" (Variation)"` suffix before re-appending, making it idempotent regardless of swap count.
  - **Real bug fixed — "Why It Works" invented a top/bottom pairing for sparse wardrobes**: `generateWhyItWorksExplanation()` fell back to the literal words `'neutral'`/`'tailored'` when there was no actual top/bottom item, producing sentences like *"Neutral top with tailored bottoms provides a harmonious balance..."* even when the outfit had zero tops or bottoms — directly contradicting the `missingCategories` note ("Add tops and bottoms...") rendered immediately above it in both Today and Stylist. Fixed with an early branch: 0 items → a plain "add pieces" message; items present but no top/bottom → names the actual item(s) instead of inventing a pairing. The common-case demo path (full seed wardrobe, top+bottom always present) is untouched.
  - **Build/lint verified after every fix**: `npm run build` succeeds after each change (6 rebuilds this sprint), `npm run lint` shows only the same two pre-existing warnings (`PrimaryButton.tsx` unused `className` param, `aiStylist.ts` unused `OutfitExplanation` import) both sprints before this one — nothing new introduced.
- [x] **Sprint 13 — AI Stylist Experience & Outfit Presentation** (requested as "Sprint 7" in the brief):
  - **Fixed a build-blocking symlink break unrelated to this sprint**: `public/wardrobe/men/**/*.png` (36 symlinks) pointed at `public/test samples/menswear/...`, but that source folder had been renamed to `public/test samples/men/` in "Commit 3" without updating the symlinks. `npm run build` failed with `ENOENT` on the very first build this session. Repointed all 36 symlinks to the new path (same rename-preserving pattern the pipeline already uses); confirmed zero broken symlinks and real (non-broken) PNG data via `file` on a sample.
  - **One shared engine, extended, not duplicated**: `generateAIOutfit()` now also returns `formalityLabel` (a new field on `Outfit`, `src/types/wardrobe.ts`) — a human-readable formality tier ("Casual" / "Smart Casual" / "Formal" / "Evening") derived from the same `targetFormality` the rest of generation already computes. `swapGarmentInOutfit()`'s body was extracted into a private `buildSwappedOutfit()` helper so every swap path (the existing cycle-to-next behavior, and the new preview picker below) shares one definition of "what committing a swap means" — no second outfit-generation or scoring logic was introduced anywhere.
  - **Generation now has a real "thinking" moment** (brief §3): added a rotating-caption panel ("Checking your wardrobe…" → "Curating your look…" → "Finding the right combination…", reusing the exact caption-rotation technique already proven in `AddItemModal`'s AI-scanning step) with a pulsing Sparkles icon (`animate-pulse-glow`, already used elsewhere, already `prefers-reduced-motion`-safe). Two placements: a standalone panel when there's no outfit on screen yet (first-ever generation), and a semi-opaque overlay *on top of* the existing outfit card for Generate/Regenerate — the card stays mounted underneath (`pointer-events: none` while veiled, so stale Swap/Regen buttons can't be clicked mid-generation) rather than flattening to a dim, static opacity like before.
  - **Outfit result now shows "Style"** (brief §4): added an italic serif line under the title — `{formalityLabel} Style` (e.g. "Smart Casual Style") — using the exact CSS treatment Today already uses for its `vibe` line (proven safe at 375–414px since Sprint 10), so Stylist and Today read as one visual language even though only Stylist needed this per brief scope. The `{score}% Match` badge now also gets a subtle `animate-count-up` pop, keyed to the score value, when it changes.
  - **Swap is now "show alternatives, then commit"** (brief §7), not blind cycling: new `getSwapCandidates()` (`aiStylist.ts`) returns every same-category wardrobe item except the one currently equipped, honoring `layeringPreference` exactly like initial generation (reuses the existing `applyLayeringPreference` — no separate rule set), ranked by closeness to the outfit's own occasion formality so the best matches surface first. Tapping "Swap" on a garment now opens an inline horizontal thumbnail strip (real photos via `GarmentImage`, not text) below the grid instead of instantly swapping; tapping a thumbnail commits it via the new `applySwapCandidate()`. The picker auto-closes on commit and whenever a genuinely new outfit lands (Generate/Regenerate always mint a fresh `outfit.id`, watched via `useEffect`). The old immediate-cycle "no candidates" guard from Sprint 12 carries over unchanged (still shows an inline message instead of a dead button).
  - **Regenerate is now honest** (brief §9): `runGeneration` captures the outfit *before* overwriting it and, only on an actual Regenerate (`seed > 0`, never on the very first Generate), compares the new result via the existing `isSameOutfit()` — if a sparse wardrobe genuinely can't produce anything different, a distinct info banner says so ("This is your best match right now — add more pieces...") instead of silently acting like a fresh variation was produced.
  - **Real bug fixed — Stylist's empty/sparse states had no way to actually add anything** (brief §10): `StylistScreen` never received an `onOpenUpload` callback at all — its `EmptyState` had no action button (unlike Today's identical empty state, which does), and the `missingCategories` sparse-wardrobe note was static text with no CTA. Wired `onOpenUpload={() => setIsAddItemOpen(true)}` through from `App.tsx` (same modal trigger Today already uses — no new architecture) and added it to both: a "Add Your First Item" button on full-empty, and an "Add to Collection" button on the sparse note.
  - **Real bug found and fixed while adding the above**: giving Stylist an *inline* "open Add Item" trigger (modal overlays on top, doesn't navigate away) exposed a latent bug — `outfit` was seeded once via a `useState` lazy initializer that only ever runs on mount, so a wardrobe transitioning from empty→populated *while Stylist stayed mounted* would leave `outfit` stuck at `null` forever, even after the user added an item through the very button just added. Fixed with the same auto-generate-on-transition `useEffect` pattern `TodayScreen` already uses. Previously unreachable (tab switches fully unmount/remount the screen, always re-running the initializer fresh) — now reachable and now handled.
  - **Layering/profile constraints respected in every new code path**: the swap picker's `getSwapCandidates()` explicitly re-applies `layeringPreference` (brief §11); `wardrobe` passed in throughout is already profile-scoped by `App.tsx`'s `visibleWardrobe`, so nothing new needed there.
  - **Animation stayed subtle** (brief §12): every animation used this sprint reuses an existing CSS keyframe already covered by the app's single `@media (prefers-reduced-motion: reduce)` block (`animate-pulse-glow`, `animate-count-up`, `animate-card-enter`, `animate-fade-in`) — no new keyframes were written, no spinners added. Per-garment swap-entrance animation falls out naturally from React's key-based reconciliation (a swapped-in item gets a new DOM key → replays `animate-card-enter`; untouched items keep their key → don't remount) — nothing bespoke to build or maintain.
  - **`npm run build` and `npm run lint` verified clean after every change** (4 rebuilds this sprint, after fixing the symlink issue first) — lint shows only the same two pre-existing warnings, nothing new.
  - **Live browser verification was NOT performed this session** — the user explicitly instructed code-only work twice ("dont check anything just code", then "dont open browser and check anything just code"), the second time before any browser tool was even opened this sprint. See Known Risks for what that means for confidence in this sprint specifically.

---

## Current Sprint

* **Active Sprint**: None — Sprint 17 (Warm Ivory × Taupe Redesign, 5-Tab Nav, Outfit Planner) complete by build/lint standard. Awaiting a live functional + visual pass before this can be called demo-ready (see Next Task) — this is now two redesign sprints in a row with zero browser interaction.

---

## P0 Issues (Critical Demo Blockers)

* None currently open. `npm run build` and `npm run lint` both clean as of Sprint 13. Sprint 12's 7 fixes and Sprint 13's Stylist rebuild (generation "thinking" state, Style label, preview-before-commit swap picker, honest regenerate, working empty/sparse-state CTAs, the newly-caught stale-outfit-on-inline-add bug) are all build-verified but **not yet re-confirmed live end-to-end** — see Known Risks, this is the single most important thing to do before a real demo.

---

## P1 Issues (Important UX & Design Polish)

* [x] Add actual garment photos into `public/wardrobe/men/` and `public/wardrobe/women/` — done since Sprint 11 (58 real photos via symlinks into `public/test samples/`); confirmed live this sprint that real photos (not placeholder icons) render on Today for a full 5-category outfit. **Stale note from Sprint 8 removed** — this item used to say placeholders were still showing; that's no longer true.
* [x] Integrate wardrobe profile selection (Men/Women) into Onboarding/Profile settings. — Done & verified.
* [ ] `dist/wardrobe/` is ~431MB of unoptimized full-resolution source PNGs (2–15MB each) — real load time on a demo network/device is untested. Flagged since Sprint 11, still not addressed (was explicitly out of scope both times). See Known Risks.

---

## P2 Issues (Enhancements)

* [ ] Add transition micro-animations when switching category chips in Collection.
* [ ] Persist saved looks to LocalStorage across browser sessions.

---

## Current Architecture

* **Framework**: React 18 + Vite (TypeScript)
* **Styling**: Vanilla CSS custom properties (`src/index.css`) with viewport shell (`.app-shell`)
* **State Management**: React `useState` / `useEffect` + `localStorage` persistence in `src/App.tsx`
* **AI Engine**: Algorithmic styling engine (`src/services/aiStylist.ts`) evaluating color theory, category balance, and user prompts strictly against owned items
* **Vision AI**: Simulated garment attribute extraction pipeline (`src/services/aiVisionScanner.ts`)

---

## Files Changed Recently

* `CLAUDE.md`: Created permanent multi-session context document.
* `STATE.md`: Created living implementation status document.
* `src/App.tsx`: Wired wardrobe state, modal triggers, and primary navigation tabs.
* `src/components/screens/ProfileScreen.tsx`: Added Style DNA, Wardrobe Insights, and Saved Looks.
* `src/components/screens/StylistScreen.tsx`: Updated natural language input, suggestion chips, and single-piece swapper.
* `src/components/screens/TodayScreen.tsx`: Implemented Sprint 2 Today experience.
* `src/components/screens/CollectionScreen.tsx`: Implemented search toggle, category chips, and detail drawer triggers.
* `src/components/modals/AddItemModal.tsx`: Implemented AI scanning state and confirmation form.
* `src/components/modals/ClothingDetailModal.tsx`: Implemented garment inspection drawer.
* `public/brand/closiq-logo.png`: Official CLOSIQ wordmark asset installed (moved from project root).
* `src/components/ui/ClosiqLogo.tsx`: New reusable logo component (contrast plate wrapper).
* `src/components/ui/SplashScreen.tsx`: New reusable launch splash (fade/scale, reduced-motion aware).
* `src/index.css`: Added `splashEnter` keyframe + `.animate-splash-enter`, included in the existing `prefers-reduced-motion` override.
* `src/App.tsx`: Added `showSplash` state; mounts `SplashScreen` over `.app-shell` on both the onboarding and main-app render paths.
* `CLAUDE.md`: Added permanent §5 Brand Identity & Launch Experience section; renumbered §5–14 → §6–15; added the two new files to §11 Existing Architecture.
* `src/data/garmentCatalog.ts`: Added `style` field to all 20 catalog entries; added materialized `imagePath` field to `GARMENT_CATALOG`; renamed internal literal array to `RAW_CATALOG` (private) with `GARMENT_CATALOG` derived from it.
* `src/components/modals/AddItemModal.tsx`: Uses `entry.imagePath` directly instead of calling `getGarmentImagePath()` at each use site.
* `public/wardrobe/README.md`: Documented the `imagePath` derivation and the missing-asset design decision (runtime fallback only, no manual status flag).
* `src/types/wardrobe.ts`: Added `Outfit.missingCategories?: GarmentCategory[]`.
* `src/services/aiStylist.ts`: Removed the wrong-category `|| wardrobe[N]` fallback in `generateAIOutfit()`; compute and return `missingCategories`; added exported `formatCategoryList()` helper.
* `src/components/screens/TodayScreen.tsx`: try/catch/finally around generation; error banner + Retry; sparse-outfit note.
* `src/components/screens/StylistScreen.tsx`: Same hardening as Today, applied to `handleGenerate`/`handleRegenerate`/initial generation/`handleSwapPiece`; consolidated into a shared `runGeneration()`.
* `src/components/modals/AddItemModal.tsx`: Switched uploaded photos from `URL.createObjectURL` to a `FileReader`-based base64 `data:` URL; added file-type validation and a new `error` step with Retry.
* `src/components/screens/TodayScreen.tsx`: Header hierarchy fixed to match spec (subtitle + dressing-for prompt); empty-state and placeholder copy tightened; vibe line added under outfit title; garment imagery and card spacing enlarged for hero presence.
* `src/services/aiStylist.ts`: Added `VIBE_BY_FORMALITY` map; `vibe` is now derived from `targetFormality` instead of a hardcoded constant.
* `src/data/garmentCatalog.ts`: Full rewrite of `RAW_CATALOG` — 58 real entries replacing all placeholder data, sourced from `public/test samples/`.
* `public/wardrobe/<men|women>/<category>/*.png`: 58 new symlinks (not copies) pointing into `public/test samples/...`, named by stable garment ID.
* `public/wardrobe/README.md`: Added a "Source material: `public/test samples/`" section documenting the symlink pipeline and the do-not-touch rule for the source folder.
* `src/components/ui/AppHeader.tsx` (Sprint 12): Replaced plain-text `CLOSIQ` wordmark with `<ClosiqLogo width={92} />`; header padding `16px→10px`.
* `src/components/screens/OnboardingScreen.tsx` (Sprint 12): Replaced plain-text `CLOSIQ` wordmark with `<ClosiqLogo width={170} />`.
* `src/components/modals/AddItemModal.tsx` (Sprint 12): Added a "What are you adding?" category chip row (reuses `CategoryChip`) to the options step so real-photo uploads carry a user-picked category hint instead of always defaulting to `'tops'`; confirm button now disabled/no-ops when Name is blank.
* `src/data/initialWardrobe.ts` (Sprint 12): `INITIAL_PROFILE.name` `'Elena Rostova'` → `'Pranav'` (matches Today's greeting); removed unused `avatarUrl` (external Unsplash URL, no `onError` fallback).
* `src/types/wardrobe.ts` (Sprint 12): Removed `avatarUrl` from `UserProfile` (now unused everywhere).
* `src/components/screens/ProfileScreen.tsx` (Sprint 12): Replaced the external-URL `<img>` avatar with a local initials avatar (no network dependency, no broken-image risk).
* `src/components/screens/CollectionScreen.tsx` (Sprint 12): Added `EmptyState` for a 0-item wardrobe and a lighter "No items match" state for an empty filtered/search result.
* `src/components/screens/StylistScreen.tsx` (Sprint 12): `handleSwapPiece` now checks candidate count first and shows an inline message instead of silently no-op'ing when a category has ≤1 item.
* `src/services/aiStylist.ts` (Sprint 12): `swapGarmentInOutfit()` strips any existing `" (Variation)"` suffix before re-appending (was compounding on repeated swaps); `generateWhyItWorksExplanation()` no longer invents a top/bottom pairing when neither exists in the outfit.
* `public/wardrobe/men/**/*.png` (Sprint 13, 36 symlinks): repointed from `test samples/menswear/...` to `test samples/men/...` after the source folder was renamed outside any session — fixes a build-blocking `ENOENT`.
* `src/types/wardrobe.ts` (Sprint 13): Added `Outfit.formalityLabel: string`.
* `src/services/aiStylist.ts` (Sprint 13): Added `FORMALITY_LABEL` map and `formalityLabel` in `generateAIOutfit()`'s return; extracted `buildSwappedOutfit()` from `swapGarmentInOutfit()`; added `getSwapCandidates()` and `applySwapCandidate()` for the new preview-based swap flow.
* `src/components/screens/StylistScreen.tsx` (Sprint 13): Full rebuild of the generation/swap UX — rotating-caption thinking panel (standalone + card overlay), `formalityLabel` display line, animated match-score badge, swap alternatives preview strip replacing immediate-cycle swap, honest regenerate info message, `onOpenUpload` CTAs on empty/sparse states, auto-generate-on-wardrobe-transition `useEffect` (new bug fix).
* `src/App.tsx` (Sprint 13): Passes `onOpenUpload={() => setIsAddItemOpen(true)}` to `<StylistScreen>` (previously only threaded to `<TodayScreen>`).

---

## Wardrobe Asset Status

### Source: `public/test samples/` (as of 2026-08-13)

* **Location note**: the sprint brief called this `Testsamples/` at the repo root. It does not exist under that name/location. The real folder is `public/test samples/` (lowercase, with a space) — confirmed directly with the user.
* **Total files found**: 60 (58 unique garment photos + 2 exact-duplicate images, all PNG, plus stray `.DS_Store` files ignored). All verified as valid, non-corrupt PNGs via `file`; sizes ranged ~2–15MB each (full-resolution renders, not web-optimized — see Known Risks).
* **Folder structure discovered** (not assumed — this is the literal structure on disk):
  ```
  public/test samples/
    menswear/
      top/            (8 files)
      bottoms/        (7 files)
      footwear/       (6 files)
      outwear/        (4 files)   ← source folder name is "outwear", not "outerwear"
      acessories/     (12 files)  ← source folder name is misspelled "acessories"
    women/
      top/            (10 files)
      bottom/         (6 files)   ← singular "bottom", not "bottoms"
      footwear/       (4 files)
      acessories/     (3 files)   ← same misspelling; no separate outerwear folder at all
  ```
* **Men assets discovered**: 37 files across tops/bottoms/footwear/outerwear/accessories (no separate base-layer/tank-top item — see Missing/Ambiguous below).
* **Women assets discovered**: 23 files across tops/bottoms/footwear/accessories — **zero files in any outerwear-equivalent folder**.
* **Categories discovered**: Tops, Bottoms, Footwear, Outerwear (men only, as found), Accessories — maps cleanly onto CLOSIQ's 5 existing primary categories. No "Inners" category present or created; the one tank top found (`Fitted Ribbed Tank Top (2).png`, women) is correctly filed under Tops with `layeringRole: base_layer`.
* **Naming convention observed**: mostly `Title Case Descriptive Name.png` (e.g. `Black Cargo Pants.png`) — reliable and descriptive enough to use directly as source metadata. A few outliers: `GirlTEE2.png`, `charcoal_asymmetric_long_sleeve_top(1).png` (snake_case, added later — file timestamp ~6hrs after the rest of that folder), and stray `(1)`/`(2)` suffixes on otherwise-normal names (`Black Parachute Pants (2).png`, `Satin Cowl-Neck Top (2).png`) that are not duplicates of anything else, just leftover download-naming artifacts.

### Successfully integrated: 58 catalog entries

All 58 (36 men + 22 women) are now real `GARMENT_CATALOG` entries in `src/data/garmentCatalog.ts`, each with `garmentId`/`profile`/`category`/`subcategory`/`displayName`/`color`/`fit`/`style`/`layeringRole`/`imagePath` — resolved via symlinks in `public/wardrobe/<profile>/<category>/<id>.png` pointing back at the original files (see Sprint 11 notes above; `public/test samples/` itself is untouched).

### Missing / ambiguous assets (documented, not silently resolved)

* **Exact-content duplicate #1**: `menswear/top/Charcoal Art Tee.png` and `women/top/GirlTEE2.png` are byte-identical (same `md5`) — the same men's oversized tee photographed once, saved under two names in two profile folders. Visually confirmed (back view of an oversized charcoal graphic tee). **Decision**: kept once, under `men` as `charcoal_art_tee`; excluded `GirlTEE2.png` from the women's catalog rather than listing a men's photo as a distinct women's garment.
* **Exact-content duplicate #2**: `menswear/acessories/Black Sling Bag.png` and `menswear/acessories/Mini Tote Bags.png` are byte-identical — one bag, two candidate names, both in men's accessories. Visually it's a crossbody sling (long adjustable strap), not a tote. **Decision**: kept once as `black_sling_bag`; `Mini Tote Bags.png` excluded as the mislabeled duplicate.
* **Filename/content mismatch**: `women/top/Oversized Oxford Shirt.png` is **not** a shirt — it's visually a light-wash oversized denim jacket (button-front, chest flap pockets, collar). **Decision**: reclassified as `category: outerwear` (`light_wash_denim_jacket`) rather than trusting the folder/filename, since filing an actual jacket as a "top" would let the AI place it as a second top in a generated outfit. This incidentally fills the "women has no outerwear" gap with one item — flagging for the team to confirm the source file is correctly named/placed.
* **No men's base-layer item**: unlike women (`Fitted Ribbed Tank Top`), the men's samples contain no tank top or other genuine base-layer piece. No placeholder was invented to fill this — men's wardrobe currently has zero `layeringRole: base_layer` items until the team adds one.
* **Women's outerwear is minimal**: after the reclassification above, women have exactly 1 outerwear item (vs. 4 for men). `applyLayeringPreference()`'s "allow a base layer if an outer layer is already in the outfit" exception will rarely have a choice of outer layer to draw from for women — not a bug, just a direct consequence of the current asset set.
* **Colors inferred rather than directly confirmed**: a handful of filenames had no color word and were not individually opened for visual confirmation (time-boxed after confirming ~40 others by name/spot-check were accurate): `Cargo Mini Skirt` (assumed Olive), `Pleated Wide-Leg Trousers` (assumed Charcoal Slate), `Parachute Pants`/women (assumed Stone Grey), `Rectangular 90s Sunglasses`/women (assumed Black), and the two jeans (`High-Waisted Wide-Leg`, `Low-Rise Straight-Leg`) assumed standard Denim Blue. These are reasonable garment-type defaults, not verified against the actual pixels — flag if a demo screenshot shows a mismatch.
* **Cross-profile name collisions resolved by content, not assumption**: `Retro Runner Sneakers`, `Structured Mini Shoulder Bag(s)`, and `Crescent Hobo Bag(s)` each appear in both men's and women's folders under near-identical names — all three pairs were visually confirmed to be genuinely different images (different renders, not the same photo reused), so both were kept with disambiguated IDs (e.g. `retro_trail_runner_sneakers` vs `retro_runner_sneakers`).
* **Typo preserved as data-cleanup, not fabrication**: `menswear/acessories/ortoise 90s Sunglasses.png` (missing leading "T") was catalogued with the corrected display name "Tortoise 90s Sunglasses" — the visual content (tortoiseshell-pattern sunglasses) confirms the intended word.

### Catalog schema (unchanged shape from Sprint 8, now fully populated with real data)

Every `GARMENT_CATALOG` entry exposes `id`, `profile`, `category`, `subcategory`, `name`, `color`, `hexColor`, `fabric`, `fit`, `style`, `seasons`, `formality`, `layeringRole?`, `tags`, `pairingNotes`, and `imagePath`. The AI and every screen consume `GarmentItem.imageUrl` (set from `entry.imagePath` at seed time) and `GarmentItem.id` — no code path ever guesses a filename.

---

## AI Status

* **Outfit Generator**: Working, single shared engine (`generateAIOutfit`) for Today and Stylist — confirmed identical output from both screens. Selects items strictly from active user wardrobe. `applyLayeringPreference()` correctly excludes `base_layer` tops when preference is `avoid`, unless the prompt explicitly asks for layering or the outfit already has an outer layer. No longer backfills an empty category with a wrong-category item (Sprint 9 fix) — missing categories are surfaced via `Outfit.missingCategories` and a UI note instead.
* **Vision Scanner**: Working simulated AI analysis stage (`"Understanding your garment..."`), now with a real-photo-tested pixel-based dominant color extraction path (`extractDominantColor`) and file-type validation in front of it.
* **Occasion Handling**: Working with presets (*College, Work, Date Night, etc.*) and free-form prompts. Custom text confirmed to flow into `activePrompt`/`generateAIOutfit` and change the outfit title/label live.
* **Swap Behavior**: Sprint 13 rebuilt this — Stylist's Swap button now opens a preview strip of compatible alternatives (`getSwapCandidates()`, ranked by occasion-formality closeness, honoring `layeringPreference`) instead of immediately cycling to "next"; the user picks a specific replacement (`applySwapCandidate()`) rather than the app silently deciding for them. `swapGarmentInOutfit()` (the older cycle-to-next function) still exists and still works — nothing calling it broke — but Stylist no longer uses it directly for its per-item Swap button. Sprint 12's earlier fixes (no-op-with-no-feedback when only 1 candidate exists; compounding `"(Variation)"` title suffix) both carry forward since the new picker path shares the same `buildSwappedOutfit()` core with the old one.
* **Save Behavior**: Working saved looks state, confirmed shared across Today/Stylist/Profile (save on Today → reflected as "Saved" on Stylist → appears in Profile's Saved Looks).
* **Regenerate Behavior (Sprint 13)**: `runGeneration` now detects (via `isSameOutfit`) when a Regenerate produced an identical outfit to what was already showing — only possible on a very sparse wardrobe where every category has ≤1 item — and shows an honest info message instead of pretending a new variation appeared. Never fires on the very first Generate, only on `seed > 0` regenerates.
* **Generation UX (Sprint 13)**: Stylist's Generate/Regenerate now shows a rotating-caption "thinking" panel (reusing `AddItemModal`'s exact caption-rotation technique) — a standalone panel for the very first generation, an overlay veiling the existing card (with `pointer-events: none` underneath) for regenerates, so the outfit card never just goes flat/static during a wait.

---

## UI Status

* **Light Mode**: Verified `#FAF8F5` warm ivory and `#0D3B2E` deep emerald palette.
* **Dark Mode**: Verified `#0B100E` green-black and `#38997E` emerald palette, toggled live via Profile screen.
* **Mobile Responsiveness**: Verified at 375×812, 390×844, and 414×896 — no overflow/clipping in Today, Collection, or Add Item modal, in either theme.
* **Wardrobe Asset Resolution (Sprint 8)**: Spot-checked in browser — Men Collection shows all 10 catalog items (tank top correctly under Tops, 2 items per category), Today's AI outfit resolves real catalog `imageUrl`s for both Men and Women, all via `GarmentImage`'s graceful placeholder (no PNGs exist yet, no broken icons, no unrelated stock imagery).
* **Launch Splash**: Verified — fades/scales in, holds, fades out to reveal the app already rendered underneath, in both light and dark mode, at mobile (375px) and desktop widths. Does not re-trigger on Today↔Collection↔Stylist tab navigation. `prefers-reduced-motion` path verified by code/CSS review (the Browser pane tool has no way to emulate that media feature directly).
* **P0 Flow (Sprint 9)**: Verified live end-to-end from a fresh (cleared `localStorage`) state — Men profile → Add Item → real image upload (simulated via a genuine PNG file, not a mock) → AI scanning state → real pixel-based color detection → confirm → Collection → Today → occasion chip → custom free-text occasion (title updates live) → generate → why-it-works → swap → save → Stylist (shows identical outfit, "Saved" state carries over) → Profile (saved look appears with the real uploaded photo rendering correctly in the thumbnail). Reload-persistence of the uploaded photo confirmed directly (see AI Status). Upload error state (non-image file) verified live: shows "Something Went Wrong" + message + Try Again, resets cleanly. Retested at 375/390/414px and light/dark.
* **Today Hero Polish (Sprint 10)**: Verified live at 375px and 414px, light and dark — header hierarchy (greeting → subtitle → dressing-for prompt → chips → input), the hero outfit card (title, vibe, 2×176px garment images, match badge, why-it-works, stacked full-width action buttons), and the empty state, all render with no wrapped buttons, no broken/clipped score badge, no horizontal overflow, and no ugly scrollbar (only the intentional hidden-scrollbar chip rail plus the browser's normal vertical page scrollbar).
* **Brand Wordmark in App Chrome (Sprint 12)**: `AppHeader` and `OnboardingScreen` render the real `ClosiqLogo` asset instead of CSS text.
* **Stylist Presentation (Sprint 13)**: Outfit card now shows a `{formalityLabel} Style` line under the title (reusing Today's exact `vibe`-line CSS treatment, proven safe at 375–414px since Sprint 10) and a subtly-animated match-score badge. Swap alternatives render as an inline horizontal thumbnail strip (`hide-scrollbar` pattern, already proven at these breakpoints elsewhere in the app). **None of this was re-confirmed live this session** — see Known Risks.
* **Known Visual Problems**: None found by code review this sprint; see Known Risks for what wasn't live-checked.

---

## Known Risks

* **Sprint 17 shipped new interactive features with zero clicks, on top of Sprint 16's already-unverified redesign** — per the user's explicit instruction this session, no browser tool was opened at all. Unlike Sprint 16 (pure re-theme, lower functional risk), this sprint added real new behavior. Priority checklist for the first live pass, in order:
  1. **Outfit Planner (`PlannerScreen`, brand new)**: with 0 saved outfits, does "Plan an outfit" show the "no saved looks yet" message with a working "Open Stylist" shortcut instead of an empty picker? After saving a look, does the picker strip actually render it, does tapping it assign + close the picker, does the day row then show the thumbnail/title correctly, does the X button clear it back to the "Plan an outfit" button state? Does editing a day's occasion-label `<input>` actually persist (reload the page, confirm `closiq_weekly_plan` in localStorage survived)?
  2. **"Wear this" on Today**: does the button flip to "Worn Today" with the success color on click, does it stay flipped only for that specific outfit (generate a new one, confirm the button resets to "Wear this"), and separately confirm in Collection that the worn items' "Worn N times" count actually incremented.
  3. **Stylist Style chips**: does selecting a style chip visibly toggle, does clicking the same chip again deselect it, and does Generate with a style selected still produce a sensible outfit (the style phrase is appended to the prompt text, not used for hard filtering — confirm it doesn't produce a confusing/truncated `outfit.occasion` label in the card header at 375px).
  4. **New 5-tab `BottomNavigation`**: confirm all 5 labels (Home/Wardrobe/AI Stylist/Planner/Profile) fit without wrapping at 375px now that each tab has ~20% less width than the old 4-tab bar, and that the AI Stylist tab's always-on accent doesn't read as a 6th "selected" state alongside the actually-active tab.
  5. **2-step Onboarding**: welcome step → Get Started → setup step → Back link returns to welcome without losing nothing important (there's nothing to lose on the welcome step itself, but confirm the transition is smooth and progress dots update).
  6. **Full light↔dark sweep** of everything above, plus the second palette change itself (warm ivory/taupe this time, not sage) — text contrast for `--color-text-secondary`/`--color-text-muted` directly on `--color-bg` was reasoned through manually but never rendered, in either theme.
* **Sprint 16's entire redesign was never visually rendered this session** — same standing "code + build/lint only" project preference as Sprint 13, but higher-stakes here because the whole point of the sprint was color/contrast/spacing, which by definition can't be fully confirmed by reading source. Specific things to check first on a live pass, in priority order: (1) text contrast for `--color-text-secondary`/`--color-text-muted` directly on the new sage `--color-bg` in the areas that sit outside a cream card — Today's greeting header, Stylist's header, Collection's header/search — these were reasoned through manually (sage L≈78% vs. text L≈36% in light mode) but never rendered; (2) the new hero-first Today outfit card at 375px specifically — confirm the 300px hero image + gradient caption doesn't crowd the match-score badge or overflow, and that the supporting-row grid (1–4 tiles depending on outfit size) doesn't produce oddly-sized tiles when `outfit.items.length` is 2 (a single supporting tile stretched full-width) or 5; (3) the floating `BottomNavigation` pill dock at 375px — confirm all 4 labels fit without wrapping/truncation now that it's narrower than the old full-bleed bar; (4) dark mode across all of the above, especially the new dark-mode primary `#5AA37E` against `--color-text-on-primary` `#0D1712` on filled buttons/active chips/segmented-control active state; (5) `SegmentedControl` in `ProfileScreen` at 375px for both the 2-option (Men/Women) and 3-option (Layering) variants. None of this has been clicked once.
* **Sprint 13 was entirely code-only — zero browser interaction, by explicit repeated user instruction** ("dont check anything just code", then "dont open browser and check anything just code" before any browser tool was even opened this sprint). Unlike Sprint 12, there is **no** partial live pass to point to this time — everything below is verified by reading the code and by `npm run build`/`npm run lint` only:
  - The rotating-caption generation panel (does it actually render/rotate, does the overlay correctly veil the card without blocking the card's own layout).
  - The Style label line and the animated match-score badge (visual fit at 375/390/414px, dark mode contrast).
  - The swap preview picker end-to-end: does tapping Swap actually open the strip, do the thumbnails render real photos via `GarmentImage`, does tapping one actually commit and close the picker, does the "no candidates" message still show correctly for a single-item category.
  - The regenerate honesty message (would need an artificially sparse wardrobe — every category down to 1 item — to actually trigger; never seen firing).
  - The new "Add to Collection" CTAs on Stylist's empty and sparse states, and specifically the bug-fix for the empty→populated transition while Stylist stays mounted (add an item via that inline button without navigating away, confirm Stylist actually generates instead of staying stuck on "Nothing to style yet").
  - **Recommend a live pass through Stylist specifically before any demo**, in this order: (1) empty wardrobe → tap "Add Your First Item" from inside Stylist → confirm an outfit actually appears afterward (this exercises the exact bug that was just fixed); (2) Generate → watch for the rotating captions; (3) tap Swap on any garment → confirm the thumbnail strip appears and a tap commits it; (4) Regenerate several times in a row on a normal (non-sparse) wardrobe to confirm real variety, and separately on a wardrobe trimmed to 1 item per category to confirm the honest "best match" message appears instead of a fake-fresh regenerate.
  - This session also carries forward Sprint 12's own unresolved live-verification gap (Add Item category-chip fix, Collection empty state, Profile identity fix, dark mode, breakpoints) — still not checked as of Sprint 13 either.
  - A leftover `vite` dev server from a previous session was found already running on port 5173 at the start of Sprint 12; unknown whether it's still running. Check for a stale process before assuming a fresh `npm run dev` is needed.
* **`public/test samples/menswear/` → `men/` rename risk**: this rename (done outside any Claude session, visible in "Commit 3") broke the men's symlink pipeline once already (fixed this sprint — see Current Phase). If the source folder gets renamed or reorganized again without also updating `public/wardrobe/<profile>/**/*.png`, the build will fail the same way. Worth a `find public/wardrobe -type l ! -exec test -e {} \; -print` sanity check at the start of any future sprint, before assuming the asset pipeline is intact.
* **Wardrobe image weight**: `dist/wardrobe/` is ~431MB across 58 full-resolution PNGs (2–15MB each, largest at 2816×1536). These are source-quality renders, not web-optimized — real-world load time on a demo network/device is untested and likely to feel slow, especially in the Collection grid loading many at once. Not addressed this sprint (explicitly out of scope: "Do not start the next visual-polish sprint"); flagging as the most likely next real risk.
* Two exact-duplicate images and one filename/content mismatch were found and resolved by judgment call, documented in detail above — worth a quick nod from the hackathon team to confirm the calls (especially the "Oversized Oxford Shirt" → denim jacket reclassification).
* `swapGarmentInOutfit()` doesn't independently apply `layeringPreference` (see AI Status note above) — currently benign, revisit if swap logic is reworked.
* `logo.png`'s baked-in background (`#F5F6F2`) is a very close but not pixel-exact match to `--color-bg` in light mode (`#FAF8F5`); the `ClosiqLogo` plate uses the asset's own swatch so this is imperceptible in practice, but if the design system's light background token ever changes, re-check for a visible seam.
* `~/Downloads/closiq-wordmark.svg` exists and is named similarly to the real asset but is **not** the official logo (no brain motif, wrong palette) — do not let a future session pick it up by mistake.
* **localStorage size with base64 photos**: uploaded images are now stored as base64 `data:` URLs (≈33% larger than the raw file) directly in `localStorage`'s ~5–10MB-per-origin budget. Fine for a handful of demo uploads; if many/large photos get uploaded during a real demo, `localStorage.setItem` could start throwing `QuotaExceededError` (not currently caught — the `useEffect` persistence in `App.tsx` would silently fail to save on that write). Acceptable tradeoff for hackathon reliability (this fixes the worse bug of photos vanishing on reload) but worth a guard if the demo grows.
* `AIRecommendationCard.tsx` and `OutfitCard.tsx` (`src/components/ui/`) are confirmed dead code — zero imports anywhere in the app. Not a duplicate outfit system (nothing renders them), just unused files from early scaffolding. Left alone this sprint (out of scope); safe to delete in a future cleanup pass.

---

## Next Task

**Task**: A live functional + visual pass is now the single highest-priority item, and specifically should start with the Outfit Planner (entirely new, entirely unverified) rather than the color system alone. Priority order: (1) Planner end-to-end — save a look from Today, then assign/clear it to a day in Planner, confirm persistence across reload; (2) "Wear this" on Today — confirm the worn-state toggle and that Collection's wear counts actually move; (3) Stylist's new Style chips; (4) the 5-tab `BottomNavigation` at 375px; (5) the 2-step Onboarding flow; (6) a full light↔dark sweep of the new warm ivory/taupe palette specifically (this is the second palette this app has had in one day — make sure it's actually this one that's live, not a stale build). See Known Risks for the full checklist. Separately — and still unresolved by either of today's two redesign sprints — the older functional-verification gap from Sprints 12/13 (Stylist swap picker, empty→populated transition, Add Item category chip, Women profile end-to-end) and the ~431MB unoptimized wardrobe image weight (flagged since Sprint 11) both remain open.

---

## Last Updated

* **Date**: 2026-08-14
* **Session**: Sprint 17 — Warm Ivory × Taupe Redesign + 5-Tab Nav + Outfit Planner, per a second, more detailed UI/UX brief the same day referencing a different fashion-app visual reference (warm ivory/cream, taupe/beige, deep charcoal, muted brown/olive — explicitly superseding Sprint 16's sage×cream direction from earlier this session) and a full 12-screen feature spec. Re-themed `src/index.css` a second time to the new palette and fixed several hardcoded error-reds Sprint 16 had missed (now a proper `--color-danger` token). Beyond re-theming: expanded `BottomNavigation` to 5 tabs (Home/Wardrobe/AI Stylist/Planner/Profile, internal keys unchanged) and built a brand-new `PlannerScreen.tsx` + `weeklyPlan` state/persistence for weekly outfit planning against Saved Looks; wired a real "Wear this" action on Today to `wearCount` (a type field that existed but was never incremented anywhere, confirmed by grep); added a Style chip dimension to the Stylist that folds into the existing prompt-based generation (no engine changes); expanded Onboarding to a 2-step welcome+setup flow; and restructured Profile into a hub (Quick Links to Wardrobe/Planner, grouped "Style Preferences", renamed "Settings" with an honest "Notifications — Coming soon" row). Fixed copy inconsistencies the tab rename created ("My Collection"→"My Wardrobe", Add Item modal copy). Zero changes to any AI/Gemini service, garment catalog, or `vite.config.js`; the one `types/wardrobe.ts` change was purely additive. `npm run build` and `npm run lint` verified clean after every meaningful change (7+ rebuilds this session). Updated `CLAUDE.md` §3 (new 5-tab nav, superseding the old "exactly 4 tabs" rule since the user explicitly directed this) and §4 (new color tokens). **Zero browser interaction this session, per the user's explicit instruction** ("dont check anything in the browser and stuff just mae the code changes") — flagged prominently in Known Risks with a prioritized checklist, since unlike Sprint 16 this sprint shipped genuinely new interactive surfaces that have never been exercised even once.
