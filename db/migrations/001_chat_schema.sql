-- Chat schema migration
-- Extensions and helper functions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- Helper to update updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Helper to add room creator as admin member
create or replace function public.add_room_creator_as_admin()
returns trigger as $$
begin
  if new.created_by is not null then
    insert into public.room_members (room_id, user_id, role)
    values (new.id, new.created_by, 'admin')
    on conflict (room_id, user_id) do nothing;
  end if;
  return new;
end;
$$ language plpgsql;

-- Helper to update user last_seen after sending message
create or replace function public.update_user_last_seen()
returns trigger as $$
begin
  update public.users
  set last_seen = now(), is_online = true
  where id = new.user_id;
  return new;
end;
$$ language plpgsql;

-- Users table
create table if not exists public.users (
  id uuid not null default gen_random_uuid (),
  email character varying(255) not null,
  username character varying(50) not null,
  avatar_url text null,
  is_online boolean null default false,
  last_seen timestamp with time zone null default now(),
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  full_name character varying(200) not null,
  email_verified boolean null default false,
  verification_token text null,
  verification_token_expires timestamp with time zone null,
  constraint users_pkey primary key (id),
  constraint users_email_key unique (email),
  constraint users_username_key unique (username)
);
create index if not exists idx_users_email on public.users using btree (email);
create index if not exists idx_users_username on public.users using btree (username);
create index if not exists idx_users_online on public.users using btree (is_online);
create index if not exists idx_users_verification_token on public.users using btree (verification_token);
create trigger update_users_updated_at before update on users for each row execute function update_updated_at_column ();

-- Chat rooms
create table if not exists public.chat_rooms (
  id uuid not null default gen_random_uuid (),
  name character varying(100) not null,
  description text null,
  is_private boolean null default false,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint chat_rooms_pkey primary key (id),
  constraint chat_rooms_created_by_fkey foreign key (created_by) references users (id) on delete cascade
);
create index if not exists idx_chat_rooms_created_by on public.chat_rooms using btree (created_by);
create index if not exists idx_chat_rooms_private on public.chat_rooms using btree (is_private);
create trigger add_room_creator_as_admin_trigger after insert on chat_rooms for each row execute function add_room_creator_as_admin ();
create trigger update_chat_rooms_updated_at before update on chat_rooms for each row execute function update_updated_at_column ();

-- Room membership
create table if not exists public.room_members (
  id uuid not null default gen_random_uuid (),
  room_id uuid null,
  user_id uuid null,
  role character varying(20) null default 'member',
  joined_at timestamp with time zone null default now(),
  constraint room_members_pkey primary key (id),
  constraint room_members_room_id_user_id_key unique (room_id, user_id),
  constraint room_members_room_id_fkey foreign key (room_id) references chat_rooms (id) on delete cascade,
  constraint room_members_user_id_fkey foreign key (user_id) references users (id) on delete cascade
);
create index if not exists idx_room_members_room_id on public.room_members using btree (room_id);
create index if not exists idx_room_members_user_id on public.room_members using btree (user_id);

-- Messages
create table if not exists public.messages (
  id uuid not null default gen_random_uuid (),
  room_id uuid null,
  user_id uuid null,
  content text not null,
  message_type character varying(20) null default 'text',
  reply_to uuid null,
  edited_at timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint messages_pkey primary key (id),
  constraint messages_reply_to_fkey foreign key (reply_to) references messages (id) on delete set null,
  constraint messages_room_id_fkey foreign key (room_id) references chat_rooms (id) on delete cascade,
  constraint messages_user_id_fkey foreign key (user_id) references users (id) on delete cascade
);
create index if not exists idx_messages_room_id on public.messages using btree (room_id);
create index if not exists idx_messages_user_id on public.messages using btree (user_id);
create index if not exists idx_messages_created_at on public.messages using btree (created_at desc);
create index if not exists idx_messages_reply_to on public.messages using btree (reply_to);
create trigger update_messages_updated_at before update on messages for each row execute function update_updated_at_column ();
create trigger update_user_last_seen_trigger after insert on messages for each row execute function update_user_last_seen ();

