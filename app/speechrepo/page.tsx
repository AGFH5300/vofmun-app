// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React, { useEffect, useState } from "react";
import { Chair, Delegate, Speech } from "@/db/types";
import { useSession } from "../context/sessionContext";
import { Editor } from "@tiptap/react";
import { SimpleEditor } from "../../components/tiptap-templates/simple/simple-editor";
import { ParticipantRoute } from "@/components/protectedroute";
import { toast } from "sonner";
import role from "@/lib/roles";
import supabase from "@/lib/supabase";
import { FileText, Loader2, Plus, Printer, Trash2 } from "lucide-react";

type SpeechRow = Omit<Speech, "tags">;

const EMPTY_DOCUMENT = { type: "doc", content: [{ type: "paragraph" }] };
const serializeDocument = (content?: object | null) => JSON.stringify(content ?? EMPTY_DOCUMENT);
const UNSAVED_CHANGES_MESSAGE = "You have unsaved changes. Do you want to leave without saving?";

const parseSpeechContent = (raw?: string | object | null) => {
  if (!raw) return undefined;
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") return undefined;

  try {
    return JSON.parse(raw);
  } catch {
    const paragraphs = raw.split(/\r?\n+/).map((paragraph) => ({
      type: "paragraph",
      content: paragraph ? [{ type: "text", text: paragraph }] : [],
    }));

    return {
      type: "doc",
      content: paragraphs.length > 0 ? paragraphs : [{ type: "paragraph" }],
    };
  }
};

const extractText = (node: unknown): string => {
  if (!node || typeof node !== "object") return "";
  const n = node as { text?: string; content?: unknown[] };
  const own = typeof n.text === "string" ? n.text : "";
  const child = Array.isArray(n.content) ? n.content.map(extractText).join(" ") : "";
  return `${own} ${child}`.trim();
};

