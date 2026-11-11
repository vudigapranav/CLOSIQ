-- 2026-10-13: "Where is it kept?" — the place at home a garment lives
-- (main almirah, kids' room cupboard, loft, with the dhobi, ...).
-- Applied to project wibinjtekmadwtbxygrd via the Supabase MCP as migration
-- `garments_storage_location`. Nullable and additive: existing rows are untouched,
-- and the existing garments_update_own RLS policy already covers edits.

alter table public.garments add column if not exists storage_location text;
alter table public.garments add constraint garments_storage_location_len
  check (storage_location is null or char_length(storage_location) <= 80);
comment on column public.garments.storage_location is
  'Where the user keeps this garment at home (preset from src/data/storageLocations.ts or a custom place). Null = not set.';
