# CLAUDE.md — CLOSIQ Permanent Project Context & Rules

This document is the permanent instruction and context guide for every Claude session working on **CLOSIQ**.

---

## 1. Project Identity

* **Project**: CLOSIQ
* **Description**: AI-powered personal wardrobe and styling application.
* **Core Promise**: **Upload the clothes you own → CLOSIQ understands them → organize them into a digital wardrobe → ask what you want to wear → CLOSIQ creates an outfit using your actual wardrobe.**
* **Core Loop**:
  `UPLOAD → UNDERSTAND → COLLECTION → OCCASION → AI STYLIST → OUTFIT → WHY IT WORKS → SWAP`

---

## 2. Product Philosophy

### CLOSIQ IS:
* A personal digital wardrobe
* An AI stylist
* A wardrobe intelligence system
* Personalized strictly to the user's actual clothes

### CLOSIQ IS NOT:
* An ecommerce marketplace
* A clothing store (no shopping cart, no prices, no buy buttons)
* A generic AI chatbot
* A social media fashion feed

### Primary Product Principle:
> **Style what the user already owns.**

---

## 3. Primary Navigation

**Updated 2026-11-01** (user request): the nav is **Home · Wardrobe · (Shop Check camera) · Planner · Profile** on web (`src/components/ui/BottomNavigation.tsx`) and mobile (`mobile/src/components/BottomNavigation.tsx`). The Stylist is no longer a tab; the `NavTab` key `stylist` still exists and is opened from an "AI Stylist" card on Home. The centre is a raised round camera button (a highlighted "Shop Check" row in the desktop sidebar) that opens Shop Check rather than a tab.

1. **Home** (internal key `today`, `"What should I wear?"`): Primary home experience showing daily AI outfit recommendations tailored to weather and schedule, a dynamic time-of-day greeting, a small **AI Stylist** entry card (opens the Stylist), visual clothing cards, style match score, a "Wear this" action, *"Why it works"* rationale, Recently Added rail, quick occasion shortcuts, and a Wardrobe Insights teaser.
2. **Wardrobe** (internal key `collection`, `"What do I own?"`): Digital wardrobe gallery showing all cataloged user garments, category chips, smart search (`src/services/wardrobeSearch.ts`), an always-visible per-section filter row (`src/services/wardrobeFilters.ts`), and item detail drawer.
3. **Shop Check** (centre camera button, not a tab — `"Will this piece work with my wardrobe?"`): scan or pick a photo of a garment BEFORE buying it → the AI garment scan reads it (or the user describes it in a few taps) → `src/services/shopCheck.ts` shows, from the user's OWN clothes only, what to wear it with (spread across colours), up to 3 outfits by occasion, Style DNA fit, near-twins already owned, styling tips and a verdict. Nothing is added unless the user taps "I bought it". Web `src/components/modals/ShopCheckModal.tsx`, mobile `mobile/src/components/ShopCheckModal.tsx`. Not ecommerce: no prices, no shops, no buy buttons.
   * **AI Stylist** (internal key `stylist`, opened from Home, with a back link): natural-language prompt input, Occasion chips, an optional Style chip row (Minimal/Streetwear/Smart Casual/Vintage/Athleisure — folds into the prompt, not a separate filter), and real-time outfit generation with single-piece swapper.
4. **Planner** (internal key `planner`, `src/components/screens/PlannerScreen.tsx`): Weekly outfit planner — Mon–Sun rows, each with an editable free-text occasion label and an optional outfit assigned from Saved Looks. State lives in `App.tsx` (`weeklyPlan`, persisted to `localStorage` under `closiq_weekly_plan`) using the `WeeklyPlanEntry`/`WeekDay` types in `src/types/wardrobe.ts`.
5. **Profile** (`"What does CLOSIQ know about my style?"`): Style Archetype card, quick links to Wardrobe/Planner, Style DNA archetype, closet color breakdown, saved looks, Style Preferences (Wardrobe Profile Men/Women + Layering, grouped), and Settings (Notifications — informational only, no backend — plus the working appearance theme toggle).

