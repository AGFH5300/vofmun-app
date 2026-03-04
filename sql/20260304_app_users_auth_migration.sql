-- Unified app_users profile table + auth trigger + delegate backfill

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  first_name text,
  last_name text,
  role text not null default 'delegate' check (role in ('delegate', 'chair', 'secretariat', 'admin')),
  committee_id uuid null,
  country text null,
  reso_perms jsonb not null default '{"update:reso": [], "view:allreso": false, "view:ownreso": true, "update:ownreso": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_app_users_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_app_users_set_updated_at on public.app_users;
create trigger trg_app_users_set_updated_at
before update on public.app_users
for each row
execute function public.set_app_users_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_users (id, email, role)
  values (new.id, lower(new.email), 'delegate')
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Backfill app_users for existing auth users that were stored as delegates
insert into public.app_users (
  id,
  email,
  first_name,
  last_name,
  role,
  committee_id,
  country,
  reso_perms
)
select
  au.id,
  lower(coalesce(d.email, au.email)) as email,
  d.firstname as first_name,
  d.lastname as last_name,
  'delegate' as role,
  nullif(d."committeeID", '')::uuid as committee_id,
  d.country,
  coalesce(
    d."resoPerms"::jsonb,
    '{"update:reso": [], "view:allreso": false, "view:ownreso": true, "update:ownreso": true}'::jsonb
  ) as reso_perms
from auth.users au
join public."Delegate" d
  on d."delegateID"::uuid = au.id
on conflict (id) do update
set
  email = excluded.email,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  committee_id = excluded.committee_id,
  country = excluded.country,
  reso_perms = excluded.reso_perms,
  updated_at = now();

-- Optional RLS baseline (apply after validating current project policies):
-- alter table public.app_users enable row level security;
-- create policy "Users can read own app_users profile"
--   on public.app_users for select
--   to authenticated
--   using (auth.uid() = id);
-- create policy "Users can update own app_users profile"
--   on public.app_users for update
--   to authenticated
--   using (auth.uid() = id)
--   with check (auth.uid() = id);
