# Ship CLOSIQ V2 to Android

V2 is an **update of the V1 app** (`com.closiq.app`, version 2.0.0): same accounts, same cloud data, CLOSIQ AI instead of Gemini on the phone. See [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. The update for existing users (your brother's phone)

Android installs an update only when it is signed with the **same key** as the installed app. V1 was built by EAS with the project's EAS-managed keystore (certificate SHA-256 `f55f7fbe…a9844`, seen on the emulator's installed V1). A build signed on a Mac with the debug key (`fac61745…033b9c`) is refused as an update. So the update must come from EAS:

```sh
cd /Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/CLOSIQ-v2/mobile
npx eas-cli login                       # your Expo account (vudigapranav)
npx eas-cli build -p android --profile preview
```

- `preview` produces an installable APK with the same keystore; `appVersionSource: remote` assigns a versionCode above V1's. Install it over V1 (open the APK link on the phone, or `adb install -r`). **Do not uninstall V1 first.** Data lives in the account anyway, but an in-place update also keeps the session.
- EAS reads `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `EXPO_PUBLIC_API_URL` from the EAS `preview` environment, as for V1. Do **not** set `EXPO_PUBLIC_CLOSIQ_AI_DEMO` there.
- The config plugin's NDK/Build Tools pins only apply where those versions are missing; on EAS they are present, so nothing is pinned.
- After updating, the user opens **Profile → CLOSIQ AI → Turn on CLOSIQ AI** (or the Home card): one 363 MB download over Wi-Fi. Until then scans fall back to manual entry and outfits to CLOSIQ's wardrobe rules.

## 2. Build on this Mac (local checks, debug-signed)

```sh
cd /Users/pranav07vudiga/Desktop/Projects/Hackathon/Demux/CLOSIQ/CLOSIQ-v2/mobile
cp ../../mobile/.env.local .env.local    # V1 public Supabase URL + anon key (git-ignored)
# set EXPO_PUBLIC_API_URL=https://closiq-liard.vercel.app in .env.local for a phone build
npm run check:release-env
ANDROID_HOME=$HOME/Library/Android/sdk npx expo prebuild --platform android --clean --no-install --template ./node_modules/expo/template.tgz
ANDROID_HOME=$HOME/Library/Android/sdk ./android/gradlew -p android \
  -Dorg.gradle.jvmargs="-Xmx3g -XX:MaxMetaspaceSize=1g" :app:assembleRelease \
  -PreactNativeArchitectures=arm64-v8a -Pkotlin.compiler.execution.strategy=in-process --max-workers=4
```

Use `-Xmx3g` while an emulator is running: with `-Xmx6g` plus a 4 GB emulator the 24 GB Mac swapped and one build took 17 minutes.

## 3. Demo build (no sign-in, nothing saved)

Same as 2, but bundle with `EXPO_PUBLIC_CLOSIQ_AI_DEMO=1` and, to install next to V1, change `applicationId` in the generated `android/app/build.gradle` to `com.closiq.app.demo`. The app opens straight into the CLOSIQ AI demo (download, photo scan, outfit pick, swap, chat on a 36-piece sample wardrobe) with timings and the model's raw answers.

## 4. Android emulator on an Apple M4 Mac

The emulator copies the M4's SME/SME2 CPU features into the guest, but the macOS hypervisor does not execute them; LiteRT-LM picks SME2 kernels and the app dies with SIGILL in `nativeCreateEngine`. Hide SME in the AVD:

```sh
echo 'kernel.parameters=arm64.nosme' >> ~/.android/avd/Medium_Phone.avd/config.ini
```

Also give the AVD 4 GB (`hw.ramSize=4096`). The emulator's network ignores airplane mode; for an offline check also run `adb shell svc wifi disable; adb shell svc data disable`. Real phones do not have this SME mismatch; the app's crash guard covers any phone where the engine cannot start.

[LiteRT-LM Android guide](https://ai.google.dev/edge/litert-lm/android) · [Published base model](https://huggingface.co/litert-community/SmolVLM2-500M)
