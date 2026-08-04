from pathlib import Path


def replace_exact(path: str, old: str, new: str, expected: int = 1) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{path}: expected {expected} matches, found {count}: {old[:160]!r}")
    file.write_text(text.replace(old, new))


migration = "supabase/migrations/20260804183000_identity_link_and_rls_hardening.sql"

replace_exact(
    migration,
    """for table_name in select unnest(array['Announcement', 'Updates']) loop
  execute format('drop policy if exists %I_authenticated_read on public.%I', lower(table_name), table_name);
  execute format(
    'create policy %I_authenticated_read on public.%I for select to authenticated using (true)',
    lower(table_name), table_name
  );
  execute format('drop policy if exists %I_admin_manage on public.%I', lower(table_name), table_name);
  execute format(
    'create policy %I_admin_manage on public.%I for all to authenticated using (public.current_app_role() in (''admin'', ''secretariat'')) with check (public.current_app_role() in (''admin'', ''secretariat''))',
    lower(table_name), table_name
  );
end loop;
""",
    """drop policy if exists announcement_authenticated_read on public.\"Announcement\";
create policy announcement_authenticated_read
on public.\"Announcement\" for select to authenticated
using (true);

drop policy if exists announcement_admin_manage on public.\"Announcement\";
create policy announcement_admin_manage
on public.\"Announcement\" for all to authenticated
using (public.current_app_role() in ('admin', 'secretariat'))
with check (public.current_app_role() in ('admin', 'secretariat'));

drop policy if exists updates_authenticated_read on public.\"Updates\";
create policy updates_authenticated_read
on public.\"Updates\" for select to authenticated
using (true);

drop policy if exists updates_admin_manage on public.\"Updates\";
create policy updates_admin_manage
on public.\"Updates\" for all to authenticated
using (public.current_app_role() in ('admin', 'secretariat'))
with check (public.current_app_role() in ('admin', 'secretariat'));
""",
)

replace_exact(
    migration,
    """  and committee_id is null
  and legacy_id is null
  and lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
""",
    """  and committee_id is null
  and lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
""",
)

replace_exact(
    migration,
    """drop trigger if exists app_users_sync_legacy_id on public.app_users;
create trigger app_users_sync_legacy_id
before insert or update of email, role, legacy_id
on public.app_users
for each row execute function public.sync_app_user_legacy_id();
""",
    """drop trigger if exists app_users_sync_legacy_id on public.app_users;
create trigger app_users_sync_legacy_id
before insert or update of email, role, legacy_id
on public.app_users
for each row execute function public.sync_app_user_legacy_id();

revoke all on function public.sync_app_user_legacy_id() from public, anon, authenticated;
""",
)

rpc_sql = r'''
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

revoke all on function public.create_resolution(text, jsonb) from public, anon;
revoke all on function public.create_speech(text, text, text) from public, anon;
grant execute on function public.create_resolution(text, jsonb) to authenticated;
grant execute on function public.create_speech(text, text, text) to authenticated;

'''
replace_exact(
    migration,
    "-- Enable RLS on every client-visible application table. Service-role server\n",
    rpc_sql + "-- Enable RLS on every client-visible application table. Service-role server\n",
)

replace_exact(
    migration,
    "grant select, insert, update, delete on table public.\"Resos\" to authenticated;",
    "grant select, update, delete on table public.\"Resos\" to authenticated;",
)
replace_exact(
    migration,
    "grant select, insert, update, delete on table public.\"Speech\" to authenticated;",
    "grant select, update, delete on table public.\"Speech\" to authenticated;",
)
replace_exact(
    migration,
    "grant select, insert, delete on table public.\"Delegate-Speech\" to authenticated;",
    "grant select, delete on table public.\"Delegate-Speech\" to authenticated;",
)
replace_exact(
    migration,
    "grant select, insert, delete on table public.\"Chair-Speech\" to authenticated;",
    "grant select, delete on table public.\"Chair-Speech\" to authenticated;",
)

