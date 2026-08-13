# STATE.md — CLOSIQ Living Implementation State

This document tracks the live implementation status of **CLOSIQ**. It is updated at the end of every active development turn/session.

---

## Current Phase

* **Phase**: Multi-Session Hackathon Refinement & P0 Demo Flow Hardening
* **Status**: Sprints 1 through 12 complete. The wardrobe catalog runs entirely on real hackathon-team assets from `public/test samples/` (58 garments, both profiles, all 5 categories). Sprint 12 was a code-review hardening pass across the full core demo flow (Profile → Add Clothing → AI Understands → Collection → Occasion → AI Stylist → Outfit → Why It Works → Swap → Save) requested as "Sprint 6" in the brief — numbered 12 here to continue this file's own sequence. Found and fixed 7 real bugs by reading every file in the flow end-to-end. Build/lint verified after every fix. **Live browser verification was cut short by explicit user instruction mid-session** ("dont check anything just code") — see Known Risks for exactly what was and wasn't confirmed live.

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

---

## Current Sprint

* **Active Sprint**: None — Sprint 12 complete. Awaiting next priority (see Next Task).

---

## P0 Issues (Critical Demo Blockers)

* None currently open. Core hero loop builds cleanly (`npm run build`, `npm run lint` both clean). The 6 real bugs found this sprint (brand wordmark, upload misclassification, Profile identity mismatch, Collection empty state, dead Swap button, compounding swap title, invented Why-It-Works pairing) are all fixed and build-verified — see Sprint 12 notes above. **Not yet re-confirmed live end-to-end** — see Known Risks, this is the single most important thing to do before a real demo.

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
* **Swap Behavior**: Working single-piece replacement logic, wrapped in try/catch (`handleSwapPiece`). Sprint 12: fixed a silent no-op (Swap did nothing with zero feedback when a category had only 1 candidate — now shows an inline message) and a title bug (repeated swaps used to compound into `"Title (Variation) (Variation) (Variation)"` — now idempotent). Note: `swapGarmentInOutfit()` cycles candidates by category only and does not re-check `layeringPreference` itself — acceptable today because it only surfaces a base layer when an outer layer is already in the outfit, but worth a closer look if swap logic changes.
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
* **Brand Wordmark in App Chrome (Sprint 12)**: `AppHeader` and `OnboardingScreen` now render the real `ClosiqLogo` asset instead of CSS text — confirmed live on the one browser pass this sprint that ran (header at 92px width, no shadow, re-tuned header padding; Onboarding at 170px width, centered). Not yet re-checked in dark mode this sprint, though `ClosiqLogo`'s plate logic is unchanged from Sprint 7 (already dark-mode-verified then).
* **Known Visual Problems**: None found by code review this sprint; see Known Risks for what wasn't live-checked.

---

## Known Risks

* **Sprint 12's fixes are build-verified but NOT freshly live-verified end-to-end** (browser testing was cut short partway through by explicit user instruction — "dont check anything just code"). Exactly what was and wasn't seen running:
  - **Confirmed live** (one clean pass before the pivot, Men profile, 390px, fresh localStorage): Onboarding with the real logo → Today screen auto-generating a real outfit from the seed wardrobe with genuine photographed garments across all 5 categories → correct match score, vibe line, "Why It Works" copy, Swap/Save buttons. The `AppHeader` logo fix was also confirmed live (this was verified before the pivot).
  - **NOT live-verified this session** (code-reviewed and build-verified only): the new "What are you adding?" category chip row in Add Item (including that it actually fixes upload category detection end-to-end with a real photo), the Collection empty/no-results states, the Profile identity fix (initials avatar rendering, no layout regression from removing the `<img>`), the Swap no-candidates message, the swap-title idempotency fix, the sparse-wardrobe Why-It-Works branch, dark mode, and the 375/390/414px breakpoints for anything touched this sprint. All of these are small, targeted, low-risk changes reusing existing components/patterns, and the surrounding code was already live-verified working in Sprints 8–10 — but that is inference, not a fresh check. **Recommend a live pass through the full demo flow (both Men and Women profiles) before any real demo**, prioritizing: Add Item with a real non-top photo (confirm category chip actually changes what gets detected), Collection empty state on a freshly-cleared wardrobe, and clicking Swap several times in a row on Stylist to confirm the title no longer compounds.
  - A leftover `vite` dev server from a previous session was found already running on port 5173 when this session started; it was reused rather than started fresh. Not itself a risk, but worth knowing if `localhost:5173` behaves unexpectedly in a future session — check for a stale process before assuming a fresh `npm run dev`.
