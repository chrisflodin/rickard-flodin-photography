-- Preserve full-resolution source files for digital delivery and printing.

create table if not exists public.photo_originals (
  photo_id uuid primary key references public.photos(id) on delete cascade,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

alter table public.photo_originals enable row level security;
grant all on public.photo_originals to service_role;

alter table public.orders
  add column if not exists original_storage_path text;

create index if not exists orders_original_storage_path_idx
  on public.orders (original_storage_path)
  where original_storage_path is not null;

create table if not exists public.photo_original_uploads (
  path text primary key,
  uploaded_by uuid references auth.users(id) on delete set null,
  content_type text not null check (
    content_type in ('image/jpeg', 'image/png', 'image/webp')
  ),
  size_bytes bigint not null check (
    size_bytes > 0 and size_bytes <= 52428800
  ),
  status text not null default 'pending' check (
    status in ('pending', 'claimed', 'deleting')
  ),
  web_storage_path text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

create index if not exists photo_original_uploads_status_created_at_idx
  on public.photo_original_uploads (status, created_at);

alter table public.photo_original_uploads enable row level security;
grant all on public.photo_original_uploads to service_role;

create table if not exists public.storage_deletion_queue (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  object_path text not null,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  unique (bucket_id, object_path)
);

alter table public.storage_deletion_queue enable row level security;
grant all on public.storage_deletion_queue to service_role;

create or replace function public.finalize_photo_upload(
  target_upload_path text,
  target_upload_user_id uuid,
  target_web_storage_path text,
  photo_title text,
  photo_description text,
  photo_digital_price numeric,
  photo_print_a3_price numeric,
  photo_print_a2_price numeric,
  photo_category_id uuid,
  photo_width integer,
  photo_height integer,
  photo_blur_data_url text,
  photo_column_index integer,
  photo_column_order integer
)
returns setof public.photos
language plpgsql
security definer
set search_path = public
as $$
declare
  created_photo public.photos%rowtype;
  claimed_path text;
begin
  select path
  into claimed_path
  from public.photo_original_uploads
  where path = target_upload_path
    and uploaded_by = target_upload_user_id
    and status = 'claimed'
    and web_storage_path = target_web_storage_path
  for update;

  if not found then
    raise exception 'Original upload is not claimable';
  end if;

  insert into public.photos (
    title,
    description,
    digital_price,
    print_a3_price,
    print_a2_price,
    category_id,
    storage_path,
    width,
    height,
    blur_data_url,
    column_index,
    column_order
  )
  values (
    photo_title,
    photo_description,
    photo_digital_price,
    photo_print_a3_price,
    photo_print_a2_price,
    photo_category_id,
    target_web_storage_path,
    photo_width,
    photo_height,
    photo_blur_data_url,
    photo_column_index,
    photo_column_order
  )
  returning * into created_photo;

  insert into public.photo_originals (photo_id, storage_path)
  values (created_photo.id, target_upload_path);

  delete from public.photo_original_uploads where path = target_upload_path;
  return next created_photo;
end;
$$;

revoke all on function public.finalize_photo_upload(
  text, uuid, text, text, text, numeric, numeric, numeric, uuid,
  integer, integer, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.finalize_photo_upload(
  text, uuid, text, text, text, numeric, numeric, numeric, uuid,
  integer, integer, text, integer, integer
) to service_role;

create or replace function public.abandon_photo_upload(
  target_upload_path text,
  target_upload_user_id uuid
)
returns table (original_path text, web_path text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.photo_original_uploads
  set status = 'deleting'
  where path = target_upload_path
    and uploaded_by = target_upload_user_id
    and status in ('pending', 'claimed')
    and not exists (
      select 1
      from public.photo_originals
      where storage_path = target_upload_path
    )
  returning
    photo_original_uploads.path,
    photo_original_uploads.web_storage_path;
end;
$$;

revoke all on function public.abandon_photo_upload(text, uuid)
  from public, anon, authenticated;
grant execute on function public.abandon_photo_upload(text, uuid)
  to service_role;

create or replace function public.delete_photo_and_queue_storage(
  target_photo_id uuid
)
returns table (category_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_photo public.photos%rowtype;
  original_path text;
begin
  select *
  into target_photo
  from public.photos
  where id = target_photo_id
  for update;

  if not found then
    return;
  end if;

  select storage_path
  into original_path
  from public.photo_originals
  where photo_id = target_photo_id;

  insert into public.storage_deletion_queue (bucket_id, object_path)
  values ('photos', target_photo.storage_path)
  on conflict (bucket_id, object_path) do nothing;

  if original_path is not null and not exists (
    select 1
    from public.orders
    where original_storage_path = original_path
  ) then
    insert into public.storage_deletion_queue (bucket_id, object_path)
    values ('photo-originals', original_path)
    on conflict (bucket_id, object_path) do nothing;
  end if;

  delete from public.photos where id = target_photo_id;
  return query select target_photo.category_id;
end;
$$;

revoke all on function public.delete_photo_and_queue_storage(uuid)
  from public, anon, authenticated;
grant execute on function public.delete_photo_and_queue_storage(uuid)
  to service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'photo-originals',
  'photo-originals',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No public or authenticated object policies are added. Originals are uploaded
-- with short-lived signed tokens and read through admin-only signed downloads.
