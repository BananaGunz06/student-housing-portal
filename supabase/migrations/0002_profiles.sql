-- Student Housing Portal · student profiles: public details, a private phone, and profile photos.
-- Run once in Supabase → SQL Editor, after 0001_accounts.sql. Safe to run again.

-- 1. Profile details other students can see.
alter table public.profiles add column if not exists bio text not null default '' check (char_length(bio) <= 300);
alter table public.profiles add column if not exists program text not null default '' check (char_length(program) <= 80);
alter table public.profiles add column if not exists year text check (year is null or year in ('1', '2', '3', '4', '5+', 'grad'));
alter table public.profiles add column if not exists move_in_term text check (move_in_term is null or move_in_term ~ '^\d{4}-(winter|summer|fall)$');
alter table public.profiles add column if not exists budget integer check (budget is null or budget between 300 and 5000);
alter table public.profiles add column if not exists looking_for_roommates boolean not null default false;
-- Where the photo is stored in the "avatars" bucket (<user id>/avatar.jpg), or empty when there is none.
alter table public.profiles add column if not exists avatar_path text;

-- 2. The phone moves to its own table that only its owner can read.
create table if not exists public.profile_private (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text check (phone is null or char_length(phone) <= 30)
);

alter table public.profile_private enable row level security;

drop policy if exists "own private: read" on public.profile_private;
drop policy if exists "own private: insert" on public.profile_private;
drop policy if exists "own private: update" on public.profile_private;
create policy "own private: read" on public.profile_private for select to authenticated using ((select auth.uid()) = id);
create policy "own private: insert" on public.profile_private for insert to authenticated with check ((select auth.uid()) = id);
create policy "own private: update" on public.profile_private for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Everyone who already has a profile gets a private row.
insert into public.profile_private (id) select id from public.profiles on conflict (id) do nothing;

-- Copy phones across, but only while the old column still exists (this makes a second run harmless).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'phone'
  ) then
    update public.profile_private pp
    set phone = p.phone
    from public.profiles p
    where p.id = pp.id and pp.phone is null and p.phone is not null;
  end if;
end
$$;

alter table public.profiles drop column if exists phone;

-- New sign-ups get a profile (named from the sign-up form), a private row and an empty state row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80))
  on conflict (id) do nothing;
  insert into public.profile_private (id) values (new.id) on conflict (id) do nothing;
  insert into public.user_state (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

-- 3. Signed-in users can read their own profile and the profiles of students looking for roommates.
drop policy if exists "own profile: read" on public.profiles;
drop policy if exists "profiles: read own or roommate seekers" on public.profiles;
create policy "profiles: read own or roommate seekers" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id or looking_for_roommates);

-- The Students list shows the newest profiles first.
create index if not exists profiles_roommates_updated_idx
  on public.profiles (updated_at desc) where looking_for_roommates;

-- 4. Profile photos: a private bucket, JPEG only, 1 MB at most.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, '{image/jpeg}')
on conflict (id) do update
  set public = false, file_size_limit = 1048576, allowed_mime_types = '{image/jpeg}';

-- Signed-in users can see photos; each user can only add, replace or delete files in their own folder.
drop policy if exists "avatars: read" on storage.objects;
drop policy if exists "avatars: insert own" on storage.objects;
drop policy if exists "avatars: update own" on storage.objects;
drop policy if exists "avatars: delete own" on storage.objects;
create policy "avatars: read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
create policy "avatars: insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
