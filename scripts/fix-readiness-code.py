from pathlib import Path


def replace_exact(path: str, old: str, new: str, expected: int = 1) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{path}: expected {expected} matches, found {count} for {old[:120]!r}")
    file.write_text(text.replace(old, new))


replace_exact(
    "app/messages/page.tsx",
    'room.type === "direct" && room.members.some((member) => String(member.user_id) === receiverId)',
    'room.room_type === "dm" && room.members.some((member) => String(member.user_id) === receiverId)',
)
replace_exact(
    "app/messages/page.tsx",
    '<div key={`${attachment.bucket}:${attachment.path}`} className="min-w-[220px] max-w-[220px] shrink-0 rounded-xl border border-black/10 bg-white p-2.5">',
    '<div key={attachment.id} className="min-w-[220px] max-w-[220px] shrink-0 rounded-xl border border-black/10 bg-white p-2.5">',
)

replace_exact(
    "app/messages/context/ChatContext.tsx",
    """      if (!response.ok) {
        const errorMessage = json?.error || 'Unable to create group chat right now.';
        const devError = json?.devError;
""",
    """      if (!response.ok) {
        const errorPayload =
          json && typeof json === 'object' && ('error' in json || 'devError' in json)
            ? (json as {
                error?: string;
                devError?: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null };
              })
            : null;
        const errorMessage = errorPayload?.error || 'Unable to create group chat right now.';
        const devError = errorPayload?.devError;
""",
)

replace_exact(
    "app/speechrepo/page.tsx",
    '    return () => editor.off("update", handleUpdate);',
    '    return () => {\n      editor.off("update", handleUpdate);\n    };',
)
replace_exact(
    "app/speechrepo/page.tsx",
    "query: Promise<{ data: unknown; error: { code?: string; message?: string; details?: string; hint?: string } | null }>",
    "query: PromiseLike<{ data: any; error: { code?: string; message?: string; details?: string; hint?: string } | null }>",
)
for old, new in (
    ('supabase.from<{ speechID: string }>("Delegate-Speech")', 'supabase.from("Delegate-Speech")'),
    ('supabase.from<{ speechID: string }>("Chair-Speech")', 'supabase.from("Chair-Speech")'),
    ('supabase.from<SpeechRow>("Speech")', 'supabase.from("Speech")'),
    ('supabase.from<{ speechID: string }>("Speech")', 'supabase.from("Speech")'),
):
    replace_exact("app/speechrepo/page.tsx", old, new)

