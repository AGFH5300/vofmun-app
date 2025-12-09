-- Align schema with updated application expectations

-- Ensure Delegate holds committee and country information
alter table public."Delegate"
  add column if not exists country varchar(255),
  add column if not exists "committeeID" uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'Delegate_committeeID_fkey'
  ) then
    alter table public."Delegate"
      add constraint "Delegate_committeeID_fkey"
      foreign key ("committeeID") references public."Committee"("committeeID") on update cascade;
  end if;
end $$;

-- Drop legacy messaging table
DROP TABLE IF EXISTS public."LegacyMessage";

-- Remove foreign keys that pointed at deprecated users/auth tables
alter table if exists public.chat_rooms drop constraint if exists chat_rooms_created_by_fkey;
alter table if exists public.room_members drop constraint if exists room_members_user_id_fkey;
alter table if exists public.messages drop constraint if exists messages_user_id_fkey;
alter table if exists public.friend_requests drop constraint if exists friend_requests_receiver_id_fkey;
alter table if exists public.friend_requests drop constraint if exists friend_requests_sender_id_fkey;
alter table if exists public.friendships drop constraint if exists friendships_user1_id_fkey;
alter table if exists public.friendships drop constraint if exists friendships_user2_id_fkey;

-- Remove triggers/functions tied to the legacy users table
DROP TRIGGER IF EXISTS update_user_last_seen_trigger ON public.messages;
DROP FUNCTION IF EXISTS public.update_user_last_seen();

-- Drop the deprecated public.users table
DROP TABLE IF EXISTS public.users CASCADE;
