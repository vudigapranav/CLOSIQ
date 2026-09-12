# CLOSIQ — Deployment Runbook (prepared 2026-09-11; NOT yet executed)

Scope: the existing Node backend (`server/`), the existing Supabase project (`wibinjtekmadwtbxygrd`, "Closiq"), and the existing EAS configuration (`mobile/eas.json`), on **Expo SDK 57**. Nothing here has been deployed, built on EAS, or submitted. **No public store release is part of this runbook.** Every phase ends at a gate; don't start the next phase until its gate passes.

Companion docs: `RELEASE_CHECKLIST.md` (store blockers), `STATE.md` → "DEPLOYMENT PREPARATION" (evidence behind each claim below).

---

## 0. Where things stand (re-verified 2026-09-11 from the current files)

| Area | Status | Evidence |
|---|---|---|
| M19/M20 code fixes | Present in current source | spot-checked by symbol in every affected file |
| Mobile regression tests | 63/63 pass | `cd mobile && npm test` |
| Mobile TypeScript, web build, lint | Pass, 0 lint findings | `npx tsc --noEmit`, `npm run build`, `npm run lint` |
| iOS / Android JS export | Pass (2581 / 2587 modules) | `npx expo export` |
| Expo SDK | **57.0.22, RN 0.86.3, React 19.2.3** (upgraded 2026-09-12); "Dependencies are up to date" | `npx expo install --check`, `npx expo-doctor` 20/21 |
| Supabase project | **INACTIVE (paused)** | Supabase `list_projects` |
| EAS project link | **Not linked** (no `owner` / `extra.eas.projectId` in `app.json`) | `eas config` → "EAS project not configured" |
| EAS CLI login | Logged in as `vudigapranav` (accounts: `vudigapranav`, `vudigapranavs-team`) | `eas whoami` |
| Signing material in repo | None tracked (correct) | `git ls-files` |
| Backend hosting provider | **Not selected** (free options compared 2026-09-11; awaiting choice) | no provider config in repo; M9 only mentioned Render as an example |
| Git | **42 changed/new paths uncommitted** (all M19–deployment work); remote `github.com/vudigapranav/CLOSIQ` | `git status` |
| Device QA (M19/M20) | **Never observed** | — |

### Unresolved release blockers (from `RELEASE_CHECKLIST.md`, all still present in current code)
- B1 — no in-app account deletion (Apple 5.1.1(v); Google: in-app **and** a web link).
- B2 — no privacy policy (store listing + in-app link).
- B3 — no explicit consent before sending photos/wardrobe data to Google Gemini (Apple 5.1.2(i), which now names "third-party AI").
- B4 — no store-compliant icon (`app.json` icon is the 984×274 transparent wordmark; `assets/icon.png` and `assets/android-icon-foreground.png` are unmodified Expo template placeholders).
- B5 — no deployed HTTPS backend (this runbook addresses it).
- B6 — Supabase project paused.
- B7 — shared public demo account (`demo@login`/`demo@123`, hard-coded) turns uploads into cross-user content (Apple 1.2).

**B1–B4 and B7 block store submission (Phase 8)**, not the internal phases. B5/B6 block everything from Phase 2 on.

### SDK 57 store compatibility — no incompatibility found
- Google Play: new apps and updates must target **API 36** since 2026-08-31 → SDK 57/RN 0.86.3 targets 36 (`react-native/gradle/libs.versions.toml`). ✅
- App Store Connect: uploads must be built with **Xcode 26 / iOS 26 SDK** since 2026-04-28 → SDK 57 itself requires **Xcode 26.4+**, and EAS's `auto` image for SDK 57 satisfies it. ✅ *Confirm the Xcode version in the first iOS build log.*
- SDK 57 requires **Node ≥ 22.13** (declared in `mobile/package.json` engines) and **iOS 16.4+**; New Architecture is mandatory from SDK 55 on.
- 16 KB memory pages: RN ≥0.77 compliant; per-library compliance to be confirmed in the Play pre-launch report. *(VERIFY on first AAB)*