---

## 4. Visual Design System

**Design language**: *Warm Ivory × Taupe Editorial Fashion System* (redesigned 2026-08-14, superseding the same-day earlier Sage × Cream system — the palette changed twice in one day; this section reflects the current, final state). Inspired by a premium-fashion-editorial reference: warm ivory/cream as the app environment, soft taupe/beige as the dominant card surface, deep charcoal as primary text, and a muted olive-brown reserved for typography accents, buttons, active/selected states, and brand — never as a full-bleed background. Restrained color use throughout; no bright gradients, neon, or glassmorphism.

### Theme Colors

#### Light Mode:
* **Environment (page canvas)**: Warm Ivory `#F7F2E9` / deep ivory `#EFE6D6` (`var(--color-bg)` / `var(--color-bg-deep)`)
* **Primary (Muted Olive-Brown)**: `#6B5A3D` (`var(--color-primary)`)
* **Primary Hover / Light**: `#59492F` / `#8A7754`
* **Surface (taupe/beige cards)**: `#EFE7D9` (`var(--color-surface)`)
* **Surface Subtle (nested beige)**: `#E5DAC6` (`var(--color-surface-subtle)`)
* **Surface Elevated**: Pure White `#FFFFFF` (`var(--color-surface-elevated)`)
* **Primary Text**: Deep Charcoal `#2B2723` (`var(--color-text-primary)`)
* **Secondary Text**: Muted Warm Gray-Brown `#6B6459` (`var(--color-text-secondary)`)
* **Border**: `rgba(43, 39, 35, 0.10)` (`var(--color-border)`)
* **Success**: `#5C7A52`
* **Danger** (errors, destructive actions): `#A8493B` (`var(--color-danger)`) — always reference this token, never hardcode a red

#### Dark Mode (`[data-theme="dark"]`):
* **Environment (page canvas)**: Deep Warm Charcoal `#1C1815` / `#14110E` (`var(--color-bg)` / `var(--color-bg-deep)`)
* **Primary**: Muted Gold-Olive `#C6A876` / hover `#D6BC8E`
* **Surface**: `#262019` / Subtle `#2F2820` / Elevated `#382F25`
* **Text**: Warm Off-White `#F5EFE4`
* **Secondary Text**: Muted Warm Gray `#B3A996`
* **Border**: `rgba(245, 241, 228, 0.09)`

### Typography
* **Serif Headings**: *Playfair Display* (`var(--font-display)`), used for display, screen, and section headings.
* **Geometric Sans**: *Plus Jakarta Sans* (`var(--font-family)`), used for body text, captions, button labels, and metadata.

### Surface Characteristics
* **Border Radius**: Cards `14px` (`--radius-md`) / `20px` (`--radius-lg`), bottom-sheet modals & the floating nav dock `26px` (`--radius-xl`), Pills `9999px` (`--radius-pill`).
* **Viewport Constraint**: Mobile-style application shell (`max-width: 480px`) centered on desktop with subtle borders and shadows.
* **Bottom Navigation**: Floating taupe pill dock (`--radius-xl`, `--shadow-lg`, `16px` inset from screen edges) rather than a full-bleed bar — see `BottomNavigation.tsx`. Four tabs plus a raised olive-brown camera circle in the centre (ivory ring, soft shadow) for Shop Check, the app's hero action.
* **Segmented Controls**: Shared `SegmentedControl` component (`src/components/ui/SegmentedControl.tsx`) — single taupe track, filled olive-brown active pill — used for Wardrobe Profile and Layering Preference in `ProfileScreen`.
* **Aesthetic Direction**: *Luxury fashion editorial × intelligent personal assistant × modern Apple-like simplicity*.
* **Constraint**: NO ecommerce UI patterns (no prices, cart icons, or star ratings). No dashed borders (reads as wireframe/placeholder, not premium) — empty/dropzone states use a solid border + soft shadow instead.

