-- ============================================================
-- CLOSIQ — Core cloud schema (M18 infrastructure)
-- Recovered verbatim (2026-11-11) from supabase_migrations.schema_migrations
-- on project wibinjtekmadwtbxygrd — it was applied via MCP but never committed.
--
-- Mirrors the existing client types 1:1:
--   src/types/wardrobe.ts        -> GarmentItem, Outfit, OutfitExplanation
--   mobile/src/types/onboarding.ts -> UserProfileData
--   mobile/src/types/planner.ts    -> PlannerEvent
--   mobile/src/services/profileSettingsStorage.ts -> MobileProfileSettings
--   mobile/src/services/outfitHistoryStorage.ts   -> outfit signatures
-- Every user-owned row is keyed to auth.users(id). No client-supplied
-- user id is ever trusted for authorization (see RLS migration).
-- ============================================================

-- ---------- shared updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles (1:1 with auth.users; = UserProfileData + demo flag)
create table public.profiles (
  id                         uuid primary key references auth.users (id) on delete cascade,
  name                       text not null default '',
  body_type                  text check (body_type in ('slim','athletic','average','broad','prefer_not_to_say')),
  skin_tone                  text check (skin_tone in ('light','medium','tan','deep','prefer_not_to_say')),
  style_preferences          text[] not null default '{}',
  temperature_unit           text not null default 'celsius' check (temperature_unit in ('celsius','fahrenheit')),
  location_permission_status text not null default 'not_asked' check (location_permission_status in ('granted','denied','not_asked')),
  onboarding_completed       boolean not null default false,
  -- Marks the fixed demo account only. Never used for authorization.
  is_demo                    boolean not null default false,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);
comment on table public.profiles is 'CLOSIQ onboarding/user profile, 1:1 with auth.users. Mirrors UserProfileData (mobile/src/types/onboarding.ts).';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- user_preferences (= MobileProfileSettings)
create table public.user_preferences (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  wardrobe_profile    text not null default 'men'  check (wardrobe_profile in ('men','women')),
  layering_preference text not null default 'avoid' check (layering_preference in ('avoid','sometimes','usually')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table public.user_preferences is 'Active wardrobe profile (men/women) + layering preference. Mirrors MobileProfileSettings.';

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- garments (= GarmentItem, per wardrobe profile bucket)
-- garment_id is the STABLE client-side garment ID — never a random path.
create table public.garments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  garment_id        text not null,
  wardrobe_profile  text not null check (wardrobe_profile in ('men','women')),

  name              text not null,
  category          text not null check (category in ('tops','bottoms','outerwear','shoes','accessories')),
  subcategory       text not null default '',
  color             text not null default '',
  hex_color         text not null default '',
  secondary_colors  text[],
  fabric            text not null default '',
  seasons           text[] not null default '{}',
  formality         text not null default 'casual' check (formality in ('casual','smart_casual','formal','evening')),

  image_url         text not null default '',
  -- Object key inside the private 'garment-images' bucket: '<userId>/<garmentId>.<ext>'.
  storage_path      text,

  brand             text,
  favorite          boolean not null default false,
  wear_count        integer not null default 0 check (wear_count >= 0),
  last_worn_date    text,
  date_added        text not null default to_char(now(), 'YYYY-MM-DD'),
  tags              text[] not null default '{}',
  ai_confidence     numeric,
  pairing_notes     text,
  fit               text,
  style             text,
  layering_role     text check (layering_role in ('base_layer','primary_layer','outer_layer')),
  source_profile    text check (source_profile in ('men','women')),
  is_seed_item      boolean not null default false,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint garments_unique_per_user_profile unique (user_id, wardrobe_profile, garment_id)
);
comment on table public.garments is 'User wardrobe items. Mirrors GarmentItem (src/types/wardrobe.ts). garment_id = stable CLOSIQ garment ID.';
comment on column public.garments.storage_path is 'Key in the private garment-images bucket, always <userId>/<garmentId>.<ext>. Null for catalog seed items.';

create index garments_user_profile_idx on public.garments (user_id, wardrobe_profile);
create index garments_user_category_idx on public.garments (user_id, category);

create trigger garments_set_updated_at
  before update on public.garments
  for each row execute function public.set_updated_at();

-- saved_outfits (= Outfit). items/explanation are an embedded snapshot on
-- purpose, so a saved look survives the underlying garment being deleted.
create table public.saved_outfits (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  outfit_id          text not null,

  title              text not null default '',
  occasion           text not null default '',
  vibe               text not null default '',
  formality_label    text not null default '',
  temperature        integer,
  style_score        integer,
  explanation        jsonb not null default '{}'::jsonb,
  items              jsonb not null default '[]'::jsonb,
  missing_categories text[] not null default '{}',
  worn_today         boolean not null default false,
  date_created       text not null default to_char(now(), 'YYYY-MM-DD'),

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint saved_outfits_unique_per_user unique (user_id, outfit_id)
);
comment on table public.saved_outfits is 'Saved Looks. Mirrors Outfit (src/types/wardrobe.ts); items[] is an embedded GarmentItem snapshot by design.';

create index saved_outfits_user_idx on public.saved_outfits (user_id, created_at desc);

create trigger saved_outfits_set_updated_at
  before update on public.saved_outfits
  for each row execute function public.set_updated_at();

-- planner_events (= PlannerEvent). Local-calendar TEXT dates on purpose
-- (avoids the UTC day-shift bug documented in plannerStorage.ts).
create table public.planner_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  event_id   text not null,

  title      text not null default '',
  event_date text not null check (event_date ~ '^\d{4}-\d{2}-\d{2}$'),
  event_time text not null default '00:00' check (event_time ~ '^\d{2}:\d{2}$'),
  occasion   text not null default '',
  notes      text,
  outfit     jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint planner_events_unique_per_user unique (user_id, event_id)
);
comment on table public.planner_events is 'Planner events. Mirrors PlannerEvent (mobile/src/types/planner.ts). Dates are local-calendar TEXT to avoid UTC day shift.';

create index planner_events_user_date_idx on public.planner_events (user_id, event_date);

create trigger planner_events_set_updated_at
  before update on public.planner_events
  for each row execute function public.set_updated_at();

-- outfit_history: one row per distinct combination signature.
create table public.outfit_history (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  signature    text not null,
  garment_ids  text[] not null default '{}',
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),

  constraint outfit_history_unique_per_user unique (user_id, signature)
);
comment on table public.outfit_history is 'Recently generated/worn outfit signatures used to avoid repeat recommendations. Mirrors outfitHistoryStorage.ts.';

create index outfit_history_user_recent_idx on public.outfit_history (user_id, last_seen_at desc);

-- Auto-provision profile + preferences rows on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
