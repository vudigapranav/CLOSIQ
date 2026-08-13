# STATE.md — CLOSIQ Living Implementation State

This document tracks the live implementation status of **CLOSIQ**. It is updated at the end of every active development turn/session.

---

## Current Phase

* **Phase**: Multi-Session Hackathon Refinement & Wardrobe Profile Context Integration
* **Status**: Sprints 1 through 8 complete. Men/Women wardrobe profiles, layering roles/preference, profile-scoped catalog with explicit `style`/`imagePath` schema, the official CLOSIQ brand launch splash, and graceful missing-asset handling are all wired end-to-end and spot-verified in browser.

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

---

## Current Sprint

* **Active Sprint**: None — Sprint 8 complete. Awaiting next priority (see Next Task).

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

---

## Wardrobe Asset Status

* **Men Assets Structure**: `public/wardrobe/men/` created (`tops`, `bottoms`, `outerwear`, `footwear`, `accessories`) — 10 catalog items wired.
* **Women Assets Structure**: `public/wardrobe/women/` created (`tops`, `bottoms`, `outerwear`, `footwear`, `accessories`) — 10 catalog items wired.
* **Current Status**: Catalog structure complete; only `.gitkeep` placeholders in asset folders (no PNGs yet). Verified in browser: `GarmentImage` gracefully renders an on-brand icon + category label swatch instead of a broken image, so this is safe to demo before art lands. No stale flat (`/wardrobe/<category>/`) paths remain — only a stale doc comment in `GarmentImage.tsx` was found and fixed.
* **Catalog Schema**: Every `GARMENT_CATALOG` entry now exposes `id`, `profile`, `category`, `subcategory`, `name`, `color`, `hexColor`, `fabric`, `fit`, `style`, `seasons`, `formality`, `layeringRole?`, `tags`, `pairingNotes`, and `imagePath`. The AI and every screen consume `GarmentItem.imageUrl` (set from `entry.imagePath` at seed time) and `GarmentItem.id` — no code path ever guesses a filename.

---

## AI Status

* **Outfit Generator**: Working. Selects items strictly from active user wardrobe. `applyLayeringPreference()` correctly excludes `base_layer` tops when preference is `avoid`, unless the prompt explicitly asks for layering or the outfit already has an outer layer (verified: tank top only surfaces via generation/swap when a jacket/coat is present — by design).
* **Vision Scanner**: Working simulated AI analysis stage (`"Understanding your garment..."`).
* **Occasion Handling**: Working with presets (*College, Work, Date Night, etc.*) and free-form prompts.
* **Swap Behavior**: Working single-piece replacement logic. Note: `swapGarmentInOutfit()` cycles candidates by category only and does not re-check `layeringPreference` itself — acceptable today because it only surfaces a base layer when an outer layer is already in the outfit, but worth a closer look if swap logic changes.
* **Save Behavior**: Working saved looks state.

---

## UI Status

* **Light Mode**: Verified `#FAF8F5` warm ivory and `#0D3B2E` deep emerald palette.
* **Dark Mode**: Verified `#0B100E` green-black and `#38997E` emerald palette, toggled live via Profile screen.
* **Mobile Responsiveness**: Verified at 375×812 viewport — no overflow/clipping in Collection grid or nav.
* **Wardrobe Asset Resolution (Sprint 8)**: Spot-checked in browser — Men Collection shows all 10 catalog items (tank top correctly under Tops, 2 items per category), Today's AI outfit resolves real catalog `imageUrl`s for both Men and Women, all via `GarmentImage`'s graceful placeholder (no PNGs exist yet, no broken icons, no unrelated stock imagery). Full click-through re-verification was cut short mid-session at the user's request ("don't test anything") — the above was captured before that point; nothing since has touched this code path.
* **Launch Splash**: Verified — fades/scales in, holds, fades out to reveal the app already rendered underneath, in both light and dark mode, at mobile (375px) and desktop widths. Does not re-trigger on Today↔Collection↔Stylist tab navigation (confirmed by click-through). `prefers-reduced-motion` path verified by code/CSS review (the Browser pane tool has no way to emulate that media feature directly).
* **Known Visual Problems**: None.

---

## Known Risks

* PNG asset files still need to be dropped into `public/wardrobe/<profile>/<category>/` — placeholder icons are a safe demo fallback but not the final visual polish.
* `swapGarmentInOutfit()` doesn't independently apply `layeringPreference` (see AI Status note above) — currently benign, revisit if swap logic is reworked.
* `logo.png`'s baked-in background (`#F5F6F2`) is a very close but not pixel-exact match to `--color-bg` in light mode (`#FAF8F5`); the `ClosiqLogo` plate uses the asset's own swatch so this is imperceptible in practice, but if the design system's light background token ever changes, re-check for a visible seam.
* `~/Downloads/closiq-wordmark.svg` exists and is named similarly to the real asset but is **not** the official logo (no brain motif, wrong palette) — do not let a future session pick it up by mistake.

---

## Next Task

**Task**: Populate `public/wardrobe/men/` and `public/wardrobe/women/` with real generated/photographed PNG garment assets per `public/wardrobe/README.md` (stable IDs, `style`, and `imagePath` already wired end-to-end — dropping in `<id>.png` files is the only remaining step, zero code changes needed).

---

## Last Updated

* **Date**: 2026-08-13
* **Session**: Sprint 8 — completed the wardrobe catalog data layer (`style` + materialized `imagePath` fields) and reconfirmed image resolution for Collection and AI Stylist across both profiles. Browser verification pass was stopped mid-way at user's request; no further changes made after that point.