-- Friend requests
create table if not exists public.friend_requests (
  id uuid not null default gen_random_uuid (),
  sender_id uuid not null,
  receiver_id uuid not null,
  status text not null default 'pending',
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint friend_requests_pkey primary key (id),
  constraint friend_requests_sender_id_receiver_id_key unique (sender_id, receiver_id),
  constraint friend_requests_receiver_id_fkey foreign key (receiver_id) references auth.users (id) on delete cascade,
  constraint friend_requests_sender_id_fkey foreign key (sender_id) references auth.users (id) on delete cascade,
  constraint friend_requests_status_check check (status = any(array['pending','accepted','rejected']))
);
create index if not exists idx_friend_requests_sender on public.friend_requests using btree (sender_id);
create index if not exists idx_friend_requests_receiver on public.friend_requests using btree (receiver_id);
create index if not exists idx_friend_requests_status on public.friend_requests using btree (status);

-- Friendships
create table if not exists public.friendships (
  id uuid not null default gen_random_uuid (),
  user1_id uuid not null,
  user2_id uuid not null,
  created_at timestamp with time zone null default now(),
  constraint friendships_pkey primary key (id),
  constraint friendships_user1_id_user2_id_key unique (user1_id, user2_id),
  constraint friendships_user1_id_fkey foreign key (user1_id) references auth.users (id) on delete cascade,
  constraint friendships_user2_id_fkey foreign key (user2_id) references auth.users (id) on delete cascade
);
create index if not exists idx_friendships_user1 on public.friendships using btree (user1_id);
create index if not exists idx_friendships_user2 on public.friendships using btree (user2_id);

-- RLS policies
alter table public.users enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.messages enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;

-- Users: owners can read/update themselves
create policy if not exists users_self_select on public.users
  for select using (auth.uid() = id);
create policy if not exists users_self_update on public.users
  for update using (auth.uid() = id);

-- Chat rooms: members can view, creator can manage
create policy if not exists chat_rooms_select on public.chat_rooms
  for select using (exists(select 1 from public.room_members rm where rm.room_id = id and rm.user_id = auth.uid()));
create policy if not exists chat_rooms_insert on public.chat_rooms
  for insert with check (auth.uid() is not null);
create policy if not exists chat_rooms_delete on public.chat_rooms
  for delete using (created_by = auth.uid());

-- Room members: members can see members, users can join themselves
create policy if not exists room_members_select on public.room_members
  for select using (exists(select 1 from public.room_members rm where rm.room_id = room_id and rm.user_id = auth.uid()));
create policy if not exists room_members_insert on public.room_members
  for insert with check (auth.uid() = user_id);
create policy if not exists room_members_delete on public.room_members
  for delete using (auth.uid() = user_id);

-- Messages: room members only
create policy if not exists messages_select on public.messages
  for select using (exists(select 1 from public.room_members rm where rm.room_id = room_id and rm.user_id = auth.uid()));
create policy if not exists messages_insert on public.messages
  for insert with check (exists(select 1 from public.room_members rm where rm.room_id = room_id and rm.user_id = auth.uid()));
create policy if not exists messages_update on public.messages
  for update using (auth.uid() = user_id);

-- Friendships/friend requests: user involved
create policy if not exists friend_requests_select on public.friend_requests
  for select using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy if not exists friend_requests_insert on public.friend_requests
  for insert with check (sender_id = auth.uid());
create policy if not exists friend_requests_update on public.friend_requests
  for update using (sender_id = auth.uid() or receiver_id = auth.uid());

create policy if not exists friendships_select on public.friendships
  for select using (user1_id = auth.uid() or user2_id = auth.uid());
create policy if not exists friendships_insert on public.friendships
  for insert with check (user1_id = auth.uid() or user2_id = auth.uid());
