begin;

-- Link each Supabase-authenticated profile to the legacy document identity used
-- by Resos / Delegate-Speech / Chair-Speech. This avoids assuming that an
-- auth.users UUID is the same value as the older delegateID/chairID keys.
alter table public.app_users
  add column if not exists legacy_id text;

update public.app_users as app_user
set legacy_id = case app_user.role
  when 'delegate' then (
    select delegate."delegateID"
    from public."Delegate" as delegate
    where lower(trim(delegate.email)) = lower(trim(app_user.email))
    order by delegate."delegateID"
    limit 1
  )
  when 'chair' then (
    select chair."chairID"
    from public."Chair" as chair
    where lower(trim(chair.email)) = lower(trim(app_user.email))
    order by chair."chairID"
    limit 1
  )
  when 'admin' then (
    select admin_user."adminID"
    from public."Admin" as admin_user
    where lower(trim(admin_user.email)) = lower(trim(app_user.email))
    order by admin_user."adminID"
    limit 1
  )
  when 'secretariat' then (
    select secretariat."secretariatID"
    from public."Secretariat" as secretariat
    where lower(trim(secretariat.email)) = lower(trim(app_user.email))
    order by secretariat."secretariatID"
    limit 1
  )
  else null
end
where app_user.legacy_id is null
  and app_user.email is not null;

create unique index if not exists app_users_role_legacy_id_key
  on public.app_users (role, legacy_id)
  where legacy_id is not null;

create or replace function public.sync_app_user_legacy_id()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.email := nullif(lower(trim(new.email)), '');

  if new.email is null then
    new.legacy_id := null;
    return new;
  end if;

  if tg_op = 'INSERT'
     or new.email is distinct from old.email
     or new.role is distinct from old.role
     or new.legacy_id is null then
    new.legacy_id := case new.role
      when 'delegate' then (
        select delegate."delegateID"
        from public."Delegate" as delegate
        where lower(trim(delegate.email)) = new.email
        order by delegate."delegateID"
        limit 1
      )
      when 'chair' then (
        select chair."chairID"
        from public."Chair" as chair
        where lower(trim(chair.email)) = new.email
        order by chair."chairID"
        limit 1
      )
      when 'admin' then (
        select admin_user."adminID"
        from public."Admin" as admin_user
        where lower(trim(admin_user.email)) = new.email
        order by admin_user."adminID"
        limit 1
      )
      when 'secretariat' then (
        select secretariat."secretariatID"
        from public."Secretariat" as secretariat
        where lower(trim(secretariat.email)) = new.email
        order by secretariat."secretariatID"
        limit 1
      )
      else null
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists app_users_sync_legacy_id on public.app_users;
create trigger app_users_sync_legacy_id
before insert or update of email, role, legacy_id
on public.app_users
for each row execute function public.sync_app_user_legacy_id();

revoke all on function public.sync_app_user_legacy_id() from public, anon, authenticated;

-- Password authentication is handled exclusively by Supabase Auth. The legacy
-- plaintext/password columns are not used by the application and must not
-- remain queryable in production.
alter table public."Delegate" drop column if exists password;
alter table public."Chair" drop column if exists password;
alter table public."Admin" drop column if exists password;
alter table public."Secretariat" drop column if exists password;

-- Server-controlled helpers used by RLS policies. They bypass app_users RLS
-- only to read the current authenticated user's own authorization record.
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.app_users where id = auth.uid()
$$;

create or replace function public.current_app_committee_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select committee_id from public.app_users where id = auth.uid()
$$;

create or replace function public.current_legacy_id()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select legacy_id from public.app_users where id = auth.uid()
$$;

create or replace function public.current_reso_perms()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(reso_perms, '{}'::jsonb)
  from public.app_users
  where id = auth.uid()
$$;

