-- ============================================================
-- CLOSIQ — Wardrobe intelligence (2026-11-11)
-- ADDITIVE ONLY: new nullable/defaulted columns, two RPC functions.
-- No existing column, row or policy is dropped or rewritten.
-- Safe to re-run (every statement is guarded).
-- ============================================================

-- ---------- garments: availability, purchase info, pattern, collections ----------
-- availability: 'available' | 'laundry' | 'unavailable'. Recommenders
-- (Outfit Brain, Stylist, Shop Check, Pairs-well-with) skip anything that
-- isn't 'available'. Existing rows default to 'available'.
alter table public.garments add column if not exists availability text not null default 'available';
alter table public.garments add column if not exists purchase_date text;
alter table public.garments add column if not exists pattern text;
alter table public.garments add column if not exists collections text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'garments_availability_check') then
    alter table public.garments add constraint garments_availability_check
      check (availability in ('available', 'laundry', 'unavailable'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'garments_purchase_date_format') then
    alter table public.garments add constraint garments_purchase_date_format
      check (purchase_date is null or purchase_date ~ '^\d{4}-\d{2}(-\d{2})?$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'garments_pattern_len') then
    alter table public.garments add constraint garments_pattern_len
      check (pattern is null or char_length(pattern) <= 40);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'garments_collections_len') then
    alter table public.garments add constraint garments_collections_len
      check (cardinality(collections) <= 20);
  end if;
end $$;

comment on column public.garments.availability is 'available | laundry | unavailable — recommenders only use available pieces.';
comment on column public.garments.purchase_date is 'When the user bought it: YYYY-MM or YYYY-MM-DD (user-entered, never inferred).';
comment on column public.garments.pattern is 'Visible pattern (solid, striped, checked, floral, printed...). User-confirmed.';
comment on column public.garments.collections is 'User-named collections this piece belongs to (e.g. "Office", "Goa trip").';

-- ---------- profiles: privacy + weather location ----------
-- ai_photo_consent: when false, garment photos are never sent to the AI
-- provider; the user describes pieces by hand instead.
-- weather_city: a city the user typed (web has no GPS prompt by default):
-- {"name": "Hyderabad", "latitude": 17.38, "longitude": 78.48}.
alter table public.profiles add column if not exists ai_photo_consent boolean not null default true;
alter table public.profiles add column if not exists weather_city jsonb;

-- ---------- record_garments_worn: atomic wear counter ----------
-- Replaces read-modify-write on the client (two devices could overwrite each
-- other's counts). SECURITY INVOKER: RLS still scopes the update to the
-- caller's own rows; the explicit user_id filter is belt-and-braces.
create or replace function public.record_garments_worn(p_garment_ids text[], p_worn_on text)
returns integer
language sql
security invoker
set search_path = ''
as $$
  with updated as (
    update public.garments
       set wear_count = wear_count + 1,
           last_worn_date = p_worn_on
     where user_id = (select auth.uid())
       and garment_id = any (p_garment_ids)
       and p_worn_on ~ '^\d{4}-\d{2}-\d{2}$'
    returning 1
  )
  select count(*)::integer from updated;
$$;
revoke execute on function public.record_garments_worn(text[], text) from public, anon;
grant execute on function public.record_garments_worn(text[], text) to authenticated;

-- ---------- delete_my_account: self-service account deletion ----------
-- Deletes the CALLER's auth user only (auth.uid(), never a parameter).
-- Every public table references auth.users ON DELETE CASCADE, so all of the
-- user's rows go with it. Storage objects are removed by the client first
-- (storage API), because storage.objects has no FK to auth.users.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = uid;
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
