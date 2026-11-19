# CLOSIQ handoff for Claude

Codex records its changes here, newest first.

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
