-- ============================================================
-- CLOSIQ — Row Level Security
-- Recovered verbatim (2026-11-11) from the applied migration history.
-- Authorization is derived ONLY from the verified Supabase identity
-- ((select auth.uid())). Every INSERT/UPDATE carries a WITH CHECK so a
-- client cannot write a row owned by someone else. No policy is granted
-- to `anon`, so an unauthenticated request can read/write nothing.
-- ============================================================

alter table public.profiles         enable row level security;
alter table public.user_preferences enable row level security;
alter table public.garments         enable row level security;
alter table public.saved_outfits    enable row level security;
alter table public.planner_events   enable row level security;
alter table public.outfit_history   enable row level security;

alter table public.profiles         force row level security;
alter table public.user_preferences force row level security;
alter table public.garments         force row level security;
alter table public.saved_outfits    force row level security;
alter table public.planner_events   force row level security;
alter table public.outfit_history   force row level security;

-- profiles (owner column is `id`)
create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "profiles_delete_own" on public.profiles
  for delete to authenticated using ((select auth.uid()) = id);

-- user_preferences
create policy "user_preferences_select_own" on public.user_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_preferences_insert_own" on public.user_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_preferences_update_own" on public.user_preferences
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_preferences_delete_own" on public.user_preferences
  for delete to authenticated using ((select auth.uid()) = user_id);

-- garments
create policy "garments_select_own" on public.garments
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "garments_insert_own" on public.garments
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "garments_update_own" on public.garments
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "garments_delete_own" on public.garments
  for delete to authenticated using ((select auth.uid()) = user_id);

-- saved_outfits
create policy "saved_outfits_select_own" on public.saved_outfits
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "saved_outfits_insert_own" on public.saved_outfits
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "saved_outfits_update_own" on public.saved_outfits
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "saved_outfits_delete_own" on public.saved_outfits
  for delete to authenticated using ((select auth.uid()) = user_id);

-- planner_events
create policy "planner_events_select_own" on public.planner_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "planner_events_insert_own" on public.planner_events
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "planner_events_update_own" on public.planner_events
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "planner_events_delete_own" on public.planner_events
  for delete to authenticated using ((select auth.uid()) = user_id);

-- outfit_history
create policy "outfit_history_select_own" on public.outfit_history
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "outfit_history_insert_own" on public.outfit_history
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "outfit_history_update_own" on public.outfit_history
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "outfit_history_delete_own" on public.outfit_history
  for delete to authenticated using ((select auth.uid()) = user_id);
