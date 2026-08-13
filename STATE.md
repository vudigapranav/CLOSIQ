# STATE.md — CLOSIQ Living Implementation State

This document tracks the live implementation status of **CLOSIQ**. It is updated at the end of every active development turn/session.

---

## Current Phase

* **Phase**: Multi-Session Hackathon Refinement & Wardrobe Profile Context Integration
* **Status**: Sprints 1 through 10 complete. The full P0 hero demo loop is hardened and verified end-to-end, and the Today screen — the first thing judges see — is polished into a clear hero moment: header hierarchy, occasion chips, free-text prompt, and a premium outfit card with imagery, style match, vibe, and why-it-works, verified at 375/390/414px in both themes.

---

## Completed Work

- [x] **Sprint 1 — Design System & Application Shell**:
  - Centralized design tokens for Light mode (Ivory `#FAF8F5`, Emerald `#0D3B2E`) and Dark mode (`#0B100E` green-black).
  - Serif headings (*Playfair Display*) + Geometric sans body (*Plus Jakarta Sans*).
  - 4 primary navigation tabs (**Today**, **Collection**, **Stylist**, **Profile**).
  - Mobile viewport container shell with border elevation.
- [x] **Sprint 2 — Today Experience**:
  - Header greeting (*"Good afternoon, Pranav. What's the occasion?"*).
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

---

## Current Sprint

* **Active Sprint**: None — Sprint 10 complete. Awaiting next priority (see Next Task).

---

## P0 Issues (Critical Demo Blockers)

* None currently. Core hero loop builds cleanly and runs live at `http://localhost:5173/`.

---

## P1 Issues (Important UX & Design Polish)

* [ ] Add actual PNG garment assets into `public/wardrobe/men/` and `public/wardrobe/women/` directories — currently rendering on-brand placeholder icons via `GarmentImage` (verified working as designed, but real art is the next visual upgrade).
* [x] Integrate wardrobe profile selection (Men/Women) into Onboarding/Profile settings. — Done & verified.

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

---

## Wardrobe Asset Status

* **Men Assets Structure**: `public/wardrobe/men/` created (`tops`, `bottoms`, `outerwear`, `footwear`, `accessories`) — 10 catalog items wired.
* **Women Assets Structure**: `public/wardrobe/women/` created (`tops`, `bottoms`, `outerwear`, `footwear`, `accessories`) — 10 catalog items wired.
* **Current Status**: Catalog structure complete; only `.gitkeep` placeholders in asset folders (no PNGs yet). Verified in browser: `GarmentImage` gracefully renders an on-brand icon + category label swatch instead of a broken image, so this is safe to demo before art lands. No stale flat (`/wardrobe/<category>/`) paths remain — only a stale doc comment in `GarmentImage.tsx` was found and fixed.
* **Catalog Schema**: Every `GARMENT_CATALOG` entry now exposes `id`, `profile`, `category`, `subcategory`, `name`, `color`, `hexColor`, `fabric`, `fit`, `style`, `seasons`, `formality`, `layeringRole?`, `tags`, `pairingNotes`, and `imagePath`. The AI and every screen consume `GarmentItem.imageUrl` (set from `entry.imagePath` at seed time) and `GarmentItem.id` — no code path ever guesses a filename.

---

## AI Status

