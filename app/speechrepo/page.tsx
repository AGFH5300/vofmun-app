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
      <div className="text-white bg-black min-h-screen text-center p-8">
        Only delegates or chairs can access this page.
      </div>
    );
  }

  return (
    <ParticipantRoute>
      <div className="min-h-screen w-full bg-soft-ivory flex flex-col overflow-hidden">
        <main className="flex-1 flex flex-col items-center justify-start px-2 py-4 md:py-6 overflow-y-auto">
          <div className="flex items-center justify-center gap-4 mb-4 md:mb-6">
            <h1 className="text-3xl md:text-5xl font-extrabold text-deep-red text-center tracking-tight drop-shadow-lg">
              Speeches Page
            </h1>
          </div>
          <div className="flex flex-col md:flex-row w-full max-w-7xl gap-4 md:gap-6 px-2 mb-8">
            <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col gap-4">
              <aside className="w-full max-h-[300px] md:max-h-[500px] overflow-y-auto bg-white text-almost-black-green rounded-2xl shadow-2xl p-4 flex flex-col gap-3 mb-4 md:mb-0 border border-cool-grey">
                <h2 className="text-xl md:text-2xl text-center font-extrabold mb-3 tracking-tight text-deep-red drop-shadow">
                  All Speeches
                </h2>
                {fetchedSpeeches.length === 0 ? (
                  <div className="text-cool-grey text-center italic p-4">
                    No speeches found.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fetchedSpeeches.map((speech, idx) => {
                      if (!speech) return null;
                      return (
                        <button
                          key={speech.speechID}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 cursor-pointer border-2 shadow-md text-left font-semibold text-almost-black-green
                        ${
                          selectedSpeech?.speechID === speech.speechID
                            ? "border-deep-red bg-pale-aqua scale-[1.02]"
                            : "border-cool-grey bg-warm-light-grey hover:scale-[1.02] hover:border-deep-red hover:bg-soft-rose"
                        }
                      `}
                          onClick={() => {
                            setSelectedSpeech(speech);
                            setTitle(speech.title || "");
                          }}
                        >
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-deep-red text-white font-bold shadow">
                            {idx + 1}
                          </span>
                          <span className="text-sm md:text-base flex-1">
                            {speech.title ? speech.title : `Speech #${idx + 1}`}
                          </span>
                          <span className="text-deep-red text-lg">&gt;</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </aside>
            </div>

            <section className="flex-1 flex flex-col bg-white text-almost-black-green border border-cool-grey rounded-lg shadow-lg p-2 md:p-4 max-h-[500px] md:max-h-[600px] overflow-auto relative z-0">
              <div className="mb-3">
                <textarea
                  placeholder="Speech Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 text-almost-black-green bg-warm-light-grey border border-cool-grey rounded-lg focus:outline-none focus:ring-2 focus:ring-deep-red focus:border-transparent resize-none"
                  rows={1}
                />
              </div>
              <div className="flex-1 overflow-auto">
                <SimpleEditor
                  ref={editorRef}
                  content={selectedSpeech?.content ? JSON.parse(selectedSpeech.content) : undefined}
                  className="h-full toolbar-fixed"
                />
              </div>
              <div className="flex justify-end mt-3 pb-1 sticky bottom-0 right-0 z-10 bg-gradient-to-t from-white to-transparent pt-4">
                <button
                  onClick={postSpeech}
                  className="rounded-lg cursor-pointer px-5 py-2.5 bg-deep-red hover:bg-dark-burgundy text-black font-semibold shadow-lg transition-colors"
                >
                  {selectedSpeech ? "Update Speech" : "Post Speech"}
                </button>
              </div>
            </section>
          </div>
        </main>
      </div>
    </ParticipantRoute>
  );
};

export default Page;