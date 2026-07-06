-- Move from a single global photo order to a column-based masonry layout.
-- Each photo now belongs to a specific column (column_index) at a specific
-- position within that column (column_order). The number of columns is an
-- admin-editable, persisted setting.

-- =====================================================================
-- Photos: per-column placement
-- =====================================================================

alter table public.photos
  add column if not exists column_index integer not null default 0,
  add column if not exists column_order integer not null default 0;

-- Backfill existing photos across 3 columns, round-robin by current order,
-- so the initial column layout preserves the previous top-to-bottom priority.
with ordered as (
  select
    id,
    (row_number() over (order by sort_order asc, created_at asc) - 1) as rn
  from public.photos
)
update public.photos p
set
  column_index = (o.rn % 3)::int,
  column_order = (o.rn / 3)::int
from ordered o
where p.id = o.id;

create index if not exists photos_column_idx
  on public.photos (column_index asc, column_order asc);

-- =====================================================================
-- Gallery settings (singleton): number of columns
-- =====================================================================

create table if not exists public.gallery_settings (
  id boolean primary key default true,
  columns_count integer not null default 3,
  updated_at timestamptz not null default now(),
  constraint gallery_settings_singleton check (id = true),
  constraint gallery_settings_columns_range check (columns_count between 1 and 6)
);

insert into public.gallery_settings (id, columns_count)
values (true, 3)
on conflict (id) do nothing;

alter table public.gallery_settings enable row level security;

drop policy if exists "gallery_settings_public_read" on public.gallery_settings;
create policy "gallery_settings_public_read"
  on public.gallery_settings for select
  using (true);

drop policy if exists "gallery_settings_auth_write" on public.gallery_settings;
create policy "gallery_settings_auth_write"
  on public.gallery_settings for all
  to authenticated
  using (true)
  with check (true);

grant select on public.gallery_settings to anon, authenticated;
grant insert, update, delete on public.gallery_settings to authenticated;
grant all on public.gallery_settings to service_role;
