-- ============================================================
-- CLOSIQ — Hardening (2026-11-11)
-- ADDITIVE and idempotent.
-- ============================================================

-- outfit_feedback: enforce RLS even for the table owner.
alter table public.outfit_feedback force row level security;

-- record_garments_worn: same as 20261111054834_wardrobe_intelligence plus a batch-size cap.
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
       and cardinality(p_garment_ids) <= 50
       and garment_id = any (p_garment_ids)
       and p_worn_on ~ '^\d{4}-\d{2}-\d{2}$'
    returning 1
  )
  select count(*)::integer from updated;
$$;
revoke execute on function public.record_garments_worn(text[], text) from public, anon;
grant execute on function public.record_garments_worn(text[], text) to authenticated;

-- Length limits. NOT VALID: new/changed rows are checked, existing rows are
-- not scanned (so a legacy long value can't block the migration).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'garments_name_len') then
    alter table public.garments add constraint garments_name_len
      check (char_length(name) <= 120) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'garments_brand_len') then
    alter table public.garments add constraint garments_brand_len
      check (brand is null or char_length(brand) <= 80) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'garments_tags_len') then
    alter table public.garments add constraint garments_tags_len
      check (cardinality(tags) <= 30) not valid;
  end if;
end $$;
