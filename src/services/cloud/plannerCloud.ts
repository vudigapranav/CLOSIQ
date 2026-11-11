import { supabase } from './supabase';
import { Outfit } from '../../types/wardrobe';

/**
 * Web planner events (2026-11-11): the same `planner_events` rows the mobile
 * app writes (mobile/src/services/plannerStorage.ts), so an event added on the
 * phone shows up here and vice versa. Dates are local-calendar TEXT
 * ('YYYY-MM-DD') and times local 'HH:mm' — never converted through UTC.
 * Every query is filtered by user_id (RLS enforces it server-side too) and
 * errors are thrown so the screen can show them — nothing fails silently.
 */

export interface PlannerEvent {
  id: string;
  title: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Local 24h time, HH:mm. '00:00' = no time chosen. */
  time: string;
  occasion: string;
  notes?: string;
  createdAt: string;
  outfit?: Outfit;
}

/** Local YYYY-MM-DD (never via toISOString, which shifts the day near midnight). */
export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type PlannerEventInput = Omit<PlannerEvent, 'id' | 'createdAt'>;

type Row = {
  event_id: string;
  title: string;
  event_date: string;
  event_time: string;
  occasion: string;
  notes: string | null;
  outfit: unknown;
  created_at: string;
};

function rowToEvent(row: Row): PlannerEvent {
  return {
    id: row.event_id,
    title: row.title,
    date: row.event_date,
    time: row.event_time || '00:00',
    occasion: row.occasion,
    notes: row.notes || undefined,
    createdAt: row.created_at,
    outfit: (row.outfit as Outfit | null) || undefined
  };
}

export async function listPlannerEvents(userId: string): Promise<PlannerEvent[]> {
  const { data, error } = await supabase
    .from('planner_events')
    .select('event_id,title,event_date,event_time,occasion,notes,outfit,created_at')
    .eq('user_id', userId)
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data || []) as Row[]).map(rowToEvent);
}

export async function addPlannerEvent(userId: string, input: PlannerEventInput): Promise<PlannerEvent> {
  const id = `event-${Date.now()}`;
  const { data, error } = await supabase
    .from('planner_events')
    .insert({
      user_id: userId,
      event_id: id,
      title: input.title,
      event_date: input.date,
      event_time: input.time || '00:00',
      occasion: input.occasion,
      notes: input.notes || null,
      outfit: (input.outfit as unknown as never) || null
    })
    .select('event_id,title,event_date,event_time,occasion,notes,outfit,created_at')
    .single();
  if (error) throw new Error(error.message);
  return rowToEvent(data as Row);
}

export async function updatePlannerEvent(
  userId: string,
  eventId: string,
  partial: Partial<PlannerEventInput>
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (partial.title !== undefined) row.title = partial.title;
  if (partial.date !== undefined) row.event_date = partial.date;
  if (partial.time !== undefined) row.event_time = partial.time || '00:00';
  if (partial.occasion !== undefined) row.occasion = partial.occasion;
  if (partial.notes !== undefined) row.notes = partial.notes || null;
  if ('outfit' in partial) row.outfit = partial.outfit ?? null;
  const { error } = await supabase
    .from('planner_events')
    .update(row as never)
    .eq('user_id', userId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);
}

export async function deletePlannerEvent(userId: string, eventId: string): Promise<void> {
  const { error } = await supabase.from('planner_events').delete().eq('user_id', userId).eq('event_id', eventId);
  if (error) throw new Error(error.message);
}
