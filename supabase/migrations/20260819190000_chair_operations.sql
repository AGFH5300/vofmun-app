-- Complete the committee-scoped chairing workspace using the authoritative
-- VOFMUN 2026 country matrices from AGFH5300/vofmun-website.
begin;

alter table public.app_users add column if not exists school text;
alter table public.app_users add column if not exists grade text;
alter table public."Delegate" add column if not exists school text;
alter table public."Delegate" add column if not exists grade text;

with source("committeeID", "committeeCode", name, fullname) as (
  values
  ('00000000-0000-4000-8000-000000000101'::uuid, 'GA1', 'General Assembly', 'Disarmament and International Security Committee (GA1)'),
  ('00000000-0000-4000-8000-000000000102'::uuid, 'UNHRC', 'United Nations Human Rights Council', 'United Nations Human Rights Council (UNHRC)'),
  ('00000000-0000-4000-8000-000000000103'::uuid, 'UNODC', 'United Nations Office on Drugs and Crime', 'United Nations Office on Drugs and Crime (UNODC)'),
  ('00000000-0000-4000-8000-000000000104'::uuid, 'ECOSOC', 'Economic and Social Council', 'United Nations Economic and Social Council (ECOSOC)'),
  ('00000000-0000-4000-8000-000000000105'::uuid, 'UNSC', 'United Nations Security Council', 'United Nations Security Council (UNSC)'),
  ('00000000-0000-4000-8000-000000000106'::uuid, 'ICRCC', 'International Cybersecurity Response Crisis Council', 'International Cybersecurity Response Crisis Council (ICRCC)')
)
update public."Committee" target
set name = source.name,
    fullname = source.fullname
from source
where lower(target."committeeCode") = lower(source."committeeCode");

with source("committeeID", "committeeCode", name, fullname) as (
  values
  ('00000000-0000-4000-8000-000000000101'::uuid, 'GA1', 'General Assembly', 'Disarmament and International Security Committee (GA1)'),
  ('00000000-0000-4000-8000-000000000102'::uuid, 'UNHRC', 'United Nations Human Rights Council', 'United Nations Human Rights Council (UNHRC)'),
  ('00000000-0000-4000-8000-000000000103'::uuid, 'UNODC', 'United Nations Office on Drugs and Crime', 'United Nations Office on Drugs and Crime (UNODC)'),
  ('00000000-0000-4000-8000-000000000104'::uuid, 'ECOSOC', 'Economic and Social Council', 'United Nations Economic and Social Council (ECOSOC)'),
  ('00000000-0000-4000-8000-000000000105'::uuid, 'UNSC', 'United Nations Security Council', 'United Nations Security Council (UNSC)'),
  ('00000000-0000-4000-8000-000000000106'::uuid, 'ICRCC', 'International Cybersecurity Response Crisis Council', 'International Cybersecurity Response Crisis Council (ICRCC)')
)
insert into public."Committee" ("committeeID", "committeeCode", name, fullname)
select source."committeeID", source."committeeCode", source.name, source.fullname
from source
where not exists (
  select 1
  from public."Committee" existing
  where lower(existing."committeeCode") = lower(source."committeeCode")
);

create table if not exists public.committee_matrix_seats (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public."Committee"("committeeID") on delete cascade,
  country_name text not null check (char_length(country_name) between 1 and 160),
  sort_order integer not null check (sort_order > 0),
  created_at timestamptz not null default now(),
  unique (committee_id, country_name),
  unique (committee_id, sort_order)
);

create table if not exists public.chair_committee_sessions (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public."Committee"("committeeID") on delete cascade,
  session_number integer not null default 1 check (session_number > 0),
  title text not null default 'Committee Session' check (char_length(title) between 1 and 160),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'active', 'paused', 'closed', 'archived')),
  state jsonb not null default '{"mode":"gsl","topic":"","activeSpeakerId":null,"timers":{"session":{"durationSeconds":5400,"elapsedSeconds":0,"startedAt":null,"running":false},"speaker":{"durationSeconds":90,"elapsedSeconds":0,"startedAt":null,"running":false},"caucus":{"durationSeconds":600,"elapsedSeconds":0,"startedAt":null,"running":false}},"speakers":[],"motions":[],"vote":null,"timeline":[]}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (committee_id, session_number),
  check (jsonb_typeof(state) = 'object')
);

