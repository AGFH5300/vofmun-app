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
import { Loader2, Plus, Printer, Trash2 } from "lucide-react";

type SpeechRow = Omit<Speech, "tags">;

const EMPTY_DOCUMENT = { type: "doc", content: [{ type: "paragraph" }] };
const serializeDocument = (content?: object | null) =>
  JSON.stringify(content ?? EMPTY_DOCUMENT);
const UNSAVED_CHANGES_MESSAGE =
  "You have unsaved changes. Do you want to leave without saving?";

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
  const isDelegateUser = userRole === "delegate" && currentUser !== null;
  const isChairUser = userRole === "chair" && currentUser !== null;
  const initialStateRef = React.useRef({
    title: "",
    content: serializeDocument(EMPTY_DOCUMENT),
  });
  const isBusy = isSaving || isDeleting;
  const parsedSpeechContent = React.useMemo(
    () => parseSpeechContent(selectedSpeech?.content ?? null),
    [selectedSpeech]
  );

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
    const dirty =
      contentSnapshot !== initialStateRef.current.content ||
      title !== initialStateRef.current.title;
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

  const handleSelectSpeech = React.useCallback(
    (speech: Speech) => {
      if (isBusy) return;
      if (selectedSpeech?.speechID === speech.speechID) return;
      if (!confirmDiscardChanges()) return;
      setSelectedSpeech(speech);
    },
    [confirmDiscardChanges, isBusy, selectedSpeech]
  );

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
    const fetchSpeeches = async () => {
      if (!currentUser) return;
      try {
        let speechIds: { speechID: string; delegateID?: string }[] = [];
        if (isDelegateUser) {
          const delegateUser = currentUser as Delegate;
          const { data, error } = await supabase.from<{ speechID: string }>("Delegate-Speech").select("speechID").eq("delegateID", delegateUser.delegateID);
          if (error) throw error;
          speechIds = (data ?? []).map((row) => ({ speechID: row.speechID, delegateID: delegateUser.delegateID }));
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

        const normalizedSpeeches: Speech[] = (speechRows ?? []).map((speech) => {
          const matchingDelegateId = speechIds.find((row) => row.speechID === speech.speechID)?.delegateID ?? speech.delegateID ?? "";
          return { ...speech, delegateID: matchingDelegateId, tags: [] };
        });

        setFetchedSpeeches(normalizedSpeeches);
      } catch (error) {
        console.error("Failed to fetch speeches:", error);
        toast.error("Failed to fetch speeches");
      }
    };
    fetchSpeeches();
  }, [currentUser, isDelegateUser, isChairUser]);

  useEffect(() => {
    if (editorRef.current) editorRef.current.setEditable(!isBusy);
  }, [isBusy]);

  const postSpeech = async () => { /* unchanged logic */
    if (isBusy) return;
    if (!currentUser) return toast.error("No user logged in");
    if (!editorRef.current) return toast.error("Editor not initialized");
    if (editorRef.current.getText().length === 0) return toast.error("Speech content cannot be empty");
    if (!title.trim()) return toast.error("Please enter a speech title");

    const content = editorRef.current.getJSON();
    const serializedContent = JSON.stringify(content);
    const timestamp = new Date().toISOString();
    setIsSaving(true);

    try {
      if (selectedSpeech) {
        const { error: updateError } = await supabase.from("Speech").update({ title, content: serializedContent, date: timestamp }).eq("speechID", selectedSpeech.speechID);
        if (updateError) throw updateError;
        const updatedSpeech: Speech = { ...selectedSpeech, title, content: serializedContent, date: timestamp };
        setFetchedSpeeches((prev) => prev.map((speech) => (speech.speechID === updatedSpeech.speechID ? updatedSpeech : speech)));
        setSelectedSpeech(updatedSpeech);
        toast.success("Speech updated successfully!");
      } else {
        const { data: existingSpeeches, error: speechIdError } = await supabase.from<{ speechID: string }>("Speech").select("speechID");
        if (speechIdError) throw speechIdError;
        const numericSpeechIds = (existingSpeeches ?? []).map((row) => Number.parseInt(row.speechID, 10)).filter((id) => Number.isFinite(id));
        const nextSpeechId = (numericSpeechIds.length > 0 ? Math.max(...numericSpeechIds) + 1 : 1).toString().padStart(4, "0");

        const { error: insertError } = await supabase.from("Speech").insert({ speechID: nextSpeechId, content: serializedContent, title, date: timestamp });
        if (insertError) throw insertError;

        if (isDelegateUser) {
          const { error: linkError } = await supabase.from("Delegate-Speech").insert({ speechID: nextSpeechId, delegateID: (currentUser as Delegate).delegateID });
          if (linkError) throw linkError;
        } else if (isChairUser) {
          const { error: linkError } = await supabase.from("Chair-Speech").insert({ speechID: nextSpeechId, chairID: (currentUser as Chair).chairID });
          if (linkError) throw linkError;
        }

        const createdSpeech: Speech = { speechID: nextSpeechId, title, content: serializedContent, date: timestamp, delegateID: isDelegateUser ? (currentUser as Delegate).delegateID : "", tags: [] };
        setFetchedSpeeches((prev) => [...prev, createdSpeech]);
        setSelectedSpeech(createdSpeech);
        toast.success("Speech posted successfully!");
      }

      initialStateRef.current = { title, content: getEditorSnapshot() };
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to save speech:", error);
      toast.error("Failed to save speech");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSpeech = async () => { /* unchanged logic */
    if (!selectedSpeech || isBusy) return;
    if (!currentUser) return toast.error("No user logged in");
    if (!isDelegateUser && !isChairUser) return toast.error("You do not have permission to delete speeches.");
    if (isDelegateUser && selectedSpeech.delegateID && selectedSpeech.delegateID !== (currentUser as Delegate).delegateID) return toast.error("You can only delete your own speeches.");
    if (!window.confirm("Are you sure you want to delete this speech? This action cannot be undone.")) return;

    setIsDeleting(true);
    try {
      await supabase.from("Speech").delete().eq("speechID", selectedSpeech.speechID);
      if (isDelegateUser) await supabase.from("Delegate-Speech").delete().eq("speechID", selectedSpeech.speechID).eq("delegateID", (currentUser as Delegate).delegateID);
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
      <div className="min-h-screen bg-[#f9f9f9] text-[#1a1c1c] px-8 pb-12 pt-6" style={{ fontFamily: "var(--font-manrope), Manrope, ui-sans-serif, system-ui" }}>
        <main className="max-w-[1600px] mx-auto">
          <div className="grid grid-cols-12 gap-8">
            <aside className="col-span-12 lg:col-span-3 space-y-6">
              <div className="p-6 rounded-xl border border-[#dcc0bd]/40 bg-[#f4f3f3] shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-[#500608]" style={{ fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif" }}>Saved Speeches</h2>
                  <span className="text-xs uppercase tracking-[0.2em] text-[#564240]">{fetchedSpeeches.length}</span>
                </div>
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {fetchedSpeeches.length === 0 ? (
                    <p className="text-sm text-[#564240]">No saved speeches yet.</p>
                  ) : (
                    fetchedSpeeches.map((speech) => {
                      const active = selectedSpeech?.speechID === speech.speechID;
                      return (
                        <button key={speech.speechID} onClick={() => handleSelectSpeech(speech)} disabled={isBusy} className={`w-full rounded-lg border p-4 text-left transition ${active ? "bg-white border-[#6E1D1B]/45 shadow" : "bg-white/80 border-[#dcc0bd]/60 hover:border-[#6E1D1B]/30"}`}>
                          <p className="text-[10px] uppercase tracking-widest text-[#564240]/70">{speech.date ? new Date(speech.date).toLocaleDateString() : "No date"}</p>
                          <p className="mt-1 text-base font-semibold text-[#1a1c1c]" style={{ fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif" }}>{speech.title || `Speech ${speech.speechID}`}</p>
                        </button>
                      );
                    })
                  )}
                </div>
                <button type="button" onClick={handleStartNewSpeech} disabled={isBusy} className="mt-6 w-full rounded-xl border border-[#6E1D1B]/25 py-2.5 text-xs font-bold uppercase tracking-widest text-[#6E1D1B] hover:bg-white disabled:opacity-60 inline-flex items-center justify-center gap-2">
                  <Plus size={14} /> New Document
                </button>
              </div>

              <div className="rounded-xl overflow-hidden border border-[#dcc0bd]/50 bg-gradient-to-br from-[#6E1D1B] to-[#500608] p-5">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#FFF0E5]/75">Writing tip</p>
                <p className="mt-3 text-[#FFF0E5] text-base leading-relaxed" style={{ fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif" }}>
                  Prioritize one clear diplomatic ask per paragraph to keep your intervention persuasive and easy to follow.
                </p>
              </div>
            </aside>

            <section className="col-span-12 lg:col-span-9">
              <div className="min-h-[760px] rounded-xl border border-[#dcc0bd]/40 bg-white shadow-[0_8px_32px_rgba(26,28,28,0.06)] overflow-hidden flex flex-col">
                <div className="px-6 py-4 bg-[#f4f3f3] border-b border-[#dcc0bd]/40 flex items-center justify-between gap-4">
                  <div className="text-xs uppercase tracking-widest text-[#564240]">{hasUnsavedChanges ? "Unsaved changes" : "Saved state synced"}</div>
                  <button onClick={postSpeech} className="px-5 py-2.5 rounded-xl bg-[#6E1D1B] text-white text-xs font-bold uppercase tracking-widest disabled:opacity-60 inline-flex items-center gap-2" disabled={isBusy}>
                    {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Save Speech"}
                  </button>
                </div>

                <div className="flex-1 p-8 md:p-12 bg-[#fff]">
                  <div className="max-w-3xl mx-auto space-y-8 min-h-[520px]">
                    <div className="border-b border-[#6E1D1B]/10 pb-6">
                      <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={isBusy} placeholder="Enter speech title..." className="w-full bg-transparent outline-none text-4xl font-bold text-[#500608] placeholder:text-[#500608]/30" style={{ fontFamily: "var(--font-newsreader), Newsreader, Georgia, serif" }} />
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
