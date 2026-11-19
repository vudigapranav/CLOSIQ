import { uuid } from 'expo-modules-core';
import type { PlannerEvent } from '../types/planner';
import { list, put, drop, merge } from '../local/store';
import { showOutfit, storeOutfit } from '../local/photos';
export * from '../local/plannerDates';
export async function loadPlannerEvents() {
  return (await list<PlannerEvent>('event'))
    .map((e) => ({ ...e, outfit: e.outfit && showOutfit(e.outfit) }))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
export async function addPlannerEvent(input: Omit<PlannerEvent, 'id' | 'createdAt'>) {
  const id = uuid.v4();
  await put('event', 'device', id, {
    ...input,
    id,
    createdAt: new Date().toISOString(),
    outfit: input.outfit && storeOutfit(input.outfit)
  });
  return loadPlannerEvents();
}
export async function updatePlannerEvent(id: string, patch: Partial<Omit<PlannerEvent, 'id' | 'createdAt'>>) {
  await merge<PlannerEvent>(
    'event',
    'device',
    id,
    patch.outfit ? { ...patch, outfit: storeOutfit(patch.outfit) } : patch
  );
  return loadPlannerEvents();
}
export async function deletePlannerEvent(id: string) {
  await drop('event', 'device', id);
  return loadPlannerEvents();
}
