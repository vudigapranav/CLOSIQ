/**
 * Mobile-only Planner/Events types. Deliberately separate from the web app's
 * `WeeklyPlanEntry`/`WeekDay` (src/types/wardrobe.ts) — that's a fixed
 * Mon-Sun row model with no title/time/notes, and this sprint's brief asks
 * for real dated events instead. Not added to the shared web types file
 * since the web app has no concept of an "event."
 *
 * `Outfit` is reused as-is (src/types/wardrobe.ts) — an event just carries
 * one as an optional field, the same way the web Planner already embeds an
 * `Outfit` directly on a `WeeklyPlanEntry` rather than only a reference id.
 */
import { Outfit } from '../../../src/types/wardrobe';

/** date: local calendar date "YYYY-MM-DD". time: local 24h clock "HH:mm".
 *  Never stored as a UTC ISO timestamp — see plannerStorage.ts's date helpers
 *  for why (new Date("YYYY-MM-DD") parses as UTC midnight and can render as
 *  the previous day in negative-UTC-offset timezones). */
export interface PlannerEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  occasion: string;
  notes?: string;
  createdAt: string;
  outfit?: Outfit;
}

/** Reuses the exact occasion vocabulary already shown as chips on Today/Stylist. */
export const PLANNER_OCCASIONS = ['College', 'Work', 'Date', 'Party', 'Casual', 'Travel'];
