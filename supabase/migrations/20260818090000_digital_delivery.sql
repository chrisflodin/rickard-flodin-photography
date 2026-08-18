-- Track secure customer delivery of purchased digital originals.

alter table public.orders
  add column if not exists digital_delivery_status text not null default 'not_sent',
  add column if not exists digital_delivery_token_hash text,
  add column if not exists digital_delivery_token_expires_at timestamptz,
  add column if not exists digital_delivery_started_at timestamptz,
  add column if not exists digital_delivery_sent_at timestamptz,
  add column if not exists digital_delivery_error text;

alter table public.orders
  drop constraint if exists orders_digital_delivery_status_check;

alter table public.orders
  add constraint orders_digital_delivery_status_check
    check (digital_delivery_status in ('not_sent', 'sending', 'sent', 'failed'));

create unique index if not exists orders_digital_delivery_token_hash_idx
  on public.orders (digital_delivery_token_hash)
  where digital_delivery_token_hash is not null;
