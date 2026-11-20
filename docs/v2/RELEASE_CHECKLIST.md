# Android release status (V2 = update of V1)

- [x] V2 restored onto V1's accounts, cloud storage and package `com.closiq.app`; version 2.0.0 (OTA runtimes cannot cross).
- [x] No Gemini call or API key on Android: scans, outfit picks, swaps and chat use CLOSIQ AI; Android bundle contains no `/api/ai/analyze-garment|generate-outfit|swap-garment`.
- [x] Customer UI says "CLOSIQ AI" only (no "local"/"on-device" wording); diagnostics only in the demo build.
- [x] Emulator (Android 16, arm64, M4 host): model download + SHA-256 check, CPU load/answer, two photo scans, outfit pick, swap and chat with network disabled.
- [x] Native crash guard; cancel/timeout/background report "interrupted"; host tests 175/175, server tests 16/16, typecheck and lint clean.
- [ ] `eas build -p android --profile preview` (owner's Expo login) and install over V1 on a real phone; confirm sign-in, wardrobe, saved looks and planner are intact.
- [ ] On that phone: turn on CLOSIQ AI, scan 5–10 own garments, record answers, timings and memory; check a low-RAM phone if available.
- [ ] Decide whether the web app should also drop Gemini (out of V2 scope so far).
- [ ] Rights-reviewed garment photo set, then train/evaluate `CLOSIQ-VLM-500M`.

No release, store publication, production database change or model upload has taken place.
