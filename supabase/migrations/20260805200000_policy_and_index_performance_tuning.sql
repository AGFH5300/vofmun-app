begin;

-- Cover committee foreign keys used by roster, resolution, and support queries.
create index if not exists chair_committee_id_idx on public."Chair"("committeeID");
create index if not exists delegate_committee_id_idx on public."Delegate"("committeeID");
create index if not exists resos_committee_id_idx on public."Resos"("committeeID");
create index if not exists app_users_committee_id_idx on public.app_users(committee_id);
create index if not exists support_requests_committee_id_idx on public.support_requests(committee_id);

-- Avoid overlapping permissive SELECT/INSERT policies. Privileged writes are
-- performed through service-role server routes, while all authenticated users
-- retain the intended read policies.
drop policy if exists app_users_admin_manage on public.app_users;

drop policy if exists committee_admin_manage on public."Committee";
create policy committee_admin_insert
on public."Committee" for insert to authenticated
with check (public.current_app_role() in ('admin', 'secretariat'));
create policy committee_admin_update
on public."Committee" for update to authenticated
using (public.current_app_role() in ('admin', 'secretariat'))
with check (public.current_app_role() in ('admin', 'secretariat'));
create policy committee_admin_delete
on public."Committee" for delete to authenticated
using (public.current_app_role() in ('admin', 'secretariat'));

drop policy if exists announcement_admin_manage on public."Announcement";
create policy announcement_admin_insert
on public."Announcement" for insert to authenticated
with check (public.current_app_role() in ('admin', 'secretariat'));
create policy announcement_admin_update
on public."Announcement" for update to authenticated
using (public.current_app_role() in ('admin', 'secretariat'))
with check (public.current_app_role() in ('admin', 'secretariat'));
create policy announcement_admin_delete
on public."Announcement" for delete to authenticated
using (public.current_app_role() in ('admin', 'secretariat'));

drop policy if exists updates_admin_manage on public."Updates";
create policy updates_admin_insert
on public."Updates" for insert to authenticated
with check (public.current_app_role() in ('admin', 'secretariat'));
create policy updates_admin_update
on public."Updates" for update to authenticated
using (public.current_app_role() in ('admin', 'secretariat'))
with check (public.current_app_role() in ('admin', 'secretariat'));
create policy updates_admin_delete
on public."Updates" for delete to authenticated
using (public.current_app_role() in ('admin', 'secretariat'));

-- Cache JWT-derived values once per statement rather than once per row.
drop policy if exists app_users_select_scoped on public.app_users;
create policy app_users_select_scoped
on public.app_users for select to authenticated
using (
  id = (select auth.uid())
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
  id = (select auth.uid())
  and role = 'delegate'
  and committee_id is null
  and lower(coalesce(email, '')) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  and reso_perms = '{"update:reso": [], "view:allreso": false, "view:ownreso": true, "update:ownreso": true}'::jsonb
);

drop policy if exists friend_requests_select_participant on public.friend_requests;
create policy friend_requests_select_participant
on public.friend_requests for select to authenticated
using (
  sender_id::text = (select auth.uid())::text
  or receiver_id::text = (select auth.uid())::text
);

drop policy if exists support_requests_insert_self on public.support_requests;
create policy support_requests_insert_self
on public.support_requests for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists support_requests_select_scoped on public.support_requests;
create policy support_requests_select_scoped
on public.support_requests for select to authenticated
using (
  user_id = (select auth.uid())
  or public.current_app_role() in ('admin', 'secretariat')
);

commit;
