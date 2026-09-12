# CLOSIQ

**An AI stylist for the clothes you already own.**

CLOSIQ is a mobile app that turns a photo of a garment into a structured wardrobe entry, then builds outfits from *your actual clothes* for a given occasion — and explains why each look works.

> **Status: working prototype.** Not production-ready and not deployed. See [Current limitations](#current-limitations) before assuming any flow is production-grade.

---

## The problem

Most people own enough clothes and still stall in front of the wardrobe every morning. The apps that exist for this mostly want to sell you something new — they recommend products from a catalog, not from your closet.

CLOSIQ inverts that. Nothing in it is for sale. It catalogs what you own, understands each garment's colour, fabric, fit and formality, and then answers a single question: *what should I wear for this, from what I already have?*

---

## What works today

Verified by reading the implementation; device-verification status is called out explicitly in [Current limitations](#current-limitations).

**Accounts and onboarding**
- Email/password sign-up and sign-in through Supabase Auth, with session restore on launch and a real sign-out path.
- A demo account button that signs into a fixed, pre-seeded wardrobe rather than creating an account.
- A 9-step onboarding flow: name → wardrobe profile → body type → skin tone → style preference → layering preference → temperature unit → location permission → wardrobe seeding.

**Wardrobe (Collection)**
- Garment gallery with category filters (Tops, Bottoms, Outerwear, Footwear, Accessories) and a per-garment detail sheet.
- Add a garment from the camera or photo library (`expo-image-picker`), with client-side image compression before upload (`expo-image-manipulator`).
- Gemini vision analysis of the photo extracting name, category, colour + hex, fabric, fit, formality, layering role, style and pairing notes. When the analysis genuinely fails, it reports the failure and offers manual entry instead of inventing attributes.
- Two wardrobe profiles (men / women), each with its own catalog and its own cloud partition.

**AI Stylist**
- Free-text prompt plus occasion chips and prompt suggestions.
- Outfit generation from the user's own garment IDs, returning a title, vibe, style score and a "why it works" rationale (summary, colour harmony, occasion fit).
- Single-garment swap — replace one piece in a generated look without regenerating the whole outfit.
- Save a generated look to Saved Outfits.

**Home (Today)**
- Time-of-day greeting driven by the device clock.
- Weather-aware daily recommendation using Open-Meteo (no API key required) plus OS reverse geocoding, with a cached last-known reading for offline/denied-permission cases.
- Occasion shortcuts, recently added garments, style match score.

**Planner**
- Dated events with free-text occasion labels, times, and an outfit assigned from saved looks.
- Planner context feeds back into outfit personalization.

**Profile**
- Style DNA / archetype view, closet colour breakdown, saved looks, wardrobe profile and layering preference controls.

**Data and sync**
- Supabase Postgres as the source of truth, row-level-security scoped per user, across `garments`, `saved_outfits`, `planner_events`, `outfit_history`, `user_preferences` and `profiles`.
- Supabase Storage bucket for user-uploaded garment images, served via signed URLs.
- AsyncStorage as a per-user offline read cache, refreshed on every successful cloud read/write and never treated as authoritative once a cloud call succeeds.
- Pending-write tracking so a failed cloud write is surfaced to the user rather than silently dropped.

**Graceful degradation**
- Every AI call is server-proxied. If the backend is unreachable, unauthenticated, or has no Gemini key configured, the app falls back to a local deterministic styling engine and *tells the user* that is what happened — the result is labeled, not passed off as AI output.

---

## Technology stack

**Mobile app** (`mobile/`) — the primary surface
- Expo SDK 57, React Native 0.86.3, React 19.2.3, TypeScript 6
- `react-native-safe-area-context`, `react-native-svg`, `lucide-react-native`
- `expo-image-picker`, `expo-image-manipulator`, `expo-location`, `expo-splash-screen`, `@react-native-community/datetimepicker`
- `@react-native-async-storage/async-storage` for the offline cache
- `@supabase/supabase-js` for auth and data
- Tests with Node's built-in test runner over a `tsc` build (`npm test` in `mobile/`)

**Backend** (`server/`)
- Plain Node `node:http` — no framework — serving the built frontend and three AI endpoints
- `POST /api/ai/analyze-garment`, `POST /api/ai/generate-outfit`, `POST /api/ai/swap-garment`, plus `/healthz`
- Supabase bearer-token verification on every AI request; requests without a valid token are rejected
- Node >= 22.13

**AI**
- Google Gemini via `@google/genai`, model `gemini-flash-latest`
- Called **server-side only**. The API key is never read by, sent to, or bundled into the mobile client.

**Data / auth**
- Supabase — Postgres with RLS, Auth, and Storage

**Web companion** (`src/`, Vite 8 + React 19)
- The original browser prototype and the static host for the seed garment assets under `public/wardrobe/`. It is an earlier surface and is **not** at feature parity with the mobile app.

---

## Screenshots

Screenshots live in [`docs/showcase/screenshots/`](docs/showcase/screenshots/).

That folder is currently empty — no genuine app captures exist in this repository yet, and none have been fabricated. To produce them, follow [`docs/showcase/screenshots/CAPTURE_CHECKLIST.md`](docs/showcase/screenshots/CAPTURE_CHECKLIST.md), which lists the exact taps and framing for each screen.

Once the captures are saved with the filenames given in that checklist, replace this paragraph with the image block below (it is commented out so the README never renders a broken image):

<!--
| Wardrobe | Occasion | Generated outfit |
| --- | --- | --- |
| ![Wardrobe](docs/showcase/screenshots/01-wardrobe.png) | ![Occasion selection](docs/showcase/screenshots/02-occasion.png) | ![Generated outfit](docs/showcase/screenshots/03-outfit.png) |

| Saved outfits | Planner |
| --- | --- |
| ![Saved outfits](docs/showcase/screenshots/04-saved-outfits.png) | ![Planner](docs/showcase/screenshots/05-planner.png) |
-->

---

## Local setup

Two pieces run together: the backend (repo root) and the Expo app (`mobile/`). The mobile app talks to the backend over your LAN; it never talks to Gemini directly.

### 1. Backend

```bash
npm install
cp .env.example .env      # then fill in your own values
npm run build
npm run start             # http://localhost:3000
```

Root `.env` variables (names only — see `.env.example` for the full notes):

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Server-side Gemini key. Without it, AI endpoints report "not configured" and the app uses its local engine. |
| `SUPABASE_URL` | Supabase project URL, used to verify the mobile client's bearer token. |
| `SUPABASE_ANON_KEY` | Supabase anon/public key (RLS-protected). No service-role key is used anywhere in this project. |
| `PORT` | Optional. Defaults to `3000`. |

```
GEMINI_API_KEY=your_gemini_api_key_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 2. Mobile app

```bash
cd mobile
npm install
cp .env.example .env.local   # then fill in your own values
npx expo start
```

`mobile/.env.local` variables:

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Where the backend lives. **Physical device:** your computer's LAN IP (`ipconfig getifaddr en0` on macOS), e.g. `http://YOUR_LAN_IP:3000`. **iOS Simulator:** `http://localhost:3000`. |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key. |

```
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:3000
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

`GEMINI_API_KEY` must **never** appear in `mobile/.env.local` or any `EXPO_PUBLIC_*` variable — Expo inlines those into the client bundle.

### 3. Supabase

You need a Supabase project with Auth enabled, the tables listed under [Data and sync](#what-works-today), RLS policies scoping every row to `user_id = auth.uid()`, and a storage bucket for garment images (`supabase/sql/001_garment_images_bucket.sql`).

### Other commands

```bash
npm run dev                 # root: Vite dev server, AI endpoints via middleware
cd mobile && npm test       # mobile test suite
cd mobile && npm run diagnose   # checks DNS, Supabase health, backend reachability (prints no secrets)
```

---

## Demo walkthrough

The intended 45–60 second demo path is:

**Wardrobe → choose occasion → generated outfit → save outfit → planner**

A full timed shot list, narration and recording instructions live in [`docs/showcase/DEMO_WALKTHROUGH.md`](docs/showcase/DEMO_WALKTHROUGH.md). No recording has been made yet.

---

## Current limitations

Development status, stated plainly:

- **Prototype, not production.** No public backend is deployed. The production API URL falls back to an intentionally unreachable placeholder, which means a standalone build without a configured backend runs entirely on the local styling engine.
- **Device verification is narrow.** Signing in with the demo account and reaching the wardrobe has been confirmed on a physical iPhone. Every other flow on a physical device — adding a garment, generating an outfit, saving, planning — has **not** been device-verified and is not claimed to be. Android has not been tested at all; tablets are explicitly unsupported (`supportsTablet: false`).
- **Gemini runs on a free tier.** Quota limits are a real constraint on live demos. Outfit generation and garment analysis degrade to the local deterministic engine when the quota is exhausted, the backend is down, or no key is configured.
- **The backend must be reachable from the phone.** Dev setup requires the phone and the computer on the same Wi-Fi, with the LAN IP set in `mobile/.env.local`.
- **No end-to-end device test automation.** The test suite covers services and logic, not the UI on a real device.
- **The web app (`src/`) is an earlier surface**, kept for the browser prototype and for serving seed garment assets. It does not match the mobile app feature for feature.
- **No license file at the repository root.** `mobile/LICENSE` is Expo's template license, not a license for this project.
- **`STATE.md` is a large internal engineering log** (400KB+) kept for development context, not documentation. It contains development LAN IP addresses. Review it before making this repository public.

---

## Repository layout

```
.
├── mobile/              Expo / React Native app (primary surface)
│   ├── App.tsx          Navigation, session, shared wardrobe + saved-outfit state
│   └── src/
│       ├── screens/     Today, Collection, Stylist, Planner, Profile, Onboarding, Login
│       ├── components/  Modals, garment cards, bottom navigation
│       └── services/    Supabase, storage, Gemini calls, weather, personalization
├── server/              Node http backend + Gemini proxy + auth verification
├── src/                 Vite/React web companion
├── public/wardrobe/     Seed garment assets
├── supabase/sql/        Storage bucket setup
└── docs/showcase/       Screenshots, demo walkthrough, LinkedIn post
```

`CLAUDE.md` holds product and design-system context; `STATE.md` is the running implementation log.
