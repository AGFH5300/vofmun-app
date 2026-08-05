// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useEffect, useState, useCallback } from "react";
import { Reso, SessionUser, shortenedDel } from "@/db/types";
import type { Json } from "@/db/supabase-database.types";
import { useSession } from "../context/sessionContext";
import { ParticipantRoute } from "@/components/protectedroute";
import { toast } from "sonner";
import role from "@/lib/roles";
import supabase from "@/lib/supabase";
import { AlertTriangle, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";

const EMPTY_DOCUMENT = { type: "doc", content: [{ type: "paragraph" }] };
const UNSAVED_CHANGES_MESSAGE =
  "You have unsaved changes. Do you want to leave without saving?";
const EXTERNAL_DOC_LABEL = "External document link:";

type TiptapContentNode = {
  text?: string;
  marks?: { type?: string; attrs?: { href?: string } }[];
  content?: TiptapContentNode[];
};

const isNonEmptyHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const readExternalDocLink = (content?: object | null) => {
  const doc = content as { content?: TiptapContentNode[] } | undefined;
  const firstNode = doc?.content?.[0];
  const labelText = firstNode?.content?.[0]?.text;
  const linkNode = firstNode?.content?.[1];
  const href = linkNode?.marks?.find((mark) => mark.type === "link")?.attrs?.href;

  if (labelText !== `${EXTERNAL_DOC_LABEL} ` || !href) {
    return "";
  }

  return href;
};

const addExternalDocBlock = (docLink: string) => {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: `${EXTERNAL_DOC_LABEL} ` },
          {
            type: "text",
            text: docLink,
            marks: [{ type: "link", attrs: { href: docLink } }],
          },
        ],
      },
      ...EMPTY_DOCUMENT.content,
    ],
  };
};

const parseResoContent = (raw?: Json): Record<string, unknown> | undefined => {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== "string") return undefined;

  try {
    return JSON.parse(raw);
  } catch {
    const paragraphs = raw.split(/\r?\n+/).map((paragraph) => ({
      type: "paragraph",
      content: paragraph ? [{ type: "text", text: paragraph }] : [],
    }));

    return { type: "doc", content: paragraphs.length > 0 ? paragraphs : [{ type: "paragraph" }] };
  }
};

