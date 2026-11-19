export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatLocalTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}

/** Combines a stored "YYYY-MM-DD" + "HH:mm" pair back into a local Date,
 *  entirely via the local-time Date constructor (never the string-parsing
 *  overload, which is UTC for a bare date). */
export function parseLocalDateTime(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, h || 0, min || 0);
}

/** Today's local calendar date, same "YYYY-MM-DD" shape as a stored event. */
export function todayLocalDate(): string {
  return formatLocalDate(new Date());
}

export function formatEventDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatEventTimeLabel(timeStr: string): string {
  const [h, min] = timeStr.split(':').map(Number);
  const date = new Date(2000, 0, 1, h || 0, min || 0);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