---

## 5. Brand Identity & Launch Experience

* **Official Wordmark**: `CLOSIQ`, with the brain/neural symbol integrated inside the final **Q** (the Q's counter is replaced by a brain icon; its tail remains a plain diagonal stroke).
* **Official Asset Location**: `public/brand/closiq-logo.png` is the official wordmark — the only CLOSIQ *logo*.
* **Official App Symbol** (chosen by the user 2026-11-01, replacing the 2026-10-14 "Spark hanger"): the **brain-Q** — the Q with the brain inside, CROPPED from the official wordmark `public/brand/closiq-logo.png` (never redrawn). It is the app icon on iOS, Android (adaptive + themed), the web favicon and the iPhone home-screen icon. Regenerate every size with `node scripts/generate-app-icons.mjs`; never edit the generated PNGs by hand. A changed icon only reaches phones through a new APK/IPA build — an OTA update cannot change it. (`public/brand/closiq-symbol.svg`, the retired Spark hanger, is kept for reference only.)
* **Rule — Do Not Recreate or Substitute**: Never redraw the wordmark in text/CSS, never use a generic brain icon, never redesign the Q, and never fabricate a placeholder logo. Change the app symbol only when the user asks. If either asset is ever missing, stop and ask — do not invent a replacement.
* **Asset Notes**: The PNG has an opaque baked-in warm-ivory background (`#F5F6F2`, not transparent). `ClosiqLogo` (`src/components/ui/ClosiqLogo.tsx`) wraps it in a plate matching that exact swatch so it reads cleanly with zero seam in both light and dark mode without altering the artwork.
* **Launch Intro Requirement** (cinematic since 2026-10-13, at the user's request — supersedes the earlier "1–2 s minimal splash" rule): every application launch and every browser/app reload shows the CLOSIQ intro — web `src/components/ui/SplashScreen.tsx` (+ `.intro*` in `src/index.css`), mobile `mobile/src/components/IntroSplash.tsx`. **Full film once per calendar day per device** (~4.2 s): letterbox bars → warm light through the door seam → almirah doors swing open → logo focus-pull → tagline "Style what you already own" → gold rule → bars retract. Other launches play a ~1.9 s "lite" cut (bars + logo + tagline). **Tap anywhere to skip, always.** `prefers-reduced-motion` / Reduce Motion → a still frame with a short fade. Still: no particles, no neon, no spinning logo, official logo asset only (doors, light and bars are plain shapes). Must NOT reappear on in-app tab navigation — it is gated on `<App>` mounting, not on route/tab changes.
---

## 6. Wardrobe Architecture

Asset folder structure under `public/wardrobe/`:

```
public/
  wardrobe/
    men/
      tops/
      bottoms/
      outerwear/
      footwear/
      accessories/
    women/
      tops/
      bottoms/
      outerwear/
      footwear/
      accessories/
```

### Stable Garment IDs
All clothing assets use stable, deterministic garment IDs mapping directly to public paths.

* Example: `oversized_graphic_tee` maps to:
  * `/wardrobe/men/tops/oversized_graphic_tee.png` or
  * `/wardrobe/women/tops/oversized_graphic_tee.png` depending on the active wardrobe profile.

AI engine must reference stable garment IDs/data rather than randomly selecting image paths.

---

## 7. Wardrobe Profiles

CLOSIQ supports two wardrobe profile modes:
* **Men**
* **Women**

The active user profile controls which sample/generated catalog is loaded (`src/data/garmentCatalog.ts`). Both profiles coexist cleanly within the single application architecture.

---

## 8. Clothing Categories & Layering

### Primary Categories:
1. **Tops**
2. **Bottoms**
3. **Outerwear**
4. **Footwear**
5. **Accessories**

> **Rule**: Tank tops belong under **Tops → Tank Tops**. Do NOT create "Inners" as a primary wardrobe category.

### Layering Metadata (`layeringRole`):
* `base_layer`: Tank tops, undershirts, thin camisoles.
* `primary_layer`: Shirts, blouses, sweaters, t-shirts, pants, skirts.
* `outer_layer`: Trench coats, blazers, leather jackets, parkas.

---

## 9. Layering Preferences

User selectable preference:
* `avoid_base_layer` ("Avoid base layers")
* `sometimes` ("Sometimes")
* `usually` ("Usually")

### AI Rule:
If the user selects `avoid_base_layer`, CLOSIQ must NOT automatically recommend base layers/tank tops underneath another garment unless explicitly requested by the user prompt.

---

## 10. AI Styling Rules

The AI Stylist evaluates:
1. User wardrobe (items owned)
2. Active wardrobe profile (Men/Women)
3. Occasion & user prompt
4. Color compatibility & contrast
5. Garment category balance
6. Fit & formality level
7. Layering role & layering preferences
8. Weather temperature

### Critical Rule:
> **Do not recommend clothing that the user does not own unless explicitly presented as a future wardrobe suggestion.**

The AI engine must use stable garment IDs from the active wardrobe.

---

## 11. Existing Architecture

### Live Application Structure:
* **Entry Point**: [src/main.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/main.tsx)
* **Main Container**: [src/App.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/App.tsx)
* **Screen Views**:
  * [src/components/screens/OnboardingScreen.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/components/screens/OnboardingScreen.tsx)
  * [src/components/screens/TodayScreen.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/components/screens/TodayScreen.tsx)
  * [src/components/screens/CollectionScreen.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/components/screens/CollectionScreen.tsx)
  * [src/components/screens/StylistScreen.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/components/screens/StylistScreen.tsx)
  * [src/components/screens/PlannerScreen.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/components/screens/PlannerScreen.tsx)
  * [src/components/screens/ProfileScreen.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/components/screens/ProfileScreen.tsx)
* **UI Components**:
  * [src/components/ui/AppHeader.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/components/ui/AppHeader.tsx)
  * [src/components/ui/BottomNavigation.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/components/ui/BottomNavigation.tsx)
  * [src/components/ui/PrimaryButton.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/components/ui/PrimaryButton.tsx)
  * [src/components/ui/SecondaryButton.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/components/ui/SecondaryButton.tsx)
  * [src/components/ui/IconButton.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/components/ui/IconButton.tsx)
  * [src/components/ui/SectionHeader.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/components/ui/SectionHeader.tsx)
  * [src/components/ui/CategoryChip.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/components/ui/CategoryChip.tsx)
  * [src/components/ui/ClothingCard.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/components/ui/ClothingCard.tsx)
  * [src/components/ui/OutfitCard.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/components/ui/OutfitCard.tsx)
  * [src/components/ui/AIRecommendationCard.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/components/ui/AIRecommendationCard.tsx)
  * [src/components/ui/EmptyState.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/components/ui/EmptyState.tsx)
  * [src/components/ui/GarmentImage.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/components/ui/GarmentImage.tsx)
  * [src/components/ui/ClosiqLogo.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/components/ui/ClosiqLogo.tsx)
  * [src/components/ui/SplashScreen.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/components/ui/SplashScreen.tsx)
  * [src/components/ui/SegmentedControl.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/components/ui/SegmentedControl.tsx)
* **Modal Dialogs**:
  * [src/components/modals/AddItemModal.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/components/modals/AddItemModal.tsx)
  * [src/components/modals/ClothingDetailModal.tsx](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/components/modals/ClothingDetailModal.tsx)
  * [src/components/modals/ShopCheckModal.tsx](src/components/modals/ShopCheckModal.tsx) / [src/components/modals/WardrobeFilterSheet.tsx](src/components/modals/WardrobeFilterSheet.tsx)
* **Services**:
  * [src/services/aiStylist.ts](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/services/aiStylist.ts)
  * [src/services/aiVisionScanner.ts](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/services/aiVisionScanner.ts)
  * Shared web/mobile, on-device: [src/services/shopCheck.ts](src/services/shopCheck.ts) (Shop Check), [src/services/wardrobeSearch.ts](src/services/wardrobeSearch.ts) + [src/services/wardrobeFilters.ts](src/services/wardrobeFilters.ts) (Wardrobe search/filters), [src/services/pairingSuggestions.ts](src/services/pairingSuggestions.ts) (Pairs well with).
  * [src/services/ai/geminiClient.ts](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/services/ai/geminiClient.ts) / `wardrobeVision.ts` / `outfitStylist.ts` / `validator.ts` — client-side proxies to `/api/ai/*`, never hold the API key.
* **Server** (Sprint 19 — `GEMINI_API_KEY` is read here ONLY, never sent to the browser):
  * [server/geminiServer.js](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/server/geminiServer.js) — single source of truth for Gemini prompts/schemas (converted from `.ts` to plain `.js` in Sprint 19 so it's runnable by plain Node in production, not just Vite/esbuild — the old `.ts` file no longer exists).
  * [server/apiRouter.js](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/server/apiRouter.js) — shared `/api/ai/*` request parsing + routing (`handleApiRequest(req, res)`), used identically by both dev and production.
  * [server/index.js](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/server/index.js) — production entry point (`npm run start`): plain Node `http`, serves built `dist/` with SPA fallback, exposes `/api/ai/*` via `apiRouter.js`. No framework.
  * `vite.config.js`'s `geminiApiPlugin()` — dev-only equivalent (`npm run dev`), delegates to the same `apiRouter.js`. Also calls `loadEnv()` and merges into `process.env` so `.env` reaches server code in dev (Vite does not do this automatically).
  * [server/studioPhoto.js](server/studioPhoto.js) — `POST /api/ai/studio-photo`: free white-background "studio" cut-out (U²-Net `server/models/u2netp.onnx` via onnxruntime-node + sharp; original pixels, no Gemini). Clients always let the user choose original vs studio.
  * **Hosting (2026-10-13): Vercel** — `api/ai/[route].js` wraps the same `apiRouter.js` (which accepts Vercel's pre-parsed `req.body`), `api/healthz.js`, `api/keepalive.js` (daily cron so the free Supabase project never pauses). `vercel.json` ships only linux-x64 onnxruntime binaries. Live at https://closiq-liard.vercel.app. `server/index.js` remains for plain-Node hosting.
* **No demo account (2026-10-14)**: the shared demo login was removed from web and mobile at the user's request. New accounts start with an empty wardrobe and zero Style DNA.
* **Web accounts (2026-10-13)**: the website signs in with the same Supabase accounts as the mobile app (`src/services/cloud/*`, `src/components/screens/LoginScreen.tsx`); wardrobe, saved looks and preferences are cloud rows shared with mobile. `vite.config.js` exposes ONLY the public Supabase URL + anon key to the bundle and refuses a service-role key.
* **Outfit brain (2026-10-14)**: `src/services/outfitBrain.ts` (shared web/mobile) remembers the user's reaction to each outfit *combination* — `outfit_feedback` (dislike = never suggest again, okay = less, nice = taste) and `saved_outfits.status` ('try_later' / 'worn'). Every suggestion path must pass the brain: it goes to the AI as `recentOutfitContext` (server rule 12) AND is enforced on the result (`isFreshCombination`) and in the local engine (`pickLocalOutfit`). Style DNA blends owned clothes with liked/worn looks.
* **Wardrobe intelligence (2026-11-11)**: `src/services/intelligence/outfitEngine.ts` (shared) is the explainable rule-based engine — it builds the local/fallback outfits AND scores every outfit (AI or local) into `ruleScore` + `scoreBreakdown`; `garmentTraits.ts` is the ONE definition of formality/colour/ethnic/one-piece rules. Every recommender must skip pieces where `isGarmentAvailable()` is false (laundry/unavailable). Never show an invented number: `styleScore` is only the AI's own %, 0 for rule-based picks and after swaps; label via `matchLabel()`; `temperature` only from real weather. Weather: `src/services/weather/weatherCore.ts` (shared Open-Meteo parsing), web `webWeather.ts`, mobile `weatherService.ts`. Web planner has dated events in the shared `planner_events` table + `.ics` export (`src/services/calendarExport.ts`). Analytics: `wardrobeAnalytics.ts`. Account deletion/export + AI-photo consent on both platforms. Details: `docs/ARCHITECTURE.md`.
* **Schema rollout rule**: migrations live in `supabase/migrations/` (timestamped). Client code must keep working when a newer additive migration is not applied yet (`src/services/cloud/schemaErrors.ts` fallbacks). Never apply migrations to production without the owner's go-ahead.
* **Garment details**: `storageLocation` ("where is it kept", Indian household presets + custom — `src/data/storageLocations.ts`) and `size` (`src/data/garmentSizes.ts`) are shared web/mobile fields backed by `garments.storage_location` / `garments.size`.
* **Git workflow (user instruction, 2026-10-13)**: commit and push directly to `main` — no PRs — and keep the local CLOSIQ folder in sync (`git pull`). Never commit `.env` files; the repo is public.
* **Data & Types**:
  * [src/types/wardrobe.ts](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/types/wardrobe.ts)
  * [src/data/garmentCatalog.ts](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/data/garmentCatalog.ts)
  * [src/data/styleDna.ts](src/data/styleDna.ts) — shared Style DNA: scores are the share of the user's own wardrobe (0 for a new account); style options asked at onboarding (`profiles.style_preferences`).
* **Styling**:
  * [src/index.css](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/index.css)
* **Mobile app** (`mobile/`, React Native): runs on **Expo SDK 57** — upgraded from SDK 54 on 2026-09-12 at the user's explicit request, superseding the earlier "stay on SDK 54" rule. Requires Node >= 22.13. New Architecture and Android edge-to-edge are mandatory at this SDK; see `mobile/AGENTS.md` for the constraints that follow from that. `mobile/metro.config.js` widens Metro's `watchFolders` to the repo root so the mobile app can reuse this project's shared `src/types` and `src/data` — that shared-root arrangement is deliberate and must be preserved.

---

## 12. Coding Rules

1. **Inspect First**: Always inspect existing code before modifying.
2. **Extend Existing Components**: Prefer extending established UI components rather than creating parallel implementations.
3. **No Parallel Implementations**: Never build a second copy of an existing screen or service.
4. **Keep Architecture Simple**: Optimize for 24-hour hackathon execution and high reliability.
5. **Mobile Responsiveness P0**: Ensure all views render cleanly inside the mobile viewport shell.
6. **Verify Before Declaring Completion**: Always run `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` and `npm run test:server` (see `docs/TESTING.md`); UI is verified by code + build only unless the owner asks otherwise.

---

## 13. Hackathon Priority Matrix

* **P0**: Core hero demo reliability (Upload → Understand → Collection → Stylist → Outfit → Why It Works → Swap).
* **P1**: Important design system polish and visual consistency.
* **P2**: Nice-to-have secondary features.

---

## 14. Target Core Demo Flow

1. Select wardrobe profile (Men/Women).
2. Add clothing.
3. Upload real image / select sample piece.
4. AI Vision scanner analyzes garment.
5. Confirm garment attributes.
6. Garment appears in Collection.
7. Open Today or Stylist.
8. Select or type occasion.
9. Generate AI outfit.
10. Outfit uses actual owned wardrobe items.
11. View *"Why It Works"* rationale.
12. Swap a garment piece.
13. Save outfit.
14. Open Profile.
15. Saved outfit is visible under Saved Looks.

---

## 15. Multi-Session Rule

Every future Claude session **MUST** begin by reading:
1. `CLAUDE.md`
2. `STATE.md`

After completing work, update `STATE.md`. Do not alter `CLAUDE.md` unless permanent rules or architecture decisions change.
