# Current blockers and scope

- The published base weights were verified on the development Mac on 2026-11-19 (size and SHA-256 match the pinned manifest), but no caption was generated here: the Python training environment was never installed, so Mac-side base inference is still unproven.
- The native APK now compiles (Gradle 9.3.1, Kotlin in-process, NDK 28.2, Build Tools 36.1) and bundles the LiteRT-LM runtime and the Hermes bundle. No Android phone was attached to this machine and the emulator cannot run under the restricted home directory, so install, LiteRT output, airplane-mode behaviour, timings and memory remain unverified on hardware.
- The remote feature branch push depends on GitHub credentials on the build host; it is not automated.
- Expo SDK 57 recommends expo-sqlite ~57.0.4. Version 57.0.2 was available in the local cache and is pinned for this milestone. Host SQL tests run on actual SQLite. The native bindings still need device tests.
- V1 studio background removal remains in the web/server path. Local mode saves the original optimized photo. Cloud sign-in is limited to explicit import. Import covers wardrobe, saved outfits and planner events. Historical catalog-only photos, account profile preferences, feedback and wear history outside the garment rows are not migrated by this importer.
- Restore merges missing keys and preserves existing records. Photo files referenced only by deleted snapshots may remain on disk. Backups are user-selected plaintext files and include personal wardrobe data.
- No automatic cloud sync, local notification scheduling, measured full-weight training comparison, custom export or independent security review. Native model-management UI includes the single-photo benchmark; full-device testing remains pending.
- The historical Swift proof of concept is present. Android is the only device acceptance target requested by the owner.
