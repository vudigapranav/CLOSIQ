/**
 * CLOSIQ Mobile API Configuration
 *
 * ONE centralized backend base URL for the whole app — every service file
 * (`visionAnalysis.ts`, `outfitStylist.ts`) imports API_BASE_URL from here
 * rather than constructing its own host string.
 *
 * Resolution order:
 * 1. `EXPO_PUBLIC_API_URL` — Expo inlines any `EXPO_PUBLIC_*` var into the
 *    client bundle at build time (from `mobile/.env.local` in dev, or from
 *    `eas.json`'s per-profile `env` block for preview/production builds —
 *    see mobile/.env.example). This is the ONLY thing that should ever
 *    change between dev/preview/production; nothing else in this file does.
 * 2. Dev fallback (`__DEV__` true, no env var set): localhost — works in the
 *    iOS Simulator and Expo web, but NOT a physical device on Wi-Fi, since
 *    "localhost" on a phone means the phone itself. A physical device MUST
 *    set EXPO_PUBLIC_API_URL to the dev machine's LAN IP (mobile/.env.example).
 * 3. Production fallback (`__DEV__` false, no env var set): no public
 *    backend is deployed yet (see STATE.md, Mobile Sprint M9). This
 *    placeholder is intentionally unreachable — every API call in
 *    `visionAnalysis.ts`/`outfitStylist.ts` is already wrapped in try/catch
 *    and degrades to its local deterministic fallback engine on failure, so
 *    an unreachable URL here fails safely rather than crashing. Replace via
 *    eas.json once a real backend is deployed — never hardcode it here.
 *
 * The mobile app must NEVER read or reference GEMINI_API_KEY /
 * VITE_GEMINI_API_KEY — Gemini is called exclusively server-side
 * (server/geminiServer.js). This file only ever holds a public HTTP origin.
 */
const DEV_FALLBACK_URL = 'http://localhost:3000';
const PROD_UNCONFIGURED_URL = 'https://closiq-backend-not-yet-deployed.invalid';

const configuredUrl = process.env.EXPO_PUBLIC_API_URL;

export const API_BASE_URL = configuredUrl || (__DEV__ ? DEV_FALLBACK_URL : PROD_UNCONFIGURED_URL);

if (__DEV__ && !configuredUrl) {
  console.warn(
    '[CLOSIQ] EXPO_PUBLIC_API_URL is not set — falling back to',
    DEV_FALLBACK_URL,
    '(only reachable from the iOS Simulator or Expo web, not a physical device). ' +
      "For a physical device on the same Wi-Fi, set EXPO_PUBLIC_API_URL to your computer's LAN IP " +
      'in mobile/.env.local — see mobile/.env.example.'
  );
}
