-- ============================================================
-- CLOSIQ — Storage: user-uploaded garment media only.
-- Recovered verbatim (2026-11-11) from the applied migration history
-- (this replaces the hand-written reference copy that used to live in
-- supabase/sql/001_garment_images_bucket.sql with different policy names).
--
-- PRIVATE bucket (public = false) so nothing is readable by URL guessing;
-- the app reads via signed URLs or an authenticated download.
-- Path convention (enforced by policy): '<userId>/<garmentId>.<ext>'
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'garment-images',
  'garment-images',
  false,
  5242880, -- 5 MB; clients already cap uploads at 1024px JPEG
  array['image/jpeg','image/png','image/webp','image/heic']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "garment_images_select_own" on storage.objects;
drop policy if exists "garment_images_insert_own" on storage.objects;
drop policy if exists "garment_images_update_own" on storage.objects;
drop policy if exists "garment_images_delete_own" on storage.objects;

create policy "garment_images_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'garment-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "garment_images_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'garment-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "garment_images_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'garment-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'garment-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "garment_images_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'garment-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
