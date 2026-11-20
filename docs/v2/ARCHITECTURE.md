# HeyHanger V2 mobile architecture

**V2 is an update of the V1 Android app** (decided by the owner on 2026-11-19, replacing the earlier guest/offline design). Same package `com.closiq.app`, same Supabase accounts, same cloud wardrobe, saved looks, planner and profile, same photo storage. Existing V1 users, after updating, sign in as before and keep everything. App version is `2.0.0`, so with `runtimeVersion.policy = appVersion` a V1 OTA bundle (runtime 1.0.0) can never land on the V2 binary and vice versa.

The only product change: **on Android, no Gemini call and no API key.** Garment photo scans, Shop Check scans, outfit picks, swaps and the Stylist chat use **HeyHanger.ai**, the published SmolVLM2-500M model running in the app through LiteRT-LM (`mobile/modules/heyhanger-vision`). Customers see only "HeyHanger.ai"; model names and diagnostics appear only in the demo build.

| Feature | V1 (Android) | V2 (Android) |
| --- | --- | --- |
| Sign-in, wardrobe, saved looks, planner, profile | Supabase + AsyncStorage cache | unchanged |
| Garment / Shop Check photo scan | `/api/ai/analyze-garment` → Gemini | `visionAnalysis.native.ts` → HeyHanger.ai |
| Outfit generation | `/api/ai/generate-outfit` → Gemini, rules fallback | `outfitStylist.native.ts`: rules build up to 3 owned outfits, HeyHanger.ai picks one by number |
| Swap | `/api/ai/swap-garment` → Gemini | rules (`rankSwapCandidates`) |
| Studio white-background photo | `/api/ai/studio-photo` (U²-Net on the server, no Gemini) | unchanged |
| Weather | Open-Meteo | unchanged |
| Web app and server | Gemini | unchanged (V2 scope is the Android app) |

Metro resolves `X.native.ts` before `X.ts` on Android, so the two `.native.ts` AI services replace the Gemini clients only in the phone build; the exported Android bundle contains none of the Gemini endpoints.

## HeyHanger.ai on the phone

- **Install.** Profile → HeyHanger.ai (and a Home card until installed): one 363 MB download of the revision-pinned file; Kotlin checks size and SHA-256 before an atomic rename into `noBackupFilesDir`.
- **Questions, not forms.** The 500M base model answers one short question reliably but does not fill multi-field forms. A scan asks "What is this garment and what colour is it?", adds "What type of clothing is this?" / "main colour?" only when the name lacks them, and asks "casual, smart casual, formal or evening?". `local/validation.ts` derives category, colour and formality from the answers and accepts only the app's allowed values. An outfit pick asks for "the number only" from the rule-built options and then one "why" sentence; any number not offered falls back to the rules. Model text never supplies garment IDs.
- **Lifecycle.** Single-flight inference with a 60 s timeout; cancel, timeout or app backgrounding reports "interrupted" (`GenerationCancelled`) instead of partial text. Kotlin caps an answer at 700 characters and returns the text so far. The engine is released on background or memory pressure.
- **Crash guard.** A marker file is written before the native engine starts and removed afterwards. If the process dies inside the engine (for example SIGILL on an unsupported CPU path), status becomes `failed`, scans fall back to manual entry and outfits to rules, and Profile offers "Try starting it again".
- **Demo build.** `EXPO_PUBLIC_HEYHANGER_AI_DEMO=1` at bundle time makes `index.ts` open `src/demo/AiDemoApp.tsx`: HeyHanger.ai on a sample catalog wardrobe with no sign-in and no storage, plus diagnostics. Normal builds never load it.

Research and training run separately under `ai/`. `HeyHanger-VLM-500M` (a fashion-tuned checkpoint) remains planned; the shipped model is the published base.
