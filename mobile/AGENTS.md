# Expo SDK 57

This project is on **Expo SDK 57** (upgraded from SDK 54 on 2026-09-12 at the
user's explicit request). Installed: `expo` 57.0.22, `react-native` 0.86.3,
`react` 19.2.3, `typescript` 6.0.3.

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before
writing any code.

Notes that matter when changing this app:
- New Architecture is mandatory (SDK 55+); there is no legacy-arch fallback.
- Edge-to-edge is mandatory on Android. Use `react-native-safe-area-context`
  (`SafeAreaProvider` / `SafeAreaView`), never React Native's deprecated
  `SafeAreaView`, and don't rely on `StatusBar backgroundColor`.
- `globalThis.fetch` is `expo/fetch` (SDK 56+). It does support `file://` on
  both platforms (verified in the native sources), but its `Response.blob()`
  is broken on native — use `arrayBuffer()`.
- The native launch screen is configured by the `expo-splash-screen` plugin in
  app.json; the animated in-app splash lives in `App.tsx` and is separate.
- `mobile/metro.config.js` widens `watchFolders` to the repo root so the app can
  import the shared `src/types` and `src/data`. Do not remove it.
- Node >= 22.13 is required by SDK 57.