speech_owner_check = """  public.current_app_role() in ('admin', 'secretariat')
  or exists (
    select 1 from public.\"Delegate-Speech\" as link
    where link.\"speechID\" = \"Speech\".\"speechID\"
      and link.\"delegateID\" = public.current_legacy_id()
  )
  or exists (
    select 1 from public.\"Chair-Speech\" as link
    where link.\"speechID\" = \"Speech\".\"speechID\"
      and link.\"chairID\" = public.current_legacy_id()
  )
"""
replace_exact(
    migration,
    ")\nwith check (true);\n\ndrop policy if exists speech_delete_owned",
    ")\nwith check (\n" + speech_owner_check + ");\n\ndrop policy if exists speech_delete_owned",
)

# Application and generated schema types.
replace_exact(
    "db/types.ts",
    "  country: string | null;\n  reso_perms:",
    "  country: string | null;\n  legacy_id: string | null;\n  reso_perms:",
    expected=2,
)

for old, new in (
    (
        "Row: { adminID: string; firstname: string; lastname: string; password: string; email: string };",
        "Row: { adminID: string; firstname: string; lastname: string; email: string };",
    ),
    (
        "Insert: { adminID: string; firstname: string; lastname: string; password: string; email: string };",
        "Insert: { adminID: string; firstname: string; lastname: string; email: string };",
    ),
    (
        "Update: { adminID?: string; firstname?: string; lastname?: string; password?: string; email?: string };",
        "Update: { adminID?: string; firstname?: string; lastname?: string; email?: string };",
    ),
    (
        "Row: { chairID: string; firstname: string; lastname: string; password: string; email: string; committeeID: string | null };",
        "Row: { chairID: string; firstname: string; lastname: string; email: string; committeeID: string | null };",
    ),
    (
        "Insert: { chairID: string; firstname: string; lastname: string; password: string; email: string; committeeID?: string | null };",
        "Insert: { chairID: string; firstname: string; lastname: string; email: string; committeeID?: string | null };",
    ),
    (
        "Update: { chairID?: string; firstname?: string; lastname?: string; password?: string; email?: string; committeeID?: string | null };",
        "Update: { chairID?: string; firstname?: string; lastname?: string; email?: string; committeeID?: string | null };",
    ),
    (
        "Row: { delegateID: string; firstname: string; lastname: string; password: string; email: string; resoPerms: Json; country: string | null; committeeID: string | null };",
        "Row: { delegateID: string; firstname: string; lastname: string; email: string; resoPerms: Json; country: string | null; committeeID: string | null };",
    ),
    (
        "Insert: { delegateID: string; firstname: string; lastname: string; password: string; email: string; resoPerms?: Json; country?: string | null; committeeID?: string | null };",
        "Insert: { delegateID: string; firstname: string; lastname: string; email: string; resoPerms?: Json; country?: string | null; committeeID?: string | null };",
    ),
    (
        "Update: { delegateID?: string; firstname?: string; lastname?: string; password?: string; email?: string; resoPerms?: Json; country?: string | null; committeeID?: string | null };",
        "Update: { delegateID?: string; firstname?: string; lastname?: string; email?: string; resoPerms?: Json; country?: string | null; committeeID?: string | null };",
    ),
    (
        "Row: { secretariatID: string; firstname: string; lastname: string; password: string; email: string };",
        "Row: { secretariatID: string; firstname: string; lastname: string; email: string };",
    ),
    (
        "Insert: { secretariatID: string; firstname: string; lastname: string; password: string; email: string };",
        "Insert: { secretariatID: string; firstname: string; lastname: string; email: string };",
    ),
    (
        "Update: { secretariatID?: string; firstname?: string; lastname?: string; password?: string; email?: string };",
        "Update: { secretariatID?: string; firstname?: string; lastname?: string; email?: string };",
    ),
):
    replace_exact("db/supabase-database.types.ts", old, new)

