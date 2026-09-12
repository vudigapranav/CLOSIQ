# CLOSIQ — 45–60 second demo walkthrough

**Status: script only. No video has been recorded.** This document is the plan for a recording you run yourself on your iPhone.

**Flow:** Wardrobe → choose occasion → outfit result → save outfit → Planner
**Target length:** 55 seconds (45s floor, 60s ceiling)
**Format:** iPhone screen recording, portrait, no face cam

---

## Before recording

Everything in [`screenshots/CAPTURE_CHECKLIST.md`](screenshots/CAPTURE_CHECKLIST.md) under "Before you start" applies here too — backend running, LAN IP correct, Expo open, demo account signed in. Plus:

- **Rehearse the flow twice without recording.** The taps need to look decided, not exploratory. A hesitant tap costs two seconds you do not have.
- **Pre-generate the outfit once before recording.** Generation takes a few seconds and may hit the Gemini free-tier quota. Knowing it works — and that you are not about to burn your last request on camera — is worth one dry run.
- **If Gemini quota is exhausted**, the app will label the result as coming from its local engine. Either wait for quota to reset, or leave the label visible and say so in the narration. Do not crop or edit the label out.
- **Pre-populate the Planner** with two generic events, so shot 5 is not an empty state.

---

## Timed shot list

| # | Time | Screen | Exact actions |
| --- | --- | --- | --- |
| 1 | 0:00 – 0:09 | **Wardrobe** | Start already on the Wardrobe tab, grid loaded, filter on "All". Hold still for 2s. Slowly scroll down one screen height (about 2s), pause 1s, scroll back up. Tap one garment to open its detail sheet, hold 2s, dismiss. |
| 2 | 0:09 – 0:20 | **AI Stylist** | Tap the **AI Stylist** tab. Hold 1s on the empty state. Tap the occasion chip **Smart Presentation** — pause 1s so the selection is visibly registered. Tap generate. |
| 3 | 0:20 – 0:36 | **Outfit result** | Let the loading state play (do not cut it — it shows the work is real). When the result card appears, hold 3s on the garment pieces. Scroll slowly to the "why it works" rationale and hold 4s — this is the longest hold in the video, on purpose. |
| 4 | 0:36 – 0:45 | **Save** | Tap save. Hold 1s on the confirmation. Navigate to the saved looks list, hold 3s showing the new look alongside the existing ones. |
| 5 | 0:45 – 0:55 | **Planner** | Tap the **Planner** tab. Hold 2s on the week. Open one event that has an outfit assigned, hold 3s. Dismiss. End on the Planner overview, held still for the final 2s. |

**Total: 55 seconds.** If you overrun, shorten shot 1 (the garment detail sheet is the most expendable beat). Never shorten shot 3.

---

## Voiceover narration

Written to be read at an unhurried pace. Roughly 110 words — comfortable for 55 seconds with natural pauses.

> **(0:00)** "This is CLOSIQ. Every item here is something I actually own — photographed, and read by AI into colour, fabric, fit and formality."
>
> **(0:09)** "So instead of asking an app what to buy, I ask it what to wear. I pick the occasion — smart presentation."
>
> **(0:20)** "It builds the outfit from my own wardrobe. And it tells me why it works: how the colours sit together, why it fits the occasion. That explanation is the part I actually care about — it's the difference between a suggestion and advice."
>
> **(0:36)** "I save the look…"
>
> **(0:45)** "…and drop it onto the day I need it. That's CLOSIQ."

If recording without voiceover, the captions below carry the whole story on their own.

---

## On-screen captions

Keep them short, high-contrast, and positioned in the upper third so they never sit over the bottom nav dock.

| Time | Caption |
| --- | --- |
| 0:00 | Your real wardrobe, understood by AI |
| 0:05 | Colour · fabric · fit · formality — extracted from a photo |
| 0:11 | Pick the occasion |
| 0:22 | Outfit built from clothes you already own |
| 0:30 | …and it explains why it works |
| 0:38 | Save the look |
| 0:47 | Plan it into your week |
| 0:53 | CLOSIQ — working prototype |

That last caption matters. The post describes this as a prototype; the video should not quietly imply otherwise.

---

## iPhone screen-recording instructions

**One-time setup**
1. Settings → Control Centre → add **Screen Recording** to the included controls.

**Recording**
1. Swipe down from the top-right to open Control Centre.
2. **Long-press** the Screen Recording button (do not just tap it).
3. Make sure **Microphone is off** — record the voiceover separately in a quiet room and lay it over the video. Phone-mic audio captured through Control Centre is noticeably worse, and a mistake in narration forces a re-record of the whole flow.
4. Tap **Start Recording**, wait out the 3-second countdown, then **wait another 2 seconds before your first tap** — it gives you clean footage to trim from.
5. Run the flow.
6. Stop via the red status-bar indicator → Stop. The recording saves to Photos.

**Editing**
- Trim the head (Control Centre dismissal) and tail (the stop tap) in Photos, or in any editor you prefer.
- Add captions and voiceover in iMovie, CapCut, or similar.
- Export at 1080×1920 or the native recording resolution. LinkedIn accepts portrait video; do not letterbox it into landscape.

---

## Privacy and cleanliness checklist

Run through this **before** hitting record, not after.

- [ ] **Focus / Do Not Disturb is ON.** A banner mid-recording means starting over.
- [ ] Signed into the **demo account**, not a personal one.
- [ ] No real name visible anywhere — check the Today greeting and the Profile screen especially.
- [ ] No real email visible — check Profile and any account section.
- [ ] Planner events use generic labels ("Presentation", "Dinner"), no real meeting names, people or addresses.
- [ ] No real location shown — if the weather card names your actual neighbourhood, either accept the city-level label or deny location for the recording.
- [ ] No personal photos in the wardrobe — demo/seed garments only.
- [ ] Battery above 50%; carrier name and Wi-Fi name are not sensitive, but glance at the status bar anyway.
- [ ] Screen brightness up; light mode.
- [ ] Nothing in the recording shows a LAN IP, an API key, a `.env` file, or a terminal window.
- [ ] Watch the finished recording once, at full size, before posting it anywhere.
