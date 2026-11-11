# CLOSIQ — Environment Setup & Deployment

Names only — never commit values. `.env`, `.env.local` and `*.local` are gitignored.

## Requirements

* Node ≥ 22.13 (Expo SDK 57); the repo is tested on Node 24.
* `npm install` at the root and in `mobile/`.

## Variables

| Where | Variable | Secret? | Used by |
|---|---|---|---|
| root `.env` / Vercel | `GEMINI_API_KEY` | **yes** | `server/geminiServer.js` only |
| root `.env` / Vercel | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | no (public, RLS-protected) | `server/authVerify.js` (JWT check); also exposed to the web bundle as `VITE_SUPABASE_URL/ANON_KEY` by `vite.config.js` |
| root `.env` / Vercel | `GEMINI_MODELS` (optional) | no | model fallback order |
| root `.env` / Vercel | `GEMINI_TIMEOUT_MS` (optional) | no | total AI budget (default 36000) |
| Vercel | `CRON_SECRET` (recommended) | yes | protects `/api/keepalive` |
| `mobile/.env.local` / EAS env | `EXPO_PUBLIC_API_URL` | no | CLOSIQ API host (https in release builds) |
| `mobile/.env.local` / EAS env | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | no | mobile Supabase client |

Never put a `service_role` / `sb_secret_` key anywhere in this project — the web build and the mobile release gate both refuse it.

## Run locally

```bash
npm run dev
```
Web + `/api/ai/*` on Vite (the dev plugin uses the same `server/apiRouter.js`).

```bash
npm run build && npm run start
```
Production-like Node server on port 3000.

```bash
cd mobile && npx expo start
```
Mobile dev server; point `EXPO_PUBLIC_API_URL` at your Mac's LAN IP for a physical phone.

## Database

```bash
supabase db push
```
Applies `supabase/migrations/` to the linked project. The 2026-11-11 files are additive and idempotent (safe to re-run). Without them the apps still work (see `docs/KNOWN_ISSUES.md` #1).

## Deploy

```bash
vercel deploy --prod
```
Website + API (project `closiq`; not Git-connected — pushing to GitHub does not deploy).

```bash
cd mobile && eas update --channel preview --environment preview --message "..."
```
JS/asset-only changes to installed preview APKs (runtime 1.0.0; don't bump `version` unless shipping a new binary).

```bash
cd mobile && eas build --platform android --profile preview
```
New installable APK (needed for native/icon changes).

After deploying: `curl https://closiq-liard.vercel.app/healthz` should show `supabaseConfigured: true`, `geminiConfigured: true` and the new commit.