replace_exact(
    "db/supabase-database.types.ts",
    "          country: string | null;\n          reso_perms: Json;",
    "          country: string | null;\n          legacy_id: string | null;\n          reso_perms: Json;",
)
replace_exact(
    "db/supabase-database.types.ts",
    "          country?: string | null;\n          reso_perms?: Json;",
    "          country?: string | null;\n          legacy_id?: string | null;\n          reso_perms?: Json;",
    expected=2,
)
replace_exact(
    "db/supabase-database.types.ts",
    "Row: { id: string; user_id: string | null; display_name: string | null; country: string | null; committee_id: string | null; committee_name: string | null; role: string | null; message: string; source: string; created_at: string };",
    "Row: { id: string; user_id: string | null; display_name: string | null; country: string | null; committee_id: string | null; committee_name: string | null; role: string | null; message: string; source: string; status: string; created_at: string; updated_at: string };",
)
replace_exact(
    "db/supabase-database.types.ts",
    "Insert: { id?: string; user_id?: string | null; display_name?: string | null; country?: string | null; committee_id?: string | null; committee_name?: string | null; role?: string | null; message: string; source?: string; created_at?: string };",
    "Insert: { id?: string; user_id?: string | null; display_name?: string | null; country?: string | null; committee_id?: string | null; committee_name?: string | null; role?: string | null; message: string; source?: string; status?: string; created_at?: string; updated_at?: string };",
)
replace_exact(
    "db/supabase-database.types.ts",
    "Update: { id?: string; user_id?: string | null; display_name?: string | null; country?: string | null; committee_id?: string | null; committee_name?: string | null; role?: string | null; message?: string; source?: string; created_at?: string };",
    "Update: { id?: string; user_id?: string | null; display_name?: string | null; country?: string | null; committee_id?: string | null; committee_name?: string | null; role?: string | null; message?: string; source?: string; status?: string; created_at?: string; updated_at?: string };",
)
replace_exact(
    "db/supabase-database.types.ts",
    """      create_notification: {
        Args: { p_user_id: string; p_title: string; p_message: string; p_type?: string; p_category?: string | null; p_entity_id?: string | null };
        Returns: string;
      };
""",
    """      create_resolution: {
        Args: { p_title: string; p_content: Json };
        Returns: string;
      };
      create_speech: {
        Args: { p_title: string; p_content: string; p_date: string };
        Returns: string;
      };
      current_app_committee_id: { Args: Record<string, never>; Returns: string | null };
      current_app_role: { Args: Record<string, never>; Returns: string | null };
      current_legacy_id: { Args: Record<string, never>; Returns: string | null };
      current_reso_perms: { Args: Record<string, never>; Returns: Json };
""",
)
replace_exact(
    "db/supabase-database.types.ts",
    """      log_system_action: {
        Args: { p_user_id: string; p_action: string; p_entity_type?: string | null; p_entity_id?: string | null; p_details?: Json | null };
        Returns: string;
      };
""",
    "",
)

# Hydrate aliases from the explicit legacy link, never from auth.user.id.
replace_exact(
    "lib/auth/mapAppUserToSessionUser.ts",
    "    country: appUser.country,\n    reso_perms: appUser.reso_perms,",
    "    country: appUser.country,\n    legacy_id: appUser.legacy_id,\n    reso_perms: appUser.reso_perms,",
)
replace_exact(
    "lib/auth/mapAppUserToSessionUser.ts",
    """    delegateID: appUser.role === "delegate" ? appUser.id : undefined,
    chairID: appUser.role === "chair" ? appUser.id : undefined,
    adminID: appUser.role === "admin" ? appUser.id : undefined,
    secretariatID: appUser.role === "secretariat" ? appUser.id : undefined,
""",
    """    delegateID: appUser.role === "delegate" ? appUser.legacy_id || undefined : undefined,
    chairID: appUser.role === "chair" ? appUser.legacy_id || undefined : undefined,
    adminID: appUser.role === "admin" ? appUser.legacy_id || undefined : undefined,
    secretariatID: appUser.role === "secretariat" ? appUser.legacy_id || undefined : undefined,
""",
)

