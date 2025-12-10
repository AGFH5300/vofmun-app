-- Align chat tables with string-based user identifiers and remove legacy speech tags

-- Convert chat user reference columns from uuid to varchar
alter table if exists public.chat_rooms
  alter column created_by type varchar(255) using created_by::text;

alter table if exists public.room_members
  alter column user_id type varchar(255) using user_id::text;

alter table if exists public.messages
  alter column user_id type varchar(255) using user_id::text;

alter table if exists public.friend_requests
  alter column sender_id type varchar(255) using sender_id::text,
  alter column receiver_id type varchar(255) using receiver_id::text;

alter table if exists public.friendships
  alter column user1_id type varchar(255) using user1_id::text,
  alter column user2_id type varchar(255) using user2_id::text;

-- Remove deprecated Speech-Tags table
drop table if exists public."Speech-Tags" cascade;
