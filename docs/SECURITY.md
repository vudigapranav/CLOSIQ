# CLOSIQ — Security & Performance Report

Audit date: 2026-11-11 (read-only audit by a security subagent, findings verified against code; fixes applied the same day).

## Summary

| Area | Before | After (2026-11-11) |
|---|---|---|
| Auth on `/api/ai/*` | Verified Supabase JWT, fail-closed | unchanged + 45 s token→user cache (failures never cached) |
| Rate limiting | none | per-user token bucket (burst 10, 20/min, studio-photo costs 3), 429 + `Retry-After`. **Best-effort: per warm Vercel instance** |
| Body size | unbounded on the Node path | 6 MB cap (header + streaming), 413 |
| Input validation | none (TypeError on missing `imageData`) | `server/validation.js`: mime allowlist, magic bytes, size, prompt ≤ 500, wardrobe ≤ 300, string caps, id regex, category enum → 400 |
| Image decoding | sharp default pixel limit (~268 MP) | `limitInputPixels: 40M` |
| Error leakage | provider `err.message` returned to clients | fixed strings + `errorKind`; details logged server-side (truncated, no bodies/tokens) |
| AI output | trusted the model's ids | server filters ids to the supplied wardrobe/non-excluded/de-duplicated; Gemini `responseSchema`; client rejects any outfit with an invented id or incoherent categories |
| Static serving | `decodeURIComponent` could throw; prefix check matched `dist-evil` | 400 on bad encoding / null byte; `DIST_DIR + path.sep` |
| Headers | none | nosniff, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy` (camera/geolocation self); immutable cache for hashed assets |
| Build-time secret guard | refused service_role JWT | also refuses `sb_secret_` keys |
| RLS | all tables owner-only; `outfit_feedback` lacked FORCE | migration `20261111064644_hardening.sql` adds FORCE (applied 2026-11-11) |
| Wear counts | client read-modify-write (lost updates across devices) | atomic RPC `record_garments_worn` with fallback |
| Account deletion | none (store requirement) | `delete_my_account()` RPC (SECURITY DEFINER, `search_path=''`, `auth.uid()` only, anon revoked) + UI on web & mobile; live since the 2026-11-11 migration |
| Data export | none | web + mobile "Download/Export my data" (user's own rows via RLS) |
| AI photo consent | none | toggle on web + mobile; when off, no photo is sent to the AI provider |

## Secrets

* Tracked files contain no Gemini keys, service-role keys, `sb_secret_` keys or JWTs (grep over `git ls-files`). Only `.env.example` files are tracked; `.env*` are gitignored.
* The web bundle receives only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`; the Gemini key is read only in `server/`.

## Open items

1. **Global rate limit** — the in-memory bucket resets on cold start and is per instance. For hard quotas use Upstash/Vercel KV or a Supabase counter table.
2. **Storage cleanup on account deletion** — `storage.objects` has no FK to `auth.users`; photos under `garment-images/<uid>/` remain after deletion until a server-side cleanup (Edge Function with service role, or scheduled job) exists.
3. **No CSP** yet — deliberately omitted to avoid breaking Supabase/Open-Meteo/Google Fonts; add one with `connect-src 'self' https://*.supabase.co https://api.open-meteo.com https://geocoding-api.open-meteo.com`.
4. **`api/keepalive`** is open when `CRON_SECRET` is unset (harmless anon read) — set the secret.
5. **Mobile dependency advisories** (`npm audit --omit=dev` in `mobile/`): 1 critical / 4 high, all in the Expo CLI toolchain (shell-quote, node-forge, brace-expansion, zod via @expo/cli) — not shipped in the app bundle. Root: 0 vulnerabilities.
6. Supabase Auth **leaked password protection** is off (advisor warning) — enable it in the dashboard.
7. `delete_my_account` is flagged by the advisor as a SECURITY DEFINER function callable by signed-in users — intentional: it must delete from `auth.users` and only ever deletes `auth.uid()`.
8. Mobile session tokens live in AsyncStorage (not SecureStore) — acceptable for Supabase's refresh-token model, worth revisiting.
9. `garments`/`saved_outfits` jsonb size limits are only partially constrained (`NOT VALID` length checks added for name/brand/tags).

## Performance

* Outfit engine: ≤ ~6×6×4×3 ≈ 430 candidates scored per request, pure TS, sub-millisecond-to-few-ms on device; no network.
* Weather: one Open-Meteo call per 30 min per place (cached; stale cache served on failure), 8 s timeout.
* AI calls: 36 s total budget, 20 s per model attempt; client scan auto-retry once.
* Web bundle: one ~635 kB (176 kB gzip) chunk — code-splitting the modals/screens is the next win (see KNOWN_ISSUES).
* Server: token cache removes a Supabase round trip on most AI requests.