* **Outfit Generator**: Working, single shared engine (`generateAIOutfit`) for Today and Stylist — confirmed identical output from both screens. Selects items strictly from active user wardrobe. `applyLayeringPreference()` correctly excludes `base_layer` tops when preference is `avoid`, unless the prompt explicitly asks for layering or the outfit already has an outer layer. No longer backfills an empty category with a wrong-category item (Sprint 9 fix) — missing categories are surfaced via `Outfit.missingCategories` and a UI note instead.
* **Vision Scanner**: Working simulated AI analysis stage (`"Understanding your garment..."`), now with a real-photo-tested pixel-based dominant color extraction path (`extractDominantColor`) and file-type validation in front of it.
* **Occasion Handling**: Working with presets (*College, Work, Date Night, etc.*) and free-form prompts. Custom text confirmed to flow into `activePrompt`/`generateAIOutfit` and change the outfit title/label live.
* **Swap Behavior**: Working single-piece replacement logic, now wrapped in try/catch (`handleSwapPiece`). Note: `swapGarmentInOutfit()` cycles candidates by category only and does not re-check `layeringPreference` itself — acceptable today because it only surfaces a base layer when an outer layer is already in the outfit, but worth a closer look if swap logic changes.
* **Save Behavior**: Working saved looks state, confirmed shared across Today/Stylist/Profile (save on Today → reflected as "Saved" on Stylist → appears in Profile's Saved Looks).

---

## UI Status

* **Light Mode**: Verified `#FAF8F5` warm ivory and `#0D3B2E` deep emerald palette.
* **Dark Mode**: Verified `#0B100E` green-black and `#38997E` emerald palette, toggled live via Profile screen.
* **Mobile Responsiveness**: Verified at 375×812, 390×844, and 414×896 — no overflow/clipping in Today, Collection, or Add Item modal, in either theme.
* **Wardrobe Asset Resolution (Sprint 8)**: Spot-checked in browser — Men Collection shows all 10 catalog items (tank top correctly under Tops, 2 items per category), Today's AI outfit resolves real catalog `imageUrl`s for both Men and Women, all via `GarmentImage`'s graceful placeholder (no PNGs exist yet, no broken icons, no unrelated stock imagery).
* **Launch Splash**: Verified — fades/scales in, holds, fades out to reveal the app already rendered underneath, in both light and dark mode, at mobile (375px) and desktop widths. Does not re-trigger on Today↔Collection↔Stylist tab navigation. `prefers-reduced-motion` path verified by code/CSS review (the Browser pane tool has no way to emulate that media feature directly).
* **P0 Flow (Sprint 9)**: Verified live end-to-end from a fresh (cleared `localStorage`) state — Men profile → Add Item → real image upload (simulated via a genuine PNG file, not a mock) → AI scanning state → real pixel-based color detection → confirm → Collection → Today → occasion chip → custom free-text occasion (title updates live) → generate → why-it-works → swap → save → Stylist (shows identical outfit, "Saved" state carries over) → Profile (saved look appears with the real uploaded photo rendering correctly in the thumbnail). Reload-persistence of the uploaded photo confirmed directly (see AI Status). Upload error state (non-image file) verified live: shows "Something Went Wrong" + message + Try Again, resets cleanly. Retested at 375/390/414px and light/dark.
* **Today Hero Polish (Sprint 10)**: Verified live at 375px and 414px, light and dark — header hierarchy (greeting → subtitle → dressing-for prompt → chips → input), the hero outfit card (title, vibe, 2×176px garment images, match badge, why-it-works, stacked full-width action buttons), and the empty state, all render with no wrapped buttons, no broken/clipped score badge, no horizontal overflow, and no ugly scrollbar (only the intentional hidden-scrollbar chip rail plus the browser's normal vertical page scrollbar).
* **Known Visual Problems**: None.

---

## Known Risks

* PNG asset files still need to be dropped into `public/wardrobe/<profile>/<category>/` — placeholder icons are a safe demo fallback but not the final visual polish.
* `swapGarmentInOutfit()` doesn't independently apply `layeringPreference` (see AI Status note above) — currently benign, revisit if swap logic is reworked.
* `logo.png`'s baked-in background (`#F5F6F2`) is a very close but not pixel-exact match to `--color-bg` in light mode (`#FAF8F5`); the `ClosiqLogo` plate uses the asset's own swatch so this is imperceptible in practice, but if the design system's light background token ever changes, re-check for a visible seam.
* `~/Downloads/closiq-wordmark.svg` exists and is named similarly to the real asset but is **not** the official logo (no brain motif, wrong palette) — do not let a future session pick it up by mistake.
* **localStorage size with base64 photos**: uploaded images are now stored as base64 `data:` URLs (≈33% larger than the raw file) directly in `localStorage`'s ~5–10MB-per-origin budget. Fine for a handful of demo uploads; if many/large photos get uploaded during a real demo, `localStorage.setItem` could start throwing `QuotaExceededError` (not currently caught — the `useEffect` persistence in `App.tsx` would silently fail to save on that write). Acceptable tradeoff for hackathon reliability (this fixes the worse bug of photos vanishing on reload) but worth a guard if the demo grows.
* `AIRecommendationCard.tsx` and `OutfitCard.tsx` (`src/components/ui/`) are confirmed dead code — zero imports anywhere in the app. Not a duplicate outfit system (nothing renders them), just unused files from early scaffolding. Left alone this sprint (out of scope); safe to delete in a future cleanup pass.

---

## Next Task

**Task**: Populate `public/wardrobe/men/` and `public/wardrobe/women/` with real generated/photographed PNG garment assets per `public/wardrobe/README.md` (stable IDs, `style`, and `imagePath` already wired end-to-end — dropping in `<id>.png` files is the only remaining step, zero code changes needed).

---

## Last Updated

* **Date**: 2026-08-13
* **Session**: Sprint 10 — Today screen hero polish. Fixed the header copy hierarchy against spec, surfaced the previously-invisible outfit "vibe" (and made it occasion-aware), enlarged the hero card's imagery and typography without restructuring it, and reverified mobile hardening at 375/414px in both themes.