---

## 1. Decisions required before anything is executed

1. **Backend hosting provider and plan.** It must be always-on: a sleeping free tier cold-starts slower than the app's 40 s API timeout, so the first request after idle fails. Needed from it: managed TLS, Node ≥ 22.9, env vars, a health-check path, GitHub deploys, and one-click rollback to a previous deploy.
2. **API origin — DECIDED 2026-09-11: provider subdomain** (e.g. `*.run.app` / `*.onrender.com`). Consequence to keep in mind: `EXPO_PUBLIC_API_URL` is compiled into every binary, so moving to another host later means every installed build must update. Keep the service **name** stable so its subdomain never changes.
3. **EAS owner — DECIDED 2026-09-11: personal account `vudigapranav`.** `eas init` will create the project under it.
4. **Supabase**: restore the project; choose a non-pausing plan (and backups); choose a custom SMTP provider; choose the HTTPS page for the Auth **Site URL** (email-confirmation landing).
5. **Store accounts**: Apple Developer Program enrolment (individual or organization) and a Google Play developer account. A *personal* Play account must run a closed test with ≥12 testers for 14 days before production access.
6. **Identifiers**: confirm you own/want `com.closiq.app` for both platforms. It's permanent after the first store upload.
7. **Web app**: `server/index.js` also serves the web SPA, but the web client sends no Supabase token, so every web AI call gets a 401 and falls back to its local engine (true since M17). Decide whether the web app is part of this deployment.
8. **Committing**: the host deploys from GitHub and EAS uploads the working tree. Review and commit/push the 42 pending paths first. (Not committed by this preparation.)

---

## 2. Backend build / start configuration (provider-independent)

| Setting | Value | Why |
|---|---|---|
| Source | GitHub `vudigapranav/CLOSIQ`, branch `main`, **repo root** | `server/` and the web build live at the root |
| Node | **22.13+ or 24** | the backend start script needs ≥22.9 (`--env-file-if-exists`); the mobile SDK 57 tooling needs ≥22.13 |
| Build command | `npm ci --include=dev && npm run build` | Vite and its React plugin are devDependencies; hosts that set `NODE_ENV=production` at install time would otherwise skip them and fail the build |
| Start command | `npm run start` (= `node --env-file-if-exists=.env server/index.js`) | no `.env` on the host; env vars come from the provider |
| Port | provider-injected `PORT` (server defaults to 3000) | `server/index.js` reads `process.env.PORT` |
| Health check | `GET /healthz` → 200 JSON | added in deployment prep: config presence only, no secrets, no Gemini/Supabase call |
| Instances | 1 is enough to start; the server is stateless | no sessions or disk state |
| Shutdown | handles `SIGTERM`: drains in-flight requests for up to 35 s | added in deployment prep; set the provider's shutdown grace to ≥ 40 s if configurable |

Verified locally on 2026-09-11 (LIVE VERIFIED, this machine only):
- A clean checkout (tracked + new files, no `node_modules`) ran `npm ci --include=dev` (76 packages) and `npm run build`, then started with `NODE_ENV=production` → `verify-deployment.mjs` passed.
- Production mode **refuses to start** without Supabase config (exit 1).
- `SIGTERM` drains and exits 0.

**Clone size:** the repo is ~448 MB because `public/test samples/` (444 MB of source photos) is tracked. The backend build output still excludes them (`vite.config.js` removes `dist/test samples`; `dist/` is ~2.3 MB), but each host clone downloads them.

---

## 3. Environment-variable checklist (names only — never commit values)

