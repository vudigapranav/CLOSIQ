# CLOSIQ handoff for Claude

Codex records its changes here, newest first.

## 2026-11-20 — V2 redesigned as an update of V1: accounts kept, CLOSIQ AI instead of Gemini; emulator demo

**Owner's direction (2026-11-19):** V2 must not use Gemini or any API key for scanning, pairing or styling; it must **not** be a guest/offline app; existing V1 users (the owner's brother) must keep all data and receive V2 **as an update**; customers must never see "local"/"on-device" wording, only "CLOSIQ AI". Offline is fine but not the goal.

### What changed (feature/closiq-v2-local-ai)
- **Back to V1's app shell and data:** `App.tsx`, Onboarding, Profile, weather, release-env script and `imageOptimizer` reverted to V1; the guest SQLite layer, backup/restore, V1 import and all storage `.native.ts` overrides deleted (`src/local/{store,records,backup,legacyImport,photos}.ts`, ten `services/*.native.ts`, `sessionLifecycle.ts`, `AccountPrivacySection.native.tsx`); `expo-sqlite` removed (lockfile identical to V1 again). `app.json` is V1's (package `com.closiq.app`, OTA URL) with version **2.0.0**, so V1 OTAs (runtime 1.0.0) cannot land on V2.
- **Kept and improved CLOSIQ AI:** `visionAnalysis.native.ts` and `outfitStylist.native.ts` (Metro picks them on Android; no `/api/ai/analyze-garment|generate-outfit|swap-garment` in the Android bundle). Add Clothing passes the photo file to the scan and keeps base64 for V1's optional studio cut-out (server U²-Net, not Gemini).
- **Short questions instead of forms** (`local/validation.ts`): emulator testing showed the 500M base model answers one question well but skips fields and loops on a JSON or 7-line form. Scan = "What is this garment and what colour is it?" (+ type/colour only if missing) + "casual, smart casual, formal or evening?"; category/colour/formality derived and checked against allowed values. Outfit pick = "number only" among rule-built owned outfits + one "why" sentence; any other number → rules. Chat = question first, numbered owned list, reply cut to two distinct sentences.
- **Native:** Kotlin returns the collected text when CLOSIQ caps length (LiteRT-LM throws `CancellationException` on `cancelProcess()`), cap 700 chars; **crash guard** marker file so a SIGILL during engine start makes status `failed` (manual entry + rules, "Try starting it again") instead of crashing on every scan/outfit; `resetLoadFailure`.
- **UI:** `components/LocalModelSection.tsx` (Profile "CLOSIQ AI" section + Home "Turn on CLOSIQ AI" card, hidden when AI photo analysis is off); every customer string says CLOSIQ AI (also V1's "Local pick" → "CLOSIQ pick", "local weather" wording); model name, GPU switch, timings and memory only when `EXPO_PUBLIC_CLOSIQ_AI_DEMO=1`. Swap now returns V1's `no_alternative` contract; JS timeout frees the lock.
- **Demo build:** `mobile/src/demo/AiDemoApp.tsx`, selected in `index.ts` only when `EXPO_PUBLIC_CLOSIQ_AI_DEMO=1` (no sign-in, nothing saved, sample men's catalog).
- **Sign-up bug (V1 too, mobile + web):** signing up with an email that already has an account showed "Account created — check your email"; Supabase sends nothing in that case (`identities: []`). Now says the account exists → log in / reset. Found via Supabase auth logs (`user_repeated_signup`); the owner's account (created 2026-10-15) was intact. Password-reset email delivery verified in logs; the reset link redirects to `localhost:3000` because the project's Site URL / redirect allow-list are not set to `https://closiq-liard.vercel.app` — **owner to fix in Supabase → Auth → URL Configuration** (not changed by Claude).
- A Sonnet subagent independently reviewed the conversion (no V1 data-loss risk, no remaining Gemini path); its swap-contract, timeout-lock and banner findings were fixed.

### Emulator evidence (Android 16 arm64 AVD on the M4 Mac, 4 GB RAM, `arm64.nosme`, Wi-Fi + data disabled)
| Step | Result |
| --- | --- |
| Download 363 MB model + SHA-256 | OK in ~43 s (online, the only download) |
| First engine start (before `arm64.nosme`) | **SIGILL** in `liblitertlm_jni.so` `nativeCreateEngine`: emulator advertises the M4's SME2 but the hypervisor cannot run it |
| Free-form test (CPU) | Load 0.66 s, answer 5.49 s, PSS 836 MiB: "The garment is a light blue button-down shirt." |
| Scan, black cargo pants | 7.3 s → Black cargo pants · bottoms · black · casual |
| Scan, light blue shirt | 7.1 s → Light blue button-down shirt · tops · light blue · casual |
| Outfit pick, "Dinner with friends on Friday" (first two-line Choice/Reason prompt was ignored by the model → rules; fixed to number-only + why) | 6.9 s, picked by CLOSIQ AI: White Oxford Shirt + Taupe Parachute Pants + Leather Loafers + Black Sling Bag, with its own reason |
| Swap top | White Oxford Shirt → Light Blue Poplin Shirt |
| Chat, first prompt (JSON wardrobe) | Ignored the wardrobe ("a white dress or a white shirt") and looped on one sentence |
| Chat, numbered list prompt | Copied the list ("Charcoal Art Tee 2. Cream Graphic Tee 3.") |
| Chat, final (question → grounded outfit path) | "Try your White Oxford Shirt, Taupe Parachute Pants, Leather Loafers and Black Sling Bag. … are suitable for a wedding reception." |

Not run: sign-in and cloud screens (needs the owner's password), a physical phone, the EAS-signed update.

### Commands / results
| Check | Result |
| --- | --- |
| Mobile `npm test` | **177/177** (V1 suites + `v2LocalAi`, `v2Model`, repeated-sign-up case) |
| `npm run test:server` | 16/16 |
| Root `npm run typecheck`, mobile `tsc --noEmit` | Pass |
| `npm run lint` | 0 errors, **0 warnings** (Codex's 6 unused imports removed) |
| `npm run build` (web) | Pass |
| `npm run check:release-env` (with V1's public Supabase env) | OK |
| `npx expo export -p android` (production, no demo flag) | 0 hits for `/api/ai/analyze-garment`, `generate-outfit`, `swap-garment`, `generativelanguage`, `GEMINI`; demo screen not in the bundle; no "On-device AI" / "Local pick" / "local weather" / "Ask local" strings. Remaining "on this device" strings are V1's account-sync messages. |
| Sonnet subagent review of the conversion | No V1 data-loss risk, no Gemini path left; 3 findings fixed |

### APKs
- Demo: `builds/CLOSIQ-V2-2.0.0-ai-demo-20261120-arm64.apk` — 58,553,717 bytes, SHA-256 `eb1cb02c3d9683c0eee37c086a5022c2a5a05e4d3bd3927d996b6b447e3bf861`, package `com.closiq.app.demo`, label "CLOSIQ V2 demo", debug-signed, bundled with `EXPO_PUBLIC_CLOSIQ_AI_DEMO=1`. Installs next to V1.
- **No local `com.closiq.app` APK is shipped**: a Mac build is debug-signed and cannot update V1. The update is the EAS `preview` build (owner).
- Earlier artifacts kept unchanged: `builds/CLOSIQ-V2-2.0.0-arm64-release.apk` (first build) and `builds/CLOSIQ-V2-2.0.0-review-20261119-arm64-release.apk` (review build, old `com.closiq.app.v2` guest design, superseded).
- Build-time note: with the emulator running, Gradle builds took 11–17 min on this Mac (swap); use `-Xmx3g`/`-Xmx4g`.

### Open
- Owner: `npx eas-cli build -p android --profile preview` in `CLOSIQ-v2/mobile` (Expo login) → install over V1 on the brother's phone; turn on CLOSIQ AI; report scans/timings.
- Owner: Supabase Site URL + redirect URLs → `https://closiq-liard.vercel.app` so reset/confirm links stop pointing at localhost.
- Web still uses Gemini (V2 scope = Android). Training of `CLOSIQ-VLM-500M` still needs rights-reviewed photos.
- Emulator config changed: `~/.android/avd/Medium_Phone.avd/config.ini` now `hw.ramSize=4096` and `kernel.parameters=arm64.nosme` (original saved as `config.ini.before-closiq`); demo app `com.closiq.app.demo` and two sample photos are on the emulator.

## 2026-11-19 (evening) — Independent review by Claude of the Codex and DeepSeek work; fixes, tests, rebuilt APK

Reviewed the whole diff `7767584...b1837de` on `feature/closiq-v2-local-ai` (Codex: `b060ff1`…`db75bc2` plus the previously uncommitted files folded into `04dcd42`; DeepSeek: the Android build fixes in `04dcd42` and the `b1837de` handoff). No newer work had landed. No phone was attached (`adb devices -l` empty), so nothing below is device evidence.

### Findings and fixes

| # | Severity | File / function | Trigger → user impact | Fix | Verification |
| --- | --- | --- | --- | --- | --- |
| 1 | High | `mobile/src/local/photos.ts` `stagePhoto`, `services/wardrobeStorage.native.ts` `saveUserGarment` | expo-file-system 57 made `File.copy()` asynchronous; it was called without `await`. The garment row was committed before the photo existed, a failed copy became an unhandled rejection with the row still saved (permanent placeholder), and the wardrobe returned to the screen could show no photo. | `stagePhoto` is async, awaits the copy, checks the file, deletes a partial copy on failure; the record is written only afterwards. | New test fails on the old code (row written despite copy failure), passes now. |
| 2 | High | `mobile/src/local/backup.ts` `exportBackup` / `restoreBackup` | On Android the folder picker returns a Storage Access Framework `content://` tree. The code addressed children with `new File(folder, name)`, which does not resolve a child document, and also did not await `copy()`. Export could report success while photos were not written; restore could not find `wardrobe.json` and inserted rows before photo copies finished. | Children are created with `createFile`/`createDirectory` and found with `list()`; all bytes are read/written with awaits; restore copies photos inside the transaction and deletes them on rollback. | Round-trip test through a simulated SAF folder (joined child URIs do not resolve, `copy` is async): export, wipe, failed restore leaves 0 rows and 0 photos, restore, repeat restore inserts 0. Old code fails it. Real SAF behaviour still needs the phone. |
| 3 | Medium | `backup.ts` | One photo file missing on the phone made export throw for the whole wardrobe; one photo missing from a backup made restore throw. | Missing photos become the standard placeholder (`imageUrl: ''`) and the result message counts them. | Same test (export with a lost photo; restore after deleting a photo from the backup). |
| 4 | Medium | `mobile/src/local/model.ts` `infer`, `cancelGeneration` | The Kotlin bridge returns the text produced so far when a conversation is cancelled. A user Cancel, the 60 s timeout, or the app backgrounding (Kotlin `release()`) surfaced that partial text as a finished chat answer / benchmark result, or as model output to validate. Cancelling while the engine was still initializing did nothing, so generation started anyway and kept the model busy. | A cancel epoch: cancel, timeout, memory warning and AppState `background` move it; `infer` throws `GenerationCancelled` if it moved before or during `answer`. | `tests/v2Model.test.ts` (4 cases); old code hangs/fails. |
| 5 | Low | `AccountPrivacySection.native.tsx` `benchmark` | Cancel during benchmark initialization was ignored; after a GPU benchmark the engine stayed on GPU, so every later scan silently ran on GPU while the docs say CPU. | Benchmark checks its own abort signal; a GPU engine is unloaded after its benchmark. | Typecheck; device check pending. |
| 6 | Medium | `mobile/src/local/validation.ts` `parseObject` | Only bare JSON or an exactly fenced block parsed. A 500M model's usual "Here is the JSON: {...}" sent every scan to manual entry and every ranking to the rule fallback. | Take the first balanced top-level object (string/escape aware); all field checks unchanged (fabricated IDs and extra fields still rejected). | New test; old code fails it. |
| 7 | Medium | `mobile/src/local/legacyImport.ts` `mapLook` → `cloudRows.ts` `mapLegacyLook` | A saved look naming a V1 garment ID present in both wardrobes, without a profile on the snapshot, threw "ambiguous legacy garment reference". The importer resumes from the same row, so every retry failed at the same look and planner events were never imported. | Pure `mapLegacyLook`: unique or profile-matched garment, otherwise the archived snapshot without a photo. Never throws. | New test. Live import still unexercised (no authorized account, and no V1 env in the APK, see below). |
| 8 | Low | `ai/training/evaluate_checkpoint.py` | Evaluation parsed with strict `json.loads` (scoring fenced output as invalid although the app accepts it), loaded the base from a hard-coded path instead of `configs/base-model.yaml`, and did not record which split was scored. | Same first-object rule as the app; base directory from the config; output records base model/revision, split path and SHA-256, and the raw text. | Parser checked with fenced, escaped and truncated inputs; `py_compile` OK. |
| 9 | Low (docs) | `mobile/plugins/with-android-build-compat.js` | The generated comment said re-running `expo prebuild` refreshes the pins, but the marker stops the block from being rewritten. | Comment now says `npx expo prebuild --clean`. | Two consecutive prebuilds produce byte-identical `android/build.gradle` and `app/build.gradle`; the block appears once. |
| 10 | Low (build scope) | `mobile/plugins/with-android-build-compat.js` | `-Xskip-metadata-version-check` was added to **every** Kotlin module. | Scoped to `:expo` and `:app`; `closiq-vision` keeps its own module flag. | Without the project-wide flag only `:expo:compileReleaseKotlin` fails (Kotlin stdlib 2.4.0 from LiteRT-LM on its classpath); with `:expo`+`:app` a `--rerun-tasks` build (659/659 executed, 15 Kotlin compiles) and a fresh `prebuild --clean` build both succeed, and the APK is identical to the project-wide-flag build in all 1,121 entries except `assets/app.manifest` (build-time update manifest): same dex, `.so` and bundle. |

Reviewed with no change needed: Metro resolution (the exported Android bundle contains `closiq-device-v2.db`, `ClosiqVision` and the new code, and **no** `/api/ai/analyze-garment`, `/api/ai/generate-outfit`, `/api/ai/swap-garment`, `studio-photo` or `u.expo.dev`; the only `supabase.co` strings are supabase-js/config validation constants); native startup never calls Supabase; weather only on explicit refresh; OTA disabled; outfit choice is an index into engine-built candidates from available owned pieces; swaps use `rankSwapCandidates` over `eligibleWardrobe` (laundry/unavailable excluded); chat output is display-only; SQLite scoping per wardrobe; Kotlin install hashes before an atomic `Os.rename`, GPU load failure closes the engine; DeepSeek's NDK/Build Tools pins apply only when the preferred version is absent. Dataset preparation, group split and leakage checks were correct for exact duplicates; near-duplicate photos (re-encoded/resized) are not detected by the pixel hash, so curators must keep views of one garment in one `group`.

DeepSeek's NDK/Build Tools overrides were kept as written (needed on this host: NDK 27 and Build Tools 35 are absent and the SDK directory is not writable); they only apply when the preferred version is missing.

### Commands and results on this Mac (current checkout)

| Check | Result |
| --- | --- |
| Baseline before edits: root `npm run typecheck`, mobile `tsc`, `npm test`, `npm run test:server` | Pass, 170/170, 16/16 |
| After fixes: mobile `npm test` | **178/178** (8 new in `tests/v2Storage.test.ts`, `tests/v2Model.test.ts`) |
| New tests against the original sources | 5 of the new tests fail (cancel-during-init hangs to the 60 s timeout) |
| `npm run test:server` | 16/16 |
| Root `npm run typecheck`, mobile `npx tsc -p tsconfig.json --noEmit` | Pass |
| `npm run lint` | 0 errors, 6 pre-existing warnings |
| `npm run build` (web) | Pass (pre-existing chunk-size warning) |
| `npm run check:release-env` | OK |
| `npx expo export -p android` | Pass, 3.3 MB bundle (`--no-bytecode`, for string inspection) |
| `npx expo prebuild --platform android` ×2 | Identical output |
| `python3 ai/evaluation/test_pipeline.py` (system Python 3.13, Pillow 11.1) / `validate_dataset.py` | 3/3 OK / `{train: 14, validation: 4, test: 2}` |
| `:app:assembleRelease -PreactNativeArchitectures=arm64-v8a` (default `~/.gradle`, now writable and pre-populated; no separate `GRADLE_USER_HOME` needed) | BUILD SUCCESSFUL in 4m 51s (project-wide flag); `--rerun-tasks` 2m 47s (scoped flag, 659/659 executed); final after `prebuild --clean` from the committed plugin 1m 38s |
| Kotlin narrowing experiment (`compileReleaseKotlin --continue` without the project-wide flag) | Fails only in `:expo` ("metadata version is 2.4.0 … can read up to 2.2.0") |
| `adb devices -l` (start and end of session) | No devices |

### Revised APK

```text
builds/CLOSIQ-V2-2.0.0-review-20261119-arm64-release.apk
60,423,870 bytes · SHA-256 ab92f43d948a94e35fc71167bf977ede15d4d8ac9e34f07050bfb1c22ed2f556
package com.closiq.app.v2 · versionCode 1 · versionName 2.0.0 (unchanged) · arm64-v8a only
signed with the Expo template's local debug certificate (CN=Android Debug, cert SHA-256 fac61745…033b9c)
```

`lib/arm64-v8a/liblitertlm_jni.so` (22.7 MB) and a Hermes `assets/index.android.bundle` are inside; the bundle contains `GenerationCancelled`, `firstJsonObject`, `mapLegacyLook` and no `/api/ai/analyze-garment`. The original `builds/CLOSIQ-V2-2.0.0-arm64-release.apk` is kept unchanged (60,417,798 bytes, SHA-256 `79d40430…e10e` re-verified). Both use the same package, versionCode and debug key, so `adb install -r` of the review build updates an installed original **in place, keeping its data**; V1 (`com.closiq.app`) is a different app and is untouched. The shipped file is the final build from `prebuild --clean` with the committed plugin. Disk on this Mac ran down to 1 GiB during the experiments (the 6 GB Gradle daemon); stopping it restored ~7.6 GiB. `mobile/android/` (≈0.9 GB) and the library `android/build` folders under `mobile/node_modules` (≈0.8 GB) are generated and can be deleted.

### Still open — needs the phone or the owner

- Everything in the previous entry's device list: install, model download, airplane-mode inference text, backend, Init/Inference/PSS, restart persistence, swap/save/planner on device.
- Real SAF behaviour of export/restore (the host test simulates it). Use a folder on internal storage, not Drive.
- V1 import: needs `mobile/.env.local` with the public V1 URL/anon key at build time and an authorized test account. Neither APK has it.
- Training stays pending: 20 synthetic text-ranking records, zero rights-reviewed garment photos, no base-inference proof.

### Files changed
`mobile/src/local/{photos,backup,model,validation,cloudRows,legacyImport}.ts`, `mobile/src/services/wardrobeStorage.native.ts`, `mobile/src/components/AccountPrivacySection.native.tsx`, `mobile/plugins/with-android-build-compat.js`, `mobile/tests/{v2Storage,v2Model}.test.ts`, `mobile/tests/helpers/nativeV2Mocks.ts`, `ai/training/evaluate_checkpoint.py`, `docs/v2/{MOBILE_DEPLOYMENT,KNOWN_LIMITATIONS,TESTING,RELEASE_CHECKLIST}.md`, `astra.md`.

## 2026-11-19 — ARM64 APK built for the first time; base-model artifact verified; device proof still open

Continued the same checkout on branch `feature/closiq-v2-local-ai` (five Codex commits `b060ff1`, `3c4a283`, `04360ba`, `de3e284`, `db75bc2` plus all uncommitted edits preserved; parent checkout `../` is still V1 on `main`). Repeated the full verification suite on the dirty tree, fixed the real Kotlin/Gradle failures that had blocked every earlier native build, and produced an installable arm64 APK. Nothing was run on a phone.

**Deliverable:** `builds/CLOSIQ-V2-2.0.0-arm64-release.apk` — 60,417,798 bytes, SHA-256 `79d40430983c59fc6857379d4af3dcf30ab932e2ba6e8d8a37bd7d09ba90e10e`, package `com.closiq.app.v2`, versionCode 1, versionName 2.0.0, minSdk 24, targetSdk 36, arm64-v8a only, signed with the Expo template's local debug certificate, `allowBackup=false`, Hermes bundle `assets/index.android.bundle` embedded (no Metro needed), `lib/arm64-v8a/liblitertlm_jni.so` (22.7 MB) bundled and `app.closiq.vision.ClosiqVisionModule` present in the generated `ExpoModulesPackageList` and in `classes.dex`.

### Why the native build had never succeeded

Four separate failures, each fixed at its real cause (not by skipping the step):

| Failure | Cause | Fix |
| --- | --- | --- |
| `NDK not configured. Preferred NDK version is '27.0.12077973'` | Only NDK 28.2.13676358 is installed and `~/Library/Android/sdk` is not writable, so `sdkmanager` cannot add 27.x. AGP's own default applies to library modules that never read `rootProject.ext.ndkVersion`. | New checked-in config plugin sets `ndkVersion` in `ext` **and** on every `com.android.library` / `com.android.application` subproject. |
| `Failed to find Build Tools revision 35.0.0` | Expo's root project defaults to Build Tools 35.0.0; `@react-native-community/datetimepicker` never reads `rootProject.ext.buildToolsVersion`, so it fell back to the AGP default. | Same plugin pins `buildToolsVersion` for the root project and every subproject. |
| `'android.defaultConfig.versionName' is not defined` in `:closiq-vision` | The local Expo module had no `defaultConfig`, which `MavenPublicationExtension` requires. | `mobile/modules/closiq-vision/android/build.gradle` now declares `version 2.0.0`, `versionCode 1`, `versionName '2.0.0'`, matching the installed-module convention. |
| `Class 'com.google.ai.edge.litertlm.Engine' was compiled with an incompatible version of Kotlin … metadata 2.4.0, compiler reads up to 2.2.0` | LiteRT-LM 0.19.1 is published with Kotlin 2.4 metadata and pulls `kotlin-stdlib:2.4.0` into the whole app (0.16→0.19.1 all do, so downgrading does not help), while Expo 57/RN 0.86 compile with Kotlin 2.1.20. The `expo` aggregator module compiles against it, so a module-only flag is not enough. | `-Xskip-metadata-version-check` for every Kotlin subproject via the same plugin; the 2.4 stdlib is what ships in the APK regardless. Remove once the toolchain reaches Kotlin 2.4+. |

Two host constraints also mattered and are documented rather than hidden: `~/.gradle` is not writable here, so the build used `GRADLE_USER_HOME=mobile/.gradle-home` (git-ignored, ~3 GB of dependencies); and the Kotlin compile daemon cannot start (temp files outside the workspace), so builds pass `-Pkotlin.compiler.execution.strategy=in-process`. The template's default `-Xmx2048m` was also too small — Kotlin compilation failed with "Not enough memory" until raised to `-Xmx6g -XX:MaxMetaspaceSize=1536m`.

### Verified on this Mac

| Check | Result |
| --- | --- |
| Root `npm run typecheck` (shared web/mobile) | Pass |
| Mobile `tsc -p tsconfig.json` | Pass |
| Mobile tests (`npm test`, real SQLite + model-output validation) | 170/170 pass |
| Server tests (`npm run test:server`) | 16/16 pass |
| `npm run lint` (oxlint) | 0 errors, 6 pre-existing warnings |
| `npm run check:release-env` | OK — offline mobile release configuration passed |
| `npx expo export -p android` | Pass — 1 Hermes bundle, 4.9 MB |
| `npx expo prebuild --platform android` | Pass — autolinking finds `closiq-vision`; manifest `allowBackup=false`, no `RECORD_AUDIO` |
| `:app:assembleRelease -PreactNativeArchitectures=arm64-v8a` | **BUILD SUCCESSFUL**, 659 tasks, APK 60.4 MB |
| Published base artifact `litert-community/SmolVLM2-500M@307bf6d…` | **363,085,824 bytes and SHA-256 `7b432bbc…f74e` confirmed by streaming and hashing the revision-pinned file** — matches `mobile/src/local/model.ts` and the Kotlin installer constants |

The Kotlin bridge now also compiles against the real LiteRT-LM 0.19.1 API, which previously could not be checked: `Engine`, `EngineConfig(modelPath, backend, visionBackend, maxNumTokens, maxNumImages, cacheDir)`, `Backend.CPU()/GPU()`, `Content.ImageFile`, `Contents.of`, `Conversation.sendMessageAsync`, `cancelProcess`, `Debug.getPss`, `Os.rename`. Compilation is evidence the symbols exist; it is not evidence they work on a phone.

### Still open — needs the physical phone

No Android device was attached (`adb devices` empty) and the local AVD cannot run (`~/.android` is not writable in this environment). So there is **no** device answer, initialization time, inference time, PSS, CPU-vs-GPU comparison or airplane-mode result. `docs/v2/MOBILE_DEPLOYMENT.md` starts with the shortest exact procedure; record phone model, SoC, Android version, RAM, ABI, free space, backend, the model's actual text, Init/Inference/PSS. Outfit generation and swaps on device, photo persistence after restart, saved looks, planner, export/restore and the optional V1 import are likewise code-reviewed only — the SQLite and engine logic are covered by host tests, not by the phone.

Code review of the local paths (unchanged behaviour, no edits needed): native startup selects the local guest identity and never calls Supabase; `sessionLifecycle` lazy-loads the legacy auth client only for the explicit import; `fetchCurrentWeather()` on native returns cached data unless `forceRefresh` is true, so no weather request happens on screen mount; `updates.enabled=false` disables OTA; `visionAnalysis.native`, `outfitStylist.native` and `StylingChat` use only `local/model.ts` with `file://` photos; the model may only pick an offered index over owned garments and validation rejects invented IDs and unexpected fields; photos are stored as UUID filenames in the app documents directory and only referenced by name, so garment photos and prompts never leave the phone. No Gemini call exists on any native core path (`gemini` survives only as a legacy union member in `OutfitResultCard` labels).

### Training

Unchanged and still gated: 20 text-only ranking records (14/4/2 split), zero rights-reviewed garment photos, no LoRA run, no checkpoint, no exported custom model. The published base stays labelled `SmolVLM2-500M · base`; `CLOSIQ-VLM-500M` remains reserved and has no weights. Base inference on Android must be proven before any training work resumes.

### Remote and housekeeping

GitHub was reachable this session, so the reviewed milestone was committed as `04dcd42` on `feature/closiq-v2-local-ai` together with the previously uncommitted Codex working tree, and pushed: `origin/feature/closiq-v2-local-ai` now tracks it. `main` on the remote is unchanged at `7767584`, and the parent V1 checkout was not touched (still on `main`). After the build the git-ignored `mobile/.gradle-home` (3.2 GB) and `mobile/android/` (746 MB) were deleted, because the development Mac runs at about 1% free disk; the APK is preserved in `builds/` and the first rebuild re-downloads about 2 GB of Gradle dependencies.

### Files changed in this milestone
- `mobile/modules/closiq-vision/android/build.gradle` — module identity, `defaultConfig`, LiteRT-LM metadata flag.
- `mobile/plugins/with-android-build-compat.js` — new config plugin (NDK/Build Tools pinning, Kotlin metadata relaxation).
- `mobile/app.json` — registers that plugin.
- `mobile/.gitignore` — ignores the local `.gradle-home`.
- `.gitignore` — ignores `builds/` (local APK artifacts).
- `docs/v2/MOBILE_DEPLOYMENT.md` — rewritten around the commands that actually build, the exact APK, and the shortest phone procedure.
- `docs/v2/MODEL_CARD.md`, `docs/v2/KNOWN_LIMITATIONS.md`, `docs/v2/RELEASE_CHECKLIST.md`, `docs/v2/TESTING.md` — evidence updated (checksum verified; APK compiled but not installed).
- `astra.md` — this entry.

Nothing in `src/`, `server/`, `api/`, `supabase/` or V1's checkout was modified, so V1 behaviour and V2's product code are untouched by this milestone.

## 2026-11-19 — Work stopped at the owner's request. Android handoff for DeepSeek V4.1 Flash 1017

**Resume in `CLOSIQ-v2/` inside the original CLOSIQ folder.** Inside that nested checkout the current branch is `feature/closiq-v2-local-ai`, based on V1 commit `7767584`. The outer checkout is still on `main`. The original repository's Git references were read-only in this session, so the feature branch lives in a separate local clone. An earlier push to GitHub failed to resolve github.com. All five V2 commits are local. Additional uncommitted edits and new files are essential. A fresh remote clone or checking out the last commit alone will miss work. No V2 release, APK, trained weights or production database changes were delivered.

### Work by milestone

| Milestone | State at stop |
| --- | --- |
| 0. Protect and audit | Inspected V1 auth, photos, Gemini routes, weather, wardrobe caches, planner, shared recommendations, Expo config, server tests and migrations. Wrote the architecture audit. Web/server V1 sources and production data were preserved. |
| 1. Mac base inference | Added the Python environment inspector, pinned dependencies and base download, local image inference and timing/RSS reporting. Created a private ignored Python 3.11 environment. Host reported macOS 27.0.1, arm64, 25,769,803,776 bytes of memory. DNS blocked pip and the base weights. No caption, timing or memory benchmark from a real model. |
| 2. Physical model runtime | Initially added a Swift runtime and XcodeGen photo benchmark under the original brief. The owner then changed device acceptance to **Android only**. Added Kotlin LiteRT-LM with real image-file messages, fresh conversations, checksum/size verification, private model files, atomic replacement, cancellation, unload, and benchmark controls. Expo recognized the Android module. Native compilation and actual inference still need proof. No iPhone test is required. |
| 3. Local data | V2 uses a distinct app identity, a guest mode, SQLite schema version 1, per-wardrobe records, relative app-owned photos, saved outfit snapshots, preferences, feedback, history and planner. Added folder export/merge restore and an explicit, resumable V1 account import for garments, uploaded photos, saved looks and planner events. Cloud-only catalog photos, profile preferences and separate feedback/history records have remaining import limitations. No live cloud account was used. |
| 4. Local styling | Native mobile services replace the hosted vision, outfit and swap paths. The phone validates garment output, ranks owned outfit candidates, rejects invalid model choices and can use the rule-based engine. Photo failure permits manual entry. V1 server studio cutouts are skipped for native photos. Model management distinguishes installation from initialization. Native guest mode disables automatic OTA and weather requests. Online weather refresh is explicit. The Stylist's short follow-up conversation UI exists in uncommitted edits and needs the full final build check. |
| 5. Dataset | Implemented v1 JSONL validation, rights/provenance fields, pixel hashing, deduplication, stable group-based splits and leakage checks. Prepared 20 original synthetic outfit-ranking records, split 14 train / 4 validation / 2 test. Zero rights-reviewed garment training photographs. The 500–1,000-example pilot is outstanding. |
| 6. Training and evaluation | Added MPS/PEFT LoRA training, assistant-only loss, validation, checkpoint/resume and evaluation scripts. Pilot configuration uses batch size 1, accumulation 4, 100 steps, rank 8 and seed 42. No successful base run, training smoke run, checkpoint, losses, accuracy or measured full-tuning comparison. |
| 7. Custom export | Documented the required conversion and comparison path. No custom adapter, merged checkpoint or verified mobile export. Mobile manifest identifies the published base only. |
| 8. Verification and handoff | Android prebuild and JS export succeeded earlier. Host regression and dataset checks ran. The release checklist and physical-device protocol are in docs/v2. The complete working tree still needs a final typecheck/export, native APK build, Android tests, code review and feature-branch push. |

### Model details

- Upstream development model: `HuggingFaceTB/SmolVLM2-500M-Video-Instruct`, pinned in `ai/configs/base-model.yaml` to `abf83ca8a19096fcfa511aa8e7aaaefb02753f41`.
- Mobile candidate: `litert-community/SmolVLM2-500M`, revision `307bf6d1018edd2c2d0903b92628151bdb5cc2b7`. Published file pointer lists 363,085,824 bytes and SHA-256 `7b432bbc0a5c54ba15ecb2f039a7711c1cfb1fe38badec01397a076b5043f74e`. The artifact was not downloaded or hashed on this Mac. Native installers check actual bytes when run.
- Android target uses Kotlin LiteRT-LM 0.19.1. The latest local edits add CPU/GPU benchmark selection and Android memory-pressure callbacks. Validate both against the actual dependency. Process PSS shown after a run is a point-in-time measurement. No device measurements exist yet.
- V2 app ID: `com.closiq.app.v2`. Framework: Expo SDK 57, React Native 0.86.3. Pinned `expo-sqlite@57.0.2` was in the npm cache; Expo's installed compatibility table suggests `~57.0.4`. Exercise the native binding on the target phone. The feature checkout's root node_modules is a local symlink; mobile has its own dependency directory.

### Verification and blockers

| Check | Observed result |
| --- | --- |
| Baseline `npm test` / `npm run test:server` | 165/165 mobile/shared tests and 16/16 server tests passed before V2 changes. |
| Latest `npm test` | 170/170 passed. Includes real SQLite file persistence and rollback on the host, malformed garment output, fabricated choices, grounded outfit generation, deterministic fallback, swap and restore validation. Native model responses in the host tests are controlled test inputs. |
| TypeScript / Vite | Root and mobile TypeScript and Vite production build passed at baseline. Mobile TypeScript also passed during implementation. Re-run both against the final dirty tree. Vite had pre-existing chunk-size and mixed-import warnings. |
| Android Expo | `expo prebuild --platform android --no-install --template ./node_modules/expo/template.tgz` succeeded. Generated manifest showed allowBackup=false at the last prebuild. Expo autolinking found ClosiqVision and expo-sqlite. An earlier `expo export -p android` produced a Hermes bundle (reported 4.9 MB), before the last UI and benchmark edits. This is a JS bundle size. |
| Android native build | Gradle 9.3.1 initially could not write its wrapper lock. Retried the cached distribution with writable GRADLE_USER_HOME. Gradle failed before compiling the app: FileLockContentionHandler, java.net.SocketException, Operation not permitted. ADB 1.0.41 could not open its local listener or enumerate a phone. No APK, device install or airplane-mode inference was verified. |
| Mac ML environment | Python 3.11.15 venv created. pip could not resolve the package host. A request for the pinned base weights failed to resolve huggingface.co. Benchmark exited cleanly for missing local model. |
| AI data | `prepare_dataset.py`, `split_dataset.py` and `validate_dataset.py` succeeded for the 20 text seeds. Three pipeline tests passed with temporary test images and cached Pillow 13.0.0. Pinned clean-install Pillow is 11.3.0. Python source compilation succeeded. |
| Earlier Swift work | XcodeGen generated the standalone benchmark project, Swift syntax parsed and Expo discovered the module. Swift package resolution failed on GitHub DNS. Historical only for the current Android acceptance target. |
| Remote | `git push -u origin feature/closiq-v2-local-ai` failed on GitHub DNS. No further push or release at stop. |

### Local history

| Commit | Contents |
| --- | --- |
| b060ff1 | V1 audit and handoff setup |
| 3c4a283 | Mac environment, base download and image benchmark |
| 04360ba | Swift runtime and initial standalone iPhone test target |
| de3e284 | Android native bridge, SQLite, guest mobile services, model management and tests |
| db75bc2 | Fashion-data tools, seed, LoRA configuration and evaluation scripts |

### Working tree at stop

In addition to this log, modified tracked files are `CLAUDE.md`, `README.md`, `ai/scripts/check_environment.py`, `mobile/modules/closiq-vision/android/src/main/java/app/closiq/vision/ClosiqVisionModule.kt`, `mobile/src/components/AccountPrivacySection.native.tsx`, `mobile/src/local/model.ts`, `mobile/src/screens/StylistScreen.tsx` and `mobile/tests/v2Offline.test.ts`.

New, untracked files are `mobile/src/components/StylingChat.tsx` and the following documents in `docs/v2/`: ARCHITECTURE.md, EVALUATION_REPORT.md, KNOWN_LIMITATIONS.md, MOBILE_DEPLOYMENT.md, MODEL_CARD.md, RELEASE_CHECKLIST.md, SETUP_MAC.md, TESTING.md, TRAINING_GUIDE.md and TRAINING_REPORT.md. Preserve them when moving the checkout. Generated Android project files, virtual environments, prepared splits and dependency folders are intentionally ignored. Source and generation instructions are tracked or present in the working tree.

<details>
<summary>Complete committed file inventory relative to the V2 checkout</summary>

```text
.gitignore
AGENTS.md
CLAUDE.md
ai/README.md
ai/benchmarks/iphone/.gitignore
ai/benchmarks/iphone/PhotoBench.swift
ai/benchmarks/iphone/project.yml
ai/configs/base-model.yaml
ai/configs/fashion-lora.yaml
ai/data/DATASET_CARD.md
ai/datasets/prepare_dataset.py
ai/datasets/records.py
ai/datasets/split_dataset.py
ai/datasets/styling_seed.jsonl
ai/datasets/validate_dataset.py
ai/evaluation/test_pipeline.py
ai/export/README.md
ai/inference/test_base_model.py
ai/requirements.txt
ai/scripts/check_environment.py
ai/scripts/download_base.py
ai/training/evaluate_checkpoint.py
ai/training/examples.py
ai/training/requirements.txt
ai/training/train.py
astra.md
docs/v2/ARCHITECTURE_AUDIT.md
mobile/App.tsx
mobile/app.json
mobile/modules/closiq-vision/android/build.gradle
mobile/modules/closiq-vision/android/src/main/AndroidManifest.xml
mobile/modules/closiq-vision/android/src/main/java/app/closiq/vision/ClosiqVisionModule.kt
mobile/modules/closiq-vision/expo-module.config.json
mobile/modules/closiq-vision/ios/ClosiqVision.podspec
mobile/modules/closiq-vision/ios/ClosiqVisionModule.swift
mobile/modules/closiq-vision/ios/VisionRuntime.swift
mobile/package-lock.json
mobile/package.json
mobile/scripts/validate-release-env.js
mobile/src/components/AccountPrivacySection.native.tsx
mobile/src/components/AddItemModal.tsx
mobile/src/components/OutfitResultCard.tsx
mobile/src/components/ShopCheckModal.tsx
mobile/src/local/backup.ts
mobile/src/local/cloudRows.ts
mobile/src/local/legacyImport.ts
mobile/src/local/model.ts
mobile/src/local/outfitWeather.ts
mobile/src/local/photos.ts
mobile/src/local/plannerDates.ts
mobile/src/local/records.ts
mobile/src/local/store.ts
mobile/src/local/validation.ts
mobile/src/screens/OnboardingScreen.tsx
mobile/src/screens/PlannerScreen.tsx
mobile/src/screens/ProfileScreen.tsx
mobile/src/screens/StylistScreen.tsx
mobile/src/screens/TodayScreen.tsx
mobile/src/services/accountService.native.ts
mobile/src/services/garmentImages.native.ts
mobile/src/services/imageOptimizer.ts
mobile/src/services/outfitFeedbackStorage.native.ts
mobile/src/services/outfitHistoryStorage.native.ts
mobile/src/services/outfitStylist.native.ts
mobile/src/services/outfitStylist.ts
mobile/src/services/plannerStorage.native.ts
mobile/src/services/plannerStorage.ts
mobile/src/services/profileSettingsStorage.native.ts
mobile/src/services/savedOutfitsStorage.native.ts
mobile/src/services/savedOutfitsStorage.ts
mobile/src/services/sessionLifecycle.ts
mobile/src/services/studioPhoto.native.ts
mobile/src/services/userProfileStorage.native.ts
mobile/src/services/visionAnalysis.native.ts
mobile/src/services/visionAnalysis.ts
mobile/src/services/wardrobeStorage.native.ts
mobile/src/services/wardrobeStorage.ts
mobile/src/services/weatherService.ts
mobile/tests/v2Offline.test.ts
```

</details>

### Copy-ready DeepSeek V4.1 Flash 1017 continuation prompt

```text
Continue CLOSIQ V2 from the existing local work. My only device-testing target is a physical Android phone. My Mac M4 with 24 GB RAM is the development machine.

Open /Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/CLOSIQ-v2. Confirm the branch is feature/closiq-v2-local-ai. Read astra.md first, then AGENTS.md, mobile/AGENTS.md and docs/v2/MOBILE_DEPLOYMENT.md. Inspect git status, git diff and untracked files. Five local commits and unfinished working-tree changes are part of this handoff. Preserve both. The parent checkout is V1 on main.

First milestone: produce an installable ARM64 Android APK and prove that the unmodified SmolVLM2 base model can describe a real garment photo in airplane mode. Re-run mobile TypeScript, npm test and the Android Expo export against the complete working tree. Build the Kotlin/Gradle integration, fix actual failures, and verify the full inference path from the photo picker to the native vision model. Install alongside V1. If the phone is unavailable, finish the APK and give me its path and the shortest physical test procedure. Record the actual response, device, backend, timings and memory measurement when available.

Then verify guest onboarding, SQLite and photo persistence after a restart, wardrobe-grounded outfit generation and swaps, planner, backup/restore, and optional V1 import. Keep garment photos and prompts on the phone. V1 account import and the one-time model download must remain explicit. No Gemini fallback in native core flows.

Resume fashion training only after base inference works and enough rights-reviewed garment photos exist. The 20 text-only seed examples do not establish fashion recognition. Keep base and custom model identities distinct. Preserve V1 and user data. Update astra.md after each milestone with changed files, commands, results and blockers. Push reviewed milestones only to the feature branch when GitHub is reachable.
```


## 2026-11-19 — Set up the shared change log

Created `astra.md` for handoffs, added a standing instruction in the root `AGENTS.md` for Codex to update it with each change, and linked it from the root `CLAUDE.md` so Claude can find it when starting work.
