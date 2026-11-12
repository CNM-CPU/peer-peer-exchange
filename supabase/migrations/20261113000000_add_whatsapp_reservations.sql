alter table public.marketplace_listings
  add column advertiser_name text not null default 'Community member',
  add column whatsapp_number text,
  add column reserved_by uuid references auth.users (id),
  add column reserved_at timestamptz,
  add column expires_at timestamptz,
  add column expired_at timestamptz;

alter table public.marketplace_listings
  drop constraint if exists marketplace_listings_status_check,
  drop constraint if exists marketplace_listings_currency_available_check,
  drop constraint if exists marketplace_listings_currency_wanted_check;

update public.marketplace_listings
set status = case status
  when 'open' then 'available'
  when 'closed' then 'completed'
  else status
end;

alter table public.marketplace_listings
  alter column status set default 'available',
  add constraint marketplace_listings_status_check
    check (status in ('available', 'reserved', 'completed', 'expired')),
  add constraint marketplace_listings_currency_available_check
    check (currency_available ~ '^[A-Z][A-Z0-9_]{1,15}$'),
  add constraint marketplace_listings_currency_wanted_check
    check (currency_wanted ~ '^[A-Z][A-Z0-9_]{1,15}$'),
  add constraint marketplace_listings_whatsapp_number_check
    check (whatsapp_number is null or whatsapp_number ~ '^\+?[1-9][0-9]{7,14}$'),
  add constraint marketplace_listings_reserved_fields_check
    check (
      (status = 'reserved' and reserved_by is not null and reserved_at is not null and expires_at is not null)
      or status <> 'reserved'
    );

drop index if exists public.marketplace_listings_open_created_at_idx;

create index marketplace_listings_available_created_at_idx
  on public.marketplace_listings (created_at desc)
  where status = 'available';

revoke select (
  id,
  listing_type,
  currency_available,
  currency_wanted,
  amount,
  exchange_rate,
  payment_methods,
  location,
  note,
  status,
  created_at
) on public.marketplace_listings from anon;

grant select (
  id,
  advertiser_name,
  whatsapp_number,
  listing_type,
  currency_available,
  currency_wanted,
  amount,
  exchange_rate,
  status,
  created_at
) on public.marketplace_listings to authenticated;

drop policy if exists "Anyone can read open listings" on public.marketplace_listings;

create policy "Authenticated users can read available listings"
  on public.marketplace_listings
  for select
  to authenticated
  using (status = 'available');

create or replace function public.expire_stale_listings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sign-in is required';
  end if;

  update public.marketplace_listings
  set status = 'available',
      reserved_by = null,
      reserved_at = null,
      expires_at = null,
      expired_at = null
  where status = 'expired'
    and expired_at <= pg_catalog.now() - interval '15 seconds';

  get diagnostics updated_count = row_count;

  update public.marketplace_listings
  set status = 'expired',
      expired_at = pg_catalog.now(),
      reserved_by = null,
      reserved_at = null,
      expires_at = null
  where status = 'reserved'
    and expires_at <= pg_catalog.now();

  return updated_count;
end;
$$;

create or replace function public.reserve_listing(p_listing_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign-in is required';
  end if;

  update public.marketplace_listings
  set status = 'reserved',
      reserved_by = auth.uid(),
      reserved_at = pg_catalog.now(),
      expires_at = pg_catalog.now() + interval '20 minutes',
      expired_at = null
  where id = p_listing_id
    and status = 'available'
    and owner_id <> auth.uid();

  if not found then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.complete_listing(p_listing_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign-in is required';
  end if;

  update public.marketplace_listings
  set status = 'completed',
      expires_at = null
  where id = p_listing_id
    and status = 'reserved'
    and reserved_by = auth.uid()
    and expires_at > pg_catalog.now();

  return found;
end;
$$;

revoke all on function public.expire_stale_listings() from public, anon;
revoke all on function public.reserve_listing(uuid) from public, anon;
revoke all on function public.complete_listing(uuid) from public, anon;
grant execute on function public.expire_stale_listings() to authenticated;
grant execute on function public.reserve_listing(uuid) to authenticated;
grant execute on function public.complete_listing(uuid) to authenticated;