### Backend host (provider dashboard → environment)
| Name | Required | Visibility | Notes |
|---|---|---|---|
| `NODE_ENV` | yes | plain | `production` — enables the fail-fast config check |
| `SUPABASE_URL` | yes | plain | `https://<ref>.supabase.co`; must be https in production |
| `SUPABASE_ANON_KEY` | yes | plain/secret | public by design (RLS-protected); used only for `auth.getUser(token)` |
| `GEMINI_API_KEY` | yes (for AI) | **secret** | server-only; never in the app, never `EXPO_PUBLIC_` |
| `PORT` | host-provided | — | don't hard-code unless the host requires it |
| `GIT_COMMIT` | optional | plain | shown by `/healthz` and at startup; Render/Railway/Fly variables are also picked up automatically |
| ~~`SUPABASE_SERVICE_ROLE_KEY`~~ | **do not set** | — | unused; the server warns if present. Account deletion (B1) will need it later, in an isolated function, not this server. |

### EAS environment variables (`eas env:create`), for **both** `preview` and `production`
| Name | Visibility | Value shape |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | **plain text** | `https://api.<domain>` — origin only, no path |
| `EXPO_PUBLIC_SUPABASE_URL` | **plain text** | `https://<ref>.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | plain text or sensitive (**not "secret"** — EAS forbids secret visibility for `EXPO_PUBLIC_` values) | anon/publishable key — **never** the service-role key |

These are enforced at build time by `mobile/scripts/validate-release-env.js` (`eas-build-pre-install` hook) for `preview` and `production`. Tested on Node 20.20 (EAS's Android image ships Node 20.19).

### Supabase dashboard
- Auth → URL configuration: **Site URL** plus redirect URLs (an HTTPS "email confirmed — return to the app" page).
- Auth → SMTP: custom SMTP credentials (stored in Supabase, not in this repo).
- Auth → Email: keep "Confirm email" **on** (unchanged).

### Store / EAS credentials (stored in EAS, never in git)
- Apple: an App Store Connect API key (`eas credentials` / `eas submit` prompts); an `ascAppId` goes into `eas.json` → `submit.production.ios` once the App Store Connect app exists.
- Google: a Play service-account JSON key uploaded to EAS.

---

## 4. HTTPS verification (after the backend deploy)

1. `node scripts/verify-deployment.mjs https://<api-origin>` from the repo root. It must print **PASSED**. It checks:
   - https base URL, and that `http://` redirects to https (or isn't served)
   - `/healthz` returns 200 with `supabaseConfigured` and `geminiConfigured` both true
   - an HSTS header (warn only)
   - `POST /api/ai/generate-outfit` without a token → **401**, which proves the auth gate with **zero Gemini spend**
   - `GET` on an AI route → 405
   - all **58/58** catalog WebPs served as real WebP
   - path traversal blocked
2. `curl -sSI https://<api-origin>/healthz`: confirm a valid certificate chain (no `-k` needed) and HTTP/1.1 or 2.
3. Certificate issuer/expiry: `echo | openssl s_client -connect <host>:443 -servername <host> 2>/dev/null | openssl x509 -noout -issuer -enddate`. Confirm auto-renewal is managed by the provider.
4. On-device proof comes in Phase 5 (release builds enforce ATS/cleartext blocking, so a working preview build proves TLS end to end).

## 5. Catalog-image checks

- **Before deploy (already passing):** `cd mobile && npm test` includes `deploymentCatalog.test.ts`. Every catalog entry's `imagePath` exists in `public/wardrobe` as a real WebP (not a symlink to the excluded source photos).
- **After deploy:** `verify-deployment.mjs` fetches every WebP under `public/wardrobe` from the live host (58 files).
- **In the app:** seed images resolve to the *current* `EXPO_PUBLIC_API_URL` at read time (M20), so the demo rows' stored LAN URLs need no data migration.

## 6. Logging

- **Startup:** version and commit, Gemini mode, every config warning or error (values never printed).
- **Per request** (only `/api/*` and `/healthz`, one JSON line): `{"t","method","path","status","ms"}`. No bodies (garment photos), no Authorization headers or tokens, no user IDs. Static files aren't logged.
- **Errors:** `[API Router Error]`, `[Server Gemini Error] <message>` (message server-side only), `[Auth Verify Error]`, and shutdown lines.
- **Where:** the provider's log stream. Set retention per provider. Useful alerts:
  - `/healthz` failing
  - a rising 5xx rate
  - `"status":401` spikes on `/api/ai/*` (Supabase paused or misconfigured)
  - `RESOURCE_EXHAUSTED` in Gemini errors (quota)

## 7. Rollback procedure

- **Backend (stateless — no DB migrations in this deploy):**
  1. Use the provider's "redeploy previous deploy" / rollback to the last good commit.
  2. Confirm with `curl https://<api-origin>/healthz` → `commit` shows the old SHA.
  3. Re-run `verify-deployment.mjs`.
  - The graceful `SIGTERM` drain avoids cutting off in-flight AI calls during the swap.
  - Keep the **API origin unchanged** across rollbacks: installed binaries have it compiled in.
- **Backend env vars:** record previous values in your password manager before every change; a bad env change is reverted in the provider dashboard, which triggers a restart.
- **Supabase:** nothing in this deploy changes schema or data. Before any future migration, take a backup (non-pausing plan) and keep a down-migration.
- **Mobile:** there are **no OTA updates** (`expo-updates` isn't installed), so every fix is a new binary.
  - EAS builds are immutable, and `autoIncrement` gives each build a higher build number / versionCode.
  - TestFlight: expire the bad build.
  - Play internal: roll out a newer versionCode (Play won't accept a lower one).
  - Because the app's backend URL is fixed per binary, a backend rollback is always compatible with already-installed builds as long as the API contract isn't changed in a breaking way.

---

## 8. Exact sequence

> ⛔ = stop and get the result/decision before continuing. Nothing below has been run.

### Phase 0 — Local preparation ✅ (done in this preparation, uncommitted)
- `.easignore` at the **repo root** (eas-cli reads it there and it replaces all `.gitignore` files). EAS upload drops from ~448 MB to **4.2 MB**, and `.env` / `mobile/.env.local` are excluded — verified with the installed eas-cli's own ignore code: `node scripts/check-easignore.mjs`.
- `mobile/eas.json`: an explicit `environment` for every profile; the preview Android build is an APK; production Android is an app-bundle; submit is locked to Play **internal track, draft**. Validated with eas-cli's `@expo/eas-json`.
- `mobile/app.json`: `ITSAppUsesNonExemptEncryption: false`; image-picker `microphonePermission: false` (Android `RECORD_AUDIO` removed, no iOS microphone prompt), confirmed with `npx expo config --type introspect`.
- Backend: `/healthz`, JSON request logs, graceful shutdown, `scripts/verify-deployment.mjs`.
- ⛔ Review and commit/push (Decision 8).

### Phase 1 — Supabase
1. Dashboard: **restore** project `wibinjtekmadwtbxygrd`; move to the chosen plan.
2. Re-verify RLS on all six tables and on `storage.objects` (M19 LIVE-verified them before the pause); run the security and performance advisors.
3. Set the Auth Site URL and redirect URLs, and custom SMTP. Keep "Confirm email" on.
- ⛔ Gate: the project is `ACTIVE`, the RLS policy list matches M19, and a test sign-up email arrives via custom SMTP.

### Phase 2 — Backend deployment
1. Create the service on the chosen provider using §2 (build, start, Node, health check `/healthz`).
2. Set the backend env vars from §3.
3. Deploy. Watch for `Listening on port … (version …, commit …)` with **no CONFIG ERROR** lines.
4. Attach the custom domain and wait for the certificate.
5. Run §4 steps 1–3.
- ⛔ Gate: `verify-deployment.mjs https://<api-origin>` prints **PASSED**.

### Phase 3 — Production environment configuration
1. `cd mobile && eas init` (owner: personal account `vudigapranav`). This writes `owner` and `extra.eas.projectId` into `app.json`; commit it.
2. For each of `preview` and `production`:
   `eas env:create --environment <env> --name EXPO_PUBLIC_API_URL --value https://<api-origin> --visibility plaintext`, and likewise `EXPO_PUBLIC_SUPABASE_URL` (plaintext) and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (plaintext or sensitive).
3. `eas env:list --environment preview` and `--environment production`: confirm three variables in each. (Don't use `eas env:pull` without `--path`: it overwrites your dev `mobile/.env.local`.)
4. `node scripts/check-easignore.mjs` → OK.
- ⛔ Gate: all env vars present; eas-cli upgraded if desired (`npm i -g eas-cli`; 21.7.0 installed, 24.3.0 available).

### Phase 4 — EAS preview builds (internal distribution)
1. iOS internal builds need an Apple Developer account and registered test devices: `eas device:create` (register each iPhone's UDID).
2. `eas build --platform ios --profile preview` — let EAS generate the distribution certificate and ad hoc profile.
3. `eas build --platform android --profile preview` — let EAS generate the upload keystore, then **download a backup** via `eas credentials`.
4. In both build logs, confirm:
   - the `eas-build-pre-install` step prints `[release-env] OK`
   - the iOS log shows **Xcode 26**
- ⛔ Gate: both builds succeed. If the release gate fails, fix the EAS env vars — don't bypass the gate.

### Phase 5 — Physical-device testing without Metro
1. Install from the EAS build page or QR code on a real iPhone and a real Android phone. **Don't run `expo start`**: preview builds embed the JS bundle and talk only to the HTTPS backend. Quit Expo Go.
2. Run the M19-C audit's 11-step script (STATE.md) plus the M20 additions:
   - sign up → confirmation email (real inbox) → log in → onboarding (Men, then Women on a second account)
   - upload 2 tops + 2 bottoms → generate **one** outfit → save → Planner
   - log out → second account → original account → force-quit/reopen
   - airplane-mode failure and retry
   - a saved look over an hour old still shows its photos
   - offline cold start after an hour shows the "still signed in" notice
   - an airplane-mode scan offers manual entry
3. Gemini: generate at most **one** outfit per account. **On any 429 or "rate limit" notice, stop all AI testing** and use existing saved looks for persistence tests.
4. Watch backend logs during testing for 401/5xx spikes.
- ⛔ Gate: every step PASS, recorded in STATE.md as DEVICE VERIFIED.

### Phase 6 — Production builds
- Prerequisite: B4 (a real icon) resolved; B1–B3 and B7 resolved before any external or store audience.
- `eas build --platform all --profile production` (remote version source, `autoIncrement`).
- ⛔ Gate: the release gate prints OK, and the builds succeed.

### Phase 7 — TestFlight / Play internal testing (non-public)
- **iOS:** create the app record in App Store Connect (EAS doesn't create it) and put its `ascAppId` in `eas.json` → `submit.production.ios`. Then `eas submit --platform ios --profile production`: this **only uploads to App Store Connect/TestFlight**; it never submits for review. Add *internal* testers in App Store Connect.
- **Android:** create the app in Play Console and upload the service-account key to EAS. Then `eas submit --platform android --profile production`: this uploads to the **internal track as a draft** (per `eas.json`). Start the internal rollout manually in Play Console, testers only.
- If the Play account is personal: start the 12-tester / 14-day **closed** test now.
- ⛔ Gate: testers install from TestFlight / Play internal; repeat the Phase 5 smoke test; check the Play pre-launch report (16 KB, crashes).

### Phase 8 — Store submission (NOT part of this preparation; needs your explicit go-ahead)
- Only after B1–B4 and B7 are resolved and `RELEASE_CHECKLIST.md` is complete:
  - **App Store:** submit for review with **"Manually release this version"**, so approval doesn't publish automatically.
  - **Play:** promote to production with **managed publishing** on and a staged rollout.