revoke all on function public.current_app_role() from public, anon;
revoke all on function public.current_app_committee_id() from public, anon;
revoke all on function public.current_legacy_id() from public, anon;
revoke all on function public.current_reso_perms() from public, anon;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_app_committee_id() to authenticated;
grant execute on function public.current_legacy_id() to authenticated;
grant execute on function public.current_reso_perms() to authenticated;

-- Missing table used by the in-app support form.
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  display_name text,
  country text,
  committee_id uuid references public."Committee"("committeeID") on delete set null,
  committee_name text,
  role text,
  message text not null check (char_length(message) between 1 and 4000),
  source text not null default 'delegate_nav_support',
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_requests add column if not exists status text not null default 'open';
alter table public.support_requests add column if not exists updated_at timestamptz not null default now();

create index if not exists support_requests_user_id_idx on public.support_requests(user_id);
create index if not exists support_requests_status_created_at_idx on public.support_requests(status, created_at desc);

drop trigger if exists support_requests_set_updated_at on public.support_requests;
create trigger support_requests_set_updated_at
before update on public.support_requests
for each row execute function public.update_updated_at_column();

-- These functions reference tables that are absent from the production schema
-- dump and are unused by the application. Remove the broken entry points.
drop function if exists public.create_notification(uuid, character varying, text, character varying, character varying, uuid);
drop function if exists public.log_system_action(uuid, character varying, character varying, uuid, jsonb);

-- Pending uploads are service-role-only staging records. A browser receives a
-- one-time upload_id, and the message API consumes the trusted server record.
create table if not exists public.pending_chat_attachments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  bucket text not null default 'chat-attachments' check (bucket = 'chat-attachments'),
  path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 255),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

create index if not exists pending_chat_attachments_creator_created_idx
  on public.pending_chat_attachments(created_by, created_at desc);
create index if not exists pending_chat_attachments_room_created_idx
  on public.pending_chat_attachments(room_id, created_at desc);
create index if not exists pending_chat_attachments_unconsumed_idx
  on public.pending_chat_attachments(created_at)
  where consumed_at is null;

alter table public.pending_chat_attachments enable row level security;
revoke all on table public.pending_chat_attachments from anon, authenticated;

-- Storage required by the app. Live updates are intentionally public; chat
-- attachments stay private and are accessed only through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'Updates',
  'Updates',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false,
  26214400,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- Atomic creation functions prevent user-scoped reads from generating duplicate
