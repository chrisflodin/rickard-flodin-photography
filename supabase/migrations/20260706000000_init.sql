-- Rickard Flodin Photography - initial schema
-- Run this in the Supabase SQL editor (or via the CLI) on a fresh project.

-- =====================================================================
-- Tables
-- =====================================================================

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled',
  description text not null default '',
  price numeric,
  storage_path text not null,
  width integer not null,
  height integer not null,
  blur_data_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists photos_sort_order_idx on public.photos (sort_order asc);

-- Singleton "about" content. A single row (id = true) always exists.
create table if not exists public.about (
  id boolean primary key default true,
  body text not null default '',
  photographer_image_path text,
  updated_at timestamptz not null default now(),
  constraint about_singleton check (id = true)
);

insert into public.about (id, body)
values (true, '')
on conflict (id) do nothing;

-- =====================================================================
-- Row Level Security
-- =====================================================================

alter table public.photos enable row level security;
alter table public.about enable row level security;

-- Public read access.
drop policy if exists "photos_public_read" on public.photos;
create policy "photos_public_read"
  on public.photos for select
  using (true);

drop policy if exists "about_public_read" on public.about;
create policy "about_public_read"
  on public.about for select
  using (true);

-- Authenticated users may write (admin is the only authenticated user).
drop policy if exists "photos_auth_write" on public.photos;
create policy "photos_auth_write"
  on public.photos for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "about_auth_write" on public.about;
create policy "about_auth_write"
  on public.about for all
  to authenticated
  using (true)
  with check (true);

-- =====================================================================
-- Storage buckets
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('about', 'about', true)
on conflict (id) do nothing;

-- Public read for both buckets.
drop policy if exists "storage_public_read" on storage.objects;
create policy "storage_public_read"
  on storage.objects for select
  using (bucket_id in ('photos', 'about'));

-- Authenticated write/update/delete for both buckets.
drop policy if exists "storage_auth_write" on storage.objects;
create policy "storage_auth_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id in ('photos', 'about'));

drop policy if exists "storage_auth_update" on storage.objects;
create policy "storage_auth_update"
  on storage.objects for update
  to authenticated
  using (bucket_id in ('photos', 'about'))
  with check (bucket_id in ('photos', 'about'));

drop policy if exists "storage_auth_delete" on storage.objects;
create policy "storage_auth_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id in ('photos', 'about'));
