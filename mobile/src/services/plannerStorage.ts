import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlannerEvent } from '../types/planner';

const STORAGE_KEY = '@closiq_planner_events';

/**
 * Local-timezone-safe date/time formatting and parsing.
 *
 * `date.toISOString()` and `new Date("YYYY-MM-DD")` both go through UTC —
 * the former converts the device's local wall-clock time to UTC before
 * formatting (shifts the calendar day near midnight in positive UTC
 * offsets), and the latter parses a bare date string as UTC midnight (shifts
 * it a day EARLIER in negative UTC offsets, e.g. anywhere in the Americas).
 * Either one reproduces exactly the "event created for today shows as
 * yesterday/tomorrow" bug this sprint's brief calls out. Every helper below
 * reads/writes local Date fields (getFullYear/getMonth/getDate/getHours/
 * getMinutes) exclusively and never touches a UTC-based conversion.
 */
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

export async function loadPlannerEvents(): Promise<PlannerEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PlannerEvent[]) : [];
  } catch (err) {
    console.warn('Failed to load planner events from storage:', err);
    return [];
  }
}

async function persist(events: PlannerEvent[]): Promise<PlannerEvent[]> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  return events;
}

export async function addPlannerEvent(
  input: Omit<PlannerEvent, 'id' | 'createdAt'>
): Promise<PlannerEvent[]> {
  try {
    const existing = await loadPlannerEvents();
    const newEvent: PlannerEvent = {
      ...input,
      id: `event-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    return await persist([newEvent, ...existing]);
  } catch (err) {
    console.warn('Failed to add planner event:', err);
    return [];
  }
}

export async function updatePlannerEvent(
  id: string,
  partial: Partial<Omit<PlannerEvent, 'id' | 'createdAt'>>
): Promise<PlannerEvent[]> {
  try {
    const existing = await loadPlannerEvents();
    const updated = existing.map((e) => (e.id === id ? { ...e, ...partial } : e));
    return await persist(updated);
  } catch (err) {
    console.warn('Failed to update planner event:', err);
    return [];
  }
}

export async function deletePlannerEvent(id: string): Promise<PlannerEvent[]> {
  try {
    const existing = await loadPlannerEvents();
    const updated = existing.filter((e) => e.id !== id);
    return await persist(updated);
  } catch (err) {
    console.warn('Failed to delete planner event:', err);
    return [];
  }
}
