from pathlib import Path


def replace_exact(path: str, old: str, new: str, expected: int = 1) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{path}: expected {expected} matches, found {count}: {old[:180]!r}")
    file.write_text(text.replace(old, new))


migration = "supabase/migrations/20260804183000_identity_link_and_rls_hardening.sql"

replace_exact(
    "app/speechrepo/page.tsx",
    '''        } else if (isChairUser) {
          const chairUser = currentUser as Chair;
          const { data, error } = await supabase.from("Chair-Speech").select("speechID").eq("chairID", chairUser.chairID);
          if (error) { logDbError("fetch chair links", error as { code?: string; message?: string; details?: string; hint?: string }); throw error; }
          speechIds = (data ?? []).map((row) => ({ speechID: row.speechID }));
        }
''',
    '''        } else if (isChairUser) {
          if (!currentUser.legacy_id) {
            setFetchedSpeeches([]);
            return;
          }
          const { data, error } = await supabase.from("Chair-Speech").select("speechID").eq("chairID", currentUser.legacy_id);
          if (error) { logDbError("fetch chair links", error as { code?: string; message?: string; details?: string; hint?: string }); throw error; }
          speechIds = (data ?? []).map((row) => ({ speechID: row.speechID }));
        }
''',
)

replace_exact(
    "app/speechrepo/page.tsx",
    '''      await supabase.from("Speech").delete().eq("speechID", selectedSpeech.speechID);
      if (isDelegateUser && delegateProfile?.delegateID) await supabase.from("Delegate-Speech").delete().eq("speechID", selectedSpeech.speechID).eq("delegateID", delegateProfile.delegateID);
      else if (isChairUser) await supabase.from("Chair-Speech").delete().eq("speechID", selectedSpeech.speechID).eq("chairID", currentUser.legacy_id);
''',
    '''      const { error: deleteError } = await supabase.rpc("delete_speech", {
        p_speech_id: selectedSpeech.speechID,
      });
      if (deleteError) throw deleteError;
''',
)

function_sql = r'''
create or replace function public.delete_speech(
  p_speech_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  app_role text := public.current_app_role();
  legacy_owner_id text := public.current_legacy_id();
begin
  if auth.uid() is null or app_role not in ('delegate', 'chair') then
    raise exception 'Only authenticated delegates and chairs can delete speeches' using errcode = '42501';
  end if;
  if legacy_owner_id is null then
    raise exception 'Conference profile is not linked to a legacy identity' using errcode = '23503';
  end if;

  if app_role = 'delegate' then
    if not exists (
      select 1 from public."Delegate-Speech"
      where "speechID" = p_speech_id and "delegateID" = legacy_owner_id
    ) then
      raise exception 'Speech is not owned by this delegate' using errcode = '42501';
    end if;
    delete from public."Delegate-Speech"
    where "speechID" = p_speech_id and "delegateID" = legacy_owner_id;
  else
    if not exists (
      select 1 from public."Chair-Speech"
      where "speechID" = p_speech_id and "chairID" = legacy_owner_id
    ) then
      raise exception 'Speech is not owned by this chair' using errcode = '42501';
    end if;
    delete from public."Chair-Speech"
    where "speechID" = p_speech_id and "chairID" = legacy_owner_id;
  end if;

  delete from public."Speech" where "speechID" = p_speech_id;
  if not found then
    raise exception 'Speech does not exist' using errcode = 'P0002';
  end if;
end;
$$;

'''
replace_exact(
    migration,
    "revoke all on function public.create_resolution(text, jsonb) from public, anon;\n",
    function_sql + "revoke all on function public.create_resolution(text, jsonb) from public, anon;\n",
)
replace_exact(
    migration,
    "revoke all on function public.create_speech(text, text, text) from public, anon;\n",
    "revoke all on function public.create_speech(text, text, text) from public, anon;\nrevoke all on function public.delete_speech(text) from public, anon;\n",
)
replace_exact(
    migration,
    "grant execute on function public.create_speech(text, text, text) to authenticated;\n",
    "grant execute on function public.create_speech(text, text, text) to authenticated;\ngrant execute on function public.delete_speech(text) to authenticated;\n",
)
replace_exact(
    migration,
    'grant select, update, delete on table public."Speech" to authenticated;\ngrant select, delete on table public."Delegate-Speech" to authenticated;\ngrant select, delete on table public."Chair-Speech" to authenticated;',
    'grant select, update on table public."Speech" to authenticated;\ngrant select on table public."Delegate-Speech" to authenticated;\ngrant select on table public."Chair-Speech" to authenticated;',
)

replace_exact(
    migration,
    """create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  display_name text,
  country text,
  committee_id uuid references public.\"Committee\"(\"committeeID\") on delete set null,
  committee_name text,
  role text,
  message text not null check (char_length(message) between 1 and 4000),
  source text not null default 'delegate_nav_support',
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

""",
    """create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  display_name text,
  country text,
  committee_id uuid references public.\"Committee\"(\"committeeID\") on delete set null,
  committee_name text,
  role text,
  message text not null check (char_length(message) between 1 and 4000),
  source text not null default 'delegate_nav_support',
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_requests add column if not exists status text not null default 'open';
alter table public.support_requests add column if not exists updated_at timestamptz not null default now();

""",
)

replace_exact(
    "db/supabase-database.types.ts",
    """      create_speech: {
        Args: { p_title: string; p_content: string; p_date: string };
        Returns: string;
      };
""",
    """      create_speech: {
        Args: { p_title: string; p_content: string; p_date: string };
        Returns: string;
      };
      delete_speech: {
        Args: { p_speech_id: string };
        Returns: undefined;
      };
""",
)

for checked_path in (
    "app/speechrepo/page.tsx",
    migration,
    "db/supabase-database.types.ts",
):
    if "\r\n" in Path(checked_path).read_text():
        raise SystemExit(f"{checked_path}: unexpected CRLF")
