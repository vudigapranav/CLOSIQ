# CLOSIQ — Testing

Last updated: 2026-11-11.

## Commands

| What | Command (repo root unless noted) | Covers |
|---|---|---|
| Shared + mobile unit/integration tests | `npm test` (= `cd mobile && npm test`) | everything in `mobile/tests/*.test.ts` — compiles the shared `src/` services and mobile services with `tsconfig.test.json`, runs `node --test` |
| Server tests | `npm run test:server` | `server/tests/*.test.mjs`: rate limiter, input validation (mime, magic bytes, caps, id regex), AI output id filter, router 400/413/429 |
| Web type check | `npm run typecheck` | `tsc -p tsconfig.json` over `src/` (strict) using the mobile workspace's TypeScript |
| Mobile type check | `cd mobile && npx tsc --noEmit -p tsconfig.json` | app sources (strict) |
| Lint | `npm run lint` | oxlint over the repo |
| Web production build | `npm run build` | Vite build to `dist/` |
| Android JS bundle | `cd mobile && npx expo export --platform android --output-dir /tmp/closiq-export` | proves the RN bundle resolves and compiles (not that the APK runs) |
| Release env gate | `cd mobile && npm run check:release-env` | https API host, no LAN/placeholder host, no service-role key |

Running tests in parallel (several agents/terminals): compile to a private folder so runs don't delete each other's output:
`cd mobile && npx tsc -p tsconfig.test.json --outDir .tb-me && node --test '.tb-me/mobile/tests/**/*.test.js'; rm -rf .tb-me`.

## What the suites cover (2026-11-11)

* **Outfit engine** (`outfitEngine.test.ts`): only owned pieces; occasion ranking; laundry/unavailable never recommended (generate, local pick, swap); cold → outer layer, heat → none; missing weather is excluded, not guessed; rain vs suede shoes; 0–100 scores with notes; disliked combinations never returned; rule-based labelling (`styleScore` 0, `Rule-based · N/100`, no temperature without weather); swap drops stale AI %; layering preference; one-piece and ethnic-bottom rules; AI validator counts invented ids and never defaults a score.
* **Outfit brain**, **AI mapping**, **scan retry**, **Shop Check**, **pairings**, **Style DNA**, **search/filters** (incl. new availability + collection facets), **garment edit validation**, **weather core** (parsing, malformed input, unknown codes, bands, rain, forecast day, cache freshness, coordinate rounding), **wardrobe analytics**, **calendar export (.ics)**, **account service** (RPC missing → nothing deleted; consent storage), **user isolation**, **logout**, **failed writes**, **network/config**, **deployment catalog**.
* **Server**: see table above.

## Critical journey — what is and isn't automated

| Step | Automated? |
|---|---|
| Register / login / logout | logic unit-tested (mobile auth, login repair, logout); no live Supabase test |
| Onboarding | onboarding refresh test (mobile) |
| Upload → analyze garment | scan retry + server validation tests; real Gemini call not in CI |
| Confirm + save garment | failed-writes + garment-edit tests; cloud write fallback logic unit-tested |
| Generate outfit / swap / save / feedback | engine, brain, AI mapping tests |
| Style DNA update | Style DNA + brain tests |
| Shop Check | shopCheck tests |
| Weather failure | weather core (malformed → throws, caller falls back); engine with no weather |
| AI provider failure | AI mapping tests (fallback labelled rule-based); server output filter |
| Invalid image | server validation tests (mime, magic bytes, size) |
| Unauthorized access | RLS in migrations (reviewed, not executed against a DB in tests); router requires a verified JWT |
| Duplicate requests | `recordShownOutfit` upsert; rate limiter tests |

## Not automated (manual / device)

* No browser end-to-end suite (Playwright) and no device/emulator automation in this repo. The project owner has asked that agents verify by code, build, lint, tests and API calls only — no browser-pane or simulator driving.
* Android APK install + launch on a real device: must be done by a person (see `RELEASE_CHECKLIST.md` §9).
* Supabase RLS against a live database: verify with two test accounts after applying migrations (`supabase db reset` locally, or the dashboard SQL editor).

## Manual QA checklist (before a release)

1. Sign up, confirm email, sign in on web and phone with the same account; wardrobe syncs.
2. Add a garment by photo (AI on) and with "Use AI photo analysis" off (manual path, no network call to `/api/ai/analyze-garment`).
3. Edit the garment (name, colour, brand, purchase month, pattern, collections); mark it "In the laundry" → it disappears from Home/Stylist suggestions and swap lists, still visible in Wardrobe with a badge.
4. Set a city on Home → weather card shows; outfits show the real temperature; switch off network → app still generates (rule-based) and says so.
5. Rate a look "I disliked it" → never suggested again; "Wear today" → wear count +1 on each piece.
6. Planner: create a dated event, suggest an outfit, use it, download the .ics and import into a calendar.
7. Profile: insights show real counts; export data; delete account (after the migration is applied) on a throwaway account.
8. Shop Check with a photo of a piece not owned.
