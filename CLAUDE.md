# CLAUDE.md — HeyHanger Permanent Project Context & Rules

This document is the permanent instruction and context guide for every Claude session working on **HeyHanger**.

Before starting work, read the latest entry in [astra.md](astra.md) for changes made by Codex and any open follow-ups.

Android 2.0.0 (HeyHanger.ai on the phone, no Gemini on Android) is the current product; it was merged into `main` on 2026-11-20 and ships as an EAS-signed update of the 1.x app. Use [the Android deployment guide](docs/v2/MOBILE_DEPLOYMENT.md) and record hardware evidence before claiming device results. The notes below still describe the shared web/V1 architecture.

---

## 1. Project Identity

* **Project**: HeyHanger
* **Description**: AI-powered personal wardrobe and styling application.
* **Core Promise**: **Upload the clothes you own → HeyHanger understands them → organize them into a digital wardrobe → ask what you want to wear → HeyHanger creates an outfit using your actual wardrobe.**
* **Core Loop**:
  `UPLOAD → UNDERSTAND → COLLECTION → OCCASION → AI STYLIST → OUTFIT → WHY IT WORKS → SWAP`

---

## 2. Product Philosophy

### HeyHanger IS:
* A personal digital wardrobe
* An AI stylist
* A wardrobe intelligence system
* Personalized strictly to the user's actual clothes

### HeyHanger IS NOT:
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
5. **Profile** (`"What does HeyHanger know about my style?"`): Style Archetype card, quick links to Wardrobe/Planner, Style DNA archetype, closet color breakdown, saved looks, Style Preferences (Wardrobe Profile Men/Women + Layering, grouped), and Settings (Notifications — informational only, no backend — plus the working appearance theme toggle).

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

