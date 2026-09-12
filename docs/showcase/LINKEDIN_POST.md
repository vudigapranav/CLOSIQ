# LinkedIn post — CLOSIQ (final, ready to post)

**Repo URL:** `https://github.com/vudigapranav/CLOSIQ` — verified as the configured `origin` remote and reachable. Confirm it is public before posting; a link to a private repo is worse than no link.

**Verified in the iOS Simulator (12 Sep 2026):** Expo SDK 57.0.0, app version 1.0.0, running on iPhone 17 Pro / iOS 26.5 via Expo Go. Demo account signs in and loads a 36-item wardrobe with real garment images. Figures in the post below match that session.

---

## THE POST — copy from here

I own 36 pieces of clothing and still spent every morning staring at my wardrobe with no idea what to wear.

Every app I found wanted to fix that by selling me something new. None of them knew what was already in my cupboard.

So I built CLOSIQ — an AI stylist for the clothes you already own.

Here's the whole loop:

**1. Your wardrobe, digitised**
You photograph a garment and a vision model reads it into structured attributes — colour, fabric, fit, formality, how it layers. Not "a shirt". A light blue poplin shirt, smart casual, cotton, primary layer. That's what makes the rest possible.

**2. Tell it the occasion**
College, work, date, party, casual, travel — or just type what you need in your own words.

**3. It builds the outfit from your actual items**
Not a catalogue. Your clothes. With a style score and, more importantly, a "why it works" explanation — how the colours sit together, why it fits the occasion. You can swap a single piece without regenerating the whole look.

**4. Save what you like**
The looks that work get kept.

**5. Plan the week**
Drop saved outfits onto the days you need them, so the decision is already made before the morning happens.

The explanation turned out to be the hard part, and the part I care about most. A suggestion you can't interrogate is just a guess with confidence behind it. An explanation you can disagree with is advice.

**Built with:** React Native + Expo (SDK 57), TypeScript, a Node backend that proxies Google Gemini, and Supabase for auth, Postgres and storage. The Gemini key never touches the client — every AI call goes through the backend, and when the backend or the quota is unavailable the app falls back to a local deterministic engine and tells you that's what happened, instead of pretending the AI answered.

Where it honestly stands: this is a working prototype, not a product. No deployed backend yet — it runs against a local server, and only part of the flow has been verified on a physical device. I'm sharing it because the loop works end to end, not because it's finished.

Two things I'd like input on:

1. The garment schema — I extract colour, fabric, fit, formality and layering role. If you've built anything in this space, what am I missing that would actually improve outfit quality?
2. Getting a model to justify a styling choice without sliding into generic flattery. If you've solved a version of this, I'd like to hear how.

Code: https://github.com/vudigapranav/CLOSIQ

#ReactNative #AI #MobileDevelopment #BuildInPublic

## — copy to here

---

## Screenshot order and captions

Post them in this order — it matches the numbered loop in the post, so the images and the text read together.

| # | Screen | Alt text / caption |
| --- | --- | --- |
| 1 | Wardrobe | CLOSIQ wardrobe — 36 catalogued garments with colour, category and formality read from photos by AI |
| 2 | Occasion selection | Choosing an occasion, or describing the need in your own words |
| 3 | Outfit result | A generated outfit built from the user's own garments, with the "why it works" rationale |
| 4 | Saved outfits | Saved looks kept for reuse |
| 5 | Planner | Saved outfits assigned to days of the week |

**LinkedIn caps image posts at 20 images**, so five is fine. Write the alt text — it takes thirty seconds and the accessibility signal is real.

**On shot 3:** if the outfit in your screenshot came from the local fallback engine rather than Gemini (the app labels this on screen), either recapture with the backend running, or leave the label visible. Do not crop it out — the post explicitly claims the app is honest about that distinction.

---

## Before you hit post

- [ ] Repo is public, and the link opens in a private browser window
- [ ] README renders with the screenshots (uncomment the image table once files are in `docs/showcase/screenshots/`)
- [ ] No real name, email, location or personal photos in any screenshot — demo account only
- [ ] No LAN IP, `.env` contents, API key or terminal window visible in any image
- [ ] Alt text written on all five images
- [ ] Post between roughly 9–11am on a weekday for reach

---

## If you want it shorter

Cut the numbered 1–5 section down to a single line each, and drop the "Built with" paragraph to one sentence. That takes it to about 180 words. Keep the hook, the prototype paragraph, the two questions and the link — those four are what make it a post rather than an announcement.
