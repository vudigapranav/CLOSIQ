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

The application features 4 core bottom navigation tabs:

1. **Today (`"What should I wear?"`)**: Primary home experience showing daily AI outfit recommendations tailored to weather and schedule, with visual clothing cards, style match score, *"Why it works"* rationale, and action controls (View, Swap, Save).
2. **Collection (`"What do I own?"`)**: Digital wardrobe gallery showing all cataloged user garments, category chips filter, search bar, and item detail drawer.
3. **Stylist (`"Help me create an outfit"`)**: Interactive AI stylist studio featuring natural-language prompt input, occasion suggestion chips, weather & vibe sliders, and real-time outfit generation with single-piece swapper.
4. **Profile (`"What does CLOSIQ know about my style?"`)**: Wardrobe profile configuration (Men/Women), Style DNA archetype, closet color breakdown, versatility metrics, layering preferences, saved looks, and appearance theme switcher.

---

## 4. Visual Design System

**Design language**: *Sage × Cream Editorial Fashion System* (redesigned 2026-08-14 from the earlier all-ivory emerald system). The app "environment" (page canvas — `html`/`body`, `.app-shell`, header, bottom nav backdrop) is a muted warm sage; cream/ivory `--color-surface` remains the dominant *content* surface — cards, modals, inputs "float" on the sage canvas. Green is reserved for typography, buttons, active/selected states, and brand accents, never as a full-bleed background.

### Theme Colors

#### Light Mode:
* **Environment (page canvas)**: Muted Warm Sage `#C7CDAE` / deep sage accent `#B7BF9A` (`var(--color-bg)` / `var(--color-bg-deep)`)
* **Primary (Deep Forest Green)**: `#1F3A2B` (`var(--color-primary)`)
* **Primary Hover / Light**: `#16301F` / `#2E5039`
* **Surface (cream cards)**: Warm Ivory `#FBF8F0` (`var(--color-surface)`)
* **Surface Subtle (nested cream)**: `#F1EAD8` (`var(--color-surface-subtle)`)
* **Surface Elevated**: Pure White `#FFFFFF` (`var(--color-surface-elevated)`)
* **Primary Text**: Deep Charcoal-Green `#1E2B20` (`var(--color-text-primary)`)
* **Secondary Text**: Muted Sage-Gray `#5B6350` (`var(--color-text-secondary)`)
* **Border**: `rgba(31, 58, 43, 0.12)` (`var(--color-border)`)
* **Success**: `#3C7A55`

#### Dark Mode (`[data-theme="dark"]`):
* **Environment (page canvas)**: Deep Forest-Black `#0D1712` / `#0A120E` (`var(--color-bg)` / `var(--color-bg-deep)`)
* **Primary**: Soft Sage-Green `#5AA37E` / hover `#6DB690`
* **Surface**: `#17221C` / Subtle `#1F2C24` / Elevated `#26342B`
* **Text**: Warm Off-White `#F5F1E4`
* **Secondary Text**: Muted Green-Gray `#9CA893`
* **Border**: `rgba(245, 241, 228, 0.09)`

### Typography
* **Serif Headings**: *Playfair Display* (`var(--font-display)`), used for display, screen, and section headings.
* **Geometric Sans**: *Plus Jakarta Sans* (`var(--font-family)`), used for body text, captions, button labels, and metadata.

### Surface Characteristics
* **Border Radius**: Cards `14px` (`--radius-md`) / `20px` (`--radius-lg`), bottom-sheet modals & the floating nav dock `26px` (`--radius-xl`), Pills `9999px` (`--radius-pill`).
* **Viewport Constraint**: Mobile-style application shell (`max-width: 480px`) centered on desktop with subtle borders and shadows.
* **Bottom Navigation**: Floating cream pill dock (`--radius-xl`, `--shadow-lg`, `16px` inset from screen edges) rather than a full-bleed bar — see `BottomNavigation.tsx`.
* **Segmented Controls**: Shared `SegmentedControl` component (`src/components/ui/SegmentedControl.tsx`) — single cream track, filled forest-green active pill — used for Wardrobe Profile and Layering Preference in `ProfileScreen`.
* **Aesthetic Direction**: *Luxury fashion editorial × intelligent personal assistant × modern Apple-like simplicity*.
* **Constraint**: NO ecommerce UI patterns (no prices, cart icons, or star ratings). No dashed borders (reads as wireframe/placeholder, not premium) — empty/dropzone states use a solid border + soft shadow instead.

---

## 5. Brand Identity & Launch Experience

* **Official Wordmark**: `CLOSIQ`, with the brain/neural symbol integrated inside the final **Q** (the Q's counter is replaced by a brain icon; its tail remains a plain diagonal stroke).
* **Official Asset Location**: `public/brand/closiq-logo.png`. This is the *only* CLOSIQ logo asset in the project.
* **Rule — Do Not Recreate or Substitute**: Never redraw the wordmark in text/CSS, never use a generic brain icon, never redesign the Q, and never fabricate a placeholder logo. If this asset is ever missing, stop and ask — do not invent a replacement.
* **Asset Notes**: The PNG has an opaque baked-in warm-ivory background (`#F5F6F2`, not transparent). `ClosiqLogo` (`src/components/ui/ClosiqLogo.tsx`) wraps it in a plate matching that exact swatch so it reads cleanly with zero seam in both light and dark mode without altering the artwork.
* **Launch Splash Requirement**: Every application launch and every browser/app reload shows the CLOSIQ splash (`src/components/ui/SplashScreen.tsx`) — logo fade/scale in → brief hold → fade out into the app. Target duration ~1–2 seconds total. Premium, minimal, calm — no particles, no neon, no spinning logo, no long delays. Must respect `prefers-reduced-motion` (simple/immediate fade instead). Splash must NOT reappear on in-app tab navigation (Today ↔ Collection ↔ Stylist ↔ Profile) — it is gated on `<App>` mounting, not on route/tab changes.

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
* **Services**:
  * [src/services/aiStylist.ts](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/services/aiStylist.ts)
  * [src/services/aiVisionScanner.ts](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/services/aiVisionScanner.ts)
* **Data & Types**:
  * [src/types/wardrobe.ts](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/types/wardrobe.ts)
  * [src/data/garmentCatalog.ts](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/data/garmentCatalog.ts)
  * [src/data/initialWardrobe.ts](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/data/initialWardrobe.ts)
* **Styling**:
  * [src/index.css](file:///Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/src/index.css)

---

## 12. Coding Rules

1. **Inspect First**: Always inspect existing code before modifying.
2. **Extend Existing Components**: Prefer extending established UI components rather than creating parallel implementations.
3. **No Parallel Implementations**: Never build a second copy of an existing screen or service.
4. **Keep Architecture Simple**: Optimize for 24-hour hackathon execution and high reliability.
5. **Mobile Responsiveness P0**: Ensure all views render cleanly inside the mobile viewport shell.
6. **Verify Before Declaring Completion**: Always run `npm run build` and test the live application.

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
