begin;

-- Pending invite data is an administrative concern and is not queried by the
-- browser application. Run the view with caller permissions and keep it out of
-- the public/authenticated REST and GraphQL surface.
alter view public.v_pending_auth_invites set (security_invoker = true);
revoke all on table public.v_pending_auth_invites from anon, authenticated;

-- Anonymous users must not be able to discover or operate on chat data. Signed-
-- in access remains governed by the existing room-membership RLS policies.
revoke all on table public.chat_rooms from anon;
revoke all on table public.message_attachments from anon;
revoke all on table public.message_hidden_for_users from anon;
revoke all on table public.messages from anon;
revoke all on table public.room_members from anon;
revoke all on table public.friendships from anon, authenticated;

-- Explicit deny policies document that these tables are service-role-only. The
-- service role bypasses RLS, while browser roles receive no rows.
drop policy if exists admin_service_only on public."Admin";
create policy admin_service_only on public."Admin" for all to public using (false) with check (false);
drop policy if exists chair_service_only on public."Chair";
create policy chair_service_only on public."Chair" for all to public using (false) with check (false);
drop policy if exists delegate_service_only on public."Delegate";
create policy delegate_service_only on public."Delegate" for all to public using (false) with check (false);
drop policy if exists secretariat_service_only on public."Secretariat";
create policy secretariat_service_only on public."Secretariat" for all to public using (false) with check (false);
drop policy if exists friendships_service_only on public.friendships;
create policy friendships_service_only on public.friendships for all to public using (false) with check (false);
drop policy if exists pending_chat_attachments_service_only on public.pending_chat_attachments;
create policy pending_chat_attachments_service_only on public.pending_chat_attachments for all to public using (false) with check (false);

-- Fix mutable function search paths so object resolution cannot be influenced by
-- a caller-controlled schema.
alter function public.room_id_from_object_path(text) set search_path = public, pg_temp;
alter function public.add_room_creator_as_admin() set search_path = public, pg_temp;
alter function public.update_updated_at_column() set search_path = public, pg_temp;

-- Trigger-only and server-only functions must not be exposed as REST RPCs.
revoke all on function public.broadcast_message_changes() from public, anon, authenticated;
revoke all on function public.handle_auth_user_created() from public, anon, authenticated;
revoke all on function public.sync_auth_user_to_app_users(uuid, text) from public, anon, authenticated;
revoke all on function public.add_room_creator_as_admin() from public, anon, authenticated;
revoke all on function public.update_updated_at_column() from public, anon, authenticated;

-- The unread-count RPC previously trusted its p_user_id argument. Bind the
-- request to auth.uid() so a user cannot inspect another user's room state.
create or replace function public.get_room_unread_counts(p_user_id text)
returns table(room_id uuid, unread_count bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id text := auth.uid()::text;
begin
  if caller_id is null or p_user_id is distinct from caller_id then
    raise exception 'Cannot read unread counts for another user' using errcode = '42501';
  end if;

  return query
  select
    rm.room_id,
    count(m.id) filter (
      where m.deleted_at is null
        and coalesce(m.user_id::text, '') <> caller_id
        and coalesce(m.meta #>> array['receipts', 'read', caller_id], '') = ''
    )::bigint
  from public.room_members rm
  left join public.messages m on m.room_id = rm.room_id
  where rm.user_id::text = caller_id
  group by rm.room_id;
end;
$$;

revoke all on function public.get_room_unread_counts(text) from public, anon;
grant execute on function public.get_room_unread_counts(text) to authenticated;

-- Receipt updates previously trusted p_user_id. Require the authenticated user,
-- verify room membership, and update only messages in the requested room.
create or replace function public.mark_message_receipts(
  p_room_id uuid,
  p_message_ids uuid[],
  p_user_id character varying,
  p_mark_read boolean default false
)
returns setof uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id text := auth.uid()::text;
  now_json jsonb := to_jsonb(now()::text);
  delivered_path text[];
  read_path text[];
begin
  if caller_id is null or p_user_id::text is distinct from caller_id then
    raise exception 'Cannot update receipts for another user' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id::text = caller_id
  ) then
    raise exception 'User is not a member of this room' using errcode = '42501';
  end if;

  delivered_path := array['receipts', 'delivered', caller_id];
  read_path := array['receipts', 'read', caller_id];

  return query
  update public.messages m
  set meta = case
    when p_mark_read then (
      with base as (
        select coalesce(m.meta, '{}'::jsonb) as meta0
      ), delivered as (
        select case
          when (meta0 #> delivered_path) is null then jsonb_set(meta0, delivered_path, now_json, true)
          else meta0
        end as meta1
        from base
      )
      select case
        when (meta1 #> read_path) is null then jsonb_set(meta1, read_path, now_json, true)
        else meta1
      end
      from delivered
    )
    else (
      with base as (
        select coalesce(m.meta, '{}'::jsonb) as meta0
      )
      select case
        when (meta0 #> delivered_path) is null then jsonb_set(meta0, delivered_path, now_json, true)
        else meta0
      end
      from base
    )
  end
  where m.room_id = p_room_id
    and m.id = any(p_message_ids)
    and m.user_id::text <> caller_id
  returning m.id;
end;
$$;

revoke all on function public.mark_message_receipts(uuid, uuid[], character varying, boolean) from public, anon;
grant execute on function public.mark_message_receipts(uuid, uuid[], character varying, boolean) to authenticated;

commit;
