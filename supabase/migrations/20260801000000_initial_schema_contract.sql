begin;

create extension if not exists pgcrypto;

create table if not exists public."Committee" (
  "committeeID" uuid primary key default gen_random_uuid(),
  "committeeCode" text not null unique,
  name text not null,
  fullname text not null
);

create table if not exists public."Delegate" (
  "delegateID" text primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  firstname text not null,
  lastname text not null,
  email text not null unique,
  "resoPerms" jsonb not null default '{"view:ownreso":true,"view:allreso":false,"update:ownreso":true,"update:reso":[]}'::jsonb,
  country text,
  "committeeID" uuid references public."Committee"("committeeID") on delete set null
);

create table if not exists public."Chair" (
  "chairID" text primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  firstname text not null,
  lastname text not null,
  email text not null unique,
  "committeeID" uuid references public."Committee"("committeeID") on delete set null
);

create table if not exists public."Admin" (
  "adminID" text primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  firstname text not null,
  lastname text not null,
  email text not null unique
);

create table if not exists public."Secretariat" (
  "secretariatID" text primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  firstname text not null,
  lastname text not null,
  email text not null unique
);

create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  first_name text,
  last_name text,
  role text not null check (role in ('delegate', 'chair', 'admin', 'secretariat')),
  committee_id uuid references public."Committee"("committeeID") on delete set null,
  country text,
  reso_perms jsonb not null default '{"view:ownreso":false,"view:allreso":false,"update:ownreso":false,"update:reso":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public."Announcement" (
  "announcementID" text primary key,
  date timestamptz not null default now(),
  title text not null,
  content text not null,
  href text
);

create table if not exists public."Updates" (
  "updateID" text primary key,
  time timestamptz not null default now(),
  title text not null,
  content text not null,
  href text
);

create table if not exists public."Resos" (
  "resoID" text primary key,
  title text not null,
  "delegateID" text not null references public."Delegate"("delegateID") on delete cascade,
  content jsonb not null,
  "isNew" boolean default false,
  "committeeID" uuid references public."Committee"("committeeID") on delete set null
);

create table if not exists public."Speech" (
  "speechID" text primary key,
  title text not null,
  content text not null,
  date timestamptz not null default now()
);

create table if not exists public."Delegate-Speech" (
  "speechID" text not null references public."Speech"("speechID") on delete cascade,
  "delegateID" text not null references public."Delegate"("delegateID") on delete cascade,
  primary key ("speechID", "delegateID")
);

create table if not exists public."Chair-Speech" (
  "speechID" text not null references public."Speech"("speechID") on delete cascade,
  "chairID" text not null references public."Chair"("chairID") on delete cascade,
  primary key ("speechID", "chairID")
);

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_private boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.chat_rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  content text not null default '',
  message_type text default 'text',
  reply_to uuid references public.messages(id) on delete set null,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  history_acted_by uuid references auth.users(id) on delete set null,
  history_action text,
  history_saved_at timestamptz,
  previous_attachments jsonb,
  previous_content text,
  previous_created_at timestamptz,
  previous_deleted_at timestamptz,
  previous_edited_at timestamptz,
  previous_message_row jsonb,
  previous_reply_to uuid,
  previous_user_id uuid
);

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  bucket text not null default 'chat-attachments',
  path text not null unique,
  original_name text not null,
  mime_type text,
  size_bytes bigint,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.message_hidden_for_users (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid not null references auth.users(id) on delete cascade,
  user2_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user1_id <> user2_id),
  unique (user1_id, user2_id)
);

create index if not exists room_members_user_idx on public.room_members(user_id, room_id);
create index if not exists messages_room_created_idx on public.messages(room_id, created_at desc);
create index if not exists friend_requests_receiver_status_idx on public.friend_requests(receiver_id, status);
create index if not exists friend_requests_sender_status_idx on public.friend_requests(sender_id, status);
create index if not exists message_hidden_user_idx on public.message_hidden_for_users(user_id, message_id);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.add_room_creator_as_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.created_by is not null then
    insert into public.room_members (room_id, user_id, role)
    values (new.id, new.created_by, 'admin')
    on conflict (room_id, user_id) do update set role = 'admin';
  end if;
  return new;
end;
$$;

create or replace function public.broadcast_message_changes()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  return coalesce(new, old);
end;
$$;

create or replace function public.room_id_from_object_path(object_name text)
returns uuid
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  candidate text := split_part(object_name, '/', 1);
begin
  if candidate ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return candidate::uuid;
  end if;
  return null;
end;
$$;