replace_exact(
    "app/resolutions/page.tsx",
    'import { Reso, Delegate, Chair, shortenedDel } from "@/db/types";',
    'import { Reso, SessionUser, shortenedDel } from "@/db/types";',
)
replace_exact(
    "app/resolutions/page.tsx",
    """  const delegateAlreadyHasReso = React.useMemo(() => {
    if (!isDelegateUser || !currentUser || !('delegateID' in currentUser)) return false;
    return fetchedResos.some((reso) => reso.delegateID === currentUser.delegateID);
  }, [currentUser, fetchedResos, isDelegateUser]);
""",
    """  const delegateAlreadyHasReso = React.useMemo(() => {
    if (!isDelegateUser || !currentUser) return false;
    return fetchedResos.some((reso) => reso.delegateID === currentUser.id);
  }, [currentUser, fetchedResos, isDelegateUser]);
""",
)
replace_exact(
    "app/resolutions/page.tsx",
    """  const getCommitteeDisplayName = useCallback(() => {
    if (!currentUser) return "your assigned committee";
    if (userRole === "delegate") {
      const delegateUser = currentUser as Delegate;
      const code = delegateUser.committee?.committeeCode;
      return code && !isValidUuid(code) ? code : "your assigned committee";
    }
    if (userRole === "chair") {
      const chairUser = currentUser as Chair;
      const code = chairUser.committee?.committeeCode;
      return code && !isValidUuid(code) ? code : "your assigned committee";
    }
    return "your assigned committee";
  }, [currentUser, isValidUuid, userRole]);
""",
    """  const getCommitteeDisplayName = useCallback(() => {
    if (!currentUser?.committee_id) return "your assigned committee";
    const committee = committees.find((item) => item.committeeID === currentUser.committee_id);
    return committee?.committeeCode || "your assigned committee";
  }, [committees, currentUser?.committee_id]);
""",
)
replace_exact(
    "app/resolutions/page.tsx",
    """  const logBackIn = useCallback(async () => { /* unchanged logic */
    if (!currentUser) { toast.error("No user logged in"); return null; }
    if (userRole === "delegate") {
      const delegateUser = currentUser as Delegate;
      let latestPerms = delegateUser.resoPerms;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: appUserPerms, error: appUserPermsError } = await (supabase as any).from("app_users").select("reso_perms").eq("id", delegateUser.delegateID).maybeSingle();
      if (!appUserPermsError && appUserPerms?.reso_perms) latestPerms = appUserPerms.reso_perms;
      else if (appUserPermsError) { console.error("Failed to fetch delegate permissions from app_users:", appUserPermsError); toast.error("Failed to fetch delegate permissions"); return null; }
      const enrichedUser: Delegate = { ...delegateUser, resoPerms: latestPerms || { "view:ownreso": false, "view:allreso": false, "update:ownreso": false, "update:reso": [] } };
      if (JSON.stringify(delegateUser.resoPerms) !== JSON.stringify(enrichedUser.resoPerms)) login(enrichedUser);
      return enrichedUser;
    }
    return currentUser;
  }, [currentUser, userRole, login]);
""",
    """  const logBackIn = useCallback(async (): Promise<SessionUser | null> => {
    if (!currentUser) {
      toast.error("No user logged in");
      return null;
    }
    if (userRole !== "delegate") return currentUser;

    const { data, error } = await supabase
      .from("app_users")
      .select("reso_perms")
      .eq("id", currentUser.id)
      .maybeSingle();
    if (error) {
      console.error("Failed to fetch delegate permissions from app_users:", error);
      toast.error("Failed to fetch delegate permissions");
      return null;
    }

    const fallbackPerms: SessionUser["reso_perms"] = {
      "view:ownreso": false,
      "view:allreso": false,
      "update:ownreso": false,
      "update:reso": [],
    };
    const latestPerms = (data?.reso_perms as SessionUser["reso_perms"] | undefined) || currentUser.reso_perms || fallbackPerms;
    const enrichedUser: SessionUser = { ...currentUser, reso_perms: latestPerms, resoPerms: latestPerms };
    if (JSON.stringify(currentUser.reso_perms) !== JSON.stringify(latestPerms)) login(enrichedUser);
    return enrichedUser;
  }, [currentUser, userRole, login]);
""",
)
replace_exact(
    "app/resolutions/page.tsx",
    '  useEffect(() => { const fetchDels = async () => { if (!currentUser || userRole !== "chair") return; try { const chairUser = currentUser as Chair; const { data, error } = await supabase.from("app_users").select("id, first_name, last_name, reso_perms").eq("committee_id", chairUser.committee.committeeID).eq("role", "delegate"); if (error) throw error; setDelegates((data || []).map((d) => ({ delegateID: d.id, firstname: d.first_name || "", lastname: d.last_name || "", resoPerms: d.reso_perms || { "view:ownreso": false, "view:allreso": false, "update:ownreso": false, "update:reso": [] } }))); } catch (error) { console.error("Failed to fetch delegates:", error); toast.error("Failed to fetch delegates"); } }; fetchDels(); }, [currentUser, userRole]);',
    '''  useEffect(() => {
    const fetchDels = async () => {
      if (!currentUser || userRole !== "chair" || !currentUser.committee_id) return;
      try {
        const { data, error } = await supabase
          .from("app_users")
          .select("id, first_name, last_name, reso_perms")
          .eq("committee_id", currentUser.committee_id)
          .eq("role", "delegate");
        if (error) throw error;
        setDelegates((data || []).map((delegate) => ({
          delegateID: delegate.id,
          firstname: delegate.first_name || "",
          lastname: delegate.last_name || "",
          resoPerms: delegate.reso_perms as shortenedDel["resoPerms"],
        })));
      } catch (error) {
        console.error("Failed to fetch delegates:", error);
        toast.error("Failed to fetch delegates");
      }
    };
    void fetchDels();
  }, [currentUser, userRole]);''',
)
replace_exact(
    "app/resolutions/page.tsx",
    '  useEffect(() => { const fetchResos = async () => { if (!currentUser) return; if ((userRole === "delegate" || userRole === "chair") && committees.length === 0) return; try { let query = supabase.from<Reso>("Resos").select("*"); if (userRole === "delegate") { const du = currentUser as Delegate; if (!du.resoPerms["view:allreso"]) query = query.eq("delegateID", du.delegateID); else { const committeeUuid = committeeIdFor(du.committee.committeeID); if (!isValidUuid(committeeUuid)) { toast.error("Invalid committee reference for delegate"); return; } query = query.eq("committeeID", committeeUuid); } } else if (userRole === "chair") { const cu = currentUser as Chair; const committeeUuid = committeeIdFor(cu.committee.committeeID); if (!isValidUuid(committeeUuid)) { toast.error("Invalid committee reference for chair"); return; } query = query.eq("committeeID", committeeUuid); } const { data, error } = await query; if (error) throw error; const fetched = data ?? []; setFetchedResos(fetched); if (selectedReso) { const updated = fetched.find((r: Reso) => r.resoID === selectedReso.resoID); if (updated) setTitle(updated.title || ""); } } catch (error) { console.error("Failed to fetch resolutions:", error); toast.error("Failed to fetch resolutions"); } }; fetchResos(); }, [committees.length, committeeIdFor, currentUser, isValidUuid, selectedReso, userRole]);',
    '''  useEffect(() => {
    const fetchResos = async () => {
      if (!currentUser) return;
      if ((userRole === "delegate" || userRole === "chair") && committees.length === 0) return;
      try {
        let query = supabase.from("Resos").select("*");
        if (userRole === "delegate") {
          if (!currentUser.reso_perms["view:allreso"]) {
            query = query.eq("delegateID", currentUser.id);
          } else {
            const committeeUuid = committeeIdFor(currentUser.committee_id || "");
            if (!isValidUuid(committeeUuid)) {
              toast.error("Invalid committee reference for delegate");
              return;
            }
            query = query.eq("committeeID", committeeUuid);
          }
        } else if (userRole === "chair") {
          const committeeUuid = committeeIdFor(currentUser.committee_id || "");
          if (!isValidUuid(committeeUuid)) {
            toast.error("Invalid committee reference for chair");
            return;
          }
          query = query.eq("committeeID", committeeUuid);
        }
        const { data, error } = await query;
        if (error) throw error;
        const fetched = (data ?? []) as Reso[];
        setFetchedResos(fetched);
        if (selectedReso) {
          const updated = fetched.find((reso) => reso.resoID === selectedReso.resoID);
          if (updated) setTitle(updated.title || "");
        }
      } catch (error) {
        console.error("Failed to fetch resolutions:", error);
        toast.error("Failed to fetch resolutions");
      }
    };
    void fetchResos();
  }, [committees.length, committeeIdFor, currentUser, isValidUuid, selectedReso, userRole]);''',
)

