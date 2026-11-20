# Current limits (2026-11-20)

- **The update must be built by EAS.** Only an APK signed with the V1 EAS keystore installs over V1 and keeps the session. Local Mac builds are debug-signed and can only be fresh installs or the side-by-side demo package.
- **The model is the published SmolVLM2-500M base, not fashion-tuned.** It names common garments and colours well in short answers (emulator: "a light blue button-down shirt", "a pair of black cargo pants") but does not fill multi-field forms, so scans ask short questions and HeyHanger derives category/colour/formality. Pattern, style and pairing notes are left empty rather than guessed. Expect misses on unusual or Indian ethnic garments, cluttered backgrounds and photos with several items; users can correct every field. A fashion-tuned `HeyHanger-VLM-500M` needs rights-reviewed garment photos first (currently zero).
- **Speed and memory are emulator numbers.** On the M4 emulator (CPU): engine load 0.66 s, one answer ≈ 5.5 s, a scan 7–9 s (2 questions), an outfit pick ≈ 7 s, app PSS 836 MiB after a test. Real phones will differ; low-RAM phones (≤ 4 GB) may struggle.
- **CPU path only for customers.** The GPU switch exists only in the demo build; it was not validated.
- **Web is unchanged.** The website and server still use Gemini; V2 scope is the Android app.
- **Offline catalog images.** Sample/catalog garment photos load from the web server and show placeholders without network; uploaded wardrobe photos follow V1's caching.
- **Android emulator on Apple M4** needs `kernel.parameters=arm64.nosme` (see MOBILE_DEPLOYMENT.md). On any device where the engine still cannot start, the crash guard pauses HeyHanger.ai instead of crash-looping.
- Not verified on a physical phone yet; no live account was used in testing (sign-in requires the owner's password).
