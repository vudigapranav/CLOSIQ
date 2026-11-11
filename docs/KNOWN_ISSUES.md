# CLOSIQ — Known Issues & Limitations

Last updated: 2026-11-11. Ordered by impact.

## Needs the project owner (cannot be done by code alone)

1. **Migrations are applied to production (2026-11-11)** — `20261111054834_wardrobe_intelligence` and `20261111064644_hardening` are live on project `wibinjtekmadwtbxygrd`. Laundry status, purchase info, pattern, collections, AI-photo consent, weather city, atomic wear counts and account deletion now persist. Still to do in the Supabase dashboard: turn on **Auth → Leaked password protection** (security advisor warning).
2. **Supabase Auth redirect URLs** — password-reset emails (web and the new mobile "Forgot password?") link to `https://closiq-liard.vercel.app/`; that URL must be in Auth → URL configuration (Site URL + redirect allow-list), and custom SMTP is needed for non-team recipients.
3. **Not deployed** — none of the 2026-11-11 work is on Vercel or in an OTA update/APK yet. Web: `vercel deploy --prod`. Phone: `eas update --channel preview` (JS only) — no native change was made, runtime stays 1.0.0.
4. **No device verification** — the Android APK has been built in the past but the 2026-11-11 changes have only been verified by type checks, unit tests and an Android JS bundle export. Install on a phone before release.

## Product gaps

5. Storage photos are not removed when an account is deleted (no server-side cleanup with a service role yet).
6. Calendar integration is export-only (`.ics` download / share); no two-way sync with Google/Apple calendars.
7. Weather on the web needs the user to set a city or tap "Use my location" (no automatic IP location, by design).
8. The AI scan cannot judge fit, fabric quality or brand from a photo — and is instructed not to guess; users fill these in.
9. Mobile purchase date is a plain `YYYY-MM` text field (no month picker).
10. With AI photo analysis off, the mobile Add Item manual screen still shows the heading "Couldn't analyze this photo" above the explanation.
11. Collections that differ only by letter case are separate facets.
12. Notifications/reminders: not implemented (no push backend).

## Engineering debt

13. Rate limiting is per warm serverless instance, not global (see `docs/SECURITY.md`).
14. Web bundle is a single ~635 kB chunk (Vite warns); lazy-load modals/screens.
15. Very large screen components (web Today/Stylist/Profile, mobile Today/Profile 700–900 lines).
16. Mobile uses its own `MobileOutfitResult` shape instead of the shared `Outfit` type; the conversion happens in each screen.
17. Mobile toolchain advisories (`npm audit` in `mobile/`): critical/high in Expo CLI dev dependencies only — resolve with the next Expo patch upgrade.
18. Web accessibility is uneven: icon-only buttons in some screens lack `aria-label`s; mobile `accessibilityLabel` coverage is sparse.
19. `scripts/` and older docs (`DEPLOYMENT.md`, `RELEASE_CHECKLIST.md`) predate Vercel hosting in places — `STATE.md` is the source of truth for what is live.
20. No browser end-to-end test suite (Playwright) and no RLS tests against a real database.