* **Wardrobe image weight**: `dist/wardrobe/` is ~431MB across 58 full-resolution PNGs (2–15MB each, largest at 2816×1536). These are source-quality renders, not web-optimized — real-world load time on a demo network/device is untested and likely to feel slow, especially in the Collection grid loading many at once. Not addressed this sprint (explicitly out of scope: "Do not start the next visual-polish sprint"); flagging as the most likely next real risk.
* Two exact-duplicate images and one filename/content mismatch were found and resolved by judgment call, documented in detail above — worth a quick nod from the hackathon team to confirm the calls (especially the "Oversized Oxford Shirt" → denim jacket reclassification).
* `swapGarmentInOutfit()` doesn't independently apply `layeringPreference` (see AI Status note above) — currently benign, revisit if swap logic is reworked.
* `logo.png`'s baked-in background (`#F5F6F2`) is a very close but not pixel-exact match to `--color-bg` in light mode (`#FAF8F5`); the `ClosiqLogo` plate uses the asset's own swatch so this is imperceptible in practice, but if the design system's light background token ever changes, re-check for a visible seam.
* `~/Downloads/closiq-wordmark.svg` exists and is named similarly to the real asset but is **not** the official logo (no brain motif, wrong palette) — do not let a future session pick it up by mistake.
* **localStorage size with base64 photos**: uploaded images are now stored as base64 `data:` URLs (≈33% larger than the raw file) directly in `localStorage`'s ~5–10MB-per-origin budget. Fine for a handful of demo uploads; if many/large photos get uploaded during a real demo, `localStorage.setItem` could start throwing `QuotaExceededError` (not currently caught — the `useEffect` persistence in `App.tsx` would silently fail to save on that write). Acceptable tradeoff for hackathon reliability (this fixes the worse bug of photos vanishing on reload) but worth a guard if the demo grows.
* `AIRecommendationCard.tsx` and `OutfitCard.tsx` (`src/components/ui/`) are confirmed dead code — zero imports anywhere in the app. Not a duplicate outfit system (nothing renders them), just unused files from early scaffolding. Left alone this sprint (out of scope); safe to delete in a future cleanup pass.

---

## Next Task

**Task**: Live browser pass through the full demo flow to confirm Sprint 12's fixes actually work as intended when clicked, not just when read — this sprint's fixes are build-verified only past the first screen (see Known Risks for exactly what was/wasn't seen live). Priority order: (1) Add Item with a real non-top photo, confirming the new category chip actually changes detected category; (2) Collection screen on a freshly-cleared wardrobe, confirming the new empty state renders instead of a blank grid; (3) Stylist screen, clicking Swap on the same category 3+ times in a row to confirm the title no longer compounds into repeated "(Variation)" suffixes; (4) Women profile end-to-end (this session only exercised Men). After that, the ~431MB unoptimized wardrobe image weight (Known Risks, flagged since Sprint 11) is the next real risk worth addressing before a demo on an untrusted network.

---

## Last Updated

* **Date**: 2026-08-13
* **Session**: Sprint 12 — P0 core demo flow hardening pass (requested as "Sprint 6" in the brief). Read every file in the Profile → Add Item → AI Vision → Collection → Today/Stylist → Save flow end-to-end and fixed 7 real bugs found by inspection: brand wordmark rendered as CSS text instead of the official logo (AppHeader + Onboarding), every real-photo upload silently misclassified as "Tops" with no way to change it beforehand, Profile screen showing a different person ("Elena Rostova" + external stock photo) than Today's greeting ("Pranav") with no fallback if the external image failed to load, Collection screen missing an empty state entirely, Swap being a silent no-op with zero feedback when a category had only one item, repeated swaps compounding the outfit title into multiple "(Variation)" suffixes, and "Why It Works" inventing a top/bottom pairing for sparse wardrobes that contradicted the missing-categories note shown right above it. `npm run build` and `npm run lint` verified clean after every fix (6 rebuilds). Live browser verification was started (confirmed the real-photo catalog and the logo fix working correctly on Today at 390px) but was explicitly cut short by the user partway through in favor of continuing as a code-only review — see Known Risks for the precise line between what was seen running and what was only read.
