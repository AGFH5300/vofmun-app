begin;

-- Operational content is server-managed. Browser clients use authenticated Next
-- routes; service_role performs the underlying reads and writes.
create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  message text not null check (char_length(message) between 1 and 2000),
  kind text not null default 'announcement' check (kind in ('announcement', 'action', 'warning')),
  target_scope text not null default 'all' check (target_scope in ('all', 'role', 'committee', 'user')),
  target_role text check (target_role in ('delegate', 'chair', 'admin', 'secretariat')),
  target_committee_id uuid references public."Committee"("committeeID") on delete cascade,
  target_user_id uuid references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint app_notifications_target_check check (
    (target_scope = 'all' and target_role is null and target_committee_id is null and target_user_id is null)
    or (target_scope = 'role' and target_role is not null and target_committee_id is null and target_user_id is null)
    or (target_scope = 'committee' and target_role is null and target_committee_id is not null and target_user_id is null)
    or (target_scope = 'user' and target_role is null and target_committee_id is null and target_user_id is not null)
  )
);

create table if not exists public.notification_reads (
  notification_id uuid not null references public.app_notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create table if not exists public.conference_settings (
  id text primary key default 'current' check (id = 'current'),
  conference_name text not null default 'VOFMUN',
  timezone text not null default 'Asia/Dubai',
  utc_offset text not null default '+04:00' check (utc_offset ~ '^[+-][0-9]{2}:[0-9]{2}$'),
  start_at timestamptz,
  end_at timestamptz,
  schedule jsonb not null default '[]'::jsonb check (jsonb_typeof(schedule) = 'array'),
  crisis_status text not null default 'not_published' check (crisis_status in ('not_published', 'published')),
  crisis_title text,
  crisis_content text,
  crisis_media_url text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists app_notifications_created_at_idx
  on public.app_notifications(created_at desc);
create index if not exists app_notifications_target_user_idx
  on public.app_notifications(target_user_id) where target_user_id is not null;
create index if not exists app_notifications_target_committee_idx
  on public.app_notifications(target_committee_id) where target_committee_id is not null;
create index if not exists notification_reads_user_idx
  on public.notification_reads(user_id, read_at desc);

alter table public.app_notifications enable row level security;
alter table public.notification_reads enable row level security;
alter table public.conference_settings enable row level security;

revoke all on table public.app_notifications from public, anon, authenticated;
revoke all on table public.notification_reads from public, anon, authenticated;
revoke all on table public.conference_settings from public, anon, authenticated;
grant select, insert, update, delete on table public.app_notifications to service_role;
grant select, insert, update, delete on table public.notification_reads to service_role;
grant select, insert, update, delete on table public.conference_settings to service_role;

insert into public.conference_settings (
  id,
  conference_name,
  timezone,
  utc_offset,
  start_at,
  end_at,
  schedule
)
values (
  'current',
  'VOFMUN 2026',
  'Asia/Dubai',
  '+04:00',
  '2026-06-12T13:30:00+04:00',
  '2026-06-14T16:15:00+04:00',
  $schedule$[
    {"shortLabel":"Day 1","label":"Friday, June 12","dateISO":"2026-06-12","events":[
      {"label":"Registration","title":"Registration/Chair Briefing","start":"13:30","end":"14:00","type":"registration"},
      {"label":"Ceremony","title":"Opening Ceremony","start":"14:00","end":"15:00","type":"ceremony"},
      {"label":"Committee","title":"Committee Session 1","start":"15:00","end":"16:00","type":"committee"},
      {"label":"Break","title":"In-Committee Break","start":"16:00","end":"16:30","type":"break"},
      {"label":"Committee","title":"Committee Session 2","start":"16:30","end":"18:30","type":"committee"},
      {"label":"Departure","title":"Dispersal","start":"18:30","end":"18:45","type":"departure"}
    ]},
    {"shortLabel":"Day 2","label":"Saturday, June 13","dateISO":"2026-06-13","events":[
      {"label":"Registration","title":"Registration/Chair Briefing","start":"08:00","end":"08:30","type":"registration"},
      {"label":"Committee","title":"Committee Session 3","start":"08:30","end":"10:00","type":"committee"},
      {"label":"Break","title":"In-Committee Break","start":"10:00","end":"10:30","type":"break"},
      {"label":"Committee","title":"Committee Session 4","start":"10:30","end":"12:00","type":"committee"},
      {"label":"Break","title":"Lunch Break (food)","start":"12:00","end":"13:00","type":"break"},
      {"label":"Committee","title":"Committee Session 5","start":"13:00","end":"14:45","type":"committee"},
      {"label":"Break","title":"Break","start":"14:45","end":"15:00","type":"break"},
      {"label":"Committee","title":"Workshops & Seminar/Panel","start":"15:00","end":"17:30","type":"committee"},
      {"label":"Committee","title":"Committee Session 6","start":"17:00","end":"18:00","type":"committee"},
      {"label":"Departure","title":"Dispersal","start":"18:00","end":"18:15","type":"departure"},
      {"label":"Featured","title":"Social Night","start":"18:00","end":"20:00","type":"featured"},
      {"label":"Featured","title":"Post-Social Night Dispersal","start":"20:00","end":"20:15","type":"featured"}
    ]},
    {"shortLabel":"Day 3","label":"Sunday, June 14","dateISO":"2026-06-14","events":[
      {"label":"Registration","title":"Registration/Chair Briefing","start":"08:00","end":"08:30","type":"registration"},
      {"label":"Committee","title":"Committee Session 7","start":"08:30","end":"10:00","type":"committee"},
      {"label":"Break","title":"In-Committee Break","start":"10:00","end":"10:30","type":"break"},
      {"label":"Committee","title":"Committee Session 8","start":"10:30","end":"12:00","type":"committee"},
      {"label":"Break","title":"Lunch Break (food)","start":"12:00","end":"13:00","type":"break"},
      {"label":"Committee","title":"Committee Session 9","start":"13:00","end":"14:30","type":"committee"},
      {"label":"Ceremony","title":"Closing Ceremony","start":"14:30","end":"16:00","type":"ceremony"},
      {"label":"Departure","title":"Dispersal","start":"16:00","end":"16:15","type":"departure"}
    ]}
  ]$schedule$::jsonb
)
on conflict (id) do nothing;

commit;