const formatSpeechDate = (date?: string) => {
  if (!date) return "No date";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "No date";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const Page = () => {
  const { user: currentUser } = useSession();
  const userRole = role(currentUser);
  const editorRef = React.useRef<Editor | null>(null);
  const [fetchedSpeeches, setFetchedSpeeches] = useState<Speech[]>([]);
  const [selectedSpeech, setSelectedSpeech] = useState<Speech | null>(null);
  const [title, setTitle] = useState<string>("");
  const [editorText, setEditorText] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [delegateProfileError, setDelegateProfileError] = useState<string | null>(null);
  const [resolvedDelegateId, setResolvedDelegateId] = useState<string | null>(null);
  const isDelegateUser = userRole === "delegate" && currentUser !== null;
  const isChairUser = userRole === "chair" && currentUser !== null;
  const initialStateRef = React.useRef({ title: "", content: serializeDocument(EMPTY_DOCUMENT) });
  const isBusy = isSaving || isDeleting;
  const parsedSpeechContent = React.useMemo(() => parseSpeechContent(selectedSpeech?.content ?? null), [selectedSpeech]);

  const wordCount = React.useMemo(() => {
    const trimmed = editorText.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [editorText]);
  const characterCount = editorText.length;
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 130));

  const getEditorSnapshot = React.useCallback(() => {
    if (!editorRef.current) return initialStateRef.current.content;
    try {
      return JSON.stringify(editorRef.current.getJSON());
    } catch {
      return initialStateRef.current.content;
    }
  }, []);

  const evaluateUnsavedChanges = React.useCallback(() => {
    const contentSnapshot = getEditorSnapshot();
    const dirty = contentSnapshot !== initialStateRef.current.content || title !== initialStateRef.current.title;
    setHasUnsavedChanges(dirty);
  }, [getEditorSnapshot, title]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleUpdate = () => {
      evaluateUnsavedChanges();
      setEditorText(editor.getText());
    };

    editor.on("update", handleUpdate);
    setEditorText(editor.getText());
    return () => editor.off("update", handleUpdate);
  }, [evaluateUnsavedChanges]);

  useEffect(() => {
    evaluateUnsavedChanges();
  }, [title, evaluateUnsavedChanges]);

  const confirmDiscardChanges = React.useCallback(() => {
    if (!hasUnsavedChanges) return true;
    return window.confirm(UNSAVED_CHANGES_MESSAGE);
  }, [hasUnsavedChanges]);

  const handleStartNewSpeech = React.useCallback(() => {
    if (isBusy || !confirmDiscardChanges()) return;
    setSelectedSpeech(null);
    setTitle("");
    setEditorText("");
    initialStateRef.current = { title: "", content: serializeDocument(EMPTY_DOCUMENT) };
    setHasUnsavedChanges(false);
    if (editorRef.current) {
      editorRef.current.commands.setContent(EMPTY_DOCUMENT);
      editorRef.current.commands.focus("end");
    }
  }, [confirmDiscardChanges, isBusy]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = UNSAVED_CHANGES_MESSAGE;
      return UNSAVED_CHANGES_MESSAGE;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleSelectSpeech = React.useCallback((speech: Speech) => {
    if (isBusy) return;
    if (selectedSpeech?.speechID === speech.speechID) return;
    if (!confirmDiscardChanges()) return;
    setSelectedSpeech(speech);
  }, [confirmDiscardChanges, isBusy, selectedSpeech]);

  useEffect(() => {
    const baselineTitle = selectedSpeech?.title ?? "";
    const parsedContent = parseSpeechContent(selectedSpeech?.content ?? null);
    const baselineContent = serializeDocument(parsedContent ?? null);
    initialStateRef.current = { title: baselineTitle, content: baselineContent };
    setTitle(baselineTitle);

    if (editorRef.current) {
      if (parsedContent) editorRef.current.commands.setContent(parsedContent);
      else editorRef.current.commands.clearContent(true);
      setEditorText(editorRef.current.getText());
    } else {
      setEditorText(extractText(parsedContent));
    }
    setHasUnsavedChanges(false);
  }, [selectedSpeech]);

  useEffect(() => {
    const resolveDelegate = async () => {
      if (!currentUser || !isDelegateUser) {
        setResolvedDelegateId(null);
        setDelegateProfileError(null);
        return;
      }

      const sessionDelegateId = (currentUser as Delegate).delegateID;
      if (sessionDelegateId) {
        setResolvedDelegateId(sessionDelegateId);
        setDelegateProfileError(null);
        return;
      }

      const { data, error } = await supabase.from("Delegate").select("delegateID").eq("email", currentUser.email).maybeSingle();
      if (error) {
        console.error("Failed to resolve delegate profile:", error);
        setResolvedDelegateId(null);
        setDelegateProfileError("Could not find your delegate profile. Please contact support.");
        return;
      }

      if (!data?.delegateID) {
        setResolvedDelegateId(null);
        setDelegateProfileError("Could not find your delegate profile. Please contact support.");
        return;
      }

      setResolvedDelegateId(data.delegateID);
      setDelegateProfileError(null);
    };

    void resolveDelegate();
  }, [currentUser, isDelegateUser]);

  useEffect(() => {
    const fetchSpeeches = async () => {
      if (!currentUser) return;
      if (isDelegateUser && !resolvedDelegateId) {
        setFetchedSpeeches([]);
        return;
      }

      try {
        let speechIds: { speechID: string; delegateID?: string }[] = [];
        if (isDelegateUser && resolvedDelegateId) {
          const { data, error } = await supabase.from<{ speechID: string }>("Delegate-Speech").select("speechID").eq("delegateID", resolvedDelegateId);
          if (error) throw error;
          speechIds = (data ?? []).map((row) => ({ speechID: row.speechID, delegateID: resolvedDelegateId }));
        } else if (isChairUser) {
          const chairUser = currentUser as Chair;
          const { data, error } = await supabase.from<{ speechID: string }>("Chair-Speech").select("speechID").eq("chairID", chairUser.chairID);
          if (error) throw error;
          speechIds = (data ?? []).map((row) => ({ speechID: row.speechID }));
        }

        if (speechIds.length === 0) {
          setFetchedSpeeches([]);
          return;
        }

        const { data: speechRows, error: speechesError } = await supabase.from<SpeechRow>("Speech").select("*").in("speechID", speechIds.map((row) => row.speechID));
        if (speechesError) throw speechesError;

        const normalizedSpeeches: Speech[] = (speechRows ?? []).map((speech) => ({
          ...speech,
          delegateID: speechIds.find((row) => row.speechID === speech.speechID)?.delegateID ?? speech.delegateID ?? "",
          tags: [],
        }));

        setFetchedSpeeches(normalizedSpeeches.sort((a, b) => (a.date < b.date ? 1 : -1)));
      } catch (error) {
        console.error("Failed to fetch speeches:", error);
        toast.error("Failed to fetch speeches");
      }
    };
    void fetchSpeeches();
  }, [currentUser, isDelegateUser, isChairUser, resolvedDelegateId]);

  useEffect(() => {
    if (editorRef.current) editorRef.current.setEditable(!isBusy);
  }, [isBusy]);

  const postSpeech = async () => {
    if (isBusy) return;
    if (!currentUser) return toast.error("No user logged in");
    if (!editorRef.current) return toast.error("Editor not initialized");
    if (editorRef.current.getText().trim().length === 0) return toast.error("Speech content cannot be empty");
    if (!title.trim()) return toast.error("Please enter a speech title");
    if (isDelegateUser && !resolvedDelegateId) {
      setDelegateProfileError("Could not find your delegate profile. Please contact support.");
      return toast.error("Could not find your delegate profile. Please contact support.");
    }

    const content = editorRef.current.getJSON();
    const serializedContent = JSON.stringify(content);
    const timestamp = new Date().toISOString();
    setIsSaving(true);

    try {
      if (selectedSpeech) {
        const { error: updateError } = await supabase.from("Speech").update({ title: title.trim(), content: serializedContent, date: timestamp }).eq("speechID", selectedSpeech.speechID);
        if (updateError) throw updateError;
        const updatedSpeech: Speech = { ...selectedSpeech, title: title.trim(), content: serializedContent, date: timestamp };
        setFetchedSpeeches((prev) => prev.map((speech) => speech.speechID === updatedSpeech.speechID ? updatedSpeech : speech));
        setSelectedSpeech(updatedSpeech);
        toast.success("Speech updated successfully!");
      } else {
        const { data: existingSpeeches, error: speechIdError } = await supabase.from<{ speechID: string }>("Speech").select("speechID");
        if (speechIdError) throw speechIdError;
        const numericSpeechIds = (existingSpeeches ?? []).map((row) => Number.parseInt(row.speechID, 10)).filter((id) => Number.isFinite(id));
        const nextSpeechId = (numericSpeechIds.length > 0 ? Math.max(...numericSpeechIds) + 1 : 1).toString().padStart(4, "0");

        const { error: insertError } = await supabase.from("Speech").insert({ speechID: nextSpeechId, content: serializedContent, title: title.trim(), date: timestamp });
        if (insertError) throw insertError;

        if (isDelegateUser && resolvedDelegateId) {
          const { error: linkError } = await supabase.from("Delegate-Speech").insert({ speechID: nextSpeechId, delegateID: resolvedDelegateId });
          if (linkError) throw linkError;
        } else if (isChairUser) {
          const { error: linkError } = await supabase.from("Chair-Speech").insert({ speechID: nextSpeechId, chairID: (currentUser as Chair).chairID });
          if (linkError) throw linkError;
        }

        const createdSpeech: Speech = { speechID: nextSpeechId, title: title.trim(), content: serializedContent, date: timestamp, delegateID: resolvedDelegateId ?? "", tags: [] };
        setFetchedSpeeches((prev) => [createdSpeech, ...prev]);
        setSelectedSpeech(createdSpeech);
        toast.success("Speech posted successfully!");
      }

      initialStateRef.current = { title: title.trim(), content: getEditorSnapshot() };
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to save speech:", error);
      toast.error("Failed to save speech");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSpeech = async () => {
    if (!selectedSpeech || isBusy) return;
    if (!currentUser) return toast.error("No user logged in");
    if (!isDelegateUser && !isChairUser) return toast.error("You do not have permission to delete speeches.");
    if (isDelegateUser && selectedSpeech.delegateID && selectedSpeech.delegateID !== resolvedDelegateId) return toast.error("You can only delete your own speeches.");
    if (!window.confirm("Are you sure you want to delete this speech? This action cannot be undone.")) return;

    setIsDeleting(true);
    try {
      await supabase.from("Speech").delete().eq("speechID", selectedSpeech.speechID);
      if (isDelegateUser && resolvedDelegateId) await supabase.from("Delegate-Speech").delete().eq("speechID", selectedSpeech.speechID).eq("delegateID", resolvedDelegateId);
      else if (isChairUser) await supabase.from("Chair-Speech").delete().eq("speechID", selectedSpeech.speechID).eq("chairID", (currentUser as Chair).chairID);

      const updatedSpeeches = fetchedSpeeches.filter((speech) => speech.speechID !== selectedSpeech.speechID);
      setFetchedSpeeches(updatedSpeeches);
      if (updatedSpeeches.length > 0) setSelectedSpeech(updatedSpeeches[0]);
      else {
        setSelectedSpeech(null);
        setTitle("");
        setEditorText("");
        initialStateRef.current = { title: "", content: serializeDocument() };
        if (editorRef.current) editorRef.current.commands.clearContent(true);
      }
      setHasUnsavedChanges(false);
      toast.success("Speech deleted successfully.");
    } catch (error) {
      console.error("Failed to delete speech:", error);
      toast.error("Failed to delete speech");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isDelegateUser && !isChairUser) return <div className="min-h-[50vh] flex items-center justify-center text-sm text-[#564240]">Only delegates and chairs can view this page.</div>;

  return (
    <ParticipantRoute>
      <div className="min-h-screen bg-[#f9f9f9] text-[#1a1c1c]" style={{ fontFamily: "var(--font-manrope), Manrope, ui-sans-serif, system-ui" }}>
        <main className="max-w-[1600px] mx-auto px-8 pb-12 pt-8">
          <div className="grid grid-cols-12 gap-8">
            <aside className="col-span-12 lg:col-span-3 space-y-6">
              <div className="p-6 bg-[#f4f3f3] rounded-xl border border-[#dcc0bd]/40 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-[#500608]" style={{ fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif" }}>Saved Speeches</h2>
                  <div className="flex items-center gap-2 text-[#6e1d1b]">
                    <span className="text-[10px] font-bold tracking-widest uppercase">{fetchedSpeeches.length}</span>
                    <FileText size={14} />
                  </div>
                </div>

                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {fetchedSpeeches.length === 0 ? (
                    <div className="rounded-lg bg-white/70 border border-[#dcc0bd]/40 p-4 text-sm text-[#564240]">No saved speeches yet. Start drafting to build your repository.</div>
                  ) : (
                    fetchedSpeeches.map((speech) => {
                      const active = selectedSpeech?.speechID === speech.speechID;
                      return (
                        <button key={speech.speechID} onClick={() => handleSelectSpeech(speech)} disabled={isBusy} className={`w-full p-4 rounded-lg border text-left transition ${active ? "bg-white border-[#6E1D1B]/40 shadow-sm" : "bg-white/85 border-[#dcc0bd]/60 hover:border-[#6E1D1B]/25"}`}>
                          <p className="text-[10px] uppercase tracking-tight text-[#564240]/70">{formatSpeechDate(speech.date)}</p>
                          <h3 className="mt-1 text-lg leading-tight font-semibold text-[#1a1c1c]" style={{ fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif" }}>{speech.title || `Speech ${speech.speechID}`}</h3>
                        </button>
                      );
                    })
                  )}
                </div>

                <button type="button" onClick={handleStartNewSpeech} disabled={isBusy} className="w-full mt-6 py-3 flex items-center justify-center gap-2 rounded-xl text-xs font-bold uppercase tracking-widest text-[#500608] hover:bg-white transition-colors disabled:opacity-60">
                  <Plus size={14} /> New Document
                </button>
              </div>

              <div className="rounded-xl border border-[#6e1d1b]/30 bg-gradient-to-br from-[#6e1d1b] to-[#500608] p-5">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#FFF0E5]/70">Writing tip</p>
                <p className="mt-3 text-[#FFF0E5] text-base leading-relaxed" style={{ fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif" }}>Lead with one concrete ask, then back it with one clear legal or policy rationale.</p>
              </div>
            </aside>

            <section className="col-span-12 lg:col-span-9">
              <div className="bg-white rounded-xl shadow-[0_8px_32px_rgba(26,28,28,0.06)] border border-[#dcc0bd]/30 overflow-hidden flex flex-col min-h-[800px]">
                <div className="px-6 py-4 bg-[#f4f3f3] border-b border-[#dcc0bd]/40 flex items-center justify-between gap-4">
                  <div className="text-xs uppercase tracking-widest text-[#564240]">{selectedSpeech ? `Editing ${selectedSpeech.speechID}` : "New speech"} · {hasUnsavedChanges ? "Unsaved changes" : "Saved"}</div>
                  <button onClick={postSpeech} className="px-6 py-2.5 rounded-xl bg-[#6e1d1b] text-white text-xs font-bold uppercase tracking-widest disabled:opacity-60 inline-flex items-center gap-2" disabled={isBusy}>
                    {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Save Speech"}
                  </button>
                </div>

                <div className="flex-1 p-8 md:p-12 bg-white">
                  <div className="max-w-3xl mx-auto space-y-8 min-h-[540px]">
                    {delegateProfileError && <div className="rounded-lg border border-[#ba1a1a]/25 bg-[#ffdad6] px-4 py-3 text-sm text-[#93000a]">{delegateProfileError}</div>}
                    <div className="border-b border-[#6e1d1b]/10 pb-7 space-y-4">
                      <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={isBusy} placeholder="Enter speech title..." className="w-full bg-transparent outline-none text-4xl font-bold text-[#500608] placeholder:text-[#500608]/25 leading-tight" style={{ fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif" }} />
                      <div className="flex flex-wrap gap-4 items-center text-[11px] font-bold text-[#1a1c1c]">
                        <div className="flex items-center gap-2"><span className="text-[10px] uppercase tracking-widest text-[#564240]/60">Delegation:</span><span>{currentUser?.country || "Delegation assigned"}</span></div>
                        <div className="flex items-center gap-2"><span className="text-[10px] uppercase tracking-widest text-[#564240]/60">Committee:</span><span>{currentUser?.committee_id ? "Committee assigned" : "Committee assigned"}</span></div>
                        <div className="flex items-center gap-2"><span className="text-[10px] uppercase tracking-widest text-[#564240]/60">Duration:</span><span>~{readingMinutes} Minutes</span></div>
                      </div>
                    </div>

                    <div className={`rounded-xl border border-[#dcc0bd]/60 bg-white ${isBusy ? "opacity-60 pointer-events-none" : ""}`}>
                      <SimpleEditor ref={editorRef} content={parsedSpeechContent} className="toolbar-fixed" placeholder="Draft your intervention..." />
                    </div>
                  </div>
                </div>

                <div className="px-8 py-3 bg-[#f4f3f3] border-t border-[#dcc0bd]/40 flex flex-wrap items-center justify-between gap-3 text-[10px] uppercase tracking-widest text-[#564240]">
                  <div className="flex gap-5">
                    <span>Words: {wordCount}</span><span>Characters: {characterCount}</span><span>Reading Time: ~{readingMinutes} min</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedSpeech && <button onClick={handleDeleteSpeech} disabled={isBusy} className="rounded-full border border-[#6E1D1B]/35 p-2 text-[#6E1D1B] disabled:opacity-60">{isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 size={14} />}</button>}
                    <button onClick={() => window.print()} className="rounded-full border border-[#dcc0bd] p-2 text-[#6E1D1B]"><Printer size={14} /></button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </ParticipantRoute>
  );
};

export default Page;
