# CLOSIQ — Release Checklist (prepared in Sprint M20, 2026-09-11)

Status key: **BLOCKER** = store submission will be rejected, or the shipped app won't work · **REQUIRED** = must be done before release · **VERIFY** = check on a real build · ✅ = already satisfied (with evidence).

Nothing on this list has been built, submitted or deployed. Every "✅" is SOURCE VERIFIED or checked against official documentation on 2026-09-11 — none of it is DEVICE VERIFIED.

---

## 0. Release blockers (summary)

| # | Blocker | Why |
|---|---|---|
| B1 | **No in-app account deletion** | Apple 5.1.1(v); Google Play also needs an in-app path **and** a web deletion link. CLOSIQ has sign-up but no deletion anywhere. |
| B2 | **No privacy policy** (in-app link + store listing) | Apple 5.1.1(i); Google Play requires one for any app handling personal data. |
| B3 | **No consent before sending photos/wardrobe to Google Gemini** | Apple 5.1.2(i) now explicitly requires disclosure **and explicit permission** before sharing personal data "with third-party AI". |
| B4 | **No store-compliant app icon** | `app.json` `icon` is the 984×274 transparent wordmark; `assets/icon.png` and `android-icon-foreground.png` are unmodified Expo template placeholders. Needs a real 1024×1024 opaque square mark from the official brand (CLAUDE.md forbids fabricating one). |
| B5 | **No production backend** | `EXPO_PUBLIC_API_URL` is a LAN IP; `config.ts`'s release fallback is a deliberately unreachable `.invalid` host. Release builds also block cleartext HTTP (iOS ATS; Android release default), so a LAN `http://` URL can't work even on the same Wi-Fi. |
| B6 | **Supabase project is paused** (free-tier inactivity) | A production backend can't sit on a pausable plan. |
| B7 | **Shared public demo account** | `demo@login` / `demo@123` is hard-coded and shared by every user, so anything uploaded to it is visible to every other demo user. That's user-generated content shared between strangers, which triggers Apple 1.2 (filtering, reporting, blocking, published contact info). Disable it in production, reset it to read-only, or give reviewers a private account instead. |

