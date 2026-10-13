# CLOSIQ — Devpost Project Details

---

## 1. About the project (paste into "Project story")

## Inspiration

Every morning looks the same: a wardrobe full of clothes, and still nothing to wear. We noticed that almost every fashion app tries to fix this by selling you *more* clothes, recommending products from a catalog instead of looking at what's already in your closet.

We wanted the opposite: a stylist that never sells anything. It learns the clothes you **already own** and answers one question: *what should I wear for this, from what I have?*

## What it does

**CLOSIQ** is an AI stylist for the clothes you already own.

- **Snap a garment**: take a photo from your camera or gallery, even a messy one on a bed or floor. Gemini vision picks out the name, category, colour (with hex), fabric, fit, formality and layering role, then adds it to your digital **Collection**.
- **Ask the Stylist**: pick an occasion (interview, hackathon, date, casual day) or describe what you need. CLOSIQ builds an **Ensemble** using only your own garments and explains *why it works*: colour harmony, occasion fit and an overall style score.
- **Swap one piece**: don't like the shoes? Replace a single garment without regenerating the whole outfit.
- **Today**: a weather-aware daily look based on your location, with occasion shortcuts and recently added garments.
- **Planner**: put outfits on upcoming events, and use that context to personalise future suggestions.
- **Profile**: your Style DNA, a colour breakdown of your closet and your saved looks.

## How we built it

CLOSIQ is written entirely in **JavaScript and TypeScript**, from the phone to the server.

- **Mobile app**: Expo (SDK 57) + React Native + React 19 + TypeScript. We used `expo-image-picker` and `expo-image-manipulator` to capture and compress photos before upload, `expo-location` for weather, and AsyncStorage as an offline cache.
- **Backend**: a plain **Node.js** `http` server with no framework. It exposes three AI endpoints: `analyze-garment`, `generate-outfit` and `swap-garment`.
- **AI**: **Google Gemini** through `@google/genai`. Every Gemini call runs **server-side only**, so the API key never goes into the app bundle. Each request is checked with a Supabase bearer token before it reaches Gemini.
- **Data and auth**: **Supabase**. Postgres with row-level security gives each user access to only their own rows (garments, saved outfits, planner events, preferences). Supabase Auth handles accounts, and Supabase Storage holds garment photos behind signed URLs.
- **Weather**: **Open-Meteo** plus the phone's reverse geocoding, with the last reading cached for offline use.
- **Web companion**: our first browser prototype, built with **Vite + React**, which also serves the seed wardrobe images.

The flow looks like this:

```
Photo → compress on device → Node server (auth check) → Gemini vision
      → structured garment → Supabase (Postgres + Storage) → Collection
Occasion → Node server → Gemini reasons over *your* garment IDs → Ensemble + "why it works"
```

## Challenges we ran into

- **Real-world photos.** People don't photograph clothes on white backgrounds. We had to design the analysis to handle clutter, bad lighting and hangers. When recognition does fail, the app says so and offers manual entry instead of making up attributes.
- **Free-tier AI limits.** Gemini quota can run out halfway through a demo. We built a local, rule-based styling engine as a fallback, and the app **labels** those results so they are never passed off as AI output.
- **Keeping secrets off the phone.** Anything in an `EXPO_PUBLIC_*` variable ends up inside the app bundle. We moved every AI call behind our own server and added token verification to every request.
- **Misleading error messages.** At one point our Supabase project was paused and sign-in failed with a DNS error, but the app told users to "check your internet." We rewrote auth error handling to tell apart DNS, timeout, offline, service-down and wrong-password cases. We also found and fixed a bug where the demo button quietly created new accounts whenever sign-in failed.
- **Dependency drift.** A `supabase-js` update made our Node server crash on startup because Node 20 has no native WebSocket support. We fixed it by giving the client an explicit `ws` transport.
- **Offline vs. cloud truth.** We had to decide which copy of the data wins. Supabase is the source of truth, AsyncStorage is only a cache, and a failed cloud write is shown to the user instead of being silently dropped.

## Accomplishments that we're proud of

- The AI styles from **your real closet**, not a store catalog. Every Ensemble points back to garments you own.
- The app is **honest when things fail**: fallbacks are labelled, errors are specific, and nothing is faked.
- The API key never touches the client, and every row in the database is protected by row-level security.
- A full JS/TS stack from mobile to backend, with a test suite for the mobile services and logic.

## What we learned

- **Designing for failure is part of the product.** Honest fallbacks and clear error messages built more trust than a demo that only works on a good day.
- How to build a secure AI proxy, and why client-side environment variables are not a secret store.
- Row-level security in Postgres, signed storage URLs, and designing an offline cache that never overrides the cloud.
- How to get *structured* output from a vision model and make an LLM reason over a fixed set of IDs instead of inventing items.

## What's next for CLOSIQ

- Deploy the backend publicly so the app works away from our local network
- Test every flow end to end on physical iOS and Android devices
- Wear tracking: "you haven't worn this in 30 days"
- Packing lists for trips, built from your Collection
- A deeper **Wardrobe Report** on colour gaps, overused pieces and cost-per-wear

---

## 2. Built with (tags, 22 of 25)

Add these one at a time:

```
javascript
typescript
react
react-native
expo
node.js
vite
supabase
postgresql
supabase-auth
supabase-storage
row-level-security
google-gemini
gemini-api
generative-ai
computer-vision
open-meteo
asyncstorage
rest-api
ios
expo-image-picker
expo-location
```

---

## 3. "Try it out" links

| Label | URL |
|---|---|
| GitHub Repo | https://github.com/vudigapranav/CLOSIQ |
| Demo Video | *(add your YouTube/Drive link once recorded)* |

---

## 4. Video demo link

Once it's recorded, upload it to **YouTube** (unlisted is fine) or Vimeo; Devpost embeds those. Suggested 60–90 second path:

**Login (demo account) → Collection → Add Garment (messy photo → AI attributes) → Stylist → pick "Hackathon" → Ensemble + "why it works" → swap one piece → Save → Planner**