* **Name** (rebranded from CLOSIQ on 2026-11-20 at the user's request): product and project **HeyHanger** (both Hs capitalised, one word); the assistant **HeyHanger.ai** (screens can say "Ask HeyHanger.ai"; the user chose this spelling on 2026-11-20 — it is a display name, not a web address, and no heyhanger.ai domain is used); the custom model family **HeyHanger-VLM** (`HeyHanger-VLM-500M` where the 500M designation applies); plain identifier `heyhanger`, assistant slug `heyhanger-ai`. Personality: friendly, personal, easy to talk to — the friend you ask "What goes with this shirt?". Older notes (STATE.md, earlier astra.md entries) keep the old name as history.
* **Logo**: an original **HH monogram** — two capital Hs with one subtle hanger cue, a small hook rising from the gap between them — plus a monoline rounded "HeyHanger" wordmark. Full reference: [docs/BRANDING.md](docs/BRANDING.md); preview sheet `docs/brand/heyhanger-preview.png`.
* **Editable masters**: `public/brand/heyhanger-mark.svg` and `public/brand/heyhanger-wordmark.svg`. Every other brand file (lockups, single-colour/reversed variants, app icon tile, Android adaptive foreground/monochrome, favicon, apple-touch icon, phone lockup `mobile/assets/heyhanger-logo.png`, social images) is generated by `node scripts/generate-app-icons.mjs`; never edit generated files by hand. A changed icon only reaches phones through a new APK/IPA build — an OTA update cannot change it.
* **Rule — Do Not Recreate or Substitute**: never redraw the mark or wordmark in text/CSS, never swap in a generic hanger/clothing icon, and never fabricate a placeholder. Change the logo only when the user asks, by editing the masters and regenerating. If the masters are missing, stop and ask.
* **Asset Notes**: the app icon is an olive-brown `#6B5A3D` tile with an ivory `#F7F2E9` mark (Android adaptive background colour in `mobile/app.json` must match). In the UI the lockup sits on a warm-ivory `#F7F2E9` plate (`HeyHangerLogo`, `src/components/ui/HeyHangerLogo.tsx`; mobile `IntroSplash` plate) so it reads on light, dark and the charcoal intro.
* **Launch Intro Requirement** (cinematic since 2026-10-13, at the user's request — supersedes the earlier "1–2 s minimal splash" rule): every application launch and every browser/app reload shows the HeyHanger intro — web `src/components/ui/SplashScreen.tsx` (+ `.intro*` in `src/index.css`), mobile `mobile/src/components/IntroSplash.tsx`. **Full film once per calendar day per device** (~4.2 s): letterbox bars → warm light through the door seam → almirah doors swing open → logo focus-pull → tagline "Style what you already own" → gold rule → bars retract. Other launches play a ~1.9 s "lite" cut (bars + logo + tagline). **Tap anywhere to skip, always.** `prefers-reduced-motion` / Reduce Motion → a still frame with a short fade. Still: no particles, no neon, no spinning logo, official HeyHanger lockup only (doors, light and bars are plain shapes). Must NOT reappear on in-app tab navigation — it is gated on `<App>` mounting, not on route/tab changes.
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

HeyHanger supports two wardrobe profile modes:
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
If the user selects `avoid_base_layer`, HeyHanger must NOT automatically recommend base layers/tank tops underneath another garment unless explicitly requested by the user prompt.

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
* **Entry Point**: [src/main.tsx](src/main.tsx)
* **Main Container**: [src/App.tsx](src/App.tsx)
* **Screen Views**:
  * [src/components/screens/OnboardingScreen.tsx](src/components/screens/OnboardingScreen.tsx)
  * [src/components/screens/TodayScreen.tsx](src/components/screens/TodayScreen.tsx)
  * [src/components/screens/CollectionScreen.tsx](src/components/screens/CollectionScreen.tsx)
  * [src/components/screens/StylistScreen.tsx](src/components/screens/StylistScreen.tsx)
  * [src/components/screens/PlannerScreen.tsx](src/components/screens/PlannerScreen.tsx)
  * [src/components/screens/ProfileScreen.tsx](src/components/screens/ProfileScreen.tsx)
* **UI Components**:
  * [src/components/ui/AppHeader.tsx](src/components/ui/AppHeader.tsx)
  * [src/components/ui/BottomNavigation.tsx](src/components/ui/BottomNavigation.tsx)
  * [src/components/ui/PrimaryButton.tsx](src/components/ui/PrimaryButton.tsx)
  * [src/components/ui/SecondaryButton.tsx](src/components/ui/SecondaryButton.tsx)
  * [src/components/ui/IconButton.tsx](src/components/ui/IconButton.tsx)
  * [src/components/ui/SectionHeader.tsx](src/components/ui/SectionHeader.tsx)
  * [src/components/ui/CategoryChip.tsx](src/components/ui/CategoryChip.tsx)
  * [src/components/ui/ClothingCard.tsx](src/components/ui/ClothingCard.tsx)
  * [src/components/ui/OutfitCard.tsx](src/components/ui/OutfitCard.tsx)
  * [src/components/ui/AIRecommendationCard.tsx](src/components/ui/AIRecommendationCard.tsx)
  * [src/components/ui/EmptyState.tsx](src/components/ui/EmptyState.tsx)
  * [src/components/ui/GarmentImage.tsx](src/components/ui/GarmentImage.tsx)
  * [src/components/ui/HeyHangerLogo.tsx](src/components/ui/HeyHangerLogo.tsx)
  * [src/components/ui/SplashScreen.tsx](src/components/ui/SplashScreen.tsx)
  * [src/components/ui/SegmentedControl.tsx](src/components/ui/SegmentedControl.tsx)
* **Modal Dialogs**:
  * [src/components/modals/AddItemModal.tsx](src/components/modals/AddItemModal.tsx)
  * [src/components/modals/ClothingDetailModal.tsx](src/components/modals/ClothingDetailModal.tsx)
  * [src/components/modals/ShopCheckModal.tsx](src/components/modals/ShopCheckModal.tsx) / [src/components/modals/WardrobeFilterSheet.tsx](src/components/modals/WardrobeFilterSheet.tsx)
* **Services**:
  * [src/services/aiStylist.ts](src/services/aiStylist.ts)
  * [src/services/aiVisionScanner.ts](src/services/aiVisionScanner.ts)
  * Shared web/mobile, on-device: [src/services/shopCheck.ts](src/services/shopCheck.ts) (Shop Check), [src/services/wardrobeSearch.ts](src/services/wardrobeSearch.ts) + [src/services/wardrobeFilters.ts](src/services/wardrobeFilters.ts) (Wardrobe search/filters), [src/services/pairingSuggestions.ts](src/services/pairingSuggestions.ts) (Pairs well with).
  * [src/services/ai/geminiClient.ts](src/services/ai/geminiClient.ts) / `wardrobeVision.ts` / `outfitStylist.ts` / `validator.ts` — client-side proxies to `/api/ai/*`, never hold the API key.
* **Server** (Sprint 19 — `GEMINI_API_KEY` is read here ONLY, never sent to the browser):
  * [server/geminiServer.js](server/geminiServer.js) — single source of truth for Gemini prompts/schemas (converted from `.ts` to plain `.js` in Sprint 19 so it's runnable by plain Node in production, not just Vite/esbuild — the old `.ts` file no longer exists).
  * [server/apiRouter.js](server/apiRouter.js) — shared `/api/ai/*` request parsing + routing (`handleApiRequest(req, res)`), used identically by both dev and production.
  * [server/index.js](server/index.js) — production entry point (`npm run start`): plain Node `http`, serves built `dist/` with SPA fallback, exposes `/api/ai/*` via `apiRouter.js`. No framework.
  * `vite.config.js`'s `geminiApiPlugin()` — dev-only equivalent (`npm run dev`), delegates to the same `apiRouter.js`. Also calls `loadEnv()` and merges into `process.env` so `.env` reaches server code in dev (Vite does not do this automatically).
  * [server/studioPhoto.js](server/studioPhoto.js) — `POST /api/ai/studio-photo`: free white-background "studio" cut-out (U²-Net `server/models/u2netp.onnx` via onnxruntime-node + sharp; original pixels, no Gemini). Clients always let the user choose original vs studio.
  * **Hosting (2026-10-13): Vercel** — `api/ai/[route].js` wraps the same `apiRouter.js` (which accepts Vercel's pre-parsed `req.body`), `api/healthz.js`, `api/keepalive.js` (daily cron so the free Supabase project never pauses). `vercel.json` ships only linux-x64 onnxruntime binaries. Live at https://closiq-liard.vercel.app. `server/index.js` remains for plain-Node hosting.
* **No demo account (2026-10-14)**: the shared demo login was removed from web and mobile at the user's request. New accounts start with an empty wardrobe and zero Style DNA.
* **Web accounts (2026-10-13)**: the website signs in with the same Supabase accounts as the mobile app (`src/services/cloud/*`, `src/components/screens/LoginScreen.tsx`); wardrobe, saved looks and preferences are cloud rows shared with mobile. `vite.config.js` exposes ONLY the public Supabase URL + anon key to the bundle and refuses a service-role key.
* **Outfit brain (2026-10-14)**: `src/services/outfitBrain.ts` (shared web/mobile) remembers the user's reaction to each outfit *combination* — `outfit_feedback` (dislike = never suggest again, okay = less, nice = taste) and `saved_outfits.status` ('try_later' / 'worn'). Every suggestion path must pass the brain: it goes to the AI as `recentOutfitContext` (server rule 12) AND is enforced on the result (`isFreshCombination`) and in the local engine (`pickLocalOutfit`). Style DNA blends owned clothes with liked/worn looks.
* **Wardrobe intelligence (2026-11-11)**: `src/services/intelligence/outfitEngine.ts` (shared) is the explainable rule-based engine — it builds the local/fallback outfits AND scores every outfit (AI or local) into `ruleScore` + `scoreBreakdown`; `garmentTraits.ts` is the ONE definition of formality/colour/ethnic/one-piece rules. Every recommender must skip pieces where `isGarmentAvailable()` is false (laundry/unavailable). Never show an invented number: `styleScore` is only the AI's own %, 0 for rule-based picks and after swaps; label via `matchLabel()`; `temperature` only from real weather. Weather: `src/services/weather/weatherCore.ts` (shared Open-Meteo parsing), web `webWeather.ts`, mobile `weatherService.ts`. Web planner has dated events in the shared `planner_events` table + `.ics` export (`src/services/calendarExport.ts`). Analytics: `wardrobeAnalytics.ts`. Account deletion/export + AI-photo consent on both platforms. Details: `docs/ARCHITECTURE.md`.
* **Schema rollout rule**: migrations live in `supabase/migrations/` (timestamped). Client code must keep working when a newer additive migration is not applied yet (`src/services/cloud/schemaErrors.ts` fallbacks). Never apply migrations to production without the owner's go-ahead.
* **Garment details**: `storageLocation` ("where is it kept", Indian household presets + custom — `src/data/storageLocations.ts`) and `size` (`src/data/garmentSizes.ts`) are shared web/mobile fields backed by `garments.storage_location` / `garments.size`.
* **Git workflow (user instruction, 2026-10-13)**: commit and push directly to `main` — no PRs — and keep the local HeyHanger folder in sync (`git pull`). Never commit `.env` files; the repo is public.
* **Retained CLOSIQ identifiers (deliberate, 2026-11-20 rebrand)**: Android/iOS ID `com.closiq.app` (already installed on users' phones; changing it would break in-place updates and orphan wardrobes), Expo `slug`/`scheme` `closiq` + EAS project/OTA URL, every `@closiq_*` (mobile AsyncStorage) and `closiq_*` (web localStorage) key, the calendar UID domain `@closiq.app`, applied `supabase/migrations/*closiq*` files, the Vercel URL `closiq-liard.vercel.app`, the Vercel project `closiq`, the Supabase project name "Closiq" and the GitHub repo `vudigapranav/CLOSIQ`. None is shown to users. The workspace folder is still `.../Demux/CLOSIQ` until the owner moves it (procedure in astra.md). Do not "finish" the rename of these without a migration plan.
* **Data & Types**:
  * [src/types/wardrobe.ts](src/types/wardrobe.ts)
  * [src/data/garmentCatalog.ts](src/data/garmentCatalog.ts)
  * [src/data/styleDna.ts](src/data/styleDna.ts) — shared Style DNA: scores are the share of the user's own wardrobe (0 for a new account); style options asked at onboarding (`profiles.style_preferences`).
* **Styling**:
  * [src/index.css](src/index.css)
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
