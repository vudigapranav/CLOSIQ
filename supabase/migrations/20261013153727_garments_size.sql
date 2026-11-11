-- 2026-10-13: garment size (S/M/L, chest 40, waist 32, UK 8, Free size, or free text).
-- Applied to project wibinjtekmadwtbxygrd via the Supabase MCP as migration
-- `garments_size`. Nullable and additive; covered by the existing garments_update_own policy.

alter table public.garments add column if not exists size text;
alter table public.garments add constraint garments_size_len
  check (size is null or char_length(size) <= 24);
comment on column public.garments.size is
  'Garment size as the user entered it (preset from src/data/garmentSizes.ts or free text). Null = not set.';