create table if not exists public.chair_delegate_metrics (
  committee_id uuid not null references public."Committee"("committeeID") on delete cascade,
  delegate_id uuid not null references public.app_users(id) on delete cascade,
  attendance_status text not null default 'present'
    check (attendance_status in ('present', 'present_voting', 'absent', 'excused')),
  tallies jsonb not null default '{"speech":0,"motion":0,"poi":0,"amendment":0,"resolution":0,"diplomacy":0}'::jsonb,
  scores jsonb not null default '{"research":0,"speaking":0,"diplomacy":0,"procedure":0,"leadership":0,"resolution":0}'::jsonb,
  notes text not null default '' check (char_length(notes) <= 4000),
  award_status text not null default 'none'
    check (award_status in ('none', 'watch', 'honourable', 'outstanding', 'best')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (committee_id, delegate_id),
  check (jsonb_typeof(tallies) = 'object'),
  check (jsonb_typeof(scores) = 'object')
);

create or replace function public.sync_app_user_profile_to_legacy()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role = 'chair' then
    update public."Chair"
    set firstname = coalesce(new.first_name, firstname),
        lastname = coalesce(new.last_name, lastname),
        email = coalesce(new.email, email),
        "committeeID" = new.committee_id
    where "chairID" = new.legacy_id or auth_user_id = new.id;
  elsif new.role = 'delegate' then
    update public."Delegate"
    set firstname = coalesce(new.first_name, firstname),
        lastname = coalesce(new.last_name, lastname),
        email = coalesce(new.email, email),
        country = new.country,
        school = new.school,
        grade = new.grade,
        "committeeID" = new.committee_id,
        "resoPerms" = new.reso_perms
    where "delegateID" = new.legacy_id or auth_user_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_app_user_profile_to_legacy() from public, anon, authenticated;
grant execute on function public.sync_app_user_profile_to_legacy() to service_role;

drop trigger if exists app_users_sync_legacy_profile on public.app_users;
create trigger app_users_sync_legacy_profile
after update of first_name, last_name, email, committee_id, country, school, grade, reso_perms
on public.app_users
for each row execute function public.sync_app_user_profile_to_legacy();

create index if not exists committee_matrix_seats_committee_idx
  on public.committee_matrix_seats (committee_id, sort_order);
create index if not exists chair_sessions_committee_updated_idx
  on public.chair_committee_sessions (committee_id, updated_at desc);
create index if not exists chair_metrics_delegate_idx
  on public.chair_delegate_metrics (delegate_id);

drop trigger if exists chair_sessions_set_updated_at on public.chair_committee_sessions;
create trigger chair_sessions_set_updated_at
before update on public.chair_committee_sessions
for each row execute function public.update_updated_at_column();

insert into public.committee_matrix_seats (committee_id, country_name, sort_order)
select c."committeeID", source.country_name, source.sort_order
from (
  values
  ('GA1', 'Russian Federation', 1),
  ('GA1', 'Democratic People''s Republic of Korea', 2),
  ('GA1', 'The United States of America', 3),
  ('GA1', 'The United Kingdom', 4),
  ('GA1', 'Commonwealth of Australia', 5),
  ('GA1', 'Federative Republic of Brazil', 6),
  ('GA1', 'Japan', 7),
  ('GA1', 'Islamic Republic of Iran', 8),
  ('GA1', 'Canada', 9),
  ('GA1', 'People''s Republic of China', 10),
  ('GA1', 'Arab Republic of Egypt', 11),
  ('GA1', 'Kingdom of Spain', 12),
  ('GA1', 'French Republic', 13),
  ('GA1', 'Kingdom of the Netherlands', 14),
  ('GA1', 'Federal Republic of Germany', 15),
  ('GA1', 'Republic of India', 16),
  ('GA1', 'United Arab Emirates', 17),
  ('GA1', 'Republic of Türkiye', 18),
  ('GA1', 'Kingdom of Saudi Arabia', 19),
  ('GA1', 'Republic of Singapore', 20),
  ('GA1', 'Democratic Socialist Republic of Sri Lanka', 21),
  ('GA1', 'Ireland', 22),
  ('UNHRC', 'United States of America', 1),
  ('UNHRC', 'People''s Republic of China', 2),
  ('UNHRC', 'Kingdom of Saudi Arabia', 3),
  ('UNHRC', 'Republic of India', 4),
  ('UNHRC', 'United Arab Emirates', 5),
  ('UNHRC', 'State of Qatar', 6),
  ('UNHRC', 'Russian Federation', 7),
  ('UNHRC', 'United Kingdom', 8),
  ('UNHRC', 'Federal Republic of Germany', 9),
  ('UNHRC', 'French Republic', 10),
  ('UNHRC', 'Republic of the Philippines', 11),
  ('UNHRC', 'People''s Republic of Bangladesh', 12),
  ('UNHRC', 'Federal Democratic Republic of Nepal', 13),
  ('UNHRC', 'Democratic People''s Republic of Korea', 14),
  ('UNHRC', 'Republic of Korea', 15),
  ('UNODC', 'United Mexican States', 1),
  ('UNODC', 'Republic of Colombia', 2),
  ('UNODC', 'United States of America', 3),
  ('UNODC', 'People''s Republic of China', 4),
  ('UNODC', 'Russian Federation', 5),
  ('UNODC', 'United Kingdom', 6),
  ('UNODC', 'French Republic', 7),
  ('UNODC', 'Federal Republic of Germany', 8),
  ('UNODC', 'Republic of India', 9),
  ('UNODC', 'Federative Republic of Brazil', 10),
  ('UNODC', 'United Arab Emirates', 11),
  ('UNODC', 'Republic of Türkiye', 12),
  ('UNODC', 'Islamic Republic of Iran', 13),
  ('ECOSOC', 'United States of America', 1),
  ('ECOSOC', 'People''s Republic of China', 2),
  ('ECOSOC', 'Japan', 3),
  ('ECOSOC', 'Federal Republic of Germany', 4),
  ('ECOSOC', 'Republic of India', 5),
  ('ECOSOC', 'French Republic', 6),
  ('ECOSOC', 'United Kingdom', 7),
  ('ECOSOC', 'Republic of Korea', 8),
  ('ECOSOC', 'Republic of Singapore', 9),
  ('ECOSOC', 'United Arab Emirates', 10),
  ('ECOSOC', 'Federative Republic of Brazil', 11),
  ('ECOSOC', 'Canada', 12),
  ('ECOSOC', 'Republic of South Africa', 13),
  ('ECOSOC', 'Republic of Indonesia', 14),
  ('ECOSOC', 'United Mexican States', 15),
  ('ECOSOC', 'Socialist Republic of Vietnam', 16),
  ('ECOSOC', 'People''s Republic of Bangladesh', 17),
  ('ECOSOC', 'Republic of Kenya', 18),
  ('UNSC', 'United States of America', 1),
  ('UNSC', 'People''s Republic of China', 2),
  ('UNSC', 'Russian Federation', 3),
  ('UNSC', 'United Kingdom', 4),
  ('UNSC', 'French Republic', 5),
  ('UNSC', 'Republic of India', 6),
  ('UNSC', 'Islamic Republic of Pakistan', 7),
  ('UNSC', 'Islamic Republic of Iran', 8),
  ('UNSC', 'Democratic People''s Republic of Korea', 9),
  ('UNSC', 'Ukraine', 10),
  ('UNSC', 'Republic of Korea', 11),
  ('UNSC', 'Syrian Arab Republic', 12),
  ('UNSC', 'Republic of Iraq', 13),
  ('UNSC', 'Islamic Emirate of Afghanistan', 14),
  ('UNSC', 'Kingdom of Saudi Arabia', 15),
  ('ICRCC', 'Vostograd Union of Republics', 1),
  ('ICRCC', 'Russian Federation', 2),
  ('ICRCC', 'Ukraine', 3),
  ('ICRCC', 'United States of America', 4),
  ('ICRCC', 'People''s Republic of China', 5),
  ('ICRCC', 'United Kingdom', 6),
  ('ICRCC', 'Republic of China (Taiwan)', 7),
  ('ICRCC', 'Republic of India', 8),
  ('ICRCC', 'Democratic People''s Republic of Korea', 9),
  ('ICRCC', 'Syrian Arab Republic', 10),
  ('ICRCC', 'Federal Republic of Germany', 11),
  ('ICRCC', 'Japan', 12),
  ('ICRCC', 'Republic of South Africa', 13),
  ('ICRCC', 'Federative Republic of Brazil', 14),
  ('ICRCC', 'Republic of Singapore', 15),
  ('ICRCC', 'Kingdom of Saudi Arabia', 16),
  ('ICRCC', 'Commonwealth of Australia', 17),
  ('ICRCC', 'Federal Republic of Nigeria', 18)
) as source(committee_code, country_name, sort_order)
join public."Committee" c on lower(c."committeeCode") = lower(source.committee_code)
on conflict (committee_id, country_name) do update
set sort_order = excluded.sort_order;

insert into public.chair_committee_sessions (committee_id, session_number, title, status)
select c."committeeID", 1, 'Committee Session 1', 'scheduled'
from public."Committee" c
where upper(c."committeeCode") in ('GA1', 'UNHRC', 'UNODC', 'ECOSOC', 'UNSC', 'ICRCC')
on conflict (committee_id, session_number) do nothing;

alter table public.committee_matrix_seats enable row level security;
alter table public.chair_committee_sessions enable row level security;
alter table public.chair_delegate_metrics enable row level security;

revoke all on table public.committee_matrix_seats from public, anon, authenticated;
revoke all on table public.chair_committee_sessions from public, anon, authenticated;
revoke all on table public.chair_delegate_metrics from public, anon, authenticated;

grant select, insert, update, delete on table public.committee_matrix_seats to service_role;
grant select, insert, update, delete on table public.chair_committee_sessions to service_role;
grant select, insert, update, delete on table public.chair_delegate_metrics to service_role;

commit;