create or replace function public.sync_auth_user_to_app_users(p_auth_user_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_email text := lower(trim(p_email));
  matched record;
begin
  if p_auth_user_id is null or normalized_email = '' then
    return;
  end if;

  select *
  into matched
  from (
    select 'delegate'::text as role, d.email, d.firstname, d.lastname, d.country, d."committeeID" as committee_id, d."resoPerms" as reso_perms
    from public."Delegate" d
    union all
    select 'chair', c.email, c.firstname, c.lastname, null::text, c."committeeID", '{"view:ownreso":false,"view:allreso":true,"update:ownreso":false,"update:reso":[]}'::jsonb
    from public."Chair" c
    union all
    select 'admin', a.email, a.firstname, a.lastname, null::text, null::uuid, '{"view:ownreso":false,"view:allreso":true,"update:ownreso":false,"update:reso":[]}'::jsonb
    from public."Admin" a
    union all
    select 'secretariat', s.email, s.firstname, s.lastname, null::text, null::uuid, '{"view:ownreso":false,"view:allreso":true,"update:ownreso":false,"update:reso":[]}'::jsonb
    from public."Secretariat" s
  ) source
  where lower(trim(source.email)) = normalized_email
  limit 1;

  if matched is null then
    return;
  end if;

  insert into public.app_users (id, email, first_name, last_name, role, committee_id, country, reso_perms)
  values (p_auth_user_id, normalized_email, matched.firstname, matched.lastname, matched.role, matched.committee_id, matched.country, matched.reso_perms)
  on conflict (id) do update set
    email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    role = excluded.role,
    committee_id = excluded.committee_id,
    country = excluded.country,
    reso_perms = excluded.reso_perms,
    updated_at = now();
end;
$$;

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.sync_auth_user_to_app_users(new.id, coalesce(new.email, ''));
  return new;
end;
$$;

create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = (select auth.uid())
  )
$$;

revoke all on function public.is_room_member(uuid) from public, anon;
grant execute on function public.is_room_member(uuid) to authenticated;

create or replace function public.get_room_unread_counts(p_user_id text)
returns table(room_id uuid, unread_count bigint)
language sql
stable
as $$
  select rm.room_id, 0::bigint
  from public.room_members rm
  where rm.user_id::text = p_user_id
$$;

create or replace function public.mark_message_receipts(
  p_room_id uuid,
  p_message_ids uuid[],
  p_user_id character varying,
  p_mark_read boolean default false
)
returns setof uuid
language sql
as $$
  select id from public.messages where false
$$;

drop trigger if exists chat_rooms_add_creator on public.chat_rooms;
create trigger chat_rooms_add_creator
after insert on public.chat_rooms
for each row execute function public.add_room_creator_as_admin();

drop trigger if exists chat_rooms_set_updated_at on public.chat_rooms;
create trigger chat_rooms_set_updated_at
before update on public.chat_rooms
for each row execute function public.update_updated_at_column();

drop trigger if exists messages_set_updated_at on public.messages;
create trigger messages_set_updated_at
before update on public.messages
for each row execute function public.update_updated_at_column();

drop trigger if exists friend_requests_set_updated_at on public.friend_requests;
create trigger friend_requests_set_updated_at
before update on public.friend_requests
for each row execute function public.update_updated_at_column();

drop trigger if exists app_users_set_updated_at on public.app_users;
create trigger app_users_set_updated_at
before update on public.app_users
for each row execute function public.update_updated_at_column();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_auth_user_created();

create or replace view public.v_pending_auth_invites
with (security_invoker = true)
as
select role, email, first_name, last_name
from public.app_users
where false;

alter table public.chat_rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.message_hidden_for_users enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;

drop policy if exists chat_rooms_member_select on public.chat_rooms;
create policy chat_rooms_member_select on public.chat_rooms for select to authenticated
using (public.is_room_member(id));

drop policy if exists room_members_member_select on public.room_members;
create policy room_members_member_select on public.room_members for select to authenticated
using (public.is_room_member(room_id));

drop policy if exists messages_member_select on public.messages;
create policy messages_member_select on public.messages for select to authenticated
using (public.is_room_member(messages.room_id));

drop policy if exists message_attachments_member_select on public.message_attachments;
create policy message_attachments_member_select on public.message_attachments for select to authenticated
using (public.is_room_member(message_attachments.room_id));

drop policy if exists message_hidden_self_select on public.message_hidden_for_users;
create policy message_hidden_self_select on public.message_hidden_for_users for select to authenticated
using (user_id = (select auth.uid()));

grant select on public.chat_rooms, public.room_members, public.messages, public.message_attachments, public.message_hidden_for_users to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

commit;
