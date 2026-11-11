# CLOSIQ — Architecture

Last updated: 2026-11-11. This describes the code as it is, verified against the source. Product rules live in `CLAUDE.md`; live status lives in `STATE.md`.

## 1. System overview

```
 ┌──────────────────────┐        ┌──────────────────────┐
 │ Web app (src/)       │        │ Mobile app (mobile/) │
 │ React 19 + Vite 8    │        │ Expo SDK 57 / RN 0.86│
 └─────────┬────────────┘        └──────────┬───────────┘
           │   both import the SHARED code in src/types, src/data, src/services
           │   (mobile via metro.config.js watchFolders = repo root)
           │
           ├──────────── Supabase (Auth, Postgres + RLS, Storage) ── direct from clients, anon key + user JWT
           ├──────────── Open-Meteo (weather + geocoding) ────────── direct from clients, no key
           └──────────── CLOSIQ API  /api/ai/*  ───────────────────── Vercel functions (api/) or plain Node (server/index.js)
                              │  server/apiRouter.js: auth → rate limit → body cap → route
                              ├─ server/geminiServer.js  (garment scan, outfit, swap — Gemini, key server-side only)
                              └─ server/studioPhoto.js   (U²-Net cut-out, onnxruntime + sharp, no AI provider)
```

* Hosting: Vercel (`vercel.json`, `api/ai/[route].js`, `api/healthz.js`, `api/keepalive.js` daily cron). `server/index.js` serves `dist/` + the same router for plain-Node hosting.
* Secrets: `GEMINI_API_KEY` is read only on the server. Clients only ever hold the public Supabase URL + anon key; `vite.config.js` refuses to build with a `service_role` JWT or an `sb_secret_` key.

## 2. Shared code (one implementation, two apps)

| Area | Module | Notes |
|---|---|---|
| Types | `src/types/wardrobe.ts` | `GarmentItem` (incl. `availability`, `purchaseDate`, `pattern`, `collections`), `Outfit` (incl. `source`, `ruleScore`, `scoreBreakdown`), `matchLabel()` |
| Garment traits | `src/services/intelligence/garmentTraits.ts` | formality order/gap, occasion → target formality, colour harmony (HSL), neutrals, ethnic / one-piece detection |
| Outfit engine | `src/services/intelligence/outfitEngine.ts` | explainable scoring + candidate generation + swaps (see §4) |
| Outfit brain | `src/services/outfitBrain.ts` | per-combination feedback memory (dislike / okay / nice / worn / recently shown) |
| Rule-based stylist API | `src/services/aiStylist.ts` | stable exports (`generateAIOutfit`, `getSwapCandidates`, `applySwapCandidate`, …) delegating to the engine |
| Weather | `src/services/weather/weatherCore.ts` | Open-Meteo URL building + validated parsing, bands, rain, advice, cache freshness |
| Analytics | `src/services/intelligence/wardrobeAnalytics.ts` | most/least worn, pairs, distributions, utilisation — from persisted data only |
| Shop Check | `src/services/shopCheck.ts` | candidate piece vs. owned wardrobe |
| Pairings | `src/services/pairingSuggestions.ts` | "Pairs well with" in item details |
| Search / filters | `src/services/wardrobeSearch.ts`, `wardrobeFilters.ts` | on-device |
| Garment edits | `src/services/garmentEdit.ts` | validation/normalisation of a `GarmentDetailsPatch` |
| Calendar | `src/services/calendarExport.ts` | RFC 5545 `.ics` for planner events |
| Style DNA | `src/data/styleDna.ts` | share of the user's own wardrobe + liked/worn looks |

Platform-specific code stays thin: web `src/services/cloud/*`, `src/services/ai/*`, `src/services/weather/webWeather.ts`; mobile `mobile/src/services/*`.

## 3. Data model (Supabase)

Migrations: `supabase/migrations/` (timestamped, replayable). Tables, all with RLS enabled and owner-only policies scoped to `authenticated`:

* `profiles` (1:1 auth user) — name, style_preferences[], temperature unit, onboarding flags, `ai_photo_consent`, `weather_city` (the last two are in `20261111120000_wardrobe_intelligence.sql`).
* `user_preferences` — wardrobe profile (men/women), layering preference.
* `garments` — one row per piece; `garment_id` is the stable client id; image in Storage bucket `garment-images/<uid>/…` (private, 5 MB, mime allowlist, folder = `auth.uid()`).
* `saved_outfits` — looks with `status` (`try_later` / `worn`), items as jsonb.
* `planner_events` — dated events with an optional outfit (shared by web and mobile).
* `outfit_history` — recently shown combinations (signature).
* `outfit_feedback` — per-combination rating.
* RPCs: `record_garments_worn(ids, date)` (atomic wear counter, SECURITY INVOKER), `delete_my_account()` (SECURITY DEFINER, `auth.uid()` only).

**Rollout rule:** the 2026-11-11 migrations are additive and NOT yet applied to production. Every client read/write of the new columns or RPCs degrades gracefully (`src/services/cloud/schemaErrors.ts`, mobile `wardrobeStorage.ts`): an unknown column is retried without the new fields, a missing RPC falls back to the old per-row update, and account deletion reports "not enabled" without deleting anything.

