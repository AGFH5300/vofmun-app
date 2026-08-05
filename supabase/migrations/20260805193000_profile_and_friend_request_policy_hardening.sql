begin;

-- Remove legacy self-service profile policies. The old INSERT policy allowed an
-- authenticated user to choose protected fields such as role, committee_id,
-- legacy_id, and reso_perms; the old UPDATE policy allowed those fields to be
-- changed later. Profile provisioning and privileged changes are performed by
-- trusted database triggers or service-role server routes.
drop policy if exists app_users_insert_own on public.app_users;
drop policy if exists app_users_select_own on public.app_users;
drop policy if exists app_users_update_own on public.app_users;

revoke all on table public.app_users from anon, authenticated;
grant select, insert on table public.app_users to authenticated;

-- The browser listens for friend-request status changes through Supabase
-- Realtime. Keep all writes server-controlled, but allow each authenticated
-- user to read only requests in which they are the sender or receiver.
drop policy if exists friend_requests_select_participant on public.friend_requests;
create policy friend_requests_select_participant
on public.friend_requests
for select
to authenticated
using (sender_id = auth.uid() or receiver_id = auth.uid());

revoke all on table public.friend_requests from anon, authenticated;
grant select on table public.friend_requests to authenticated;

commit;
