/**
 * Calendar export (2026-11-11) — shared web/mobile, pure, no I/O.
 *
 * Builds an RFC 5545 iCalendar string for one or many planner events so the
 * user can drop them into Apple/Google/Outlook calendar. Times are written as
 * "floating" local time (no zone, no Z) because planner events store a local
 * wall-clock date + time — the same moment the user typed.
 */

export interface CalendarEventInput {
  id: string;
  title: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Local 24h time HH:mm. Missing / empty / '00:00' = an all-day event. */
  time?: string | null;
  occasion?: string;
  notes?: string;
  /** Piece names of the planned outfit go in the description. */
  outfit?: { title?: string; items: { name: string }[] } | null;
  /** Timed events only; default 60. */
  durationMinutes?: number;
}

/** Planner events always carry a time column ('00:00' when none was chosen),
 *  so midnight is treated as "no time given". */
export function hasRealTime(time: string | null | undefined): time is string {
  return !!time && /^\d{2}:\d{2}$/.test(time) && time !== '00:00';
}

/** Escapes TEXT values: backslash, semicolon, comma, newlines. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Folds a content line at 75 octets (UTF-8), never splitting a character. */
export function foldIcsLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  // Continuation lines start with one space, which counts toward the 75.
  let limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) {
      out.push(current);
      current = ' ';
      bytes = 1;
      limit = 75;
    }
    current += ch;
    bytes += n;
  }
  out.push(current);
  return out.join('\r\n');
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

function compactDate(date: string): string {
  return date.replace(/-/g, '');
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Local date + time + minutes → [date, 'HHmmss'] without any timezone maths. */
function addMinutes(date: string, time: string, minutes: number): { date: string; hms: string } {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const dayShift = Math.floor(total / 1440);
  const rem = ((total % 1440) + 1440) % 1440;
  return { date: addDays(date, dayShift), hms: `${pad(Math.floor(rem / 60))}${pad(rem % 60)}00` };
}

function utcStamp(now: Date): string {
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  );
}

function describe(event: CalendarEventInput): string {
  const parts: string[] = [];
  if (event.occasion) parts.push(`Occasion: ${event.occasion}`);
  if (event.outfit && event.outfit.items.length > 0) {
    const names = event.outfit.items.map((i) => i.name).join(', ');
    parts.push(`Planned outfit${event.outfit.title ? ` (${event.outfit.title})` : ''}: ${names}`);
  }
  if (event.notes) parts.push(`Notes: ${event.notes}`);
  return parts.join('\n');
}

function vevent(event: CalendarEventInput, stamp: string): string[] {
  const lines = ['BEGIN:VEVENT', `UID:${event.id.replace(/[^A-Za-z0-9._-]/g, '-')}@closiq.app`, `DTSTAMP:${stamp}`];
  if (hasRealTime(event.time)) {
    const end = addMinutes(event.date, event.time, event.durationMinutes && event.durationMinutes > 0 ? event.durationMinutes : 60);
    lines.push(`DTSTART:${compactDate(event.date)}T${event.time.replace(':', '')}00`);
    lines.push(`DTEND:${compactDate(end.date)}T${end.hms}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${compactDate(event.date)}`);
    lines.push(`DTEND;VALUE=DATE:${compactDate(addDays(event.date, 1))}`);
  }
  lines.push(`SUMMARY:${escapeIcsText(event.title || event.occasion || 'CLOSIQ event')}`);
  const description = describe(event);
  if (description) lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
  if (event.occasion) lines.push(`CATEGORIES:${escapeIcsText(event.occasion)}`);
  lines.push('END:VEVENT');
  return lines;
}

/** One VCALENDAR for any number of events. Lines end with CRLF as required. */
export function buildIcs(events: CalendarEventInput[], now: Date = new Date()): string {
  const stamp = utcStamp(now);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CLOSIQ//Planner//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const event of events) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date)) continue;
    lines.push(...vevent(event, stamp));
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

/** Safe file name for a downloaded .ics. */
export function icsFileName(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `${slug || 'closiq-event'}.ics`;
}
