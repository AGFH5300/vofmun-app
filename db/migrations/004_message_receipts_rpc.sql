create or replace function public.mark_message_receipts(
  p_room_id uuid,
  p_message_ids uuid[],
  p_user_id character varying,
  p_mark_read boolean default false
)
returns setof uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  now_iso text := to_jsonb(now()) #>> '{}';
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = p_user_id
  ) then
    raise exception 'User is not a member of this room';
  end if;

  return query
  with target_messages as (
    select m.id, m.meta
    from public.messages m
    where m.room_id = p_room_id
      and m.id = any(p_message_ids)
      and m.user_id <> p_user_id
  ), updated as (
    update public.messages m
    set meta = (
      with delivered_meta as (
        select case
          when (coalesce(tm.meta, '{}'::jsonb) #> array['receipts', 'delivered', p_user_id]) is null
            then jsonb_set(coalesce(tm.meta, '{}'::jsonb), array['receipts', 'delivered', p_user_id], to_jsonb(now_iso), true)
          else coalesce(tm.meta, '{}'::jsonb)
        end as value
      )
      select case
        when p_mark_read and ((dm.value #> array['receipts', 'read', p_user_id]) is null)
          then jsonb_set(dm.value, array['receipts', 'read', p_user_id], to_jsonb(now_iso), true)
        else dm.value
      end
      from delivered_meta dm
    )
    from target_messages tm
    where m.id = tm.id
    returning m.id
  )
  select id from updated;
end;
$function$;

grant execute on function public.mark_message_receipts(uuid, uuid[], character varying, boolean) to authenticated;
grant execute on function public.mark_message_receipts(uuid, uuid[], character varying, boolean) to service_role;
