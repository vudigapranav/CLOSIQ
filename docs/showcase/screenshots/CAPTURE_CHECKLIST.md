# iPhone screenshot capture checklist

No genuine CLOSIQ app screenshots exist in this repository yet. This file lists exactly what to capture and how, so the README's screenshot block can be filled with real captures rather than mockups or web renders.

**Rules for these captures**
- Native iPhone screenshots only. A screenshot of the Vite web app is a different surface — if one is ever used, it must be labeled "web prototype" in its caption and filename, never presented as the mobile app.
- Demo account only (`demo@login` / `demo@123`, the "Try Demo Account" button on the login screen). Never capture a personal account.
- No real name, real email, real location or real photos in frame.

---

## Before you start

1. **Backend running on your Mac** — from the repo root: `npm run build && npm run start`. Garment images resolve against this server, so without it the wardrobe grid shows placeholder icons.
2. **`mobile/.env.local` points at your Mac's current LAN IP** — `ipconfig getifaddr en0`, then `EXPO_PUBLIC_API_URL=http://<that IP>:3000`. Phone and Mac on the same Wi-Fi.
3. **Expo running** — `cd mobile && npx expo start`, open on the iPhone.
4. **Phone prepared**
   - Focus / Do Not Disturb **on** (Control Centre → Focus). This is the single most important step; a notification banner in a screenshot is unusable.
   - Battery above 50%, or the status bar looks anxious.
   - Brightness up, auto-lock set to 5 minutes.
   - Light mode (the app's `userInterfaceStyle` is `light`).
5. **Sign in with the demo account** and let the wardrobe finish loading before capturing anything.

**Taking a screenshot:** press Side button + Volume Up together. On Face ID iPhones the thumbnail appears bottom-left — ignore it and keep going; it does not appear in the saved file.

---

## The five captures

Capture in this order — it matches the demo flow, so you can record the walkthrough video in the same session.

### 1. `01-wardrobe.png` — Wardrobe

- **Get there:** bottom nav → **Wardrobe** tab.
- **Set up the shot:** category filter on **All**. Scroll so the grid is full — no half-row of blank space at the bottom, no empty state.
- **Wait for:** every visible garment thumbnail to have actually loaded. A shirt-icon placeholder means the image failed; fix the backend URL rather than capturing it.
- **Frame:** full screen, including the bottom nav dock so the app's structure reads.

### 2. `02-occasion.png` — Occasion selection

- **Get there:** bottom nav → **AI Stylist** tab.
- **Set up the shot:** tap an occasion chip so it is visibly selected — **Date Night Minimal** or **Smart Presentation** both read well. Leave the prompt field either empty or with a short typed prompt; do not leave a half-typed word.
- **Wait for:** the keyboard to be dismissed, so the chips and the generate button are both visible.
- **Frame:** full screen. The selected chip must be clearly distinguishable from the unselected ones.

### 3. `03-outfit.png` — Generated outfit

- **Get there:** tap generate on the Stylist screen.
- **Set up the shot:** wait for the result card. Scroll so the garment pieces **and** at least the first lines of the "why it works" rationale are both in frame — the explanation is the differentiator, so it should not be cropped out.
- **Important — label honestly:** if the result banner says the local engine was used (backend unreachable or Gemini quota exhausted), either fix the backend and regenerate, or caption the screenshot "local fallback engine" in the README. Do not present a fallback result as a Gemini result.
- **Frame:** full screen.

### 4. `04-saved-outfits.png` — Saved outfits

- **Get there:** save the outfit from shot 3, then bottom nav → **Profile** → saved looks (or wherever the saved looks list is surfaced in the current build).
- **Set up the shot:** at least two or three saved looks visible, so it reads as a collection rather than a single item. Generate and save a second look first if needed.
- **Frame:** full screen.

### 5. `05-planner.png` — Planner

- **Get there:** bottom nav → **Planner** tab.
- **Set up the shot:** at least two dated events with occasion labels, at least one with an outfit assigned from saved looks. Add them first if the demo account's planner is empty.
- **Check:** event labels must be generic ("Presentation", "Dinner"), never a real meeting name, a real person's name, or a real address.
- **Frame:** full screen.

---

## After capturing

1. AirDrop the five screenshots to the Mac.
2. Rename them exactly as above: `01-wardrobe.png`, `02-occasion.png`, `03-outfit.png`, `04-saved-outfits.png`, `05-planner.png`.
3. Save them into `docs/showcase/screenshots/`.
4. Open `README.md`, find the Screenshots section, delete the "That folder is currently empty…" paragraph, and uncomment the image table directly below it.
5. Confirm each image renders — a GitHub preview of the README is the quickest check.

---

## Optional sixth capture

`06-add-garment.png` — the Add Garment analysis result, showing Gemini's extracted attributes for a photographed item. Strong for the LinkedIn post, but it consumes Gemini quota and requires photographing a real garment, so treat it as a bonus rather than part of the core five. Photograph a garment against a neutral background with nothing personal in frame.
