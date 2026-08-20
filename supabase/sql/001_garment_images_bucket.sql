-- CLOSIQ — Mobile Sprint M18: garment image storage bucket + RLS policies.
--
-- STATUS: already applied. The "garment-images" bucket (private) and its
-- four per-user RLS policies (garment_images_insert_own/select_own/
-- update_own/delete_own, scoped to auth.uid() via the <userId>/<file> path
-- convention) already existed on the live project before this file was
-- written — confirmed via `select * from pg_policies where tablename =
-- 'objects'` and live-tested end to end (upload to own path succeeds,
-- upload to another user's path is rejected 403, signed URL + delete both
-- work). This file is kept as a documented, idempotent reference (safe to
-- re-run — `on conflict (id) do nothing` / `drop policy if exists` before
-- every create) rather than deleted, in case a future fresh project ever
-- needs it recreated from scratch.
--
-- HOW TO RUN THIS (only if the bucket/policies are ever missing):
--   1. Open the Supabase project dashboard.
--   2. Go to SQL Editor.
--   3. Paste this entire file and run it once.
--   4. Verify: Storage → "garment-images" bucket exists, marked Private.

-- 1. Create the bucket itself: PRIVATE (public = false), per M18's explicit
--    "Do NOT make the bucket public. Use authenticated access." requirement.
insert into storage.buckets (id, name, public)
values ('garment-images', 'garment-images', false)
on conflict (id) do nothing;

-- 2. RLS policies on storage.objects, scoped to the established
--    "<userId>/<filename>" path convention: a user may only read/write
--    objects whose first path segment is their own auth.uid(). This is the
--    same per-user isolation pattern already enforced on every table
--    (garments, saved_outfits, planner_events, profiles, user_preferences).

drop policy if exists "closiq_garment_images_insert_own" on storage.objects;
create policy "closiq_garment_images_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'garment-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "closiq_garment_images_select_own" on storage.objects;
create policy "closiq_garment_images_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'garment-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "closiq_garment_images_update_own" on storage.objects;
create policy "closiq_garment_images_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'garment-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "closiq_garment_images_delete_own" on storage.objects;
create policy "closiq_garment_images_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'garment-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