# Resolution ownership and creation now use app_users.legacy_id and the atomic RPC.
replacements = (
    ("reso.delegateID === currentUser.id", "reso.delegateID === currentUser.legacy_id"),
    ('select("id, first_name, last_name, reso_perms")', 'select("legacy_id, first_name, last_name, reso_perms")'),
    ('.eq("role", "delegate");', '.eq("role", "delegate")\n          .not("legacy_id", "is", null);'),
    ("delegateID: delegate.id,", "delegateID: delegate.legacy_id as string,"),
    ('query = query.eq("delegateID", currentUser.id);', 'if (!currentUser.legacy_id) {\n            toast.error("Your delegate profile is not linked. Please contact admin.");\n            return;\n          }\n            query = query.eq("delegateID", currentUser.legacy_id);'),
    ('selectedReso?.delegateID === delegateUser.id', 'selectedReso?.delegateID === delegateUser.legacy_id'),
    ('selectedReso.delegateID !== delegateUser.id', 'selectedReso.delegateID !== delegateUser.legacy_id'),
    ('delegateID = delegateUser.id; committeeID', 'if (!delegateUser.legacy_id) return toast.error("Your delegate profile is not linked. Please contact admin.");\n      delegateID = delegateUser.legacy_id; committeeID'),
    ('r.delegateID === delegateUser.id', 'r.delegateID === delegateUser.legacy_id'),
    ('selectedReso.delegateID === d.id', 'selectedReso.delegateID === d.legacy_id'),
)
for old, new in replacements:
    replace_exact("app/resolutions/page.tsx", old, new)

replace_exact(
    "app/resolutions/page.tsx",
    """        const { data: existingResos, error: resoError } = await supabase.from("Resos").select("resoID");
        if (resoError) throw resoError;
        const sortedResos = existingResos ? [...existingResos] : []; sortedResos.sort((a, b) => a.resoID.localeCompare(b.resoID));
        const highestResoID = sortedResos.length > 0 ? (parseInt(sortedResos[sortedResos.length - 1].resoID, 10) + 1).toString().padStart(4, "0") : "0001";
        const newResoPayload: Reso = { resoID: highestResoID, delegateID, committeeID, content, title, isNew: false };
        const { data: insertedReso, error: insertError } = await supabase.from("Resos").insert(newResoPayload).select().single();
        if (insertError) throw insertError;
        const createdReso: Reso = (insertedReso as Reso) ?? { ...newResoPayload };
""",
    """        const { data: createdResoId, error: createError } = await supabase.rpc("create_resolution", {
          p_title: title.trim(),
          p_content: content,
        });
        if (createError) throw createError;
        if (!createdResoId) throw new Error("Resolution creation returned no ID");
        const createdReso: Reso = { resoID: createdResoId, delegateID, committeeID, content, title: title.trim(), isNew: false };
""",
)

# Speech ownership comes directly from the linked app profile; creation is atomic.
replace_exact(
    "app/speechrepo/page.tsx",
    'import { Chair, Speech } from "@/db/types";',
    'import { Speech } from "@/db/types";',
)
start = "  const resolveDelegateProfile = React.useCallback(async (): Promise<{ delegateID: string; committeeID?: string | null; country?: string | null; name?: string } | null> => {"
end = "  }, [currentUser, isDelegateUser]);"
speech_path = Path("app/speechrepo/page.tsx")
speech_text = speech_path.read_text()
start_index = speech_text.find(start)
if start_index < 0:
    raise SystemExit("speechrepo: delegate resolver start not found")
end_index = speech_text.find(end, start_index)
if end_index < 0:
    raise SystemExit("speechrepo: delegate resolver end not found")
end_index += len(end)
replacement = """  const resolveDelegateProfile = React.useCallback(async (): Promise<{ delegateID: string; committeeID?: string | null; country?: string | null; name?: string } | null> => {
    if (!currentUser || !isDelegateUser || !currentUser.legacy_id) return null;
    return {
      delegateID: currentUser.legacy_id,
      committeeID: currentUser.committee_id,
      country: currentUser.country,
      name: currentUser.full_name,
    };
  }, [currentUser, isDelegateUser]);"""