## 4. Intelligence layer (hybrid)

```
photo ─► validation (client size/type; server mime allowlist + magic bytes + pixel cap)
      ─► vision inference (Gemini, structured responseSchema; never guesses brand/material)
      ─► structured metadata ─► user confirms/corrects ─► Supabase
                                                         │
wardrobe (AVAILABLE pieces only) + occasion + weather + style prefs + brain
      ─► AI path:   server prompt + responseSchema → server-side id filter → client validator
                    (any invented / excluded id, duplicate category or dress+bottom → rejected)
                    → scored by the engine too (ruleScore + breakdown)
      ─► Rule path: outfitEngine.rankOutfits → buildEngineOutfit (source 'local', styleScore 0)
```

### Outfit engine factors (`outfitEngine.ts`)

| Factor | Base weight | Data used | When weight = 0 |
|---|---|---|---|
| formality (occasion fit) | 3 | target formality from the prompt, internal spread | never |
| color | 2.5 | pairwise `colorHarmony` (neutrals, light/dark contrast, hue distance) | — (halved with one visible piece) |
| weather | 2 | band (feels-like), outer layer, warm/light fabrics, rain vs. suede/canvas shoes | no real weather |
| season | 1 | garment season tags vs. calendar season | no tags |
| style | 1.5 | onboarding style preferences | none set |
| feedback | 1.5 | brain: liked pieces, okay/recent combos (disliked = hard block) | no feedback yet |
| rotation | 1 | worn in last 2 days, never-worn pieces | — |
| completeness | 2 | body (top+bottom or one-piece) + shoes | never |

`ruleScore = round(100 × Σ(score×weight) / Σ(weight))` over factors with data. Every factor carries a one-line `note` generated from the actual pieces; "Why it works" is assembled from the strongest notes. Hard constraints: availability, exclusions, disliked combinations, layering preference (no base layer alone when "avoid"), ethnic-only bottoms (churidar/salwar/dhoti) only under ethnic tops, one-pieces never get a bottom.

Candidate generation: top-K per slot by a cheap per-piece prior (formality gap, weather fit, liked pieces, style match), cartesian product (≤ ~6×6×4×3), score all, de-duplicate by combination signature, then pick alternatives with different lead pieces.

### Honesty rules (enforced in code)

* `styleScore` is the AI's own match % and is shown ("AI · 92% Match") only for AI outfits; it is 0 for rule-based picks and is dropped after any swap.
* Rule-based picks show "Rule-based · N/100" (`matchLabel`).
* `temperature` is set only from real weather; no default degrees anywhere.
* Weather unavailable → the weather factor is excluded, the explanation says "No weather data".

### Provider coupling

Clients call `/api/ai/*` only and never see the key or SDK. `server/geminiServer.js` holds prompts, schemas and the model fallback chain (`GEMINI_MODELS`, 36 s budget, 20 s per attempt, next model on 404/429/5xx/timeout). Swapping provider = replacing that module; the router, validation, rate limit and every client stay the same. The response field `mode: 'gemini' | 'demo'` is the one provider name that leaks into client types.

## 5. API surface

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/ai/analyze-garment` | Supabase JWT | photo → structured garment metadata |
| `POST /api/ai/generate-outfit` | JWT | outfit from the supplied (available) wardrobe |
| `POST /api/ai/swap-garment` | JWT | one replacement piece |
| `POST /api/ai/studio-photo` | JWT | white-background cut-out (no AI provider) |
| `GET /healthz`, `/api/healthz` | none | booleans only |
| `GET /api/keepalive` | `CRON_SECRET` if set | keeps the free Supabase project awake |

Router order: method check → `getAuthenticatedUserId` (45 s token cache, failures never cached) → per-user token bucket (`server/rateLimit.js`, best-effort per warm instance) → 6 MB body cap → `server/validation.js` (prompt ≤ 500, wardrobe ≤ 300 items, id regex, category enum, image mime + magic bytes) → handler. Errors return fixed strings + `errorKind`; provider messages are logged server-side only.

## 6. Web app structure

`src/App.tsx`: splash → login (`LoginScreen`, incl. password reset + PASSWORD_RECOVERY handling) → `SignedInApp` keyed by user id. Tabs: Home (`TodayScreen`, with `WeatherCard`), Wardrobe (`CollectionScreen`), Shop Check (modal), Planner (`PlannerScreen`: dated events + weekly plan), Profile (`ProfileScreen`: Style DNA, insights, saved looks, preferences, privacy & account). The Stylist is opened from Home. Weather state is held once in `App.tsx` (`useWebWeather`).

## 7. Mobile app structure

`mobile/App.tsx` mirrors the web flow with native screens in `mobile/src/screens`, AsyncStorage caches + Supabase sync in `mobile/src/services/*`, expo-location weather, expo-image-picker camera/gallery, EAS builds + OTA updates (`runtimeVersion` policy `appVersion`, top-level).

## 8. Known architectural debt

See `docs/KNOWN_ISSUES.md`. Main items: two large screen files per platform (Today/Stylist/Profile 700–800 lines), the web bundle is a single 600+ kB chunk, mobile keeps its own `MobileOutfitResult` shape instead of `Outfit`, and rate limiting is per-instance rather than global.
