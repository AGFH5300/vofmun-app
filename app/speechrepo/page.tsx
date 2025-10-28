"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Speech } from "@/db/types";
import { useSession } from "../context/sessionContext";
import { Editor } from "@tiptap/react";
import { SimpleEditor } from "../../components/tiptap-templates/simple/simple-editor";
import { ParticipantRoute } from "@/components/protectedroute";
import { toast } from "sonner";
import role from "@/lib/roles";

const Page = () => {
  const { user: currentUser } = useSession();
  const userRole = role(currentUser);
  const editorRef = React.useRef<Editor | null>(null);
  const [fetchedSpeeches, setFetchedSpeeches] = useState<Speech[]>([]);
  const [selectedSpeech, setSelectedSpeech] = useState<Speech | null>(null);
  const [title, setTitle] = useState<string>("");
  const isDelegateUser = userRole === "delegate" && currentUser !== null;
  const isChairUser = userRole === "chair" && currentUser !== null;

  useEffect(() => {
    if (selectedSpeech) {
      setTitle(selectedSpeech.title || "");
    } else {
      setTitle("");
    }
  }, [selectedSpeech]);

  useEffect(() => {
    const fetchSpeeches = async () => {
      if (!currentUser) return;

      let endpoint = "/api/speeches";
      if (isDelegateUser) {
        endpoint += `/delegate?delegateID=${currentUser.delegateID}`;
      } else if (isChairUser) {
        endpoint += `/chair?committeeID=${currentUser.committee.committeeID}`;
      }

      const res = await fetch(endpoint);
      const data = await res.json();
      setFetchedSpeeches(data.speeches || []);

      if (selectedSpeech) {
        const updatedSelectedSpeech = data.find((speech: Speech) => speech.speechID === selectedSpeech.speechID);
        if (updatedSelectedSpeech) {
          setTitle(updatedSelectedSpeech.title || "");
        }
      }
    };

    fetchSpeeches();
  }, [currentUser, isDelegateUser, isChairUser, selectedSpeech]);

  const postSpeech = async () => {
    if (!currentUser) {
      toast.error("No user logged in");
      return;
    }

    if (!editorRef.current) {
      toast.error("Editor not initialized");
      return;
    }

    const editorText = editorRef.current.getText();
    if (editorText.length === 0) {
      toast.error("Speech content cannot be empty");
      return;
    }

    if (!title.trim()) {
      toast.error("Please enter a speech title");
      return;
    }

    const content = editorRef.current.getJSON();

    let delegateID = "";
    let committeeID = "";

    if (isDelegateUser) {
      delegateID = currentUser.delegateID;
      committeeID = currentUser.committee.committeeID;
    } else if (isChairUser) {
      delegateID = selectedSpeech?.delegateID || "";
      committeeID = currentUser.committee.committeeID;
    }

    const res = await fetch("/api/speeches/delegate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        speechID: selectedSpeech ? selectedSpeech.speechID : "-1",
        delegateID,
        title,
        content: JSON.stringify(content),
        date: new Date().toISOString(),
        tags: [],
        isNew: !selectedSpeech,
      }),
    });

    if (!res.ok) {
      toast.error("Failed to save speech");
      return;
    }

    const newSpeech = await res.json();
    toast.success(
      `Speech ${selectedSpeech ? "updated" : "posted"} successfully!`
    );

    if (!selectedSpeech && !fetchedSpeeches.some((s) => s.speechID === newSpeech.speechID)) {
      setFetchedSpeeches((prev) => [...prev, newSpeech]);
      setTitle("");
    }
  };

  if (!isDelegateUser && !isChairUser) {
    return (
      <div className="page-shell">
        <div className="page-maxwidth flex items-center justify-center">
          <div className="surface-card p-10 text-center max-w-md">
            <h2 className="text-2xl font-semibold text-deep-red mb-3">Restricted Access</h2>
            <p className="text-almost-black-green/75">Only delegates and chairs can view the speech repository. Please sign in with the appropriate credentials.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ParticipantRoute>
      <div className="page-shell">
        <main className="page-maxwidth space-y-10">
          <header className="surface-card is-emphasised overflow-hidden px-8 py-10 text-center">
            <span className="badge-pill bg-white/15 text-white/85 inline-flex justify-center mx-auto mb-4">
              Prepared Speeches
            </span>
            <h1 className="text-4xl md:text-5xl font-serif font-semibold text-white">Speech Repository</h1>
            <p className="text-white/80 max-w-3xl mx-auto mt-3">
              Draft, rehearse, and refine your remarks. Save iterations or review submissions from your committee to stay ahead in debate.
            </p>
          </header>

          <section className="flex flex-col lg:flex-row gap-6">
            <aside className="lg:w-1/3 space-y-4">
              <div className="surface-card p-6 max-h-[520px] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-deep-red">All Speeches</h2>
                  <span className="badge-pill bg-soft-ivory text-deep-red/80">{fetchedSpeeches.length} saved</span>
                </div>
                {fetchedSpeeches.length === 0 ? (
                  <div className="text-almost-black-green/60 text-center py-6 italic">
                    No speeches yet. Start drafting your first statement.
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {fetchedSpeeches.map((speech, idx) => {
                      if (!speech) return null;
                      const isActive = selectedSpeech?.speechID === speech.speechID;
                      return (
                        <li key={speech.speechID}>
                          <button
                            className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${isActive ? 'border-deep-red bg-soft-ivory shadow-lg' : 'border-soft-ivory bg-warm-light-grey hover:border-deep-red/60'}`}
                            onClick={() => {
                              setSelectedSpeech(speech);
                              setTitle(speech.title || "");
                            }}
                          >
                            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-semibold ${isActive ? 'bg-deep-red text-white' : 'bg-soft-rose text-deep-red'}`}>
                              {idx + 1}
                            </span>
                            <div className="flex-1">
                              <p className="font-semibold text-almost-black-green">
                                {speech.title ? speech.title : `Speech #${idx + 1}`}
                              </p>
                              <p className="text-xs text-almost-black-green/60">Tap to load in editor</p>
                            </div>
                            <ArrowRight size={16} className={`transition-colors ${isActive ? 'text-deep-red' : 'text-deep-red/50'}`} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </aside>

            <div className="flex-1">
              <div className="surface-card p-4 md:p-6 h-full flex flex-col">
                <div className="mb-4">
                  <label className="text-xs uppercase tracking-[0.3em] text-deep-red/70 block mb-2">Speech Title</label>
                  <textarea
                    placeholder="Give your speech a compelling title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-xl border border-soft-ivory bg-warm-light-grey px-4 py-3 text-almost-black-green focus:border-deep-red/60 focus:ring-2 focus:ring-deep-red/30 resize-none"
                    rows={1}
                  />
                </div>
                <div className="flex-1 overflow-hidden">
                  <SimpleEditor
                    ref={editorRef}
                    content={selectedSpeech?.content ? JSON.parse(selectedSpeech.content) : undefined}
                    className="h-full toolbar-fixed"
                  />
                </div>
                <div className="flex justify-end pt-4 mt-4 border-t border-soft-ivory">
                  <button
                    onClick={postSpeech}
                    className="primary-button"
                  >
                    {selectedSpeech ? "Update Speech" : "Post Speech"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </ParticipantRoute>
  );
};

export default Page;