**No Expo SDK 57 submission blocker was found.** *(Updated 2026-09-12: the project was upgraded SDK 54 → 57 at the user's explicit request; the SDK 54 assessment below was equally clear, so the upgrade was not required for submission.)* SDK 57 (RN 0.86.3) targets Android API 36 — confirmed locally in `react-native/gradle/libs.versions.toml` — meeting Google Play's requirement since 2026-08-31. SDK 57 requires Xcode 26.4+, above App Store Connect's Xcode 26 minimum since 2026-04-28. RN ≥0.77 supports 16 KB memory pages.

---

## 1. Production HTTPS backend (`server/`)

- [ ] **BLOCKER B5** — Deploy `server/index.js` behind HTTPS at a stable public origin. Set it as `EXPO_PUBLIC_API_URL` in EAS environment variables for the `preview` and `production` profiles.
- [ ] **REQUIRED** — Host runs **Node ≥ 22.13** (backend needs ≥22.9; mobile SDK 57 tooling needs ≥22.13) (`engines` corrected in M20: the start script's `--env-file-if-exists` flag doesn't exist on Node 20, and Node 20 is end-of-life).
- [ ] **REQUIRED** — Host env: `NODE_ENV=production`, `SUPABASE_URL` (https), `SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, `PORT`. Since M20 the server **refuses to start** in production if the Supabase variables are missing, http, or placeholders (`server/envCheck.js`). **Never** set a service-role key here: it's unused, and the check warns if one is present.
- [ ] **REQUIRED** — Seed/catalog images are served from `/wardrobe/*` on this host. Since M20 the app re-hosts them on the *current* API origin at read time, so no data migration is needed — but the production host **must** serve `public/wardrobe` (the root `dist/` build includes it).
- [ ] **VERIFY** — Gemini: 30 s server timeout (M20), no automatic retries (no `retryOptions`, so a 429 is never re-sent against quota), and the model alias `gemini-flash-latest` is still available on the production key. Check billing and quota for launch traffic.
- [ ] **VERIFY** — The server echoes the raw Gemini `err.message` in the `error` field of 200 responses. The mobile app no longer displays it (M20 uses `errorKind`), but consider removing it so provider detail never leaves the server.
- [ ] Consider rate limiting per user on `/api/ai/*` (every call spends Gemini quota; auth is required but there is no per-user cap).

## 2. Supabase — Auth

- [ ] **BLOCKER B6** — Restore the project and move it to a plan that doesn't pause.
- [ ] **REQUIRED** — Set **Site URL** and redirect URLs to a real HTTPS page. The email-confirmation link lands there, and the default `localhost` target is broken on a phone. The app uses `detectSessionInUrl: false`, so the page only needs to say "confirmed — return to the app and log in".
- [ ] **REQUIRED** — **Custom SMTP**. Supabase's built-in email sender is heavily rate-limited and not meant for production; sign-up confirmations will stall without it.
- [ ] **VERIFY** — "Confirm email" stays ON (this sprint didn't change it). Enable leaked-password protection and set a minimum password length that matches the app's 6-character check.
- [ ] **VERIFY** — Access-token lifetime (default 1 h). The M20 app handles expiry: foreground auto-refresh via `AppState`, an honest notice for offline-restore failure, and a "session expired" notice on AI 401s.
- [ ] **BLOCKER B1** — Account deletion needs a **server-side** delete, because the anon key can't delete `auth.users`. Build it as an Edge Function or backend endpoint that verifies the caller's JWT and then, with the service role (server-only): deletes the user's `garment-images/<uid>/*` objects, the rows in `garments`, `saved_outfits`, `planner_events`, `outfit_history`, `user_preferences` and `profiles`, then `auth.admin.deleteUser(uid)`. After success the app must clear that user's `@closiq_*_<uid>` AsyncStorage keys. Google also needs a **web page** for deletion requests.

## 3. Supabase — RLS & Storage

- ✅ M19 LIVE-verified: all six tables and `storage.objects` have SELECT/INSERT/UPDATE/DELETE policies scoped to `auth.uid()`, and cross-user inserts are rejected (403). **Re-verify after restoring the project** — it couldn't be checked in M19-C/M20 while paused.
- [ ] **VERIFY** — Run the Supabase security and performance advisors after restore.
- [ ] **VERIFY** — `garment-images` bucket stays **private**; object paths are `<uid>/<garmentId>.jpg`. Signed-URL TTL is 1 h. Since M20, expiry is handled by re-signing from the durable path on load and on image error, so no public bucket is needed.
- [ ] **VERIFY** — Consider unique constraints on `(user_id, garment_id, wardrobe_profile)`, `(user_id, outfit_id)` and `(user_id, event_id)`. The app is already idempotent on retry (M19 audit), but constraints are defence in depth.
- [ ] Hardening (M19 audit residual): make the garment delete require ≥1 deleted row before removing an uploaded image.

## 4. Mobile build configuration (`mobile/app.json`, `mobile/eas.json`)

- ✅ SDK 57 migration (2026-09-12): the removed top-level `splash` field is now the `expo-splash-screen` config plugin (same asset, background and resize mode).
- [ ] **VERIFY** — `npx expo-doctor` is 20/21; the one failure is blocker **B4** (non-square icon), which doctor flags for both `icon` and `android.adaptiveIcon.foregroundImage`.

- ✅ Release env gate (M20): `mobile/scripts/validate-release-env.js` runs as the `eas-build-pre-install` hook and **fails `preview`/`production` builds** when the API or Supabase URL is http, LAN, localhost, `.invalid` or a placeholder, when the anon key is a service-role key, or when any `EXPO_PUBLIC_*` variable looks like a secret. Run `npm run check:release-env` locally; today it correctly fails because `.env.local` is a LAN dev config.
- [ ] **REQUIRED** — Put `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in **EAS environment variables** (or per-profile `env` in `eas.json`). `.env.local` is gitignored and isn't uploaded to EAS.
- [ ] **REQUIRED** — `eas.json` `development` profile sets `developmentClient: true`, but **`expo-dev-client` isn't installed**. Install it (`npx expo install expo-dev-client`) or drop the flag.
- ✅ `ios.infoPlist.ITSAppUsesNonExemptEncryption: false` — added during deployment prep (2026-09-11).
- ✅ `expo-image-picker` plugin `"microphonePermission": false` — added during deployment prep; `expo config --type introspect` confirms `RECORD_AUDIO` is removed and no iOS microphone string is generated.
- [ ] **VERIFY** — Location: `expo-location` declares both FINE and COARSE. Weather only needs coarse (`Accuracy.Balanced`), so consider `android.blockedPermissions: ["android.permission.ACCESS_FINE_LOCATION"]`. No background location is requested ✅.
- [ ] **VERIFY** — `expo-image-picker` declares legacy `READ/WRITE_EXTERNAL_STORAGE`. On API 33+ the system photo picker needs no media permission, and no `READ_MEDIA_IMAGES` is declared ✅. Consider blocking `WRITE_EXTERNAL_STORAGE`.
- [ ] **VERIFY** — Edge-to-edge is mandatory on Android (SDK 55+). The app now uses `react-native-safe-area-context` (`SafeAreaProvider` + `SafeAreaView`) instead of React Native's deprecated `SafeAreaView`; **check on a real Android device** that the floating nav dock, headers and splash aren't under the status bar or gesture bar.
- ✅ Usage strings present: camera, photo library, location when in use.
- ✅ `appVersionSource: remote` + `autoIncrement` on `production`.

## 5. Signing & identifiers

- [ ] **REQUIRED** — Apple Developer Program membership; register the bundle ID `com.closiq.app` (check it's available). It can't change after the first App Store release.
- [ ] **REQUIRED** — Google Play developer account; package `com.closiq.app` (permanent once published). Enroll in **Play App Signing**; let EAS manage the upload keystore and **back it up**.
- [ ] **REQUIRED** — New *personal* Play developer accounts must run a closed test with at least 12 testers for 14 days before production access.
- [ ] **REQUIRED** — EU Digital Services Act **trader status** in App Store Connect (and the Play equivalent) if distributing in the EU.
- [ ] `eas.json` `submit.production` is empty — add the App Store Connect app ID / API key and the Play service-account JSON when ready. **Don't commit credentials.**

## 6. Icons, splash, store assets

- [ ] **BLOCKER B4** — A 1024×1024 **opaque** iOS icon and an Android adaptive icon (foreground inside the safe zone, plus a background colour; monochrome layer optional for themed icons), derived from the official CLOSIQ brand. The only official asset, `public/brand/closiq-logo.png` (`mobile/assets/closiq-logo.png`), is a wide wordmark and doesn't work as a square icon.
- ✅ Splash: wordmark on `#F7F2E9` with `resizeMode: contain`.
- [ ] Screenshots for the required device sizes, plus store descriptions. **No ecommerce claims** (CLAUDE.md).

## 7. Privacy

- [ ] **BLOCKER B2** — A privacy policy at a public HTTPS URL, linked in both store listings **and inside the app** (e.g. Profile → Settings). It must list the data collected, every third party, retention, and how to request deletion.
- [ ] **BLOCKER B3** — An explicit consent step before the first AI call, naming **Google Gemini** as the processor of garment photos and wardrobe details. Where consent is declined, fall back to the local engine or manual entry, both of which are honestly labelled since M20.
- [ ] **REQUIRED** — Apple App Privacy labels and Google **Data safety** form. Data involved:
  - account email (Supabase)
  - user photos and garment metadata (Supabase Storage/DB, sent to Google Gemini)
  - optional profile attributes: body type, skin tone, style preferences
  - approximate location sent to **Open-Meteo** (`api.open-meteo.com`) for weather; not stored server-side (only the permission status is stored)
  - no ads, no tracking (so no ATT prompt)
  - the deletion practices questions (Google)
- [ ] **VERIFY** — iOS **privacy manifest** (required-reason APIs, e.g. UserDefaults via AsyncStorage). Check the generated `PrivacyInfo.xcprivacy` in the first EAS iOS build; add `ios.privacyManifests` in `app.json` if Xcode or App Store Connect reports missing reasons.
- [ ] **REQUIRED** — Apple's updated age-rating questionnaire in App Store Connect.

## 8. App Review readiness

- [ ] Give reviewers a **dedicated, private** review account (not the shared demo, B7) with a pre-populated wardrobe and saved looks. Mention that AI features call a live backend.
- [ ] A support URL and contact email (Apple 1.2 also asks for published contact info).
- [ ] Complete the M19/M20 **physical-device QA** (STATE.md) on a release-like build before submitting.

## 9. Post-build verification (first EAS preview build)

- [ ] **VERIFY** — Android: the Play Console pre-launch report shows no 16 KB page-size warnings (RN 0.81 is compliant; each native dependency must be too).
- [ ] **VERIFY** — Cold start offline with an expired token shows the M20 "still signed in… reconnect" notice, not a silent Login screen.
- [ ] **VERIFY** — A Saved Look from more than an hour ago shows its uploaded photos (M20 re-signing).
- [ ] **VERIFY** — Airplane-mode garment analysis shows "Couldn't analyze this photo" with manual entry — no invented attributes or confidence (M20).
