-- Sell each photo as a digital download or an A3/A2 print. Prices are stored
-- VAT-inclusive in SEK.

alter table public.photos
  add column if not exists digital_price numeric,
  add column if not exists print_a3_price numeric,
  add column if not exists print_a2_price numeric;

update public.photos
set
  digital_price = coalesce(digital_price, price),
  print_a3_price = coalesce(print_a3_price, price),
  print_a2_price = coalesce(print_a2_price, price);

alter table public.photos
  add constraint photos_digital_price_nonnegative
    check (digital_price is null or digital_price >= 0),
  add constraint photos_print_a3_price_nonnegative
    check (print_a3_price is null or print_a3_price >= 0),
  add constraint photos_print_a2_price_nonnegative
    check (print_a2_price is null or print_a2_price >= 0);

alter table public.photos drop column if exists price;

create table if not exists public.commerce_settings (
  id boolean primary key default true,
  legal_name text not null default '',
  address_line1 text not null default '',
  postal_code text not null default '',
  city text not null default '',
  organization_number text not null default '',
  vat_number text not null default '',
  notification_email text not null default '',
  payment_instructions text not null default '',
  payment_term_days integer not null default 14
    check (payment_term_days between 1 and 90),
  updated_at timestamptz not null default now(),
  constraint commerce_settings_singleton check (id = true)
);

insert into public.commerce_settings (id)
values (true)
on conflict (id) do nothing;

create sequence if not exists public.invoice_number_seq start with 1000;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  invoice_number bigint not null unique default nextval('public.invoice_number_seq'),
  photo_id uuid references public.photos(id) on delete set null,
  photo_title text not null,
  product_type text not null check (product_type in ('digital', 'print')),
  print_size text check (print_size in ('A3', 'A2')),
  unit_price_incl_vat numeric not null check (unit_price_incl_vat >= 0),
  net_amount numeric not null check (net_amount >= 0),
  vat_rate numeric not null default 0.25 check (vat_rate = 0.25),
  vat_amount numeric not null check (vat_amount >= 0),
  gross_amount numeric not null check (gross_amount >= 0),
  is_business boolean not null default false,
  customer_company_name text,
  customer_organization_number text,
  customer_vat_number text,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  customer_address_line1 text not null,
  customer_postal_code text not null,
  customer_city text not null,
  seller_snapshot jsonb not null,
  invoice_path text,
  invoice_email_status text not null default 'pending'
    check (invoice_email_status in ('pending', 'sent', 'failed')),
  invoice_email_error text,
  created_at timestamptz not null default now(),
  emailed_at timestamptz,
  constraint orders_print_size_matches_product check (
    (product_type = 'digital' and print_size is null)
    or (product_type = 'print' and print_size is not null)
  ),
  constraint orders_business_details check (
    (not is_business)
    or (
      customer_company_name is not null
      and customer_organization_number is not null
      and customer_vat_number is not null
    )
  )
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);

alter table public.commerce_settings enable row level security;
alter table public.orders enable row level security;

drop policy if exists "commerce_settings_auth_write" on public.commerce_settings;
create policy "commerce_settings_auth_write"
  on public.commerce_settings for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "orders_auth_read" on public.orders;
create policy "orders_auth_read"
  on public.orders for select
  to authenticated
  using (true);

grant select, insert, update, delete on public.commerce_settings to authenticated;
grant select on public.orders to authenticated;
grant all on public.commerce_settings, public.orders to service_role;
grant usage, select on sequence public.invoice_number_seq to service_role;

insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;
