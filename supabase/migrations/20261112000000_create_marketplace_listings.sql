create table public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  listing_type text not null check (listing_type in ('have', 'need')),
  currency_available text not null check (currency_available ~ '^[A-Z]{3}$'),
  currency_wanted text not null check (currency_wanted ~ '^[A-Z]{3}$'),
  amount numeric(20, 8) not null check (amount > 0),
  exchange_rate numeric(20, 8) not null check (exchange_rate > 0),
  payment_methods text[] not null default '{}',
  location text check (location is null or char_length(location) <= 80),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  constraint different_currencies check (currency_available <> currency_wanted),
  constraint listing_has_payment_method check (cardinality(payment_methods) > 0)
);

create index marketplace_listings_open_created_at_idx
  on public.marketplace_listings (created_at desc)
  where status = 'open';

alter table public.marketplace_listings enable row level security;

grant select (
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
) on public.marketplace_listings to anon, authenticated;

create policy "Anyone can read open listings"
  on public.marketplace_listings
  for select
  to anon, authenticated
  using (status = 'open');