const Page = () => {
  const { user: currentUser, login } = useSession();
  const userRole = role(currentUser);
  const [fetchedResos, setFetchedResos] = useState<Reso[]>([]);
  const [selectedReso, setSelectedReso] = useState<Reso | null>(null);
  const [delegates, setDelegates] = useState<shortenedDel[]>([]);
  const [committees, setCommittees] = useState<{ committeeID: string; committeeCode: string }[]>([]);
  const [title, setTitle] = useState<string>("");
  const [docLink, setDocLink] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const isDelegateUser = userRole === "delegate" && currentUser !== null;

  const initialStateRef = React.useRef({ title: "", docLink: "" });
  const isBusy = isSaving || isDeleting;
  const delegateAlreadyHasReso = React.useMemo(() => {
    if (!isDelegateUser || !currentUser) return false;
    return fetchedResos.some((reso) => reso.delegateID === currentUser.legacy_id);
  }, [currentUser, fetchedResos, isDelegateUser]);

  const isValidUuid = useCallback((value: string) => /^[0-9a-fA-F-]{36}$/.test(value), []);
  const committeeIdFor = useCallback((value: string) => committees.find((c) => c.committeeID === value || c.committeeCode === value)?.committeeID ?? value, [committees]);

  const getCommitteeDisplayName = useCallback(() => {
    if (!currentUser?.committee_id) return "your assigned committee";
    const committee = committees.find((item) => item.committeeID === currentUser.committee_id);
    return committee?.committeeCode || "your assigned committee";
  }, [committees, currentUser?.committee_id]);

  useEffect(() => {
    const loadCommittees = async () => {
      const { data, error } = await supabase.from("Committee").select("committeeID, committeeCode").order("committeeCode", { ascending: true });
      if (error) {
        console.error("Failed to load committees", error);
        toast.error("Unable to load committees");
      } else setCommittees(data ?? []);
    };
    loadCommittees();
  }, []);

  const evaluateUnsavedChanges = useCallback(() => {
    const dirty = title !== initialStateRef.current.title || docLink.trim() !== initialStateRef.current.docLink;
    setHasUnsavedChanges(dirty);
  }, [docLink, title]);

  useEffect(() => { evaluateUnsavedChanges(); }, [title, evaluateUnsavedChanges]);

  useEffect(() => {
    const baselineTitle = selectedReso?.title ?? "";
    const parsedContent = parseResoContent(selectedReso?.content ?? null);
    setTitle(baselineTitle);
    setDocLink(readExternalDocLink(parsedContent));
    initialStateRef.current = { title: baselineTitle, docLink: readExternalDocLink(parsedContent) };
    setHasUnsavedChanges(false);
  }, [selectedReso]);

  const logBackIn = useCallback(async (): Promise<SessionUser | null> => {
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

  useEffect(() => {
    const fetchDels = async () => {
      if (!currentUser || userRole !== "chair" || !currentUser.committee_id) return;
      try {
        const { data, error } = await supabase
          .from("app_users")
          .select("legacy_id, first_name, last_name, reso_perms")
          .eq("committee_id", currentUser.committee_id)
          .eq("role", "delegate")
          .not("legacy_id", "is", null);
        if (error) throw error;
        setDelegates((data || []).map((delegate) => ({
          delegateID: delegate.legacy_id as string,
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
  }, [currentUser, userRole]);
  useEffect(() => { logBackIn(); }, [logBackIn]);

  useEffect(() => {
    const fetchResos = async () => {
      if (!currentUser) return;
      if ((userRole === "delegate" || userRole === "chair") && committees.length === 0) return;
      try {
        let query = supabase.from("Resos").select("*");
        if (userRole === "delegate") {
          if (!currentUser.reso_perms["view:allreso"]) {
            if (!currentUser.legacy_id) {
            toast.error("Your delegate profile is not linked. Please contact admin.");
            return;
          }
            query = query.eq("delegateID", currentUser.legacy_id);
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
  }, [committees.length, committeeIdFor, currentUser, isValidUuid, selectedReso, userRole]);

  const confirmDiscardChanges = useCallback(() => !hasUnsavedChanges || window.confirm(UNSAVED_CHANGES_MESSAGE), [hasUnsavedChanges]);
  useEffect(() => { if (!hasUnsavedChanges) return; const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = UNSAVED_CHANGES_MESSAGE; return UNSAVED_CHANGES_MESSAGE; }; window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h); }, [hasUnsavedChanges]);

  const handleSelectReso = useCallback((reso: Reso) => { if (isBusy || selectedReso?.resoID === reso.resoID || !confirmDiscardChanges()) return; setSelectedReso(reso); }, [confirmDiscardChanges, isBusy, selectedReso]);
  const handleCreateNewReso = useCallback(() => { if (isBusy) return; if (isDelegateUser && delegateAlreadyHasReso) { toast.error("You can only post one resolution as a delegate."); return; } if (!confirmDiscardChanges()) return; setSelectedReso(null); setTitle(""); setDocLink(""); }, [confirmDiscardChanges, delegateAlreadyHasReso, isBusy, isDelegateUser]);

  const postReso = async () => { /* unchanged save logic */
    if (isBusy) return;
    if (isDelegateUser && !selectedReso && delegateAlreadyHasReso) return toast.error("You can only post one resolution as a delegate.");
    const updatedUser = await logBackIn(); if (!updatedUser) return;
    const updatedUserRole = role(updatedUser);
    const updatedUserIsDelegate = updatedUserRole === "delegate" && updatedUser !== null;
    const trimmedDocLink = docLink.trim();
    if (trimmedDocLink && !isNonEmptyHttpUrl(trimmedDocLink)) return toast.error("Please enter a valid document URL (http or https).");
    if (!trimmedDocLink) return toast.error("Please enter a Google Docs URL.");
    if (!updatedUserIsDelegate && !selectedReso) return toast.error("Only delegates can post resolutions.");
    if (updatedUserIsDelegate) {
      const delegateUser = updatedUser;
      if (!delegateUser.reso_perms["update:ownreso"] && selectedReso?.delegateID === delegateUser.legacy_id) return toast.error("You do not have permission to post resolutions.");
      if (selectedReso && (selectedReso.delegateID !== delegateUser.legacy_id && !(delegateUser.reso_perms["update:reso"]?.includes(selectedReso.resoID)))) return toast.error("You can only update your own resolutions.");
    }
    if (!title.trim()) return toast.error("Please enter a resolution title");

    const content = addExternalDocBlock(trimmedDocLink);
    let delegateID = "0000"; let committeeID = "";
    if (updatedUserIsDelegate) {
      const delegateUser = updatedUser;
      if (!delegateUser.legacy_id) return toast.error("Your delegate profile is not linked. Please contact admin.");
      delegateID = delegateUser.legacy_id; committeeID = committeeIdFor(delegateUser.committee_id || "");
      if (!isValidUuid(committeeID)) return toast.error("Unable to resolve your committee. Please contact admin.");
      if (fetchedResos.filter((r) => r.delegateID === delegateUser.legacy_id).length >= 1 && !selectedReso) return toast.error("You can only post one resolution as a delegate.");
    } else if (updatedUserRole === "chair" && selectedReso) {
      const chairUser = updatedUser; committeeID = committeeIdFor(chairUser.committee_id || "");
      if (!isValidUuid(committeeID)) return toast.error("Unable to resolve your committee. Please contact admin.");
      delegateID = selectedReso.delegateID;
    }

    setIsSaving(true);
    try {
      if (selectedReso) {
        const { error: updateError } = await supabase.from("Resos").update({ content, title }).eq("resoID", selectedReso.resoID);
        if (updateError) throw updateError;
        const updatedReso: Reso = { ...selectedReso, content, title };
        setFetchedResos((prev) => prev.map((r) => r.resoID === updatedReso.resoID ? updatedReso : r)); setSelectedReso(updatedReso); toast.success("Resolution updated successfully!");
      } else {
        const { data: createdResoId, error: createError } = await supabase.rpc("create_resolution", {
          p_title: title.trim(),
          p_content: content,
        });
        if (createError) throw createError;
        if (!createdResoId) throw new Error("Resolution creation returned no ID");
        const createdReso: Reso = { resoID: createdResoId, delegateID, committeeID, content, title: title.trim(), isNew: false };
        setFetchedResos((prev) => [...prev, createdReso]); setSelectedReso(createdReso); toast.success("Resolution posted successfully!");
      }
      initialStateRef.current = { title, docLink: trimmedDocLink }; setHasUnsavedChanges(false);
    } catch (error) { console.error("Failed to save resolution:", error); toast.error("Failed to post resolution"); } finally { setIsSaving(false); }
  };

  const handleDeleteReso = useCallback(async () => { if (!selectedReso || isBusy) return; const updatedUser = await logBackIn(); if (!updatedUser) return; const updatedRole = role(updatedUser); if (updatedRole === "delegate") { const d = updatedUser; const owns = selectedReso.delegateID === d.legacy_id; const hasPerm = Array.isArray(d.reso_perms?.["update:reso"]) ? d.reso_perms["update:reso"].includes(selectedReso.resoID) : false; if (!owns && !hasPerm) return toast.error("You can only delete resolutions you are allowed to update."); } else if (updatedRole !== "chair") return toast.error("You do not have permission to delete this resolution."); if (!window.confirm("Are you sure you want to delete this resolution? This action cannot be undone.")) return; setIsDeleting(true); try { const { error } = await supabase.from("Resos").delete().eq("resoID", selectedReso.resoID); if (error) throw error; const updated = fetchedResos.filter((r) => r.resoID !== selectedReso.resoID); setFetchedResos(updated); if (updated.length > 0) setSelectedReso(updated[0]); else { setSelectedReso(null); setTitle(""); setDocLink(""); initialStateRef.current = { title: "", docLink: "" }; } setHasUnsavedChanges(false); toast.success("Resolution deleted successfully."); } catch (error) { console.error("Failed to delete resolution:", error); toast.error("Failed to delete resolution"); } finally { setIsDeleting(false); } }, [fetchedResos, isBusy, logBackIn, selectedReso]);

  if (userRole !== "delegate" && userRole !== "chair") return <div className="p-8 text-center">Restricted access.</div>;

  const statusTone = (status?: string | null) => {
    const normalized = (status || "").toLowerCase();
    if (normalized.includes("pending")) return "text-amber-700 bg-amber-100";
    if (normalized.includes("need") || normalized.includes("revision") || normalized.includes("edit")) return "text-rose-700 bg-rose-100";
    if (normalized.includes("accept") || normalized.includes("approved")) return "text-emerald-700 bg-emerald-100";
    if (normalized.includes("reject")) return "text-slate-700 bg-slate-200";
    return "text-slate-700 bg-slate-100";
  };

  return (
    <ParticipantRoute>
      <main className="min-h-screen bg-[#f9f9f9] text-[#1a1c1c] px-8 pb-12 pt-6" style={{ fontFamily: "var(--font-manrope), Manrope, ui-sans-serif, system-ui" }}>
        <div className="max-w-6xl mx-auto space-y-10">
          <header>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#6E1D1B]/80">Official Portal</p>
            <h1 className="text-4xl md:text-[2.8rem] font-semibold text-[#6E1D1B] mt-2" style={{ fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif" }}>Resolution Submissions</h1>
            <p className="max-w-3xl text-[#5d5f5f] mt-3">This is the official portal for submitting and tracking resolutions for {getCommitteeDisplayName()}. Once submitted, resolutions appear here for live review updates.</p>
          </header>

          <section className="grid grid-cols-1 xl:grid-cols-12 gap-10">
            <aside className="xl:col-span-4 space-y-6">
              <div className="bg-white p-7 rounded-lg border border-[#dcc0bd]/30 shadow-[0_8px_32px_rgba(26,28,28,0.06)] space-y-5">
                <h2 className="text-xl font-semibold text-[#6E1D1B]" style={{ fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif" }}>Submit New Resolution</h2>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-semibold text-[#5d5f5f] mb-2">Resolution Title</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={isBusy} placeholder="e.g., Regional Security in SE Asia" className="w-full rounded-lg bg-[#f4f3f3] border border-[#e2e2e2] px-4 py-3 text-sm focus:ring-2 focus:ring-[#6E1D1B]/20 focus:border-[#6E1D1B]/30 outline-none disabled:opacity-60" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-semibold text-[#5d5f5f] mb-2">Google Docs URL</label>
                  <input type="url" value={docLink} onChange={(e) => setDocLink(e.target.value)} disabled={isBusy} placeholder="https://docs.google.com/..." className="w-full rounded-lg bg-[#f4f3f3] border border-[#e2e2e2] px-4 py-3 text-sm focus:ring-2 focus:ring-[#6E1D1B]/20 focus:border-[#6E1D1B]/30 outline-none disabled:opacity-60" />
                </div>
                <button onClick={postReso} disabled={isBusy} className="w-full rounded-lg bg-[#6E1D1B] text-white py-3.5 font-bold tracking-wide hover:opacity-90 disabled:opacity-60">{isSaving ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Saving...</span> : (selectedReso ? "Update Resolution" : "Link Document")}</button>
                <button onClick={handleCreateNewReso} disabled={isBusy || (isDelegateUser && !selectedReso && delegateAlreadyHasReso)} className="w-full rounded-lg border border-[#6E1D1B]/30 text-[#6E1D1B] py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2"><Plus size={14} />New Resolution</button>
                {selectedReso && <button onClick={handleDeleteReso} disabled={isBusy} className="w-full rounded-lg border border-rose-300 text-rose-700 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2">{isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 size={14} />}Delete Resolution</button>}
                {hasUnsavedChanges && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 inline-flex items-center gap-2"><AlertTriangle size={14} />Unsaved changes detected.</div>}
              </div>

              <div className="bg-[#6E1D1B] text-white p-7 rounded-lg relative overflow-hidden">
                <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif" }}>Protocol Note</h3>
                <p className="text-sm leading-relaxed mt-2 text-white/85">Once submitted, your resolution will appear in your submissions list for review. If revisions are requested, update the same submission and resubmit.</p>
              </div>
            </aside>

            <div className="xl:col-span-8 space-y-8">
              <section className="bg-white rounded-lg p-7 border border-[#dcc0bd]/25">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl" style={{ fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif" }}>Your Submissions</h2>
                  <span className="px-3 py-1 rounded-full bg-[#e8e8e8] text-[10px] uppercase tracking-wider font-bold text-[#5d5f5f]">Total: {fetchedResos.length}</span>
                </div>

                {fetchedResos.length === 0 ? <p className="text-sm text-[#5d5f5f] py-6">No submissions yet. Use the form to submit your first resolution.</p> : <div className="space-y-4">{fetchedResos.map((reso) => {
                  const createdAt = (reso as Reso & { created_at?: string; submitted_at?: string }).submitted_at || (reso as Reso & { created_at?: string; submitted_at?: string }).created_at;
                  const status = (reso as Reso & { status?: string }).status || "Unknown";
                  const chairComment = (reso as Reso & { comment?: string }).comment;
                  const openableLink = readExternalDocLink(parseResoContent(reso.content));
                  return (
                    <article key={reso.resoID} className={`rounded-lg border p-5 ${selectedReso?.resoID === reso.resoID ? "border-[#6E1D1B]/40 bg-[#fff8f6]" : "border-[#e2e2e2] bg-white"}`}>
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest text-[#6b7280] font-bold">
                            <span>Res-{reso.resoID}</span>
                            <span className="px-2 py-0.5 rounded bg-[#eee0d5] text-[#4e453d]">{getCommitteeDisplayName()}</span>
                          </div>
                          <button onClick={() => handleSelectReso(reso)} disabled={isBusy} className="text-left text-xl font-semibold text-[#500608] hover:underline" style={{ fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif" }}>{reso.title || "Untitled Resolution"}</button>
                          {createdAt && <p className="text-xs text-[#6b7280]">Submitted {new Date(createdAt).toLocaleDateString()}</p>}
                          {chairComment && <p className="text-sm text-[#564240]">Chair comment: {chairComment}</p>}
                        </div>
                        <div className="flex flex-col items-start md:items-end gap-3">
                          <div className="text-right"><p className="text-[9px] uppercase tracking-widest text-[#9ca3af] font-bold">Status</p><span className={`inline-block mt-1 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold ${statusTone(status)}`}>{status}</span></div>
                          {openableLink && <a href={openableLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#6E1D1B] hover:underline">Open Document <ExternalLink size={13} /></a>}
                        </div>
                      </div>
                    </article>
                  );
                })}</div>}
              </section>

              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#FFF0E5] rounded-lg p-6">
                  <h3 className="text-lg text-[#6E1D1B] font-semibold" style={{ fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif" }}>Pre-Session Checklist</h3>
                  <ul className="mt-3 space-y-2 text-sm text-[#564240]"><li>• Google Doc access is enabled for reviewers</li><li>• Resolution title is clear and specific</li><li>• Sponsors/signatories added if required</li></ul>
                </div>
                <div className="bg-[#e2e2e2] rounded-lg p-6 flex items-center justify-center text-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[#6b7280] font-bold">Live Status</p>
                    <p className="text-2xl text-[#6E1D1B] font-semibold mt-1" style={{ fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif" }}>Resolution workspace ready</p>
                    <p className="text-xs text-[#6b7280] mt-1">You can submit, update, and track status changes here{userRole === "chair" ? ` across ${delegates.length} delegate account${delegates.length === 1 ? "" : "s"}` : ""}.</p>
                  </div>
                </div>
              </section>
            </div>
          </section>
        </div>
      </main>
    </ParticipantRoute>
  );
};

export default Page;