-- global four-digit IDs and ensure speeches cannot be left without ownership.
create or replace function public.create_resolution(
  p_title text,
  p_content jsonb
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_id text;
  legacy_delegate_id text := public.current_legacy_id();
  committee_id uuid := public.current_app_committee_id();
  permissions jsonb := public.current_reso_perms();
begin
  if auth.uid() is null or public.current_app_role() <> 'delegate' then
    raise exception 'Only authenticated delegates can create resolutions' using errcode = '42501';
  end if;
  if legacy_delegate_id is null or committee_id is null then
    raise exception 'Delegate profile is not linked to a legacy conference identity' using errcode = '23503';
  end if;
  if not coalesce((permissions ->> 'update:ownreso')::boolean, false) then
    raise exception 'Resolution creation is not permitted for this delegate' using errcode = '42501';
  end if;
  if nullif(trim(p_title), '') is null or char_length(trim(p_title)) > 255 then
    raise exception 'Resolution title is required and must be at most 255 characters' using errcode = '22023';
  end if;
  if p_content is null then
    raise exception 'Resolution content is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('vofmun:create-resolution'));

  if exists (
    select 1 from public."Resos"
    where "delegateID" = legacy_delegate_id
  ) then
    raise exception 'A delegate may create only one resolution' using errcode = '23505';
  end if;

  select lpad((coalesce(max(
    case when "resoID" ~ '^[0-9]+$' then "resoID"::integer end
  ), 0) + 1)::text, 4, '0')
  into next_id
  from public."Resos";

  insert into public."Resos" (
    "resoID", title, "delegateID", "committeeID", content, "isNew"
  ) values (
    next_id, trim(p_title), legacy_delegate_id, committee_id, p_content, false
  );

  return next_id;
end;
$$;

create or replace function public.create_speech(
  p_title text,
  p_content text,
  p_date text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_id text;
  app_role text := public.current_app_role();
  legacy_owner_id text := public.current_legacy_id();
begin
  if auth.uid() is null or app_role not in ('delegate', 'chair') then
    raise exception 'Only authenticated delegates and chairs can create speeches' using errcode = '42501';
  end if;
  if legacy_owner_id is null then
    raise exception 'Conference profile is not linked to a legacy identity' using errcode = '23503';
  end if;
  if nullif(trim(p_title), '') is null or char_length(trim(p_title)) > 255 then
    raise exception 'Speech title is required and must be at most 255 characters' using errcode = '22023';
  end if;
  if nullif(trim(p_content), '') is null then
    raise exception 'Speech content is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('vofmun:create-speech'));

  select lpad((coalesce(max(
    case when "speechID" ~ '^[0-9]+$' then "speechID"::integer end
  ), 0) + 1)::text, 4, '0')
  into next_id
  from public."Speech";

  insert into public."Speech" ("speechID", title, content, date)
  values (next_id, trim(p_title), p_content, p_date);

  if app_role = 'delegate' then
    insert into public."Delegate-Speech" ("speechID", "delegateID")
    values (next_id, legacy_owner_id);
  else
    insert into public."Chair-Speech" ("speechID", "chairID")
    values (next_id, legacy_owner_id);
  end if;

  return next_id;
end;
$$;


create or replace function public.delete_speech(
  p_speech_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  app_role text := public.current_app_role();
  legacy_owner_id text := public.current_legacy_id();
begin
  if auth.uid() is null or app_role not in ('delegate', 'chair') then
    raise exception 'Only authenticated delegates and chairs can delete speeches' using errcode = '42501';
  end if;
  if legacy_owner_id is null then
    raise exception 'Conference profile is not linked to a legacy identity' using errcode = '23503';
  end if;

  if app_role = 'delegate' then
    if not exists (
      select 1 from public."Delegate-Speech"
      where "speechID" = p_speech_id and "delegateID" = legacy_owner_id
    ) then
      raise exception 'Speech is not owned by this delegate' using errcode = '42501';
    end if;
    delete from public."Delegate-Speech"
    where "speechID" = p_speech_id and "delegateID" = legacy_owner_id;
  else
    if not exists (
      select 1 from public."Chair-Speech"
      where "speechID" = p_speech_id and "chairID" = legacy_owner_id
    ) then
      raise exception 'Speech is not owned by this chair' using errcode = '42501';
    end if;
    delete from public."Chair-Speech"
    where "speechID" = p_speech_id and "chairID" = legacy_owner_id;
  end if;

  delete from public."Speech" where "speechID" = p_speech_id;
  if not found then
    raise exception 'Speech does not exist' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.create_resolution(text, jsonb) from public, anon;
revoke all on function public.create_speech(text, text, text) from public, anon;
revoke all on function public.delete_speech(text) from public, anon;
grant execute on function public.create_resolution(text, jsonb) to authenticated;
grant execute on function public.create_speech(text, text, text) to authenticated;
grant execute on function public.delete_speech(text) to authenticated;

-- Enable RLS on every client-visible application table. Service-role server
-- routes continue to bypass RLS; browser clients receive only the policies below.
alter table public.app_users enable row level security;
alter table public."Committee" enable row level security;
alter table public."Announcement" enable row level security;
alter table public."Updates" enable row level security;
alter table public."Resos" enable row level security;
alter table public."Speech" enable row level security;
alter table public."Delegate-Speech" enable row level security;
alter table public."Chair-Speech" enable row level security;
alter table public.support_requests enable row level security;
alter table public.friend_requests enable row level security;
alter table public."Delegate" enable row level security;
alter table public."Chair" enable row level security;
alter table public."Admin" enable row level security;
alter table public."Secretariat" enable row level security;

-- Legacy identity rows are available only to security-definer helpers and the
-- service role. Browser clients must never query these tables directly.
revoke all on table public."Delegate" from anon, authenticated;
revoke all on table public."Chair" from anon, authenticated;
revoke all on table public."Admin" from anon, authenticated;
revoke all on table public."Secretariat" from anon, authenticated;
revoke all on table public.friend_requests from anon, authenticated;

-- app_users: self profile, chair's committee roster, or admin/secretariat.
drop policy if exists app_users_select_scoped on public.app_users;
create policy app_users_select_scoped
on public.app_users for select to authenticated
using (
  id = auth.uid()
  or public.current_app_role() in ('admin', 'secretariat')
  or (
    public.current_app_role() = 'chair'
    and committee_id is not null
    and committee_id = public.current_app_committee_id()
  )
);

drop policy if exists app_users_insert_self_delegate on public.app_users;
create policy app_users_insert_self_delegate
on public.app_users for insert to authenticated
with check (
  id = auth.uid()
  and role = 'delegate'
  and committee_id is null
  and lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  and reso_perms = '{"update:reso": [], "view:allreso": false, "view:ownreso": true, "update:ownreso": true}'::jsonb
);

drop policy if exists app_users_admin_manage on public.app_users;
create policy app_users_admin_manage
on public.app_users for all to authenticated
using (public.current_app_role() in ('admin', 'secretariat'))
with check (public.current_app_role() in ('admin', 'secretariat'));

revoke all on table public.app_users from anon, authenticated;
grant select, insert, update, delete on table public.app_users to authenticated;

-- Shared conference reference data.
drop policy if exists committee_authenticated_read on public."Committee";
create policy committee_authenticated_read
on public."Committee" for select to authenticated
using (true);

drop policy if exists committee_admin_manage on public."Committee";
create policy committee_admin_manage
on public."Committee" for all to authenticated
using (public.current_app_role() in ('admin', 'secretariat'))
with check (public.current_app_role() in ('admin', 'secretariat'));

revoke all on table public."Committee" from anon, authenticated;
grant select, insert, update, delete on table public."Committee" to authenticated;

drop policy if exists announcement_authenticated_read on public."Announcement";
create policy announcement_authenticated_read
on public."Announcement" for select to authenticated
using (true);

drop policy if exists announcement_admin_manage on public."Announcement";
create policy announcement_admin_manage
on public."Announcement" for all to authenticated
using (public.current_app_role() in ('admin', 'secretariat'))
with check (public.current_app_role() in ('admin', 'secretariat'));

drop policy if exists updates_authenticated_read on public."Updates";
create policy updates_authenticated_read
on public."Updates" for select to authenticated
using (true);

drop policy if exists updates_admin_manage on public."Updates";
create policy updates_admin_manage
on public."Updates" for all to authenticated
using (public.current_app_role() in ('admin', 'secretariat'))
with check (public.current_app_role() in ('admin', 'secretariat'));

revoke all on table public."Announcement" from anon, authenticated;
revoke all on table public."Updates" from anon, authenticated;
grant select, insert, update, delete on table public."Announcement" to authenticated;
grant select, insert, update, delete on table public."Updates" to authenticated;

-- Resolution permissions preserve the existing committee and reso_perms model.
drop policy if exists resos_select_scoped on public."Resos";
create policy resos_select_scoped
on public."Resos" for select to authenticated
using (
  public.current_app_role() in ('admin', 'secretariat')
  or (
    public.current_app_role() = 'chair'
    and "committeeID" = public.current_app_committee_id()
  )
  or (
    public.current_app_role() = 'delegate'
    and (
      "delegateID" = public.current_legacy_id()
      or (
        coalesce((public.current_reso_perms() ->> 'view:allreso')::boolean, false)
        and "committeeID" = public.current_app_committee_id()
      )
    )
  )
);

drop policy if exists resos_insert_scoped on public."Resos";
create policy resos_insert_scoped
on public."Resos" for insert to authenticated
with check (
  public.current_app_role() in ('admin', 'secretariat')
  or (
    public.current_app_role() = 'delegate'
    and public.current_legacy_id() is not null
    and "delegateID" = public.current_legacy_id()
    and "committeeID" = public.current_app_committee_id()
    and coalesce((public.current_reso_perms() ->> 'update:ownreso')::boolean, false)
  )
);

drop policy if exists resos_update_scoped on public."Resos";
create policy resos_update_scoped
on public."Resos" for update to authenticated
using (
  public.current_app_role() in ('admin', 'secretariat')
  or (public.current_app_role() = 'chair' and "committeeID" = public.current_app_committee_id())
  or (
    public.current_app_role() = 'delegate'
    and (
      (
        "delegateID" = public.current_legacy_id()
        and coalesce((public.current_reso_perms() ->> 'update:ownreso')::boolean, false)
      )
      or coalesce(public.current_reso_perms() -> 'update:reso', '[]'::jsonb) ? "resoID"
    )
  )
)
with check (
  public.current_app_role() in ('admin', 'secretariat')
  or (public.current_app_role() = 'chair' and "committeeID" = public.current_app_committee_id())
  or (
    public.current_app_role() = 'delegate'
    and (
      (
        "delegateID" = public.current_legacy_id()
        and coalesce((public.current_reso_perms() ->> 'update:ownreso')::boolean, false)
      )
      or coalesce(public.current_reso_perms() -> 'update:reso', '[]'::jsonb) ? "resoID"
    )
  )
);

drop policy if exists resos_delete_scoped on public."Resos";
create policy resos_delete_scoped
on public."Resos" for delete to authenticated
using (
  public.current_app_role() in ('admin', 'secretariat')
  or (public.current_app_role() = 'chair' and "committeeID" = public.current_app_committee_id())
  or (
    public.current_app_role() = 'delegate'
    and "delegateID" = public.current_legacy_id()
    and coalesce((public.current_reso_perms() ->> 'update:ownreso')::boolean, false)
  )
);

revoke all on table public."Resos" from anon, authenticated;
grant select, update, delete on table public."Resos" to authenticated;

-- Speech rows are protected through their delegate/chair ownership links.
drop policy if exists delegate_speech_select_own on public."Delegate-Speech";
create policy delegate_speech_select_own
on public."Delegate-Speech" for select to authenticated
using (
  public.current_app_role() in ('admin', 'secretariat')
  or "delegateID" = public.current_legacy_id()
);

drop policy if exists delegate_speech_insert_own on public."Delegate-Speech";
create policy delegate_speech_insert_own
on public."Delegate-Speech" for insert to authenticated
with check (
  public.current_app_role() in ('admin', 'secretariat')
  or (
    public.current_app_role() = 'delegate'
    and public.current_legacy_id() is not null
    and "delegateID" = public.current_legacy_id()
  )
);

drop policy if exists delegate_speech_delete_own on public."Delegate-Speech";
create policy delegate_speech_delete_own
on public."Delegate-Speech" for delete to authenticated
using (
  public.current_app_role() in ('admin', 'secretariat')
  or "delegateID" = public.current_legacy_id()
);

drop policy if exists chair_speech_select_own on public."Chair-Speech";
create policy chair_speech_select_own
on public."Chair-Speech" for select to authenticated
using (
  public.current_app_role() in ('admin', 'secretariat')
  or "chairID" = public.current_legacy_id()
);

drop policy if exists chair_speech_insert_own on public."Chair-Speech";
create policy chair_speech_insert_own
on public."Chair-Speech" for insert to authenticated
with check (
  public.current_app_role() in ('admin', 'secretariat')
  or (
    public.current_app_role() = 'chair'
    and public.current_legacy_id() is not null
    and "chairID" = public.current_legacy_id()
  )
);

drop policy if exists chair_speech_delete_own on public."Chair-Speech";
create policy chair_speech_delete_own
on public."Chair-Speech" for delete to authenticated
using (
  public.current_app_role() in ('admin', 'secretariat')
  or "chairID" = public.current_legacy_id()
);

drop policy if exists speech_select_owned on public."Speech";
create policy speech_select_owned
on public."Speech" for select to authenticated
using (
  public.current_app_role() in ('admin', 'secretariat')
  or exists (
    select 1 from public."Delegate-Speech" as link
    where link."speechID" = "Speech"."speechID"
      and link."delegateID" = public.current_legacy_id()
  )
  or exists (
    select 1 from public."Chair-Speech" as link
    where link."speechID" = "Speech"."speechID"
      and link."chairID" = public.current_legacy_id()
  )
);

drop policy if exists speech_insert_participant on public."Speech";
create policy speech_insert_participant
on public."Speech" for insert to authenticated
with check (
  public.current_app_role() in ('delegate', 'chair', 'admin', 'secretariat')
  and (
    public.current_app_role() in ('admin', 'secretariat')
    or public.current_legacy_id() is not null
  )
);

drop policy if exists speech_update_owned on public."Speech";
create policy speech_update_owned
on public."Speech" for update to authenticated
using (
  public.current_app_role() in ('admin', 'secretariat')
  or exists (
    select 1 from public."Delegate-Speech" as link
    where link."speechID" = "Speech"."speechID"
      and link."delegateID" = public.current_legacy_id()
  )
  or exists (
    select 1 from public."Chair-Speech" as link
    where link."speechID" = "Speech"."speechID"
      and link."chairID" = public.current_legacy_id()
  )
)
with check (
  public.current_app_role() in ('admin', 'secretariat')
  or exists (
    select 1 from public."Delegate-Speech" as link
    where link."speechID" = "Speech"."speechID"
      and link."delegateID" = public.current_legacy_id()
  )
  or exists (
    select 1 from public."Chair-Speech" as link
    where link."speechID" = "Speech"."speechID"
      and link."chairID" = public.current_legacy_id()
  )
);

drop policy if exists speech_delete_owned on public."Speech";
create policy speech_delete_owned
on public."Speech" for delete to authenticated
using (
  public.current_app_role() in ('admin', 'secretariat')
  or exists (
    select 1 from public."Delegate-Speech" as link
    where link."speechID" = "Speech"."speechID"
      and link."delegateID" = public.current_legacy_id()
  )
  or exists (
    select 1 from public."Chair-Speech" as link
    where link."speechID" = "Speech"."speechID"
      and link."chairID" = public.current_legacy_id()
  )
);

revoke all on table public."Speech" from anon, authenticated;
revoke all on table public."Delegate-Speech" from anon, authenticated;
revoke all on table public."Chair-Speech" from anon, authenticated;
grant select, update on table public."Speech" to authenticated;
grant select on table public."Delegate-Speech" to authenticated;
grant select on table public."Chair-Speech" to authenticated;

-- Support tickets are private to their author and conference staff.
drop policy if exists support_requests_insert_self on public.support_requests;
create policy support_requests_insert_self
on public.support_requests for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists support_requests_select_scoped on public.support_requests;
create policy support_requests_select_scoped
on public.support_requests for select to authenticated
using (
  user_id = auth.uid()
  or public.current_app_role() in ('admin', 'secretariat')
);

drop policy if exists support_requests_staff_manage on public.support_requests;
create policy support_requests_staff_manage
on public.support_requests for update to authenticated
using (public.current_app_role() in ('admin', 'secretariat'))
with check (public.current_app_role() in ('admin', 'secretariat'));

drop policy if exists support_requests_staff_delete on public.support_requests;
create policy support_requests_staff_delete
on public.support_requests for delete to authenticated
using (public.current_app_role() in ('admin', 'secretariat'));

revoke all on table public.support_requests from anon, authenticated;
grant select, insert, update, delete on table public.support_requests to authenticated;

commit;
