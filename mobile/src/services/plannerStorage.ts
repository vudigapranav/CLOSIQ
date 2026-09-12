import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { PlannerEvent } from '../types/planner';
import { Outfit } from '../../../src/types/wardrobe';
import {
  SessionScope,
  captureSession,
  isSessionCurrent,
  userScopedKeyFor
} from './authSession';
import { runCloudWrite, markPending, mergePendingLocal } from './cloudWriteFeedback';
import { supabase } from './supabaseClient';
import { refreshNestedGarmentImages } from './garmentImages';

/** Same durable-image re-resolution as Saved Looks, for each event's
 *  attached outfit (Sprint M20). The stored event is never rewritten. */
function withFreshImages(events: PlannerEvent[]): Promise<PlannerEvent[]> {
  return refreshNestedGarmentImages(
    events,
    (e) => e.outfit?.items,
    (e, items) => (e.outfit ? { ...e, outfit: { ...e.outfit, items: items as Outfit['items'] } } : e)
  );
}
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

async function readCache(scope: SessionScope): Promise<PlannerEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(userScopedKeyFor(scope.userId, BASE_STORAGE_KEY));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PlannerEvent[]) : [];
  } catch (err) {
    console.warn('Failed to read cached planner events:', err);
    return [];
  }
}

async function writeCache(scope: SessionScope, events: PlannerEvent[]): Promise<PlannerEvent[]> {
  await AsyncStorage.setItem(userScopedKeyFor(scope.userId, BASE_STORAGE_KEY), JSON.stringify(events));
  return events;
}

export async function loadPlannerEvents(): Promise<PlannerEvent[]> {
  // Session captured once, up front — see authSession.ts (Sprint M19).
  const scope = captureSession();
  const userId = scope.userId;
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('planner_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const mapped = (data || []).map(rowToEvent);
    if (!isSessionCurrent(scope)) {
      console.warn('Discarding planner read that resolved after a session change.');
      return [];
    }
    // Events whose cloud insert failed exist only in this cache — keep them.
    const merged = await withFreshImages(mergePendingLocal(mapped, await readCache(scope)));
    if (!isSessionCurrent(scope)) return [];
    return writeCache(scope, merged);
  } catch (err) {
    console.warn('Cloud planner fetch failed, falling back to local cache:', err);
    const cached = await withFreshImages(await readCache(scope));
    if (!isSessionCurrent(scope)) return [];
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
  const scope = captureSession();
  const userId = scope.userId;
  const existing = await readCache(scope);
  const newEvent: PlannerEvent = {
    ...input,
    id: `event-${Date.now()}`,
    createdAt: new Date().toISOString()
  };
  const optimistic = await writeCache(scope, [newEvent, ...existing]);

  if (!userId) return optimistic;

  const cloudSynced = await runCloudWrite({
    scope,
    title: 'Event not saved to your account',
    message:
      "This event is on this device only. It won't appear on your other devices, and it does not upload later on its own — try again to save it to your account.",
    run: async (attempt) => {
      // A failed attempt may still have committed; never insert twice.
      if (attempt > 1) {
        const { data, error: existsError } = await supabase
          .from('planner_events')
          .select('id')
          .eq('user_id', userId)
          .eq('event_id', newEvent.id)
          .limit(1);
        if (existsError) throw existsError;
        if ((data?.length ?? 0) > 0) return;
      }
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
    }
  });

  // Kept locally either way — discarding the event the user just created
  // would be the only genuinely destructive option here — but marked, so
  // the next cloud read doesn't erase it.
  if (!isSessionCurrent(scope)) return [];
  if (cloudSynced) return optimistic;
  return writeCache(scope, [markPending(newEvent), ...existing]);
}

export async function updatePlannerEvent(
  id: string,
  partial: Partial<Omit<PlannerEvent, 'id' | 'createdAt'>>
): Promise<PlannerEvent[]> {
  const scope = captureSession();
  const userId = scope.userId;
  const existing = await readCache(scope);
  const updated = existing.map((e) => (e.id === id ? { ...e, ...partial } : e));
  const optimistic = await writeCache(scope, updated);

  if (!userId) return optimistic;

  const cloudSynced = await runCloudWrite({
    scope,
    title: 'Change not saved to your account',
    message:
      "This change couldn't be saved to your account, so the event has been left as it was. Try again to save it.",
    run: async () => {
      const { error } = await supabase
        .from('planner_events')
        .update(eventPartialToRow(partial) as never)
        .eq('user_id', userId)
        .eq('event_id', id);
      if (error) throw error;
    }
  });

  if (!isSessionCurrent(scope)) return [];
  // An edit that never landed is reverted locally rather than left showing
  // a value the account doesn't have — unlike a create, nothing the user
  // authored is destroyed by going back to the stored version.
  if (!cloudSynced) {
    return writeCache(scope, existing);
  }
  return optimistic;
}

export async function deletePlannerEvent(id: string): Promise<PlannerEvent[]> {
  const scope = captureSession();
  const userId = scope.userId;
  const existing = await readCache(scope);
  const updated = existing.filter((e) => e.id !== id);
  const optimistic = await writeCache(scope, updated);

  if (!userId) return optimistic;

  const cloudDeleted = await runCloudWrite({
    scope,
    title: 'Event not removed',
    message:
      "This event couldn't be removed from your account, so it's still there and will come back next time your Planner loads. Try again to remove it for good.",
    run: async () => {
      const { error } = await supabase.from('planner_events').delete().eq('user_id', userId).eq('event_id', id);
      if (error) throw error;
    }
  });

  if (!isSessionCurrent(scope)) return [];
  if (!cloudDeleted) {
    return writeCache(scope, existing);
  }
  return optimistic;
}