resolutions = Path("app/resolutions/page.tsx")
text = resolutions.read_text()
for old, new in (
    ("const delegateUser = updatedUser as Delegate;", "const delegateUser = updatedUser;"),
    ("delegateUser.resoPerms", "delegateUser.reso_perms"),
    ("delegateUser.delegateID", "delegateUser.id"),
    ("delegateUser.committee.committeeID", 'delegateUser.committee_id || ""'),
    ("const chairUser = updatedUser as Chair;", "const chairUser = updatedUser;"),
    ("chairUser.committee.committeeID", 'chairUser.committee_id || ""'),
    ('supabase.from<{ resoID: string }>("Resos")', 'supabase.from("Resos")'),
    (
        'const d = updatedUser as Delegate; const owns = selectedReso.delegateID === d.delegateID; const hasPerm = Array.isArray(d.resoPerms?.["update:reso"]) ? d.resoPerms["update:reso"].includes(selectedReso.resoID) : false;',
        'const d = updatedUser; const owns = selectedReso.delegateID === d.id; const hasPerm = Array.isArray(d.reso_perms?.["update:reso"]) ? d.reso_perms["update:reso"].includes(selectedReso.resoID) : false;',
    ),
):
    if old not in text:
        raise SystemExit(f"app/resolutions/page.tsx: missing replacement target {old!r}")
    text = text.replace(old, new)
resolutions.write_text(text)

for checked_path in (
    "app/messages/page.tsx",
    "app/messages/context/ChatContext.tsx",
    "app/speechrepo/page.tsx",
    "app/resolutions/page.tsx",
):
    if "\r\n" in Path(checked_path).read_text():
        raise SystemExit(f"{checked_path}: unexpected CRLF")
