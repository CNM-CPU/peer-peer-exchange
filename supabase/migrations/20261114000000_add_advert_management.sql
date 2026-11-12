alter table public.marketplace_listings
  add column completed_at timestamptz;

update public.marketplace_listings
set completed_at = created_at
where status = 'completed'
  and completed_at is null;

alter table public.marketplace_listings
  drop constraint if exists listing_has_payment_method;

alter table public.marketplace_listings
  add constraint marketplace_listings_advertiser_name_check
    check (char_length(pg_catalog.btrim(advertiser_name)) between 1 and 80);

create table public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default pg_catalog.now(),
  suspended_at timestamptz
);

insert into public.user_profiles (id, email, role, created_at)
select
  id,
  email,
  case when raw_app_meta_data ->> 'role' = 'admin' then 'admin' else 'user' end,
  created_at
from auth.users
on conflict (id) do update
set email = excluded.email,
    role = excluded.role;

create or replace function public.sync_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (id, email, role, created_at)
  values (
    new.id,
    new.email,
    case when new.raw_app_meta_data ->> 'role' = 'admin' then 'admin' else 'user' end,
    coalesce(new.created_at, pg_catalog.now())
  )
  on conflict (id) do update
  set email = excluded.email,
      role = excluded.role;
  return new;
end;
$$;

drop trigger if exists sync_user_profile_after_auth_change on auth.users;

create trigger sync_user_profile_after_auth_change
  after insert or update of email, raw_app_meta_data on auth.users
  for each row execute function public.sync_user_profile();

alter table public.user_profiles enable row level security;

grant select (id, email, role, created_at, suspended_at)
  on public.user_profiles to authenticated;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false);
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.user_profiles
      where id = auth.uid()
        and suspended_at is null
    );
$$;

create or replace function public.is_profile_active(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_profiles
    where id = p_user_id
      and suspended_at is null
  );
$$;

revoke all on function public.is_platform_admin() from public, anon;
revoke all on function public.is_active_user() from public, anon;
revoke all on function public.is_profile_active(uuid) from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_profile_active(uuid) to authenticated;

create policy "Users can read own profile and admins can read all"
  on public.user_profiles
  for select
  to authenticated
  using (id = auth.uid() or (public.is_platform_admin() and public.is_active_user()));

drop policy if exists "Authenticated users can read available listings"
  on public.marketplace_listings;

create policy "Active users can read available listings"
  on public.marketplace_listings
  for select
  to authenticated
  using (
    status = 'available'
    and public.is_active_user()
    and public.is_profile_active(owner_id)
  );

create policy "Active users can create own listings"
  on public.marketplace_listings
  for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    and status = 'available'
    and public.is_active_user()
  );

grant select (owner_id) on public.marketplace_listings to authenticated;

grant insert (
  owner_id,
  listing_type,
  currency_available,
  currency_wanted,
  amount,
  exchange_rate,
  advertiser_name,
  whatsapp_number
) on public.marketplace_listings to authenticated;

create table public.listing_status_events (
  id bigint generated always as identity primary key,
  listing_id uuid not null,
  actor_id uuid references auth.users (id) on delete set null,
  event_type text not null check (event_type in ('created', 'reserved', 'expired', 'completed', 'reopened')),
  occurred_at timestamptz not null default pg_catalog.now()
);

create index listing_status_events_completed_at_idx
  on public.listing_status_events (occurred_at desc)
  where event_type = 'completed';

alter table public.listing_status_events enable row level security;

grant select on public.listing_status_events to authenticated;

create policy "Admins can read listing analytics events"
  on public.listing_status_events
  for select
  to authenticated
  using (public.is_platform_admin() and public.is_active_user());

create or replace function public.record_listing_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_event text;
begin
  if tg_op = 'INSERT' then
    next_event := 'created';
  elsif old.status is distinct from new.status then
    next_event := case new.status
      when 'reserved' then 'reserved'
      when 'expired' then 'expired'
      when 'completed' then 'completed'
      when 'available' then 'reopened'
      else null
    end;
  end if;

  if next_event is not null then
    insert into public.listing_status_events (listing_id, actor_id, event_type)
    values (
      new.id,
      case when next_event = 'expired' then null else auth.uid() end,
      next_event
    );
  end if;
  return new;
end;
$$;

create trigger record_listing_status_event_after_change
  after insert or update of status on public.marketplace_listings
  for each row execute function public.record_listing_status_event();

create or replace function public.expire_stale_listings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'An active signed-in account is required';
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
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'An active signed-in account is required';
  end if;

  update public.marketplace_listings
  set status = 'reserved',
      reserved_by = auth.uid(),
      reserved_at = pg_catalog.now(),
      expires_at = pg_catalog.now() + interval '20 minutes',
      expired_at = null
  where id = p_listing_id
    and status = 'available'
    and owner_id <> auth.uid()
    and public.is_profile_active(owner_id);

  return found;
end;
$$;

create or replace function public.complete_listing(p_listing_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'An active signed-in account is required';
  end if;

  update public.marketplace_listings
  set status = 'completed',
      completed_at = pg_catalog.now(),
      expires_at = null
  where id = p_listing_id
    and status = 'reserved'
    and reserved_by = auth.uid()
    and expires_at > pg_catalog.now();

  return found;
end;
$$;

create or replace function public.set_user_suspended(
  p_user_id uuid,
  p_suspended boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_platform_admin() or not public.is_active_user() then
    raise exception 'Admin access is required';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Admins cannot suspend their own account';
  end if;
  if exists (
    select 1
    from auth.users
    where id = p_user_id
      and raw_app_meta_data ->> 'role' = 'admin'
  ) then
    raise exception 'Admin accounts cannot be suspended from this panel';
  end if;

  update public.user_profiles
  set suspended_at = case
    when p_suspended then coalesce(suspended_at, pg_catalog.now())
    else null
  end
  where id = p_user_id;

  return found;
end;
$$;

create or replace function public.admin_dashboard()
returns table (
  completed_transactions bigint,
  registered_users bigint,
  available_listings bigint,
  reserved_listings bigint,
  monthly_completions jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_platform_admin() or not public.is_active_user() then
    raise exception 'Admin access is required';
  end if;

  return query
  select
    (select count(*) from public.marketplace_listings where status = 'completed'),
    (select count(*) from public.user_profiles),
    (
      select count(*)
      from public.marketplace_listings
      where status = 'available'
        and public.is_profile_active(owner_id)
    ),
    (select count(*) from public.marketplace_listings where status = 'reserved'),
    coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object('month', month_counts.month, 'count', month_counts.count)
          order by month_counts.month
        )
        from (
          select
            pg_catalog.to_char(pg_catalog.date_trunc('month', occurred_at), 'YYYY-MM') as month,
            count(*) as count
          from public.listing_status_events
          where event_type = 'completed'
            and occurred_at >= pg_catalog.date_trunc('month', pg_catalog.now()) - interval '11 months'
          group by pg_catalog.date_trunc('month', occurred_at)
        ) as month_counts
      ),
      '[]'::jsonb
    );
end;
$$;

revoke all on function public.sync_user_profile() from public, anon, authenticated;
revoke all on function public.record_listing_status_event() from public, anon, authenticated;
revoke all on function public.set_user_suspended(uuid, boolean) from public, anon;
revoke all on function public.admin_dashboard() from public, anon;
grant execute on function public.set_user_suspended(uuid, boolean) to authenticated;
grant execute on function public.admin_dashboard() to authenticated;
