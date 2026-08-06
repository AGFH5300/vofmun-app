-- Allow the unified server's verified service-role request to persist receipts
-- while preserving the authenticated-user and room-membership checks.
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
  jwt_role text := coalesce(auth.jwt() ->> 'role', nullif(current_setting('request.jwt.claim.role', true), ''));
  now_json jsonb := to_jsonb(now()::text);
  delivered_path text[];
  read_path text[];
begin
  if jwt_role = 'service_role' then
    caller_id := p_user_id::text;
  elsif caller_id is null or p_user_id::text is distinct from caller_id then
    raise exception 'Cannot update receipts for another user' using errcode = '42501';
  end if;

  if caller_id is null then
    raise exception 'Receipt user is required' using errcode = '42501';
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

revoke all on function public.mark_message_receipts(uuid, uuid[], character varying, boolean) from public;
revoke all on function public.mark_message_receipts(uuid, uuid[], character varying, boolean) from anon;
grant execute on function public.mark_message_receipts(uuid, uuid[], character varying, boolean) to authenticated;
grant execute on function public.mark_message_receipts(uuid, uuid[], character varying, boolean) to service_role;
