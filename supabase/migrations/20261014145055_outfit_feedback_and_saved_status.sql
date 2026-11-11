-- 2026-10-14: the outfit "brain". Applied to project wibinjtekmadwtbxygrd via
-- the Supabase MCP as migration `outfit_feedback_and_saved_status`.
--
-- outfit_feedback: one row per (user, outfit combination). signature = the
-- garment ids sorted and joined with '|' (same as outfit_history).
--   dislike = never suggest this combination again
--   okay    = suggest it less
--   nice    = a taste signal for Style DNA and the AI
-- saved_outfits.status: try_later ("I will try this next time") or worn
-- ("I am wearing / wore this"). Existing rows default to try_later.

create table if not exists public.outfit_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  signature text not null,
  garment_ids text[] not null default '{}',
  rating text not null check (rating in ('dislike', 'okay', 'nice')),
  occasion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, signature)
);
create index if not exists outfit_feedback_user_idx on public.outfit_feedback (user_id, updated_at desc);
alter table public.outfit_feedback enable row level security;
create policy outfit_feedback_select_own on public.outfit_feedback for select to authenticated using ((select auth.uid()) = user_id);
create policy outfit_feedback_insert_own on public.outfit_feedback for insert to authenticated with check ((select auth.uid()) = user_id);
create policy outfit_feedback_update_own on public.outfit_feedback for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy outfit_feedback_delete_own on public.outfit_feedback for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.saved_outfits add column if not exists status text not null default 'try_later';
alter table public.saved_outfits add constraint saved_outfits_status_check check (status in ('try_later', 'worn'));
