# CLOSIQ — Product Roadmap

Vision: **your personal wardrobe intelligence system** — style what you already own. Not a store, not a feed.

## Problems we solve → where in the product

| Problem | Feature | Status (2026-11-11) |
|---|---|---|
| Forgetting what you own | Digital wardrobe, smart search, filters, "where it's kept", collections | Shipped; collections new |
| Wearing the same combinations | Outfit brain (no repeats, dislikes never return), rotation factor, least-used insights | Shipped; rotation + insights new |
| Choosing for weather & occasions | Weather-aware Home + Stylist (web now real), occasion engine, event planner | Web weather + web events new |
| Buying duplicates | Shop Check (near-twins, gap-filling, verdict) | Shipped |
| Time wasted deciding | Daily outfit, "Wear this", alternatives, swaps | Shipped; explainable rule scores new |
| Not knowing how to combine | "Pairs well with", Why-it-works from computed factors | Shipped; computed explanations new |
| No personalisation | Style DNA from owned + liked/worn looks, style preferences in scoring | Shipped; preferences now scored |

## Next (P0 — release)

1. Apply the 2026-11-11 migrations; configure Auth redirect URLs + SMTP.
2. Deploy web (Vercel) and publish an OTA update; install the APK on a real Android phone and run the manual QA checklist (`docs/TESTING.md`).
3. Server-side storage cleanup for account deletion (Edge Function, service role server-only).

## Soon (P1)

* Global rate limit / quota store (KV or Supabase table) and a CSP.
* Lazy-load web screens/modals; split the largest screen components.
* Shared `Outfit` type end-to-end on mobile (drop `MobileOutfitResult`).
* Recommendation evaluation: grow `mobile/tests/outfitEngine.test.ts` into a labelled evaluation set (occasion × weather × wardrobe → acceptable looks) and track precision@3 and dislike rate from `outfit_feedback` over time.
* Feed the engine's pre-ranked shortlist to the AI so the model chooses among valid candidates (cheaper prompts, fewer rejections).
* Accessibility pass (labels, focus order, contrast in dark mode).

## Later (P2)

* Two-way calendar sync (Google / Apple) for events.
* Wardrobe reminders (push): laundry back, unworn pieces, event tomorrow.
* Packing lists for trips from planner events + forecast.
* Cost-per-wear only if the user enters prices themselves (no shopping, no store links).
* iOS release (EAS submit config, privacy manifest).
