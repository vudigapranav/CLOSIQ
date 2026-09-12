# CLOSIQ — standalone installation without public store listings

Prepared 2026-09-12. This is a delivery plan, not evidence that builds or deployment are complete.

## Current incident

The configured Supabase hostname initially did not resolve from the Mac outside the sandbox, while supabase.com resolved. After the user completed dashboard authentication/restoration, the dashboard progressed from Coming up to Healthy. During startup the auth service briefly returned 502/500; after recovery the existing demo login returned HTTP 200, with 58 garment rows and one profile readable through the authenticated public API. No replacement database or account was created. This is LIVE VERIFIED from the Mac, not a physical-device pass.

Authentication goes directly to Supabase. AI and catalog images use the separate CLOSIQ Node backend. Fixing one endpoint does not make the other available. The current mobile API URL is a private LAN address and is unsuitable for standalone distribution.

## Android

Use the existing EAS `preview` profile: internal distribution, Android `buildType: apk`. After the release environment and QA gates pass, run `eas build --platform android --profile preview` from mobile/. Share the resulting installation link privately. Recipients permit installation from their chosen browser/file source. Preserve the signing key for future updates. No Play Store account is required for direct APK delivery.

## iPhone

Use the existing EAS `preview` profile with ad hoc signing. This requires a paid Apple Developer membership and registration of each target iPhone's UDID. Run `eas device:create`, register the intended devices, then `eas build --platform ios --profile preview`. Only devices included in the provisioning profile can install the build. Adding devices requires rebuilding or re-signing. Apple limits registered iPhones to 100 per membership year; signing/provisioning expiry also requires maintenance. This is suitable for a known tester group, not unrestricted public distribution.

Neither approach needs Expo Go or Metro after installation. Internet remains required for cloud authentication, synchronization and AI. Existing cached/manual capabilities do not constitute a complete offline product.

## Delivery gates, in order

1. Restore the existing Supabase project and verify health, existing demo login, real-user login, and email confirmation. Preserve all existing data and RLS.
2. Finish the current auth reliability repair; test rejected requests, DNS failure, timeouts, session restoration, and double taps. Verify on the actual iPhone that reported the error.
3. Select and deploy an HTTPS backend with an availability plan suitable for the intended audience. Do not purchase a hosting or Supabase plan without the user's choice. Verify catalog images and authenticated APIs without unnecessary Gemini calls.
4. Link the existing app to EAS and configure the preview environment with the verified public API URL and Supabase public variables. Keep all private keys server-side. Do not bypass the existing release environment gate.
5. Resolve native packaging checks, including the non-square icon, while retaining official branding. Confirm ownership of com.closiq.app and signing credentials.
6. Create the APK and registered-device iOS builds. Test them with Metro and the Mac backend stopped, on Wi-Fi and mobile data.
7. Observe signup, login, logout, A/B isolation, force-quit/reopen, photo upload, Saved Looks, Planner, weather, manual entry and network recovery on both platforms. Record real results separately from tests/exports.
8. Distribute only the tested build IDs. Keep a previous working build and backend rollback available. Decide how users report errors and receive updates.

## Further refinement before broader use

Address privacy disclosures and photo-processing consent; define a safe shared-demo policy; provide account/data deletion; test slow connections and expired image links; verify production monitoring and backups. Public store submission requirements are a separate later phase. Do not describe the app as production-ready until operational and device gates are closed.

References checked 2026-09-12:
- https://docs.expo.dev/build/internal-distribution/
- https://developer.apple.com/help/account/devices/devices-overview/
