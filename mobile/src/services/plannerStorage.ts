import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { PlannerEvent } from '../types/planner';
import { Outfit } from '../../../src/types/wardrobe';
import { userScopedKey, getCurrentUserId } from './authSession';
import { supabase } from './supabaseClient';
import type { Tables } from '../types/supabase';

const BASE_STORAGE_KEY = '@closiq_planner_events';

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
 *
 * Sprint M18: unchanged from M13 — these helpers stay entirely local-device
 * concerns and never touch the network, so nothing about the cloud-sync
 * work below has any reason to modify them.
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

/**
 * Sprint M18: `planner_events` (Supabase, RLS-scoped to `user_id =
 * auth.uid()`, live-verified) is now the durable source of truth.
 * AsyncStorage remains as a read cache for offline continuity.
 */
function rowToEvent(row: Tables<'planner_events'>): PlannerEvent {
  return {
    id: row.event_id,
    title: row.title,
    date: row.event_date,
    time: row.event_time,
    occasion: row.occasion,
    notes: row.notes || undefined,
    createdAt: row.created_at,
    outfit: ((row.outfit as unknown) as Outfit) || undefined
  };
}

function eventPartialToRow(
  partial: Partial<Omit<PlannerEvent, 'id' | 'createdAt'>>
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (partial.title !== undefined) row.title = partial.title;
  if (partial.date !== undefined) row.event_date = partial.date;
  if (partial.time !== undefined) row.event_time = partial.time;
  if (partial.occasion !== undefined) row.occasion = partial.occasion;
  if (partial.notes !== undefined) row.notes = partial.notes || null;
  if (partial.outfit !== undefined) row.outfit = (partial.outfit as unknown as never) || null;
  return row;
}

async function readCache(): Promise<PlannerEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(userScopedKey(BASE_STORAGE_KEY));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PlannerEvent[]) : [];
  } catch (err) {
    console.warn('Failed to read cached planner events:', err);
    return [];
  }
}

async function writeCache(events: PlannerEvent[]): Promise<PlannerEvent[]> {
  await AsyncStorage.setItem(userScopedKey(BASE_STORAGE_KEY), JSON.stringify(events));
  return events;
}

function offlineAlert(action: string) {
  Alert.alert("You're offline", `This ${action} was saved on this device and will sync when you're back online.`);
}

export async function loadPlannerEvents(): Promise<PlannerEvent[]> {
  const userId = getCurrentUserId();
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('planner_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const mapped = (data || []).map(rowToEvent);
    await writeCache(mapped);
    return mapped;
  } catch (err) {
    console.warn('Cloud planner fetch failed, falling back to local cache:', err);
    const cached = await readCache();
    if (cached.length === 0) {
      Alert.alert(
        "Couldn't load your Planner",
        "Check your connection and try again. Your events are safe in the cloud."
      );
    }
    return cached;
  }
}

export async function addPlannerEvent(
  input: Omit<PlannerEvent, 'id' | 'createdAt'>
): Promise<PlannerEvent[]> {
  const userId = getCurrentUserId();
  try {
    const existing = await readCache();
    const newEvent: PlannerEvent = {
      ...input,
      id: `event-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    const optimistic = await writeCache([newEvent, ...existing]);

    if (!userId) return optimistic;

    const { error } = await supabase.from('planner_events').insert({
      user_id: userId,
      event_id: newEvent.id,
      title: newEvent.title,
      event_date: newEvent.date,
      event_time: newEvent.time,
      occasion: newEvent.occasion,
      notes: newEvent.notes || null,
      outfit: (newEvent.outfit as unknown as never) || null
    });
    if (error) throw error;
    return optimistic;
  } catch (err) {
    console.warn('Failed to add planner event:', err);
    offlineAlert('event');
    return readCache();
  }
}

export async function updatePlannerEvent(
  id: string,
  partial: Partial<Omit<PlannerEvent, 'id' | 'createdAt'>>
): Promise<PlannerEvent[]> {
  const userId = getCurrentUserId();
  try {
    const existing = await readCache();
    const updated = existing.map((e) => (e.id === id ? { ...e, ...partial } : e));
    const optimistic = await writeCache(updated);

    if (!userId) return optimistic;

    const { error } = await supabase
      .from('planner_events')
      .update(eventPartialToRow(partial) as never)
      .eq('user_id', userId)
      .eq('event_id', id);
    if (error) throw error;
    return optimistic;
  } catch (err) {
    console.warn('Failed to update planner event:', err);
    offlineAlert('change');
    return readCache();
  }
}

export async function deletePlannerEvent(id: string): Promise<PlannerEvent[]> {
  const userId = getCurrentUserId();
  try {
    const existing = await readCache();
    const updated = existing.filter((e) => e.id !== id);
    const optimistic = await writeCache(updated);

    if (!userId) return optimistic;

    const { error } = await supabase.from('planner_events').delete().eq('user_id', userId).eq('event_id', id);
    if (error) throw error;
    return optimistic;
  } catch (err) {
    console.warn('Failed to delete planner event:', err);
    offlineAlert('removal');
    return readCache();
  }
}
