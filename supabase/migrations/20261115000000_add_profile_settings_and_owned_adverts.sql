alter table public.user_profiles
  add column if not exists display_name text,
  add column if not exists avatar_path text;

update public.user_profiles as profile
set display_name = nullif(pg_catalog.btrim(auth_user.raw_user_meta_data ->> 'display_name'), '')
from auth.users as auth_user
where profile.id = auth_user.id
  and profile.display_name is null;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'user_profiles_display_name_check'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_display_name_check
      check (display_name is null or char_length(pg_catalog.btrim(display_name)) between 1 and 80);
  end if;
end;
$$;

grant update (display_name, avatar_path) on public.user_profiles to authenticated;
grant select (display_name, avatar_path) on public.user_profiles to authenticated;

drop policy if exists "Users can update own profile settings" on public.user_profiles;
create policy "Users can update own profile settings"
  on public.user_profiles
  for update
  to authenticated
  using (id = auth.uid() and public.is_active_user())
  with check (
    id = auth.uid()
    and public.is_active_user()
    and (avatar_path is null or avatar_path like auth.uid()::text || '/%')
  );

drop policy if exists "Owners can read own adverts" on public.marketplace_listings;
create policy "Owners can read own adverts"
  on public.marketplace_listings
  for select
  to authenticated
  using (owner_id = auth.uid() and public.is_active_user());

grant update (
  advertiser_name,
  whatsapp_number,
  currency_available,
  currency_wanted,
  amount,
  exchange_rate
) on public.marketplace_listings to authenticated;
grant delete on public.marketplace_listings to authenticated;

drop policy if exists "Active users can edit own available adverts" on public.marketplace_listings;
create policy "Active users can edit own available adverts"
  on public.marketplace_listings
  for update
  to authenticated
  using (owner_id = auth.uid() and status = 'available' and public.is_active_user())
  with check (owner_id = auth.uid() and status = 'available' and public.is_active_user());

drop policy if exists "Active users can remove own available adverts" on public.marketplace_listings;
create policy "Active users can remove own available adverts"
  on public.marketplace_listings
  for delete
  to authenticated
  using (owner_id = auth.uid() and status = 'available' and public.is_active_user());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read own avatar files" on storage.objects;
create policy "Users can read own avatar files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and (select public.is_active_user())
  );

drop policy if exists "Users can upload own avatar files" on storage.objects;
create policy "Users can upload own avatar files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and (select public.is_active_user())
  );

drop policy if exists "Users can update own avatar files" on storage.objects;
create policy "Users can update own avatar files"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and (select public.is_active_user())
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and (select public.is_active_user())
  );

drop policy if exists "Users can delete own avatar files" on storage.objects;
create policy "Users can delete own avatar files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and (select public.is_active_user())
  );
