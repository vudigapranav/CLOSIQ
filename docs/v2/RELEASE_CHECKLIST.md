# Android release status

- [x] Separate Git checkout and application ID protect V1.
- [x] Android prebuild, module discovery and JavaScript bundle export.
- [x] Host SQLite file persistence/rollback checks and native model-output validation tests.
- [x] Functional dataset preparation, provenance checks, group split and leakage test.
- [x] Native release APK compiled for arm64-v8a with the LiteRT-LM runtime bundled (2026-11-19, see MOBILE_DEPLOYMENT.md).
- [x] Independent review of the Codex and DeepSeek changes; data-integrity, backup/restore, cancellation and model-output fixes with regression tests (2026-11-19, see astra.md).
- [ ] APK installed and run on an ARM64 Android phone.
- [ ] Real garment response, CPU/GPU comparison, interruption and airplane-mode restart on that phone.
- [ ] On-device CRUD, photo persistence, user settings, planner and backup/restore regression.
- [ ] Live opt-in V1 import with authorized test account and interruption recovery.
- [ ] Base inference on the development Mac; licensed photo pilot with reviewed labels.
- [ ] Training and evaluation of an actual checkpoint; verified custom mobile export.
- [ ] APK, installed model, temporary storage, runtime memory and latency measured on target hardware.
- [ ] Release signing, Android privacy/network review, license notices and user acceptance.

No release, model upload, database mutation in production or app-store publication has taken place.