speech_text = speech_text[:start_index] + replacement + speech_text[end_index:]
speech_path.write_text(speech_text)

replace_exact(
    "app/speechrepo/page.tsx",
    '(currentUser as Chair).chairID',
    'currentUser.legacy_id',
    expected=3,
)
replace_exact(
    "app/speechrepo/page.tsx",
    """        const { data: existingSpeeches, error: speechIdError } = await supabase.from("Speech").select("speechID");
        if (speechIdError) {
          console.error("[speechrepo] fetch Speech IDs", { code: speechIdError.code, message: speechIdError.message, details: speechIdError.details, hint: speechIdError.hint });
          throw speechIdError;
        }
        const numericSpeechIds = (existingSpeeches ?? []).map((row) => Number.parseInt(row.speechID, 10)).filter((id) => Number.isFinite(id));
        const nextSpeechId = (numericSpeechIds.length > 0 ? Math.max(...numericSpeechIds) + 1 : 1).toString().padStart(4, "0");

        const { error: insertError } = await supabase.from("Speech").insert({ speechID: nextSpeechId, content: serializedContent, title: title.trim(), date: timestamp });
        if (insertError) {
          console.error("[speechrepo] insert Speech", { code: insertError.code, message: insertError.message, details: insertError.details, hint: insertError.hint });
          throw insertError;
        }

        if (isDelegateUser && delegateProfile?.delegateID) {
          if (process.env.NODE_ENV !== "production") console.debug("[speechrepo] saveDelegateId", delegateProfile.delegateID);
          const { error: linkError } = await supabase.from("Delegate-Speech").insert({ speechID: nextSpeechId, delegateID: delegateProfile.delegateID });
          if (linkError) {
            console.error("[speechrepo] insert Delegate-Speech link", { code: linkError.code, message: linkError.message, details: linkError.details, hint: linkError.hint });
            throw linkError;
          }
        } else if (isChairUser) {
          const { error: linkError } = await supabase.from("Chair-Speech").insert({ speechID: nextSpeechId, chairID: currentUser.legacy_id });
          if (linkError) {
            console.error("[speechrepo] insert Chair-Speech link", { code: linkError.code, message: linkError.message, details: linkError.details, hint: linkError.hint });
            throw linkError;
          }
        }

""",
    """        if (!currentUser.legacy_id) {
          throw new Error("Conference profile is not linked to a legacy identity");
        }
        const { data: nextSpeechId, error: createError } = await supabase.rpc("create_speech", {
          p_title: title.trim(),
          p_content: serializedContent,
          p_date: timestamp,
        });
        if (createError) throw createError;
        if (!nextSpeechId) throw new Error("Speech creation returned no ID");

""",
)

# Secretariat shares the staff portal and can publish conference updates.
replace_exact(
    "components/protectedroute.tsx",
    "// protects from any1 who aint an admin",
    "// protects staff-only pages from delegates and chairs",
)
replace_exact(
    "components/protectedroute.tsx",
    "const blocked = !isAuthenticated || currentUser?.role !== 'admin';",
    "const blocked = !isAuthenticated || !['admin', 'secretariat'].includes(currentUser?.role || '');",
)
replace_exact(
    "app/api/upload-image/route.ts",
    "if (sessionUser.role !== 'admin') {",
    "if (!['admin', 'secretariat'].includes(sessionUser.role)) {",
)

for checked_path in (
    migration,
    "db/types.ts",
    "db/supabase-database.types.ts",
    "lib/auth/mapAppUserToSessionUser.ts",
    "app/resolutions/page.tsx",
    "app/speechrepo/page.tsx",
    "components/protectedroute.tsx",
    "app/api/upload-image/route.ts",
):
    content = Path(checked_path).read_text()
    if "\r\n" in content:
        raise SystemExit(f"{checked_path}: unexpected CRLF")
