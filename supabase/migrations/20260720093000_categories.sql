-- Categories group photos into navigable galleries and provide a featured
-- image for the landing page.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order integer not null default 0,
  featured_photo_id uuid,
  created_at timestamptz not null default now(),
  constraint categories_name_not_blank check (length(trim(name)) > 0),
  constraint categories_slug_not_blank check (length(trim(slug)) > 0)
);

insert into public.categories (name, slug, sort_order)
values
  ('People', 'people', 0),
  ('Landscape', 'landscape', 1),
  ('Birds', 'birds', 2),
  ('Animals', 'animals', 3),
  ('Sailing', 'sailing', 4),
  ('City', 'city', 5),
  ('Plants', 'plants', 6),
  ('Other', 'other', 7)
on conflict (slug) do nothing;

alter table public.photos add column if not exists category_id uuid;

update public.photos
set category_id = (select id from public.categories where slug = 'other')
where category_id is null;

alter table public.photos
  alter column category_id set not null,
  add constraint photos_category_id_fkey
    foreign key (category_id) references public.categories(id) on delete restrict;

alter table public.categories
  add constraint categories_featured_photo_id_fkey
    foreign key (featured_photo_id) references public.photos(id) on delete set null;

create index if not exists photos_category_column_idx
  on public.photos (category_id, column_index asc, column_order asc);

create or replace function public.validate_category_featured_photo()
returns trigger
language plpgsql
as $$
begin
  if new.featured_photo_id is not null and not exists (
    select 1
    from public.photos
    where id = new.featured_photo_id
      and category_id = new.id
  ) then
    raise exception 'Featured photo must belong to its category';
  end if;
  return new;
end;
$$;

drop trigger if exists categories_featured_photo_belongs_to_category on public.categories;
create trigger categories_featured_photo_belongs_to_category
  before insert or update of featured_photo_id on public.categories
  for each row execute function public.validate_category_featured_photo();

alter table public.categories enable row level security;

drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read"
  on public.categories for select
  using (true);

drop policy if exists "categories_auth_write" on public.categories;
create policy "categories_auth_write"
  on public.categories for all
  to authenticated
  using (true)
  with check (true);

grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
