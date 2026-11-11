-- Student Housing Portal · part 1: accounts and synced data.
-- Run once in Supabase → SQL Editor. Safe to run again.

-- Profiles: one per signed-up user.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  phone text check (phone is null or char_length(phone) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- What follows the user between devices.
create table if not exists public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  budget integer check (budget is null or budget between 300 and 5000),
  filters jsonb,
  saved_ids text[] not null default '{}',
  -- Demo messages until real messaging (part 3) has its own tables.
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Only the owner can see or change their rows. Visitors who aren't signed in can't read either table.
alter table public.profiles enable row level security;
alter table public.user_state enable row level security;

drop policy if exists "own profile: read" on public.profiles;
drop policy if exists "own profile: insert" on public.profiles;
drop policy if exists "own profile: update" on public.profiles;
create policy "own profile: read" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "own profile: insert" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "own profile: update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "own state: read" on public.user_state;
drop policy if exists "own state: insert" on public.user_state;
drop policy if exists "own state: update" on public.user_state;
create policy "own state: read" on public.user_state for select to authenticated using ((select auth.uid()) = user_id);
create policy "own state: insert" on public.user_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own state: update" on public.user_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- New sign-ups get a profile (named from the sign-up form) and an empty state row.
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
  insert into public.user_state (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lets a signed-in user delete their own account (and, by cascade, their rows). Acts only on the caller.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
